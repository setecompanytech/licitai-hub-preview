
CREATE TABLE public.processos_exclusao_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  processo_interesse_id UUID,
  processo_numero TEXT,
  processo_orgao TEXT,
  processo_objeto TEXT,
  empresa_id UUID,
  acao TEXT NOT NULL,
  motivo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processos_exclusao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exclusion logs"
ON public.processos_exclusao_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exclusion logs"
ON public.processos_exclusao_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_processos_exclusao_log_user ON public.processos_exclusao_log(user_id);
CREATE INDEX idx_processos_exclusao_log_acao ON public.processos_exclusao_log(acao);
