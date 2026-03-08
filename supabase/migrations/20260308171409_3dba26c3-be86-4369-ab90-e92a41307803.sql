
-- Tabela de índices econômicos (IPCA, INPC, IGP-M, SINAPI, CUB, etc.)
CREATE TABLE public.indices_economicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  sigla text NOT NULL,
  fonte text NOT NULL DEFAULT 'IBGE',
  periodo text NOT NULL,
  valor numeric NOT NULL,
  variacao_mensal numeric,
  variacao_anual numeric,
  acumulado_12m numeric,
  categoria text NOT NULL DEFAULT 'inflacao',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.indices_economicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view indices" ON public.indices_economicos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only service role can insert indices" ON public.indices_economicos
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update indices" ON public.indices_economicos
  FOR UPDATE USING (false);

CREATE POLICY "Only service role can delete indices" ON public.indices_economicos
  FOR DELETE USING (false);

-- Tabela de Convenções Coletivas de Trabalho
CREATE TABLE public.convencoes_coletivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  categoria_profissional text NOT NULL,
  sindicato_laboral text,
  sindicato_patronal text,
  numero_registro_mte text,
  vigencia_inicio date,
  vigencia_fim date,
  piso_salarial numeric,
  reajuste_percentual numeric,
  indice_reajuste text DEFAULT 'INPC',
  beneficios jsonb DEFAULT '[]'::jsonb,
  abrangencia_uf text,
  abrangencia_municipios text[],
  observacoes text,
  arquivo_path text,
  status text DEFAULT 'vigente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.convencoes_coletivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own CCTs" ON public.convencoes_coletivas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de simulações de repactuação
CREATE TABLE public.simulacoes_repactuacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  licitacao_id uuid REFERENCES public.licitacoes(id),
  titulo text NOT NULL,
  valor_original numeric NOT NULL DEFAULT 0,
  valor_reajustado numeric,
  indice_aplicado text NOT NULL DEFAULT 'IPCA',
  percentual_reajuste numeric,
  data_base_original date,
  data_base_reajuste date,
  fundamentacao text,
  parecer_ia text,
  tipo_servico text DEFAULT 'continuado',
  categoria text DEFAULT 'mao_de_obra',
  status text DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.simulacoes_repactuacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own simulacoes" ON public.simulacoes_repactuacao
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
