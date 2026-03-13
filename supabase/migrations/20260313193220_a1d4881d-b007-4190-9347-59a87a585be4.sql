
CREATE TABLE public.manutencao_agendada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  data_inicio timestamp with time zone NOT NULL,
  data_fim timestamp with time zone NOT NULL,
  criado_por uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.manutencao_agendada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage maintenance" ON public.manutencao_agendada
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active maintenance" ON public.manutencao_agendada
  FOR SELECT TO public
  USING (ativo = true AND data_fim > now());
