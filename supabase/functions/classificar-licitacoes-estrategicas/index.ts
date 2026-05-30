import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 30, 50);
    const uf = body.uf || null;

    // Fetch recent editais with upcoming opening dates
    let query = supabase
      .from("pncp_editais_cache")
      .select("id, pncp_id, orgao, objeto, valor_total_estimado, uf, municipio, modalidade_nome, data_publicacao_pncp, data_abertura_proposta, data_encerramento_proposta, link_sistema_origem, url_pncp, fonte")
      .gte("data_abertura_proposta", new Date().toISOString())
      .order("data_abertura_proposta", { ascending: true })
      .limit(limit);

    if (uf) query = query.eq("uf", uf);

    const { data: editais, error: dbError } = await query;
    if (dbError) throw dbError;
    if (!editais || editais.length === 0) {
      return new Response(JSON.stringify({ licitacoes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI prompt for batch classification
    const editaisResumo = editais.map((e, i) => (
      `[${i}] Órgão: ${e.orgao || "N/I"} | UF: ${e.uf || "N/I"} | Objeto: ${(e.objeto || "").slice(0, 200)} | Valor: R$ ${e.valor_total_estimado || 0} | Modalidade: ${e.modalidade_nome || "N/I"} | Abertura: ${e.data_abertura_proposta || "N/I"}`
    )).join("\n");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um analista especialista em licitações públicas brasileiras. Classifique cada licitação quanto à viabilidade e atratividade para uma empresa participante.

Para cada licitação, retorne um JSON com:
- scoreRelevancia (0-100): quão relevante é o objeto
- scoreViabilidade (0-100): chance de preparar proposta competitiva a tempo
- scoreConcorrencia (0-100): favorabilidade concorrencial (100 = pouca concorrência esperada)
- scoreGeral (0-100): média ponderada geral
- recomendacao: "alta", "media" ou "baixa"
- fatoresPositivos: array de 2-3 strings curtas
- fatoresRisco: array de 1-2 strings curtas

Critérios:
- Prazo curto (<3 dias) = risco alto
- Valor muito baixo (<R$10k) = menor atratividade
- Dispensa/Inexigibilidade = concorrência favorável
- Pregão Eletrônico com valor alto = competitivo mas atrativo
- Órgãos federais = mais burocrático mas pagamento confiável

Responda APENAS com um array JSON, sem markdown, sem explicações.`
          },
          {
            role: "user",
            content: `Classifique estas ${editais.length} licitações:\n\n${editaisResumo}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classificar_licitacoes",
              description: "Classifica licitações por viabilidade",
              parameters: {
                type: "object",
                properties: {
                  classificacoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        indice: { type: "number" },
                        scoreRelevancia: { type: "number" },
                        scoreViabilidade: { type: "number" },
                        scoreConcorrencia: { type: "number" },
                        scoreGeral: { type: "number" },
                        recomendacao: { type: "string", enum: ["alta", "media", "baixa"] },
                        fatoresPositivos: { type: "array", items: { type: "string" } },
                        fatoresRisco: { type: "array", items: { type: "string" } }
                      },
                      required: ["indice", "scoreRelevancia", "scoreViabilidade", "scoreConcorrencia", "scoreGeral", "recomendacao", "fatoresPositivos", "fatoresRisco"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["classificacoes"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classificar_licitacoes" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      // Fallback: return editais without AI scoring
      const fallback = editais.map((e) => ({
        id: e.id,
        numero: e.pncp_id || e.id.slice(0, 12),
        orgao: e.orgao || "N/I",
        objeto: e.objeto || "",
        valor: e.valor_total_estimado || 0,
        uf: e.uf || "",
        municipio: e.municipio || "",
        modalidade: e.modalidade_nome || "",
        dataAbertura: e.data_abertura_proposta || "",
        linkOrigem: e.link_sistema_origem || e.url_pncp || "",
        fonte: e.fonte || "",
        scoreRelevancia: 50,
        scoreViabilidade: 50,
        scoreConcorrencia: 50,
        scoreGeral: 50,
        fatoresPositivos: ["Dados disponíveis no PNCP"],
        fatoresRisco: ["Classificação automática indisponível"],
        recomendacao: "media" as const,
        salva: false,
      }));
      return new Response(JSON.stringify({ licitacoes: fallback, fonte: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let classificacoes: any[] = [];

    // Extract from tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      classificacoes = parsed.classificacoes || [];
    }

    // Merge editais with AI scores
    const resultado = editais.map((e, i) => {
      const cls = classificacoes.find((c: any) => c.indice === i) || {
        scoreRelevancia: 50, scoreViabilidade: 50, scoreConcorrencia: 50,
        scoreGeral: 50, recomendacao: "media",
        fatoresPositivos: ["Sem classificação"], fatoresRisco: ["Sem dados"],
      };
      return {
        id: e.id,
        numero: e.pncp_id || e.id.slice(0, 12),
        orgao: e.orgao || "N/I",
        objeto: e.objeto || "",
        valor: e.valor_total_estimado || 0,
        uf: e.uf || "",
        municipio: e.municipio || "",
        modalidade: e.modalidade_nome || "",
        dataAbertura: e.data_abertura_proposta || "",
        linkOrigem: e.link_sistema_origem || e.url_pncp || "",
        fonte: e.fonte || "",
        scoreRelevancia: cls.scoreRelevancia,
        scoreViabilidade: cls.scoreViabilidade,
        scoreConcorrencia: cls.scoreConcorrencia,
        scoreGeral: cls.scoreGeral,
        fatoresPositivos: cls.fatoresPositivos,
        fatoresRisco: cls.fatoresRisco,
        recomendacao: cls.recomendacao,
        salva: false,
      };
    });

    // Sort by scoreGeral descending
    resultado.sort((a, b) => b.scoreGeral - a.scoreGeral);

    return new Response(JSON.stringify({ licitacoes: resultado, fonte: "ia" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("classificar-licitacoes error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
