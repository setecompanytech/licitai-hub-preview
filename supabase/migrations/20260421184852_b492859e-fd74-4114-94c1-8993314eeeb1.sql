CREATE TABLE public.contrato_ia_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  arquivo_id UUID REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  arquivo_nome TEXT,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  origem TEXT NOT NULL DEFAULT 'ia_extracao',
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_ia_auditoria_contrato ON public.contrato_ia_auditoria(contrato_id, created_at DESC);
CREATE INDEX idx_contrato_ia_auditoria_arquivo ON public.contrato_ia_auditoria(arquivo_id);

ALTER TABLE public.contrato_ia_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ia auditoria"
  ON public.contrato_ia_auditoria FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own ia auditoria"
  ON public.contrato_ia_auditoria FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);