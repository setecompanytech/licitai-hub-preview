// Edge function: coletar-diario-belem
// Extrai diariamente o Diário Oficial de Belém (https://sistemas.belem.pa.gov.br/diario/painel)
// via Firecrawl, classifica cada publicação com IA (Lovable AI - Gemini Flash),
// e grava em `alertas_gerados` (que alimenta Mural + boletim e-mail/WhatsApp).
// Deduplicação por hash em `publicacoes_belem_processadas`.

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PORTAL_URL = "https://sistemas.belem.pa.gov.br/diario/painel";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const AI_GATEWAY_URL = "https://api.openai.com/v1/chat/completions";

interface PublicacaoExtraida {
  titulo: string;
  tipo: string; // Edital | Aviso | Extrato de Contrato | Dispensa | Resultado | Outro
  orgao: string | null;
  objeto: string | null;
  numero_processo: string | null;
  numero_pregao: string | null;
  valor_estimado: number | null;
  data_abertura: string | null; // ISO
  segmento: string | null;
  urgente: boolean;
  conteudo_resumo: string;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extrairViaFirecrawl(apiKey: string): Promise<string> {
  const resp = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: PORTAL_URL,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 4000,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Firecrawl ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const md =
    data?.markdown ?? data?.data?.markdown ?? data?.data?.content ?? "";
  if (!md || typeof md !== "string") {
    throw new Error("Firecrawl não retornou markdown utilizável");
  }
  return md;
}

async function classificarComIA(
  markdown: string,
  openaiKey: string,
): Promise<PublicacaoExtraida[]> {
  // Limita o tamanho enviado à IA (~80k chars)
  const conteudo = markdown.slice(0, 80000);

  const systemPrompt =
    "Você é um especialista em licitações públicas brasileiras (Lei 14.133/2021). " +
    "Sua tarefa é extrair publicações relevantes do Diário Oficial de Belém/PA (avisos, editais, " +
    "extratos de contrato, dispensas, resultados de licitação). Ignore atos de pessoal, nomeações, " +
    "exonerações, decretos administrativos sem valor licitatório.";

  const userPrompt = `Analise este conteúdo do Diário Oficial de Belém e extraia TODAS as publicações relacionadas a licitações, contratos públicos, avisos de pregão, dispensas, inexigibilidades, extratos contratuais e resultados.

Para CADA publicação relevante, retorne um objeto com:
- titulo: título curto (até 120 chars)
- tipo: "Edital" | "Aviso" | "Extrato de Contrato" | "Dispensa" | "Inexigibilidade" | "Resultado" | "Ata SRP" | "Outro"
- orgao: órgão/secretaria emissor (ou null)
- objeto: descrição do objeto contratado (até 300 chars, ou null)
- numero_processo: número do processo administrativo (ou null)
- numero_pregao: número do pregão/edital (ou null)
- valor_estimado: valor em reais (número, ou null)
- data_abertura: data de abertura no formato YYYY-MM-DD (ou null)
- segmento: área de fornecimento (ex: "Alimentos", "TI", "Limpeza", "Construção", "Saúde", "Combustíveis", ou null)
- urgente: true se prazo < 5 dias úteis ou se for "URGENTE/IMEDIATO"
- conteudo_resumo: resumo de 1-2 linhas

CONTEÚDO:
\`\`\`
${conteudo}
\`\`\``;

  const resp = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "registrar_publicacoes",
            description: "Registra a lista de publicações licitatórias extraídas",
            parameters: {
              type: "object",
              properties: {
                publicacoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      tipo: { type: "string" },
                      orgao: { type: ["string", "null"] },
                      objeto: { type: ["string", "null"] },
                      numero_processo: { type: ["string", "null"] },
                      numero_pregao: { type: ["string", "null"] },
                      valor_estimado: { type: ["number", "null"] },
                      data_abertura: { type: ["string", "null"] },
                      segmento: { type: ["string", "null"] },
                      urgente: { type: "boolean" },
                      conteudo_resumo: { type: "string" },
                    },
                    required: ["titulo", "tipo", "urgente", "conteudo_resumo"],
                  },
                },
              },
              required: ["publicacoes"],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "registrar_publicacoes" },
      },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("AI Gateway rate-limited (429)");
    if (resp.status === 402) throw new Error("AI Gateway sem créditos (402)");
    const t = await resp.text();
    throw new Error(`AI Gateway ${resp.status}: ${t.slice(0, 300)}`);
  }

  const data = await resp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  const argsStr = toolCall?.function?.arguments;
  if (!argsStr) {
    console.warn("IA não retornou tool_call; resposta bruta:", JSON.stringify(data).slice(0, 400));
    return [];
  }
  try {
    const parsed = JSON.parse(argsStr);
    const lista: PublicacaoExtraida[] = Array.isArray(parsed?.publicacoes)
      ? parsed.publicacoes
      : [];
    return lista;
  } catch (e) {
    console.error("Falha ao parsear args da IA:", e);
    return [];
  }
}

