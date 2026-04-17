CREATE TABLE IF NOT EXISTS public.processos_ingest_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  licitacao_id uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  fonte text,
  status text NOT NULL DEFAULT 'pending',
  etapa text,
  total_itens integer DEFAULT 0,
  arquivos_baixados jsonb DEFAULT '[]'::jsonb,
  mensagem text,
  erro text,
  iniciado_em timestamptz DEFAULT now(),
  finalizado_em timestamptz,
  UNIQUE (licitacao_id)
);

ALTER TABLE public.processos_ingest_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingest_select_own" ON public.processos_ingest_status;
CREATE POLICY "ingest_select_own" ON public.processos_ingest_status FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ingest_insert_own" ON public.processos_ingest_status;
CREATE POLICY "ingest_insert_own" ON public.processos_ingest_status FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ingest_update_own" ON public.processos_ingest_status;
CREATE POLICY "ingest_update_own" ON public.processos_ingest_status FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ingest_delete_own" ON public.processos_ingest_status;
CREATE POLICY "ingest_delete_own" ON public.processos_ingest_status FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ingest_user_lic ON public.processos_ingest_status(user_id, licitacao_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.processos_ingest_status;