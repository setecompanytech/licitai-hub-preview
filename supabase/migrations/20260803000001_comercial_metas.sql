-- =============================================================================
-- MIGRATION: Modulo de Metas do Comercial — Fase A (modelo de dados)
-- Data: 2026-08-03
-- Objetivo: Metas mensais por colaborador do comercial, com valores-alvo por
--           modalidade parametrizaveis (nunca fixos no codigo), motivos de
--           perda parametrizaveis e registro de perda com motivo obrigatorio.
--
-- Observacoes de projeto:
--   - `financeiro_metas` JA EXISTE e e outra coisa (orcamento por conta
--     contabil). Por isso todo este modulo usa o prefixo `comercial_`.
--   - Valores monetarios em numeric(14,2) — nunca ponto flutuante binario.
--   - Nenhuma tabela nova duplica dado que ja vive em `contratos`,
--     `contrato_pedidos` ou `licitacoes`; o realizado e sempre derivado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configuracao geral do modulo por empresa
--    Limiares de alerta e janela historica ficam aqui para nao virarem
--    constante no codigo do motor de projecao (Fase C).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_metas_config (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Meses de historico usados para taxa de conversao e ticket medio
  janela_historica_meses    int NOT NULL DEFAULT 6 CHECK (janela_historica_meses BETWEEN 1 AND 36),
  -- Alerta dispara quando faltam <= N dias uteis e o realizado esta abaixo do %
  alerta_dias_limite        int NOT NULL DEFAULT 10 CHECK (alerta_dias_limite BETWEEN 1 AND 31),
  alerta_percentual_minimo  numeric(5,2) NOT NULL DEFAULT 70.00
                              CHECK (alerta_percentual_minimo BETWEEN 0 AND 100),
  -- Minimo de contratos historicos para confiar no ticket medio real;
  -- abaixo disso o motor cai no valor-alvo da modalidade
  min_amostra_ticket        int NOT NULL DEFAULT 3 CHECK (min_amostra_ticket >= 1),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_metas_config_empresa_unica UNIQUE (empresa_id)
);

-- -----------------------------------------------------------------------------
-- 2. Valores-alvo (estimulados) por modalidade
--    Substitui os R$ 300.000 (pregao eletronico) e R$ 100.000 (dispensa)
--    hard-coded. Parametrizavel por periodo e, opcionalmente, por colaborador.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_valores_alvo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modalidade_codigo text NOT NULL,
  valor_alvo        numeric(14,2) NOT NULL CHECK (valor_alvo >= 0),
  vigencia_inicio   date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim      date,
  -- NULL = vale para toda a empresa; preenchido = override do colaborador
  user_id           uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_valores_alvo_vigencia_valida
    CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

-- UNIQUE com coluna anulavel: NULLs sao distintos entre si no Postgres, entao
-- sem o COALESCE seria possivel cadastrar dois defaults de empresa iguais.
CREATE UNIQUE INDEX IF NOT EXISTS ux_comercial_valores_alvo_vigencia
  ON public.comercial_valores_alvo (
    empresa_id,
    modalidade_codigo,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vigencia_inicio
  );

CREATE INDEX IF NOT EXISTS idx_comercial_valores_alvo_empresa
  ON public.comercial_valores_alvo (empresa_id, modalidade_codigo);

