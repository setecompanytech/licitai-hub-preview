
-- Drop views first
DROP VIEW IF EXISTS public.vw_fin_previsto_realizado;
DROP VIEW IF EXISTS public.vw_fin_cp_resumo;
DROP VIEW IF EXISTS public.vw_fin_saldo_contas;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.fin_movimentacoes CASCADE;
DROP TABLE IF EXISTS public.fin_contas_pagar CASCADE;
DROP TABLE IF EXISTS public.fin_contas_receber CASCADE;
DROP TABLE IF EXISTS public.fin_pessoas CASCADE;
DROP TABLE IF EXISTS public.fin_contas CASCADE;
DROP TABLE IF EXISTS public.fin_categorias CASCADE;

-- ============================================================================
-- FIN_CATEGORIAS
-- ============================================================================
CREATE TABLE public.fin_categorias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'despesa',
    cor TEXT DEFAULT '#6B7590',
    pai_id UUID,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fin_categorias ADD CONSTRAINT fin_categorias_pai_fk FOREIGN KEY (pai_id) REFERENCES public.fin_categorias(id) ON DELETE SET NULL;
ALTER TABLE public.fin_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_categorias_sel" ON public.fin_categorias FOR SELECT TO authenticated USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_categorias_ins" ON public.fin_categorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fin_categorias_upd" ON public.fin_categorias FOR UPDATE TO authenticated USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_categorias_del" ON public.fin_categorias FOR DELETE TO authenticated USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));
CREATE TRIGGER trg_fin_cat_upd BEFORE UPDATE ON public.fin_categorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.fin_categorias (nome, tipo, cor) VALUES
  ('Receitas de Contratos','receita','#15803D'),('Serviços Prestados','receita','#16A34A'),('Comissões Recebidas','receita','#22C55E'),('Rendimentos de Aplicações','receita','#4ADE80'),('Reembolsos','receita','#86EFAC'),
  ('Custos Operacionais','despesa','#DC2626'),('Despesas Administrativas','despesa','#EF4444'),('Vale Refeição','despesa','#F87171'),('Tarifas Bancárias','despesa','#FCA5A5'),('Rescisões','despesa','#B91C1C'),
  ('Compra de Serviços','despesa','#7C3AED'),('Impostos e Tributos','despesa','#6D28D9'),('Sistemas','despesa','#4C1D95'),('Hospedagem de Email','despesa','#5B21B6'),('Despesas com Licitações','despesa','#1D4ED8'),
  ('Juros sobre Empréstimos','despesa','#1E40AF'),('Água / Utilidades','despesa','#0369A1'),
  ('Caixa a Repor','transferencia','#0891B2'),('Transferência entre Contas','transferencia','#0E7490');

-- ============================================================================
-- FIN_CONTAS
-- ============================================================================
CREATE TABLE public.fin_contas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'conta_corrente',
    banco_codigo TEXT, banco_nome TEXT, banco_logo_url TEXT, agencia TEXT, numero_conta TEXT,
    saldo_inicial NUMERIC(15,2) DEFAULT 0, data_saldo_ini DATE, limite_credito NUMERIC(15,2) DEFAULT 0,
    conta_vinculada UUID REFERENCES public.fin_contas(id) ON DELETE SET NULL,
    considerar_resumo BOOLEAN DEFAULT TRUE, considerar_fluxo BOOLEAN DEFAULT TRUE, considerar_orcamento BOOLEAN DEFAULT TRUE,
    ativo BOOLEAN DEFAULT TRUE, inativo_motivo TEXT, observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fin_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_contas_sel" ON public.fin_contas FOR SELECT TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_contas_ins" ON public.fin_contas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fin_contas_upd" ON public.fin_contas FOR UPDATE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_contas_del" ON public.fin_contas FOR DELETE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE TRIGGER trg_fin_contas_upd BEFORE UPDATE ON public.fin_contas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIN_PESSOAS
-- ============================================================================
CREATE TABLE public.fin_pessoas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'fornecedor',
    razao_social TEXT NOT NULL, nome_fantasia TEXT, cnpj_cpf TEXT, ie TEXT, email TEXT, telefone TEXT,
    endereco TEXT, cidade TEXT, uf TEXT, cep TEXT, score_credito INTEGER, observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fin_pessoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_pessoas_sel" ON public.fin_pessoas FOR SELECT TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_pessoas_ins" ON public.fin_pessoas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fin_pessoas_upd" ON public.fin_pessoas FOR UPDATE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_pessoas_del" ON public.fin_pessoas FOR DELETE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE TRIGGER trg_fin_pessoas_upd BEFORE UPDATE ON public.fin_pessoas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIN_CONTAS_PAGAR
