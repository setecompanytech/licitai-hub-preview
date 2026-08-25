-- ═══════════════════════════════════════════════════════════════════════════
-- O saldo passa a entender as duas formas de transferência — e a parar de
-- somar linha de outra conta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Três defeitos na mesma fórmula, achados auditando de onde saía o "saldo
-- consolidado em tempo real" da tela inicial do Financeiro.
--
-- ── 1. A TRANSFERÊNCIA ESPELHADA SE ANULAVA ─────────────────────────────────
-- Há dois caminhos para transferir entre contas, e eles gravam formatos
-- diferentes:
--
--   FinTransferencia    UMA linha: conta_id = origem, conta_destino_id = destino,
--                       natureza = 'movimentacao'.
--   LancamentoDialog    DUAS linhas espelhadas, uma por conta:
--                       A: conta_id = origem,  conta_destino_id = destino, natureza = 'despesa'
--                       B: conta_id = destino, conta_destino_id = origem,  natureza = 'receita'
--
-- A fórmula só conhecia o primeiro formato. Aplicada ao segundo, na conta de
-- origem a linha A dava −valor e a linha B dava +valor (pelo ramo do
-- conta_destino_id): líquido ZERO. O mesmo no destino. A transferência
-- simplesmente não existia para o saldo.
--
-- A tela disfarçava chamando `ajustarSaldoConta`, um UPDATE direto no
-- saldo_atual — que sobrevivia até alguém mexer em qualquer lançamento
-- daquela conta. Aí o gatilho recalculava, o ajuste evaporava, e o saldo
-- saltava sem explicação. É desta família o saldo fóssil.
--
-- O formato de duas linhas não é o errado: ele é o que faz a transferência
-- aparecer no extrato das DUAS contas. Quem estava errada era a fórmula, que
-- passa a distinguir os dois pela `natureza` — perna espelhada age só na
-- própria conta_id; linha única sai da origem e entra no destino.
--
-- ── 2. A LINHA DE OUTRA CONTA ENTRAVA NA SOMA ──────────────────────────────
-- A linha era selecionada por `conta_id = X OR conta_destino_id = X`, mas os
-- ramos de a_receber/a_pagar/movimento_bancario não conferiam QUAL das duas
-- casou. Um a_receber com conta_destino_id preenchido somava nas duas contas —
-- o mesmo dinheiro, em dois lugares.
--
-- ── 3. MOVIMENTO BANCÁRIO CANCELADO CONTAVA ────────────────────────────────
-- Os ramos a_receber/a_pagar exigem status realizado/conciliado. O do extrato
-- não exigia nada. E a conciliação grava lançamento com status 'cancelado' ao
-- ignorar um movimento (FinConciliacao). Cancelado entrava no saldo.
--
-- Mantive apenas a exclusão do 'cancelado', que é indiscutível. Movimento de
-- extrato com status 'previsto' é caso a conferir, não a decidir por migration:
-- a consulta ao pé deste arquivo mostra a distribuição.

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
      -- Perna de transferência espelhada: a natureza diz o lado, e ela só age
      -- na própria conta_id. A outra perna cuida da outra conta.
      WHEN tipo = 'transferencia' AND natureza IN ('despesa','receita') THEN
        CASE WHEN conta_id = p_conta_id
             THEN CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
             ELSE 0 END

      -- Transferência de linha única: sai da origem, entra no destino.
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id         THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN  valor

      -- Daqui para baixo, só conta o que é DESTA conta. Sem esta linha, um
      -- lançamento cujo conta_destino_id aponte para cá somaria aqui também.
      WHEN conta_id IS DISTINCT FROM p_conta_id THEN 0

      WHEN tipo = 'a_receber' AND status IN ('realizado','conciliado') THEN  valor
      WHEN tipo = 'a_pagar'   AND status IN ('realizado','conciliado') THEN -valor

      -- Valor é gravado em módulo por todos os caminhos; o sinal é a natureza.
      WHEN tipo = 'movimento_bancario' AND status IS DISTINCT FROM 'cancelado' THEN
        CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END

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
  'saldo_atual = saldo_inicial + movimentos desta conta. Transferência vem em '
  'dois formatos: perna espelhada (natureza despesa/receita, age só na própria '
  'conta_id) e linha única (natureza movimentacao, sai da origem e entra no '
  'destino). Fora transferência, só conta o que tem conta_id desta conta. '
  'Movimento de extrato cancelado não entra.';

-- Reaplica em todas as contas. Onde houver transferência espelhada o saldo
-- muda: é a correção aparecendo, não defeito novo.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- Transferências por formato (2 = espelhada, 1 = linha única):
--   SELECT origem_lote_id, count(*) AS linhas, max(valor) AS valor
--     FROM public.financeiro_lancamentos WHERE tipo = 'transferencia'
--    GROUP BY origem_lote_id ORDER BY linhas DESC;
--
-- Movimento de extrato por status — se aparecer 'previsto' com peso, é decisão
-- de negócio se deve ou não compor o saldo:
--   SELECT status, count(*), SUM(CASE WHEN natureza='despesa' THEN -valor ELSE valor END)
--     FROM public.financeiro_lancamentos WHERE tipo = 'movimento_bancario'
--    GROUP BY status ORDER BY 3 DESC;
--
-- Lançamento não-transferência com conta_destino_id (o esperado é nenhum):
--   SELECT tipo, status, count(*) FROM public.financeiro_lancamentos
--    WHERE tipo <> 'transferencia' AND conta_destino_id IS NOT NULL GROUP BY 1,2;
