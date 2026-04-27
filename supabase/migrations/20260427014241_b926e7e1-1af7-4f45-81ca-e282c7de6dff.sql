-- Tabela de rateio entre centros de custo
CREATE TABLE IF NOT EXISTS public.fin_lancamento_rateios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES public.fin_centros_custo(id) ON DELETE RESTRICT,
  percentual NUMERIC(6,3) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lancamento_id, centro_custo_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_rateios_lanc ON public.fin_lancamento_rateios(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_rateios_cc ON public.fin_lancamento_rateios(centro_custo_id);

-- Trigger de validação: soma <= 100%
CREATE OR REPLACE FUNCTION public.fin_validar_rateio_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentual), 0) INTO v_total
  FROM public.fin_lancamento_rateios
  WHERE lancamento_id = COALESCE(NEW.lancamento_id, OLD.lancamento_id)
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF TG_OP <> 'DELETE' THEN
    v_total := v_total + NEW.percentual;
  END IF;
  IF v_total > 100.001 THEN
    RAISE EXCEPTION 'Soma dos percentuais de rateio (%.3f%%) excede 100%%', v_total
      USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_validar_rateio_total ON public.fin_lancamento_rateios;
CREATE TRIGGER trg_fin_validar_rateio_total
BEFORE INSERT OR UPDATE OR DELETE ON public.fin_lancamento_rateios
FOR EACH ROW EXECUTE FUNCTION public.fin_validar_rateio_total();

-- RLS
ALTER TABLE public.fin_lancamento_rateios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros visualizam rateios da empresa"
ON public.fin_lancamento_rateios FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos l
    WHERE l.id = fin_lancamento_rateios.lancamento_id
      AND public.is_empresa_member(auth.uid(), l.empresa_id)
  )
);

CREATE POLICY "Membros criam rateios da empresa"
ON public.fin_lancamento_rateios FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos l
    WHERE l.id = fin_lancamento_rateios.lancamento_id
      AND public.is_empresa_member(auth.uid(), l.empresa_id)
  )
);

CREATE POLICY "Membros atualizam rateios da empresa"
ON public.fin_lancamento_rateios FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos l
    WHERE l.id = fin_lancamento_rateios.lancamento_id
      AND public.is_empresa_member(auth.uid(), l.empresa_id)
  )
);

CREATE POLICY "Membros excluem rateios da empresa"
ON public.fin_lancamento_rateios FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos l
    WHERE l.id = fin_lancamento_rateios.lancamento_id
      AND public.is_empresa_member(auth.uid(), l.empresa_id)
  )
);