-- ============================================================================
CREATE TABLE public.fin_contas_pagar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    favorecido_id UUID REFERENCES public.fin_pessoas(id) ON DELETE SET NULL,
    favorecido_nome TEXT, numero_documento TEXT, nota_fiscal TEXT, data_emissao DATE, data_registro DATE DEFAULT CURRENT_DATE,
    categoria_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
    valor_documento NUMERIC(15,2) NOT NULL DEFAULT 0, data_vencimento DATE NOT NULL DEFAULT CURRENT_DATE, previsao_pagamento DATE,
    conta_corrente_id UUID REFERENCES public.fin_contas(id) ON DELETE SET NULL,
    parcela_numero INTEGER DEFAULT 1, parcela_total INTEGER DEFAULT 1, parcela_grupo_id UUID,
    status TEXT DEFAULT 'em_aberto', valor_pago NUMERIC(15,2), data_pagamento DATE,
    juros NUMERIC(15,2) DEFAULT 0, multa NUMERIC(15,2) DEFAULT 0, desconto NUMERIC(15,2) DEFAULT 0,
    projeto_id UUID, departamento TEXT, contrato_ref TEXT,
    origem TEXT DEFAULT 'manual', chave_nfe TEXT, codigo_barras TEXT, arquivo_url TEXT,
    ir_retido NUMERIC(15,2) DEFAULT 0, pis_retido NUMERIC(15,2) DEFAULT 0, cofins_retido NUMERIC(15,2) DEFAULT 0,
    csll_retido NUMERIC(15,2) DEFAULT 0, iss_retido NUMERIC(15,2) DEFAULT 0, inss_retido NUMERIC(15,2) DEFAULT 0,
    repeticao_tipo TEXT, repeticao_ate DATE, aprovado_por UUID, aprovado_em TIMESTAMPTZ, observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fin_contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cp_sel" ON public.fin_contas_pagar FOR SELECT TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cp_ins" ON public.fin_contas_pagar FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fin_cp_upd" ON public.fin_contas_pagar FOR UPDATE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cp_del" ON public.fin_contas_pagar FOR DELETE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE INDEX idx_fin_cp_emp ON public.fin_contas_pagar(empresa_id, data_vencimento);
