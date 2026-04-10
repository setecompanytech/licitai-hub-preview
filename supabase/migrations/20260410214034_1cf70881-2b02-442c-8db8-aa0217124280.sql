
-- ══════════════════════════════════════════════════════════
-- 1. CONFIGURAÇÃO FISCAL DA EMPRESA
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fin_config_fiscal (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id      UUID REFERENCES public.empresas(id) UNIQUE,
    crt             SMALLINT NOT NULL DEFAULT 1,
    regime_desc     TEXT GENERATED ALWAYS AS (
        CASE crt
            WHEN 1 THEN 'Simples Nacional'
            WHEN 2 THEN 'Simples Nacional - Excesso de Sublimite'
            WHEN 3 THEN 'Lucro Real / Lucro Presumido'
            WHEN 4 THEN 'MEI'
        END
    ) STORED,
    cnpj            TEXT NOT NULL DEFAULT '',
    ie              TEXT,
    im              TEXT,
    cnae_principal  TEXT,
    logradouro      TEXT,
    numero          TEXT,
    complemento     TEXT,
    bairro          TEXT,
    cep             TEXT,
    municipio       TEXT,
    cod_municipio   INTEGER,
    uf              CHAR(2),
    cod_pais        INTEGER DEFAULT 1058,
    serie_nfe       SMALLINT DEFAULT 1,
    proximo_nf      INTEGER DEFAULT 1,
    ambiente        SMALLINT DEFAULT 2,
    tipo_impressao  SMALLINT DEFAULT 1,
    tipo_emissao    SMALLINT DEFAULT 1,
    cert_serial     TEXT,
    cert_validade   DATE,
    cert_tipo       TEXT DEFAULT 'A1',
    contador_nome   TEXT,
    contador_cpf    TEXT,
    contador_crc    TEXT,
    cfop_padrao_servico TEXT DEFAULT '5.933',
    pis_cst_padrao  TEXT DEFAULT '07',
    cofins_cst_padrao TEXT DEFAULT '07',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fin_config_fiscal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_config_fiscal_select" ON public.fin_config_fiscal
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_config_fiscal_insert" ON public.fin_config_fiscal
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_config_fiscal_update" ON public.fin_config_fiscal
    FOR UPDATE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

-- ══════════════════════════════════════════════════════════
-- 2. PLANO DE CONTAS (hierárquico 3 níveis)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fin_plano_contas (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id      UUID REFERENCES public.empresas(id),
    codigo          TEXT NOT NULL,
    nome            TEXT NOT NULL,
    tipo            TEXT NOT NULL,
    natureza        TEXT NOT NULL,
    nivel           SMALLINT DEFAULT 1,
    pai_id          UUID REFERENCES public.fin_plano_contas(id),
    cor             TEXT DEFAULT '#6B7590',
    aceita_lancamentos BOOLEAN DEFAULT TRUE,
    ativo           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fin_plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_plano_contas_select" ON public.fin_plano_contas
    FOR SELECT TO authenticated
    USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_plano_contas_insert" ON public.fin_plano_contas
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_plano_contas_update" ON public.fin_plano_contas
    FOR UPDATE TO authenticated
    USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_plano_contas_delete" ON public.fin_plano_contas
    FOR DELETE TO authenticated
    USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

-- Plano de contas padrão (sem empresa_id = global)
INSERT INTO public.fin_plano_contas
(codigo, nome, tipo, natureza, nivel, aceita_lancamentos) VALUES
('3', 'RECEITAS', 'receita_bruta', 'credora', 1, FALSE),
('3.1', 'Receita Bruta Operacional', 'receita_bruta', 'credora', 2, FALSE),
('3.1.01','Receita de Contratos Públicos', 'receita_bruta', 'credora', 3, TRUE),
('3.1.02','Receita de Serviços Prestados', 'receita_bruta', 'credora', 3, TRUE),
('3.1.03','Comissões e Honorários Recebidos','receita_bruta', 'credora', 3, TRUE),
('3.2', 'Deduções da Receita', 'deducoes_receita', 'devedora', 2, FALSE),
('3.2.01','ISS sobre Serviços', 'deducoes_receita', 'devedora', 3, TRUE),
('3.2.02','PIS sobre Receita', 'deducoes_receita', 'devedora', 3, TRUE),
('3.2.03','COFINS sobre Receita', 'deducoes_receita', 'devedora', 3, TRUE),
('3.2.04','Simples Nacional sobre Receita', 'deducoes_receita', 'devedora', 3, TRUE),
('3.3', 'Receitas Financeiras', 'receita_financeira', 'credora', 2, FALSE),
('3.3.01','Rendimentos de Aplicações', 'receita_financeira', 'credora', 3, TRUE),
('3.3.02','Juros Recebidos', 'receita_financeira', 'credora', 3, TRUE),
('3.3.03','Descontos Obtidos', 'receita_financeira', 'credora', 3, TRUE),
('4', 'DESPESAS', 'despesa_operacional', 'devedora', 1, FALSE),
('4.1', 'Custos dos Serviços Prestados', 'custo_produto', 'devedora', 2, FALSE),
('4.1.01','Mão de Obra Direta', 'custo_produto', 'devedora', 3, TRUE),
('4.1.02','Subcontratações', 'custo_produto', 'devedora', 3, TRUE),
('4.1.03','Materiais e Insumos', 'custo_produto', 'devedora', 3, TRUE),
('4.2', 'Despesas com Pessoal', 'despesa_operacional', 'devedora', 2, FALSE),
('4.2.01','Salários e Ordenados', 'despesa_operacional', 'devedora', 3, TRUE),
('4.2.02','Encargos Sociais (INSS+FGTS)', 'despesa_operacional', 'devedora', 3, TRUE),
('4.2.03','Benefícios (VR/VA/PS)', 'despesa_operacional', 'devedora', 3, TRUE),
('4.2.04','Rescisões Trabalhistas', 'despesa_operacional', 'devedora', 3, TRUE),
('4.2.05','Comissões e Honorários Pagos', 'despesa_operacional', 'devedora', 3, TRUE),
('4.3', 'Despesas Administrativas', 'despesa_operacional', 'devedora', 2, FALSE),
('4.3.01','Aluguel e Ocupação', 'despesa_operacional', 'devedora', 3, TRUE),
('4.3.02','Serviços de Terceiros', 'despesa_operacional', 'devedora', 3, TRUE),
('4.3.03','Sistemas e Assinaturas', 'despesa_operacional', 'devedora', 3, TRUE),
('4.3.04','Hospedagem e Email', 'despesa_operacional', 'devedora', 3, TRUE),
('4.3.05','Despesas com Licitações', 'despesa_operacional', 'devedora', 3, TRUE),
('4.3.06','Despesas de Viagem', 'despesa_operacional', 'devedora', 3, TRUE),
('4.4', 'Despesas Tributárias', 'despesa_operacional', 'devedora', 2, FALSE),
('4.4.01','IRPJ / CSLL', 'despesa_operacional', 'devedora', 3, TRUE),
('4.4.02','ISS', 'despesa_operacional', 'devedora', 3, TRUE),
('4.4.03','Simples Nacional (DAS)', 'despesa_operacional', 'devedora', 3, TRUE),
('4.4.04','INSS Patronal', 'despesa_operacional', 'devedora', 3, TRUE),
('4.4.05','Outros Tributos', 'despesa_operacional', 'devedora', 3, TRUE),
('4.5', 'Despesas Financeiras', 'despesa_financeira', 'devedora', 2, FALSE),
('4.5.01','Tarifas Bancárias', 'despesa_financeira', 'devedora', 3, TRUE),
('4.5.02','Juros sobre Empréstimos', 'despesa_financeira', 'devedora', 3, TRUE),
('4.5.03','IOF', 'despesa_financeira', 'devedora', 3, TRUE),
('4.5.04','Multas e Juros Pagos', 'despesa_financeira', 'devedora', 3, TRUE)
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- 3. ITENS DA NF-e
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fin_nfe_itens (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nfe_id      UUID REFERENCES public.fin_notas_fiscais(id) ON DELETE CASCADE,
    n_item      SMALLINT NOT NULL,
    c_prod      TEXT,
    c_ean       TEXT,
    x_prod      TEXT NOT NULL,
    ncm         TEXT,
    cest        TEXT,
    cfop        TEXT NOT NULL DEFAULT '5102',
    u_com       TEXT,
    q_com       NUMERIC(15,4),
    v_un_com    NUMERIC(15,10),
    v_prod      NUMERIC(15,2),
    v_desc      NUMERIC(15,2) DEFAULT 0,
    v_frete     NUMERIC(15,2) DEFAULT 0,
    ind_tot     SMALLINT DEFAULT 1,
    orig        SMALLINT DEFAULT 0,
    cst_icms    TEXT,
    csosn       TEXT,
    v_bc_icms   NUMERIC(15,2) DEFAULT 0,
    p_icms      NUMERIC(5,2) DEFAULT 0,
    v_icms      NUMERIC(15,2) DEFAULT 0,
    v_bc_st     NUMERIC(15,2) DEFAULT 0,
    p_icms_st   NUMERIC(5,2) DEFAULT 0,
    v_icms_st   NUMERIC(15,2) DEFAULT 0,
    p_red_bc    NUMERIC(5,2) DEFAULT 0,
    cst_ipi     TEXT,
    v_bc_ipi    NUMERIC(15,2) DEFAULT 0,
    p_ipi       NUMERIC(5,2) DEFAULT 0,
    v_ipi       NUMERIC(15,2) DEFAULT 0,
    cst_pis     TEXT NOT NULL DEFAULT '07',
    v_bc_pis    NUMERIC(15,2) DEFAULT 0,
    p_pis       NUMERIC(5,4) DEFAULT 0,
    v_pis       NUMERIC(15,2) DEFAULT 0,
    cst_cofins  TEXT NOT NULL DEFAULT '07',
    v_bc_cofins NUMERIC(15,2) DEFAULT 0,
    p_cofins    NUMERIC(5,4) DEFAULT 0,
    v_cofins    NUMERIC(15,2) DEFAULT 0,
    cst_ibs_cbs TEXT,
    c_class_trib TEXT,
    v_bc_ibs    NUMERIC(15,2) DEFAULT 0,
    p_ibs_uf    NUMERIC(7,4) DEFAULT 0,
    p_ibs_mun   NUMERIC(7,4) DEFAULT 0,
    p_cbs       NUMERIC(7,4) DEFAULT 0,
    v_ibs       NUMERIC(15,2) DEFAULT 0,
    v_cbs       NUMERIC(15,2) DEFAULT 0,
    c_serv_iss  TEXT,
    v_bc_iss    NUMERIC(15,2) DEFAULT 0,
    p_iss       NUMERIC(5,2) DEFAULT 0,
    v_iss       NUMERIC(15,2) DEFAULT 0,
    v_deducao   NUMERIC(15,2) DEFAULT 0,
    v_iss_retido NUMERIC(15,2) DEFAULT 0,
    ind_iss_ret SMALLINT DEFAULT 2,
    inf_ad_prod TEXT
);

ALTER TABLE public.fin_nfe_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_nfe_itens_select" ON public.fin_nfe_itens
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.fin_notas_fiscais nf
        WHERE nf.id = nfe_id
        AND public.is_empresa_member(auth.uid(), nf.empresa_id)
    ));