async function distribuirAlerta(
  supabase: ReturnType<typeof createClient>,
  pub: PublicacaoExtraida,
): Promise<number> {
  // Estratégia: cria 1 alerta por usuário com `boletim_preferencias` ativo.
  // O Mural + boletins consomem `alertas_gerados` automaticamente.
  const { data: prefs, error: prefErr } = await supabase
    .from("boletim_preferencias")
    .select("user_id, segmentos, ufs_interesse");

  if (prefErr) {
    console.error("Erro ao buscar boletim_preferencias:", prefErr);
    return 0;
  }
  if (!prefs || prefs.length === 0) return 0;

  // Filtra usuários que têm interesse no segmento ou em PA
  const elegiveis = prefs.filter((p: any) => {
    const ufsOk =
      !p.ufs_interesse ||
      p.ufs_interesse.length === 0 ||
      p.ufs_interesse.includes("PA");
    const segOk =
      !p.segmentos ||
      p.segmentos.length === 0 ||
      (pub.segmento && p.segmentos.includes(pub.segmento));
    return ufsOk && segOk;
  });

  if (elegiveis.length === 0) return 0;

  const rows = elegiveis.map((p: any) => ({
    user_id: p.user_id,
    fonte: "Diário Oficial de Belém",
    tipo: pub.tipo,
    titulo: pub.titulo,
    descricao: pub.conteudo_resumo,
    orgao: pub.orgao,
    objeto: pub.objeto,
    numero_processo: pub.numero_processo,
    numero_pregao: pub.numero_pregao,
    valor_estimado: pub.valor_estimado,
    data_abertura: pub.data_abertura,
    segmento: pub.segmento,
    urgente: pub.urgente,
    uf: "PA",
    url_publicacao: PORTAL_URL,
  }));

  const { error: insErr } = await supabase.from("alertas_gerados").insert(rows);
  if (insErr) {
    console.error("Erro ao inserir alertas_gerados:", insErr);
    return 0;
  }
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const inicio = Date.now();
  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY não configurada");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Credenciais do Supabase ausentes");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    console.log("[coletar-diario-belem] Iniciando coleta...");

    // 1) Extrai conteúdo do painel
    const markdown = await extrairViaFirecrawl(FIRECRAWL_API_KEY);
    console.log(`[coletar-diario-belem] Markdown extraído: ${markdown.length} chars`);

    // 2) Classifica via IA
    const publicacoes = await classificarComIA(markdown, OPENAI_API_KEY);
    console.log(`[coletar-diario-belem] IA extraiu ${publicacoes.length} publicações`);

    const hoje = new Date().toISOString().slice(0, 10);
    let novas = 0;
    let duplicadas = 0;
    let alertasTotal = 0;

    // 3) Para cada publicação: dedup → grava controle → dispara alertas
    for (const pub of publicacoes) {
      const chaveDedup = [
        pub.tipo,
        pub.titulo,
        pub.orgao ?? "",
        pub.numero_pregao ?? "",
        pub.numero_processo ?? "",
      ].join("|").toLowerCase();
      const hash = await sha256Hex(chaveDedup);

      // Tenta inserir registro de controle (UNIQUE em hash_conteudo evita duplicidade)
      const { data: ctrl, error: ctrlErr } = await supabase
        .from("publicacoes_belem_processadas")
        .insert({
          hash_conteudo: hash,
          data_edicao: hoje,
          titulo: pub.titulo.slice(0, 500),
          tipo: pub.tipo,
          orgao: pub.orgao,
          url_origem: PORTAL_URL,
        })
        .select("id")
        .maybeSingle();

      if (ctrlErr) {
        // Erro de unique constraint = já processada
        if (String(ctrlErr.message).includes("duplicate") || ctrlErr.code === "23505") {
          duplicadas++;
          continue;
        }
        console.error("Erro inesperado ao gravar controle:", ctrlErr);
        continue;
      }

      novas++;
      const enviados = await distribuirAlerta(supabase, pub);
      alertasTotal += enviados;

      if (ctrl?.id) {
        await supabase
          .from("publicacoes_belem_processadas")
          .update({ alertas_gerados_count: enviados })
          .eq("id", ctrl.id);
      }
    }

    // 4) Atualiza stats do portal
    await supabase
      .from("portais_monitorados")
      .update({
        ultima_coleta: new Date().toISOString(),
        status_atual: "ok",
        ultimo_erro: null,
        total_coletados: novas,
      })
      .eq("url_base", PORTAL_URL);

    const duracaoMs = Date.now() - inicio;
    console.log(
      `[coletar-diario-belem] OK | publicacoes=${publicacoes.length} novas=${novas} duplicadas=${duplicadas} alertas=${alertasTotal} (${duracaoMs}ms)`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        publicacoes_extraidas: publicacoes.length,
        novas,
        duplicadas,
        alertas_disparados: alertasTotal,
        duracao_ms: duracaoMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[coletar-diario-belem] ERRO:", msg);

    // Marca erro no portal (best-effort)
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } },
      );
      await sb
        .from("portais_monitorados")
        .update({
          status_atual: "erro",
          ultimo_erro: msg.slice(0, 500),
          ultima_coleta: new Date().toISOString(),
        })
        .eq("url_base", PORTAL_URL);
    } catch (_) {
      // ignore
    }

    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