CREATE INDEX idx_fin_cp_st ON public.fin_contas_pagar(empresa_id, status);
CREATE TRIGGER trg_fin_cp_upd BEFORE UPDATE ON public.fin_contas_pagar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIN_CONTAS_RECEBER
-- ============================================================================
CREATE TABLE public.fin_contas_receber (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    cliente_id UUID REFERENCES public.fin_pessoas(id) ON DELETE SET NULL,
    cliente_nome TEXT, numero_documento TEXT, nota_fiscal TEXT, data_emissao DATE, data_registro DATE DEFAULT CURRENT_DATE,
    categoria_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
    valor_documento NUMERIC(15,2) NOT NULL DEFAULT 0, data_vencimento DATE NOT NULL DEFAULT CURRENT_DATE, previsao_recebimento DATE,
    conta_corrente_id UUID REFERENCES public.fin_contas(id) ON DELETE SET NULL,
    parcela_numero INTEGER DEFAULT 1, parcela_total INTEGER DEFAULT 1, parcela_grupo_id UUID,
    status TEXT DEFAULT 'em_aberto', valor_recebido NUMERIC(15,2), data_recebimento DATE,
    juros NUMERIC(15,2) DEFAULT 0, multa NUMERIC(15,2) DEFAULT 0, desconto NUMERIC(15,2) DEFAULT 0,
    projeto_id UUID, departamento TEXT, vendedor_id UUID, vendedor_nome TEXT, contrato_ref TEXT,
    origem TEXT DEFAULT 'manual', chave_nfe TEXT, arquivo_url TEXT,
    ir_retido NUMERIC(15,2) DEFAULT 0, pis_retido NUMERIC(15,2) DEFAULT 0, cofins_retido NUMERIC(15,2) DEFAULT 0,
    csll_retido NUMERIC(15,2) DEFAULT 0, iss_retido NUMERIC(15,2) DEFAULT 0,
    repeticao_tipo TEXT, repeticao_ate DATE, observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fin_contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_cr_sel" ON public.fin_contas_receber FOR SELECT TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cr_ins" ON public.fin_contas_receber FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fin_cr_upd" ON public.fin_contas_receber FOR UPDATE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cr_del" ON public.fin_contas_receber FOR DELETE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE INDEX idx_fin_cr_emp ON public.fin_contas_receber(empresa_id, data_vencimento);
CREATE TRIGGER trg_fin_cr_upd BEFORE UPDATE ON public.fin_contas_receber FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIN_MOVIMENTACOES
-- ============================================================================
CREATE TABLE public.fin_movimentacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conta_id UUID REFERENCES public.fin_contas(id) ON DELETE CASCADE NOT NULL,
    numero_documento TEXT, tipo_lancamento TEXT NOT NULL DEFAULT 'debito',
    data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE, descricao TEXT NOT NULL DEFAULT '',
    valor NUMERIC(15,2) NOT NULL DEFAULT 0, saldo_apos NUMERIC(15,2), saldo_previsto_apos NUMERIC(15,2),
    pessoa_id UUID REFERENCES public.fin_pessoas(id) ON DELETE SET NULL, pessoa_nome TEXT, pessoa_cnpj_cpf TEXT,
    categoria_id UUID REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
    pedido_ref TEXT, vendedor_nome TEXT, projeto_nome TEXT,
    conta_pagar_id UUID REFERENCES public.fin_contas_pagar(id) ON DELETE SET NULL,
    conta_receber_id UUID,
    tipo_documento TEXT DEFAULT 'outros', nota_fiscal TEXT, parcela_ref TEXT, nosso_numero TEXT,
    origem TEXT DEFAULT 'manual', situacao TEXT DEFAULT 'nao_conciliado',
    conciliado_em TIMESTAMPTZ, conciliado_por UUID, fitid TEXT, observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fin_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_mov_sel" ON public.fin_movimentacoes FOR SELECT TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_mov_ins" ON public.fin_movimentacoes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fin_mov_upd" ON public.fin_movimentacoes FOR UPDATE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_mov_del" ON public.fin_movimentacoes FOR DELETE TO authenticated USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE INDEX idx_fin_mov_ct ON public.fin_movimentacoes(conta_id, data_lancamento DESC);
CREATE INDEX idx_fin_mov_emp ON public.fin_movimentacoes(empresa_id, data_lancamento DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_fin_saldo_contas WITH (security_invoker = true) AS
SELECT c.id, c.empresa_id, c.nome, c.tipo, c.banco_nome, c.banco_logo_url, c.banco_codigo, c.agencia, c.numero_conta, c.limite_credito, c.ativo, c.saldo_inicial,
  c.saldo_inicial + COALESCE(SUM(CASE WHEN m.tipo_lancamento IN ('credito','transferencia_entrada') THEN m.valor WHEN m.tipo_lancamento IN ('debito','transferencia_saida') THEN -m.valor ELSE 0 END), 0) AS saldo_atual,
  COUNT(m.id) FILTER (WHERE m.situacao = 'nao_conciliado') AS pendentes_conciliacao
FROM public.fin_contas c LEFT JOIN public.fin_movimentacoes m ON m.conta_id = c.id WHERE c.ativo = TRUE GROUP BY c.id;

CREATE OR REPLACE VIEW public.vw_fin_cp_resumo WITH (security_invoker = true) AS
SELECT empresa_id, COUNT(*) FILTER (WHERE data_vencimento < CURRENT_DATE AND status = 'em_aberto') AS atrasadas, COUNT(*) FILTER (WHERE data_vencimento = CURRENT_DATE AND status = 'em_aberto') AS vencem_hoje, COUNT(*) FILTER (WHERE data_vencimento > CURRENT_DATE AND status = 'em_aberto') AS a_vencer, COALESCE(SUM(valor_documento) FILTER (WHERE status = 'em_aberto'), 0) AS total_em_aberto
FROM public.fin_contas_pagar GROUP BY empresa_id;

CREATE OR REPLACE VIEW public.vw_fin_previsto_realizado WITH (security_invoker = true) AS
SELECT empresa_id, DATE_TRUNC('month', data_vencimento)::DATE AS mes, 'pagar' AS tipo, COALESCE(SUM(valor_documento), 0) AS previsto, COALESCE(SUM(valor_pago), 0) AS realizado FROM public.fin_contas_pagar WHERE status NOT IN ('cancelado') GROUP BY empresa_id, mes
UNION ALL
SELECT empresa_id, DATE_TRUNC('month', data_vencimento)::DATE AS mes, 'receber' AS tipo, COALESCE(SUM(valor_documento), 0) AS previsto, COALESCE(SUM(valor_recebido), 0) AS realizado FROM public.fin_contas_receber WHERE status NOT IN ('cancelado') GROUP BY empresa_id, mes;
