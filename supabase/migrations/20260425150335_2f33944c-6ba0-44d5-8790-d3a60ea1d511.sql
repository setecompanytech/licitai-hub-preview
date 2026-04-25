-- ============================================================================
-- PRAEFECTUS — Módulo Financeiro (adaptado para empresas/empresa_membros)
-- ============================================================================

-- Extensions necessárias
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- DROP DAS TABELAS ANTIGAS (todas vazias — confirmado)
-- Preserva: comissoes_lancamentos, comissoes_config (fluxo crítico)
-- ============================================================================

DROP TABLE IF EXISTS public.boletos CASCADE;
DROP TABLE IF EXISTS public.contas_pagar CASCADE;
DROP TABLE IF EXISTS public.contas_receber CASCADE;
DROP TABLE IF EXISTS public.contas_bancarias CASCADE;
DROP TABLE IF EXISTS public.categorias_financeiras CASCADE;
DROP TABLE IF EXISTS public.conciliacao_regras CASCADE;

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE financeiro_tipo_lancamento AS ENUM ('a_pagar','a_receber','movimento_bancario','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE financeiro_status_lancamento AS ENUM ('previsto','realizado','conciliado','cancelado','em_atraso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE financeiro_natureza AS ENUM ('receita','despesa','movimentacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE financeiro_origem_movimento AS ENUM ('manual','ofx','pluggy','cnab','dda','sefaz_nfe','ocr','recorrencia','folha_pagamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE financeiro_tipo_documento AS ENUM ('nfe','nfse','nfce','boleto','recibo','contrato','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- CONTAS BANCÁRIAS
-- ============================================================================

CREATE TABLE public.financeiro_contas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  banco_codigo    text,
  banco_nome      text,
  agencia         text,
  conta           text,
  tipo            text NOT NULL DEFAULT 'corrente',
  saldo_inicial   numeric(15,2) NOT NULL DEFAULT 0,
  saldo_atual     numeric(15,2) NOT NULL DEFAULT 0,
  moeda           char(3) NOT NULL DEFAULT 'BRL',
  pluggy_item_id  text,
  pluggy_account_id text,
  pluggy_last_sync timestamptz,
  ativa           boolean NOT NULL DEFAULT true,
  cor             text DEFAULT '#1e293b',
  ordem           int DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  UNIQUE (empresa_id, banco_codigo, agencia, conta)
);
CREATE INDEX idx_fc_empresa ON public.financeiro_contas(empresa_id) WHERE ativa = true;
CREATE INDEX idx_fc_pluggy ON public.financeiro_contas(pluggy_item_id) WHERE pluggy_item_id IS NOT NULL;

-- ============================================================================
-- PLANO DE CONTAS
-- ============================================================================

CREATE TABLE public.financeiro_categorias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES public.financeiro_categorias(id) ON DELETE RESTRICT,
  codigo          text NOT NULL,
  nome            text NOT NULL,
  natureza        financeiro_natureza NOT NULL,
  grupo_dre       text,
  permite_lancamento boolean NOT NULL DEFAULT true,
  ativa           boolean NOT NULL DEFAULT true,
  cor             text,
  icone           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX idx_fcat_empresa ON public.financeiro_categorias(empresa_id, parent_id);

-- ============================================================================
-- CENTROS DE CUSTO
-- ============================================================================

CREATE TABLE public.financeiro_centros_custo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo          text NOT NULL,
  nome            text NOT NULL,
  descricao       text,
  edital_id       uuid,
  contrato_id     uuid,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

-- ============================================================================
-- FORNECEDORES E CLIENTES
-- ============================================================================

CREATE TABLE public.financeiro_pessoas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('fornecedor','cliente','ambos','funcionario')),
  pessoa_tipo     text NOT NULL CHECK (pessoa_tipo IN ('PF','PJ')),
  documento       text NOT NULL,
  nome            text NOT NULL,
  nome_fantasia   text,
  email           text,
  telefone        text,
  endereco        jsonb,
  dados_bancarios jsonb,
  observacoes     text,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, documento)
);
CREATE INDEX idx_fp_empresa_tipo ON public.financeiro_pessoas(empresa_id, tipo) WHERE ativo = true;
CREATE INDEX idx_fp_documento ON public.financeiro_pessoas(documento);
CREATE INDEX idx_fp_nome_trgm ON public.financeiro_pessoas USING gin(nome gin_trgm_ops);

