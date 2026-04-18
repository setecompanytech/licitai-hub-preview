// Geração de embeddings para o cache de editais PNCP (Fase 3)
// - Modo backfill: processa lotes de editais sem embedding (chamado manualmente ou por cron)
// - Modo incremental: aceita lista de IDs específicos (chamado pelo crawler após inserir novos)
// Modelo: google/text-embedding-004 via Lovable AI Gateway (768 dims)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const LOTE_PADRAO = 100;
const LOTE_MAX = 500;

async function gerarEmbedding(texto: string, apiKey: string): Promise<number[] | null> {
  // Sanitiza chave: remove espaços, quebras de linha, caracteres não-ASCII
  const cleanKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();
  const resp = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texto.slice(0, 8000),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Embed API ${resp.status}: ${err.slice(0, 200)}`);
    return null;
  }

  const data = await resp.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIMS) {
    console.error("Embedding com formato inválido", { length: vec?.length });
    return null;
  }
  return vec;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = Date.now();
  try {
    // Auth: aceita CRON_SECRET (cron) OU usuário autenticado admin
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SECRET");

    if (!isCron && !authHeader) {
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

    // 1) Coletar editais a processar
    let pendentes: { id: string; texto_para_embedding: string }[] = [];
    if (ids && ids.length > 0) {
      const { data, error } = await (db as any)
        .from("pncp_editais_cache")
        .select("id,objeto,orgao,modalidade_nome,municipio,uf")
        .in("id", ids)
        .is("embedding", null);
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
        "pncp_editais_pendentes_embedding",
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

    // 2) Gerar embeddings (sequencial p/ respeitar rate limit)
    let sucesso = 0;
    let falhas = 0;
    for (const item of pendentes) {
      if (!item.texto_para_embedding || item.texto_para_embedding.length < 5) {
        falhas++;
        continue;
      }
      const vec = await gerarEmbedding(item.texto_para_embedding, OPENAI_API_KEY);
      if (!vec) {
        falhas++;
        continue;
      }
      const { error: upErr } = await (db as any)
        .from("pncp_editais_cache")
        .update({
          embedding: JSON.stringify(vec), // pgvector aceita string '[...]'
          embedding_gerado_em: new Date().toISOString(),
          embedding_modelo: EMBED_MODEL,
        })
        .eq("id", item.id);
      if (upErr) {
        console.error("Falha update", item.id, upErr.message);
        falhas++;
      } else {
        sucesso++;
      }
      // Pequeno delay para evitar rate limit
      await new Promise((r) => setTimeout(r, 80));
    }

    const duracao = Date.now() - inicio;
    return new Response(
      JSON.stringify({
        ok: true,
        processados: pendentes.length,
        sucesso,
        falhas,
        duracao_ms: duracao,
        modelo: EMBED_MODEL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pncp-gerar-embeddings fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