CREATE POLICY "fin_nfe_itens_insert" ON public.fin_nfe_itens
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.fin_notas_fiscais nf
        WHERE nf.id = nfe_id
        AND public.is_empresa_member(auth.uid(), nf.empresa_id)
    ));

CREATE POLICY "fin_nfe_itens_update" ON public.fin_nfe_itens
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.fin_notas_fiscais nf
        WHERE nf.id = nfe_id
        AND public.is_empresa_member(auth.uid(), nf.empresa_id)
    ));

CREATE POLICY "fin_nfe_itens_delete" ON public.fin_nfe_itens
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.fin_notas_fiscais nf
        WHERE nf.id = nfe_id
        AND public.is_empresa_member(auth.uid(), nf.empresa_id)
    ));

-- ══════════════════════════════════════════════════════════
-- 4. ADICIONAR COLUNAS FALTANTES EM TABELAS EXISTENTES
-- ══════════════════════════════════════════════════════════

-- fin_contas: banco_ispb
ALTER TABLE public.fin_contas ADD COLUMN IF NOT EXISTS banco_ispb TEXT;

-- fin_pessoas: campos fiscais expandidos
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS pessoa_tipo TEXT DEFAULT 'juridica';
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS im TEXT;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS cod_municipio INTEGER;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS ind_ie_dest SMALLINT DEFAULT 9;
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(15,2);
ALTER TABLE public.fin_pessoas ADD COLUMN IF NOT EXISTS prazo_padrao_dias INTEGER DEFAULT 30;

