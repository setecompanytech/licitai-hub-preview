// Apoio Jurídico — redação com Claude e ferramentas sobre os dados do sistema (27/09/2026).
//
// Substitui, para o gerador de peças, a `ai-chat` (GPT-4o, texto solto). Aqui a
// IA tem ferramentas para LER o caso (contrato, termos, itens), a série oficial
// do SGS, a base jurídica da empresa e a lista de normas conferidas — e é
// obrigada a marcar cada afirmação com a origem ([[norma:…]] / [[fonte:…]]).
// O que não vem de fonte sai como "a confirmar", nunca como certo.
//
// A resposta é SSE no mesmo formato da `ai-chat` (choices[0].delta.content e
// tool_event), então o front usa o mesmo leitor.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { NORMAS_CONFERIDAS } from '../_shared/normas-conferidas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODELO = Deno.env.get('JURIDICO_MODEL') || 'claude-sonnet-5';
const MODELO_RESERVA = 'claude-haiku-4-5-20251001';
const MAX_RODADAS = 5;

const SERIES_SGS: Record<string, { serie: number; fonte: string }> = {
  'IPCA': { serie: 433, fonte: 'IBGE · BCB/SGS 433' },
  'INPC': { serie: 188, fonte: 'IBGE · BCB/SGS 188' },
  'IGP-M': { serie: 189, fonte: 'FGV · BCB/SGS 189' },
  'IGP-DI': { serie: 190, fonte: 'FGV · BCB/SGS 190' },
  'INCC-DI': { serie: 192, fonte: 'FGV · BCB/SGS 192' },
};

const SISTEMA = `Você redige peças no registro técnico-jurídico do Direito Administrativo brasileiro, como advogado sênior com mais de quinze anos em contratações públicas (Lei 14.133/2021). Texto preciso, impessoal, sem coloquialismo, estruturado em seções numeradas (I, II, III…) com endereçamento, qualificação, fatos, fundamentos, pedidos e fecho, no padrão ABNT que o sistema formata depois.

VOCÊ TEM FERRAMENTAS. Use-as ANTES de afirmar qualquer fato do caso:
- consultar_contrato: o contrato, os termos aditivos e os itens como estão no sistema.
- serie_oficial: a variação exata de um índice (IPCA, INPC, IGP-M, IGP-DI, INCC-DI) entre duas datas, pela série do Banco Central.
- buscar_base_juridica: documentos, acórdãos e pareceres que a empresa guardou na Base Jurídica.
- normas_conferidas: a lista de dispositivos legais conferidos contra o texto oficial, com a síntese de cada um.
- texto_da_norma: o artigo INTEIRO e literal de uma lei acompanhada (Lei 14.133/2021, 10.192/2001, LC 123/2006, 8.906/1994, 12.016/2009, 4.320/1964, Decreto 11.462/2023), lido do Planalto pela base normativa. Prefira-o a citar de memória.

REGRA DE OURO — NOTAS DE ORIGEM. Toda afirmação de fato ou de direito leva um marcador ao fim da frase:
- [[norma:Lei 14.133/2021, art. 136, I]] para dispositivo legal, súmula ou acórdão. Cite SOMENTE dispositivos que estejam em normas_conferidas, que texto_da_norma tenha devolvido, ou que buscar_base_juridica / documento anexado traga literalmente (acórdão do TCU só com número, ano e colegiado vindos da base). Fora disso, escreva "(a confirmar)" e o marcador mesmo assim — o sistema o mostrará como não conferido.
- [[fonte:sistema]] para dado lido pelas ferramentas ou pelos "dados do caso lidos do sistema".
- [[fonte:anexo|nome do documento, página ou cláusula]] para fato tirado de documento anexado.
- [[fonte:base|id|título]] para documento da Base Jurídica.
É PROIBIDO inventar número de artigo, de acórdão, de processo, valor, data ou cláusula. Sem fonte, a frase diz que o dado falta e pede o documento.

Distinções que não se confundem: reajustamento em sentido estrito (índice; art. 92, § 3º e § 4º, I; apostila do art. 136, I) ≠ repactuação (mão de obra; art. 92, § 4º, II; art. 135) ≠ reequilíbrio por álea extraordinária (art. 124, II, "d"). O interregno anual é da Lei 10.192/2001 (art. 2º, § 1º; art. 3º, § 1º). Nunca cite a Lei 8.666/1993 como norma vigente para contratos regidos pela 14.133, salvo se o contrato disser o contrário.

Peça judicial é MINUTA para advogado inscrito na OAB: deixe campos de advogado, OAB e juízo em branco e não afirme protocolo.`;

