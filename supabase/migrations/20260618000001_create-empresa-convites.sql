CREATE TABLE public.empresa_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  equipe text NOT NULL,
  papel text NOT NULL DEFAULT 'operador',
  email_setor text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by_email text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.empresa_convites ENABLE ROW LEVEL SECURITY;

-- Admin da empresa pode ver e criar convites
CREATE POLICY "admin pode gerenciar convites"
  ON public.empresa_convites
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- Qualquer um pode buscar um convite pelo token (para a página de aceite)
CREATE POLICY "convite publico por token"
  ON public.empresa_convites FOR SELECT
  USING (true);
