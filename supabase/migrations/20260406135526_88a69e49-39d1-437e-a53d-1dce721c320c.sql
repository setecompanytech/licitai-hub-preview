
CREATE OR REPLACE FUNCTION public.atualizar_saldo_item_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato_id uuid;
  v_item_id uuid;
  v_total_qty numeric;
  v_total_val numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contrato_id := OLD.contrato_id;
    v_item_id := OLD.contrato_item_id;
  ELSE
    v_contrato_id := NEW.contrato_id;
    v_item_id := NEW.contrato_item_id;
  END IF;

  -- Update item saldos if linked to an item
  IF v_item_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade), 0), COALESCE(SUM(valor_total), 0)
    INTO v_total_qty, v_total_val
    FROM public.contrato_pedidos
    WHERE contrato_item_id = v_item_id AND status != 'cancelado';

    UPDATE public.contrato_itens
    SET quantidade_consumida = v_total_qty,
        saldo_quantitativo = quantidade_contratada - v_total_qty,
        saldo_financeiro = valor_total - v_total_val,
        updated_at = now()
    WHERE id = v_item_id;
  END IF;

  -- Update contrato valor_consumido (saldo_remanescente is auto-generated)
  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_val
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  UPDATE public.contratos
  SET valor_consumido = v_total_val,
      updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