const TOOLS = [
  {
    name: 'consultar_contrato',
    description: 'Lê no sistema o contrato (partes, objeto, valores, vigência, cláusula e data-base de reajuste), os termos aditivos e um resumo dos itens.',
    input_schema: { type: 'object', properties: { contrato_id: { type: 'string', description: 'UUID do contrato' } }, required: ['contrato_id'] },
  },
  {
    name: 'serie_oficial',
    description: 'Variação exata de IPCA, INPC, IGP-M, IGP-DI ou INCC-DI entre duas datas (mês seguinte à data-base até o mês da data-alvo), pela série do SGS/Banco Central.',
    input_schema: {
      type: 'object',
      properties: {
        indice: { type: 'string', description: 'IPCA, INPC, IGP-M, IGP-DI ou INCC-DI' },
        data_base: { type: 'string', description: 'AAAA-MM-DD' },
        data_alvo: { type: 'string', description: 'AAAA-MM-DD, depois da data-base' },
      },
      required: ['indice', 'data_base', 'data_alvo'],
    },
  },
  {
    name: 'buscar_base_juridica',
    description: 'Busca na Base Jurídica da empresa (documentos que ela guardou) e na jurisprudência coletada, por termo no título ou na ementa.',
    input_schema: { type: 'object', properties: { termo: { type: 'string' } }, required: ['termo'] },
  },
  {
    name: 'texto_da_norma',
    description: 'Texto literal e vigente de um artigo de lei acompanhada, lido do Planalto pela base normativa. Ex.: identificador "Lei 14.133/2021", dispositivo "art. 92".',
    input_schema: {
      type: 'object',
      properties: { identificador: { type: 'string', description: 'Diploma: "Lei 14.133/2021", "Lei 10.192/2001", "LC 123/2006"…' }, dispositivo: { type: 'string', description: '"art. 92" (sem parágrafo: o artigo inteiro vem com seus parágrafos e incisos)' } },
      required: ['identificador', 'dispositivo'],
    },
  },
  {
    name: 'normas_conferidas',
    description: 'Lista os dispositivos legais conferidos contra o texto oficial, com síntese. Só estes podem ser citados como certos.',
    input_schema: { type: 'object', properties: {} },
  },
];

type Db = ReturnType<typeof createClient>;

