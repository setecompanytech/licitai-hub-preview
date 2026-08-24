-- =============================================================================
-- O diário passa a fotografar DEPOIS do recálculo
--
-- A auditoria registrava "Total consumido: R$ 0 (0.00%)" no instante em que um
-- contrato derivado de R$ 2,1 milhões acabava de entrar. Não era conta errada:
-- era ORDEM. Gatilhos do mesmo evento disparam em ordem alfabética, e
-- trg_log_... vem antes de trg_recalc_... — o diário lia o valor de antes do
-- recálculo existir.
--
-- Renomear é o conserto inteiro: com o prefixo trg_zlog_, o diário passa a
-- disparar por último e fotografa o estado que o recálculo deixou.
-- =============================================================================

ALTER TRIGGER trg_log_recalc_consumo_ata_pai_iu ON public.contratos
  RENAME TO trg_zlog_recalc_consumo_ata_pai_iu;

ALTER TRIGGER trg_log_recalc_consumo_ata_pai_del ON public.contratos
  RENAME TO trg_zlog_recalc_consumo_ata_pai_del;

ALTER TRIGGER trg_log_recalc_saldo_ata_item ON public.contrato_itens
  RENAME TO trg_zlog_recalc_saldo_ata_item;
