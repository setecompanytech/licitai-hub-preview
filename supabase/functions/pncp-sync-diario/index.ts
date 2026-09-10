// Sincronização diária PNCP — CADEIA COM CURSOR (redesenho de 10/09).
//
// Histórico dos desenhos, porque cada um morreu de um jeito:
//   1) fan-out de 9 workers em PARALELO: o PNCP apertou o rate limit (~26
//      requisições e começa o 429) e a rajada matava todos por teto de tempo
//      sem desfecho — 5 execuções seguidas presas em "em_andamento" (08-10/09).
//   2) cadeia de elos por UF com ritmo 1,2s: o primeiro elo colheu 0 páginas
//      em 123s — a cota esgota rápido e demora a repor; ritmo por si não basta.
//   3) ATUAL, o desenho da semeadura (que sobrevive ao regime): CURSOR
//      persistido (uf/modalidade/data/página) passado de elo em elo, ritmo de
//      2,5s por requisição, e RESPIRO de 30s no elo seguinte quando o 429
//      persiste — retoma exatamente de onde parou, nada é pulado.
//
// Modo "probe" mede o PNCP de dentro da edge sem gravar nada.
// O cron chama sem corpo (orquestrador); só a própria função invoca "worker".
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { autorizadoComoCron, respostaNaoAutorizado } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// Modalidades PNCP Lei 14.133/21
const MODALIDADES = [
  { id: 1, nome: "Leilão Eletrônico" },
  { id: 2, nome: "Diálogo Competitivo" },
  { id: 3, nome: "Concurso" },
  { id: 4, nome: "Concorrência Eletrônica" },
  { id: 5, nome: "Concorrência Presencial" },
  { id: 6, nome: "Pregão Eletrônico" },
  { id: 7, nome: "Pregão Presencial" },
  { id: 8, nome: "Dispensa de Licitação" },
  { id: 9, nome: "Inexigibilidade" },
  { id: 10, nome: "Manifestação de Interesse" },
  { id: 11, nome: "Pré-qualificação" },
  { id: 12, nome: "Credenciamento" },
  { id: 13, nome: "Leilão Presencial" },
];

const PAGE_SIZE = 50;
const MAX_PAGES_POR_BUSCA = 20;
const TIMEOUT_FETCH_MS = 20_000;
const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

// Ritmo e fôlego (10/09): a cota do PNCP esgota em ~26 requisições e repõe
// devagar. 2,5s entre requisições (~24/min) + respiro de 30s quando o 429
// persistir é o que atravessa o regime atual — a semeadura opera assim.
// Depois da rajada, o PNCP também TARPITA (pendura a conexão até o timeout):
// timeout recebe o mesmo tratamento do 429 — respirar e RETENTAR a mesma
// fatia no elo seguinte, até MAX_TENTATIVAS_FATIA antes de pulá-la.
const PAUSA_ENTRE_REQUESTS_MS = 2_500;
const RESPIRO_POS_429_MS = 30_000;
const MAX_TENTATIVAS_FATIA = 8;
// Orçamento de trabalho do elo: parar ANTES do teto da edge (~150s) garante
// desfecho na lápide. O respiro inicial (≤35s) soma-se a isso.
const ORCAMENTO_TRABALHO_MS = 95_000;
const MAX_ELOS = 120;

let tUltimaRequisicao = 0;
async function aguardarRitmo() {
  const espera = PAUSA_ENTRE_REQUESTS_MS - (Date.now() - tUltimaRequisicao);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  tUltimaRequisicao = Date.now();
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchComTimeout(url: string, timeoutMs = TIMEOUT_FETCH_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Praefectus-PNCP-Sync/3.0" },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Uma tentativa + um retry curto. 429 no retry NÃO é resolvido aqui: sobe
 *  como sinal para o elo encerrar e o próximo respirar 30s. */
async function fetchComRetry(url: string): Promise<Response> {
  let res = await fetchComTimeout(url);
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 3;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 8) * 1000));
    res = await fetchComTimeout(url);
  }
  return res;
}

