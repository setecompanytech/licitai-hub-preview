
-- Table for drafts (rascunhos) of Proposta Comercial and Precificação
CREATE TABLE public.rascunhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  modulo text NOT NULL CHECK (modulo IN ('proposta', 'precificacao')),
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  titulo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one draft per user+module+licitacao
CREATE UNIQUE INDEX rascunhos_user_modulo_licitacao_idx 
  ON public.rascunhos (user_id, modulo, COALESCE(licitacao_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- RLS
ALTER TABLE public.rascunhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rascunhos"
  ON public.rascunhos FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_rascunhos_updated_at
  BEFORE UPDATE ON public.rascunhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
