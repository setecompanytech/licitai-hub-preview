-- ═══════════════════════════════════════════════════════════════════════════
-- Funde as categorias duplicadas, e só as que são de fato duplicadas
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A verificação 13 achou 14 pares de categorias com o mesmo nome dentro da
-- mesma empresa. Medidos um a um, não são o mesmo caso:
--
--   12 pares  uma das duas nunca recebeu lançamento (ou nenhuma recebeu).
--             Apagar a vazia não move dinheiro nenhum.
--
--    1 par    ETHOS · Tarifas Bancárias — AS DUAS em uso, 4 e 3 lançamentos,
--             criadas no mesmo dia. Precisa mover antes de apagar.
--
--    1 par    BAQPLAST · Consultoria Empresarial — NÃO é duplicata: uma tem
--             natureza `receita` (a consultoria que a empresa vende) e outra
--             `despesa` (a que ela contrata). Mesmo nome, coisas opostas.
--             Fundir destruiria informação. Tratada à parte, no fim.
--
-- ── De onde vieram ──────────────────────────────────────────────────────────
-- Os códigos denunciam dois planos de contas concorrentes semeados um por
-- cima do outro: `5.01.01` × `4.3.01` para aluguel, `10.01` × `4.5` para
-- despesas financeiras, `6.1` × `4.5.01` para tarifas. Na ETHOS o segundo
-- plano entrou em 25/08/2026; na MULTIMIX em 02/06; na BAQPLAST em 17/07.
--
-- ── A regra de quem sobrevive ───────────────────────────────────────────────
-- Quem tem mais lançamento. Empate, a mais antiga. Quem manda é o USO, não a
-- antiguidade: a categoria que o dia a dia escolheu é a que as pessoas
-- reconhecem na tela.
--
-- ── O que impede o estrago ──────────────────────────────────────────────────
-- `financeiro_lancamentos.categoria_id` tem ON DELETE RESTRICT. Se este script
-- esquecer de repontar alguma referência, o DELETE FALHA em vez de apagar
-- dado. A rede está armada; este arquivo só não pode se apoiar nela.

-- ── 1. O que vai mudar, guardado antes ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bkp_categorias_fundidas_20260829 (
  categoria_removida uuid PRIMARY KEY,
  categoria_mantida  uuid NOT NULL,
  empresa_id         uuid NOT NULL,
  nome               text NOT NULL,
  codigo             text,
  natureza           text,
  grupo_dre          text,
  lancamentos_movidos integer NOT NULL DEFAULT 0,
  guardado_em        timestamptz NOT NULL DEFAULT now()
);

-- Só entram pares em que natureza E grupo_dre coincidem. É essa condição que
-- deixa o par da BAQPLAST de fora sozinho, sem lista de exceção escrita à mão
-- — e que protege contra o próximo caso igual que ninguém previu.
INSERT INTO public.bkp_categorias_fundidas_20260829
  (categoria_removida, categoria_mantida, empresa_id, nome, codigo, natureza, grupo_dre)
WITH duplicadas AS (
  SELECT empresa_id, lower(btrim(nome)) AS chave
    FROM public.financeiro_categorias
   GROUP BY 1, 2
  HAVING count(*) > 1
     AND count(DISTINCT natureza) = 1
     AND count(DISTINCT COALESCE(grupo_dre, '(nulo)')) = 1
),
ranqueadas AS (
  SELECT c.id, c.empresa_id, c.nome, c.codigo, c.natureza, c.grupo_dre,
         lower(btrim(c.nome)) AS chave,
         (SELECT count(*) FROM public.financeiro_lancamentos l
           WHERE l.categoria_id = c.id) AS uso,
         row_number() OVER (
           PARTITION BY c.empresa_id, lower(btrim(c.nome))
           ORDER BY (SELECT count(*) FROM public.financeiro_lancamentos l
                      WHERE l.categoria_id = c.id) DESC,
                    c.created_at ASC
         ) AS posicao
    FROM public.financeiro_categorias c
    JOIN duplicadas d ON d.empresa_id = c.empresa_id
                     AND d.chave = lower(btrim(c.nome))
)
SELECT perdedora.id, vencedora.id, perdedora.empresa_id, perdedora.nome,
       perdedora.codigo, perdedora.natureza, perdedora.grupo_dre
  FROM ranqueadas perdedora
  JOIN ranqueadas vencedora
    ON vencedora.empresa_id = perdedora.empresa_id
   AND vencedora.chave = perdedora.chave
   AND vencedora.posicao = 1
 WHERE perdedora.posicao > 1
ON CONFLICT (categoria_removida) DO NOTHING;

