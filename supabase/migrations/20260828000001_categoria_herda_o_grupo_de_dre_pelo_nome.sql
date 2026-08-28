-- ═══════════════════════════════════════════════════════════════════════════
-- Categoria sem grupo de DRE herda o grupo da gêmea de mesmo nome
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `financeiro_categorias` tem 603 linhas e 445 delas estão com `grupo_dre`
-- NULL — 73,8%. Não é caso raro: é a regra. O plano de contas foi classificado
-- para uma empresa e replicado sem a classificação para as outras, então
-- "13º Salário" existe como `desp_operacional` num lugar e como NULL em vários
-- outros. O nome é o mesmo; o grupo, não.
--
-- Enquanto o `grupo_dre` é NULL, o lançamento cai num balaio "outros" que o
-- DRE não sabe onde somar. Até 27/08/2026 havia um atalho no cálculo que
-- varria esse balaio para dentro de Receita Bruta ou Despesas Operacionais
-- conforme a natureza — e era ele que fazia o relatório parecer completo
-- exatamente onde estava mais incompleto. O atalho saiu. Sem ele, o que não
-- tem grupo aparece na tela como "Fora do resultado", que é honesto mas não
-- resolve.
--
-- ── Por que herdar pelo nome é seguro ───────────────────────────────────────
-- `grupo_dre` classifica o que a categoria SIGNIFICA na estrutura do
-- resultado, não uma política de quem a usa. "Aluguel" é despesa operacional
-- em qualquer empresa; não há decisão do assinante embutida nisso.
--
-- E a base confirma que não há ambiguidade. Esta consulta devolveu ZERO linhas
-- em 28/08/2026 — nenhum nome carrega dois grupos diferentes:
--
--   SELECT lower(btrim(nome)), array_agg(DISTINCT grupo_dre)
--     FROM public.financeiro_categorias WHERE grupo_dre IS NOT NULL
--    GROUP BY 1 HAVING count(DISTINCT grupo_dre) > 1;
--
-- ── O que este arquivo NÃO faz ──────────────────────────────────────────────
-- Só preenche NULL. Nunca sobrescreve grupo já gravado — quem classificou à
-- mão continua mandando.
--
-- E alcança 191 das 445. As outras 254 (186 nomes distintos) não têm gêmea
-- classificada em lugar nenhum, e para elas não existe resposta derivável:
-- inventar um grupo seria pior do que deixar em branco, porque um número
-- errado dentro do resultado não se distingue de um certo. Elas continuam
-- aparecendo em "Fora do resultado" até alguém classificá-las. O roteiro para
-- descobrir QUAIS importam está no fim.

UPDATE public.financeiro_categorias AS destino
   SET grupo_dre = fonte.grupo_dre
  FROM (
    SELECT DISTINCT lower(btrim(nome)) AS chave, grupo_dre
      FROM public.financeiro_categorias
     WHERE grupo_dre IS NOT NULL
  ) AS fonte
 WHERE destino.grupo_dre IS NULL
   AND lower(btrim(destino.nome)) = fonte.chave;

-- O DRE lê de uma materialized view: sem o refresh, a classificação nova só
-- apareceria no próximo agendamento.
REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Quanto sobrou sem grupo (o esperado é 254):
--
--    SELECT count(*) FILTER (WHERE grupo_dre IS NULL) AS sem_grupo,
--           count(*) FILTER (WHERE grupo_dre IS NOT NULL) AS com_grupo
--      FROM public.financeiro_categorias;
--
-- 2. Os nomes que sobraram, ordenados pelo que de fato movimenta dinheiro.
--    Classificar os 186 na mão é trabalho inútil: a maioria não tem
--    lançamento nenhum. Esta lista diz por onde começar.
--
--    SELECT c.nome, count(l.id) AS lancamentos, COALESCE(SUM(l.valor), 0) AS total
--      FROM public.financeiro_categorias c
--      LEFT JOIN public.financeiro_lancamentos l
--             ON l.categoria_id = c.id
--            AND l.status IN ('realizado','conciliado')
--     WHERE c.grupo_dre IS NULL
--     GROUP BY c.nome
--    HAVING count(l.id) > 0
--     ORDER BY total DESC;
--
-- 3. O que ainda fica fora do resultado, por competência:
--
--    SELECT competencia, natureza, count(*), SUM(total)
--      FROM public.mv_financeiro_dre_mensal
--     WHERE grupo_dre IS NULL
--     GROUP BY 1,2 ORDER BY 1 DESC;