// deno-lint-ignore no-explicit-any
function mapearRow(e: any, modalidade: { id: number; nome: string }, uf: string) {
  const numeroControle = e.numeroControlePNCP || null;
  const pncpId = numeroControle ||
    `${e.orgaoEntidade?.cnpj || ""}-${e.anoCompra || ""}-${e.sequencialCompra || ""}`;
  return {
    pncp_id: pncpId,
    fonte: "PNCP",
    fonte_id: numeroControle,
    numero_controle_pncp: numeroControle,
    cnpj_orgao: e.orgaoEntidade?.cnpj || null,
    ano_compra: e.anoCompra ? String(e.anoCompra) : null,
    sequencial_compra: e.sequencialCompra ? String(e.sequencialCompra) : null,
    numero_compra: e.numeroCompra || null,
    orgao: e.orgaoEntidade?.razaoSocial || null,
    unidade_orgao: e.unidadeOrgao?.nomeUnidade || null,
    codigo_unidade: e.unidadeOrgao?.codigoUnidade ? String(e.unidadeOrgao.codigoUnidade) : null,
    objeto: e.objetoCompra || null,
    modalidade_id: modalidade.id,
    modalidade_nome: e.modalidadeNome || modalidade.nome,
    situacao: e.situacaoCompraNome || null,
    valor_total_estimado: e.valorTotalEstimado || null,
    valor_total_homologado: e.valorTotalHomologado || null,
    uf: e.unidadeOrgao?.ufSigla || uf,
    municipio: e.unidadeOrgao?.municipioNome || null,
    municipio_ibge: e.unidadeOrgao?.codigoIbge ? String(e.unidadeOrgao.codigoIbge) : null,
    esfera_id: e.orgaoEntidade?.esferaId || null,
    data_publicacao_pncp: e.dataPublicacaoPncp || null,
    data_abertura_proposta: e.dataAberturaProposta || null,
    data_encerramento_proposta: e.dataEncerramentoProposta || null,
    link_sistema_origem: e.linkSistemaOrigem || null,
    url_pncp: numeroControle ? `https://pncp.gov.br/app/editais/${numeroControle}` : null,
    tipo_instrumento: e.tipoInstrumentoConvocatorioNome || null,
    srp: e.srp ?? null,
    // Citação curta ("Lei 14.133/2021, Art. 28, I"), como o painel do PNCP
    // exibe — a descricao é o texto didático longo.
    lei_base: e.amparoLegal?.nome || e.amparoLegal?.descricao || null,
  };
}

/** Posição na varredura: índices em UFS × MODALIDADES × datas + página. */
type Cursor = { uf: number; mod: number; dt: number; pag: number };

