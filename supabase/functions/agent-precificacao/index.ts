import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FontePreco {
  nome: string;
  peso: number;
  precos: number[];
  mediaCalculada: number;
  confiabilidade: number;
}

interface ResultadoPrecificacao {
  precoProposta: number;
  precoLanceInicial: number;
  precoLanceMinimo: number;
  margemBruta: number;
  aprovadoAutomaticamente: boolean;
  motivo: string;
  fontesPonderadas: any[];
  confiancaCalculo: number;
}

function removerOutliers(precos: number[]): number[] {
  if (precos.length < 3) return precos.filter(p => p > 0);
  const sorted = [...precos].filter(p => p > 0).sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return sorted.filter(p => p >= lower && p <= upper);
}

function calcularMedia(precos: number[]): number {
  const valid = precos.filter(p => p > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function arredondar(val: number): number {
  return Math.round(val * 100) / 100;
}

// Fonte 1 — PNCP (Atas de Registro de Preço)
async function consultarPNCP(descricao: string, codigoCatmat: string | null): Promise<number[]> {
  const precos: number[] = [];
  try {
    // Buscar por descrição textual
    const termoBusca = encodeURIComponent(descricao.split(' ').slice(0, 4).join(' '));
    const dataInicial = new Date();
    dataInicial.setFullYear(dataInicial.getFullYear() - 1);
    const dataStr = dataInicial.toISOString().split('T')[0];

    const res = await fetch(
      `https://pncp.gov.br/api/pncp/v1/orgaos/compras?q=${termoBusca}&dataInicial=${dataStr}&tamanhoPagina=30`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) }
    );

    if (res.ok) {
      const data = await res.json();
      for (const registro of data.data ?? data ?? []) {
        const val = registro.valorUnitarioEstimado ?? registro.valorUnitario ?? registro.valorTotalEstimado;
        if (val && val > 0) precos.push(val);
      }
    }
  } catch (e) {
    console.error('PNCP fetch error:', e);
  }
  return removerOutliers(precos);
}

// Fonte 4 — Histórico Próprio de Vitórias
async function consultarHistoricoProprio(supabase: any, descricao: string, codigoCatmat: string | null, empresaId: string): Promise<number[]> {
  const termo = descricao.split(' ')[0];
  const dataLimite = new Date();
  dataLimite.setFullYear(dataLimite.getFullYear() - 2);

  let query = supabase
    .from('agent_historico_precos')
    .select('preco_vencedor, data_registro')
    .eq('empresa_id', empresaId)
    .eq('resultado', 'vencedor')
    .gte('data_registro', dataLimite.toISOString())
    .order('data_registro', { ascending: false })
    .limit(50);

  if (codigoCatmat) {
    query = query.eq('codigo_catmat', codigoCatmat);
  } else {
    query = query.ilike('descricao', `%${termo}%`);
  }

  const { data } = await query;
  if (!data?.length) return [];

  // Aplicar deflator temporal
  return (data ?? []).map((reg: any) => {
    const mesesAtras = Math.floor((Date.now() - new Date(reg.data_registro).getTime()) / (30 * 24 * 60 * 60 * 1000));
    const fatorDeflacao = Math.pow(1.005, mesesAtras);
    return reg.preco_vencedor * fatorDeflacao;
  });
}

// Fonte 5 — Pesquisa de preços de mercado via função existente
async function consultarMercado(supabase: any, descricao: string): Promise<number[]> {
  try {
    const { data } = await supabase.functions.invoke('pesquisa-preco-real', {
      body: { termo: descricao.slice(0, 60), max_fontes: 10 },
    });
    if (data?.resultados) {
      return removerOutliers(
        data.resultados
          .filter((r: any) => r.preco > 0)
          .map((r: any) => r.preco)
      );
    }
  } catch (e) {
    console.error('Pesquisa mercado error:', e);
  }
  return [];
}

