
-- Fix security definer views by recreating with security_invoker
CREATE OR REPLACE VIEW public.vw_fin_saldo_contas
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW public.vw_fin_dre_mensal
WITH (security_invoker = true)
AS
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
