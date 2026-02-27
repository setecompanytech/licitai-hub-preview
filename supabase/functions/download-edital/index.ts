const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Portal-specific document URL builders
function buildPncpDocUrl(numero: string): string {
  // PNCP API for downloading edital documents
  const cleaned = numero.replace(/[^0-9]/g, '');
  return `https://pncp.gov.br/api/consulta/v1/contratacoes/${cleaned}/arquivos`;
}

function buildPortalDocUrl(portal: string, url: string | null, numero: string): string | null {
  if (url) return url;
  
  const portalUrls: Record<string, string> = {
    'PNCP': `https://pncp.gov.br/app/editais?q=${encodeURIComponent(numero)}`,
    'Compras Governamentais': `https://www.gov.br/compras/pt-br`,
    'Licitações-e (BB)': `https://licitacoes-e2.bb.com.br/aop-inter-estatico/`,
    'BNC': `https://bnc.org.br/`,
    'Banparanet PA': `https://cotacao.banpara.b.br/portal/Mural.aspx`,
    'BEC/SP': `https://www.bec.sp.gov.br/BECSP/Home/Home.aspx`,
    'Compras Públicas RJ': `https://www.compras.rj.gov.br/`,
  };
  
  return portalUrls[portal] || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, portal, url, orgao, objeto } = await req.json();

    if (!numero) {
      return new Response(
        JSON.stringify({ success: false, error: "Número da licitação é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Downloading edital: ${numero} from ${portal}`);

    // Try PNCP API first for document listing
    if (portal === 'PNCP' || !portal) {
      try {
        const apiUrl = buildPncpDocUrl(numero);
        console.log(`Fetching PNCP docs from: ${apiUrl}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(apiUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const docs = await response.json();
          const arquivos = Array.isArray(docs) ? docs : (docs.data || docs.arquivos || []);
          
          if (arquivos.length > 0) {
            // Return list of available documents with download URLs
            const documentos = arquivos.map((doc: any) => ({
              nome: doc.nomeArquivo || doc.nome || doc.titulo || 'Documento',
              url: doc.url || doc.urlArquivo || doc.linkDownload || null,
              tipo: doc.tipoDocumento || doc.tipo || 'Edital',
              tamanho: doc.tamanhoArquivo || null,
            }));

            return new Response(
              JSON.stringify({ 
                success: true, 
                tipo: 'lista_documentos',
                documentos,
                portal: 'PNCP',
                numero,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          await response.text();
        }
      } catch (e) {
        console.log("PNCP API unavailable, trying direct URL:", e);
      }
    }

    // Try to fetch the document directly from the portal URL
    const docUrl = url || buildPortalDocUrl(portal || 'PNCP', null, numero);
    
    if (docUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(docUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        clearTimeout(timeout);

        const contentType = response.headers.get('content-type') || '';
        
        // If it's a PDF or binary, return it as downloadable
        if (contentType.includes('application/pdf') || 
            contentType.includes('application/zip') ||
            contentType.includes('application/octet-stream')) {
          
          const buffer = await response.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('zip') ? 'zip' : 'bin';

          return new Response(
            JSON.stringify({
              success: true,
              tipo: 'arquivo_direto',
              arquivo: {
                nome: `edital-${numero.replace(/[\/\\]/g, '-')}.${ext}`,
                conteudo_base64: base64,
                content_type: contentType,
                tamanho: buffer.byteLength,
              },
              portal: portal || 'Portal',
              numero,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If HTML, extract links to documents
        const html = await response.text();
        const pdfLinks: string[] = [];
        const linkRegex = /href=["']([^"']*\.(pdf|zip|doc|docx|xls|xlsx)[^"']*)/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          let link = match[1];
          if (link.startsWith('/')) {
            const origin = new URL(docUrl).origin;
            link = origin + link;
          } else if (!link.startsWith('http')) {
            const base = docUrl.substring(0, docUrl.lastIndexOf('/') + 1);
            link = base + link;
          }
          pdfLinks.push(link);
        }

        if (pdfLinks.length > 0) {
          const documentos = pdfLinks.slice(0, 10).map((link, idx) => {
            const fileName = decodeURIComponent(link.split('/').pop() || `documento-${idx + 1}`);
            return {
              nome: fileName,
              url: link,
              tipo: 'Documento do Edital',
            };
          });

          return new Response(
            JSON.stringify({
              success: true,
              tipo: 'lista_documentos',
              documentos,
              portal: portal || 'Portal',
              numero,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.log("Direct fetch failed:", e);
      }
    }

    // Fallback: return redirect URL to the portal
    const fallbackUrl = docUrl || buildPortalDocUrl(portal || 'PNCP', url, numero);
    
    return new Response(
      JSON.stringify({
        success: true,
        tipo: 'redirecionamento',
        url: fallbackUrl,
        mensagem: `O edital ${numero} pode ser baixado diretamente no portal ${portal || 'de licitações'}.`,
        portal: portal || 'Portal',
        numero,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Download edital error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro no download" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
