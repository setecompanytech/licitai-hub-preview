-- ═══════════════════════════════════════════════════════════════════════════
-- O DRE ignora transferência entre contas próprias
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dinheiro que sai de uma conta da empresa e entra em outra conta da mesma
-- empresa não é receita nem despesa: o patrimônio não mudou. Só mudou de
-- gaveta. Isso não é opinião contábil — é a definição de resultado.
--
-- A view somava `financeiro_lancamentos` sem olhar o `tipo`. O que a protegia
-- era acidente: o JOIN com `financeiro_categorias` é INTERNO, e transferência
-- normalmente não tem categoria, então ficava de fora por não ter par no
-- JOIN. Basta alguém categorizar uma transferência — por organização, por
-- engano, por um importador futuro que preencha categoria — e ela entra no
-- resultado.
--
-- Pior: o formato que a tela de lançamento grava é de DUAS pernas, uma com
-- natureza 'receita' e outra com 'despesa'. Categorizadas, elas inflam os dois
-- lados do DRE ao mesmo tempo, e a diferença entre eles continua zero. O
-- resultado final fica certo e todos os números que o compõem, errados — que
-- é o tipo de erro que ninguém encontra olhando o total.
--
-- Depender de acidente para estar certo é o mesmo que estar errado e ainda não
-- ter sido pego. A regra passa a ser explícita.

DROP MATERIALIZED VIEW IF EXISTS public.mv_financeiro_dre_mensal;

CREATE MATERIALIZED VIEW public.mv_financeiro_dre_mensal AS
SELECT
  l.empresa_id,
  date_trunc('month', l.data_competencia)::date AS competencia,
  c.grupo_dre,
  c.id AS categoria_id,
  c.nome AS categoria_nome,
  c.natureza,
  SUM(l.valor) AS total
FROM public.financeiro_lancamentos l
JOIN public.financeiro_categorias c ON c.id = l.categoria_id
WHERE l.status IN ('realizado','conciliado')
  -- Transferência entre contas próprias não é resultado, tenha categoria ou não.
  AND l.tipo <> 'transferencia'
GROUP BY l.empresa_id, date_trunc('month', l.data_competencia), c.grupo_dre, c.id, c.nome, c.natureza;

CREATE UNIQUE INDEX idx_mv_dre
  ON public.mv_financeiro_dre_mensal(empresa_id, competencia, categoria_id);

COMMENT ON MATERIALIZED VIEW public.mv_financeiro_dre_mensal IS
  'DRE mensal por categoria. Exclui transferência entre contas próprias: '
  'dinheiro que muda de gaveta não é receita nem despesa. Antes a exclusão era '
  'acidental — dependia de a transferência não ter categoria — e uma '
  'transferência categorizada inflava os dois lados do resultado ao mesmo '
  'tempo, deixando o total certo e todas as parcelas erradas.';

REFRESH MATERIALIZED VIEW public.mv_financeiro_dre_mensal;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Transferência categorizada que estava entrando no DRE (o esperado é nenhuma,
-- mas se houver, este é o valor que saiu do resultado agora):
--   SELECT c.grupo_dre, count(*), SUM(l.valor)
--     FROM public.financeiro_lancamentos l
--     JOIN public.financeiro_categorias c ON c.id = l.categoria_id
--    WHERE l.tipo = 'transferencia' AND l.status IN ('realizado','conciliado')
--    GROUP BY 1 ORDER BY 3 DESC;