async function executarTool(nome: string, args: Record<string, unknown>, db: Db): Promise<unknown> {
  if (nome === 'normas_conferidas') {
    return NORMAS_CONFERIDAS.map((n) => ({ diploma: n.diploma, dispositivo: n.dispositivo, sintese: n.texto, literal: n.literal }));
  }
  if (nome === 'consultar_contrato') {
    const id = String(args.contrato_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { erro: 'contrato_id inválido' };
    const [c, a, i] = await Promise.all([
      db.from('contratos').select('numero_contrato, orgao_contratante, objeto, modalidade, tipo_documento, status, data_assinatura, data_inicio, data_fim, valor_global, valor_global_original, saldo_remanescente, valor_consumido, indice_reajuste, data_base_reajuste, reajuste_clausula, fiscal_nome, prazo_pagamento_dias, prazo_entrega_dias').eq('id', id).maybeSingle(),
      db.from('contrato_aditivos').select('numero_aditivo, tipo, data_assinatura, data_base_reajuste, valor_aditivo, nova_data_fim, fundamento_legal').eq('contrato_id', id).order('data_assinatura'),
      db.from('contrato_itens').select('codigo_item, descricao, unidade, quantidade_contratada, valor_unitario, valor_total, saldo_quantitativo').eq('contrato_id', id).limit(60),
    ]);
    if (c.error) return { erro: c.error.message };
    if (!c.data) return { erro: 'contrato não encontrado ou sem acesso' };
    return { contrato: c.data, aditivos: a.data ?? [], itens: i.data ?? [], total_itens: (i.data ?? []).length };
  }
  if (nome === 'serie_oficial') {
    const sigla = String(args.indice ?? '').trim().toUpperCase();
    const info = SERIES_SGS[sigla];
    if (!info) return { erro: `Índice ${sigla} sem série no SGS. Disponíveis: ${Object.keys(SERIES_SGS).join(', ')}.` };
    const dataBase = String(args.data_base ?? '').slice(0, 10);
    const dataAlvo = String(args.data_alvo ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBase) || !/^\d{4}-\d{2}-\d{2}$/.test(dataAlvo) || dataAlvo <= dataBase) return { erro: 'datas inválidas' };
    const [ab, mb] = dataBase.split('-').map(Number);
    const [aa, ma] = dataAlvo.split('-').map(Number);
    const iniAno = mb === 12 ? ab + 1 : ab;
    const iniMes = mb === 12 ? 1 : mb + 1;
    const p2 = (n: number) => String(n).padStart(2, '0');
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${info.serie}/dados?formato=json&dataInicial=01/${p2(iniMes)}/${iniAno}&dataFinal=28/${p2(ma)}/${aa}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { erro: `SGS indisponível (HTTP ${res.status})` };
    const serie = await res.json() as Array<{ data: string; valor: string }>;
    let fator = 1;
    const meses: Array<{ competencia: string; variacao: number }> = [];
    for (const l of serie) {
      const v = parseFloat(String(l.valor).replace(',', '.'));
      if (!Number.isFinite(v)) continue;
      fator *= 1 + v / 100;
      meses.push({ competencia: l.data.slice(3), variacao: v });
    }
    const esperados = (aa - iniAno) * 12 + (ma - iniMes) + 1;
    return { indice: sigla, fonte: info.fonte, data_base: dataBase, data_alvo: dataAlvo, meses, meses_esperados: esperados, completo: meses.length >= esperados, fator, percentual: (fator - 1) * 100 };
  }
  if (nome === 'texto_da_norma') {
    const { data, error } = await db.rpc('texto_da_norma', { p_identificador: String(args.identificador ?? ''), p_dispositivo: String(args.dispositivo ?? '') });
    if (error) return { erro: error.message };
    const linhas = (data ?? []) as Array<{ identificador: string; dispositivo: string | null; texto: string; url: string | null; atualizado_em: string }>;
    if (linhas.length === 0) return { erro: 'Dispositivo não está na base normativa: não o cite como certo. Verifique o número ou use normas_conferidas.' };
    return { normas: linhas.map((l) => ({ ...l, texto: l.texto.slice(0, 12000) })) };
  }
  if (nome === 'buscar_base_juridica') {
    const termo = String(args.termo ?? '').trim().slice(0, 80);
    if (!termo) return { erro: 'termo vazio' };
    const like = `%${termo.replace(/[%_,]/g, ' ')}%`;
    const [b, j, n] = await Promise.all([
      db.from('base_juridica').select('id, titulo, tipo, tribunal, numero_processo, data_documento, ementa').or(`titulo.ilike.${like},ementa.ilike.${like}`).limit(8),
      db.from('agent_jurisprudencia').select('id, fonte, numero, ementa, data_pub').or(`numero.ilike.${like},ementa.ilike.${like}`).limit(8),
      db.rpc('buscar_base_normativa', { p_termo: termo, p_limite: 8 }),
    ]);
    const normativa = (n.error ? [] : (n.data ?? [])) as Array<Record<string, unknown>>;
    const total = (b.data ?? []).length + (j.data ?? []).length + normativa.length;
    return {
      base_juridica: (b.data ?? []).map((d) => ({ ...d, ementa: String(d.ementa ?? '').slice(0, 1200) })),
      jurisprudencia_coletada: (j.data ?? []).map((d) => ({ ...d, ementa: String(d.ementa ?? '').slice(0, 1200) })),
      base_normativa: normativa.map((d) => ({ id: d.id, fonte: d.fonte, identificador: d.identificador, dispositivo: d.dispositivo, titulo: d.titulo, ementa: d.ementa, trecho: d.trecho, url: d.url, data_publicacao: d.data_publicacao })),
      aviso: total === 0 ? 'Nada na base para este termo: não cite acórdão nem ato que não esteja aqui.' : undefined,
    };
  }
  return { erro: `ferramenta desconhecida: ${nome}` };
}

