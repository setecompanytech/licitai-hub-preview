-- ═══════════════════════════════════════════════════════════════════════════
-- O saldo que o banco declara — a única verdade que vem de fora
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Em 25/08 a conferência disse `diferenca = 0` nas catorze contas da ETHOS, e
-- eu apresentei isso como prova de que o saldo estava certo. Não era.
--
-- A conferência compara o `saldo_atual` gravado com uma re-derivação que usa a
-- MESMA fórmula. Se a fórmula está errada, os dois lados erram igual e a
-- diferença dá zero. Ela detecta DERIVA entre o gravado e o derivado; não
-- detecta erro NA derivação.
--
-- O que pegou o defeito do sinal — R$ 48.907,10 de saldo inexistente numa
-- conta só — não foi o sistema. Foi o dono do produto dizer "o saldo real na
-- conta bancária é R$ 1.914,89". Só o extrato, que é externo, poderia
-- contradizer a fórmula.
--
-- ── O dado já chegava, e era descartado ─────────────────────────────────────
-- Todo OFX traz `<LEDGERBAL><BALAMT>` — o saldo que o banco declara na data de
-- corte. O parser do front lê (`finalBalance`), e ninguém guarda. A verdade
-- externa entrava no sistema a cada importação e era jogada fora na linha
-- seguinte.
--
-- Aqui ela passa a ficar. E a conferência ganha a única checagem que não olha
-- o próprio umbigo: saldo calculado contra saldo declarado pelo banco.

ALTER TABLE public.financeiro_extratos_importados
  ADD COLUMN IF NOT EXISTS saldo_final     numeric(15,2),
  ADD COLUMN IF NOT EXISTS saldo_final_em  date;

COMMENT ON COLUMN public.financeiro_extratos_importados.saldo_final IS
  'O saldo que o BANCO declara no extrato (OFX: LEDGERBAL/BALAMT). É a única '
  'referência externa que o Financeiro tem — tudo o mais é o sistema '
  'conferindo a si mesmo. Nulo em extrato que não traga o campo.';

COMMENT ON COLUMN public.financeiro_extratos_importados.saldo_final_em IS
  'Data de corte do saldo declarado (OFX: LEDGERBAL/DTASOF). Sem ela o saldo '
  'não pode ser comparado, porque não se sabe a que momento ele se refere.';

-- ── A checagem contra a verdade de fora ─────────────────────────────────────
--
-- Devolve, por conta, o saldo declarado no extrato mais recente e o saldo que
-- o sistema calcula. Só compara quando o extrato é o ÚLTIMO e não há
-- lançamento posterior à data de corte — comparar com movimento pelo meio
-- acusaria divergência onde há apenas o tempo passando.
CREATE OR REPLACE FUNCTION public.financeiro_confronto_com_extrato(p_empresa_id uuid)
RETURNS TABLE (
  conta_id          uuid,
  conta             text,
  saldo_declarado   numeric,
  saldo_calculado   numeric,
  diferenca         numeric,
  data_corte        date,
  lancamentos_apos  integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ultimo AS (
    SELECT DISTINCT ON (x.conta_id)
           x.conta_id, x.saldo_final, x.saldo_final_em
      FROM public.financeiro_extratos_importados x
     WHERE x.empresa_id = p_empresa_id
       AND x.saldo_final IS NOT NULL
       AND x.saldo_final_em IS NOT NULL
     ORDER BY x.conta_id, x.saldo_final_em DESC
  )
  SELECT c.id,
         c.nome,
         u.saldo_final,
         c.saldo_atual,
         c.saldo_atual - u.saldo_final,
         u.saldo_final_em,
         (SELECT count(*)::int
            FROM public.financeiro_lancamentos l
           WHERE (l.conta_id = c.id OR l.conta_destino_id = c.id)
             AND l.data_competencia > u.saldo_final_em)
    FROM public.financeiro_contas c
    JOIN ultimo u ON u.conta_id = c.id
   WHERE c.empresa_id = p_empresa_id;
$$;

COMMENT ON FUNCTION public.financeiro_confronto_com_extrato(uuid) IS
  'Confronta o saldo calculado com o saldo que o BANCO declarou no último '
  'extrato importado. É a única checagem do Financeiro que não usa a própria '
  'fórmula dos dois lados — e por isso a única capaz de acusar um erro NA '
  'fórmula. `lancamentos_apos` diz quantos lançamentos existem depois da data '
  'de corte: havendo algum, a diferença é esperada e não indica defeito.';

GRANT EXECUTE ON FUNCTION public.financeiro_confronto_com_extrato(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT * FROM public.financeiro_confronto_com_extrato(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'SANTA ROSA%'));
--
-- Enquanto nenhum extrato novo for importado, o resultado vem vazio: a coluna
-- `saldo_final` só se preenche na próxima importação de OFX.
