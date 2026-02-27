const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "application/pdf,application/zip,application/octet-stream,application/json,text/html,*/*",
};

// Parse PNCP control number: "CNPJ-ANO-SEQUENCIAL"
function parsePncpNumero(
  numero: string
): { cnpj: string; ano: string; sequencial: string } | null {
  // Format: 00000000000000-1-000001/2024 or 00394502000144-1-000042/2024
  const match = numero.match(
    /(\d{14})-(\d+)-(\d+)(?:\/(\d{4}))?/
  );
  if (match) {
    return {
      cnpj: match[1],
      ano: match[4] || new Date().getFullYear().toString(),
      sequencial: match[3],
    };
  }
  return null;
}

// Fetch and return binary file as base64 response  
async function fetchFileAsBase64(
  url: string,
  timeoutMs = 15000
): Promise<{
  success: boolean;
  base64?: string;
  contentType?: string;
  size?: number;
  fileName?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text();
      console.log(`Fetch failed ${resp.status}: ${text.substring(0, 200)}`);
      return { success: false, error: `HTTP ${resp.status}` };
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    
    // Check if it's a binary file we want
    const isBinary =
      contentType.includes("pdf") ||
      contentType.includes("zip") ||
      contentType.includes("octet-stream") ||
      contentType.includes("msword") ||
      contentType.includes("officedocument") ||
      contentType.includes("excel");

    if (!isBinary) {
      await resp.text(); // consume
      return { success: false, error: "Not a downloadable file" };
    }

    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Convert to base64 in chunks to avoid call stack issues
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Try to get filename from content-disposition
    const disposition = resp.headers.get("content-disposition") || "";
    const fileNameMatch = disposition.match(/filename[^;=\n]*=["']?([^"';\n]+)/i);
    const fileName = fileNameMatch?.[1] || null;

    return {
      success: true,
      base64,
      contentType,
      size: buffer.byteLength,
      fileName: fileName || undefined,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Fetch error" };
  }
}

// Try PNCP API to list & download documents
async function tryPncpDownload(
  cnpj: string,
  ano: string,
  sequencial: string
): Promise<Response | null> {
  // Step 1: List available documents
  const listUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
  console.log(`PNCP list docs: ${listUrl}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const listResp = await fetch(listUrl, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!listResp.ok) {
      await listResp.text();
      console.log(`PNCP list failed: ${listResp.status}`);
      return null;
    }

    const docs = await listResp.json();
    const arquivos = Array.isArray(docs) ? docs : [];
    
    if (arquivos.length === 0) {
      console.log("PNCP: no documents found");
      return null;
    }

    console.log(`PNCP: found ${arquivos.length} documents`);

    // Step 2: Download the edital file (prefer tipo=2 = Edital, or first file)
    const editalDoc =
      arquivos.find((d: any) => d.tipoDocumentoId === 2) ||
      arquivos.find((d: any) =>
        (d.titulo || d.nomeArquivo || "").toLowerCase().includes("edital")
      ) ||
      arquivos[0];

    const seqArquivo = editalDoc.sequencialDocumento || editalDoc.sequencialArquivo || 1;
    const downloadUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArquivo}`;
    console.log(`PNCP download: ${downloadUrl}`);

    const result = await fetchFileAsBase64(downloadUrl);

    if (result.success && result.base64) {
      const ext = (result.contentType || "").includes("pdf") ? "pdf" : "zip";
      const nome = result.fileName || editalDoc.nomeArquivo || `edital.${ext}`;

      return new Response(
        JSON.stringify({
          success: true,
          tipo: "arquivo_direto",
          arquivo: {
            nome,
            conteudo_base64: result.base64,
            content_type: result.contentType,
            tamanho: result.size,
          },
          documentos_disponiveis: arquivos.map((d: any) => ({
            sequencial: d.sequencialDocumento || d.sequencialArquivo,
            nome: d.nomeArquivo || d.titulo || "Documento",
            tipo: d.tipoDocumentoNome || "Arquivo",
          })),
          portal: "PNCP",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If binary download failed, try returning the direct download URLs for client
    const docsWithUrls = arquivos.map((d: any, idx: number) => {
      const seq = d.sequencialDocumento || d.sequencialArquivo || idx + 1;
      return {
        nome: d.nomeArquivo || d.titulo || `documento-${idx + 1}`,
        url: `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seq}`,
        tipo: d.tipoDocumentoNome || "Arquivo",
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        tipo: "download_urls",
        documentos: docsWithUrls,
        portal: "PNCP",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.log("PNCP error:", e);
    return null;
  }
}

// Try downloading from a direct URL (linkSistemaOrigem or similar)
async function tryDirectUrlDownload(url: string): Promise<Response | null> {
  console.log(`Trying direct download: ${url}`);

  // First try fetching the URL directly as binary
  const result = await fetchFileAsBase64(url);
  if (result.success && result.base64) {
    const ext = (result.contentType || "").includes("pdf") ? "pdf" : "zip";
    return new Response(
      JSON.stringify({
        success: true,
        tipo: "arquivo_direto",
        arquivo: {
          nome: result.fileName || `edital.${ext}`,
          conteudo_base64: result.base64,
          content_type: result.contentType,
          tamanho: result.size,
        },
        portal: "Portal",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // If not binary, try scraping the HTML page for document links
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      headers: { ...FETCH_HEADERS, Accept: "text/html,*/*" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      await resp.text();
      return null;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      await resp.text();
      return null;
    }

    const html = await resp.text();

    // Extract document download links
    const docLinks: Array<{ url: string; nome: string }> = [];
    const linkRegex =
      /href=["']([^"']*?\.(pdf|zip|doc|docx|xls|xlsx|rar|7z)(?:\?[^"']*)?)/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let link = match[1];
      if (link.startsWith("/")) {
        link = new URL(url).origin + link;
      } else if (!link.startsWith("http")) {
        link = url.substring(0, url.lastIndexOf("/") + 1) + link;
      }
      const fileName = decodeURIComponent(link.split("/").pop()?.split("?")[0] || "documento");
      docLinks.push({ url: link, nome: fileName });
    }

    if (docLinks.length === 0) return null;

    // Try to download the first document
    const firstResult = await fetchFileAsBase64(docLinks[0].url);
    if (firstResult.success && firstResult.base64) {
      const ext = (firstResult.contentType || "").includes("pdf") ? "pdf" : "zip";
      return new Response(
        JSON.stringify({
          success: true,
          tipo: "arquivo_direto",
          arquivo: {
            nome: firstResult.fileName || docLinks[0].nome || `edital.${ext}`,
            conteudo_base64: firstResult.base64,
            content_type: firstResult.contentType,
            tamanho: firstResult.size,
          },
          documentos_disponiveis: docLinks.slice(0, 10),
          portal: "Portal",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the discovered links for client-side download
    return new Response(
      JSON.stringify({
        success: true,
        tipo: "download_urls",
        documentos: docLinks.slice(0, 10),
        portal: "Portal",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.log("Direct URL scrape error:", e);
    return null;
  }
}

// Format date to yyyyMMdd for PNCP API
function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// Try PNCP search + download for non-PNCP portals
async function tryPncpSearch(
  numero: string,
  orgao: string,
  objeto: string
): Promise<Response | null> {
  try {
    const now = new Date();
    const dataInicial = formatDatePNCP(new Date(now.getTime() - 180 * 86400000));
    const dataFinal = formatDatePNCP(new Date(now.getTime() + 180 * 86400000));
    
    const params = new URLSearchParams({
      dataInicial,
      dataFinal,
      codigoModalidadeContratacao: "6", // Pregão Eletrônico
      pagina: "1",
      tamanhoPagina: "10",
    });

    const searchUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params}`;
    console.log(`PNCP search fallback: ${searchUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(searchUrl, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.log(`PNCP search error ${resp.status}: ${errText.substring(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const items = data.data || [];
    
    if (items.length === 0) return null;

    // Try to find a match by objeto or orgao
    const searchTerms = [objeto, orgao, numero].filter(Boolean).map(s => s.toLowerCase());
    let bestMatch = items[0];
    for (const item of items) {
      const text = `${item.objetoCompra || ""} ${item.orgaoEntidade?.razaoSocial || ""}`.toLowerCase();
      if (searchTerms.some(t => text.includes(t))) {
        bestMatch = item;
        break;
      }
    }

    // Use anoCompra + sequencialCompra directly if available
    if (bestMatch.orgaoEntidade?.cnpj && bestMatch.anoCompra && bestMatch.sequencialCompra) {
      return tryPncpDownload(
        bestMatch.orgaoEntidade.cnpj,
        String(bestMatch.anoCompra),
        String(bestMatch.sequencialCompra)
      );
    }

    // Fallback: parse numeroControlePNCP
    const parsed = parsePncpNumero(bestMatch.numeroControlePNCP || "");
    if (parsed) {
      return tryPncpDownload(parsed.cnpj, parsed.ano, parsed.sequencial);
    }

    return null;
  } catch (e) {
    console.log("PNCP search fallback error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { numero, portal, url, orgao, objeto, cnpjOrgao, pncpNumero, anoCompra, sequencialCompra } = body;

    if (!numero && !url && !pncpNumero) {
      return new Response(
        JSON.stringify({ success: false, error: "Número ou URL do edital é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Download edital: num=${numero} portal=${portal} pncp=${pncpNumero} cnpj=${cnpjOrgao} ano=${anoCompra} seq=${sequencialCompra}`);

    // Strategy 0: If we have cnpjOrgao + anoCompra + sequencialCompra directly from PNCP API
    if (cnpjOrgao && anoCompra && sequencialCompra) {
      const cnpjClean = cnpjOrgao.replace(/[^\d]/g, "");
      console.log(`Direct PNCP: cnpj=${cnpjClean} ano=${anoCompra} seq=${sequencialCompra}`);
      const result = await tryPncpDownload(cnpjClean, String(anoCompra), String(sequencialCompra));
      if (result) return result;
    }

    // Strategy 1: If we have a PNCP control number, parse and use it
    const pncpParsed = parsePncpNumero(pncpNumero || "");
    if (pncpParsed) {
      console.log(`Parsed PNCP: cnpj=${pncpParsed.cnpj} ano=${pncpParsed.ano} seq=${pncpParsed.sequencial}`);
      const result = await tryPncpDownload(pncpParsed.cnpj, pncpParsed.ano, pncpParsed.sequencial);
      if (result) return result;
    }

    // Strategy 2: Try direct URL download (linkSistemaOrigem)
    if (url && url !== "https://pncp.gov.br" && !url.endsWith("/app/editais/")) {
      const result = await tryDirectUrlDownload(url);
      if (result) return result;
    }

    // Strategy 3: Search PNCP by keywords and download
    if (objeto || orgao) {
      const searchResult = await tryPncpSearch(numero || "", orgao || "", objeto || "");
      if (searchResult) return searchResult;
    }

    // No document found
    return new Response(
      JSON.stringify({
        success: false,
        error: `Não foi possível localizar o arquivo do edital ${numero || ""} no ${portal || "portal"}. O edital pode não estar disponível para download público via API.`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Download edital error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Erro no download do edital",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
