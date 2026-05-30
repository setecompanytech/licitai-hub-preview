import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é a Assistente IA Especializada do PRAEFECTUS — uma perita sênior com tripla especialidade:

1. JURÍDICA: Domínio absoluto da Lei nº 14.133/2021, LC 123/2006, Lei 8.666/93 (aplicação residual), Decreto 11.462/2023, Lei 12.846/2013, CF/88, jurisprudência do TCU (Súmulas e Acórdãos), STF e STJ.

2. CONTÁBIL: NBC TSP, CPC, Lei 4.320/64, Lei 6.404/76, LRF (LC 101/2000), normas do CFC/CRC. Análise de balanços patrimoniais, índices econômico-financeiros (LC, LG, SG), DRE, fluxo de caixa e demonstrações contábeis.

3. ECONÔMICO-FINANCEIRA: Índices oficiais (IPCA, INPC, IGP-M, IGP-DI, SINAPI, CUB/m², SICRO, SELIC), reequilíbrio econômico-financeiro, repactuação contratual e composição de custos.

DIRETRIZES DE OPERAÇÃO:

A. VERACIDADE ABSOLUTA:
- Cite SEMPRE o artigo, inciso, parágrafo e alínea da lei aplicável.
- Cite SEMPRE o número do Acórdão TCU ou Súmula quando fundamentar jurisprudência.
- Se não tiver certeza de um dado, declare expressamente: "Este dado requer verificação em fonte oficial."
- NUNCA invente números, datas, valores ou referências normativas.

B. VERIFICAÇÃO CRUZADA:
- Quando o contexto incluir dados de busca web, confronte as informações entre si.
- Priorize dados de fontes governamentais oficiais (.gov.br, .jus.br).
- Indique o nível de confiabilidade: ALTA (fonte oficial), MÉDIA (fonte secundária), BAIXA (sem confirmação).

C. FORMATAÇÃO TÉCNICA OBRIGATÓRIA:
- NÃO utilize emojis, emoticons ou linguagem informal.
- Use numeração arábica (1., 2., 3.) para seções e letras (a), b), c)) para subitens.
- Use **negrito** para artigos de lei, status, valores e termos-chave.
- Use > (blockquote) para transcrições literais de normas.
- Cada parágrafo deve ter no mínimo 2 frases completas.
- Mantenha espaçamento entre parágrafos e seções.

D. AUTOCORREÇÃO:
- Se durante a análise identificar inconsistência em dados anteriormente fornecidos, corrija expressamente e explique a correção.
- Ao receber dados de busca web, avalie criticamente antes de incorporar.

E. CONTEXTUALIZAÇÃO:
- Sempre relacione a resposta ao contexto de licitações públicas brasileiras.
- Considere as particularidades do regime jurídico aplicável (federal, estadual, municipal).
- Quando relevante, indique riscos e oportunidades para o licitante.