-- ============================================================================
-- DOCUMENTOS FISCAIS
-- ============================================================================

CREATE TABLE public.financeiro_documentos_fiscais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo            financeiro_tipo_documento NOT NULL,
  numero          text,
  serie           text,
  chave_acesso    text,
  emissor_id      uuid REFERENCES public.financeiro_pessoas(id),
  destinatario_id uuid REFERENCES public.financeiro_pessoas(id),
  data_emissao    date NOT NULL,
  valor_total     numeric(15,2) NOT NULL,
  valor_impostos  numeric(15,2) DEFAULT 0,
  arquivo_url     text,
  arquivo_xml     text,
  ocr_data        jsonb,
  origem          financeiro_origem_movimento NOT NULL DEFAULT 'manual',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave_acesso)
);
CREATE INDEX idx_fdf_empresa ON public.financeiro_documentos_fiscais(empresa_id, data_emissao DESC);

-- ============================================================================
-- LANÇAMENTOS (TABELA CENTRAL)
-- ============================================================================

CREATE TABLE public.financeiro_lancamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo            financeiro_tipo_lancamento NOT NULL,
  status          financeiro_status_lancamento NOT NULL DEFAULT 'previsto',
  natureza        financeiro_natureza NOT NULL,
  descricao       text NOT NULL,
  valor           numeric(15,2) NOT NULL CHECK (valor > 0),
  data_competencia date NOT NULL,
  data_vencimento  date,
  data_realizado   date,
  data_conciliado  timestamptz,
  conta_id        uuid REFERENCES public.financeiro_contas(id),
  conta_destino_id uuid REFERENCES public.financeiro_contas(id),
  categoria_id    uuid REFERENCES public.financeiro_categorias(id),
  centro_custo_id uuid REFERENCES public.financeiro_centros_custo(id),
  pessoa_id       uuid REFERENCES public.financeiro_pessoas(id),
  documento_fiscal_id uuid REFERENCES public.financeiro_documentos_fiscais(id),
  valor_juros     numeric(15,2) DEFAULT 0,
  valor_multa     numeric(15,2) DEFAULT 0,
  valor_desconto  numeric(15,2) DEFAULT 0,
  valor_tarifa    numeric(15,2) DEFAULT 0,
  valor_imposto   numeric(15,2) DEFAULT 0,
  forma_pagamento text,
  meio_pagamento_dados jsonb,
  origem          financeiro_origem_movimento NOT NULL DEFAULT 'manual',
  origem_ref      text,
  recorrencia_id  uuid,
  recorrencia_rrule text,
  edital_id       uuid,
  contrato_id     uuid,
  categoria_sugerida_id uuid REFERENCES public.financeiro_categorias(id),
  categoria_sugerida_confianca smallint,
  categoria_sugerida_modelo text,
  anexos          jsonb DEFAULT '[]'::jsonb,
  observacoes     text,
  tags            text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  UNIQUE (empresa_id, origem, origem_ref)
);
CREATE INDEX idx_fl_empresa_data_status ON public.financeiro_lancamentos(empresa_id, data_vencimento, status);
CREATE INDEX idx_fl_empresa_competencia ON public.financeiro_lancamentos(empresa_id, data_competencia);
CREATE INDEX idx_fl_empresa_categoria ON public.financeiro_lancamentos(empresa_id, categoria_id, data_competencia);
CREATE INDEX idx_fl_empresa_conta ON public.financeiro_lancamentos(empresa_id, conta_id, data_realizado);
CREATE INDEX idx_fl_empresa_pessoa ON public.financeiro_lancamentos(empresa_id, pessoa_id);
CREATE INDEX idx_fl_empresa_edital ON public.financeiro_lancamentos(empresa_id, edital_id) WHERE edital_id IS NOT NULL;
CREATE INDEX idx_fl_descricao_trgm ON public.financeiro_lancamentos USING gin(descricao gin_trgm_ops);
CREATE INDEX idx_fl_status_vencidos ON public.financeiro_lancamentos(empresa_id, data_vencimento)
  WHERE status = 'previsto' AND tipo IN ('a_pagar','a_receber');

-- ============================================================================
-- IMPORTAÇÕES DE EXTRATO
-- ============================================================================

