// Sincronização diária PNCP — arquitetura de orquestração paralela
// Divide o trabalho em chunks de UFs e dispara invocações paralelas (fire-and-forget).
// Modo "orquestrador": fan-out 6 invocações × ~5 UFs cada (cabe em 150s cada).
// Modo "worker": processa um grupo de UFs.
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
// 20s/1 retry: com 45s×3 tentativas, UMA modalidade travada consumia 135s do
// teto de ~150s da edge function e o worker morria por 504 sem processar nada
// (diagnosticado em 2026-08-14: 5×504 aos 150s exatos, zero upserts).
const TIMEOUT_FETCH_MS = 20_000;
const MAX_RETRIES = 1;
const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchComTimeout(url: string, timeoutMs = TIMEOUT_FETCH_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Praefectus-PNCP-Sync/2.0" },
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchComRetry(url: string): Promise<Response> {
  let ultimoErro: any = null;
  for (let tentativa = 0; tentativa <= MAX_RETRIES; tentativa++) {
    try {
      const res = await fetchComTimeout(url);
      // 429 = rate limit do PNCP. Antes era tratado como resposta final e a
      // modalidade inteira era pulada — na primeira execução pós-correção,
      // TODOS os 9 workers terminaram "parcial" por 429 em rajada. Espera o
      // Retry-After (ou 2s) e tenta de novo; o teto tem folga de sobra (7s
      // usados de 150s).
      if (res.status === 429 && tentativa < MAX_RETRIES + 1) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 2;
        await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
        const res2 = await fetchComTimeout(url);
        return res2;
      }
      return res;
    } catch (e: any) {
      ultimoErro = e;
      if (tentativa < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (tentativa + 1))); // 1s, 2s
      }
    }
  }
  throw ultimoErro ?? new Error("fetch falhou sem motivo");
}

// Ritmo entre páginas: 78 páginas em 4-7s era rajada — o PNCP cortava com 429.
// 300ms de pausa ≈ 25s por worker, ainda 6× abaixo do teto, e educado com a API.
const PAUSA_ENTRE_PAGINAS_MS = 300;