-- fin_notas_fiscais: campos NF-e 4.0 completos
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS modelo SMALLINT DEFAULT 55;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS finalidade SMALLINT DEFAULT 1;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS nat_op TEXT DEFAULT 'PRESTAÇÃO DE SERVIÇO';
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS cfop_principal TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS data_saida_entrada TIMESTAMPTZ;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS ie_emitente TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS crt_emitente SMALLINT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS cpf_dest TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS ie_dest TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS uf_dest CHAR(2);
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS email_dest TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS ind_ie_dest SMALLINT DEFAULT 9;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_bc NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_frete NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_seg NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_desc NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_trib_aprox NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_ibs NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_cbs NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS v_is NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS ir_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS csll_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS pis_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS cofins_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS inss_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS iss_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS codigo_status INTEGER;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS motivo_status TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMPTZ;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS protocolo_cancel TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS motivo_cancel TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS carta_correcao TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS protocolo_cce TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS xml_autorizacao TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS xml_cancelamento TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS danfe_url TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS importada BOOLEAN DEFAULT FALSE;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS inf_compl TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS inf_adic_fisco TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS vinculo_contrato_ref TEXT;
ALTER TABLE public.fin_notas_fiscais ADD COLUMN IF NOT EXISTS created_by UUID;

-- fin_contas_pagar: campos expandidos
ALTER TABLE public.fin_contas_pagar ADD COLUMN IF NOT EXISTS plano_conta_id UUID REFERENCES public.fin_plano_contas(id);
ALTER TABLE public.fin_contas_pagar ADD COLUMN IF NOT EXISTS centro_custo TEXT;
ALTER TABLE public.fin_contas_pagar ADD COLUMN IF NOT EXISTS grupo_parcela_id UUID;
ALTER TABLE public.fin_contas_pagar ADD COLUMN IF NOT EXISTS edital_id UUID;

