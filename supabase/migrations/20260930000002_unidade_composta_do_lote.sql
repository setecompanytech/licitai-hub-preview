-- ============================================================================
-- Unidade composta do lote: a cesta básica que a nota entrega
-- ============================================================================
--
-- 30/09/2026. O 772/2024 (Barcarena) é uma cesta básica de 18 itens: a
-- licitação somou os 18 preços unitários para chegar ao preço da CESTA, e a
-- NF-e traz os 18 produtos. O lote de pedidos (uma parte por item) passa a
-- saber quantas cestas entregou, para Gestão de Contratos calcular preço
-- faturado, custo e margem POR CESTA — a unidade que o órgão compra.
-- Gravado pela Extração de Documentos (vínculo com o contrato) em todas as
-- partes do mesmo lote; nulo = lote sem unidade composta.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS unidade_composta text,
  ADD COLUMN IF NOT EXISTS unidades_compostas numeric;

ALTER TABLE public.contrato_pedidos
  DROP CONSTRAINT IF EXISTS contrato_pedidos_unidades_compostas_positivas;
ALTER TABLE public.contrato_pedidos
  ADD CONSTRAINT contrato_pedidos_unidades_compostas_positivas
  CHECK (unidades_compostas IS NULL OR unidades_compostas > 0);

COMMENT ON COLUMN public.contrato_pedidos.unidade_composta IS
  'Nome da unidade composta que o lote entrega ("cesta básica", "kit escolar"). '
  'Igual em todas as partes do mesmo lote_id. Nulo = sem unidade composta.';
COMMENT ON COLUMN public.contrato_pedidos.unidades_compostas IS
  'Quantas unidades compostas (cestas) o lote entrega. Preço por cesta = valor '
  'do lote ÷ este número; custo por cesta = custo do lote ÷ este número.';

-- Conferência:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'contrato_pedidos' AND column_name IN ('unidade_composta','unidades_compostas');
