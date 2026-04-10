
-- Recriar views com security_invoker = true

CREATE OR REPLACE VIEW public.vw_saldo_contas
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW public.vw_dre_mensal
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW public.vw_fluxo_projetado
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW public.vw_nfe_pendentes_manifesto
WITH (security_invoker = true)
AS
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
