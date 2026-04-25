-- =====================================================
-- SPRINT A — PLANO DE CONTAS HIERÁRQUICO (SPED ECF)
-- Base normativa: NBC TG 1000, ITG 2000, Lei 6.404/76
-- =====================================================

CREATE TABLE IF NOT EXISTS public.financeiro_plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 6),
  natureza text NOT NULL CHECK (natureza IN ('ativo','passivo','pl','receita','despesa','custo','apuracao')),
  natureza_saldo char(1) NOT NULL CHECK (natureza_saldo IN ('D','C')),
  tipo_conta text NOT NULL CHECK (tipo_conta IN ('sintetica','analitica')),
  parent_id uuid REFERENCES public.financeiro_plano_contas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  conta_referencial_sped text,
  centro_resultado text,
  aceita_lancamento boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE(empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_fpc_empresa_natureza ON public.financeiro_plano_contas(empresa_id, natureza, nivel);
CREATE INDEX IF NOT EXISTS idx_fpc_empresa_parent ON public.financeiro_plano_contas(empresa_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_fpc_codigo ON public.financeiro_plano_contas(empresa_id, codigo);

-- Validação: tipo coerente com aceita_lancamento
ALTER TABLE public.financeiro_plano_contas
  ADD CONSTRAINT chk_fpc_analitica_aceita
  CHECK (
    (tipo_conta = 'analitica' AND aceita_lancamento = true)
    OR (tipo_conta = 'sintetica' AND aceita_lancamento = false)
  );

-- RLS
ALTER TABLE public.financeiro_plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpc_select_member" ON public.financeiro_plano_contas
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fpc_insert_member" ON public.financeiro_plano_contas
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fpc_update_member" ON public.financeiro_plano_contas
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fpc_delete_admin" ON public.financeiro_plano_contas
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- Triggers
CREATE TRIGGER trg_fpc_updated_at
  BEFORE UPDATE ON public.financeiro_plano_contas
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

CREATE TRIGGER trg_fpc_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_plano_contas
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trigger();

-- =====================================================
-- FUNÇÃO SEED: Plano de Contas PME padrão (~120 contas)
-- Idempotente, alinhada SPED ECF Leiaute 12
-- =====================================================
CREATE OR REPLACE FUNCTION public.financeiro_seed_plano_contas_pme(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_inseridas int := 0;
  v_existentes int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_empresa_member(v_user, p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão na empresa' USING ERRCODE = '42501';
  END IF;

  -- Conta as existentes para retorno
  SELECT count(*) INTO v_existentes FROM public.financeiro_plano_contas WHERE empresa_id = p_empresa_id;

  -- Inserção idempotente via ON CONFLICT
  WITH dados(codigo, nivel, natureza, natureza_saldo, tipo_conta, nome, sped, aceita) AS (
    VALUES
    -- ATIVO (1)
    ('1',         1, 'ativo',  'D', 'sintetica',  'ATIVO', '1', false),
    ('1.1',       2, 'ativo',  'D', 'sintetica',  'ATIVO CIRCULANTE', '1.01', false),
    ('1.1.1',     3, 'ativo',  'D', 'sintetica',  'Caixa e Equivalentes de Caixa', '1.01.01', false),
    ('1.1.1.01',  4, 'ativo',  'D', 'analitica',  'Caixa Geral', '1.01.01.01', true),
    ('1.1.1.02',  4, 'ativo',  'D', 'analitica',  'Bancos Conta Movimento', '1.01.01.02', true),
    ('1.1.1.03',  4, 'ativo',  'D', 'analitica',  'Aplicações Financeiras de Liquidez Imediata', '1.01.01.03', true),
    ('1.1.2',     3, 'ativo',  'D', 'sintetica',  'Contas a Receber de Clientes', '1.01.02', false),
    ('1.1.2.01',  4, 'ativo',  'D', 'analitica',  'Duplicatas a Receber', '1.01.02.01', true),
    ('1.1.2.02',  4, 'ativo',  'D', 'analitica',  'Cheques a Receber', '1.01.02.02', true),
    ('1.1.3',     3, 'ativo',  'D', 'sintetica',  'Estoques', '1.01.04', false),
    ('1.1.3.01',  4, 'ativo',  'D', 'analitica',  'Mercadorias para Revenda', '1.01.04.01', true),
    ('1.1.3.02',  4, 'ativo',  'D', 'analitica',  'Matéria-Prima', '1.01.04.02', true),
    ('1.1.4',     3, 'ativo',  'D', 'sintetica',  'Tributos a Recuperar', '1.01.05', false),
    ('1.1.4.01',  4, 'ativo',  'D', 'analitica',  'ICMS a Recuperar', '1.01.05.01', true),
    ('1.1.4.02',  4, 'ativo',  'D', 'analitica',  'PIS/COFINS a Recuperar', '1.01.05.02', true),
    ('1.1.5',     3, 'ativo',  'D', 'sintetica',  'Adiantamentos', '1.01.06', false),
    ('1.1.5.01',  4, 'ativo',  'D', 'analitica',  'Adiantamentos a Funcionários', '1.01.06.01', true),
    ('1.1.5.02',  4, 'ativo',  'D', 'analitica',  'Adiantamentos a Fornecedores', '1.01.06.02', true),
    ('1.2',       2, 'ativo',  'D', 'sintetica',  'ATIVO NÃO CIRCULANTE', '1.02', false),
    ('1.2.1',     3, 'ativo',  'D', 'sintetica',  'Imobilizado', '1.02.03', false),
    ('1.2.1.01',  4, 'ativo',  'D', 'analitica',  'Móveis e Utensílios', '1.02.03.01', true),
    ('1.2.1.02',  4, 'ativo',  'D', 'analitica',  'Equipamentos de Informática', '1.02.03.02', true),
    ('1.2.1.03',  4, 'ativo',  'D', 'analitica',  'Veículos', '1.02.03.03', true),
    ('1.2.1.04',  4, 'ativo',  'D', 'analitica',  'Máquinas e Equipamentos', '1.02.03.04', true),
    ('1.2.1.05',  4, 'ativo',  'D', 'analitica',  'Imóveis', '1.02.03.05', true),
    ('1.2.1.99',  4, 'ativo',  'C', 'analitica',  '(-) Depreciação Acumulada', '1.02.03.99', true),
    ('1.2.2',     3, 'ativo',  'D', 'sintetica',  'Intangível', '1.02.04', false),
    ('1.2.2.01',  4, 'ativo',  'D', 'analitica',  'Software e Licenças', '1.02.04.01', true),
    ('1.2.2.99',  4, 'ativo',  'C', 'analitica',  '(-) Amortização Acumulada', '1.02.04.99', true),

    -- PASSIVO (2)
    ('2',         1, 'passivo','C', 'sintetica',  'PASSIVO', '2', false),
    ('2.1',       2, 'passivo','C', 'sintetica',  'PASSIVO CIRCULANTE', '2.01', false),
    ('2.1.1',     3, 'passivo','C', 'sintetica',  'Fornecedores', '2.01.01', false),
    ('2.1.1.01',  4, 'passivo','C', 'analitica',  'Fornecedores Nacionais', '2.01.01.01', true),
    ('2.1.2',     3, 'passivo','C', 'sintetica',  'Obrigações Tributárias a Recolher', '2.01.03', false),
    ('2.1.2.01',  4, 'passivo','C', 'analitica',  'DAS Simples Nacional a Recolher', '2.01.03.99', true),
    ('2.1.2.02',  4, 'passivo','C', 'analitica',  'ICMS a Recolher', '2.01.03.01', true),
    ('2.1.2.03',  4, 'passivo','C', 'analitica',  'PIS a Recolher', '2.01.03.02', true),
    ('2.1.2.04',  4, 'passivo','C', 'analitica',  'COFINS a Recolher', '2.01.03.03', true),
    ('2.1.2.05',  4, 'passivo','C', 'analitica',  'ISS a Recolher', '2.01.03.04', true),
    ('2.1.2.06',  4, 'passivo','C', 'analitica',  'IRPJ a Recolher', '2.01.03.05', true),
    ('2.1.2.07',  4, 'passivo','C', 'analitica',  'CSLL a Recolher', '2.01.03.06', true),
    ('2.1.3',     3, 'passivo','C', 'sintetica',  'Obrigações Trabalhistas e Previdenciárias', '2.01.04', false),
    ('2.1.3.01',  4, 'passivo','C', 'analitica',  'Salários a Pagar', '2.01.04.01', true),
    ('2.1.3.02',  4, 'passivo','C', 'analitica',  'INSS a Recolher', '2.01.04.02', true),
    ('2.1.3.03',  4, 'passivo','C', 'analitica',  'FGTS a Recolher', '2.01.04.03', true),
    ('2.1.3.04',  4, 'passivo','C', 'analitica',  'Provisão de Férias', '2.01.04.04', true),
    ('2.1.3.05',  4, 'passivo','C', 'analitica',  'Provisão de 13º Salário', '2.01.04.05', true),
    ('2.2',       2, 'passivo','C', 'sintetica',  'PASSIVO NÃO CIRCULANTE', '2.02', false),
    ('2.2.1',     3, 'passivo','C', 'sintetica',  'Empréstimos e Financiamentos', '2.02.01', false),
    ('2.2.1.01',  4, 'passivo','C', 'analitica',  'Empréstimos Bancários a Pagar', '2.02.01.01', true),
    ('2.2.1.02',  4, 'passivo','C', 'analitica',  'Financiamentos a Pagar', '2.02.01.02', true),
    ('2.2.2',     3, 'passivo','C', 'sintetica',  'Consórcios', '2.02.02', false),
    ('2.2.2.01',  4, 'passivo','C', 'analitica',  'Consórcios a Pagar', '2.02.02.01', true),

    -- PATRIMÔNIO LÍQUIDO (2.3)
    ('2.3',       2, 'pl',     'C', 'sintetica',  'PATRIMÔNIO LÍQUIDO', '2.03', false),
    ('2.3.1',     3, 'pl',     'C', 'sintetica',  'Capital Social', '2.03.01', false),
    ('2.3.1.01',  4, 'pl',     'C', 'analitica',  'Capital Social Subscrito e Integralizado', '2.03.01.01', true),
    ('2.3.2',     3, 'pl',     'C', 'sintetica',  'Reservas de Lucros', '2.03.04', false),
    ('2.3.2.01',  4, 'pl',     'C', 'analitica',  'Reserva Legal', '2.03.04.01', true),
    ('2.3.3',     3, 'pl',     'C', 'sintetica',  'Lucros / Prejuízos Acumulados', '2.03.05', false),
    ('2.3.3.01',  4, 'pl',     'C', 'analitica',  'Lucros Acumulados', '2.03.05.01', true),

    -- RECEITAS (3)
    ('3',         1, 'receita','C', 'sintetica',  'RECEITAS', '3', false),
    ('3.1',       2, 'receita','C', 'sintetica',  'RECEITA OPERACIONAL BRUTA', '3.01', false),
    ('3.1.1',     3, 'receita','C', 'sintetica',  'Receita de Venda de Mercadorias', '3.01.01', false),
    ('3.1.1.01',  4, 'receita','C', 'analitica',  'Gêneros Alimentícios', '3.01.01.01', true),
    ('3.1.1.02',  4, 'receita','C', 'analitica',  'Equipamentos de Informática', '3.01.01.01', true),
    ('3.1.1.03',  4, 'receita','C', 'analitica',  'Material Descartável', '3.01.01.01', true),
    ('3.1.1.04',  4, 'receita','C', 'analitica',  'Material de Limpeza e Higiene', '3.01.01.01', true),
    ('3.1.1.05',  4, 'receita','C', 'analitica',  'Cama, Mesa e Banho', '3.01.01.01', true),
    ('3.1.1.06',  4, 'receita','C', 'analitica',  'Eletrodomésticos', '3.01.01.01', true),
    ('3.1.1.07',  4, 'receita','C', 'analitica',  'Móveis', '3.01.01.01', true),
    ('3.1.1.08',  4, 'receita','C', 'analitica',  'Material Elétrico', '3.01.01.01', true),
    ('3.1.1.09',  4, 'receita','C', 'analitica',  'Ferramentas', '3.01.01.01', true),
    ('3.1.1.10',  4, 'receita','C', 'analitica',  'Material de Construção', '3.01.01.01', true),
    ('3.1.1.11',  4, 'receita','C', 'analitica',  'EPIs', '3.01.01.01', true),
    ('3.1.1.12',  4, 'receita','C', 'analitica',  'Combustível', '3.01.01.01', true),
    ('3.1.1.13',  4, 'receita','C', 'analitica',  'Material Médico-Hospitalar', '3.01.01.01', true),
    ('3.1.1.14',  4, 'receita','C', 'analitica',  'Material Escolar', '3.01.01.01', true),
    ('3.1.1.15',  4, 'receita','C', 'analitica',  'Material de Escritório', '3.01.01.01', true),
    ('3.1.1.16',  4, 'receita','C', 'analitica',  'Brindes', '3.01.01.01', true),
    ('3.1.1.99',  4, 'receita','C', 'analitica',  'Outras Mercadorias', '3.01.01.99', true),
    ('3.1.2',     3, 'receita','C', 'sintetica',  'Receita de Prestação de Serviços', '3.01.02', false),
    ('3.1.2.01',  4, 'receita','C', 'analitica',  'Serviço de Lavagem de Veículos', '3.01.02.01', true),
    ('3.1.2.99',  4, 'receita','C', 'analitica',  'Outros Serviços', '3.01.02.99', true),
    ('3.2',       2, 'receita','D', 'sintetica',  '(-) DEDUÇÕES DA RECEITA BRUTA', '3.02', false),
    ('3.2.1',     3, 'receita','D', 'sintetica',  'Tributos sobre Vendas', '3.02.01', false),
    ('3.2.1.01',  4, 'receita','D', 'analitica',  'DAS - Simples Nacional', '3.02.01.99', true),
    ('3.2.1.02',  4, 'receita','D', 'analitica',  'ICMS sobre Vendas', '3.02.01.01', true),
    ('3.2.1.03',  4, 'receita','D', 'analitica',  'PIS/PASEP sobre Faturamento', '3.02.01.02', true),
    ('3.2.1.04',  4, 'receita','D', 'analitica',  'COFINS sobre Faturamento', '3.02.01.03', true),
    ('3.2.1.05',  4, 'receita','D', 'analitica',  'ISS sobre Serviços', '3.02.01.04', true),
    ('3.2.1.06',  4, 'receita','D', 'analitica',  'IPI sobre Vendas', '3.02.01.05', true),
    ('3.2.2',     3, 'receita','D', 'analitica',  'Devoluções, Cancelamentos e Abatimentos', '3.02.02', true),
    ('3.3',       2, 'receita','C', 'sintetica',  'OUTRAS RECEITAS OPERACIONAIS', '3.05', false),
    ('3.3.1',     3, 'receita','C', 'analitica',  'Reposição Financeira de Sócios', '3.05.99', true),
    ('3.3.2',     3, 'receita','C', 'analitica',  'Recuperação de Despesas', '3.05.99', true),
    ('3.4',       2, 'receita','C', 'sintetica',  'RECEITAS FINANCEIRAS', '3.04', false),
    ('3.4.1',     3, 'receita','C', 'analitica',  'Juros Ativos / Recebidos', '3.04.01', true),
    ('3.4.2',     3, 'receita','C', 'analitica',  'Rendimentos de Aplicações Financeiras', '3.04.02', true),
    ('3.4.3',     3, 'receita','C', 'analitica',  'Descontos Obtidos', '3.04.03', true),
    ('3.4.4',     3, 'receita','C', 'analitica',  'Variações Monetárias Ativas', '3.04.04', true),

    -- CUSTOS E DESPESAS (4)
    ('4',         1, 'despesa','D', 'sintetica',  'CUSTOS E DESPESAS', '4', false),
    ('4.1',       2, 'custo',  'D', 'sintetica',  'CUSTOS DAS VENDAS', '4.01', false),
    ('4.1.1',     3, 'custo',  'D', 'sintetica',  'CMV - Custo da Mercadoria Vendida', '4.01.01', false),
    ('4.1.1.01',  4, 'custo',  'D', 'analitica',  'Mercadorias para Revenda', '4.01.01.01', true),
    ('4.1.2',     3, 'custo',  'D', 'sintetica',  'CPV - Custo do Produto Vendido', '4.01.02', false),
    ('4.1.2.01',  4, 'custo',  'D', 'analitica',  'Matéria-Prima Consumida', '4.01.02.01', true),
    ('4.1.2.02',  4, 'custo',  'D', 'analitica',  'Material de Embalagem', '4.01.02.02', true),
    ('4.1.3',     3, 'custo',  'D', 'sintetica',  'CSP - Custo do Serviço Prestado', '4.01.03', false),
    ('4.1.3.01',  4, 'custo',  'D', 'analitica',  'Mão de Obra Direta - Empreitada/Diária', '4.01.03.01', true),
    ('4.1.3.02',  4, 'custo',  'D', 'analitica',  'Frete sobre Vendas / Logística', '4.01.03.02', true),
    ('4.1.3.03',  4, 'custo',  'D', 'analitica',  'Repasse a Terceiros', '4.01.03.03', true),
    ('4.2',       2, 'despesa','D', 'sintetica',  'DESPESAS OPERACIONAIS', '4.02', false),
    ('4.2.1',     3, 'despesa','D', 'sintetica',  'Despesas Administrativas', '4.02.01', false),
    ('4.2.1.01',  4, 'despesa','D', 'analitica',  'Aluguéis e Condomínios', '4.02.01.01', true),
    ('4.2.1.02',  4, 'despesa','D', 'analitica',  'Energia Elétrica', '4.02.01.02', true),
    ('4.2.1.03',  4, 'despesa','D', 'analitica',  'Água e Esgoto', '4.02.01.03', true),
    ('4.2.1.04',  4, 'despesa','D', 'analitica',  'Telefonia, Internet e Comunicações', '4.02.01.04', true),
    ('4.2.1.05',  4, 'despesa','D', 'analitica',  'IPTU e Taxas Municipais', '4.02.01.05', true),
    ('4.2.1.06',  4, 'despesa','D', 'analitica',  'Limpeza e Conservação Predial', '4.02.01.06', true),
    ('4.2.1.07',  4, 'despesa','D', 'analitica',  'Software / SaaS / Cloud', '4.02.01.07', true),
    ('4.2.1.08',  4, 'despesa','D', 'analitica',  'Material de Escritório', '4.02.01.08', true),
    ('4.2.1.09',  4, 'despesa','D', 'analitica',  'Manutenção de Bens Móveis e Imóveis', '4.02.01.09', true),
    ('4.2.1.99',  4, 'despesa','D', 'analitica',  'Outras Despesas Administrativas', '4.02.01.99', true),
    ('4.2.2',     3, 'despesa','D', 'sintetica',  'Despesas com Pessoal e Encargos', '4.02.02', false),
    ('4.2.2.01',  4, 'despesa','D', 'analitica',  'Salários e Ordenados', '4.02.02.01', true),
    ('4.2.2.02',  4, 'despesa','D', 'analitica',  'Pró-Labore (Sócios Administradores)', '4.02.02.02', true),
    ('4.2.2.03',  4, 'despesa','D', 'analitica',  '13º Salário', '4.02.02.03', true),
    ('4.2.2.04',  4, 'despesa','D', 'analitica',  'Férias e Adicional 1/3', '4.02.02.04', true),
    ('4.2.2.05',  4, 'despesa','D', 'analitica',  'INSS Patronal', '4.02.02.05', true),
    ('4.2.2.06',  4, 'despesa','D', 'analitica',  'FGTS', '4.02.02.06', true),
    ('4.2.2.07',  4, 'despesa','D', 'analitica',  'Vale-Transporte', '4.02.02.07', true),
    ('4.2.2.08',  4, 'despesa','D', 'analitica',  'Vale-Refeição / Alimentação', '4.02.02.08', true),
    ('4.2.2.09',  4, 'despesa','D', 'analitica',  'Assistência Médica e Odontológica', '4.02.02.09', true),
    ('4.2.2.10',  4, 'despesa','D', 'analitica',  'Exames Admissionais e Periódicos (NR-7)', '4.02.02.10', true),
    ('4.2.2.11',  4, 'despesa','D', 'analitica',  'Rescisões e Indenizações Trabalhistas', '4.02.02.11', true),
    ('4.2.3',     3, 'despesa','D', 'sintetica',  'Despesas Comerciais', '4.02.03', false),
    ('4.2.3.01',  4, 'despesa','D', 'analitica',  'Comissões sobre Vendas', '4.02.03.01', true),
    ('4.2.3.02',  4, 'despesa','D', 'analitica',  'Publicidade e Propaganda', '4.02.03.02', true),
    ('4.2.3.03',  4, 'despesa','D', 'analitica',  'Brindes, Amostras e Cortesias', '4.02.03.03', true),
    ('4.2.3.04',  4, 'despesa','D', 'analitica',  'Participação em Licitações (Custas)', '4.02.03.04', true),
    ('4.2.4',     3, 'despesa','D', 'sintetica',  'Despesas com Serviços de Terceiros - PJ', '4.02.04', false),
    ('4.2.4.01',  4, 'despesa','D', 'analitica',  'Honorários Contábeis', '4.02.04.01', true),
    ('4.2.4.02',  4, 'despesa','D', 'analitica',  'Honorários Advocatícios', '4.02.04.02', true),
    ('4.2.4.03',  4, 'despesa','D', 'analitica',  'Consultoria Técnica e Gerencial', '4.02.04.03', true),
    ('4.2.4.04',  4, 'despesa','D', 'analitica',  'Serviços de TI e Manutenção de Sistemas', '4.02.04.04', true),
    ('4.2.4.05',  4, 'despesa','D', 'analitica',  'Serviços de Vigilância e Segurança', '4.02.04.05', true),
    ('4.2.4.06',  4, 'despesa','D', 'analitica',  'Serviços de Limpeza Terceirizados', '4.02.04.06', true),
    ('4.2.4.99',  4, 'despesa','D', 'analitica',  'Outros Serviços de Terceiros', '4.02.04.99', true),
    ('4.2.5',     3, 'despesa','D', 'sintetica',  'Despesas Tributárias', '4.02.05', false),
    ('4.2.5.01',  4, 'despesa','D', 'analitica',  'Taxas e Contribuições (cartoriais, certificação)', '4.02.05.01', true),
    ('4.2.5.02',  4, 'despesa','D', 'analitica',  'IPVA e Licenciamento de Veículos', '4.02.05.02', true),
    ('4.2.5.03',  4, 'despesa','D', 'analitica',  'Multas Fiscais Dedutíveis', '4.02.05.03', true),
    ('4.2.6',     3, 'despesa','D', 'sintetica',  'Depreciação, Amortização e Exaustão', '4.02.06', false),
    ('4.2.6.01',  4, 'despesa','D', 'analitica',  'Depreciação de Bens do Imobilizado', '4.02.06.01', true),
    ('4.2.6.02',  4, 'despesa','D', 'analitica',  'Amortização de Intangíveis', '4.02.06.02', true),
    ('4.3',       2, 'despesa','D', 'sintetica',  'DESPESAS FINANCEIRAS', '4.03', false),
    ('4.3.1',     3, 'despesa','D', 'analitica',  'Juros Passivos / Pagos', '4.03.01', true),
    ('4.3.2',     3, 'despesa','D', 'analitica',  'Multas e Juros por Atraso de Tributos', '4.03.02', true),
    ('4.3.3',     3, 'despesa','D', 'analitica',  'Tarifas Bancárias (TED, DOC, PIX PJ)', '4.03.03', true),
    ('4.3.4',     3, 'despesa','D', 'analitica',  'IOF', '4.03.04', true),
    ('4.3.5',     3, 'despesa','D', 'analitica',  'Descontos Concedidos', '4.03.05', true),
    ('4.3.6',     3, 'despesa','D', 'analitica',  'Variações Monetárias Passivas', '4.03.06', true),
    ('4.4',       2, 'despesa','D', 'sintetica',  'OUTRAS DESPESAS OPERACIONAIS', '4.04', false),
    ('4.4.1',     3, 'despesa','D', 'analitica',  'Confraternizações e Eventos Internos', '4.04.01', true),
    ('4.4.2',     3, 'despesa','D', 'analitica',  'Despesas Diversas / Avulsas', '4.04.99', true),
    ('4.5',       2, 'apuracao','D','sintetica',  'PROVISÃO PARA TRIBUTOS SOBRE O LUCRO', '4.05', false),
    ('4.5.1',     3, 'apuracao','D','analitica',  'IRPJ - Imposto de Renda Pessoa Jurídica', '4.05.01', true),
    ('4.5.2',     3, 'apuracao','D','analitica',  'CSLL - Contribuição Social sobre Lucro Líquido', '4.05.02', true)
  )
  INSERT INTO public.financeiro_plano_contas
    (empresa_id, codigo, nivel, natureza, natureza_saldo, tipo_conta, nome, conta_referencial_sped, aceita_lancamento, ordem, created_by)
  SELECT p_empresa_id, codigo, nivel, natureza, natureza_saldo, tipo_conta, nome, sped, aceita,
         row_number() OVER (ORDER BY codigo)::int * 10, v_user
  FROM dados
  ON CONFLICT (empresa_id, codigo) DO NOTHING;

  GET DIAGNOSTICS v_inseridas = ROW_COUNT;

  -- Resolver parent_id em cascata por codigo
  UPDATE public.financeiro_plano_contas filho
  SET parent_id = pai.id
  FROM public.financeiro_plano_contas pai
  WHERE filho.empresa_id = p_empresa_id
    AND pai.empresa_id = p_empresa_id
    AND filho.parent_id IS NULL
    AND filho.codigo LIKE '%.%'
    AND pai.codigo = substring(filho.codigo from '^(.*)\.[^.]+$');

  RETURN jsonb_build_object(
    'inseridas', v_inseridas,
    'existentes_antes', v_existentes,
    'total_apos', (SELECT count(*) FROM public.financeiro_plano_contas WHERE empresa_id = p_empresa_id)
  );
END;
$$;