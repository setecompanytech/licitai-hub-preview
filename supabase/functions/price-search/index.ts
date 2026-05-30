import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceResult {
  fonte: string;
  titulo: string;
  preco_unitario: number;
  vendedor: string;
  condicao: string;
  url: string;
  data_contrato?: string;
  orgao?: string;
  uf_orgao?: string;
  ean?: string;
  coletado_em: string;
}

function gerarChaveCache(descricao: string, codigoCatmat?: string): string {
  const base = `${descricao.toLowerCase().trim()}|${codigoCatmat || ''}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `ps_${Math.abs(hash).toString(36)}`;
}

function dataHaMeses(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d.toISOString().split('T')[0];
}

// --- COLETORES ---

async function coletorPNCP(termos: string[], codigoCatmat?: string): Promise<PriceResult[]> {
  const resultados: PriceResult[] = [];

  if (codigoCatmat) {
    try {
      const res = await fetch(
        `https://pncp.gov.br/api/pncp/v1/itensContrato?codigoItem=${codigoCatmat}&dataInicial=${dataHaMeses(12)}&tamanhoPagina=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.data ?? []).slice(0, 30)) {
          if (item.valorUnitario > 0) {
            resultados.push({
              fonte: 'pncp_ata', titulo: item.descricaoItem ?? termos[0],
              preco_unitario: item.valorUnitario, vendedor: item.nomeRazaoSocialFornecedor ?? '',
              condicao: 'Licitação Pública', url: `https://pncp.gov.br/app/contratos/${item.numeroCnpjContratante}`,
              data_contrato: item.dataAssinatura, orgao: item.nomeUnidadeOrgao, uf_orgao: item.ufUnidade,
              coletado_em: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) { console.error('PNCP CATMAT error:', e); }
  }

  for (const termo of termos.slice(0, 1)) {
    try {
      const res = await fetch(
        `https://pncp.gov.br/api/pncp/v1/contratacoes/itens?q=${encodeURIComponent(termo)}&dataInicial=${dataHaMeses(12)}&tamanhoPagina=30`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.data ?? []).slice(0, 20)) {
          if (item.valorUnitario > 0) {
            resultados.push({
              fonte: 'pncp_contratacao', titulo: item.descricaoItem ?? termo,
              preco_unitario: item.valorUnitario, vendedor: item.nomeRazaoSocialFornecedor ?? 'Órgão Público',
              condicao: 'Licitação Pública', url: `https://pncp.gov.br/app/contratacoes`,
              orgao: item.nomeUnidadeOrgao, uf_orgao: item.ufUnidade, coletado_em: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) { console.error('PNCP text error:', e); }
  }

  return resultados;
}

async function coletorMercadoLivre(termos: string[]): Promise<PriceResult[]> {
  const resultados: PriceResult[] = [];

  for (const termo of termos.slice(0, 3)) {
    try {
      const res = await fetch(
        `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&limit=15&condition=new&sort=relevance`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;

      const data = await res.json();
      for (const item of (data.results ?? []).slice(0, 10)) {
        if (item.price > 0) {
          const marca = item.attributes?.find((a: any) => a.id === 'BRAND')?.value_name || '';
          resultados.push({
            fonte: 'mercadolivre', titulo: item.title,
            preco_unitario: item.price, vendedor: item.seller?.nickname || 'Mercado Livre',
            condicao: item.condition === 'new' ? 'Novo' : 'Usado', url: item.permalink,
            ean: marca ? `Marca: ${marca}` : undefined, coletado_em: new Date().toISOString(),
          });
        }
      }
      if (resultados.length > 0) break; // Got results, stop trying more terms
    } catch (e) { console.error('ML API error:', e); }
  }

  return resultados;
}

async function coletorKabum(termos: string[]): Promise<PriceResult[]> {
  const resultados: PriceResult[] = [];
  for (const termo of termos.slice(0, 2)) {
    try {
      const res = await fetch(
        `https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products?page_number=1&page_size=10&sort=most_searched&include_unavailable=false&q=${encodeURIComponent(termo)}`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const produto of (data.data ?? []).slice(0, 10)) {
        if (produto.vlr_final > 0) {
          resultados.push({
            fonte: 'kabum', titulo: produto.ds_name,
            preco_unitario: produto.vlr_final, vendedor: 'KaBuM!', condicao: 'Novo',
            url: `https://www.kabum.com.br/produto/${produto.cd_product}`,
            ean: produto.cd_ean, coletado_em: new Date().toISOString(),
          });
        }
      }
    } catch (e) { console.error('KaBuM error:', e); }
  }
  return resultados;
}

async function coletorLeroyMerlin(termos: string[]): Promise<PriceResult[]> {
  const resultados: PriceResult[] = [];
  for (const termo of termos.slice(0, 2)) {
    try {
      const res = await fetch('https://www.leroymerlin.com.br/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query SearchProducts($query: String!, $from: Int!, $to: Int!) { productSearch(query: $query, from: $from, to: $to) { products { productName priceRange { sellingPrice { lowPrice } } linkText } } }`,
          variables: { query: termo, from: 0, to: 10 },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const produto of (data.data?.productSearch?.products ?? [])) {
        const preco = produto.priceRange?.sellingPrice?.lowPrice ?? 0;
        if (preco > 0) {
          resultados.push({
            fonte: 'leroy_merlin', titulo: produto.productName,
            preco_unitario: preco, vendedor: 'Leroy Merlin', condicao: 'Novo',
            url: `https://www.leroymerlin.com.br/${produto.linkText}/p`,
            coletado_em: new Date().toISOString(),
          });
        }
      }
    } catch (e) { console.error('Leroy error:', e); }
  }
  return resultados;
}

// Coletor via IA com conhecimento de preços de mercado (fallback inteligente)
async function coletorIA(descricao: string, unidade?: string): Promise<PriceResult[]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return [];

  try {
    const prompt = `Você é um especialista em preços de mercado brasileiro. 
Preciso do preço UNITÁRIO atual de mercado para este item:

"${descricao.slice(0, 300)}"
Unidade: ${unidade || 'UN'}

Pesquise mentalmente em lojas como Mercado Livre, Kalunga, Amazon, Magazine Luiza, Americanas e forneça uma estimativa realista.

Responda APENAS com JSON:
{
  "produtos": [
    {
      "titulo": "nome comercial do produto encontrado",
      "marca": "marca do produto",
      "preco": 99.90,
      "loja": "nome da loja",
      "confianca": "alta|media|baixa"
    }
  ]
}

Se não souber o preço com confiança razoável, retorne {"produtos": []}.
Forneça de 1 a 3 opções de produtos compatíveis.`;

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });

    if (!aiResp.ok) return [];

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const resultados: PriceResult[] = [];

    for (const p of (parsed.produtos || [])) {
      if (p.preco > 0) {
        resultados.push({
          fonte: 'ia_estimativa',
          titulo: p.titulo || descricao.slice(0, 100),
          preco_unitario: p.preco,
          vendedor: p.loja || 'Estimativa IA',
          condicao: `${p.confianca || 'media'} confiança`,
          url: '',
          ean: p.marca ? `Marca: ${p.marca}` : undefined,
          coletado_em: new Date().toISOString(),
        });
      }
    }

    return resultados;
  } catch (e) {
    console.error('AI price estimator error:', e);
    return [];
  }
}

async function coletorPesquisaReal(supabase: any, termos: string[]): Promise<PriceResult[]> {
  const resultados: PriceResult[] = [];
  try {
    const { data } = await supabase.functions.invoke('pesquisa-preco-real', {
      body: { termos: termos.slice(0, 3) },
    });
    if (data?.resultados) {
      for (const r of data.resultados) {
        resultados.push({
          fonte: r.fonte || 'marketplace', titulo: r.titulo || r.nome || '',
          preco_unitario: r.preco || r.preco_unitario || 0, vendedor: r.vendedor || r.loja || 'Marketplace',
          condicao: 'Novo', url: r.url || r.link || '', coletado_em: new Date().toISOString(),
        });
      }
    }
  } catch (e) { console.error('Pesquisa real error:', e); }
  return resultados;
}

function calcularEstatisticas(precos: number[]) {
  if (precos.length === 0) {
    return {
      minimo: 0, maximo: 0, media: 0, mediana: 0,
      desvio_padrao: 0, coeficiente_variacao: 0,
      percentil_25: 0, percentil_75: 0,
      preco_sugerido: 0, total_registros: 0,
      confiabilidade: 'insuficiente' as const,
    };
  }

  const ordenados = [...precos].sort((a, b) => a - b);
  const n = ordenados.length;
  const media = precos.reduce((a, b) => a + b, 0) / n;
  const mediana = n % 2 === 0 ? (ordenados[n / 2 - 1] + ordenados[n / 2]) / 2 : ordenados[Math.floor(n / 2)];
  const variancia = precos.reduce((acc, p) => acc + Math.pow(p - media, 2), 0) / n;
  const desvioPadrao = Math.sqrt(variancia);
  const cv = media > 0 ? (desvioPadrao / media) * 100 : 0;

  const q1 = ordenados[Math.floor(n * 0.25)];
  const q3 = ordenados[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const semOutliers = precos.filter(p => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
  const precoSugerido = semOutliers.length > 0
    ? semOutliers.reduce((a, b) => a + b, 0) / semOutliers.length : mediana;

  return {
    minimo: Math.min(...precos), maximo: Math.max(...precos),
    media: parseFloat(media.toFixed(4)), mediana: parseFloat(mediana.toFixed(4)),
    desvio_padrao: parseFloat(desvioPadrao.toFixed(4)),
    coeficiente_variacao: parseFloat(cv.toFixed(2)),
    percentil_25: q1, percentil_75: q3,
    preco_sugerido: parseFloat(precoSugerido.toFixed(4)),
    total_registros: n,
    confiabilidade: n >= 10 ? 'alta' : n >= 5 ? 'media' : n >= 1 ? 'baixa' : 'insuficiente',
  };
}

function contarFontes(resultados: PriceResult[]): Record<string, number> {
  return resultados.reduce((acc, r) => {
    acc[r.fonte] = (acc[r.fonte] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const inicio = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { descricao, codigoCatmat, especificacoes, empresaId, itemEditalId, modo = 'manual', unidade, quantidade } = await req.json();

    if (!descricao) {
      return new Response(JSON.stringify({ error: 'descricao obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PASSO 1: Verificar cache (6 horas)
    const cacheKey = gerarChaveCache(descricao, codigoCatmat);
    const { data: cacheHit } = await supabase
      .from('price_search_cache')
      .select('resultados, estatisticas, coletado_em')
      .eq('cache_key', cacheKey)
      .gt('expira_em', new Date().toISOString())
      .single();

    if (cacheHit) {
      await supabase.from('price_search_cache')
        .update({ acessos: (cacheHit as any).acessos + 1 })
        .eq('cache_key', cacheKey);
      return new Response(JSON.stringify({
        ...cacheHit, cache: true, fonte_cache: 'database', duracao_ms: Date.now() - inicio,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PASSO 2: Normalizar query
    let queryNorm: any;
    try {
      const { data } = await supabase.functions.invoke('price-search-normalizer', {
        body: { descricao, codigoCatmat, especificacoes, unidade, quantidade },
      });
      queryNorm = data;
    } catch {
      const words = descricao.split(/\s+/).filter((t: string) => t.length > 2);
      queryNorm = {
        categoria: 'geral',
        termos_gerais: [words.slice(0, 5).join(' ')],
        termos_tecnicos: [],
        termos_marketplace: [words.slice(0, 3).join(' ')],
      };
    }

    const termosGerais = [...(queryNorm.termos_gerais || []), ...(queryNorm.termos_tecnicos || [])].slice(0, 4);
    const termosMarketplace = (queryNorm.termos_marketplace || termosGerais.map((t: string) => t.split(' ').slice(0, 3).join(' '))).slice(0, 3);

    console.log('Termos gerais:', termosGerais);
    console.log('Termos marketplace:', termosMarketplace);

    // PASSO 3: Despachar coletores em paralelo
    const categoria = queryNorm.categoria || 'geral';
    const coletoresPromises: Promise<PriceResult[]>[] = [
      coletorPNCP(termosGerais, codigoCatmat),
      coletorMercadoLivre(termosMarketplace), // Usar termos curtos para ML
    ];

    if (['ti', 'geral', 'escritorio'].includes(categoria)) {
      coletoresPromises.push(coletorKabum(termosMarketplace));
    }
    if (['construcao'].includes(categoria)) {
      coletoresPromises.push(coletorLeroyMerlin(termosMarketplace));
    }

    coletoresPromises.push(coletorPesquisaReal(supabase, termosGerais));

    const resultadosSettled = await Promise.allSettled(coletoresPromises);

    let todosResultados: PriceResult[] = resultadosSettled
      .filter((r): r is PromiseFulfilledResult<PriceResult[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(r => r.preco_unitario > 0);

    // PASSO 3.5: Se nenhum resultado real, usar estimativa IA como fallback
    if (todosResultados.length === 0) {
      console.log('Nenhum resultado de APIs, usando fallback IA...');
      const iaResults = await coletorIA(descricao, queryNorm.unidade_padrao);
      todosResultados = iaResults.filter(r => r.preco_unitario > 0);
    }

    // Deduplicar por título similar
    const seen = new Set<string>();
    todosResultados = todosResultados.filter(r => {
      const key = `${r.fonte}|${r.titulo.toLowerCase().slice(0, 40)}|${r.preco_unitario}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // PASSO 4: Calcular estatísticas
    const precos = todosResultados.map(r => r.preco_unitario);
    const estatisticas = calcularEstatisticas(precos);

    // PASSO 5: Salvar no cache e histórico
    const agora = new Date();
    const expira = new Date(agora.getTime() + 6 * 60 * 60 * 1000);

    await supabase.from('price_search_cache').upsert({
      cache_key: cacheKey, descricao, codigo_catmat: codigoCatmat || null,
      resultados: todosResultados, estatisticas,
      coletado_em: agora.toISOString(), expira_em: expira.toISOString(),
    }, { onConflict: 'cache_key' });

    await supabase.from('price_historico').insert({
      descricao, codigo_catmat: codigoCatmat || null,
      item_edital_id: itemEditalId || null,
      preco_minimo: estatisticas.minimo, preco_maximo: estatisticas.maximo,
      preco_medio: estatisticas.media, preco_mediana: estatisticas.mediana,
      preco_sugerido: estatisticas.preco_sugerido,
      total_registros: estatisticas.total_registros,
      fontes: [...new Set(todosResultados.map(r => r.fonte))],
      data_coleta: agora.toISOString(),
    });

    if (itemEditalId && estatisticas.mediana > 0) {
      await supabase.from('agent_itens_edital').update({
        preco_referencia_ecommerce: estatisticas.mediana,
        fontes_ecommerce_count: todosResultados.length,
      }).eq('id', itemEditalId);
    }

    return new Response(JSON.stringify({
      resultados: todosResultados, estatisticas, query_normalizada: queryNorm,
      cache: false, total_fontes: contarFontes(todosResultados),
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Price search error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
