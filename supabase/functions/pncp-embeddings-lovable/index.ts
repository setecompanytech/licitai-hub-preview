// Fase 4 — Geração de embeddings via OpenAI API
// Modelo: text-embedding-3-small (768 dimensões, compatível com coluna embedding_lovable)
// Usa coluna embedding_lovable para compatibilidade com schema existente.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const DIMS = 768;
const LOTE_PADRAO = 100;
const LOTE_MAX = 500;

async function gerarEmbedding(texto: string, apiKey: string): Promise<number[] | null> {
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: texto.slice(0, 8000),
      dimensions: DIMS,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`OpenAI embed ${resp.status}: ${err.slice(0, 200)}`);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    return null;
  }

  const data = await resp.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== DIMS) {
    console.error("Embedding inválido", { length: vec?.length });
    return null;
  }
  return vec;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = Date.now();
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization");
    const apiKeyHeader = req.headers.get("apikey");
    if (!isCron && !authHeader && !apiKeyHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;
    const limite = Math.min(Number(body.limite) || LOTE_PADRAO, LOTE_MAX);

    let pendentes: { id: string; texto_para_embedding: string }[] = [];
    if (ids && ids.length > 0) {
      const { data, error } = await (db as any)
        .from("pncp_editais_cache")
        .select("id,objeto,orgao,modalidade_nome,municipio,uf")
        .in("id", ids)
        .is("embedding_lovable", null);
      if (error) throw error;
      pendentes = (data || []).map((r: any) => ({
        id: r.id,
        texto_para_embedding: [
          r.objeto, r.orgao, r.modalidade_nome,
          `${r.municipio || ""}/${r.uf || ""}`,
        ].filter(Boolean).join(" | ").slice(0, 2000),
      }));
    } else {
      const { data, error } = await (db as any).rpc(
        "pncp_pendentes_embedding_lovable",
        { p_limite: limite }
      );
      if (error) throw error;
      pendentes = data || [];
    }

    if (pendentes.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processados: 0, mensagem: "Nada a processar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sucesso = 0;
    let falhas = 0;
    for (const item of pendentes) {
      if (!item.texto_para_embedding || item.texto_para_embedding.length < 5) {
        falhas++;
        continue;
      }
      try {
        const vec = await gerarEmbedding(item.texto_para_embedding, OPENAI_API_KEY);
        if (!vec) {
          falhas++;
          continue;
        }
        const { error: upErr } = await (db as any)
          .from("pncp_editais_cache")
          .update({
            embedding_lovable: JSON.stringify(vec),
            embedding_lovable_gerado_em: new Date().toISOString(),
            embedding_lovable_modelo: MODEL,
          })
          .eq("id", item.id);
        if (upErr) {
          console.error("Update falhou", item.id, upErr.message);
          falhas++;
        } else {
          sucesso++;
        }
      } catch (e: any) {
        if (e.message === "RATE_LIMIT" || e.message === "CREDITS_EXHAUSTED") {
          return new Response(
            JSON.stringify({
              ok: false,
              error: e.message,
              sucesso, falhas,
              processados: sucesso + falhas,
            }),
            { status: e.message === "RATE_LIMIT" ? 429 : 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        falhas++;
      }
      await new Promise((r) => setTimeout(r, 60));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processados: pendentes.length,
        sucesso, falhas,
        duracao_ms: Date.now() - inicio,
        modelo: MODEL,
        dims: DIMS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pncp-embeddings-lovable fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
