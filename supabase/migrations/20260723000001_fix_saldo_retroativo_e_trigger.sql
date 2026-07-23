-- =============================================================================
-- MIGRATION: Corrige saldos retroativos e instala trigger de auto-atualização
-- Data: 2026-07-23
-- Problema: saldo_atual não era atualizado ao marcar lançamentos como realizado/
--           conciliado pois o trigger nunca foi instalado.
-- Solução:  1. Recalcula saldo_atual de todas as contas via função existente
--           2. Instala trigger para atualizações futuras automáticas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PASSO 1: Preview — estado atual antes da correção (apenas informativo)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== SALDOS ANTES DA CORREÇÃO ===';
  FOR rec IN
    SELECT
      fc.nome,
      fc.saldo_inicial,
      fc.saldo_atual,
      COALESCE(SUM(
        CASE
          WHEN fl.tipo = 'a_receber' AND fl.status IN ('realizado','conciliado') THEN fl.valor
          WHEN fl.tipo = 'a_pagar'   AND fl.status IN ('realizado','conciliado') THEN -fl.valor
          WHEN fl.tipo = 'movimento_bancario' THEN fl.valor
          ELSE 0
        END
      ), 0) AS saldo_calculado
    FROM public.financeiro_contas fc
    LEFT JOIN public.financeiro_lancamentos fl ON fl.conta_id = fc.id
    WHERE fc.ativa = true
    GROUP BY fc.id, fc.nome, fc.saldo_inicial, fc.saldo_atual
  LOOP
    RAISE NOTICE 'Conta: % | saldo_atual: % | deveria ser: % | diff: %',
      rec.nome,
      rec.saldo_atual,
      rec.saldo_inicial + rec.saldo_calculado,
      (rec.saldo_inicial + rec.saldo_calculado) - rec.saldo_atual;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- PASSO 2: Recalcula saldo_atual para TODAS as contas usando a função existente
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  conta_id uuid;
  total integer := 0;
BEGIN
  FOR conta_id IN
    SELECT id FROM public.financeiro_contas
  LOOP
    PERFORM public.financeiro_recalcular_saldo_conta(conta_id);
    total := total + 1;
  END LOOP;
  RAISE NOTICE '✓ Saldo recalculado para % conta(s).', total;
END;
$$;

-- -----------------------------------------------------------------------------
-- PASSO 3: Instala trigger para manter saldo_atual atualizado automaticamente
-- -----------------------------------------------------------------------------

-- Função do trigger: chama financeiro_recalcular_saldo_conta nas contas afetadas
CREATE OR REPLACE FUNCTION public.fn_trg_saldo_lancamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Em DELETE: recalcula a conta do registro removido
  IF TG_OP = 'DELETE' THEN
    IF OLD.conta_id IS NOT NULL THEN
      PERFORM public.financeiro_recalcular_saldo_conta(OLD.conta_id);
    END IF;
    IF OLD.conta_destino_id IS NOT NULL THEN
      PERFORM public.financeiro_recalcular_saldo_conta(OLD.conta_destino_id);
    END IF;
    RETURN OLD;
  END IF;

  -- Em INSERT: recalcula a conta do novo registro
  IF TG_OP = 'INSERT' THEN
    IF NEW.conta_id IS NOT NULL THEN
      PERFORM public.financeiro_recalcular_saldo_conta(NEW.conta_id);
    END IF;
    IF NEW.conta_destino_id IS NOT NULL THEN
      PERFORM public.financeiro_recalcular_saldo_conta(NEW.conta_destino_id);
    END IF;
    RETURN NEW;
  END IF;

  -- Em UPDATE: recalcula contas envolvidas (old e new, caso conta tenha mudado)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.conta_id IS NOT NULL THEN
      PERFORM public.financeiro_recalcular_saldo_conta(NEW.conta_id);
    END IF;
    IF OLD.conta_id IS NOT NULL AND OLD.conta_id IS DISTINCT FROM NEW.conta_id THEN
      PERFORM public.financeiro_recalcular_saldo_conta(OLD.conta_id);
    END IF;
    IF NEW.conta_destino_id IS NOT NULL THEN
      PERFORM public.financeiro_recalcular_saldo_conta(NEW.conta_destino_id);
    END IF;
    IF OLD.conta_destino_id IS NOT NULL AND OLD.conta_destino_id IS DISTINCT FROM NEW.conta_destino_id THEN
      PERFORM public.financeiro_recalcular_saldo_conta(OLD.conta_destino_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir (idempotente)
DROP TRIGGER IF EXISTS trg_saldo_lancamento ON public.financeiro_lancamentos;

-- Instala o trigger
CREATE TRIGGER trg_saldo_lancamento
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_saldo_lancamento();

-- -----------------------------------------------------------------------------
-- PASSO 4: Confirmação do resultado
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== SALDOS APÓS CORREÇÃO ===';
  FOR rec IN
    SELECT nome, saldo_inicial, saldo_atual
    FROM public.financeiro_contas
    ORDER BY nome
  LOOP
    RAISE NOTICE 'Conta: % | saldo_inicial: % | saldo_atual: %',
      rec.nome, rec.saldo_inicial, rec.saldo_atual;
  END LOOP;
  RAISE NOTICE '✓ Trigger trg_saldo_lancamento instalado com sucesso.';
END;
$$;
