// Sincronização diária do PNCP — estilo ComprasNet
// Roda 1x de madrugada (03h05 BRT) cobrindo todas UFs × modalidades do dia anterior
// e 1x ao meio-dia (12h05 BRT) para reforço intradiário.
// Idempotente via ON CONFLICT em pncp_editais_cache.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// Códigos PNCP oficiais — cobrem 100% das modalidades atuais da Lei 14.133/21
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
const MAX_PAGES_POR_BUSCA = 40; // teto de segurança: 2.000 editais por (UF, modalidade, dia)
const TIMEOUT_FETCH_MS = 25_000;

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchComTimeout(url: string, timeoutMs = TIMEOUT_FETCH_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Praefectus-PNCP-Sync/1.0" },
    });
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const t0 = Date.now();

  // Parâmetros (POST JSON opcional)
  let modo = "diario_madrugada";
  let diasParaTras = 1; // por padrão sincroniza dia anterior + hoje (cobre publicações tardias)
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.modo) modo = String(body.modo);
      if (body.dias_para_tras != null) diasParaTras = Math.max(0, Math.min(7, Number(body.dias_para_tras)));
    }
  } catch (_) { /* ignore */ }

  // Janela: dia anterior + hoje
  const hoje = new Date();
  const datas: Date[] = [];
  for (let i = diasParaTras; i >= 0; i--) {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() - i);
    datas.push(d);
  }

  // Cria registro de log "em_andamento"
  const { data: logRow } = await supabase
    .from("pncp_sync_log")
    .insert({
      modo,
      status: "em_andamento",
      data_referencia: datas[datas.length - 1].toISOString().slice(0, 10),
      detalhes: { datas: datas.map((d) => d.toISOString().slice(0, 10)) },
    })
    .select("id")
    .single();

  const logId = logRow?.id;

  let novos = 0;
  let atualizados = 0;
  let totalRegistros = 0;
  let paginas = 0;
  let ufsProcessadas = 0;
  const errosPorUf: Record<string, string[]> = {};

  try {
    for (const uf of UFS) {
      ufsProcessadas++;
      let modalidadesOk = 0;

      for (const modalidade of MODALIDADES) {
        for (const data of datas) {
          const dataStr = fmtDate(data);
          let pagina = 1;

          while (pagina <= MAX_PAGES_POR_BUSCA) {
            const url =
              `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao` +
              `?dataInicial=${dataStr}&dataFinal=${dataStr}` +
              `&codigoModalidadeContratacao=${modalidade.id}` +
              `&uf=${uf}&pagina=${pagina}&tamanhoPagina=${PAGE_SIZE}`;

            let res: Response;
            try {
              res = await fetchComTimeout(url);
            } catch (e: any) {
              (errosPorUf[uf] ||= []).push(`${modalidade.id}/${dataStr}/p${pagina}: ${e.message}`);
              break;
            }

            paginas++;

            if (res.status === 204 || res.status === 404) break;
            if (!res.ok) {
              (errosPorUf[uf] ||= []).push(`${modalidade.id}/${dataStr}/p${pagina}: HTTP ${res.status}`);
              break;
            }

            const json = await res.json().catch(() => null);
            const items: any[] = json?.data || [];
            if (!items.length) break;

            const rows = items.map((e) => {
              const numeroControle = e.numeroControlePNCP || null;
              const pncpId = numeroControle || `${e.orgaoEntidade?.cnpj || ""}-${e.anoCompra || ""}-${e.sequencialCompra || ""}`;
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

            const { error: upErr, count } = await supabase
              .from("pncp_editais_cache")
              .upsert(rows, { onConflict: "fonte,fonte_id", count: "exact", ignoreDuplicates: false });

            if (upErr) {
              (errosPorUf[uf] ||= []).push(`upsert ${modalidade.id}/${dataStr}/p${pagina}: ${upErr.message}`);
              break;
            }

            totalRegistros += rows.length;
            // Heurística: nesta janela tudo que entra é "novo ou atualizado"; somamos no agregado
            novos += rows.length;

            if (items.length < PAGE_SIZE) break;
            pagina++;
          }
        }
        modalidadesOk++;
      }

      // Pequeno respiro entre UFs para não sobrecarregar a API do PNCP
      await new Promise((r) => setTimeout(r, 150));
    }

    const status = Object.keys(errosPorUf).length > 0 ? "parcial" : "sucesso";
    const duracao = Date.now() - t0;

    if (logId) {
      await supabase
        .from("pncp_sync_log")
        .update({
          status,
          concluido_em: new Date().toISOString(),
          novos,
          atualizados,
          total_registros: totalRegistros,
          ufs_processadas: ufsProcessadas,
          modalidades_processadas: MODALIDADES.length,
          paginas_consumidas: paginas,
          duracao_ms: duracao,
          detalhes: { erros_por_uf: errosPorUf, datas: datas.map((d) => d.toISOString().slice(0, 10)) },
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        status, modo, novos, total_registros: totalRegistros,
        ufs_processadas: ufsProcessadas, paginas_consumidas: paginas,
        duracao_ms: duracao, erros_por_uf: errosPorUf,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    if (logId) {
      await supabase.from("pncp_sync_log").update({
        status: "erro",
        concluido_em: new Date().toISOString(),
        novos, atualizados, total_registros: totalRegistros,
        ufs_processadas: ufsProcessadas, paginas_consumidas: paginas,
        duracao_ms: Date.now() - t0,
        erro: e.message,
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
