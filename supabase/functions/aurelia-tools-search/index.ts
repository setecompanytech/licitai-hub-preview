// @ts-nocheck
// AURÉLIA com Tool Calling — RAG simples sobre cache PNCP, Diários Oficiais e Histórico de Preços
// Implementa o loop: chamada → tool_calls → execução → resposta final, retornando SSE para o cliente.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

// ── System prompt da AURÉLIA com instruções de uso de ferramentas ──
const AURELIA_SYSTEM = `
Você é AURÉLIA, consultora jurídica sênior especializada em licitações públicas (Lei 14.133/2021) da plataforma PRAEFECTUS.

VOCÊ TEM ACESSO A FERRAMENTAS DE BUSCA EM DADOS REAIS:
- buscar_edital: busca LITERAL no cache de editais do PNCP (palavras exatas, número, órgão, UF, modalidade).
- buscar_edital_semantico: busca SEMÂNTICA por significado (encontra editais conceitualmente parecidos mesmo com palavras diferentes — ex: "merenda escolar" encontra "alimentação escolar", "gêneros alimentícios para alunos").
- buscar_diario: pesquisa publicações em Diários Oficiais (DOU, DOE, DOM).
- consultar_historico_precos: consulta histórico de preços coletados por item/CATMAT.

REGRAS DE USO:
1. Para buscas POR NÚMERO, ÓRGÃO, ANO ou termo TÉCNICO específico, use buscar_edital (busca exata).
2. Para buscas POR TEMA, CATEGORIA ou DESCRIÇÃO CONCEITUAL (ex: "editais de tecnologia", "contratos de obras de saneamento"), use buscar_edital_semantico.
3. Se buscar_edital retornar vazio, tente automaticamente buscar_edital_semantico antes de informar ao usuário.
4. SEMPRE que o usuário perguntar sobre publicações em diário oficial, extratos, homologações, CHAME buscar_diario.
5. SEMPRE que o usuário pedir referência de preço, valor de mercado ou histórico, CHAME consultar_historico_precos.
6. NÃO invente dados. Use APENAS o que as ferramentas retornarem.
5. Apresente resultados em formato claro: número do processo, órgão, objeto resumido, valor, data de abertura, link.
6. Se a busca retornar vazio, informe explicitamente que não há registros no cache e sugira refinar os filtros.

REGISTRO LINGUÍSTICO: técnico-jurídico, formal, sem emojis, sem asteriscos decorativos. Use numeração (1., 2., a)) para enumerações. Cite dispositivos legais quando pertinente.
`.trim();

// ── Definição das ferramentas (OpenAI function calling) ──
const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_edital",
      description:
        "Pesquisa editais e licitações no cache do PNCP e portais. Use quando o usuário pedir para encontrar pregão, concorrência, dispensa, etc.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Texto livre: objeto, número do processo, órgão" },
          uf: { type: "string", description: "Sigla da UF (ex: PA, SP, MG)" },
          modalidade_id: {
            type: "integer",
            description:
              "Código PNCP da modalidade: 6=Pregão Eletrônico, 7=Pregão Presencial, 8=Dispensa, 4=Concorrência Eletrônica, 9=Inexigibilidade",
          },
          data_inicio: { type: "string", description: "Data inicial AAAA-MM-DD" },
          data_fim: { type: "string", description: "Data final AAAA-MM-DD" },
          limite: { type: "integer", description: "Quantidade de resultados (padrão 10, máx 25)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_edital_semantico",
      description:
        "Busca semântica por significado no cache de editais. Use para encontrar editais conceitualmente parecidos com o que o usuário descreveu, mesmo quando as palavras exatas não aparecem no objeto. Ideal para temas, categorias e perguntas em linguagem natural.",
      parameters: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description: "Descrição em linguagem natural do que se procura (ex: 'editais de merenda escolar no Pará')",
          },
          uf: { type: "string", description: "Sigla da UF para filtrar (opcional)" },
          modalidade_id: { type: "integer", description: "Código PNCP da modalidade (opcional)" },
          apenas_abertos: { type: "boolean", description: "Apenas editais com proposta em aberto (padrão true)" },
          similaridade_min: {
            type: "number",
            description: "Similaridade mínima 0.0–1.0 (padrão 0.4)",
          },
          limite: { type: "integer", description: "Quantidade de resultados (padrão 10, máx 25)" },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_diario",
      description:
        "Pesquisa publicações em Diários Oficiais (DOU, DOE, DOM) no cache. Use para extratos, homologações, atos oficiais.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Texto livre" },
          fonte: { type: "string", description: "DOU, DOE-PA, DOE-SP, DOM-Belém, etc." },
          uf: { type: "string", description: "Sigla da UF" },
          tipo: { type: "string", description: "edital, homologação, extrato, dispensa…" },
          data_inicio: { type: "string", description: "AAAA-MM-DD" },
          data_fim: { type: "string", description: "AAAA-MM-DD" },
          limite: { type: "integer", description: "Padrão 10, máx 25" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_historico_precos",
      description:
        "Consulta o histórico de preços coletados (mediana, mínimo, máximo, tendência) por descrição de item ou código CATMAT.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Descrição do item (ex: notebook i5)" },
          codigo_catmat: { type: "string", description: "Código CATMAT exato" },
          limite: { type: "integer", description: "Padrão 10, máx 25" },
        },
      },
    },
  },
];