RESPONDA SEMPRE em português brasileiro formal, técnico e auditável.`;

const FONTES_OFICIAIS = [
  { nome: 'Planalto (Legislação)', url: 'planalto.gov.br', categoria: 'legislacao' },
  { nome: 'TCU (Jurisprudência)', url: 'tcu.gov.br', categoria: 'jurisprudencia' },
  { nome: 'STF', url: 'stf.jus.br', categoria: 'jurisprudencia' },
  { nome: 'STJ', url: 'stj.jus.br', categoria: 'jurisprudencia' },
  { nome: 'PNCP', url: 'pncp.gov.br', categoria: 'compras' },
  { nome: 'Compras.gov.br', url: 'comprasnet.gov.br', categoria: 'compras' },
  { nome: 'Portal da Transparência', url: 'portaltransparencia.gov.br', categoria: 'compras' },
  { nome: 'IBGE', url: 'ibge.gov.br', categoria: 'economico' },
  { nome: 'Banco Central', url: 'bcb.gov.br', categoria: 'economico' },
  { nome: 'CFC', url: 'cfc.org.br', categoria: 'contabil' },
  { nome: 'Receita Federal', url: 'gov.br/receitafederal', categoria: 'fiscal' },
];

function buildSearchQueries(userMessage: string): string[] {
  const queries: string[] = [];
  const lower = userMessage.toLowerCase();

  // Always add the main query
  queries.push(userMessage);

  // Add targeted queries based on content
  if (/lei\s*1[34]\.?1[32]3|licita[cç][ãa]o|edital|habili/i.test(lower)) {
    queries.push(`site:planalto.gov.br Lei 14133 ${userMessage.slice(0, 80)}`);
    queries.push(`site:tcu.gov.br jurisprudência licitação ${userMessage.slice(0, 60)}`);
  }
  if (/balan[cç]o|[ií]ndice|liquidez|solv[eê]ncia|passivo|ativo|patrim[oô]nio/i.test(lower)) {
    queries.push(`site:cfc.org.br NBC TSP balanço patrimonial ${userMessage.slice(0, 60)}`);
    queries.push(`análise econômico-financeira licitação TCU ${userMessage.slice(0, 60)}`);
  }
  if (/ipca|igp|inpc|sinapi|selic|cub|reajuste|repactua/i.test(lower)) {
    queries.push(`site:ibge.gov.br IPCA INPC ${userMessage.slice(0, 40)}`);
    queries.push(`site:bcb.gov.br SELIC taxa ${userMessage.slice(0, 40)}`);
  }
  if (/certid[aã]o|fgts|cndt|regularidade|fiscal/i.test(lower)) {
    queries.push(`certidão negativa regularidade fiscal licitação Lei 14133 ${userMessage.slice(0, 50)}`);
  }
  if (/impugna|recurso|contrarraz|peti[cç][aã]o/i.test(lower)) {
    queries.push(`site:tcu.gov.br recurso impugnação edital ${userMessage.slice(0, 60)}`);
  }

  return queries.slice(0, 4); // Max 4 queries
}

async function searchFirecrawl(query: string, apiKey: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    if (!resp.ok) return [];
    const data = await resp.json();

    return (data.data || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.markdown || r.description || '').slice(0, 1500),
    }));
  } catch {
    return [];
  }
}

async function fetchKnowledgeBase(supabase: any, userId: string, tags: string[]): Promise<string> {
  try {
    const { data } = await supabase
      .from('conhecimento_ia')
      .select('titulo, conteudo, fontes, categoria, confiabilidade')
      .eq('user_id', userId)
      .eq('verificado', true)
      .overlaps('tags', tags)
      .order('confiabilidade', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return '';

    return '\n\nBASE DE CONHECIMENTO VERIFICADA (achados anteriores):\n' +
      data.map((k: any, i: number) =>
        `[Achado ${i + 1}] ${k.titulo} (Confiabilidade: ${k.confiabilidade}/10)\n${k.conteudo}\nFontes: ${JSON.stringify(k.fontes)}`
      ).join('\n\n');
  } catch {
    return '';
  }
}

function extractTagsFromMessage(message: string): string[] {
  const tags: string[] = [];
  const lower = message.toLowerCase();
  if (/licita|edital|pregão|concorr[eê]ncia/i.test(lower)) tags.push('licitacao');
  if (/balan[cç]o|cont[aá]bil|dre|patrim[oô]nio/i.test(lower)) tags.push('contabil');
  if (/jur[ií]dic|lei|artigo|recurso|impugna/i.test(lower)) tags.push('juridico');
  if (/[ií]ndice|ipca|igp|selic|reajuste/i.test(lower)) tags.push('economico');
  if (/certid[aã]o|fiscal|fgts|regularidade/i.test(lower)) tags.push('fiscal');
  if (/contrato|aditivo|repactua/i.test(lower)) tags.push('contrato');
  if (/preco|precifica|cota[cç][aã]o/i.test(lower)) tags.push('precificacao');
  if (tags.length === 0) tags.push('geral');
  return tags;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { messages, context, busca_web = true, salvar_conhecimento = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Mensagens são obrigatórias' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData } = await supabaseAuth.auth.getClaims(token);
      userId = claimsData?.claims?.sub as string || null;
    }

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';
    const tags = extractTagsFromMessage(lastUserMessage);

    // Parallel: web search + knowledge base
    let webContext = '';
    let knowledgeContext = '';
    const searchSources: { title: string; url: string }[] = [];

    const promises: Promise<void>[] = [];

    // Web search via Firecrawl
    if (busca_web && firecrawlKey) {
      const queries = buildSearchQueries(lastUserMessage);
      promises.push(
        (async () => {
          const allResults: { title: string; url: string; snippet: string }[] = [];
          const searchPromises = queries.map(q => searchFirecrawl(q, firecrawlKey));
          const results = await Promise.allSettled(searchPromises);

          for (const r of results) {
            if (r.status === 'fulfilled') allResults.push(...r.value);
          }

          // Dedupe by URL
          const seen = new Set<string>();
          const unique = allResults.filter(r => {
            if (seen.has(r.url)) return false;
            seen.add(r.url);
            return true;
          }).slice(0, 12);

          if (unique.length > 0) {
            searchSources.push(...unique.map(r => ({ title: r.title, url: r.url })));

            // Classify sources
            const oficiais = unique.filter(r =>
              FONTES_OFICIAIS.some(f => r.url.includes(f.url))
            );
            const outras = unique.filter(r =>
              !FONTES_OFICIAIS.some(f => r.url.includes(f.url))
            );

            webContext = '\n\nDADOS EXTRAÍDOS DA INTERNET EM TEMPO REAL (verificação cruzada obrigatória):\n';

            if (oficiais.length > 0) {
              webContext += '\n--- FONTES OFICIAIS (confiabilidade ALTA) ---\n';
              webContext += oficiais.map((r, i) =>
                `[Fonte Oficial ${i + 1}] ${r.title}\nURL: ${r.url}\nConteúdo:\n${r.snippet}`
              ).join('\n\n');
            }

            if (outras.length > 0) {
              webContext += '\n\n--- FONTES SECUNDÁRIAS (verificar antes de citar) ---\n';
              webContext += outras.map((r, i) =>
                `[Fonte Secundária ${i + 1}] ${r.title}\nURL: ${r.url}\nConteúdo:\n${r.snippet}`
              ).join('\n\n');
            }

            webContext += '\n\nINSTRUÇÃO: Confronte as informações entre fontes oficiais e secundárias. Priorize SEMPRE dados de fontes oficiais (.gov.br, .jus.br). Se houver divergência, mencione a divergência e indique qual fonte é mais confiável.';
          }
        })()
      );
    }

    // Knowledge base
    if (userId) {
      const supabaseService = createClient(supabaseUrl, serviceRoleKey);
      promises.push(
        (async () => {
          knowledgeContext = await fetchKnowledgeBase(supabaseService, userId, tags);
        })()
      );
    }

    await Promise.allSettled(promises);

    // Build final messages
    const systemContent = SYSTEM_PROMPT +
      (context ? `\n\nCONTEXTO ADICIONAL:\n${context}` : '') +
      webContext +
      knowledgeContext +
      (searchSources.length > 0
        ? `\n\nFONTES CONSULTADAS NESTA RESPOSTA (cite as relevantes no final da resposta em seção "## Fontes Consultadas"):\n${searchSources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n')}`
        : '');

    const aiMessages = [
      { role: 'system', content: systemContent },
      ...messages,
    ];

    // Stream response
    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: aiMessages,
        stream: true,
        reasoning: { effort: 'high' },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Aguarde alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errorText = await aiResp.text();
      console.error('AI Gateway error:', status, errorText);
      return new Response(JSON.stringify({ error: 'Erro na IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Return stream + sources metadata via custom header
    const headers = {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'X-Sources': JSON.stringify(searchSources.slice(0, 8)),
    };

    return new Response(aiResp.body, { headers });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
