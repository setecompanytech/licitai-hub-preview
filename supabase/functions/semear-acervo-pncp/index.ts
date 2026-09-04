// ═══════════════════════════════════════════════════════════════════════════
// Semeadura do acervo — varre o PNCP oficial por UF/modalidade/janela e grava
// no pncp_editais_cache. Fatiada: cada invocação processa ~90 páginas dentro
// do teto de tempo; o cron da madrugada invoca em série; ao concluir todas as
// tarefas, a própria função desliga o cron (pncp_semeadura_finalizar).
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapRawParaCache } from "../_shared/pncp-cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PNCP = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const TETO_MS = 110_000;
const ESPACO_MS = 1_100; // regra operacional do portal: sem rajadas

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const inicio = Date.now();
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: tarefa, error: erroTarefa } = await db
      .from("pncp_semeadura_progresso")
      .select("*")
      .eq("concluido", false)
      .order("id")
      .limit(1)
      .maybeSingle();

    // Erro de consulta NÃO é "tudo concluído": sem esta distinção, a tabela
    // ausente (migration não colada) viraria falso "Semeadura concluída".
    if (erroTarefa) {
      return json({ ok: false, erro: `Progresso inacessível (${erroTarefa.message}) — a migration 20260903000004 foi colada?` }, 500);
    }

    if (!tarefa) {
      const { data: desligou } = await db.rpc("pncp_semeadura_finalizar");
      return json({ ok: true, mensagem: "Semeadura concluída.", cron_desligado: desligou === true });
    }

    let pagina = Number(tarefa.pagina_atual) || 1;
    let gravados = 0;
    let totalPaginas: number | null = tarefa.total_paginas;
    let paginasNestaFatia = 0;

    while (Date.now() - inicio < TETO_MS) {
      const p = new URLSearchParams({
        uf: tarefa.uf,
        codigoModalidadeContratacao: String(tarefa.modalidade_id),
        dataInicial: String(tarefa.data_inicial).replace(/-/g, ""),
        dataFinal: String(tarefa.data_final).replace(/-/g, ""),
        pagina: String(pagina),
        tamanhoPagina: "50",
      });
      let resp = await fetch(`${PNCP}?${p}`, {
        headers: { Accept: "application/json", "User-Agent": "Praefectus/1.0 (licitacoes@praefectus.com.br)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (resp.status === 429) {
        await new Promise((r) => setTimeout(r, 2_000));
        resp = await fetch(`${PNCP}?${p}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        });
      }
      // 204/404 = janela sem registros; qualquer outro erro interrompe a
      // fatia SEM marcar concluído — a próxima invocação retoma daqui.
      if (resp.status === 204 || resp.status === 404) { totalPaginas = 0; break; }
      if (!resp.ok) {
        await db.from("pncp_semeadura_progresso")
          .update({ pagina_atual: pagina, registros_gravados: (tarefa.registros_gravados || 0) + gravados, atualizado_em: new Date().toISOString() })
          .eq("id", tarefa.id);
        return json({ ok: false, tarefa: tarefa.id, pagina, erro: `PNCP HTTP ${resp.status}` }, 502);
      }
      const corpo = await resp.json();
      const itens: Record<string, unknown>[] = corpo?.data || [];
      totalPaginas = Number(corpo?.totalPaginas) || totalPaginas || 1;

      if (itens.length > 0) {
        const linhas = itens.map(mapRawParaCache).filter(Boolean) as Record<string, unknown>[];
        const dedup = new Map<string, Record<string, unknown>>();
        for (const l of linhas) dedup.set(String(l.fonte_id), l);
        const { error } = await db.from("pncp_editais_cache").upsert([...dedup.values()], { ignoreDuplicates: true });
        if (!error) gravados += dedup.size;
        else console.warn("[semeadura] upsert:", error.message);
      }

      paginasNestaFatia++;
      pagina++;
      if (itens.length === 0 || (totalPaginas !== null && pagina > totalPaginas)) break;
      await new Promise((r) => setTimeout(r, ESPACO_MS));
    }

    const terminouTarefa = totalPaginas !== null && (pagina > totalPaginas || totalPaginas === 0);
    await db.from("pncp_semeadura_progresso")
      .update({
        pagina_atual: pagina,
        total_paginas: totalPaginas,
        registros_gravados: (tarefa.registros_gravados || 0) + gravados,
        concluido: terminouTarefa,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", tarefa.id);

    return json({
      ok: true,
      tarefa: { id: tarefa.id, modalidade: tarefa.modalidade_id, janela: tarefa.data_inicial },
      paginas_processadas: paginasNestaFatia,
      gravados,
      tarefa_concluida: terminouTarefa,
    });
  } catch (e) {
    return json({ ok: false, erro: (e as Error)?.message || "erro interno" }, 500);
  }
});
