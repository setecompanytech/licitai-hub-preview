const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ano } = await req.json();
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUrl = `https://www.sistemas.pa.gov.br/portaltransparencia/empenho/notas`;
    console.log('Scraping Portal Transparência PA para ano:', ano || 'atual');

    // Try scraping with extended timeout
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 10000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Portal com carregamento lento. Use a importação manual de CSV/XLSX.',
          fallback: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to extract structured data from the scraped content
    const markdown = data?.data?.markdown || data?.markdown || '';
    
    // Parse table-like data from markdown
    const orgaos = parseOrgaosFromMarkdown(markdown);

    console.log(`Extraídos ${orgaos.length} órgãos do portal`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: orgaos,
        rawContent: markdown.substring(0, 2000),
        source: 'firecrawl'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao acessar portal',
        fallback: true
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseOrgaosFromMarkdown(markdown: string): Array<{orgao: string; valor: number; quantidade: number}> {
  const results: Array<{orgao: string; valor: number; quantidade: number}> = [];
  
  // Try to find table rows with org names and values
  const lines = markdown.split('\n');
  for (const line of lines) {
    // Look for lines with currency values (R$ pattern)
    const match = line.match(/\|?\s*([^|]+?)\s*\|?\s*R?\$?\s*([\d.,]+)\s*\|?/);
    if (match && match[1].trim().length > 5) {
      const orgao = match[1].trim();
      const valorStr = match[2].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr);
      if (!isNaN(valor) && valor > 0) {
        results.push({ orgao, valor, quantidade: 1 });
      }
    }
  }
  
  return results;
}
