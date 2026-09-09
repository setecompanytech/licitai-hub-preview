-- ============================================================================
-- Fase A — nfe_entradas absorve o fluxo do Compras
-- ============================================================================
--
-- O Compras lia e gravava na tabela legada nfe_recebidas, que NÃO tem
-- empresa_id — select e insert falhavam em produção desde a criação do
-- acervo novo (pendência registrada em 08/09). Em vez de remendar a legada,
-- o Compras passa a usar a canônica nfe_entradas (a mesma do webhook e da
-- importação do Financeiro): uma NF-e que chega por qualquer porta aparece
-- nas duas telas, e a entrada no estoque enxerga todas.
--
-- Colunas que o fluxo de compra precisa e a canônica não tinha:
ALTER TABLE public.nfe_entradas
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;
ALTER TABLE public.nfe_entradas
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;
ALTER TABLE public.nfe_entradas
  ADD COLUMN IF NOT EXISTS itens jsonb;

COMMENT ON COLUMN public.nfe_entradas.itens IS
  'Itens extraídos do XML/DANFE (NFeItemData[]) — cache de leitura; o XML é a fonte.';

NOTIFY pgrst, 'reload schema';
