-- Fase 1B: Enriquecer financeiro_lancamentos com parcelamento e vendedor responsável

-- 1) Parcelamento
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS parcela_numero  smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_total   smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_pai_id  uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL;

-- 2) Vendedor / responsável (referencia auth.users; manteremos sem FK rígida para evitar
--    bloqueio quando o usuário for removido — apenas para rastreio/atribuição)
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS vendedor_responsavel_id uuid;

-- 3) Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_fl_parcela_pai
  ON public.financeiro_lancamentos(parcela_pai_id) WHERE parcela_pai_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fl_vendedor
  ON public.financeiro_lancamentos(empresa_id, vendedor_responsavel_id)
  WHERE vendedor_responsavel_id IS NOT NULL;

COMMENT ON COLUMN public.financeiro_lancamentos.parcela_numero IS 'Número da parcela (1..parcela_total) — alinhado layout OMIE';
COMMENT ON COLUMN public.financeiro_lancamentos.parcela_total  IS 'Quantidade total de parcelas geradas (1 = à vista)';
COMMENT ON COLUMN public.financeiro_lancamentos.parcela_pai_id IS 'Aponta para a 1ª parcela quando a série foi gerada em lote';
COMMENT ON COLUMN public.financeiro_lancamentos.vendedor_responsavel_id IS 'Colaborador responsável pelo lançamento (vendedor / gestor da conta) — alinhado OMIE';