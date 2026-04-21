-- Adiciona campo tipo_estrutura para diferenciar contratos/atas por Itens ou Lotes
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS tipo_estrutura TEXT NOT NULL DEFAULT 'itens'
  CHECK (tipo_estrutura IN ('itens','lotes'));

COMMENT ON COLUMN public.contratos.tipo_estrutura IS 'Define se o documento (contrato/ata/aditivo) é organizado por Itens individuais ou Lotes (grupos de itens).';

-- Adiciona identificação de lote nos itens (para quando tipo_estrutura = 'lotes')
ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS numero_lote TEXT,
  ADD COLUMN IF NOT EXISTS descricao_lote TEXT;

COMMENT ON COLUMN public.contrato_itens.numero_lote IS 'Identificador do lote ao qual o item pertence (ex: 01, 02). Nulo quando o documento é organizado por itens individuais.';
COMMENT ON COLUMN public.contrato_itens.descricao_lote IS 'Descrição opcional do lote (ex: Materiais de Limpeza).';

CREATE INDEX IF NOT EXISTS idx_contrato_itens_numero_lote ON public.contrato_itens(contrato_id, numero_lote) WHERE numero_lote IS NOT NULL;