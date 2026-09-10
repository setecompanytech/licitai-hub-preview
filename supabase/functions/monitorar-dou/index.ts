// Monitoramento dos Diários Oficiais pelo NOME da empresa (10/09).
//
// A função nasceu buscando só o Querido Diário (diários municipais) e ficou
// DORMENTE — sem cron e sem o DOU de verdade. Agora:
//   1) DOU via busca do in.gov.br: a página embute os resultados num JSON
//      (<script id="..._params" type="application/json">{"jsonArray":[...]})
//      — parse determinístico, sem raspar HTML;
//   2) termos vêm DO SISTEMA: CNPJ (formatado, como sai nas publicações),
//      razão social e nome fantasia das empresas do usuário — mais o que a
//      preferência declarar;
//   3) classificação com as categorias que importam a quem FORNECE:
//      aviso de licitação, extrato de contrato, ata de registro de preços e
//      termo aditivo — além de suspensão/cancelamento/homologação/alteração.
//      Menção à empresa é sempre relevante: os tipos novos não são gateados
//      pelas flags receber_*;
//   4) cron a cada 4h (24/7) com CRON_SECRET — deploy --no-verify-jwt.
//
// Saída inalterada de propósito: alertas_gerados (o Editais já exibe) e
// dedupe em publicacoes_dou_processadas.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ItemDou = {
  title: string; urlTitle: string; pubDate: string; pubName: string;
  hierarchyStr: string; content: string;
};

const limparHtml = (s: string) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const formatarCnpj = (d: string) =>
  d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;

/** As categorias de quem fornece vêm ANTES das genéricas: um "extrato de
 *  termo aditivo" é aditivo, não "alteração". */
function classificar(texto: string): { tipo: string; urgente: boolean } {
  const t = texto.toLowerCase();
  if (/termo\s+aditivo|apostilamento|extrato\s+de\s+aditivo/.test(t)) return { tipo: "aditivo", urgente: false };
  if (/ata\s+de\s+registro\s+de\s+pre[cç]os|extrato\s+de\s+ata/.test(t)) return { tipo: "ata_registro", urgente: false };
  if (/extrato\s+de\s+contrato|termo\s+de\s+contrato|contrato\s+administrativo/.test(t)) return { tipo: "extrato_contrato", urgente: false };
  if (/aviso\s+de\s+licita[cç][aã]o|preg[aã]o\s+eletr[oô]nico|edital\s+de\s+licita/.test(t)) return { tipo: "aviso_licitacao", urgente: false };
  if (/suspens|suspende/.test(t)) return { tipo: "suspensao", urgente: true };
  if (/cancel|revoga|anula/.test(t)) return { tipo: "cancelamento", urgente: true };
  if (/homologa|adjudica/.test(t)) return { tipo: "homologacao", urgente: false };
  return { tipo: "alteracao", urgente: false };
}

/** Tipos que existem porque a EMPRESA foi mencionada — sempre entregues. */
const TIPOS_SEMPRE = new Set(["aviso_licitacao", "extrato_contrato", "ata_registro", "aditivo"]);

