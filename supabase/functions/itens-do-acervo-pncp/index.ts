// ═══════════════════════════════════════════════════════════════════════════
// Itens do acervo PNCP — o preço UNITÁRIO por item, sob demanda (22/09/2026)
//
// A aba Preços de Análise de mercado resume o valor GLOBAL dos editais
// (`valor_total_estimado`, o processo inteiro). Esta função abre cada edital
// da busca item a item na API pública do PNCP, guarda os itens em
// `pncp_editais_itens` (um edital lido nunca é lido de novo) e devolve os
// que falam do objeto pesquisado, com o unitário ESTIMADO pelo órgão e o
// HOMOLOGADO ao vencedor, quando o PNCP registra o resultado.
//
// Regras operacionais do portal: lotes pequenos e espaçados, nunca rajada.
// Primeira leitura de 30 editais: ~10 s; depois, cache. O resultado do item
// é relido enquanto não houver homologação (uma vez por semana, no máximo).
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth-rate-limit.ts";
import {
  comResultado, ESPACO_ENTRE_CHAMADAS_MS, esperar, itemCasa, itensDaCompra, palavrasDoObjeto, resultadoDoItem,
  type CompraDoAcervo, type ItemDoAcervo,
} from "../_shared/pncp-itens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_EDITAIS = 30;
const LOTE = 4;
const MAX_RESULTADOS_POR_CHAMADA = 12;
const DIAS_PARA_RELER_RESULTADO = 7;

type Linha = ItemDoAcervo & { id?: number; coletado_em?: string; resultado_coletado_em?: string | null };

function compraDoCorpo(e: Record<string, unknown>): CompraDoAcervo {
  return {
    pncp_id: String(e.pncp_id ?? "").trim(),
    cnpj_orgao: String(e.cnpj_orgao ?? "").replace(/\D/g, ""),
    ano_compra: String(e.ano_compra ?? "").replace(/\D/g, "").slice(0, 4),
    sequencial_compra: String(e.sequencial_compra ?? "").trim(),
  };
}

const compraValida = (c: CompraDoAcervo) =>
  c.pncp_id.length > 0 && c.cnpj_orgao.length === 14 && c.ano_compra.length === 4 && /\d/.test(c.sequencial_compra);

/** A linha sem os campos internos da tabela. */
function paraResposta(l: Linha): ItemDoAcervo {
  const { id: _id, coletado_em: _c, resultado_coletado_em: _r, ...resto } = l;
  return resto;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    await requireAuth(req, { functionName: "itens-do-acervo-pncp", maxRequests: 30, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const objeto = String(body.objeto || "").trim();
    const palavras = palavrasDoObjeto(objeto);
    if (palavras.length === 0) {
      return json({ error: "Descreva o objeto com ao menos uma palavra de três letras." }, 400);
    }
    const editais: CompraDoAcervo[] = (Array.isArray(body.editais) ? body.editais : [])
      .filter((e: unknown) => !!e && typeof e === "object")
      .map((e: Record<string, unknown>) => compraDoCorpo(e))
      .filter(compraValida)
      .slice(0, MAX_EDITAIS);
    if (editais.length === 0) {
      return json({ error: "Informe os editais da busca (pncp_id, cnpj_orgao, ano_compra, sequencial_compra)." }, 400);
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ids = editais.map((e) => e.pncp_id);

    // 1. O cache: o que já foi lido desses editais.
    const { data: cache, error: erroCache } = await db.from("pncp_editais_itens").select("*").in("pncp_id", ids);
    if (erroCache) {
      // Sem a tabela (migration 20260922000003 por colar) não há como guardar; a tela diz o que falta.
      return json({ error: `Cache dos itens indisponível: ${erroCache.message}` }, 500);
    }
    const linhas: Linha[] = (cache ?? []) as Linha[];
    const jaLidos = new Set(linhas.map((l) => l.pncp_id));
    const faltam = editais.filter((e) => !jaLidos.has(e.pncp_id));
    const erros: string[] = [];

    // 2. Os que faltam, em lotes pequenos e espaçados.
    for (let i = 0; i < faltam.length; i += LOTE) {
      const lote = faltam.slice(i, i + LOTE);
      const lidos = await Promise.all(lote.map((c) => itensDaCompra(c, fetch)));
      const novos: ItemDoAcervo[] = [];
      lidos.forEach((r, k) => {
        if (r.erro) erros.push(`${lote[k].pncp_id}: ${r.erro}`);
        novos.push(...r.itens);
      });
      if (novos.length > 0) {
        const { error: erroUpsert } = await db.from("pncp_editais_itens").upsert(novos, { onConflict: "pncp_id,numero_item" });
        if (erroUpsert) erros.push(`gravação: ${erroUpsert.message}`);
        linhas.push(...novos);
      }
      if (i + LOTE < faltam.length) await esperar(ESPACO_ENTRE_CHAMADAS_MS);
    }

    // 3. Só os itens que falam do objeto.
    const casam = linhas.filter((l) => itemCasa(l.descricao, palavras));

    // 4. O resultado (homologado ao vencedor) dos que ainda não têm, com resultado no PNCP.
    const limite = Date.now() - DIAS_PARA_RELER_RESULTADO * 86_400_000;
    const pendentes = casam
      .filter((l) => l.tem_resultado && l.valor_unitario_homologado == null
        && (!l.resultado_coletado_em || new Date(l.resultado_coletado_em).getTime() < limite))
      .slice(0, MAX_RESULTADOS_POR_CHAMADA);
    for (const l of pendentes) {
      const compra = editais.find((e) => e.pncp_id === l.pncp_id)
        ?? { pncp_id: l.pncp_id, cnpj_orgao: l.cnpj_orgao, ano_compra: l.ano_compra, sequencial_compra: l.sequencial_compra };
      const res = await resultadoDoItem(compra, l.numero_item, fetch);
      const atualizado = comResultado(l, res);
      const agora = new Date().toISOString();
      const { error: erroUpd } = await db.from("pncp_editais_itens").update({
        valor_unitario_homologado: atualizado.valor_unitario_homologado,
        valor_total_homologado: atualizado.valor_total_homologado,
        quantidade_homologada: atualizado.quantidade_homologada,
        fornecedor: atualizado.fornecedor,
        cnpj_fornecedor: atualizado.cnpj_fornecedor,
        data_resultado: atualizado.data_resultado,
        resultado_coletado_em: agora,
      }).eq("pncp_id", l.pncp_id).eq("numero_item", l.numero_item);
      if (erroUpd) erros.push(`resultado ${l.pncp_id}/${l.numero_item}: ${erroUpd.message}`);
      Object.assign(l, atualizado, { resultado_coletado_em: agora });
      await esperar(ESPACO_ENTRE_CHAMADAS_MS);
    }

    // 5. Na ordem em que a busca trouxe os editais (relevância), item a item.
    const ordem = new Map(ids.map((id, i) => [id, i]));
    casam.sort((a, b) => ((ordem.get(a.pncp_id) ?? 0) - (ordem.get(b.pncp_id) ?? 0)) || (a.numero_item - b.numero_item));

    return json({
      success: true,
      objeto,
      palavras,
      itens: casam.map(paraResposta),
      total_itens: linhas.length,
      editais_recebidos: editais.length,
      editais_com_itens: new Set(linhas.map((l) => l.pncp_id)).size,
      buscados: faltam.length,
      cacheados: jaLidos.size,
      resultados_lidos: pendentes.length,
      erros,
      consultadoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[itens-do-acervo-pncp]", e);
    return json({ error: e instanceof Error ? e.message : "Erro ao ler os itens no PNCP" }, 500);
  }
});
