
DROP POLICY IF EXISTS "Users insert own ia auditoria" ON public.contrato_ia_auditoria;
CREATE POLICY "Users insert own ia auditoria"
  ON public.contrato_ia_auditoria FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System inserts via triggers"
  ON public.contrato_ia_auditoria FOR INSERT
  TO authenticated
  WITH CHECK (origem IN ('recalculo_saldo','alerta_limite_legal','recalculo_consumo_ata'));

DROP POLICY IF EXISTS "Users view own ia auditoria" ON public.contrato_ia_auditoria;
CREATE POLICY "Users view ia auditoria de seus contratos"
  ON public.contrato_ia_auditoria FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_ia_auditoria.contrato_id AND c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.log_recalc_saldo_ata_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_ata_item_id UUID;
  v_ata_id UUID;
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
    'Qtd consumida: ' || COALESCE(v_qtd_nova::TEXT,'0') || ' | Saldo financeiro: R$ ' || COALESCE(v_val_nova::TEXT,'0'),
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

DROP TRIGGER IF EXISTS trg_log_recalc_saldo_ata_item ON public.contrato_itens;
CREATE TRIGGER trg_log_recalc_saldo_ata_item
AFTER INSERT OR UPDATE OR DELETE ON public.contrato_itens
FOR EACH ROW EXECUTE FUNCTION public.log_recalc_saldo_ata_item();

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
    'Total consumido: R$ ' || COALESCE(v_valor_consumido::TEXT,'0') || ' (' || v_pct::TEXT || '% do valor global)',
    'recalculo_consumo_ata', v_ata_user, 'Trigger automático'
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_recalc_consumo_ata_pai: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_recalc_consumo_ata_pai_iu ON public.contratos;
CREATE TRIGGER trg_log_recalc_consumo_ata_pai_iu
AFTER INSERT OR UPDATE ON public.contratos
FOR EACH ROW
WHEN (NEW.ata_srp_id IS NOT NULL)
EXECUTE FUNCTION public.log_recalc_consumo_ata_pai();

DROP TRIGGER IF EXISTS trg_log_recalc_consumo_ata_pai_del ON public.contratos;
CREATE TRIGGER trg_log_recalc_consumo_ata_pai_del
AFTER DELETE ON public.contratos
FOR EACH ROW
WHEN (OLD.ata_srp_id IS NOT NULL)
EXECUTE FUNCTION public.log_recalc_consumo_ata_pai();

CREATE OR REPLACE FUNCTION public.alerta_limite_aditivo_25pct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_user_id UUID;
  v_valor_original NUMERIC;
  v_total_acrescimo NUMERIC;
  v_total_qtd_acrescimo NUMERIC;
  v_qtd_total_contrato NUMERIC;
  v_pct_valor NUMERIC;
  v_pct_qtd NUMERIC;
  v_objeto TEXT;
  v_limite NUMERIC := 25.0;
BEGIN
  SELECT c.user_id, c.valor_global_original, c.objeto
  INTO v_user_id, v_valor_original, v_objeto
  FROM public.contratos c WHERE c.id = NEW.contrato_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF lower(COALESCE(v_objeto,'')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos WHERE contrato_id = NEW.contrato_id;

  v_pct_valor := CASE WHEN COALESCE(v_valor_original,0) > 0
    THEN ROUND((v_total_acrescimo / v_valor_original) * 100, 2) ELSE 0 END;

  SELECT COALESCE(SUM(quantidade_contratada),0) INTO v_qtd_total_contrato
  FROM public.contrato_itens WHERE contrato_id = NEW.contrato_id;

  v_pct_qtd := CASE WHEN COALESCE(v_qtd_total_contrato,0) > 0
    THEN ROUND((v_total_qtd_acrescimo / v_qtd_total_contrato) * 100, 2) ELSE 0 END;

  IF v_pct_valor >= v_limite THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_valor',
      'Limite legal Lei 14.133/21 art. 125: ' || v_limite::TEXT || '%',
      'ATENCAO Acrescimos acumulados em VALOR: ' || v_pct_valor::TEXT || '% (R$ ' || v_total_acrescimo::TEXT || ' sobre R$ ' || COALESCE(v_valor_original,0)::TEXT || ')',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  IF v_pct_qtd >= 25.0 THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_quantidade',
      'Limite legal Lei 14.133/21 art. 125: 25%',
      'ATENCAO Acrescimos acumulados em QUANTIDADE: ' || v_pct_qtd::TEXT || '% (' || v_total_qtd_acrescimo::TEXT || ' sobre ' || v_qtd_total_contrato::TEXT || ')',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'alerta_limite_aditivo_25pct: %', SQLERRM;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_alerta_limite_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_alerta_limite_aditivo
AFTER INSERT OR UPDATE ON public.contrato_aditivos
FOR EACH ROW EXECUTE FUNCTION public.alerta_limite_aditivo_25pct();
