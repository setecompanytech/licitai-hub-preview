
-- 0) Coluna auxiliar (precisa existir antes da RPC)
ALTER TABLE public.financeiro_categorias
  ADD COLUMN IF NOT EXISTS tipo_servico text CHECK (tipo_servico IN ('comercio','servico','outro'));

-- 1) Configuração tributária da empresa
CREATE TABLE IF NOT EXISTS public.financeiro_config_tributaria (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  regime text NOT NULL DEFAULT 'simples' CHECK (regime IN ('simples','presumido','real')),
  anexo_simples smallint CHECK (anexo_simples BETWEEN 1 AND 5),
  presuncao_irpj_comercio numeric(5,2) DEFAULT 8.00,
  presuncao_irpj_servico numeric(5,2) DEFAULT 32.00,
  presuncao_csll_comercio numeric(5,2) DEFAULT 12.00,
  presuncao_csll_servico numeric(5,2) DEFAULT 32.00,
  aliquota_pis numeric(5,4) DEFAULT 0.65,
  aliquota_cofins numeric(5,4) DEFAULT 3.00,
  aliquota_pis_nc numeric(5,4) DEFAULT 1.65,
  aliquota_cofins_nc numeric(5,4) DEFAULT 7.60,
  aliquota_irpj numeric(5,4) DEFAULT 15.00,
  adicional_irpj numeric(5,4) DEFAULT 10.00,
  limite_adicional_irpj numeric(14,2) DEFAULT 20000.00,
  aliquota_csll numeric(5,4) DEFAULT 9.00,
  aliquota_iss numeric(5,4) DEFAULT 5.00,
  aliquota_icms numeric(5,4) DEFAULT 18.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_config_tributaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros veem config tributaria"
  ON public.financeiro_config_tributaria FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "admins gerenciam config tributaria"
  ON public.financeiro_config_tributaria FOR ALL
  USING (public.is_empresa_admin(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER trg_fin_config_trib_updated
  BEFORE UPDATE ON public.financeiro_config_tributaria
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

-- 2) Apurações mensais
CREATE TABLE IF NOT EXISTS public.financeiro_apuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  regime text NOT NULL CHECK (regime IN ('simples','presumido','real')),
  receita_bruta_comercio numeric(14,2) NOT NULL DEFAULT 0,
  receita_bruta_servico numeric(14,2) NOT NULL DEFAULT 0,
  receita_bruta_total numeric(14,2) NOT NULL DEFAULT 0,
  rbt12 numeric(14,2) DEFAULT 0,
  base_irpj numeric(14,2) DEFAULT 0,
  base_csll numeric(14,2) DEFAULT 0,
  base_pis_cofins numeric(14,2) DEFAULT 0,
  valor_simples numeric(14,2) DEFAULT 0,
  aliquota_efetiva_simples numeric(7,4) DEFAULT 0,
  valor_irpj numeric(14,2) DEFAULT 0,
  valor_adicional_irpj numeric(14,2) DEFAULT 0,
  valor_csll numeric(14,2) DEFAULT 0,
  valor_pis numeric(14,2) DEFAULT 0,
  valor_cofins numeric(14,2) DEFAULT 0,
  valor_iss numeric(14,2) DEFAULT 0,
  valor_icms numeric(14,2) DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  detalhes jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','apurado','pago')),
  pago_em date,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, competencia, regime)
);

CREATE INDEX IF NOT EXISTS idx_fin_apuracoes_empresa_comp
  ON public.financeiro_apuracoes(empresa_id, competencia DESC);

ALTER TABLE public.financeiro_apuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros veem apuracoes"
  ON public.financeiro_apuracoes FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "membros criam apuracoes"
  ON public.financeiro_apuracoes FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "membros atualizam apuracoes"
  ON public.financeiro_apuracoes FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id))
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "admins removem apuracoes"
  ON public.financeiro_apuracoes FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER trg_fin_apuracoes_updated
  BEFORE UPDATE ON public.financeiro_apuracoes
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

-- 3) RPC de receita por competência
CREATE OR REPLACE FUNCTION public.financeiro_receita_competencia(
  p_empresa_id uuid,
  p_competencia date
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH faixa AS (
    SELECT date_trunc('month', p_competencia)::date AS ini,
           (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date AS fim
  ),
  rec AS (
    SELECT
      COALESCE(SUM(l.valor) FILTER (WHERE c.tipo_servico = 'comercio'), 0)::numeric AS comercio,
      COALESCE(SUM(l.valor) FILTER (WHERE c.tipo_servico = 'servico'), 0)::numeric AS servico,
      COALESCE(SUM(l.valor), 0)::numeric AS total
    FROM public.financeiro_lancamentos l
    LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
    , faixa f
    WHERE l.empresa_id = p_empresa_id
      AND l.natureza = 'receita'
      AND l.status IN ('realizado','conciliado','previsto')
      AND l.data_competencia BETWEEN f.ini AND f.fim
  ),
  rbt12 AS (
    SELECT COALESCE(SUM(l.valor), 0)::numeric AS total
    FROM public.financeiro_lancamentos l
    WHERE l.empresa_id = p_empresa_id
      AND l.natureza = 'receita'
      AND l.status IN ('realizado','conciliado','previsto')
      AND l.data_competencia >= (date_trunc('month', p_competencia) - interval '12 months')::date
      AND l.data_competencia < date_trunc('month', p_competencia)::date
  )
  SELECT jsonb_build_object(
    'comercio', (SELECT comercio FROM rec),
    'servico', (SELECT servico FROM rec),
    'total', (SELECT total FROM rec),
    'rbt12', (SELECT total FROM rbt12)
  );
$$;
