-- =============================================================================
-- Meta medida sobre NF-e quitada
--
-- O ciclo comercial tem três marcos de dinheiro, e eles não coincidem:
--   contrato assinado  → compromisso
--   pedido faturado    → nota emitida
--   NF-e quitada       → dinheiro em caixa
--
-- As metas só ofereciam os dois primeiros. Faltava justamente o que o
-- financeiro persegue — e a bonificação já sabia distinguir os três desde
-- 20260817000001, então meta e bonificação falavam vocabulários diferentes.
--
-- O realizado não precisa de coluna nova: vw_comercial_realizado_mensal já
-- expõe `valor_quitado` (contrato_pedidos.nf_quitada = true, agrupado por
-- data_quitacao). O que faltava era o CHECK aceitar a terceira opção.
--
-- O CHECK continua fechado de propósito: base inválida tem de ser recusada na
-- gravação, não virar comparação silenciosa contra a base errada.
-- =============================================================================

ALTER TABLE public.comercial_metas
  DROP CONSTRAINT IF EXISTS comercial_metas_base_meta_check;

ALTER TABLE public.comercial_metas
  ADD CONSTRAINT comercial_metas_base_meta_check
  CHECK (base_meta IN ('faturamento', 'nf_quitada', 'contratos_ganhos'));

COMMENT ON COLUMN public.comercial_metas.base_meta IS
  'Marco do ciclo comercial contra o qual a meta é comparada: contratos_ganhos '
  '(valor assinado), faturamento (nota emitida) ou nf_quitada (valor recebido). '
  'Espelho no front: BASES_META em src/lib/metas/painel.ts.';
