
-- Sync valor_global_original on insert if not set
CREATE OR REPLACE FUNCTION public.fn_default_valor_global_original()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On INSERT: if valor_global_original is 0 or null but valor_global has value, copy it
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.valor_global_original, 0) = 0 AND COALESCE(NEW.valor_global, 0) > 0 THEN
      NEW.valor_global_original := NEW.valor_global;
    END IF;
    -- Also ensure valor_global matches valor_global_original if valor_global is 0
    IF COALESCE(NEW.valor_global, 0) = 0 AND COALESCE(NEW.valor_global_original, 0) > 0 THEN
      NEW.valor_global := NEW.valor_global_original;
    END IF;
  END IF;

  -- On UPDATE of valor_global_original: recalc valor_global (base + aditivos)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.valor_global_original IS DISTINCT FROM OLD.valor_global_original THEN
      -- Recalculate valor_global from original + aditivos
      NEW.valor_global := COALESCE(NEW.valor_global_original, 0) + (
        SELECT COALESCE(SUM(valor_acrescimo), 0) - COALESCE(SUM(valor_supressao), 0)
        FROM public.contrato_aditivos WHERE contrato_id = NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_default_valor_global_original
  BEFORE INSERT OR UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_default_valor_global_original();

-- Fix existing contracts where valor_global_original is 0 but valor_consumido > 0
-- This means they were imported without setting valor_global properly
-- We can't auto-fix the value, but we ensure consistency for future inserts
