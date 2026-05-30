// Fase 4 — Busca Semântica AURÉLIA
// Gera embedding da query do usuário e retorna editais por similaridade vetorial.
// Estratégia híbrida (3 provedores):
//   1) Lovable AI (Gemini 768d) → preferencial, sempre disponível
//   2) OpenAI (1536d) → fallback se Lovable falhar e a chave for válida
//   3) Busca textual (tsvector) → fallback final, sempre funciona
// Reranking opcional via Claude (Anthropic) para refinar relevância dos top-N.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function embedLovable(texto: string, key: string): Promise<number[] | null> {
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/text-embedding-004", input: texto.slice(0, 8000) }),
    });
    if (!r.ok) {
      console.error("Lovable embed", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const d = await r.json();
    const v = d?.data?.[0]?.embedding;
    return Array.isArray(v) && v.length === 768 ? v : null;
  } catch (e) {
    console.error("Lovable embed exc", e);
    return null;
  }
}

async function embedOpenAI(texto: string, key: string): Promise<number[] | null> {
  try {
    const clean = key.replace(/[^\x20-\x7E]/g, "").trim();
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${clean}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texto.slice(0, 8000) }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const v = d?.data?.[0]?.embedding;
    return Array.isArray(v) && v.length === 1536 ? v : null;
  } catch {
    return null;
  }
}

async function rerankClaude(query: string, items: any[], key: string): Promise<any[] | null> {
  try {
    const lista = items.slice(0, 15).map((it, i) =>
      `${i}. ${(it.objeto || "").slice(0, 220)} (${it.orgao || ""} - ${it.uf || ""})`
    ).join("\n");
    const prompt = `Você é especialista em licitações públicas. Reordene os ${items.length > 15 ? 15 : items.length} editais abaixo do MAIS para o MENOS relevante para a consulta do usuário, considerando objeto, órgão e localidade. Responda APENAS com índices separados por vírgula (ex: 3,0,1,5,...).

CONSULTA: "${query}"

EDITAIS:
${lista}`;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const texto = d?.content?.[0]?.text || "";
    const ordem = texto.match(/\d+/g)?.map(Number).filter((n: number) => n < items.length) || [];
    if (ordem.length < 3) return null;
    const seen = new Set<number>();
    const reordered: any[] = [];
    for (const i of ordem) {
      if (!seen.has(i) && items[i]) { reordered.push(items[i]); seen.add(i); }
    }
    // anexa restantes mantendo ordem original
    items.forEach((it, i) => { if (!seen.has(i)) reordered.push(it); });
    return reordered;
  } catch (e) {
    console.error("Claude rerank exc", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const query = (body.query || body.q || "").toString().trim();
    const limite = Math.min(Math.max(Number(body.limite) || 20, 1), 50);
    const sim_min = Number(body.similaridade_min ?? 0.25);
    const uf = body.uf || null;
    const apenas_abertos = body.apenas_abertos !== false;
    const modalidade_id = body.modalidade_id ? Number(body.modalidade_id) : null;
    const usar_rerank = body.rerank === true;

    if (!query || query.length < 3) {
      return new Response(JSON.stringify({ error: "query mínima de 3 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    let provedor = "textual";
    let resultados: any[] = [];

    // 1) Tenta Lovable (Gemini 768d)
    if (OPENAI_KEY) {
      const vec = await embedLovable(query, OPENAI_KEY);
      if (vec) {
        const { data, error } = await (db as any).rpc("busca_editais_semantica_lovable", {
          p_embedding: JSON.stringify(vec),
          p_limite: limite,
          p_similaridade_min: sim_min,
          p_uf: uf,
          p_apenas_abertos: apenas_abertos,
          p_modalidade_id: modalidade_id,
        });
        if (!error && data && data.length > 0) {
          provedor = "lovable_gemini_768";
          resultados = data;
        } else if (error) {
          console.error("RPC lovable erro:", error.message);
        }
      }
    }

    // 2) Fallback OpenAI
    if (resultados.length === 0 && OPENAI_KEY && OPENAI_KEY.startsWith("sk-")) {
      const vec = await embedOpenAI(query, OPENAI_KEY);
      if (vec) {
        const { data, error } = await (db as any).rpc("busca_editais_semantica", {
          p_embedding: JSON.stringify(vec),
          p_limite: limite,
          p_similaridade_min: sim_min,
          p_uf: uf,
          p_apenas_abertos: apenas_abertos,
          p_modalidade_id: modalidade_id,
        });
        if (!error && data && data.length > 0) {
          provedor = "openai_1536";
          resultados = data;
        }
      }
    }

    // 3) Fallback textual (tsvector)
    if (resultados.length === 0) {
      const { data, error } = await (db as any).rpc("busca_editais_instantanea", {
        p_q: query,
        p_uf: uf,
        p_modalidade_id: modalidade_id,
        p_pagina: 1,
        p_tamanho: limite,
      });
      if (!error && data) {
        provedor = "textual_tsvector";
        resultados = data.map((r: any) => ({ ...r, similaridade: r.rank_busca || 0 }));
      }
    }

    // 4) Rerank opcional via Claude
    let reranked = false;
    if (usar_rerank && ANTHROPIC_KEY && resultados.length >= 3) {
      const r = await rerankClaude(query, resultados, ANTHROPIC_KEY);
      if (r) { resultados = r; reranked = true; }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        query,
        provedor,
        rerank: reranked,
        total: resultados.length,
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("busca-semantica fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
