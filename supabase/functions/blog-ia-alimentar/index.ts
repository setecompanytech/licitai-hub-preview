import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CATEGORIAS_BUSCA = [
  {
    query: 'mudanças climáticas preços alimentos gêneros alimentícios inflação Brasil 2026',
    categoria: 'clima-alimentos',
    tags: ['clima', 'alimentos', 'inflação', 'preços'],
  },
  {
    query: 'caso fortuito força maior licitações contratos públicos calamidade enchente seca Brasil 2026',
    categoria: 'forca-maior',
    tags: ['caso fortuito', 'força maior', 'calamidade', 'contratos'],
  },
  {
    query: 'TCU jurisprudência licitações contratos administrativos reequilíbrio econômico 2026',
    categoria: 'jurisprudencia',
    tags: ['TCU', 'jurisprudência', 'contratos', 'reequilíbrio'],
  },
  {
    query: 'reajuste salarial dissídio coletivo convenção coletiva 2026 vigilância limpeza mão de obra terceirizada piso salarial INPC',
    categoria: 'reajustes',
    tags: ['reajuste', 'dissídio', 'CCT', 'mão de obra', 'piso salarial'],
  },
];

async function searchFirecrawl(apiKey: string, query: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 5,
        lang: 'pt-br',
        country: 'BR',
        tbs: 'qdr:d', // últimas 24h
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl search error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (e) {
    console.error('Firecrawl error:', e);
    return [];
  }
}

async function searchTCU(apiKey: string): Promise<any[]> {
  try {
    // Buscar jurisprudência do TCU via Firecrawl scraping
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://pesquisa.apps.tcu.gov.br/#/pesquisa/jurisprudencia',
        formats: ['markdown'],
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.error('TCU scrape error:', response.status);
      return [];
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    return [{ title: 'Jurisprudência TCU', markdown, url: 'https://pesquisa.apps.tcu.gov.br' }];
  } catch (e) {
    console.error('TCU scrape error:', e);
    return [];
  }
}