-- fin_contas_receber: campos expandidos
ALTER TABLE public.fin_contas_receber ADD COLUMN IF NOT EXISTS plano_conta_id UUID REFERENCES public.fin_plano_contas(id);
ALTER TABLE public.fin_contas_receber ADD COLUMN IF NOT EXISTS centro_custo TEXT;
ALTER TABLE public.fin_contas_receber ADD COLUMN IF NOT EXISTS inss_retido NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.fin_contas_receber ADD COLUMN IF NOT EXISTS edital_id UUID;

-- fin_movimentacoes: tipo_transacao
ALTER TABLE public.fin_movimentacoes ADD COLUMN IF NOT EXISTS tipo_transacao TEXT DEFAULT 'outros';

-- fin_comissoes: campos expandidos
ALTER TABLE public.fin_comissoes ADD COLUMN IF NOT EXISTS edital_id UUID;
ALTER TABLE public.fin_comissoes ADD COLUMN IF NOT EXISTS conta_pagar_id UUID;

-- ══════════════════════════════════════════════════════════
-- 5. ÍNDICES
-- ══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_nfe_empresa_v2 ON public.fin_notas_fiscais(empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_nfe_status_v2 ON public.fin_notas_fiscais(empresa_id, status_sefaz);
CREATE INDEX IF NOT EXISTS idx_nfe_manifesto_v2 ON public.fin_notas_fiscais(empresa_id, manifesto);
CREATE INDEX IF NOT EXISTS idx_nfe_cnpj_emit ON public.fin_notas_fiscais(cnpj_emitente);
CREATE INDEX IF NOT EXISTS idx_cp_vencto_v2 ON public.fin_contas_pagar(empresa_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_status_v2 ON public.fin_contas_pagar(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_mov_conta_v2 ON public.fin_movimentacoes(conta_id, data_lancamento DESC);
CREATE INDEX IF NOT EXISTS idx_mov_fitid_v2 ON public.fin_movimentacoes(fitid) WHERE fitid IS NOT NULL;

-- ══════════════════════════════════════════════════════════
-- 6. VIEWS ANALÍTICAS
-- ══════════════════════════════════════════════════════════

-- Saldo em tempo real por conta
CREATE OR REPLACE VIEW public.vw_saldo_contas AS
SELECT
    c.id, c.empresa_id, c.nome, c.tipo, c.banco_nome, c.banco_codigo,
    c.agencia, c.numero_conta, c.saldo_inicial, c.limite_credito, c.ativo,
    c.saldo_inicial + COALESCE(
        SUM(CASE
            WHEN m.tipo_lancamento IN ('credito','transf_entrada') THEN m.valor
            WHEN m.tipo_lancamento IN ('debito','transf_saida') THEN -m.valor
            ELSE 0 END
        ), 0
    ) AS saldo_atual,
    c.saldo_inicial + COALESCE(
        SUM(CASE
            WHEN m.tipo_lancamento IN ('credito','transf_entrada') THEN m.valor
            WHEN m.tipo_lancamento IN ('debito','transf_saida') THEN -m.valor
            ELSE 0 END
        ), 0
    ) + COALESCE(c.limite_credito, 0) AS saldo_disponivel,
    COUNT(m.id) FILTER (WHERE m.situacao = 'nao_conciliado') AS pendentes_conc
FROM public.fin_contas c
LEFT JOIN public.fin_movimentacoes m ON m.conta_id = c.id
GROUP BY c.id, c.empresa_id, c.nome, c.tipo, c.banco_nome, c.banco_codigo,
         c.agencia, c.numero_conta, c.saldo_inicial, c.limite_credito, c.ativo;

-- DRE mensal
CREATE OR REPLACE VIEW public.vw_dre_mensal AS
WITH receitas AS (
    SELECT empresa_id,
        DATE_TRUNC('month', data_recebimento)::DATE AS mes,
        plano_conta_id,
        SUM(valor_recebido) AS valor
    FROM public.fin_contas_receber
    WHERE status = 'recebido'
    GROUP BY 1,2,3
),
despesas AS (
    SELECT empresa_id,
        DATE_TRUNC('month', data_pagamento)::DATE AS mes,
        plano_conta_id,
        SUM(valor_pago) AS valor
    FROM public.fin_contas_pagar
    WHERE status = 'pago'
    GROUP BY 1,2,3
)
SELECT
    r.empresa_id, r.mes,
    pc.codigo, pc.nome AS conta, pc.tipo,
    r.valor AS total
FROM receitas r
JOIN public.fin_plano_contas pc ON pc.id = r.plano_conta_id
UNION ALL
SELECT
    d.empresa_id, d.mes,
    pc.codigo, pc.nome AS conta, pc.tipo,
    d.valor AS total
FROM despesas d
JOIN public.fin_plano_contas pc ON pc.id = d.plano_conta_id
ORDER BY mes DESC, codigo;

-- Fluxo de Caixa projetado
CREATE OR REPLACE VIEW public.vw_fluxo_projetado AS
SELECT
    empresa_id,
    data_vencimento AS data,
    'pagar' AS tipo,
    favorecido_nome AS descricao,
    -valor_documento AS valor
FROM public.fin_contas_pagar
WHERE status IN ('em_aberto','aprovado','aberto')
UNION ALL
SELECT
    empresa_id,
    data_vencimento AS data,
    'receber' AS tipo,
    cliente_nome AS descricao,
    valor_documento AS valor
FROM public.fin_contas_receber
WHERE status IN ('em_aberto','recebido_parcial')
ORDER BY data;

-- NF-e sem manifestação
CREATE OR REPLACE VIEW public.vw_nfe_pendentes_manifesto AS
SELECT
    nf.empresa_id,
    nf.chave_nfe AS chave_acesso,
    nf.numero_nf,
    nf.nome_emitente,
    nf.cnpj_emitente,
    nf.data_emissao,
    nf.valor_total AS v_nf,
    nf.status_sefaz,
    CURRENT_DATE - nf.data_emissao::DATE AS dias_sem_manifesto,
    CASE
        WHEN CURRENT_DATE - nf.data_emissao::DATE > 180 THEN 'PRAZO_EXPIRADO'
        WHEN CURRENT_DATE - nf.data_emissao::DATE > 120 THEN 'URGENTE'
        WHEN CURRENT_DATE - nf.data_emissao::DATE > 60 THEN 'ATENCAO'
        ELSE 'OK'
    END AS alerta_manifesto
FROM public.fin_notas_fiscais nf
WHERE nf.manifesto IS NULL
    AND nf.status_sefaz = 'autorizada'
    AND nf.tipo_nf = 'entrada';

-- Triggers de updated_at para novas tabelas
CREATE TRIGGER trg_config_fiscal_upd BEFORE UPDATE ON public.fin_config_fiscal
    FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();
