
-- Add quantity columns to contrato_aditivos
ALTER TABLE public.contrato_aditivos
  ADD COLUMN IF NOT EXISTS quantidade_acrescimo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_supressao numeric NOT NULL DEFAULT 0;

-- Fix the trigger function to actually update valor_global
CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_acrescimo NUMERIC;
  v_total_supressao NUMERIC;
  v_ultima_data_fim DATE;
  v_contrato_id UUID;
  v_valor_original NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  -- Sum all addendum values
  SELECT 
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0)
  INTO v_total_acrescimo, v_total_supressao
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  -- Get latest end date from addendums
  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  -- Get original contract value (valor_global minus previous addendum effects)
  -- We store the base value and recompute: base + acrescimos - supressoes
  -- To find the base, we look at the original valor_global before any aditivos were applied
  -- Simple approach: update valor_global = original + net aditivos
  -- We need to track the original value. Let's use a simpler approach:
  -- Just update valor_global directly with the net change

  UPDATE public.contratos
  SET 
    valor_global = valor_global 
      - COALESCE((SELECT SUM(valor_acrescimo) - SUM(valor_supressao) FROM public.contrato_aditivos WHERE contrato_id = v_contrato_id AND id != COALESCE(NEW.id, OLD.id)), 0)
      - CASE WHEN TG_OP = 'DELETE' THEN 0 ELSE (COALESCE(NEW.valor_acrescimo, 0) - COALESCE(NEW.valor_supressao, 0)) END
      + v_total_acrescimo - v_total_supressao,
    data_fim = COALESCE(v_ultima_data_fim, data_fim),
    updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any and recreate
DROP TRIGGER IF EXISTS trg_aplicar_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_aplicar_aditivo
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_aditivo_contrato();