CREATE TABLE public.financeiro_extratos_importados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id        uuid NOT NULL REFERENCES public.financeiro_contas(id),
  formato         text NOT NULL CHECK (formato IN ('ofx','cnab240','cnab444','csv')),
  arquivo_nome    text NOT NULL,
  arquivo_hash    text NOT NULL,
  arquivo_url     text,
  data_inicio     date,
  data_fim        date,
  total_movimentos int DEFAULT 0,
  total_conciliados int DEFAULT 0,
  status          text NOT NULL DEFAULT 'processando' CHECK (status IN ('processando','concluido','erro')),
  erro_mensagem   text,
  importado_por   uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, conta_id, arquivo_hash)
);

-- ============================================================================
-- MOVIMENTOS DE EXTRATO
-- ============================================================================

CREATE TABLE public.financeiro_extrato_movimentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  extrato_id      uuid NOT NULL REFERENCES public.financeiro_extratos_importados(id) ON DELETE CASCADE,
  conta_id        uuid NOT NULL REFERENCES public.financeiro_contas(id),
  fitid           text NOT NULL,
  tipo            text NOT NULL,
  valor           numeric(15,2) NOT NULL,
  data_movimento  date NOT NULL,
  descricao       text NOT NULL,
  descricao_extra text,
  saldo_apos      numeric(15,2),
  conciliado      boolean NOT NULL DEFAULT false,
  lancamento_id   uuid REFERENCES public.financeiro_lancamentos(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, fitid)
);
CREATE INDEX idx_fem_empresa_concil ON public.financeiro_extrato_movimentos(empresa_id, conciliado, data_movimento);

-- ============================================================================
-- CONCILIAÇÕES
-- ============================================================================

CREATE TABLE public.financeiro_conciliacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  extrato_movimento_id uuid NOT NULL REFERENCES public.financeiro_extrato_movimentos(id) ON DELETE CASCADE,
  lancamento_id   uuid NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  score           smallint NOT NULL,
  metodo          text NOT NULL,
  motivos         jsonb,
  conciliado_por  uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (extrato_movimento_id)
);

-- ============================================================================
-- REGRAS DE CATEGORIZAÇÃO
-- ============================================================================

CREATE TABLE public.financeiro_regras_categorizacao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  descricao       text,
  condicoes       jsonb NOT NULL,
  categoria_id    uuid REFERENCES public.financeiro_categorias(id),
  centro_custo_id uuid REFERENCES public.financeiro_centros_custo(id),
  pessoa_id       uuid REFERENCES public.financeiro_pessoas(id),
  prioridade      int NOT NULL DEFAULT 100,
  ativa           boolean NOT NULL DEFAULT true,
  vezes_aplicada  int DEFAULT 0,
  ultima_aplicacao timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_frc_empresa_prio ON public.financeiro_regras_categorizacao(empresa_id, prioridade) WHERE ativa = true;

-- ============================================================================
-- FOLHA DE PAGAMENTO
-- ============================================================================

CREATE TABLE public.financeiro_folha_pagamento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia     date NOT NULL,
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','calculada','aprovada','paga')),
  total_proventos numeric(15,2) DEFAULT 0,
  total_descontos numeric(15,2) DEFAULT 0,
  total_liquido   numeric(15,2) DEFAULT 0,
  total_inss_patronal numeric(15,2) DEFAULT 0,
  total_fgts      numeric(15,2) DEFAULT 0,
  data_pagamento  date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  UNIQUE (empresa_id, competencia)
);

CREATE TABLE public.financeiro_folha_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  folha_id        uuid NOT NULL REFERENCES public.financeiro_folha_pagamento(id) ON DELETE CASCADE,
  funcionario_id  uuid NOT NULL REFERENCES public.financeiro_pessoas(id),
  salario_base    numeric(15,2) NOT NULL,
  proventos       jsonb DEFAULT '[]'::jsonb,
  descontos       jsonb DEFAULT '[]'::jsonb,
  inss            numeric(15,2) DEFAULT 0,
  irrf            numeric(15,2) DEFAULT 0,
  fgts            numeric(15,2) DEFAULT 0,
  total_liquido   numeric(15,2) NOT NULL,
  lancamento_id   uuid REFERENCES public.financeiro_lancamentos(id)
);

-- ============================================================================
-- COMISSÕES (NOVO — paralelo às tabelas legadas comissoes_*)
-- ============================================================================