-- Quais lançamentos se movem, um a um. Sem isto o backup devolveria a
-- categoria e não separaria de volta os lançamentos que se juntaram — a
-- reversão seria parcial e ninguém saberia disso até precisar dela.
CREATE TABLE IF NOT EXISTS public.bkp_lancamentos_recategorizados_20260829 (
  lancamento_id      uuid PRIMARY KEY,
  categoria_anterior uuid NOT NULL,
  categoria_nova     uuid NOT NULL,
  campo              text NOT NULL,
  guardado_em        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bkp_lancamentos_recategorizados_20260829
  (lancamento_id, categoria_anterior, categoria_nova, campo)
SELECT l.id, l.categoria_id, b.categoria_mantida, 'categoria_id'
  FROM public.financeiro_lancamentos l
  JOIN public.bkp_categorias_fundidas_20260829 b ON b.categoria_removida = l.categoria_id
ON CONFLICT (lancamento_id) DO NOTHING;

-- ── 2. Reponta TODAS as referências ─────────────────────────────────────────
-- Cinco colunas apontam para categoria. Esquecer uma faz o DELETE falhar (na
-- que tem RESTRICT) ou deixar referência órfã (nas que não têm).

-- O contador vem do registro dos lançamentos, não de uma contagem ao vivo.
-- A versão anterior contava `financeiro_lancamentos` na hora: rodando o script
-- de novo, a categoria já não existia, os lançamentos já haviam se movido, e a
-- contagem sobrescrevia o número certo por zero. `bkp_lancamentos_...` tem
-- ON CONFLICT DO NOTHING e preserva o primeiro registro — dele o número não
-- foge.
UPDATE public.bkp_categorias_fundidas_20260829 b
   SET lancamentos_movidos = (
     SELECT count(*) FROM public.bkp_lancamentos_recategorizados_20260829 r
      WHERE r.categoria_anterior = b.categoria_removida
   );

UPDATE public.financeiro_lancamentos l
   SET categoria_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE l.categoria_id = b.categoria_removida;

-- O palpite da conciliação também aponta para categoria.
UPDATE public.financeiro_lancamentos l
   SET categoria_sugerida_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE l.categoria_sugerida_id = b.categoria_removida;

UPDATE public.fin_conciliacao_regras r
   SET categoria_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE r.categoria_id = b.categoria_removida;

UPDATE public.financeiro_regras_categorizacao r
   SET categoria_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE r.categoria_id = b.categoria_removida;

-- Hierarquia: categoria filha da que vai sumir passa a ser filha da que fica.
UPDATE public.financeiro_categorias c
   SET parent_id = b.categoria_mantida
  FROM public.bkp_categorias_fundidas_20260829 b
 WHERE c.parent_id = b.categoria_removida;

-- ── 3. Agora sim, apagar ────────────────────────────────────────────────────
DELETE FROM public.financeiro_categorias c
 USING public.bkp_categorias_fundidas_20260829 b
 WHERE c.id = b.categoria_removida;

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── 4. O par que NÃO era duplicata ──────────────────────────────────────────
--
-- BAQPLAST · "Consultoria Empresarial" existe duas vezes com naturezas
-- opostas: `1.02.01` é receita (a consultoria que a empresa vende) e `4.03.03`
-- é despesa (a que ela contrata). O nome igual é que confunde — e a de
-- despesa ainda está com `grupo_dre = receita_bruta`, o que somaria despesa
-- dentro da receita bruta no primeiro lançamento que recebesse.
--
-- Renomear resolve as duas coisas: o nome passa a dizer o que é, e o grupo
-- passa a ser o certo. Nenhum lançamento existe ainda, então nada se move.
UPDATE public.financeiro_categorias
   SET nome = 'Consultoria Empresarial Contratada',
       grupo_dre = 'desp_operacional'
 WHERE codigo = '4.03.03'
   AND natureza = 'despesa'
   AND lower(btrim(nome)) = 'consultoria empresarial'
   AND empresa_id = (SELECT id FROM public.empresas
                      WHERE razao_social ILIKE 'BAQPLAST%');

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. O que foi fundido, e quantos lançamentos cada fusão moveu:
--
--    SELECT nome, codigo, lancamentos_movidos
--      FROM public.bkp_categorias_fundidas_20260829
--     ORDER BY lancamentos_movidos DESC, nome;
--
--    O esperado: 13 linhas, e só "Tarifas Bancárias" com movidos > 0 (3).
--
-- 2. Não deve sobrar duplicata de natureza e grupo iguais:
--
--    SELECT e.razao_social, lower(btrim(c.nome)), count(*)
--      FROM public.financeiro_categorias c
--      JOIN public.empresas e ON e.id = c.empresa_id
--     GROUP BY 1, 2
--    HAVING count(*) > 1
--       AND count(DISTINCT c.natureza) = 1
--       AND count(DISTINCT COALESCE(c.grupo_dre, '(nulo)')) = 1;
--
-- 3. E a conferência deve parar de acusar (sobra o par da BAQPLAST, que agora
--    tem nomes distintos e portanto some também):
--
--    SELECT e.razao_social, c.categoria, c.descricao
--      FROM public.empresas e
--     CROSS JOIN LATERAL public.financeiro_conferencia(e.id) c
--     WHERE c.categoria = 'categoria repetida';
--
-- ── Para desfazer ───────────────────────────────────────────────────────────
-- Duas tabelas guardam o suficiente: `bkp_categorias_fundidas` tem a categoria
-- apagada com todos os seus campos, e `bkp_lancamentos_recategorizados` tem
-- cada lançamento que trocou de dono. A volta é completa.
--
--   -- 1. Recria as categorias apagadas
--   INSERT INTO public.financeiro_categorias
--          (id, empresa_id, nome, codigo, natureza, grupo_dre)
--   SELECT categoria_removida, empresa_id, nome, codigo, natureza, grupo_dre
--     FROM public.bkp_categorias_fundidas_20260829
--   ON CONFLICT (id) DO NOTHING;
--
--   -- 2. Devolve cada lançamento à categoria de origem
--   UPDATE public.financeiro_lancamentos l
--      SET categoria_id = b.categoria_anterior
--     FROM public.bkp_lancamentos_recategorizados_20260829 b
--    WHERE l.id = b.lancamento_id;
--
--   REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;
--
-- Quando o resultado estiver conferido e a volta não fizer mais falta:
--   DROP TABLE public.bkp_categorias_fundidas_20260829;
--   DROP TABLE public.bkp_lancamentos_recategorizados_20260829;