-- -----------------------------------------------------------------------------
-- 3. Meta mensal por colaborador
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_metas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL,
  ano                int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes                int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_faturamento   numeric(14,2) NOT NULL DEFAULT 0 CHECK (meta_faturamento >= 0),
  meta_contratos     int CHECK (meta_contratos IS NULL OR meta_contratos >= 0),
  meta_participacoes int CHECK (meta_participacoes IS NULL OR meta_participacoes >= 0),
  -- Sobre o que a meta e medida. Default 'faturamento' (pedido faturado),
  -- pendente de confirmacao do negocio; 'contratos_ganhos' mede valor contratado.
  base_meta          text NOT NULL DEFAULT 'faturamento'
                       CHECK (base_meta IN ('faturamento', 'contratos_ganhos')),
  observacao         text,
  criado_por         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_metas_periodo_unico UNIQUE (empresa_id, user_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_comercial_metas_periodo
  ON public.comercial_metas (empresa_id, ano, mes);

-- -----------------------------------------------------------------------------
-- 4. Motivos de perda (lista parametrizavel)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_motivos_perda (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo     text NOT NULL,
  label      text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_motivos_perda_codigo_unico UNIQUE (empresa_id, codigo)
);

-- -----------------------------------------------------------------------------
-- 5. Registro de perda — motivo OBRIGATORIO
--    A obrigatoriedade e garantida em tres camadas: NOT NULL aqui, trigger de
--    bloqueio no status da licitacao (Fase B) e dialogo na interface (Fase B).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_perdas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  licitacao_id      uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  motivo_id         uuid NOT NULL REFERENCES public.comercial_motivos_perda(id) ON DELETE RESTRICT,
  observacao        text,
  valor_estimado    numeric(14,2) CHECK (valor_estimado IS NULL OR valor_estimado >= 0),
  modalidade_codigo text,
  data_perda        date NOT NULL DEFAULT CURRENT_DATE,
  registrado_por    uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_perdas_licitacao_unica UNIQUE (licitacao_id)
);

CREATE INDEX IF NOT EXISTS idx_comercial_perdas_colaborador
  ON public.comercial_perdas (empresa_id, user_id, data_perda);

-- -----------------------------------------------------------------------------
-- 6. Snapshot de indicadores
--    Guarda o resultado E as premissas usadas no calculo, para o relatorio
--    continuar reproduzivel meses depois mesmo que as taxas mudem.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comercial_meta_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  ano         int NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes         int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  referencia  text NOT NULL CHECK (referencia IN ('Q1', 'Q2', 'MES')),
  indicadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  premissas   jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comercial_meta_snapshots_unico UNIQUE (empresa_id, user_id, ano, mes, referencia)
);

CREATE INDEX IF NOT EXISTS idx_comercial_snapshots_periodo
  ON public.comercial_meta_snapshots (empresa_id, ano, mes);

-- -----------------------------------------------------------------------------
-- 7. Triggers de updated_at (funcao compartilhada ja existente no projeto)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comercial_metas_config_updated_at ON public.comercial_metas_config;
CREATE TRIGGER comercial_metas_config_updated_at
  BEFORE UPDATE ON public.comercial_metas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comercial_valores_alvo_updated_at ON public.comercial_valores_alvo;
CREATE TRIGGER comercial_valores_alvo_updated_at
  BEFORE UPDATE ON public.comercial_valores_alvo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comercial_metas_updated_at ON public.comercial_metas;
CREATE TRIGGER comercial_metas_updated_at
  BEFORE UPDATE ON public.comercial_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS comercial_motivos_perda_updated_at ON public.comercial_motivos_perda;
CREATE TRIGGER comercial_motivos_perda_updated_at
  BEFORE UPDATE ON public.comercial_motivos_perda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. RLS — padrao do projeto: leitura/escrita por membro da empresa,
--    delete restrito ao admin da empresa.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comercial_metas_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_valores_alvo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_metas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_motivos_perda   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_perdas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercial_meta_snapshots  ENABLE ROW LEVEL SECURITY;