CREATE TABLE public.financeiro_comissoes_regras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pessoa_id       uuid NOT NULL REFERENCES public.financeiro_pessoas(id),
  nome            text NOT NULL,
  base_calculo    text NOT NULL,
  percentual      numeric(5,2) NOT NULL,
  valor_minimo    numeric(15,2),
  valor_maximo    numeric(15,2),
  ativa           boolean DEFAULT true,
  vigencia_inicio date,
  vigencia_fim    date
);

CREATE TABLE public.financeiro_comissoes_calculadas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  regra_id        uuid REFERENCES public.financeiro_comissoes_regras(id),
  pessoa_id       uuid NOT NULL REFERENCES public.financeiro_pessoas(id),
  lancamento_origem_id uuid REFERENCES public.financeiro_lancamentos(id),
  base            numeric(15,2) NOT NULL,
  percentual      numeric(5,2) NOT NULL,
  valor           numeric(15,2) NOT NULL,
  competencia     date NOT NULL,
  status          text DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','paga')),
  lancamento_pagamento_id uuid REFERENCES public.financeiro_lancamentos(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE public.financeiro_audit_log (
  id              bigserial PRIMARY KEY,
  empresa_id      uuid NOT NULL,
  tabela          text NOT NULL,
  registro_id     uuid NOT NULL,
  operacao        text NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  dados_antes     jsonb,
  dados_depois    jsonb,
  usuario_id      uuid REFERENCES auth.users(id),
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fal_empresa_tabela ON public.financeiro_audit_log(empresa_id, tabela, created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.financeiro_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_usuario uuid := auth.uid();
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.financeiro_audit_log(empresa_id, tabela, registro_id, operacao, dados_antes, usuario_id)
    VALUES (OLD.empresa_id, TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), v_usuario);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.financeiro_audit_log(empresa_id, tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id)
    VALUES (NEW.empresa_id, TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_usuario);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.financeiro_audit_log(empresa_id, tabela, registro_id, operacao, dados_depois, usuario_id)
    VALUES (NEW.empresa_id, TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), v_usuario);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_fl AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trigger();
CREATE TRIGGER trg_audit_fc AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_contas
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trigger();

CREATE TRIGGER trg_uat_fl BEFORE UPDATE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_uat_fc BEFORE UPDATE ON public.financeiro_contas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_uat_fp BEFORE UPDATE ON public.financeiro_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_uat_fcat BEFORE UPDATE ON public.financeiro_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RECÁLCULO DE SALDO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;
  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'a_receber' AND status IN ('realizado','conciliado') THEN valor
      WHEN tipo = 'a_pagar' AND status IN ('realizado','conciliado') THEN -valor
      WHEN tipo = 'movimento_bancario' THEN valor
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN valor
      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

-- ============================================================================
-- MATERIALIZED VIEWS
-- ============================================================================

CREATE MATERIALIZED VIEW public.mv_financeiro_dre_mensal AS
SELECT
  l.empresa_id,
  date_trunc('month', l.data_competencia)::date AS competencia,
  c.grupo_dre,
  c.id AS categoria_id,
  c.nome AS categoria_nome,
  c.natureza,
  SUM(l.valor) AS total
FROM public.financeiro_lancamentos l
JOIN public.financeiro_categorias c ON c.id = l.categoria_id
WHERE l.status IN ('realizado','conciliado')
GROUP BY l.empresa_id, date_trunc('month', l.data_competencia), c.grupo_dre, c.id, c.nome, c.natureza;

CREATE UNIQUE INDEX idx_mv_dre ON public.mv_financeiro_dre_mensal(empresa_id, competencia, categoria_id);

CREATE MATERIALIZED VIEW public.mv_financeiro_fluxo_caixa AS
SELECT
  empresa_id,
  data_vencimento AS data,
  SUM(CASE WHEN tipo='a_receber' THEN valor ELSE 0 END) AS entradas_previstas,
  SUM(CASE WHEN tipo='a_pagar' THEN valor ELSE 0 END) AS saidas_previstas,
  SUM(CASE WHEN tipo='a_receber' AND status IN ('realizado','conciliado') THEN valor ELSE 0 END) AS entradas_realizadas,
  SUM(CASE WHEN tipo='a_pagar' AND status IN ('realizado','conciliado') THEN valor ELSE 0 END) AS saidas_realizadas
FROM public.financeiro_lancamentos
WHERE data_vencimento IS NOT NULL
GROUP BY empresa_id, data_vencimento;

CREATE UNIQUE INDEX idx_mv_fluxo ON public.mv_financeiro_fluxo_caixa(empresa_id, data);

CREATE OR REPLACE FUNCTION public.refresh_financeiro_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_dre_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_fluxo_caixa;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.financeiro_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_documentos_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_extratos_importados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_extrato_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_conciliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_regras_categorizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_folha_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_folha_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_comissoes_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_comissoes_calculadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies usando is_empresa_member (já existe)
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'financeiro_%'
      AND tablename != 'financeiro_audit_log'
  LOOP
    EXECUTE format('CREATE POLICY %I_member_select ON public.%I FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id))', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I_member_ins ON public.%I FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id))', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I_member_upd ON public.%I FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id)) WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id))', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I_member_del ON public.%I FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id))', t||'_del', t);
  END LOOP;
