
-- Activity log for tracking collaborator actions
CREATE TABLE public.atividades_colaborador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  acao text NOT NULL,
  modulo text NOT NULL DEFAULT 'geral',
  descricao text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atividades_colaborador ENABLE ROW LEVEL SECURITY;

-- Members can view activity of their empresa
CREATE POLICY "Members can view empresa activities"
ON public.atividades_colaborador FOR SELECT TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id));

-- Users can insert their own activities
CREATE POLICY "Users can insert own activities"
ON public.atividades_colaborador FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND is_empresa_member(auth.uid(), empresa_id));

-- Admins can delete activities
CREATE POLICY "Admins can delete empresa activities"
ON public.atividades_colaborador FOR DELETE TO authenticated
USING (is_empresa_admin(auth.uid(), empresa_id));

-- Add equipe column to empresa_membros
ALTER TABLE public.empresa_membros 
ADD COLUMN IF NOT EXISTS equipe text DEFAULT 'geral',
ADD COLUMN IF NOT EXISTS nome text,
ADD COLUMN IF NOT EXISTS email text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_atividades_user ON public.atividades_colaborador(user_id);
CREATE INDEX IF NOT EXISTS idx_atividades_empresa ON public.atividades_colaborador(empresa_id);
CREATE INDEX IF NOT EXISTS idx_atividades_created ON public.atividades_colaborador(created_at DESC);
