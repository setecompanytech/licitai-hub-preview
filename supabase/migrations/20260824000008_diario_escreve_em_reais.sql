-- =============================================================================
-- O diário da ata escreve dinheiro em português
--
-- "Total consumido: R$ 2123520 (25.00% do valor global)": sete dígitos sem
-- separador e percentual com ponto — a mesma doença dos alertas legais,
-- corrigida lá em 20260824000002 e esquecida aqui. As funções formatar_brl e
-- formatar_numero já existem; os diários passam a usá-las.
--
-- Reescreve apenas o CORPO das funções: os gatilhos (já renomeados para
-- trg_zlog_* pela 20260824000007, disparando depois do recálculo) continuam
-- apontando para elas.
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
    COALESCE(v_descricao,'Item') || ' — saldo recalculado',
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

CREATE OR REPLACE FUNCTION public.log_recalc_consumo_ata_pai()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_ata_id UUID;
  v_ata_user UUID;
  v_valor_global NUMERIC;
  v_valor_consumido NUMERIC;
  v_pct NUMERIC;
  v_numero TEXT;
BEGIN
  v_ata_id := COALESCE(NEW.ata_srp_id, OLD.ata_srp_id);
  IF v_ata_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT c.user_id, c.valor_global, c.valor_consumido
  INTO v_ata_user, v_valor_global, v_valor_consumido
  FROM public.contratos c WHERE c.id = v_ata_id;

  IF v_ata_user IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  v_pct := CASE WHEN COALESCE(v_valor_global,0) > 0
    THEN ROUND((COALESCE(v_valor_consumido,0) / v_valor_global) * 100, 2) ELSE 0 END;
  v_numero := COALESCE(NEW.numero_contrato, OLD.numero_contrato, 'contrato derivado');

  INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
  VALUES (
    v_ata_id, 'valor_consumido_ata',
    'Operação ' || TG_OP || ' no contrato derivado: ' || v_numero,
    'Total consumido: ' || public.formatar_brl(COALESCE(v_valor_consumido, 0))
      || ' (' || public.formatar_numero(v_pct) || '% do valor global)',
    'recalculo_consumo_ata', v_ata_user, 'Trigger automático'
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_recalc_consumo_ata_pai: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
