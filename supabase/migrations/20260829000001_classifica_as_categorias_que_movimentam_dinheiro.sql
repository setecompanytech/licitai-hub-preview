-- ═══════════════════════════════════════════════════════════════════════════
-- Classifica as 15 categorias sem grupo que de fato movimentam dinheiro
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260828000001 herdou o grupo pela gêmea de mesmo nome e resolveu 191 das
-- 445 (conferido: 349 com grupo, 254 sem). Restaram 186 nomes distintos — e
-- classificar 186 à mão seria trabalho jogado fora, porque a esmagadora
-- maioria nunca recebeu um lançamento.
--
-- A consulta por movimento reduziu o problema a **15 nomes**, somando
-- R$ 170.934,06 em 46 lançamentos. É isso que estava caindo em "Fora do
-- resultado" no DRE.
--
-- ── Como cada uma foi classificada ──────────────────────────────────────────
--
-- MOVIMENTAÇÃO (não é resultado — muda o caixa, não o patrimônio de resultado)
--   Distribuição de Lucro aos Sócios   R$ 69.524,58   é destino do lucro, não
--                                                      despesa que o produz
--   Emprestimos e Financiamentos Rec.  R$ 49.770,00   dinheiro que entra com
--   Empréstimos Recebidos              R$ 11.955,58   obrigação de voltar
--   Aporte e Integralização de Capital R$    297,00   sócio pondo dinheiro
--
--   Somadas: R$ 131.547,16 — 77% do total. Estavam inflando receita e despesa
--   ao mesmo tempo pelo antigo atalho por natureza.
--
-- RECEITA BRUTA
--   Vendas de Gêneros Alimentícios     R$ 20.740,00   é o objeto social do
--                                                      Grupo Santa Rosa
-- DEDUÇÕES DA RECEITA
--   Simples Nacional (DAS)             R$  9.136,18   tributo sobre a receita
--                                                      bruta, não despesa
-- DESPESA OPERACIONAL
--   Salários                           R$  3.545,98
--   TLPL E Taxas De Funcionamento      R$  3.271,32
--   Assinaturas De Portais Licitações  R$    947,48   ⚠ ver nota abaixo
--   Assinaturas de Portais Licitações  R$    628,00   ⚠ mesma categoria
--   Certificado Digital                R$    350,00
--   Táxi, Transporte por App           R$     50,00
-- DESPESA FINANCEIRA
--   Tarifas Bancárias                  R$    540,87
-- RECEITA FINANCEIRA
--   Rendimentos de Aplicações          R$      0,07
--
-- ── O que NÃO entra aqui ────────────────────────────────────────────────────
-- "Outras Receitas" (R$ 177,00, 1 lançamento) fica de fora de propósito. O
-- nome não diz se é operacional ou financeira, e um lançamento de R$ 177 não
-- justifica adivinhar. Continua declarada em "Fora do resultado" até alguém
-- que conheça o lançamento decidir — que é exatamente para isso que o painel
-- passou a declarar o que ficou fora.
--
-- ── Nota: duas categorias iguais, com caixa diferente ───────────────────────
-- "Assinaturas De Portais De Licitações" e "Assinaturas de Portais de
-- Licitações" são a MESMA coisa escrita com maiúsculas diferentes, e as duas
-- têm lançamento. Este arquivo casa por `lower(btrim())`, então ambas recebem
-- o grupo — mas o DRE vai continuar exibindo DUAS linhas para a mesma despesa,
-- R$ 947,48 e R$ 628,00 em vez de R$ 1.575,48. Isso é defeito de cadastro, não
-- de classificação, e fundir categoria é operação destrutiva (move lançamento
-- de terceiros): fica registrado aqui, para decisão de quem cadastra.

UPDATE public.financeiro_categorias
   SET grupo_dre = novo.grupo
  FROM (VALUES
    ('distribuição de lucro aos sócios',      'movimentacao'),
    ('emprestimos e financiamentos recebidos','movimentacao'),
    ('empréstimos recebidos',                 'movimentacao'),
    ('aporte e integralização de capital',    'movimentacao'),
    ('vendas de gêneros alimentícios',        'receita_bruta'),
    ('simples nacional (das)',                'deducoes'),
    ('salários',                              'desp_operacional'),
    ('tlpl e taxas de funcionamento',         'desp_operacional'),
    ('assinaturas de portais de licitações',  'desp_operacional'),
    ('certificado digital',                   'desp_operacional'),
    ('táxi, transporte por app',              'desp_operacional'),
    ('tarifas bancárias',                     'desp_financeira'),
    ('rendimentos de aplicações',             'receita_financeira')
  ) AS novo(chave, grupo)
 WHERE grupo_dre IS NULL
   AND lower(btrim(nome)) = novo.chave;

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. O que ainda cai fora do resultado tendo movimento. O esperado é UMA
--    linha: "Outras Receitas", R$ 177,00.
--
--    SELECT c.nome, count(l.id) AS lancamentos, COALESCE(SUM(l.valor), 0) AS total
--      FROM public.financeiro_categorias c
--      LEFT JOIN public.financeiro_lancamentos l
--             ON l.categoria_id = c.id
--            AND l.status IN ('realizado','conciliado')
--     WHERE c.grupo_dre IS NULL
--     GROUP BY c.nome HAVING count(l.id) > 0
--     ORDER BY total DESC;
--
-- 2. O DRE agora fechando por grupo, e não mais por atalho:
--
--    SELECT competencia, grupo_dre, natureza, SUM(total)
--      FROM public.mv_financeiro_dre_mensal
--     WHERE competencia >= date_trunc('month', now()) - interval '3 months'
--     GROUP BY 1,2,3 ORDER BY 1 DESC, 2;
--
-- 3. As duas "Assinaturas" que continuam separadas por causa da caixa:
--
--    SELECT id, empresa_id, nome, grupo_dre
--      FROM public.financeiro_categorias
--     WHERE lower(btrim(nome)) = 'assinaturas de portais de licitações';