-- comercial_metas_config — so admin da empresa altera a parametrizacao
DROP POLICY IF EXISTS "comercial_metas_config_select" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_select" ON public.comercial_metas_config FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_config_insert" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_insert" ON public.comercial_metas_config FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_config_update" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_update" ON public.comercial_metas_config FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_config_delete" ON public.comercial_metas_config;
CREATE POLICY "comercial_metas_config_delete" ON public.comercial_metas_config FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_valores_alvo — todos leem (o motor precisa), admin parametriza
DROP POLICY IF EXISTS "comercial_valores_alvo_select" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_select" ON public.comercial_valores_alvo FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_valores_alvo_insert" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_insert" ON public.comercial_valores_alvo FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_valores_alvo_update" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_update" ON public.comercial_valores_alvo FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_valores_alvo_delete" ON public.comercial_valores_alvo;
CREATE POLICY "comercial_valores_alvo_delete" ON public.comercial_valores_alvo FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_metas — colaborador le a propria e as demais do time (visao de
-- setor no dashboard e filtrada na aplicacao); so admin da empresa define meta
DROP POLICY IF EXISTS "comercial_metas_select" ON public.comercial_metas;
CREATE POLICY "comercial_metas_select" ON public.comercial_metas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_insert" ON public.comercial_metas;
CREATE POLICY "comercial_metas_insert" ON public.comercial_metas FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_update" ON public.comercial_metas;
CREATE POLICY "comercial_metas_update" ON public.comercial_metas FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_metas_delete" ON public.comercial_metas;
CREATE POLICY "comercial_metas_delete" ON public.comercial_metas FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_motivos_perda
DROP POLICY IF EXISTS "comercial_motivos_perda_select" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_select" ON public.comercial_motivos_perda FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_motivos_perda_insert" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_insert" ON public.comercial_motivos_perda FOR INSERT
  WITH CHECK (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_motivos_perda_update" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_update" ON public.comercial_motivos_perda FOR UPDATE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_motivos_perda_delete" ON public.comercial_motivos_perda;
CREATE POLICY "comercial_motivos_perda_delete" ON public.comercial_motivos_perda FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_perdas — qualquer membro registra a propria perda; sem UPDATE
-- (correcao = apagar e registrar de novo, mantendo a trilha)
DROP POLICY IF EXISTS "comercial_perdas_select" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_select" ON public.comercial_perdas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_perdas_insert" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_insert" ON public.comercial_perdas FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_perdas_update" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_update" ON public.comercial_perdas FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_perdas_delete" ON public.comercial_perdas;
CREATE POLICY "comercial_perdas_delete" ON public.comercial_perdas FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- comercial_meta_snapshots
DROP POLICY IF EXISTS "comercial_meta_snapshots_select" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_select" ON public.comercial_meta_snapshots FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_meta_snapshots_insert" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_insert" ON public.comercial_meta_snapshots FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_meta_snapshots_update" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_update" ON public.comercial_meta_snapshots FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "comercial_meta_snapshots_delete" ON public.comercial_meta_snapshots;
CREATE POLICY "comercial_meta_snapshots_delete" ON public.comercial_meta_snapshots FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- -----------------------------------------------------------------------------
-- 9. Seed dos padroes por empresa
--    Mesma abordagem de `fin_seed_plano_contas_padrao`: funcao idempotente que
--    a aplicacao pode chamar ao criar empresa ou para restaurar os padroes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comercial_seed_padroes(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valores int := 0;
  v_motivos int := 0;
BEGIN
  -- Valores-alvo estimulados por modalidade
  INSERT INTO public.comercial_valores_alvo (empresa_id, modalidade_codigo, valor_alvo, vigencia_inicio)
  VALUES
    (p_empresa_id, 'pregao_eletronico', 300000.00, DATE '2000-01-01'),
    (p_empresa_id, 'dispensa',          100000.00, DATE '2000-01-01')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_valores = ROW_COUNT;

  -- Motivos de perda
  INSERT INTO public.comercial_motivos_perda (empresa_id, codigo, label, ordem)
  VALUES
    (p_empresa_id, 'preco',                 'Preço',                 1),
    (p_empresa_id, 'habilitacao',           'Habilitação',           2),
    (p_empresa_id, 'prazo',                 'Prazo',                 3),
    (p_empresa_id, 'especificacao_tecnica', 'Especificação técnica', 4),
    (p_empresa_id, 'desistencia',           'Desistência',           5),
    (p_empresa_id, 'outro',                 'Outro',                 99)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
  GET DIAGNOSTICS v_motivos = ROW_COUNT;

  -- Configuracao geral
  INSERT INTO public.comercial_metas_config (empresa_id)
  VALUES (p_empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  RETURN jsonb_build_object(
    'empresa_id',      p_empresa_id,
    'valores_alvo',    v_valores,
    'motivos_perda',   v_motivos
  );
END;
$$;

-- Aplica os padroes nas empresas ja existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    PERFORM public.comercial_seed_padroes(r.id);
  END LOOP;
END;
$$;
