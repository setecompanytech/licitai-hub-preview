
DO $$ BEGIN
  CREATE TYPE public.financeiro_origem_tipo AS ENUM (
    'manual','importacao_csv','importacao_ofx','importacao_xml','sefaz_nfe',
    'pluggy','cnab','dda','ocr','recorrencia','folha_pagamento','api','seed','demo','migracao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financeiro_origem_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  origem_tipo public.financeiro_origem_tipo NOT NULL,
  job text,
  descricao text,
  usuario_id uuid,
  total_registros integer DEFAULT 0,
  total_valor numeric(18,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_origem_lotes_empresa ON public.financeiro_origem_lotes(empresa_id, created_at DESC);
ALTER TABLE public.financeiro_origem_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros_select_lotes" ON public.financeiro_origem_lotes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.empresa_membros m WHERE m.empresa_id = financeiro_origem_lotes.empresa_id AND m.user_id = auth.uid())
);
CREATE POLICY "membros_insert_lotes" ON public.financeiro_origem_lotes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.empresa_membros m WHERE m.empresa_id = financeiro_origem_lotes.empresa_id AND m.user_id = auth.uid())
);