const cursorZero = (): Cursor => ({ uf: 0, mod: 0, dt: 0, pag: 1 });
const proximaFatia = (c: Cursor, totalDatas: number): Cursor | null => {
  const n = { ...c, pag: 1 };
  n.dt++;
  if (n.dt >= totalDatas) { n.dt = 0; n.mod++; }
  if (n.mod >= MODALIDADES.length) { n.mod = 0; n.uf++; }
  return n.uf >= UFS.length ? null : n;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Esta função não é chamada pelo app — só pelo cron e por ela mesma (a
  // cadeia de elos, com o service_role). Com `verify_jwt = false`, a
  // autorização é responsabilidade dela.
  if (!autorizadoComoCron(req)) return respostaNaoAutorizado(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const t0 = Date.now();

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch (_) { body = {}; }

  const modo = String(body.modo || "orquestrador");
  const diasParaTras = Math.max(0, Math.min(7, Number(body.dias_para_tras ?? 1)));

  // ────────── MODO PROBE (diagnóstico) ──────────
  // Mede o PNCP de DENTRO da edge, síncrono e sem gravar nada.
  if (modo === "probe") {
    const dataStr = fmtDate(new Date());
    const url = `${PNCP_BASE}?dataInicial=${dataStr}&dataFinal=${dataStr}&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=10`;
    const inicio = Date.now();
    try {
      const res = await fetchComTimeout(url, 25_000);
      const txt = await res.text();
      return new Response(JSON.stringify({
        probe: true, status: res.status, ms: Date.now() - inicio, bytes: txt.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({
        probe: true, erro: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        ms: Date.now() - inicio,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Cadeia antiga (payload com "ufs"): morreu no redesenho — encerra limpo.
  if (Array.isArray(body.ufs)) {
    return new Response(JSON.stringify({ status: "formato_antigo_encerrado" }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Janela de datas
  const hoje = new Date();
  const datas: Date[] = [];
  for (let i = diasParaTras; i >= 0; i--) {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() - i);
    datas.push(d);
  }
  const datasStr = datas.map((d) => d.toISOString().slice(0, 10));

  const dispararProximoElo = (payload: Record<string, unknown>): Promise<unknown> => {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pncp-sync-diario`;
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    }).then((r) => r.text()).catch((e) => console.warn(`Falha disparo elo: ${e.message}`));
  };
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;

  // ────────── MODO ORQUESTRADOR ──────────
  // Grava a lápide-mãe e dispara o elo 0 da cadeia. O desfecho da mãe é
  // gravado pelo ÚLTIMO elo.
  if (modo !== "worker") {
    const { data: logRow } = await supabase
      .from("pncp_sync_log")
      .insert({
        modo,
        status: "em_andamento",
        data_referencia: datasStr[datasStr.length - 1],
        detalhes: { datas: datasStr, ufs_total: UFS.length, desenho: "cadeia_cursor" },
      })
      .select("id")
      .single();

    const disparo = dispararProximoElo({
      modo: "worker",
      dias_para_tras: diasParaTras,
      cursor: cursorZero(),
      elo: 0,
      parent_log_id: logRow?.id,
      acumulado: { novos: 0, paginas: 0 },
    });
    if (runtime?.waitUntil) runtime.waitUntil(disparo);
    else await disparo;

    return new Response(
      JSON.stringify({
        status: "cadeia_iniciada", modo: "orquestrador",
        ufs_total: UFS.length, log_id: logRow?.id, datas: datasStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ────────── MODO WORKER (um elo da cadeia) ──────────
  const elo = Math.max(0, Number(body.elo) || 0);
  const parentLogId = body.parent_log_id || null;
  const esperarMs = Math.min(Math.max(0, Number(body.esperar_ms) || 0), 35_000);
  const acumulado = {
    novos: Number(body.acumulado?.novos) || 0,
    paginas: Number(body.acumulado?.paginas) || 0,
  };
  let cursor: Cursor = {
    uf: Math.min(Math.max(0, Number(body.cursor?.uf) || 0), UFS.length - 1),
    mod: Math.min(Math.max(0, Number(body.cursor?.mod) || 0), MODALIDADES.length - 1),
    dt: Math.min(Math.max(0, Number(body.cursor?.dt) || 0), datas.length - 1),
    pag: Math.max(1, Number(body.cursor?.pag) || 1),
  };

  // Respiro: o elo anterior levou 429 persistente — dá tempo à cota repor.
  if (esperarMs > 0) await new Promise((r) => setTimeout(r, esperarMs));

  // Lápide ANTES de processar: linha presa em "em_andamento" = "morri no meio".
  const { data: lapide } = await supabase.from("pncp_sync_log").insert({
    modo: `worker_elo_${elo}`,
    status: "em_andamento",
    data_referencia: datasStr[datasStr.length - 1],
    detalhes: { cursor, elo, parent_log_id: parentLogId },
  }).select("id").single();

  const prazoMs = t0 + esperarMs + ORCAMENTO_TRABALHO_MS;
  let novos = 0, paginas = 0;
  let motivoParada: "concluido" | "orcamento" | "rate_limit" = "concluido";
  let tentativasFatia = Math.max(0, Number(body.tentativas_fatia) || 0);
  const erros: string[] = [];

  laco:
  while (true) {
    const uf = UFS[cursor.uf];
    const modalidade = MODALIDADES[cursor.mod];
    const dataStr = fmtDate(datas[cursor.dt]);

    while (cursor.pag <= MAX_PAGES_POR_BUSCA) {
      if (Date.now() > prazoMs) { motivoParada = "orcamento"; break laco; }
      await aguardarRitmo();

      const url = `${PNCP_BASE}?dataInicial=${dataStr}&dataFinal=${dataStr}` +
        `&codigoModalidadeContratacao=${modalidade.id}&uf=${uf}&pagina=${cursor.pag}&tamanhoPagina=${PAGE_SIZE}`;

      // 429 e timeout (tarpit) recebem o mesmo remédio: parar o elo com o
      // cursor NESTA fatia e respirar — o elo seguinte retenta. Só depois de
      // MAX_TENTATIVAS_FATIA a fatia é pulada, para a cadeia nunca travar.
      let res: Response | null = null;
      let falhaDeRede: string | null = null;
      try {
        res = await fetchComRetry(url);
      } catch (e) {
        falhaDeRede = e instanceof Error ? e.message : String(e);
      }

      if (falhaDeRede !== null || res!.status === 429) {
        if (tentativasFatia + 1 >= MAX_TENTATIVAS_FATIA) {
          erros.push(`${uf}/m${modalidade.id}/${dataStr}/p${cursor.pag}: desisti após ${MAX_TENTATIVAS_FATIA} tentativas (${falhaDeRede ?? "HTTP 429"})`);
          tentativasFatia = 0;
          break; // pula para a próxima fatia
        }
        motivoParada = "rate_limit";
        break laco;
      }
      tentativasFatia = 0;
      paginas++;
      if (res!.status === 204 || res!.status === 404) break;
      if (!res!.ok) {
        erros.push(`${uf}/m${modalidade.id}/${dataStr}/p${cursor.pag}: HTTP ${res!.status}`);
        break;
      }

      const json = await res!.json().catch(() => null);
      // deno-lint-ignore no-explicit-any
      const items: any[] = json?.data || [];
      if (!items.length) break;

      const rows = items.map((e) => mapearRow(e, modalidade, uf));
      // Deduplica o batch por (fonte,fonte_id) — ON CONFLICT não pode atingir
      // a mesma linha duas vezes no mesmo statement.
      const dedupMap = new Map<string, ReturnType<typeof mapearRow>>();
      for (const r of rows) {
        if (!r.fonte_id) continue;
        dedupMap.set(`${r.fonte}::${r.fonte_id}`, r);
      }
      const batch = Array.from(dedupMap.values());

      if (batch.length > 0) {
        const { error: upErr } = await supabase
          .from("pncp_editais_cache")
          .upsert(batch, { onConflict: "fonte,fonte_id", ignoreDuplicates: false });
        if (upErr) {
          erros.push(`upsert ${uf}/m${modalidade.id} p${cursor.pag}: ${upErr.message} (batch=${batch.length})`);
          break;
        }
        novos += batch.length;
      }

      if (items.length < PAGE_SIZE) break;
      cursor.pag++;
    }

    const prox = proximaFatia(cursor, datas.length);
    if (!prox) { motivoParada = "concluido"; break; }
    cursor = prox;
  }

  const duracao = Date.now() - t0;
  const concluiu = motivoParada === "concluido";
  const totalNovos = acumulado.novos + novos;
  const totalPaginas = acumulado.paginas + paginas;

  const desfecho = {
    status: erros.length ? "parcial" : "sucesso",
    novos, total_registros: novos,
    paginas_consumidas: paginas,
    duracao_ms: duracao,
    concluido_em: new Date().toISOString(),
    detalhes: {
      elo, cursor, motivo_parada: motivoParada, parent_log_id: parentLogId,
      acumulado: { novos: totalNovos, paginas: totalPaginas },
      erros: erros.slice(0, 20),
    },
  };
  if (lapide?.id) {
    await supabase.from("pncp_sync_log").update(desfecho).eq("id", lapide.id);
  }

  if (concluiu || elo + 1 >= MAX_ELOS) {
    // Fim da cadeia: o último elo fecha a lápide-mãe do orquestrador.
    if (parentLogId) {
      await supabase.from("pncp_sync_log").update({
        status: concluiu ? "sucesso" : "parcial",
        novos: totalNovos,
        total_registros: totalNovos,
        paginas_consumidas: totalPaginas,
        concluido_em: new Date().toISOString(),
        duracao_ms: null,
        detalhes: {
          desenho: "cadeia_cursor", elos: elo + 1, datas: datasStr,
          motivo_final: concluiu ? "varredura completa" : `teto de ${MAX_ELOS} elos`,
        },
      }).eq("id", parentLogId);
    }
  } else {
    const proximo = dispararProximoElo({
      modo: "worker",
      dias_para_tras: diasParaTras,
      cursor,
      elo: elo + 1,
      parent_log_id: parentLogId,
      esperar_ms: motivoParada === "rate_limit" ? RESPIRO_POS_429_MS : 0,
      tentativas_fatia: motivoParada === "rate_limit" ? tentativasFatia + 1 : 0,
      acumulado: { novos: totalNovos, paginas: totalPaginas },
    });
    if (runtime?.waitUntil) runtime.waitUntil(proximo);
    else await proximo;
  }

  return new Response(
    JSON.stringify({
      status: "elo_ok", elo, motivo_parada: motivoParada, cursor,
      novos, paginas_consumidas: paginas, duracao_ms: duracao, erros: erros.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
