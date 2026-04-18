// Fase 5 — Chat AURÉLIA com RAG sobre editais
// Fluxo: última pergunta do usuário -> embedding (Lovable Gemini 768d)
// -> top-N editais via RPC busca_editais_semantica_lovable
// -> contexto injetado no prompt -> resposta streaming via Lovable AI Gateway.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function embedLovable(texto: string, key: string): Promise<number[] | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/text-embedding-004", input: texto.slice(0, 8000) }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const v = d?.data?.[0]?.embedding;
    return Array.isArray(v) && v.length === 768 ? v : null;
  } catch {
    return null;
  }
}

function fmtMoeda(v: any): string {
  const n = Number(v);
  if (!n || isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtData(d: any): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const messages: Array<{ role: string; content: string }> = body.messages || [];
    const filtros = body.filtros || {};

    if (!messages.length) {
      return new Response(JSON.stringify({ error: "messages obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Última pergunta do usuário = query semântica
    const ultima = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const queryRag = ultima.trim().slice(0, 1000);

    let contexto = "";
    let editaisCitados: any[] = [];

    if (queryRag.length >= 3) {
      const vec = await embedLovable(queryRag, LOVABLE_KEY);
      if (vec) {
        const { data, error } = await (db as any).rpc("busca_editais_semantica_lovable", {
          p_embedding: JSON.stringify(vec),
          p_limite: 8,
          p_similaridade_min: 0.2,
          p_uf: filtros.uf || null,
          p_apenas_abertos: filtros.apenas_abertos !== false,
          p_modalidade_id: filtros.modalidade_id || null,
        });
        if (!error && data?.length) {
          editaisCitados = data;
          contexto = data.map((e: any, i: number) =>
            `[${i + 1}] ${e.objeto?.slice(0, 280) || "Sem objeto"}
   • Órgão: ${e.orgao || "—"} (${e.municipio || "—"}/${e.uf || "—"})
   • Modalidade: ${e.modalidade_nome || "—"} | Valor estimado: ${fmtMoeda(e.valor_total_estimado)}
   • Publicação: ${fmtData(e.data_publicacao_pncp)} | Encerramento: ${fmtData(e.data_encerramento_proposta)}
   • Similaridade: ${(Number(e.similaridade) * 100).toFixed(1)}%
   • PNCP: ${e.pncp_id || e.numero_controle_pncp || "—"}`
          ).join("\n\n");
        } else if (error) {
          console.error("RPC erro:", error.message);
        }
      }
    }

    const systemPrompt = `Você é AURÉLIA, assistente especialista em licitações públicas brasileiras (Lei 14.133/2021, IN 65/2021, jurisprudência TCU).

REGRAS:
- Responda em português, tom técnico-jurídico, claro e objetivo.
- Use APENAS os editais do CONTEXTO abaixo para responder perguntas factuais sobre o acervo. Se a informação não estiver no contexto, diga que não há edital correspondente no acervo atual.
- Sempre cite os editais usados no formato [1], [2], etc., correspondendo aos números do CONTEXTO.
- Formate em markdown com listas, negritos e tabelas quando útil.
- Para perguntas conceituais (legislação, prazos, recursos), responda com base no seu conhecimento jurídico, sem inventar editais.
- Nunca invente CNPJ, valores, datas ou números de processo.

CONTEXTO (editais semanticamente relevantes à pergunta atual):
${contexto || "(nenhum edital encontrado para esta pergunta — responda apenas se for conceitual ou peça reformulação)"}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: "Falha no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Editais-Count": String(editaisCitados.length),
        "X-Editais-Citados": encodeURIComponent(JSON.stringify(
          editaisCitados.map((e, i) => ({
            n: i + 1,
            id: e.id,
            pncp_id: e.pncp_id,
            orgao: e.orgao,
            objeto: (e.objeto || "").slice(0, 200),
            uf: e.uf,
            municipio: e.municipio,
            valor: e.valor_total_estimado,
            modalidade: e.modalidade_nome,
            similaridade: e.similaridade,
            url: e.url_pncp || e.link_sistema_origem,
          }))
        )),
      },
    });
  } catch (e) {
    console.error("aurelia-chat-editais fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
