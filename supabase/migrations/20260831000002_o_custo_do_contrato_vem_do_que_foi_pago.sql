-- ═══════════════════════════════════════════════════════════════════════════
-- O custo do contrato vem do que foi pago
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Havia dois livros de custo para o mesmo dinheiro:
--
--   financeiro_lancamentos (a_pagar)   quem PAGA alimenta. Sustenta caixa e DRE.
--   contrato_custos                    quem administra o contrato alimenta.
--                                      Sustenta a margem do Dashboard.
--
-- Sem vínculo nenhum entre eles. A mesma compra digitada duas vezes: uma
-- porque precisa ser paga, outra porque precisa ser atribuída.
--
-- A varredura de 31/08/2026 mediu o estrago antes de mexer, e o resultado foi
-- melhor que o esperado:
--
--   custos_digitados          0
--   total_digitado            R$ 0,00
--   pagar_ligado_a_contrato   0
--   pares_por_valor           0
--   pares_por_nota            0
--
-- `contrato_custos` está VAZIA. Nada a conciliar, nada a migrar — e a
-- explicação de a margem do 008/2026 aparecer como 0,0%.
--
-- Que a tabela esteja vazia num app em produção, com uma tela inteira de
-- regimes tributários por trás dela, é o próprio diagnóstico: o Financeiro TEM
-- de ser preenchido, senão não se paga; o segundo livro não tem essa força, e
-- ninguém é cobrado por deixá-lo vazio.
--
-- ── A repartição, e por que não é sincronia ─────────────────────────────────
--
-- Sincronizar duas cópias é aceitar que elas existem, e cópias divergem. Cada
-- custo passa a existir UMA vez, no livro a que pertence:
--
--   DESPESA DE UM CONTRATO SÓ    fica em `financeiro_lancamentos`, com
--                                `contrato_id`. Não é copiada para lugar
--                                nenhum.
--
--   DESPESA RATEADA entre vários fica no Financeiro SEM `contrato_id`, e cada
--                                contrato recebe sua parcela em
--                                `contrato_custos`, apontando de volta pelo
--                                `lancamento_id`.
--
--   CUSTO QUE NÃO É LANÇAMENTO   mão de obra própria, rateio de despesa fixa,
--                                estimativa antes da nota — só
--                                `contrato_custos`, com `lancamento_id` nulo.

ALTER TABLE public.contrato_custos
  ADD COLUMN IF NOT EXISTS lancamento_id uuid
    REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contrato_custos.lancamento_id IS
  'A despesa do Financeiro de onde esta parcela saiu, quando ela é rateio de '
  'um pagamento que serve a vários contratos. Nulo em custo que não nasce de '
  'lançamento — mão de obra própria, rateio de despesa fixa, estimativa. '
  'ON DELETE SET NULL: apagado o lançamento, a parcela continua e fica '
  'VISÍVEL que a origem saiu do sistema.';

CREATE INDEX IF NOT EXISTS idx_contrato_custos_lancamento
  ON public.contrato_custos(lancamento_id) WHERE lancamento_id IS NOT NULL;

-- A despesa também aponta para o contrato. A coluna já existia em
-- `financeiro_lancamentos` e nenhuma tela a preenchia; o índice é novo porque
-- agora ela passa a ser consultada.
CREATE INDEX IF NOT EXISTS idx_lancamentos_contrato_pagar
  ON public.financeiro_lancamentos(contrato_id)
  WHERE contrato_id IS NOT NULL AND tipo = 'a_pagar';

-- ── O custo realizado, derivado ─────────────────────────────────────────────
--
-- Função e não coluna, pela mesma razão que `saldo_atual` do Financeiro e o
-- saldo do empenho: número de custo que se grava descola do que o originou e
-- passa a mentir em silêncio.
--
-- PAGO e COMPROMETIDO vêm separados de propósito. Uma compra empenhada e ainda
-- não paga JÁ É custo do contrato pelo regime de competência — escondê-la
-- infla a margem. Mas somá-la ao que saiu do caixa apagaria a posição de
-- caixa. São duas perguntas, e a tela responde as duas.
CREATE OR REPLACE FUNCTION public.contrato_custo_realizado(p_contrato_id uuid)
RETURNS TABLE (
  custo_pago         numeric,
  custo_comprometido numeric,
  custo_digitado     numeric,
  custo_total        numeric,
  lancamentos        integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH do_financeiro AS (
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE status IN ('realizado','conciliado')), 0) AS pago,
      COALESCE(SUM(valor) FILTER (WHERE status NOT IN ('realizado','conciliado','cancelado')), 0) AS comprometido,
      count(*)::int AS n
      FROM public.financeiro_lancamentos
     WHERE contrato_id = p_contrato_id
       AND tipo = 'a_pagar'
       AND status <> 'cancelado'
  ),
  digitado AS (
    -- A defesa contra a dupla contagem é ESTRUTURAL, não disciplinar: a
    -- parcela é ignorada quando o lançamento de onde ela veio JÁ está
    -- atribuído a este contrato. Sem isto, marcar as duas coisas contaria o
    -- mesmo dinheiro duas vezes, e a margem pioraria sem nada ter mudado no
    -- mundo real.
    SELECT COALESCE(SUM(c.valor), 0) AS total
      FROM public.contrato_custos c
      LEFT JOIN public.financeiro_lancamentos l ON l.id = c.lancamento_id
     WHERE c.contrato_id = p_contrato_id
       AND (l.id IS NULL OR l.contrato_id IS DISTINCT FROM p_contrato_id)
  )
  SELECT f.pago,
         f.comprometido,
         d.total,
         f.pago + f.comprometido + d.total,
         f.n
    FROM do_financeiro f CROSS JOIN digitado d;
$$;

COMMENT ON FUNCTION public.contrato_custo_realizado(uuid) IS
  'O que o contrato custou de verdade: despesas do Financeiro atribuídas a '
  'ele, mais os custos que não nascem de lançamento. Pago e comprometido vêm '
  'separados — o comprometido já é custo pelo regime de competência, mas não '
  'saiu do caixa. Parcela cujo lançamento já está atribuído ao contrato é '
  'ignorada: a dupla contagem é impedida aqui, não pela disciplina de quem '
  'preenche.';

GRANT EXECUTE ON FUNCTION public.contrato_custo_realizado(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Custo por contrato, com a receita ao lado:
--
--    SELECT c.numero_contrato, c.valor_global, c.valor_consumido AS faturado, r.*
--      FROM public.contratos c
--     CROSS JOIN LATERAL public.contrato_custo_realizado(c.id) r
--     WHERE r.custo_total > 0
--     ORDER BY r.custo_total DESC;
--
-- 2. A dupla contagem, se alguém tentar produzi-la à mão — deve dar zero:
--
--    SELECT count(*)
--      FROM public.contrato_custos c
--      JOIN public.financeiro_lancamentos l ON l.id = c.lancamento_id
--     WHERE l.contrato_id = c.contrato_id;
--
--    Linhas aqui NÃO são erro de dados: a função já as ignora. São sinal de
--    que alguém atribuiu dos dois jeitos, e a parcela virou letra morta.
