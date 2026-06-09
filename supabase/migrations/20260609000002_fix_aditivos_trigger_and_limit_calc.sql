-- Fix 1: Replace the old trigger function body so it delegates to
-- recalcular_alertas_aditivos_contrato(), which:
--   • Deletes previous alerts before re-inserting (no duplicates)
--   • Excludes reequilibrio / revisao / repactuacao / reajuste from 25% calc
--   • Only fires when there are amendments actually subject to the limit
--
-- Fix 2: Extend the trigger to also fire on DELETE so that removing an
-- amendment recalculates (and potentially removes) stale alerts.

CREATE OR REPLACE FUNCTION public.alerta_limite_aditivo_25pct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_contrato_id UUID;
BEGIN
  v_contrato_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.contrato_id ELSE NEW.contrato_id END;
  IF v_contrato_id IS NOT NULL THEN
    PERFORM public.recalcular_alertas_aditivos_contrato(v_contrato_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'alerta_limite_aditivo_25pct: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

-- Rebuild trigger to also handle DELETE
DROP TRIGGER IF EXISTS trg_alerta_limite_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_alerta_limite_aditivo
AFTER INSERT OR UPDATE OR DELETE ON public.contrato_aditivos
FOR EACH ROW EXECUTE FUNCTION public.alerta_limite_aditivo_25pct();

-- Fix 3: One-time cleanup — remove stale/duplicate alerts and recalculate
-- all contracts that have at least one amendment recorded.
DO $$
DECLARE
  v_c RECORD;
BEGIN
  FOR v_c IN
    SELECT DISTINCT contrato_id
    FROM public.contrato_aditivos
    WHERE contrato_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.recalcular_alertas_aditivos_contrato(v_c.contrato_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fix_cleanup: contrato % — %', v_c.contrato_id, SQLERRM;
    END;
  END LOOP;
END; $$;
