// ═══════════════════════════════════════════════════════════════════════════
// Histórico do órgão — Fase 1 do Reconhecimento de Recorrência (03/09/2026)
// — e o balcão de Preço por objeto da Análise de mercado (08/09 e 22/09).
//
// Dada a DESCRIÇÃO do objeto (e, opcionalmente, o CNPJ do órgão), devolve as
// contratações similares do acervo local (últimos N anos). O casamento é
// exclusivamente pela descrição — o campo fiel do PNCP; marca não é critério
// de busca em hipótese alguma (o portal, em regra, não a registra).
//
// Dois caminhos:
//  · SEM `modo` (a Recorrência): embedding da descrição → RPC vetorial com
//    piso; se o embedding falhar, fallback textual (ILIKE pelas palavras
//    longas). Inalterado desde 08/09.
//  · COM `modo` (Preço por objeto, 22/09): as PALAVRAS decidem quem entra
//    (`objeto_tsv`, com radical em português) e o vetor, quando há, decide a
//    ORDEM — sem piso absoluto. "CARNE MOIDA PATINHO" no Pará voltava vazio
//    com 3 editais de carne moída e 78 de carne no acervo: a busca era só
//    por vetor com piso de 45%, e a por palavras só rodava quando o vetor
//    FALHAVA. `modo`: todas | qualquer | significado.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { consultaQualquerPalavra } from "../_shared/busca-por-objeto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COLUNAS =
  "id, pncp_id, numero_controle_pncp, cnpj_orgao, orgao, objeto, modalidade_nome, uf, municipio, valor_total_estimado, data_publicacao_pncp, numero_compra, ano_compra, sequencial_compra, url_pncp";

const AVISO_ACERVO =
  "A comparação usa a descrição do objeto (campo fiel do PNCP). O acervo cresce a cada pesquisa; processos nunca pesquisados podem não constar.";

type Modo = "todas" | "qualquer" | "significado";
const MODOS: Modo[] = ["todas", "qualquer", "significado"];

type Linha = Record<string, unknown>;
type Db = ReturnType<typeof createClient>;

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

type Recorte = {
  objeto: string;
  modo: Modo;
  vec: number[] | null;
  cnpj: string | null;
  desdeStr: string;
  ateStr: string | null;
  uf: string | null;
  municipio: string | null;
  limite: number;
};

/**
 * Preço por objeto (22/09): palavras decidem quem entra, significado decide a
 * ordem. "Só significado" usa a RPC vetorial com o piso original de 0.25; sem
 * vetor (chave ausente ou OpenAI fora), vira "qualquer palavra" — não se
 * devolve vazio por falta de chave. Se a RPC nova ainda não existir no banco
 * (migration 20260922000002 por colar), a busca textual roda direto, em ordem
 * de data: pior ordenação, mesmo conjunto.
 */
