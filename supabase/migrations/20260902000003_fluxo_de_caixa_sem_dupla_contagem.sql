-- ═══════════════════════════════════════════════════════════════════════════
-- Fluxo de caixa sem dupla contagem
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A8 da auditoria: "entradas_previstas" na view era o TOTAL de a_receber do
-- dia — sem filtro de status —, do qual "entradas_realizadas" é subconjunto.
-- Os consumidores somam os dois: um único título de R$ 10.000 já conciliado
-- aparecia como R$ 20.000 de entrada no gráfico. Cancelado também entrava.
--
-- Agora previsto e realizado são conjuntos DISJUNTOS: a soma volta a ser a
-- verdade do dia, e cancelado não existe para o fluxo.

DROP MATERIALIZED VIEW IF EXISTS public.mv_financeiro_fluxo_caixa;

CREATE MATERIALIZED VIEW public.mv_financeiro_fluxo_caixa AS
SELECT
  empresa_id,
  data_vencimento AS data,
  SUM(CASE WHEN tipo='a_receber' AND status IN ('previsto','em_atraso') THEN valor ELSE 0 END) AS entradas_previstas,
  SUM(CASE WHEN tipo='a_pagar'   AND status IN ('previsto','em_atraso') THEN valor ELSE 0 END) AS saidas_previstas,
  SUM(CASE WHEN tipo='a_receber' AND status IN ('realizado','conciliado') THEN valor ELSE 0 END) AS entradas_realizadas,
  SUM(CASE WHEN tipo='a_pagar'   AND status IN ('realizado','conciliado') THEN valor ELSE 0 END) AS saidas_realizadas
FROM public.financeiro_lancamentos
WHERE data_vencimento IS NOT NULL
GROUP BY empresa_id, data_vencimento;

CREATE UNIQUE INDEX idx_mv_fluxo ON public.mv_financeiro_fluxo_caixa(empresa_id, data);

REFRESH MATERIALIZED VIEW public.mv_financeiro_fluxo_caixa;
