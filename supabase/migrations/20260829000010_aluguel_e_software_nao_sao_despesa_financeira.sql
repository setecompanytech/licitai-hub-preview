-- ═══════════════════════════════════════════════════════════════════════════
-- Aluguel e software não são despesa financeira
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Achado de brinde da verificação 13 (categoria repetida), aplicada horas
-- antes. Ela foi criada para encontrar duplicidade de cadastro e acabou
-- expondo outra coisa: ao listar as categorias do grupo `desp_financeira` da
-- ETHOS lado a lado, duas destoavam do resto.
--
--   Despesas Financeiras                       128 lançamentos   ✓
--   Tarifas E Serviços Bancários                41               ✓
--   Sistema De Gestão Empresarial               29               ✗
--   Outras Despesas Financeiras                 12               ✓
--   Juros De Empréstimos e Financeiamentos      11               ✓
--   Aluguel e Ocupação                          10               ✗
--   Tarifas Bancárias                            4 + 3           ✓
--   Juros E Encargos Financeiros Pagos           1               ✓
--
-- Despesa financeira é o CUSTO DO DINHEIRO — juro, tarifa, IOF, desconto
-- concedido, antecipação de recebível. Aluguel e assinatura de software são
-- custo de operar, e vão em `desp_operacional`.
--
-- Não é convenção nem preferência contábil: nenhum arcabouço classifica
-- aluguel como despesa financeira. Por isso a correção não vira coluna de
-- configuração (princípio 7 do CLAUDE.md) — é erro de cadastro, não política
-- de assinante.
--
-- ── O efeito ────────────────────────────────────────────────────────────────
-- 8 lançamentos realizados, R$ 18.229,04 — R$ 12.350,00 de aluguel e
-- R$ 5.879,04 de software. Saem do Resultado Financeiro e entram em Despesas
-- Operacionais. As DUAS linhas do DRE estavam erradas na mesma medida: uma
-- para pior, outra para melhor.
--
-- Os outros lançamentos dessas categorias estão previstos ou cancelados e
-- entram quando forem realizados — já no grupo certo.

UPDATE public.financeiro_categorias
   SET grupo_dre = 'desp_operacional'
 WHERE empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
   AND grupo_dre = 'desp_financeira'
   AND (nome ILIKE '%aluguel%' OR nome ILIKE '%sistema de gest%');

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- O grupo `desp_financeira` deve conter só custo do dinheiro:
--
--   SELECT c.nome, c.grupo_dre,
--          (SELECT count(*) FROM public.financeiro_lancamentos l
--            WHERE l.categoria_id = c.id) AS lancamentos
--     FROM public.financeiro_categorias c
--    WHERE c.empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--      AND c.grupo_dre = 'desp_financeira'
--    ORDER BY 3 DESC;
--
-- ── O que fica em aberto ────────────────────────────────────────────────────
-- A mesma varredura vale para os outros grupos — `desp_operacional`,
-- `receita_bruta`, `deducoes`, `cmv_cps` — e para as outras empresas. Trocar o
-- filtro de `grupo_dre` na consulta acima e ler a lista é o suficiente: quem
-- está no lugar errado destoa dos vizinhos.
