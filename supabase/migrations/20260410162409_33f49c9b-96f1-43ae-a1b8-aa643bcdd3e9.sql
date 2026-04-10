
-- ======================================================================
-- CATEGORIAS FINANCEIRAS (plano de contas simplificado)
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_categorias (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id  UUID REFERENCES public.empresas(id),
    nome        TEXT NOT NULL,
    tipo        TEXT NOT NULL,
    cor         TEXT DEFAULT '#6B7590',
    icone       TEXT DEFAULT 'tag',
    pai_id      UUID REFERENCES public.fin_categorias(id),
    ativo       BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Validation trigger instead of CHECK constraint for tipo
CREATE OR REPLACE FUNCTION public.fin_categorias_validate_tipo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo NOT IN ('receita','despesa','transferencia') THEN
    RAISE EXCEPTION 'tipo must be one of: receita, despesa, transferencia';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_fin_categorias_validate
  BEFORE INSERT OR UPDATE ON public.fin_categorias
  FOR EACH ROW EXECUTE FUNCTION public.fin_categorias_validate_tipo();

-- ======================================================================
-- CONTAS BANCÁRIAS / CAIXAS
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_contas (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id    UUID REFERENCES public.empresas(id),
    nome          TEXT NOT NULL,
    tipo          TEXT NOT NULL DEFAULT 'corrente',
    banco         TEXT,
    agencia       TEXT,
    numero        TEXT,
    saldo_inicial NUMERIC(15,2) DEFAULT 0,
    saldo_atual   NUMERIC(15,2) DEFAULT 0,
    cor           TEXT DEFAULT '#2563EB',
    ativo         BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================
-- LANÇAMENTOS DO FLUXO DE CAIXA
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_lancamentos (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id      UUID REFERENCES public.empresas(id),
    conta_id        UUID REFERENCES public.fin_contas(id),
    categoria_id    UUID REFERENCES public.fin_categorias(id),
    tipo            TEXT NOT NULL DEFAULT 'entrada',
    descricao       TEXT NOT NULL,
    valor           NUMERIC(15,2) NOT NULL,
    data_competencia DATE NOT NULL,
    data_pagamento  DATE,
    status          TEXT DEFAULT 'pendente',
    contrato_ref    TEXT,
    documento_tipo  TEXT,
    documento_ref   TEXT,
    arquivo_url     TEXT,
    parcela_numero  INTEGER DEFAULT 1,
    parcela_total   INTEGER DEFAULT 1,
    parcela_pai_id  UUID REFERENCES public.fin_lancamentos(id),
    centro_custo_id UUID,
    observacoes     TEXT,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fin_lanc_empresa ON public.fin_lancamentos(empresa_id, data_competencia DESC);
CREATE INDEX idx_fin_lanc_status ON public.fin_lancamentos(empresa_id, status);
CREATE INDEX idx_fin_lanc_conta ON public.fin_lancamentos(conta_id, data_competencia DESC);
CREATE INDEX idx_fin_lanc_categoria ON public.fin_lancamentos(categoria_id);

-- ======================================================================
-- NOTAS FISCAIS MONITORADAS
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_notas_fiscais (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id        UUID REFERENCES public.empresas(id),
    chave_nfe         TEXT UNIQUE,
    numero_nf         TEXT,
    serie             TEXT,
    tipo_nf           TEXT DEFAULT 'nfe',
    cnpj_emitente     TEXT,
    nome_emitente     TEXT,
    uf_emitente       TEXT,
    cnpj_destinatario TEXT,
    nome_destinatario TEXT,
    valor_total       NUMERIC(15,2),
    valor_produtos    NUMERIC(15,2),
    valor_servicos    NUMERIC(15,2),
    valor_icms        NUMERIC(15,2),
    valor_ipi         NUMERIC(15,2),
    valor_pis         NUMERIC(15,2),
    valor_cofins      NUMERIC(15,2),
    valor_iss         NUMERIC(15,2),
    data_emissao      DATE,
    data_entrada      DATE,
    status_sefaz      TEXT DEFAULT 'autorizada',
    protocolo         TEXT,
    xml_url           TEXT,
    pdf_url           TEXT,
    xml_baixado       BOOLEAN DEFAULT FALSE,
    pdf_gerado        BOOLEAN DEFAULT FALSE,
    manifesto         TEXT,
    manifesto_em      TIMESTAMPTZ,
    vinculada_lancamento_id UUID REFERENCES public.fin_lancamentos(id),
    observacoes       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fin_nf_empresa ON public.fin_notas_fiscais(empresa_id, data_emissao DESC);
CREATE INDEX idx_fin_nf_cnpj_emit ON public.fin_notas_fiscais(cnpj_emitente);
CREATE INDEX idx_fin_nf_status ON public.fin_notas_fiscais(empresa_id, status_sefaz);

-- ======================================================================
-- COMISSÕES
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_comissoes (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id        UUID REFERENCES public.empresas(id),
    usuario_id        UUID,
    nome_comissionado TEXT NOT NULL,
    tipo_origem       TEXT DEFAULT 'manual',
    contrato_ref      TEXT,
    valor_base        NUMERIC(15,2),
    percentual        NUMERIC(5,2),
    valor_comissao    NUMERIC(15,2) NOT NULL,
    status            TEXT DEFAULT 'a_pagar',
    data_competencia  DATE NOT NULL,
    data_pagamento    DATE,
    lancamento_id     UUID REFERENCES public.fin_lancamentos(id),
    observacoes       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================
-- CENTROS DE CUSTO
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_centros_custo (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id  UUID REFERENCES public.empresas(id),
    nome        TEXT NOT NULL,
    codigo      TEXT,
    descricao   TEXT,
    ativo       BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Link centro_custo_id FK
ALTER TABLE public.fin_lancamentos
    ADD CONSTRAINT fk_fin_lanc_centro_custo
    FOREIGN KEY (centro_custo_id) REFERENCES public.fin_centros_custo(id);

-- ======================================================================
-- UPLOAD DE DOCUMENTOS FINANCEIROS
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.fin_documentos (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id    UUID REFERENCES public.empresas(id),
    tipo          TEXT NOT NULL DEFAULT 'outro',
    nome_arquivo  TEXT NOT NULL,
    arquivo_url   TEXT NOT NULL,
    tamanho_bytes INTEGER,
    status_proc   TEXT DEFAULT 'pendente',
    resultado     JSONB,
    criado_por    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================
-- VIEWS
-- ======================================================================
CREATE OR REPLACE VIEW public.vw_fin_saldo_contas AS
SELECT
    c.id,
    c.empresa_id,
    c.nome,
    c.tipo,
    c.banco,
    c.cor,
    c.saldo_inicial,
    COALESCE(
        c.saldo_inicial +
        SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor
                 WHEN l.tipo = 'saida' THEN -l.valor
                 ELSE 0 END)
    , c.saldo_inicial) AS saldo_atual
FROM public.fin_contas c
LEFT JOIN public.fin_lancamentos l
    ON l.conta_id = c.id AND l.status IN ('pago','conciliado')
WHERE c.ativo = TRUE
GROUP BY c.id, c.empresa_id, c.nome, c.tipo, c.banco, c.cor, c.saldo_inicial;

CREATE OR REPLACE VIEW public.vw_fin_dre_mensal AS
SELECT
    l.empresa_id,
    DATE_TRUNC('month', l.data_competencia)::DATE AS mes,
    cat.tipo AS tipo_categoria,
    cat.nome AS categoria,
    COUNT(*) AS qtd_lancamentos,
    SUM(l.valor) AS total
FROM public.fin_lancamentos l
JOIN public.fin_categorias cat ON cat.id = l.categoria_id
WHERE l.status IN ('pago','conciliado')
GROUP BY l.empresa_id, mes, cat.tipo, cat.nome
ORDER BY mes DESC, tipo_categoria, total DESC;

-- ======================================================================
-- TRIGGERS: updated_at
-- ======================================================================
CREATE OR REPLACE FUNCTION public.fin_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_fin_lanc_upd BEFORE UPDATE ON public.fin_lancamentos
    FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();
CREATE TRIGGER trg_fin_nf_upd BEFORE UPDATE ON public.fin_notas_fiscais
    FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

-- ======================================================================
-- RLS
-- ======================================================================
ALTER TABLE public.fin_categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_contas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_lancamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_comissoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_documentos    ENABLE ROW LEVEL SECURITY;

-- Categorias globais (empresa_id IS NULL) are readable by all authenticated users
-- Company-specific categories restricted to members
CREATE POLICY "fin_categorias_select" ON public.fin_categorias
    FOR SELECT TO authenticated
    USING (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_categorias_insert" ON public.fin_categorias
    FOR INSERT TO authenticated
    WITH CHECK (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_categorias_update" ON public.fin_categorias
    FOR UPDATE TO authenticated
    USING (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fin_categorias_delete" ON public.fin_categorias
    FOR DELETE TO authenticated
    USING (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id));

-- fin_contas
CREATE POLICY "fin_contas_select" ON public.fin_contas
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_contas_insert" ON public.fin_contas
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_contas_update" ON public.fin_contas
    FOR UPDATE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_contas_delete" ON public.fin_contas
    FOR DELETE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

-- fin_lancamentos
CREATE POLICY "fin_lancamentos_select" ON public.fin_lancamentos
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_lancamentos_insert" ON public.fin_lancamentos
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_lancamentos_update" ON public.fin_lancamentos
    FOR UPDATE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_lancamentos_delete" ON public.fin_lancamentos
    FOR DELETE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

-- fin_notas_fiscais
CREATE POLICY "fin_nf_select" ON public.fin_notas_fiscais
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_nf_insert" ON public.fin_notas_fiscais
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_nf_update" ON public.fin_notas_fiscais
    FOR UPDATE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

-- fin_comissoes
CREATE POLICY "fin_comissoes_select" ON public.fin_comissoes
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_comissoes_insert" ON public.fin_comissoes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_comissoes_update" ON public.fin_comissoes
    FOR UPDATE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

-- fin_centros_custo
CREATE POLICY "fin_cc_select" ON public.fin_centros_custo
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cc_insert" ON public.fin_centros_custo
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_cc_update" ON public.fin_centros_custo
    FOR UPDATE TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));

-- fin_documentos
CREATE POLICY "fin_docs_select" ON public.fin_documentos
    FOR SELECT TO authenticated
    USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fin_docs_insert" ON public.fin_documentos
    FOR INSERT TO authenticated
    WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

-- ======================================================================
-- CATEGORIAS PADRÃO (globais, empresa_id = NULL)
-- ======================================================================
INSERT INTO public.fin_categorias (empresa_id, nome, tipo, cor) VALUES
    (NULL, 'Receitas de Contratos',       'receita',        '#15803D'),
    (NULL, 'Comissões Recebidas',         'receita',        '#16A34A'),
    (NULL, 'Reembolsos e Devoluções',     'receita',        '#4ADE80'),
    (NULL, 'Serviços Prestados',          'receita',        '#22C55E'),
    (NULL, 'Custos Operacionais',         'despesa',        '#DC2626'),
    (NULL, 'Despesas Administrativas',    'despesa',        '#EF4444'),
    (NULL, 'Honorários e Comissões Pagas','despesa',        '#F87171'),
    (NULL, 'Impostos e Tributos',         'despesa',        '#B91C1C'),
    (NULL, 'Despesas com Licitações',     'despesa',        '#7C3AED'),
    (NULL, 'Assinaturas e Software',      'despesa',        '#6D28D9'),
    (NULL, 'Transferência entre Contas',  'transferencia',  '#2563EB');