async function processarUf(
  supabase: any,
  uf: string,
  datas: Date[],
  errosLocal: string[],
): Promise<{ novos: number; paginas: number; total: number }> {
  let novos = 0, paginas = 0, total = 0;

  for (const modalidade of MODALIDADES) {
    for (const data of datas) {
      const dataStr = fmtDate(data);
      let pagina = 1;

      while (pagina <= MAX_PAGES_POR_BUSCA) {
        const url = `${PNCP_BASE}?dataInicial=${dataStr}&dataFinal=${dataStr}` +
          `&codigoModalidadeContratacao=${modalidade.id}&uf=${uf}&pagina=${pagina}&tamanhoPagina=${PAGE_SIZE}`;

        let res: Response;
        try {
          res = await fetchComRetry(url);
        } catch (e: any) {
          errosLocal.push(`${uf}/m${modalidade.id}/${dataStr}/p${pagina}: ${e.message}`);
          // não aborta toda a UF — pula para próxima modalidade/dia
          break;
        }

        paginas++;
        if (res.status === 204 || res.status === 404) break;
        if (!res.ok) {
          errosLocal.push(`${uf}/m${modalidade.id}/${dataStr}/p${pagina}: HTTP ${res.status}`);
          break;
        }

        const json = await res.json().catch(() => null);
        const items: any[] = json?.data || [];
        if (!items.length) break;

        const rows = items.map((e) => {
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
            lei_base: e.amparoLegal?.descricao || null,
          };
        });

        // Deduplica o batch por (fonte,fonte_id) — ON CONFLICT não pode atingir
        // a mesma linha duas vezes no mesmo statement.
        const dedupMap = new Map<string, typeof rows[number]>();
        for (const r of rows) {
          if (!r.fonte_id) continue; // sem chave estável, descarta para evitar conflito vazio
          const k = `${r.fonte}::${r.fonte_id}`;
          dedupMap.set(k, r); // mantém o último (mais novo na ordem da página)
        }
        const batch = Array.from(dedupMap.values());

        if (batch.length === 0) {
          if (items.length < PAGE_SIZE) break;
          pagina++;
          continue;
        }

        const { error: upErr } = await supabase
          .from("pncp_editais_cache")
          .upsert(batch, { onConflict: "fonte,fonte_id", ignoreDuplicates: false });

        if (upErr) {
          errosLocal.push(`upsert ${uf}/m${modalidade.id} p${pagina}: ${upErr.message} (batch=${batch.length})`);
          console.error(`[pncp-sync-diario] upsert falhou ${uf}/m${modalidade.id} p${pagina}:`, upErr);
          break;
        }

        total += batch.length;
        novos += batch.length;
        if (items.length < PAGE_SIZE) break;
        pagina++;
        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_PAGINAS_MS));
      }
    }
  }
  return { novos, paginas, total };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Esta função não é chamada pelo app — só pelo cron e por ela mesma (fan-out
  // dos workers, com o service_role). Com `verify_jwt = false` no config.toml,
  // a autorização passou a ser responsabilidade dela.
  if (!autorizadoComoCron(req)) return respostaNaoAutorizado(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const t0 = Date.now();

  let body: any = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch (_) { body = {}; }

  const modo = String(body.modo || "orquestrador");
  const diasParaTras = Math.max(0, Math.min(7, Number(body.dias_para_tras ?? 1)));

  // Janela
  const hoje = new Date();
  const datas: Date[] = [];
  for (let i = diasParaTras; i >= 0; i--) {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() - i);
    datas.push(d);
  }
  const datasStr = datas.map((d) => d.toISOString().slice(0, 10));

  // ────────── MODO ORQUESTRADOR ──────────
  // Divide UFs em 6 chunks e dispara invocações paralelas fire-and-forget
  if (modo !== "worker") {
    // 9×3 em vez de 6×5: metade do trabalho por worker, folga real no teto.
    const CHUNKS = 9;
    const chunks: string[][] = Array.from({ length: CHUNKS }, () => []);
    UFS.forEach((uf, i) => chunks[i % CHUNKS].push(uf));

    const { data: logRow } = await supabase
      .from("pncp_sync_log")
      .insert({
        modo,
        status: "em_andamento",
        data_referencia: datasStr[datasStr.length - 1],
        detalhes: { datas: datasStr, chunks: chunks.length, ufs_total: UFS.length },
      })
      .select("id")
      .single();

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pncp-sync-diario`;
    const authHeader = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

    // Fire-and-forget: dispara 6 workers em paralelo
    const triggers = chunks.map((ufs, idx) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          modo: "worker",
          dias_para_tras: diasParaTras,
          ufs,
          chunk_idx: idx,
          parent_log_id: logRow?.id,
        }),
      }).catch((e) => console.warn(`Falha disparo chunk ${idx}: ${e.message}`))
    );

    // Solta os workers DE VERDADE. O await allSettled anterior esperava a
    // RESPOSTA de cada worker (até 150s cada) — o orquestrador morria por 504
    // junto com eles. waitUntil mantém os fetches vivos após o response.
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (runtime?.waitUntil) {
      triggers.forEach((t) => runtime.waitUntil!(t));
    } else {
      await Promise.allSettled(triggers);
    }

    return new Response(
      JSON.stringify({
        status: "orquestracao_disparada",
        modo: "orquestrador",
        chunks: chunks.length,
        ufs_total: UFS.length,
        log_id: logRow?.id,
        datas: datasStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ────────── MODO WORKER ──────────
  const ufs: string[] = Array.isArray(body.ufs) ? body.ufs : [];
  const chunkIdx = Number(body.chunk_idx ?? 0);
  const parentLogId = body.parent_log_id || null;

  if (!ufs.length) {
    return new Response(JSON.stringify({ error: "worker sem ufs" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Lápide ANTES de processar: worker morto pelo teto de tempo deixava zero
  // rastro (o log só era gravado no fim). Linha presa em "em_andamento" agora
  // significa exatamente "morri no meio" — falha silenciosa vira visível.
  const { data: lapide } = await supabase.from("pncp_sync_log").insert({
    modo: `worker_chunk_${chunkIdx}`,
    status: "em_andamento",
    data_referencia: datasStr[datasStr.length - 1],
    detalhes: { ufs, chunk_idx: chunkIdx, parent_log_id: parentLogId },
  }).select("id").single();

  let novos = 0, paginas = 0, total = 0, ufsOk = 0;
  const erros: string[] = [];

  for (const uf of ufs) {
    try {
      const r = await processarUf(supabase, uf, datas, erros);
      novos += r.novos; paginas += r.paginas; total += r.total;
      ufsOk++;
    } catch (e: any) {
      erros.push(`${uf}: ${e.message}`);
    }
  }

  const duracao = Date.now() - t0;

  // Atualiza a lápide com o desfecho real
  const desfecho = {
    status: erros.length ? "parcial" : "sucesso",
    novos, total_registros: total,
    ufs_processadas_count: ufsOk,
    modalidades_processadas: MODALIDADES.length,
    paginas_consumidas: paginas,
    duracao_ms: duracao,
    concluido_em: new Date().toISOString(),
    detalhes: { ufs, chunk_idx: chunkIdx, parent_log_id: parentLogId, erros: erros.slice(0, 30) },
  };
  if (lapide?.id) {
    await supabase.from("pncp_sync_log").update(desfecho).eq("id", lapide.id);
  } else {
    await supabase.from("pncp_sync_log").insert({
      modo: `worker_chunk_${chunkIdx}`,
      data_referencia: datasStr[datasStr.length - 1],
      ...desfecho,
    });
  }

  return new Response(
    JSON.stringify({
      status: "worker_ok", chunk_idx: chunkIdx, ufs_processadas: ufsOk,
      novos, total_registros: total, paginas_consumidas: paginas, duracao_ms: duracao,
      erros: erros.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
