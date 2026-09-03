// ═══════════════════════════════════════════════════════════════════════════
// Histórico do órgão — Fase 1 do Reconhecimento de Recorrência (03/09/2026)
//
// Dado o CNPJ do órgão e a DESCRIÇÃO do objeto, devolve as contratações
// similares do acervo local (últimos N anos). O casamento é exclusivamente
// pela descrição — o campo fiel do PNCP; marca não é critério de busca em
// hipótese alguma (o portal, em regra, não a registra na listagem).
//
// Fontes, em ordem: embedding da descrição → RPC vetorial sobre o acervo;
// se o embedding falhar, fallback textual (ILIKE pelas palavras longas).
// Sem CNPJ, a busca vale para o acervo inteiro (qualquer órgão).
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const objeto = String(body.objeto || "").trim();
    const cnpj = String(body.cnpj || "").replace(/\D/g, "") || null;
    const anos = Math.min(Math.max(Number(body.anos) || 3, 1), 5);
    const limite = Math.min(Math.max(Number(body.limite) || 12, 1), 30);

    if (objeto.length < 8) {
      return json({ error: "Descrição do objeto muito curta para comparar (mínimo 8 caracteres)." }, 400);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const desde = new Date();
    desde.setFullYear(desde.getFullYear() - anos);
    const desdeStr = desde.toISOString().slice(0, 10);

    let resultados: Record<string, unknown>[] = [];
    let provedor = "textual";

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_KEY) {
      const vec = await embedOpenAI(objeto, OPENAI_KEY);
      if (vec) {
        const { data, error } = await db.rpc("historico_orgao_semantico", {
          p_embedding: vec,
          p_cnpj: cnpj,
          p_desde: desdeStr,
          p_limite: limite,
          p_similaridade_min: 0.25,
        });
        if (!error && Array.isArray(data)) {
          resultados = data;
          provedor = "semantico";
        } else if (error) {
          console.warn("[historico-orgao] RPC:", error.message);
        }
      }
    }

    // Fallback textual: as 4 palavras mais longas da descrição, todas presentes.
    if (resultados.length === 0 && provedor === "textual") {
      const palavras = [...new Set(
        objeto.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "")
          .split(/[^a-z0-9]+/).filter((w) => w.length >= 5),
      )].sort((a, b) => b.length - a.length).slice(0, 4);
      if (palavras.length > 0) {
        let q = db
          .from("pncp_editais_cache")
          .select("id, pncp_id, numero_controle_pncp, cnpj_orgao, orgao, objeto, modalidade_nome, uf, municipio, valor_total_estimado, data_publicacao_pncp, numero_compra, ano_compra, sequencial_compra, url_pncp")
          .gte("data_publicacao_pncp", desdeStr)
          .order("data_publicacao_pncp", { ascending: false })
          .limit(limite);
        for (const p of palavras) q = q.ilike("objeto", `%${p}%`);
        if (cnpj) q = q.eq("cnpj_orgao", cnpj);
        const { data } = await q;
        resultados = (data || []) as Record<string, unknown>[];
      }
    }

    return json({
      success: true,
      provedor,
      desde: desdeStr,
      cnpj,
      total: resultados.length,
      resultados,
      // O acervo só contém o que buscas e o sync já tocaram — dizer isso é
      // parte do resultado, não rodapé: ausência aqui não prova inexistência.
      aviso_acervo: "A comparação usa a descrição do objeto (campo fiel do PNCP). O acervo cresce a cada pesquisa; processos nunca pesquisados podem não constar.",
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Erro interno" }, 500);
  }
});