const sse = (controller: ReadableStreamDefaultController, obj: unknown) =>
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`));

async function chamarAnthropic(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const tentar = (model: string) => fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, model }),
  });
  let r = await tentar(MODELO);
  if (r.status === 404 || r.status === 400) {
    // Modelo indisponível para esta chave: cai no reserva em vez de falhar calado.
    const texto = await r.clone().text();
    if (/model|not_found/i.test(texto)) r = await tentar(MODELO_RESERVA);
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const auth = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // As ferramentas leem com o JWT da pessoa: o RLS decide o que ela vê.
    const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });

    const { messages, context, modelo, contratoId } = await req.json();
    const cabecalho = [
      modelo ? `Peça: ${modelo.titulo} (${modelo.categoria}). Fundamento de referência: ${modelo.fundamentacao}.` : '',
      contratoId ? `Contrato do caso no sistema: ${contratoId} — chame consultar_contrato antes de escrever.` : '',
      context ? `Contexto reunido pela tela:\n${String(context).slice(0, 150000)}` : '',
    ].filter(Boolean).join('\n\n');
    const conversa: Array<Record<string, unknown>> = [
      ...(cabecalho ? [{ role: 'user', content: cabecalho }, { role: 'assistant', content: 'Entendido. Vou ler o caso pelas ferramentas antes de redigir e marcar a origem de cada afirmação.' }] : []),
      ...((messages ?? []) as Array<{ role: string; content: string }>).map((m) => ({ role: m.role, content: String(m.content).slice(0, 100000) })),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
            const r = await chamarAnthropic(apiKey, { max_tokens: 8000, system: SISTEMA, messages: conversa, tools: TOOLS, temperature: 0.2 });
            if (!r.ok) {
              const t = await r.text();
              sse(controller, { choices: [{ delta: { content: `\n\n[Falha na IA (${r.status}): ${t.slice(0, 300)}]` } }] });
              break;
            }
            const resposta = await r.json();
            const blocos = (resposta.content ?? []) as Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
            const usos = blocos.filter((b) => b.type === 'tool_use');
            if (resposta.stop_reason !== 'tool_use' || usos.length === 0) {
              // Resposta final: o texto sai em fatias para a tela "escrever".
              const texto = blocos.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
              for (let i = 0; i < texto.length; i += 400) sse(controller, { choices: [{ delta: { content: texto.slice(i, i + 400) } }] });
              break;
            }
            conversa.push({ role: 'assistant', content: blocos });
            const resultados: Array<Record<string, unknown>> = [];
            for (const u of usos) {
              sse(controller, { tool_event: { type: 'running', name: u.name, id: u.id, args: u.input } });
              const resultado = await executarTool(u.name ?? '', u.input ?? {}, db);
              const erro = (resultado as { erro?: string })?.erro;
              sse(controller, { tool_event: { type: 'done', name: u.name, id: u.id, resumo: { erro } } });
              resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(resultado).slice(0, 20000) });
            }
            conversa.push({ role: 'user', content: resultados });
          }
        } catch (e) {
          sse(controller, { choices: [{ delta: { content: `\n\n[Erro: ${e instanceof Error ? e.message : String(e)}]` } }] });
        } finally {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