async function buscarPorObjeto(db: Db, r: Recorte): Promise<{ provedor: string; resultados: Linha[] } | { error: string }> {
  if (r.modo === "significado" && r.vec) {
    const { data, error } = await db.rpc("historico_orgao_semantico", {
      p_embedding: r.vec,
      p_cnpj: r.cnpj,
      p_desde: r.desdeStr,
      p_limite: r.limite,
      p_similaridade_min: 0.25,
      p_uf: r.uf,
      p_municipio: r.municipio,
      p_ate: r.ateStr,
    });
    if (!error && Array.isArray(data)) return { provedor: "significado", resultados: data as Linha[] };
    console.warn("[historico-orgao] RPC semântica:", error?.message);
  }

  const modoTexto: "todas" | "qualquer" = r.modo === "todas" ? "todas" : "qualquer";
  const textoOu = consultaQualquerPalavra(r.objeto);
  const { data, error } = await db.rpc("precos_por_objeto_no_acervo", {
    p_texto: r.objeto,
    p_texto_ou: textoOu,
    p_modo: modoTexto,
    p_embedding: r.vec,
    p_desde: r.desdeStr,
    p_ate: r.ateStr,
    p_uf: r.uf,
    p_municipio: r.municipio,
    p_cnpj: r.cnpj,
    p_limite: r.limite,
  });
  if (!error && Array.isArray(data)) {
    return { provedor: r.vec ? "palavras+significado" : "palavras", resultados: data as Linha[] };
  }
  console.warn("[historico-orgao] RPC precos_por_objeto_no_acervo:", error?.message);

  let q = db
    .from("pncp_editais_cache")
    .select(COLUNAS)
    .gte("data_publicacao_pncp", r.desdeStr)
    .order("data_publicacao_pncp", { ascending: false })
    .limit(r.limite);
  q = modoTexto === "todas"
    ? q.textSearch("objeto_tsv", r.objeto, { config: "portuguese", type: "plain" })
    : q.textSearch("objeto_tsv", textoOu, { config: "portuguese", type: "websearch" });
  if (r.cnpj) q = q.eq("cnpj_orgao", r.cnpj);
  if (r.uf) q = q.eq("uf", r.uf);
  if (r.municipio) q = q.ilike("municipio", `%${r.municipio}%`);
  if (r.ateStr) q = q.lte("data_publicacao_pncp", `${r.ateStr}T23:59:59`);
  const { data: direto, error: erroDireto } = await q;
  if (erroDireto) return { error: erroDireto.message };
  return { provedor: "palavras (por data)", resultados: (direto ?? []) as Linha[] };
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
    const modo: Modo | null = MODOS.includes(body.modo) ? (body.modo as Modo) : null;

    if (objeto.length < 8) {
      return json({ error: "Descrição do objeto muito curta para comparar (mínimo 8 caracteres)." }, 400);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Filtros inteligentes (08/09): UF, município, ano exato e RIGOR ──
    // O rigor é o antídoto do vizinho fraco: "papel A4" trazia fita crepe a
    // 50% e a mediana saía poluída. A tela escolhe o piso; 0.35 é o mínimo.
    // (Só o caminho da Recorrência usa o piso; o Preço por objeto usa `modo`.)
    const uf = String(body.uf || "").trim().toUpperCase() || null;
    const municipio = String(body.municipio || "").trim() || null;
    const anoExato = Number(body.anoExato) || null;
    const similaridadeMin = Math.min(Math.max(Number(body.similaridadeMin) || 0.35, 0.35), 0.9);

    const desde = new Date();
    desde.setFullYear(desde.getFullYear() - anos);
    let desdeStr = desde.toISOString().slice(0, 10);
    let ateStr: string | null = null;
    if (anoExato && anoExato >= 2021 && anoExato <= 2100) {
      desdeStr = `${anoExato}-01-01`;
      ateStr = `${anoExato}-12-31`;
    }

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const vec = OPENAI_KEY ? await embedOpenAI(objeto, OPENAI_KEY) : null;

    if (modo) {
      const resposta = await buscarPorObjeto(db, { objeto, modo, vec, cnpj, desdeStr, ateStr, uf, municipio, limite });
      if ("error" in resposta) return json({ error: resposta.error }, 500);
      return json({
        success: true,
        modo,
        provedor: resposta.provedor,
        desde: desdeStr,
        ate: ateStr,
        uf,
        municipio,
        cnpj,
        total: resposta.resultados.length,
        resultados: resposta.resultados,
        aviso_acervo: AVISO_ACERVO,
      });
    }

    // ── Caminho da Recorrência (histórico do órgão) — inalterado ──────────
    let resultados: Linha[] = [];
    let provedor = "textual";

    if (vec) {
      const { data, error } = await db.rpc("historico_orgao_semantico", {
        p_embedding: vec,
        p_cnpj: cnpj,
        p_desde: desdeStr,
        p_limite: limite,
        // Piso 0.35 (teste de 03/09: 0.25 deixava entrar vizinhos fracos);
        // a tela pode EXIGIR mais via similaridadeMin.
        p_similaridade_min: similaridadeMin,
        p_uf: uf,
        p_municipio: municipio,
        p_ate: ateStr,
      });
      if (!error && Array.isArray(data)) {
        resultados = data as Linha[];
        provedor = "semantico";
      } else if (error) {
        console.warn("[historico-orgao] RPC:", error.message);
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
          .select(COLUNAS)
          .gte("data_publicacao_pncp", desdeStr)
          .order("data_publicacao_pncp", { ascending: false })
          .limit(limite);
        for (const p of palavras) q = q.ilike("objeto", `%${p}%`);
        if (cnpj) q = q.eq("cnpj_orgao", cnpj);
        // O fallback honra os MESMOS recortes do caminho semântico.
        if (uf) q = q.eq("uf", uf);
        if (municipio) q = q.ilike("municipio", `%${municipio}%`);
        if (ateStr) q = q.lte("data_publicacao_pncp", `${ateStr}T23:59:59`);
        const { data } = await q;
        resultados = (data || []) as Linha[];
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
      aviso_acervo: AVISO_ACERVO,
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Erro interno" }, 500);
  }
});
