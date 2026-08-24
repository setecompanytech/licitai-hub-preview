-- =============================================================================
-- O diário identifica o item; não o transcreve
--
-- Cada recálculo de saldo gravava em valor_anterior a DESCRIÇÃO INTEIRA do
-- item — 700 caracteres de especificação técnica de carne moída — repetidos a
-- cada evento. No diálogo de detalhes isso virava uma parede de texto; na
-- tabela, peso morto que cresce a cada pedido.
--
-- O diário existe para identificar: ficam os primeiros 140 caracteres. A
-- especificação completa mora no item, e o diálogo já a mostra na seção
-- própria ("Item afetado").
--
-- (Reescreve o corpo sobre a versão da 20260824000008 — mantém formatar_brl.)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_recalc_saldo_ata_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_ata_id UUID;
  v_ata_item_id UUID;
  v_ata_user UUID;
  v_qtd_nova NUMERIC;
  v_val_nova NUMERIC;
  v_descricao TEXT;
BEGIN
  v_ata_item_id := COALESCE(NEW.ata_item_id, OLD.ata_item_id);
  IF v_ata_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT ai.contrato_id, ai.descricao, ai.quantidade_ata_consumida, ai.saldo_financeiro
  INTO v_ata_id, v_descricao, v_qtd_nova, v_val_nova
  FROM public.contrato_itens ai WHERE ai.id = v_ata_item_id;

  IF v_ata_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT c.user_id INTO v_ata_user FROM public.contratos c WHERE c.id = v_ata_id;
  IF v_ata_user IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
  VALUES (
    v_ata_id, 'saldo_item_ata',
    left(COALESCE(v_descricao, 'Item'), 140)
      || CASE WHEN length(COALESCE(v_descricao, '')) > 140 THEN '…' ELSE '' END
      || ' — saldo recalculado',
    'Qtd consumida: ' || public.formatar_numero(COALESCE(v_qtd_nova, 0), 0)
      || ' | Saldo financeiro: ' || public.formatar_brl(COALESCE(v_val_nova, 0)),
    'recalculo_saldo', v_ata_user,
    'Trigger automático: ' || TG_OP || ' em contrato_itens'
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_recalc_saldo_ata_item: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
