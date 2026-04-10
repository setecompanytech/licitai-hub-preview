
-- Add original value column
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS valor_global_original numeric NOT NULL DEFAULT 0;

-- Initialize for existing contracts (valor_global minus any existing aditivo net)
UPDATE public.contratos c
SET valor_global_original = c.valor_global - COALESCE(
  (SELECT SUM(a.valor_acrescimo) - SUM(a.valor_supressao) FROM public.contrato_aditivos a WHERE a.contrato_id = c.id), 0
);

-- Fix trigger to use clean base
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
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  SELECT 
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0)
  INTO v_total_acrescimo, v_total_supressao
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  UPDATE public.contratos
  SET 
    valor_global = valor_global_original + v_total_acrescimo - v_total_supressao,
    data_fim = COALESCE(v_ultima_data_fim, data_fim),
    updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