END $$;

-- Audit log: somente leitura para membros, escrita só via trigger
CREATE POLICY financeiro_audit_select ON public.financeiro_audit_log
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

-- ============================================================================
-- SEED PLANO DE CONTAS PADRÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_plano_contas_padrao(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financeiro_categorias (empresa_id, codigo, nome, natureza, grupo_dre, permite_lancamento) VALUES
  (p_empresa_id, '3', 'RECEITAS', 'receita', NULL, false),
  (p_empresa_id, '3.1', 'Receita Bruta', 'receita', 'receita_bruta', false),
  (p_empresa_id, '3.1.01', 'Vendas de Produtos', 'receita', 'receita_bruta', true),
  (p_empresa_id, '3.1.02', 'Prestação de Serviços', 'receita', 'receita_bruta', true),
  (p_empresa_id, '3.1.03', 'Receita de Contratos Públicos', 'receita', 'receita_bruta', true),
  (p_empresa_id, '3.2', 'Deduções', 'receita', 'deducoes', false),
  (p_empresa_id, '3.2.01', 'ISS', 'receita', 'deducoes', true),
  (p_empresa_id, '3.2.02', 'PIS/COFINS', 'receita', 'deducoes', true),
  (p_empresa_id, '3.2.03', 'Retenções em Contratos Públicos', 'receita', 'deducoes', true),
  (p_empresa_id, '4', 'DESPESAS', 'despesa', NULL, false),
  (p_empresa_id, '4.1', 'Custo de Produtos/Serviços', 'despesa', 'cmv_cps', false),
  (p_empresa_id, '4.1.01', 'Insumos', 'despesa', 'cmv_cps', true),
  (p_empresa_id, '4.1.02', 'Mão de Obra Direta', 'despesa', 'cmv_cps', true),
  (p_empresa_id, '4.2', 'Despesas Operacionais', 'despesa', 'desp_operacional', false),
  (p_empresa_id, '4.2.01', 'Salários e Encargos', 'despesa', 'desp_operacional', true),
  (p_empresa_id, '4.2.02', 'Aluguel', 'despesa', 'desp_operacional', true),
  (p_empresa_id, '4.2.03', 'Energia, Água, Internet', 'despesa', 'desp_operacional', true),
  (p_empresa_id, '4.2.04', 'Marketing', 'despesa', 'desp_operacional', true),
  (p_empresa_id, '4.2.05', 'Software/SaaS', 'despesa', 'desp_operacional', true),
  (p_empresa_id, '4.2.06', 'Pró-labore', 'despesa', 'desp_operacional', true),
  (p_empresa_id, '4.3', 'Despesas Financeiras', 'despesa', 'desp_financeira', false),
  (p_empresa_id, '4.3.01', 'Tarifas Bancárias', 'despesa', 'desp_financeira', true),
  (p_empresa_id, '4.3.02', 'IOF', 'despesa', 'desp_financeira', true),
  (p_empresa_id, '4.3.03', 'Juros e Multas', 'despesa', 'desp_financeira', true),
  (p_empresa_id, '9', 'MOVIMENTAÇÕES', 'movimentacao', NULL, false),
  (p_empresa_id, '9.01', 'Transferências entre Contas', 'movimentacao', NULL, true),
  (p_empresa_id, '9.02', 'Aportes de Sócios', 'movimentacao', NULL, true)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
END;
$$;