CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_acrescimo NUMERIC;
  v_total_supressao NUMERIC;
  v_total_qtd_acresc NUMERIC;
  v_total_qtd_supr  NUMERIC;
  v_ultima_data_fim DATE;
  v_contrato_id UUID;
  v_data_inicio DATE;
  v_qtd_total_original NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  SELECT
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0),
    COALESCE(SUM(quantidade_acrescimo), 0),
    COALESCE(SUM(quantidade_supressao), 0)
  INTO v_total_acrescimo, v_total_supressao, v_total_qtd_acresc, v_total_qtd_supr
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  SELECT data_inicio INTO v_data_inicio FROM public.contratos WHERE id = v_contrato_id;

  UPDATE public.contratos
  SET
    valor_global = COALESCE(valor_global_original, 0) + v_total_acrescimo - v_total_supressao,
    data_fim = COALESCE(v_ultima_data_fim, data_fim),
    vigencia_meses = CASE
      WHEN COALESCE(v_ultima_data_fim, data_fim) IS NOT NULL AND v_data_inicio IS NOT NULL THEN
        GREATEST(1, ROUND(
          (EXTRACT(EPOCH FROM (COALESCE(v_ultima_data_fim, data_fim)::timestamp - v_data_inicio::timestamp)) / 86400) / 30
        )::int)
      ELSE vigencia_meses
    END,
    updated_at = now()
  WHERE id = v_contrato_id;

  IF (v_total_qtd_acresc - v_total_qtd_supr) <> 0 THEN
    SELECT COALESCE(SUM(quantidade_contratada), 0)
    INTO v_qtd_total_original
    FROM public.contrato_itens
    WHERE contrato_id = v_contrato_id;

    IF v_qtd_total_original > 0 THEN
      UPDATE public.contrato_itens AS ci
      SET
        saldo_quantitativo = GREATEST(0,
          (ci.quantidade_contratada
           + (v_total_qtd_acresc - v_total_qtd_supr) * (ci.quantidade_contratada / v_qtd_total_original))
          - COALESCE(ci.quantidade_consumida, 0)
        ),
        updated_at = now()
      WHERE ci.contrato_id = v_contrato_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- Reprocessa aditivos existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT contrato_id FROM public.contrato_aditivos LOOP
    UPDATE public.contrato_aditivos SET updated_at = now()
      WHERE id = (SELECT id FROM public.contrato_aditivos WHERE contrato_id = r.contrato_id LIMIT 1);
  END LOOP;
END $$;