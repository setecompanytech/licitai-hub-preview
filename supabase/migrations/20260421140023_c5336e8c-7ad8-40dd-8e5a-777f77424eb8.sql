-- Validação: pedidos em contratos derivados de ATA SRP devem informar contrato_item_id
-- Isso garante que o trigger recalc_saldo_ata_item consiga decrementar o saldo da ATA correta.

CREATE OR REPLACE FUNCTION public.validar_pedido_contrato_ata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo_doc TEXT;
  v_ata_origem UUID;
BEGIN
  SELECT tipo_documento, ata_srp_id
    INTO v_tipo_doc, v_ata_origem
  FROM public.contratos
  WHERE id = NEW.contrato_id;

  -- Bloqueia pedido sem item quando o contrato vem de uma ATA SRP
  IF v_tipo_doc = 'contrato' AND v_ata_origem IS NOT NULL THEN
    IF NEW.contrato_item_id IS NULL THEN
      RAISE EXCEPTION 'Este contrato é derivado de ATA SRP. O pedido deve ser vinculado a um item do contrato (que por sua vez consome o item da ATA).'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ATAs SRP em si não recebem pedidos diretos (apenas via contratos derivados)
  IF v_tipo_doc = 'ata_srp' THEN
    RAISE EXCEPTION 'Pedidos não podem ser emitidos diretamente sobre uma ATA SRP. Crie um contrato derivado e emita o pedido a partir dele.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_pedido_contrato_ata ON public.contrato_pedidos;
CREATE TRIGGER trg_validar_pedido_contrato_ata
BEFORE INSERT OR UPDATE OF contrato_item_id, contrato_id ON public.contrato_pedidos
FOR EACH ROW EXECUTE FUNCTION public.validar_pedido_contrato_ata();