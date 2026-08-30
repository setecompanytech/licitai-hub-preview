-- ═══════════════════════════════════════════════════════════════════════════
-- Perna espelhada se reconhece pelo destino nulo, não pela natureza
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Erro meu, que sobreviveu à 20260827000002 e à 20260829000007 porque as duas
-- copiaram a mesma linha sem questioná-la:
--
--     WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
--       ...perna espelhada...
--     WHEN tipo = 'transferencia' AND conta_id = p_conta_id THEN -valor
--
-- A condição usa a NATUREZA para decidir se a linha é perna espelhada. Mas o
-- que distingue os dois formatos de transferência não é a natureza — é o
-- DESTINO:
--
--   perna espelhada     duas linhas, cada uma sabendo só da própria conta.
--                       `conta_destino_id` é NULO.
--   linha única         uma linha só, sabendo origem e destino.
--                       `conta_destino_id` está preenchido.
--
-- ── O que isso custou ───────────────────────────────────────────────────────
--
-- No Banpará PJ da ETHOS, em 19/03/2026:
--
--     transferencia · despesa      · MOVIMENTAÇÃO · R$ 12.000,00 → −12.000,00
--     transferencia · movimentacao · MOVIMENTAÇÃO · R$ 12.000,00 → −12.000,00
--
-- São as duas pernas da MESMA transferência. A segunda tem natureza
-- `movimentacao`, não casa com `natureza IN ('despesa','receita')`, cai na
-- regra da linha única e vira −valor. Uma transferência de R$ 12.000,00 tirou
-- R$ 24.000,00 da conta.
--
-- É também o que a conferência vinha acusando como "transferência sem par:
-- lote com 1 perna em vez de 2". O par existia; a fórmula é que não o
-- reconhecia.
--
-- ── A regra ─────────────────────────────────────────────────────────────────
-- Destino nulo é perna espelhada, e aí a natureza diz o lado — e `movimentacao`
-- não diz lado nenhum, então não conta, como em todo o resto do sistema.

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_saldo_conta(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric(15,2);
  v_movimento numeric(15,2);
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.financeiro_contas WHERE id = p_conta_id;

  SELECT COALESCE(SUM(
    CASE
      -- Saldo é o dinheiro que ESTÁ na conta. Previsto é fluxo de caixa,
      -- cancelado é nada.
      WHEN status NOT IN ('realizado','conciliado') THEN 0

      -- ── Transferência: o DESTINO diz qual dos dois formatos é ─────────────
      -- Destino nulo = perna espelhada, uma linha por conta. A natureza diz o
      -- lado, e `movimentacao` não diz lado nenhum: não conta.
      WHEN tipo = 'transferencia' AND conta_destino_id IS NULL THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE natureza
                    WHEN 'despesa' THEN -valor
                    WHEN 'receita' THEN  valor
                    ELSE 0
                  END
             ELSE 0 END

      -- Destino preenchido = linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      -- ── Título e movimento de extrato: a NATUREZA manda no sinal ──────────
      WHEN tipo IN ('a_receber','a_pagar','movimento_bancario') THEN
        CASE natureza
          WHEN 'receita' THEN  valor
          WHEN 'despesa' THEN -valor
          ELSE 0
        END

      ELSE 0
    END
  ), 0) INTO v_movimento
  FROM public.financeiro_lancamentos
  WHERE conta_id = p_conta_id OR conta_destino_id = p_conta_id;

  UPDATE public.financeiro_contas
  SET saldo_atual = COALESCE(v_saldo_inicial,0) + COALESCE(v_movimento,0), updated_at = now()
  WHERE id = p_conta_id;
END;
$$;

COMMENT ON FUNCTION public.financeiro_recalcular_saldo_conta(uuid) IS
  'saldo_atual = saldo_inicial + o que de fato entrou e saiu. Três regras: só '
  'entra o que está realizado ou conciliado; quem decide o sinal é a NATUREZA, '
  'não o tipo do documento; e transferência com `conta_destino_id` nulo é '
  'perna espelhada, não linha única — confundir os dois fez uma transferência '
  'de R$ 12.000,00 sair duas vezes da mesma conta.';

SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- A "transferência sem par" que a conferência acusava deve sumir:
--
--   SELECT c.categoria, c.descricao, c.valor
--     FROM public.empresas e
--    CROSS JOIN LATERAL public.financeiro_conferencia(e.id) c
--    WHERE c.categoria = 'transferência sem par';
--
-- E os saldos:
--
--   SELECT nome, saldo_inicial, saldo_atual FROM public.financeiro_contas
--    WHERE empresa_id = (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--    ORDER BY nome;
