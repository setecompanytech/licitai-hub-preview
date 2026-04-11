
CREATE TABLE public.faturamento_mensal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ano_mes DATE NOT NULL,
  valor_faturamento NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ano_mes)
);

ALTER TABLE public.faturamento_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver faturamento da empresa"
  ON public.faturamento_mensal FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Membros podem inserir faturamento"
  ON public.faturamento_mensal FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id) AND auth.uid() = user_id);

CREATE POLICY "Membros podem atualizar faturamento"
  ON public.faturamento_mensal FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Membros podem deletar faturamento"
  ON public.faturamento_mensal FOR DELETE
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE TRIGGER update_faturamento_mensal_updated_at
  BEFORE UPDATE ON public.faturamento_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_faturamento_mensal_empresa ON public.faturamento_mensal(empresa_id, ano_mes);