// ── Executores das ferramentas ──
async function execBuscarEdital(args: any, db: ReturnType<typeof createClient>) {
  const limite = Math.min(Number(args.limite) || 10, 25);
  const { data, error } = await (db as any).rpc("busca_editais_instantanea", {
    p_q: args.q || null,
    p_uf: args.uf || null,
    p_modalidade_id: args.modalidade_id ? Number(args.modalidade_id) : null,
    p_data_inicio: args.data_inicio || null,
    p_data_fim: args.data_fim || null,
    p_pagina: 1,
    p_tamanho: limite,
  });
  if (error) return { erro: error.message, total: 0, resultados: [] };
  const rows = (data || []).slice(0, limite);
  return {
    total: rows[0]?.total_count || 0,
    retornados: rows.length,
    resultados: rows.map((r: any) => ({
      id: r.id,
      numero: r.numero_compra,
      orgao: r.orgao,
      uf: r.uf,
      municipio: r.municipio,
      modalidade: r.modalidade_nome,
      objeto: r.objeto?.slice(0, 400),
      valor_estimado: r.valor_total_estimado,
      data_publicacao: r.data_publicacao_pncp,
      data_abertura: r.data_abertura_proposta,
      situacao: r.situacao,
      link: r.link_sistema_origem || r.url_pncp,
      fonte: r.fonte,
    })),
  };
}

async function execBuscarDiario(args: any, db: ReturnType<typeof createClient>) {
  const limite = Math.min(Number(args.limite) || 10, 25);
  const { data, error } = await (db as any).rpc("busca_diarios_instantanea", {
    p_q: args.q || null,
    p_fonte: args.fonte || null,
    p_uf: args.uf || null,
    p_tipo: args.tipo || null,
    p_data_inicio: args.data_inicio || null,
    p_data_fim: args.data_fim || null,
    p_pagina: 1,
    p_tamanho: limite,
  });
  if (error) return { erro: error.message, total: 0, resultados: [] };
  const rows = (data || []).slice(0, limite);
  return {
    total: rows[0]?.total_count || 0,
    retornados: rows.length,
    resultados: rows.map((r: any) => ({
      fonte: r.fonte,
      data: r.data_publicacao,
      uf: r.uf,
      municipio: r.municipio,
      orgao: r.orgao,
      tipo: r.tipo_publicacao,
      processo: r.numero_processo,
      objeto: r.objeto?.slice(0, 400),
      valor: r.valor_estimado,
      link: r.link_html || r.link_pdf,
    })),
  };
}

async function execConsultarPrecos(args: any, db: ReturnType<typeof createClient>) {
  const limite = Math.min(Number(args.limite) || 10, 25);
  let query = (db as any)
    .from("price_historico")
    .select(
      "descricao,codigo_catmat,preco_minimo,preco_maximo,preco_medio,preco_mediana,preco_sugerido,total_registros,fontes,data_coleta,variacao_pct,tendencia"
    )
    .order("data_coleta", { ascending: false })
    .limit(limite);
  if (args.codigo_catmat) query = query.eq("codigo_catmat", args.codigo_catmat);
  if (args.q) query = query.ilike("descricao", `%${args.q}%`);
  const { data, error } = await query;
  if (error) return { erro: error.message, retornados: 0, resultados: [] };
  return { retornados: (data || []).length, resultados: data || [] };
}