async function buscarNoDou(termo: string): Promise<ItemDou[]> {
  // Janela de uma SEMANA com dedupe por urlTitle: um dia de cron fora do ar
  // não perde publicação — a varredura seguinte recolhe o atrasado.
  const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(`"${termo}"`)}&s=todos&exactDate=semana&sortType=0&delta=20`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PraefectusMonitor/1.0)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const m = html.match(/type="application\/json">\s*(\{"jsonArray".*?\})\s*<\/script>/s);
  if (!m) return [];
  try {
    return (JSON.parse(m[1]).jsonArray ?? []) as ItemDou[];
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Cron-only: a varredura roda pelo relógio, não por clique.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!cronSecret || token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: prefs } = await supabase
      .from("preferencias_alertas")
      .select("*")
      .eq("ativo", true);

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No active preferences", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // A varredura leva minutos (N termos × 2 fontes); o pg_net do cron espera
    // segundos. Responde JÁ e trabalha em background — waitUntil segura a
    // instância viva até o fim, e o resultado fica nos logs da função.
    const trabalho = varrer(supabase, prefs).then(
      (r) => console.log("monitorar-dou concluído:", JSON.stringify(r)),
      (e) => console.error("monitorar-dou falhou:", e),
    );
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(trabalho);

    return new Response(
      JSON.stringify({ started: true, prefs: prefs.length }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// deno-lint-ignore no-explicit-any
async function varrer(supabase: any, prefs: any[]) {
  {

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const publishedSince = ontem.toISOString().split("T")[0];
    const publishedUntil = hoje.toISOString().split("T")[0];

    let totalProcessed = 0;
    let totalAlertas = 0;
    const erros: string[] = [];

    // Termos por usuário: preferência declarada + TODAS as empresas dele
    // (CNPJ formatado como sai impresso, razão social e fantasia).
    const searchTerms: { userId: string; termo: string }[] = [];
    const visto = new Set<string>();
    const add = (userId: string, termo?: string | null) => {
      const t = (termo || "").trim();
      if (t.length < 6) return;
      const k = `${userId}|${t.toLowerCase()}`;
      if (visto.has(k)) return;
      visto.add(k);
      searchTerms.push({ userId, termo: t });
    };

    for (const pref of prefs) {
      const cnpjPref = (pref.cnpj || "").replace(/\D/g, "");
      if (cnpjPref.length === 14) add(pref.user_id, formatarCnpj(cnpjPref));
      add(pref.user_id, pref.razao_social);

      const { data: vinculos } = await supabase
        .from("empresa_membros")
        .select("empresa_id")
        .eq("user_id", pref.user_id);
      const empresaIds = [...new Set((vinculos ?? []).map((v: { empresa_id: string }) => v.empresa_id))];
      if (empresaIds.length) {
        const { data: empresas } = await supabase
          .from("empresas")
          .select("cnpj, razao_social, nome_fantasia")
          .in("id", empresaIds);
        for (const e of empresas ?? []) {
          const d = (e.cnpj || "").replace(/\D/g, "");
          if (d.length === 14) add(pref.user_id, formatarCnpj(d));
          add(pref.user_id, e.razao_social);
          if (e.nome_fantasia && e.nome_fantasia !== e.razao_social) add(pref.user_id, e.nome_fantasia);
        }
      }
    }

    const prefDe = (userId: string) => prefs.find((p) => p.user_id === userId);

    const registrarAlerta = async (opts: {
      userId: string; tipo: string; urgente: boolean; titulo: string; descricao: string;
      orgao: string | null; uf: string | null; url: string | null; fonte: string;
      idUnico: string; dataPub: string | null; cnpj?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("publicacoes_dou_processadas")
        .select("id").eq("identificador", opts.idUnico).maybeSingle();
      if (existing) return false;

      const pref = prefDe(opts.userId);
      if (!pref) return false;
      if (!TIPOS_SEMPRE.has(opts.tipo)) {
        if (opts.tipo === "alteracao" && !pref.receber_alteracoes) return false;
        if (opts.tipo === "suspensao" && !pref.receber_suspensoes) return false;
        if (opts.tipo === "cancelamento" && !pref.receber_cancelamentos) return false;
        if (opts.tipo === "homologacao" && !pref.receber_homologacoes) return false;
      }

      const processMatch = opts.descricao.toLowerCase()
        .match(/(?:pregão|pregao|processo|contrato)\s*(?:eletrônico|eletronico)?\s*(?:n[ºo°.]?\s*)?(\d+[\/\-]\d+)/i);

      await supabase.from("alertas_gerados").insert({
        user_id: opts.userId,
        tipo: opts.tipo,
        titulo: opts.titulo.slice(0, 200),
        descricao: opts.descricao.slice(0, 500),
        orgao: opts.orgao,
        uf: opts.uf,
        numero_processo: processMatch?.[1] || null,
        url_publicacao: opts.url,
        fonte: opts.fonte,
        urgente: opts.urgente,
      });
      await supabase.from("publicacoes_dou_processadas").insert({
        identificador: opts.idUnico,
        tipo_publicacao: opts.tipo,
        data_publicacao: opts.dataPub,
        orgao: opts.orgao,
        cnpj_mencionado: opts.cnpj ?? null,
        conteudo_resumo: opts.titulo.slice(0, 200),
      });
      totalAlertas++;
      return true;
    };

    for (const term of searchTerms) {
      // ── Fonte 1: DOU (in.gov.br) ─────────────────────────────────────
      try {
        const itens = await buscarNoDou(term.termo);
        for (const item of itens) {
          const titulo = limparHtml(item.title) || "Publicação no DOU";
          const trecho = limparHtml(item.content);
          const { tipo, urgente } = classificar(`${titulo} ${trecho} ${item.hierarchyStr || ""}`);
          const dataBr = (item.pubDate || "").split("/").reverse().join("-") || null;
          await registrarAlerta({
            userId: term.userId, tipo, urgente,
            titulo,
            descricao: `${item.hierarchyStr ? item.hierarchyStr + " — " : ""}${trecho}`,
            orgao: (item.hierarchyStr || "").split("/")[0] || null,
            uf: null,
            url: item.urlTitle ? `https://www.in.gov.br/web/dou/-/${item.urlTitle}` : null,
            fonte: "DOU",
            idUnico: `douin-${item.urlTitle}-${term.userId}`,
            dataPub: dataBr,
          });
          totalProcessed++;
        }
      } catch (err) {
        erros.push(`DOU ${term.termo}: ${err instanceof Error ? err.message : String(err)}`);
      }

      // ── Fonte 2: Querido Diário (diários municipais) ─────────────────
      try {
        const url = `https://queridodiario.ok.org.br/api/gazettes?querystring=${encodeURIComponent(`"${term.termo}"`)}&published_since=${publishedSince}&published_until=${publishedUntil}&size=20`;
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          const data = await res.json();
          for (const gazette of data?.gazettes ?? []) {
            const excerpts = (gazette.excerpts || []).join(" ");
            const { tipo, urgente } = classificar(excerpts);
            const titulo = limparHtml(excerpts.slice(0, 200)) || `Publicação no DO — ${gazette.territory_name || ""}`;
            await registrarAlerta({
              userId: term.userId, tipo, urgente,
              titulo,
              descricao: limparHtml(excerpts).slice(0, 500) || "Publicação encontrada no Diário Oficial",
              orgao: gazette.territory_name || null,
              uf: gazette.state_code || null,
              url: gazette.url || null,
              fonte: "DOE",
              idUnico: `dou-${gazette.territory_id}-${gazette.date}-${term.termo.slice(0, 14)}`,
              dataPub: gazette.date ?? null,
            });
            totalProcessed++;
          }
        }
      } catch (err) {
        // Querido Diário oscila — a varredura seguinte recupera.
        erros.push(`QD ${term.termo}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { processed: totalProcessed, alerts_created: totalAlertas, termos: searchTerms.length, erros };
  }
}
