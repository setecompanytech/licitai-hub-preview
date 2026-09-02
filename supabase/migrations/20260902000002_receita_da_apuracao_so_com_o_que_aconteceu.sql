-- ═══════════════════════════════════════════════════════════════════════════
-- A base da apuração só leva o que aconteceu — e declara o que não classifica
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dois achados críticos da auditoria de 02/09 na mesma RPC:
--
-- C2 — a base incluía receita `previsto`: tributo sobre faturamento que ainda
--   não ocorreu (CTN, art. 43 — fato gerador é disponibilidade adquirida, não
--   expectativa), e o RBT12 inflado podia empurrar o Simples de faixa. Pior:
--   o validador filtrava só realizado/conciliado — as duas fontes discordavam
--   POR CONSTRUÇÃO e toda competência com previsto acusava divergência falsa.
--
-- A4 — receita sem `tipo_servico` era silenciosamente excluída da base
--   (tributava-se de menos, sem aviso). Agora a RPC devolve o valor em
--   `sem_classificacao` e a tela pode avisar antes de salvar.
--
-- Bônus da mesma cirurgia: perna de transferência com natureza receita nunca
-- é receita auferida — sai da base e do RBT12.

CREATE OR REPLACE FUNCTION public.financeiro_receita_competencia(
  p_empresa_id uuid,
  p_competencia date
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH faixa AS (
    SELECT date_trunc('month', p_competencia)::date AS ini,
           (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date AS fim
  ),
  rec AS (
    SELECT
      COALESCE(SUM(l.valor) FILTER (WHERE c.tipo_servico = 'comercio'), 0)::numeric AS comercio,
      COALESCE(SUM(l.valor) FILTER (WHERE c.tipo_servico = 'servico'), 0)::numeric AS servico,
      COALESCE(SUM(l.valor) FILTER (
        WHERE c.tipo_servico IS DISTINCT FROM 'comercio'
          AND c.tipo_servico IS DISTINCT FROM 'servico'
      ), 0)::numeric AS sem_classificacao,
      COALESCE(SUM(l.valor), 0)::numeric AS total
    FROM public.financeiro_lancamentos l
    LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
    , faixa f
    WHERE l.empresa_id = p_empresa_id
      AND l.natureza = 'receita'
      AND l.tipo <> 'transferencia'
      AND l.status IN ('realizado','conciliado')
      AND l.data_competencia BETWEEN f.ini AND f.fim
  ),
  rbt12 AS (
    SELECT COALESCE(SUM(l.valor), 0)::numeric AS total
    FROM public.financeiro_lancamentos l
    WHERE l.empresa_id = p_empresa_id
      AND l.natureza = 'receita'
      AND l.tipo <> 'transferencia'
      AND l.status IN ('realizado','conciliado')
      AND l.data_competencia >= (date_trunc('month', p_competencia) - interval '12 months')::date
      AND l.data_competencia < date_trunc('month', p_competencia)::date
  )
  SELECT jsonb_build_object(
    'comercio', (SELECT comercio FROM rec),
    'servico', (SELECT servico FROM rec),
    'sem_classificacao', (SELECT sem_classificacao FROM rec),
    'total', (SELECT total FROM rec),
    'rbt12', (SELECT total FROM rbt12)
  );
$$;

COMMENT ON FUNCTION public.financeiro_receita_competencia(uuid, date) IS
  'Receita da competência para a apuração: só realizado/conciliado (previsto '
  'é expectativa, não fato gerador), transferência nunca entra, e o que não '
  'tem tipo_servico vem declarado em sem_classificacao para a tela avisar em '
  'vez de tributar de menos em silêncio.';