// Fonte 6 — Estimativa AURÉLIA (LLM)
async function estimarComAurelia(descricao: string, unidade: string, quantidade: number, valorEstimado: number | null): Promise<number> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) return 0;

  try {
    const prompt = `Você é um especialista em precificação de licitações públicas brasileiras.

ITEM: ${descricao}
UNIDADE: ${unidade}
QUANTIDADE: ${quantidade}
VALOR ESTIMADO NO EDITAL: ${valorEstimado ? `R$ ${valorEstimado.toFixed(2)}` : 'não informado'}

Com base no seu conhecimento do mercado de compras públicas brasileiro,
qual é o preço unitário MÉDIO DE MERCADO razoável para este item?
Considere preços praticados em licitações recentes (2024-2026) e margem típica de 15-25%.

RESPONDA APENAS COM O NÚMERO (ex: 45.90), sem R$, sem texto.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 15,
      }),
    });

    if (aiResp.ok) {
      const data = await aiResp.json();
      const valor = parseFloat(data.choices?.[0]?.message?.content?.trim() ?? '0');
      return isNaN(valor) ? 0 : valor;
    }
  } catch (e) {
    console.error('Aurelia estimation error:', e);
  }
  return 0;
}

function calcularPrecoOtimo(fontes: FontePreco[], valorEstimadoUnitario: number | null, config: any): ResultadoPrecificacao {
  // PASSO 1: Média ponderada por peso e confiabilidade
  let somaPonderada = 0;
  let somaPesos = 0;

  for (const fonte of fontes) {
    if (fonte.mediaCalculada > 0) {
      const pesoEfetivo = fonte.peso * fonte.confiabilidade;
      somaPonderada += fonte.mediaCalculada * pesoEfetivo;
      somaPesos += pesoEfetivo;
    }
  }

  const precoMercado = somaPesos > 0
    ? somaPonderada / somaPesos
    : (valorEstimadoUnitario ?? 0);

  if (precoMercado <= 0) {
    return {
      precoProposta: 0,
      precoLanceInicial: 0,
      precoLanceMinimo: 0,
      margemBruta: 0,
      aprovadoAutomaticamente: false,
      motivo: 'Não foi possível calcular preço de mercado — nenhuma fonte retornou dados',
      fontesPonderadas: fontes.map(f => ({ nome: f.nome, media: f.mediaCalculada, registros: f.precos.length })),
      confiancaCalculo: 0,
    };
  }

  // PASSO 2: Calcular preços estratégicos
  const fatorProposta = config.fator_preco_proposta ?? 0.92;
  const fatorLanceInicial = config.fator_lance_inicial ?? 0.90;
  const margemMinima = config.margem_minima_perc ?? 0.08;
  const margemAlvo = config.margem_alvo_perc ?? 0.15;

  const precoProposta = precoMercado * fatorProposta;
  const precoLanceInicial = precoMercado * fatorLanceInicial;
  const custoEstimado = precoProposta * (1 - margemMinima);
  const precoLanceMinimo = custoEstimado * (1 + margemMinima);

  // PASSO 3: Calcular margem bruta
  const custoUnitario = precoProposta * (1 - margemAlvo);
  const margemBruta = ((precoProposta - custoUnitario) / precoProposta) * 100;

  // PASSO 4: Verificar guardrails
  let aprovado = true;
  let motivo = 'Dentro dos parâmetros configurados — aprovado automaticamente';

  if (config.preco_minimo_absoluto && precoLanceMinimo < config.preco_minimo_absoluto) {
    aprovado = false;
    motivo = `Preço mínimo (R$ ${precoLanceMinimo.toFixed(2)}) abaixo do limite configurado (R$ ${config.preco_minimo_absoluto})`;
  }

  if (valorEstimadoUnitario && precoProposta > valorEstimadoUnitario * 1.10) {
    aprovado = false;
    motivo = `Preço de proposta (R$ ${precoProposta.toFixed(2)}) supera 110% do estimado no edital (R$ ${valorEstimadoUnitario.toFixed(2)})`;
  }

  const margemCalculada = (precoProposta - precoLanceMinimo) / precoProposta;
  if (margemCalculada < margemMinima) {
    aprovado = false;
    motivo = `Margem calculada (${(margemCalculada * 100).toFixed(1)}%) abaixo da margem mínima (${(margemMinima * 100).toFixed(1)}%)`;
  }

  // PASSO 5: Calcular confiança
  const totalRegistros = fontes.reduce((acc, f) => acc + f.precos.length, 0);
  const confianca = Math.min(1, totalRegistros / 10);

  if (confianca < (config.confianca_minima_auto ?? 0.60)) {
    aprovado = false;
    motivo = `Confiança do cálculo (${(confianca * 100).toFixed(0)}%) abaixo do mínimo para aprovação automática`;
  }

  return {
    precoProposta: arredondar(precoProposta),
    precoLanceInicial: arredondar(precoLanceInicial),
    precoLanceMinimo: arredondar(precoLanceMinimo),
    margemBruta: parseFloat(margemBruta.toFixed(2)),
    aprovadoAutomaticamente: aprovado,
    motivo,
    fontesPonderadas: fontes.map(f => ({
      nome: f.nome,
      media: arredondar(f.mediaCalculada),
      registros: f.precos.length,
      peso_efetivo: parseFloat((f.peso * f.confiabilidade).toFixed(3)),
    })),
    confiancaCalculo: confianca,
  };
}

// Seleção de marca e modelo via IA
async function selecionarMarcaModelo(supabase: any, item: any, precoOtimo: number): Promise<{ marca: string; modelo: string; justificativa: string }> {
  // CASO 1: Edital especifica marca única
  if (item.marca_referencia && !item.permite_equivalente) {
    return {
      marca: item.marca_referencia,
      modelo: 'Conforme especificação do edital',
      justificativa: 'Marca especificada no edital como única aceita',
    };
  }

  // CASO 2: Buscar do histórico
  const { data: historico } = await supabase
    .from('agent_historico_precos')
    .select('marca, modelo, preco_vencedor')
    .ilike('descricao', `%${item.descricao.split(' ')[0]}%`)
    .eq('resultado', 'vencedor')
    .order('data_registro', { ascending: false })
    .limit(10);

  if (historico?.length >= 3) {
    const contagemMarcas: Record<string, number> = {};
    for (const h of historico) {
      if (h.marca) contagemMarcas[h.marca] = (contagemMarcas[h.marca] ?? 0) + 1;
    }
    const entries = Object.entries(contagemMarcas);
    if (entries.length > 0) {
      const marcaMaisVencedora = entries.sort(([, a], [, b]) => b - a)[0][0];
      const modeloAssociado = historico.find((h: any) => h.marca === marcaMaisVencedora)?.modelo ?? 'Similar';
      return {
        marca: marcaMaisVencedora,
        modelo: modeloAssociado,
        justificativa: `Marca com maior taxa de vitória no histórico (${contagemMarcas[marcaMaisVencedora]} vitórias)`,
      };
    }
  }

  // CASO 3: AURÉLIA sugere
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (lovableKey) {
    try {
      const prompt = `Você é especialista em compras públicas. Sugira a MELHOR MARCA e MODELO para:
ITEM: ${item.descricao}
PREÇO ALVO: R$ ${precoOtimo.toFixed(2)}
MARCA REFERÊNCIA: ${item.marca_referencia ?? 'não especificada'}
Responda em JSON: {"marca":"...","modelo":"...","justificativa":"..."}
RESPONDA APENAS COM O JSON VÁLIDO.`;

      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], max_tokens: 200 }),
      });

      if (aiResp.ok) {
        const data = await aiResp.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      }
    } catch { /* fallback below */ }
  }

  return {
    marca: item.marca_referencia ?? 'A definir',
    modelo: 'Conforme especificações do edital',
    justificativa: 'Marca será definida conforme disponibilidade',
  };
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

    const { item_id, empresa_id } = await req.json();

    if (!item_id || !empresa_id) {
      return new Response(JSON.stringify({ error: 'item_id e empresa_id obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar dados do item
    const { data: item } = await supabase
      .from('agent_itens_edital')
      .select('*')
      .eq('id', item_id)
      .single();

    if (!item) {
      return new Response(JSON.stringify({ error: 'Item não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar configurações de margem da empresa
    const { data: config } = await supabase
      .from('agent_configuracoes')
      .select('*')
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    const configEfetivo = config || {};

    // ═══ CONSULTAR FONTES EM PARALELO ═══
    const [precosPNCP, precosHistorico, precosMercado, precosAurelia] = await Promise.allSettled([
      consultarPNCP(item.descricao, item.codigo_catmat),
      consultarHistoricoProprio(supabase, item.descricao, item.codigo_catmat, empresa_id),
      consultarMercado(supabase, item.descricao),
      estimarComAurelia(item.descricao, item.unidade || 'UN', item.quantidade || 1, item.valor_estimado_unitario),
    ]);

    // ═══ CONSOLIDAR RESULTADOS ═══
    const fontes: FontePreco[] = [];

    if (precosPNCP.status === 'fulfilled' && precosPNCP.value.length > 0) {
      fontes.push({
        nome: 'PNCP_ATAS',
        peso: 0.35,
        precos: precosPNCP.value,
        mediaCalculada: calcularMedia(precosPNCP.value),
        confiabilidade: 0.95,
      });
    }

    if (precosHistorico.status === 'fulfilled' && precosHistorico.value.length > 0) {
      fontes.push({
        nome: 'HISTORICO_PROPRIO',
        peso: 0.25,
        precos: precosHistorico.value,
        mediaCalculada: calcularMedia(precosHistorico.value),
        confiabilidade: 1.00,
      });
    }

    if (precosMercado.status === 'fulfilled' && precosMercado.value.length > 0) {
      fontes.push({
        nome: 'MERCADO_B2B',
        peso: 0.30,
        precos: precosMercado.value,
        mediaCalculada: calcularMedia(precosMercado.value),
        confiabilidade: 0.80,
      });
    }

    if (precosAurelia.status === 'fulfilled' && precosAurelia.value > 0) {
      fontes.push({
        nome: 'AURELIA_ESTIMATIVA',
        peso: 0.10,
        precos: [precosAurelia.value],
        mediaCalculada: precosAurelia.value,
        confiabilidade: 0.60,
      });
    }

    // ═══ CALCULAR PREÇO ÓTIMO ═══
    const resultado = calcularPrecoOtimo(fontes, item.valor_estimado_unitario, configEfetivo);

    // ═══ SELECIONAR MARCA E MODELO ═══
    const marcaModelo = await selecionarMarcaModelo(supabase, item, resultado.precoProposta);

    // ═══ SALVAR RESULTADO ═══
    await supabase
      .from('agent_itens_edital')
      .update({
        preco_referencia: fontes.length > 0 ? arredondar(fontes.reduce((s, f) => s + f.mediaCalculada, 0) / fontes.length) : null,
        preco_proposta: resultado.precoProposta,
        preco_lance_inicial: resultado.precoLanceInicial,
        preco_lance_minimo: resultado.precoLanceMinimo,
        margem_bruta_perc: resultado.margemBruta,
        marca_selecionada: marcaModelo.marca,
        modelo_selecionado: marcaModelo.modelo,
        justificativa_marca: marcaModelo.justificativa,
        fontes_consultadas: resultado.fontesPonderadas,
        confianca_calculo: resultado.confiancaCalculo,
        status: resultado.aprovadoAutomaticamente ? 'aprovado_automaticamente' : 'aguardando_aprovacao_preco',
        motivo_status: resultado.motivo,
      })
      .eq('id', item_id);

    // Log
    await supabase.from('agent_acoes_log').insert({
      licitacao_id: item.licitacao_id,
      agente: 'agent_precificacao',
      acao: 'precificacao_item',
      status: resultado.aprovadoAutomaticamente ? 'sucesso' : 'pendente',
      payload_out: {
        item_id,
        preco_proposta: resultado.precoProposta,
        fontes: resultado.fontesPonderadas.length,
        confianca: resultado.confiancaCalculo,
        aprovado_auto: resultado.aprovadoAutomaticamente,
      },
      duracao_ms: Date.now() - inicio,
    });

    return new Response(JSON.stringify({
      ok: true,
      resultado,
      marca: marcaModelo,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Precificacao error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
