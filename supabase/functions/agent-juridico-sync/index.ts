import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const inicio = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ ok: false, msg: 'FIRECRAWL_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Buscar jurisprudência recente do TCU via Firecrawl
    const queries = [
      'site:tcu.gov.br acórdão licitação 2025 2026',
      'site:tcu.gov.br súmula licitação pregão',
      'site:tcu.gov.br acórdão Lei 14133 recente',
    ];

    let totalIndexados = 0;

    for (const query of queries) {
      try {
        const resp = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit: 10,
            scrapeOptions: { formats: ['markdown'] },
          }),
        });

        if (!resp.ok) continue;
        const data = await resp.json();
        const results = data.data || [];

        for (const result of results) {
          if (!result.url || !result.title) continue;

          // Check if already indexed
          const { data: existing } = await supabase
            .from('agent_jurisprudencia')
            .select('id')
            .eq('numero', result.title)
            .maybeSingle();

          if (existing) continue;

          // Extract number pattern (e.g., "Acórdão 1234/2025")
          const numMatch = result.title.match(/(?:Acórdão|Súmula|Decisão)\s*[\w\/\-]+/i);

          // Extract tags from content
          const tags: string[] = [];
          const content = (result.markdown || result.description || '').toLowerCase();
          if (/pregão|pregao/.test(content)) tags.push('pregao');
          if (/dispensa/.test(content)) tags.push('dispensa');
          if (/habilitação|habilitacao/.test(content)) tags.push('habilitacao');
          if (/recurso/.test(content)) tags.push('recurso');
          if (/impugnação|impugnacao/.test(content)) tags.push('impugnacao');
          if (/14\.?133/.test(content)) tags.push('lei_14133');
          if (/me\/epp|microempresa/.test(content)) tags.push('me_epp');
          if (tags.length === 0) tags.push('geral');

          await supabase.from('agent_jurisprudencia').insert({
            fonte: 'TCU',
            numero: numMatch?.[0] || result.title.slice(0, 100),
            ementa: result.description?.slice(0, 500) || result.title,
            conteudo: (result.markdown || '').slice(0, 5000),
            data_pub: new Date().toISOString().split('T')[0],
            tags,
          });

          totalIndexados++;
        }
      } catch (e) {
        console.error('Firecrawl search error:', e);
      }
    }

    // 2. Log
    await supabase.from('agent_acoes_log').insert({
      agente: 'agent_juridico',
      acao: 'sync_jurisprudencia',
      status: 'sucesso',
      payload_out: { total_indexados: totalIndexados },
      duracao_ms: Date.now() - inicio,
    });

    return new Response(JSON.stringify({
      ok: true,
      total_indexados: totalIndexados,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Juridico Sync error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