// Busca semântica via embeddings
async function execBuscarEditalSemantico(args: any, db: ReturnType<typeof createClient>) {
  const consulta = String(args.consulta || "").trim();
  if (!consulta) return { erro: "Consulta vazia", retornados: 0, resultados: [] };

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { erro: "OPENAI_API_KEY ausente", retornados: 0, resultados: [] };

  // 1) Gerar embedding da consulta (OpenAI text-embedding-3-small, 1536 dims)
  const embedResp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: consulta.slice(0, 8000) }),
  });
  if (!embedResp.ok) {
    const t = await embedResp.text();
    return { erro: `Falha ao gerar embedding (${embedResp.status}): ${t.slice(0, 200)}`, retornados: 0, resultados: [] };
  }
  const embedData = await embedResp.json();
  const vec = embedData?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) return { erro: "Embedding inválido", retornados: 0, resultados: [] };

  // 2) Consultar via RPC semântica
  const limite = Math.min(Number(args.limite) || 10, 25);
  const { data, error } = await (db as any).rpc("busca_editais_semantica", {
    p_embedding: JSON.stringify(vec),
    p_limite: limite,
    p_similaridade_min: Number(args.similaridade_min) || 0.4,
    p_uf: args.uf || null,
    p_apenas_abertos: args.apenas_abertos !== false,
    p_modalidade_id: args.modalidade_id ? Number(args.modalidade_id) : null,
  });
  if (error) return { erro: error.message, retornados: 0, resultados: [] };

  const rows = data || [];
  return {
    retornados: rows.length,
    consulta_semantica: consulta,
    resultados: rows.map((r: any) => ({
      id: r.id,
      numero: r.numero_controle_pncp,
      orgao: r.orgao,
      uf: r.uf,
      municipio: r.municipio,
      modalidade: r.modalidade_nome,
      objeto: r.objeto?.slice(0, 400),
      valor_estimado: r.valor_total_estimado,
      data_publicacao: r.data_publicacao_pncp,
      data_encerramento: r.data_encerramento_proposta,
      link: r.link_sistema_origem || r.url_pncp,
      similaridade: Math.round((r.similaridade || 0) * 100) / 100,
    })),
  };
}

async function executarTool(name: string, args: any, db: ReturnType<typeof createClient>) {
  try {
    if (name === "buscar_edital") return await execBuscarEdital(args, db);
    if (name === "buscar_edital_semantico") return await execBuscarEditalSemantico(args, db);
    if (name === "buscar_diario") return await execBuscarDiario(args, db);
    if (name === "consultar_historico_precos") return await execConsultarPrecos(args, db);
    return { erro: `Ferramenta desconhecida: ${name}` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro interno na ferramenta" };
  }
}

// ── Helper: SSE writer ──
function sseEvent(controller: ReadableStreamDefaultController, payload: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth obrigatório
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError ? `Sessão inválida (401): ${authError.message}` : "Sessão expirada (401) — recarregue a página." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const conversation: any[] = [
      { role: "system", content: AURELIA_SYSTEM },
      ...(context ? [{ role: "system", content: `Contexto da sessão: ${context}` }] : []),
      ...messages,
    ];

    // Stream que orquestra o loop tool-calling e repassa SSE ao cliente
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const MAX_TOOL_ROUNDS = 3;
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            // Chamada NÃO-streaming na rodada exploratória para detectar tool_calls
            const planResp = await fetch(GATEWAY_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: MODEL,
                messages: conversation,
                tools: TOOLS,
                tool_choice: "auto",
                stream: false,
              }),
            });

            if (!planResp.ok) {
              const status = planResp.status;
              const errMsg =
                status === 429
                  ? "Limite de requisições excedido. Tente novamente em alguns instantes."
                  : status === 402
                    ? "Créditos insuficientes na workspace."
                    : `Erro no serviço de IA (${status})`;
              sseEvent(controller, { error: errMsg });
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const planJson = await planResp.json();
            const choice = planJson.choices?.[0];
            const msg = choice?.message;
            const toolCalls = msg?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
              // Resposta final — emite o conteúdo como delta SSE compatível
              const content = msg?.content || "";
              if (content) {
                sseEvent(controller, { choices: [{ delta: { content } }] });
              }
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            // Há tool_calls → adiciona msg do assistant + executa cada uma
            conversation.push(msg);

            for (const tc of toolCalls) {
              const fname = tc.function?.name;
              let fargs: any = {};
              try {
                fargs = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
              } catch {
                fargs = {};
              }

              // Notifica o cliente que está executando uma ferramenta
              sseEvent(controller, {
                tool_event: { type: "running", name: fname, args: fargs, id: tc.id },
              });

              const result = await executarTool(fname, fargs, db);

              sseEvent(controller, {
                tool_event: {
                  type: "done",
                  name: fname,
                  id: tc.id,
                  resumo: {
                    total: (result as any)?.total,
                    retornados: (result as any)?.retornados,
                    erro: (result as any)?.erro,
                  },
                },
              });

              conversation.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result).slice(0, 12000),
              });
            }
            // segue para a próxima rodada com os resultados das tools
          }

          // Esgotou rodadas sem resposta final
          sseEvent(controller, {
            choices: [
              {
                delta: {
                  content:
                    "Não foi possível concluir a análise após múltiplas consultas. Por favor, refine sua pergunta.",
                },
              },
            ],
          });
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("aurelia-tools-search error:", e);
          const errDetail = e instanceof Error ? e.message : String(e);
          sseEvent(controller, {
            error: `Erro interno na AURÉLIA — ${errDetail}`,
          });
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("aurelia-tools-search fatal:", e);
    return new Response(
      JSON.stringify({ error: `Falha crítica na AURÉLIA (500) — ${e instanceof Error ? e.message : String(e)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
