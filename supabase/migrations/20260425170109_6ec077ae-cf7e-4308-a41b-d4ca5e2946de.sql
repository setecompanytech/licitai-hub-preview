-- ════════════════════════════════════════════════════════════
-- SPRINT 4: MÓDULO DE FOLHA DE PAGAMENTO
-- ════════════════════════════════════════════════════════════

-- 1) FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS public.fin_folha_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID,
  nome TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  data_admissao DATE,
  data_demissao DATE,
  tipo_vinculo TEXT NOT NULL DEFAULT 'clt' CHECK (tipo_vinculo IN ('clt','pro_labore','autonomo','estagiario','terceirizado')),
  cargo TEXT,
  departamento TEXT,
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  carga_horaria_mensal NUMERIC(6,2) DEFAULT 220,
  num_dependentes INT DEFAULT 0,
  vale_transporte BOOLEAN DEFAULT false,
  vale_refeicao NUMERIC(14,2) DEFAULT 0,
  plano_saude NUMERIC(14,2) DEFAULT 0,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  pix TEXT,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_folha_func_user ON public.fin_folha_funcionarios(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_folha_func_ativo ON public.fin_folha_funcionarios(user_id, ativo);

ALTER TABLE public.fin_folha_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own funcionarios" ON public.fin_folha_funcionarios
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) RUBRICAS (catálogo de eventos)
CREATE TABLE IF NOT EXISTS public.fin_folha_rubricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('provento','desconto','informativo')),
  natureza TEXT,
  incide_inss BOOLEAN DEFAULT false,
  incide_irrf BOOLEAN DEFAULT false,
  incide_fgts BOOLEAN DEFAULT false,
  formula TEXT,
  valor_fixo NUMERIC(14,2),
  percentual NUMERIC(7,4),
  ativo BOOLEAN DEFAULT true,
  ordem INT DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_fin_folha_rubricas_user ON public.fin_folha_rubricas(user_id);

ALTER TABLE public.fin_folha_rubricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rubricas" ON public.fin_folha_rubricas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) COMPETÊNCIAS
CREATE TABLE IF NOT EXISTS public.fin_folha_competencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  competencia DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','calculada','fechada','paga','cancelada')),
  total_proventos NUMERIC(14,2) DEFAULT 0,
  total_descontos NUMERIC(14,2) DEFAULT 0,
  total_liquido NUMERIC(14,2) DEFAULT 0,
  total_encargos NUMERIC(14,2) DEFAULT 0,
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_fin_folha_comp_user ON public.fin_folha_competencias(user_id, competencia DESC);

ALTER TABLE public.fin_folha_competencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competencias" ON public.fin_folha_competencias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) HOLERITES
CREATE TABLE IF NOT EXISTS public.fin_folha_holerites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  competencia_id UUID NOT NULL REFERENCES public.fin_folha_competencias(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.fin_folha_funcionarios(id) ON DELETE CASCADE,
  total_proventos NUMERIC(14,2) DEFAULT 0,
  total_descontos NUMERIC(14,2) DEFAULT 0,
  total_liquido NUMERIC(14,2) DEFAULT 0,
  base_inss NUMERIC(14,2) DEFAULT 0,
  base_irrf NUMERIC(14,2) DEFAULT 0,
  base_fgts NUMERIC(14,2) DEFAULT 0,
  valor_inss NUMERIC(14,2) DEFAULT 0,
  valor_irrf NUMERIC(14,2) DEFAULT 0,
  valor_fgts NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'calculado' CHECK (status IN ('calculado','aprovado','pago','cancelado')),
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competencia_id, funcionario_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_folha_holerites_user ON public.fin_folha_holerites(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_folha_holerites_comp ON public.fin_folha_holerites(competencia_id);

ALTER TABLE public.fin_folha_holerites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own holerites" ON public.fin_folha_holerites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) ITENS DO HOLERITE
CREATE TABLE IF NOT EXISTS public.fin_folha_holerite_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  holerite_id UUID NOT NULL REFERENCES public.fin_folha_holerites(id) ON DELETE CASCADE,
  rubrica_id UUID REFERENCES public.fin_folha_rubricas(id),
  codigo TEXT,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('provento','desconto','informativo')),
  referencia TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  ordem INT DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_folha_itens_holerite ON public.fin_folha_holerite_itens(holerite_id);

ALTER TABLE public.fin_folha_holerite_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own holerite_itens" ON public.fin_folha_holerite_itens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6) ENCARGOS PATRONAIS POR COMPETÊNCIA
CREATE TABLE IF NOT EXISTS public.fin_folha_encargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  competencia_id UUID NOT NULL REFERENCES public.fin_folha_competencias(id) ON DELETE CASCADE,
  base_calculo NUMERIC(14,2) DEFAULT 0,
  inss_patronal NUMERIC(14,2) DEFAULT 0,
  rat NUMERIC(14,2) DEFAULT 0,
  terceiros NUMERIC(14,2) DEFAULT 0,
  fgts_patronal NUMERIC(14,2) DEFAULT 0,
  pis_folha NUMERIC(14,2) DEFAULT 0,
  total_encargos NUMERIC(14,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_folha_enc_user ON public.fin_folha_encargos(user_id);

ALTER TABLE public.fin_folha_encargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own encargos" ON public.fin_folha_encargos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7) TRIGGERS DE updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fin_folha_set_updated_at') THEN
    CREATE FUNCTION public.fin_folha_set_updated_at() RETURNS TRIGGER
    LANGUAGE plpgsql SET search_path = public AS $fn$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $fn$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_folha_func_upd') THEN
    CREATE TRIGGER trg_fin_folha_func_upd BEFORE UPDATE ON public.fin_folha_funcionarios
    FOR EACH ROW EXECUTE FUNCTION public.fin_folha_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_folha_rubr_upd') THEN
    CREATE TRIGGER trg_fin_folha_rubr_upd BEFORE UPDATE ON public.fin_folha_rubricas
    FOR EACH ROW EXECUTE FUNCTION public.fin_folha_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_folha_comp_upd') THEN
    CREATE TRIGGER trg_fin_folha_comp_upd BEFORE UPDATE ON public.fin_folha_competencias
    FOR EACH ROW EXECUTE FUNCTION public.fin_folha_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_folha_hol_upd') THEN
    CREATE TRIGGER trg_fin_folha_hol_upd BEFORE UPDATE ON public.fin_folha_holerites
    FOR EACH ROW EXECUTE FUNCTION public.fin_folha_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fin_folha_enc_upd') THEN
    CREATE TRIGGER trg_fin_folha_enc_upd BEFORE UPDATE ON public.fin_folha_encargos
    FOR EACH ROW EXECUTE FUNCTION public.fin_folha_set_updated_at();
  END IF;
END $$;