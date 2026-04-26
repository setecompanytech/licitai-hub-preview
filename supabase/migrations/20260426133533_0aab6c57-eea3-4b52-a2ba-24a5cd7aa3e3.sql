
CREATE TABLE IF NOT EXISTS public.publicacoes_belem_processadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hash_conteudo TEXT NOT NULL UNIQUE,
  data_edicao DATE NOT NULL,
  numero_edicao TEXT,
  titulo TEXT,
  tipo TEXT,
  orgao TEXT,
  url_origem TEXT,
  alertas_gerados_count INTEGER NOT NULL DEFAULT 0,
  processado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_belem_data_edicao
  ON public.publicacoes_belem_processadas (data_edicao DESC);

CREATE INDEX IF NOT EXISTS idx_pub_belem_processado_em
  ON public.publicacoes_belem_processadas (processado_em DESC);

ALTER TABLE public.publicacoes_belem_processadas ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa (controle interno do sistema)
CREATE POLICY "Service role full access publicacoes_belem"
  ON public.publicacoes_belem_processadas
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
