-- ═══════════════════════════════════════════════════════════════════════════
-- Comentários de coluna sem o nome de ERP de terceiro
-- Data: 2026-09-19
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Decisão do dono (19/09): o nome de um ERP concorrente não aparece em
-- nenhuma nomeação do Praefectus. O código e as telas já não o trazem; no
-- banco restavam dois comentários de coluna gravados pela migration
-- 20260426210401. Conferido antes de escrever: nenhuma LINHA guarda o nome
-- (`pedidos.origem_pedido` e `financeiro_lancamentos.origem` têm zero
-- ocorrências), então não há dado a regravar — só metadado.
--
-- Idempotente: COMMENT ON sobrescreve. REVERSÃO: repor o texto anterior.

COMMENT ON COLUMN public.financeiro_lancamentos.parcela_numero IS
  'Número da parcela (1..parcela_total), no mesmo layout das planilhas de importação';
COMMENT ON COLUMN public.financeiro_lancamentos.vendedor_responsavel_id IS
  'Colaborador responsável pelo lançamento (vendedor / gestor da conta)';