async function generateArticle(
  openaiKey: string,
  newsData: any[],
  tcuData: any[],
  categoria: { query: string; categoria: string; tags: string[] }
): Promise<any[]> {
  const newsContext = newsData
    .map((n, i) => `[${i + 1}] Título: ${n.title || 'Sem título'}\nURL: ${n.url || ''}\nConteúdo: ${(n.markdown || n.description || '').substring(0, 1500)}`)
    .join('\n\n---\n\n');

  const tcuContext = tcuData
    .map(t => `TCU: ${(t.markdown || '').substring(0, 2000)}`)
    .join('\n');

  let systemPrompt = '';
  let userPrompt = '';

  if (categoria.categoria === 'clima-alimentos') {
    systemPrompt = `Você é um jornalista especializado em licitações públicas e contratos administrativos (Lei 14.133/2021). 
Sua missão é analisar notícias sobre mudanças climáticas e seu impacto nos preços de gêneros alimentícios, 
contextualizando para o mercado de compras governamentais.`;
    userPrompt = `Com base nas notícias abaixo, gere 2 artigos originais sobre como mudanças climáticas estão afetando 
os preços de gêneros alimentícios e o impacto direto nas licitações e contratos públicos de fornecimento.

Contextualize com:
- Impacto nos preços de referência do Painel de Preços Gov.br
- Possibilidade de reequilíbrio econômico-financeiro (Art. 124, II, d da Lei 14.133/2021)
- Caso fortuito ou força maior quando aplicável (Art. 393 do Código Civil)
- Jurisprudência do TCU sobre reajustes extraordinários

NOTÍCIAS:
${newsContext}

${tcuContext ? `\nJURISPRUDÊNCIA TCU:\n${tcuContext}` : ''}

Retorne APENAS um JSON array com objetos contendo: titulo, resumo (max 200 chars), conteudo (artigo completo em markdown, min 800 palavras), 
tags (array de strings), destaque (boolean), caso_fortuito (boolean), forca_maior (boolean), tcu_referencia (texto com número do acórdão se houver),
fonte_url (URL da notícia principal), fonte_nome (nome do jornal).`;
  } else if (categoria.categoria === 'forca-maior') {
    systemPrompt = `Você é um jurista especializado em Direito Administrativo e contratos públicos (Lei 14.133/2021).
Analise eventos que configuram caso fortuito e força maior e seu impacto em licitações e contratos governamentais.`;
    userPrompt = `Com base nas notícias abaixo, gere 2 artigos sobre eventos de caso fortuito e força maior 
e seus impactos em contratos públicos e licitações.

Fundamente juridicamente com:
- Art. 393 do Código Civil (caso fortuito e força maior)
- Art. 124, II, d da Lei 14.133/2021 (alteração contratual)
- Art. 137 da Lei 14.133/2021 (extinção do contrato)
- Jurisprudência dos Tribunais Superiores (STJ, STF) e TCU
- Precedentes sobre reequilíbrio econômico-financeiro

NOTÍCIAS:
${newsContext}

${tcuContext ? `\nJURISPRUDÊNCIA TCU:\n${tcuContext}` : ''}

Retorne APENAS um JSON array com objetos contendo: titulo, resumo (max 200 chars), conteudo (artigo completo em markdown, min 800 palavras), 
tags (array de strings), destaque (boolean), caso_fortuito (boolean), forca_maior (boolean), tcu_referencia (texto com número do acórdão se houver),
fonte_url (URL da notícia principal), fonte_nome (nome do jornal).`;
  } else if (categoria.categoria === 'reajustes') {
    systemPrompt = `Você é um especialista em relações trabalhistas e contratos de serviços continuados com mão de obra (Lei 14.133/2021, IN SEGES/ME nº 5/2017).
Analise dissídios coletivos, convenções coletivas de trabalho e reajustes salariais e seu impacto direto em contratos públicos de terceirização.`;
    userPrompt = `Com base nas notícias abaixo, gere 2 artigos sobre reajustes salariais, dissídios coletivos e convenções coletivas 
e seus impactos em contratos públicos de serviços continuados (vigilância, limpeza, manutenção, engenharia, TI, etc.).

Aborde temas como:
- Novos pisos salariais por categoria profissional
- Reajustes de CCTs registradas no Mediador/MTE
- Impacto nos custos de planilhas de formação de preços (IN SEGES/ME nº 5/2017)
- Procedimento de repactuação (Art. 135, I, Lei 14.133/2021)
- Índices INPC/IPCA aplicáveis aos insumos (Art. 135, II)
- SINAPI e CUB para serviços de engenharia
- Prazos e procedimentos para solicitar repactuação

NOTÍCIAS:
${newsContext}

${tcuContext ? `\nJURISPRUDÊNCIA TCU:\n${tcuContext}` : ''}

Retorne APENAS um JSON array com objetos contendo: titulo, resumo (max 200 chars), conteudo (artigo completo em markdown, min 800 palavras), 
tags (array de strings), destaque (boolean), caso_fortuito (boolean), forca_maior (boolean), tcu_referencia (texto com número do acórdão se houver),
fonte_url (URL da notícia principal), fonte_nome (nome do jornal).`;
  } else {
    systemPrompt = `Você é um consultor de licitações e contratos públicos especializado em jurisprudência do TCU e Tribunais Superiores.
Analise decisões recentes e contextualize para fornecedores do governo.`;
    userPrompt = `Com base nas notícias e dados do TCU abaixo, gere 2 artigos sobre jurisprudência recente 
do TCU e Tribunais Superiores aplicável a licitações e contratos públicos.

Aborde temas como:
- Acórdãos recentes do TCU sobre pregão eletrônico, inexigibilidade e dispensa
- Entendimentos do STJ sobre contratos administrativos
- Súmulas vinculantes aplicáveis a licitações
- Decisões sobre penalidades e sanções administrativas
- Impacto prático para fornecedores

NOTÍCIAS E DADOS:
${newsContext}

${tcuContext ? `\nJURISPRUDÊNCIA TCU:\n${tcuContext}` : ''}

Retorne APENAS um JSON array com objetos contendo: titulo, resumo (max 200 chars), conteudo (artigo completo em markdown, min 800 palavras), 
tags (array de strings), destaque (boolean), caso_fortuito (boolean), forca_maior (boolean), tcu_referencia (texto com número do acórdão se houver),
fonte_url (URL da notícia principal), fonte_nome (nome do jornal).`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    console.error('AI error:', status);
    if (status === 429) throw new Error('Rate limit exceeded');
    if (status === 402) throw new Error('Credits exhausted');
    throw new Error(`AI error ${status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('No JSON in AI response');
    return [];
  }

  return JSON.parse(jsonMatch[0]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiKey || !firecrawlKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chaves não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Iniciando alimentação do blog...');

    // Buscar dados do TCU uma vez
    const tcuData = await searchTCU(firecrawlKey);
    console.log(`TCU: ${tcuData.length} resultados`);

    let totalArtigos = 0;

    for (const cat of CATEGORIAS_BUSCA) {
      console.log(`Buscando: ${cat.categoria}`);

      // Buscar notícias
      const newsResults = await searchFirecrawl(firecrawlKey, cat.query);
      console.log(`${cat.categoria}: ${newsResults.length} notícias encontradas`);

      if (newsResults.length === 0) continue;

      // Gerar artigos com IA
      const artigos = await generateArticle(openaiKey, newsResults, tcuData, cat);
      console.log(`${cat.categoria}: ${artigos.length} artigos gerados`);

      // Salvar no banco
      for (const artigo of artigos) {
        const wordCount = (artigo.conteudo || '').split(/\s+/).length;
        const tempoLeitura = `${Math.max(3, Math.ceil(wordCount / 200))} min`;

        const { error } = await supabase.from('blog_artigos').insert({
          titulo: artigo.titulo,
          resumo: artigo.resumo,
          conteudo: artigo.conteudo,
          categoria: cat.categoria,
          autor: 'PRAEFECTUS News',
          tempo_leitura: tempoLeitura,
          tags: [...(artigo.tags || []), ...cat.tags],
          destaque: artigo.destaque || false,
          fonte_url: artigo.fonte_url || newsResults[0]?.url,
          fonte_nome: artigo.fonte_nome || 'Imprensa Nacional',
          tcu_referencia: artigo.tcu_referencia || null,
          caso_fortuito: artigo.caso_fortuito || false,
          forca_maior: artigo.forca_maior || false,
        });

        if (error) {
          console.error('Insert error:', error.message);
        } else {
          totalArtigos++;
        }
      }

      // Delay entre categorias para evitar rate limit
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`Blog alimentado: ${totalArtigos} artigos inseridos`);

    return new Response(
      JSON.stringify({ success: true, artigos_gerados: totalArtigos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro ao processar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
