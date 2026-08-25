-- =============================================================================
-- O movimento bancário respeita a própria natureza
--
-- Convenção de TODOS os caminhos que gravam lançamento (import de OFX e
-- diálogo manual): `valor` em módulo, com a coluna `natureza` dizendo se é
-- receita ou despesa. A fórmula do saldo, porém, somava `movimento_bancario`
-- sem olhar a natureza — um DÉBITO de extrato SOMAVA no saldo da conta.
--
-- O sinal mora na natureza; a fórmula passa a lê-la. Ao final, recalcula
-- todas as contas: saldos mudam onde há débitos de extrato — é a correção
-- aparecendo, não um defeito novo.
-- =============================================================================

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
      WHEN tipo = 'a_receber' AND status IN ('realizado','conciliado') THEN valor
      WHEN tipo = 'a_pagar' AND status IN ('realizado','conciliado') THEN -valor
      -- Valor é gravado em módulo por todos os caminhos; o sinal é a natureza.
      WHEN tipo = 'movimento_bancario' THEN
        CASE WHEN natureza = 'despesa' THEN -valor ELSE valor END
      WHEN tipo = 'transferencia' AND conta_id = p_conta_id THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id = p_conta_id THEN valor
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
  'saldo_atual = saldo_inicial + movimentos. Valor gravado em módulo; o sinal '
  'do movimento_bancario vem da natureza (despesa subtrai). a_receber/a_pagar '
  'realizados somam/subtraem; transferência sai da origem e entra no destino.';

-- Reaplica em todas as contas: os saldos passam a respeitar a natureza.
SELECT public.financeiro_recalcular_saldo_conta(id) FROM public.financeiro_contas;
