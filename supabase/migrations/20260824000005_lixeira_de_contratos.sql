-- =============================================================================
-- A lixeira passa a ter volta
--
-- O ícone de excluir em Gestão de Contratos fazia DELETE: um toque apagava o
-- contrato E, por cascata, itens, aditivos, arquivos e pedidos — sem caminho de
-- volta. Exclusão por engano de um registro que acumula meses de lançamentos
-- não pode ser irreversível no primeiro clique.
--
-- Exclusão vira MARCA (excluido_em): o registro some das telas e das contas,
-- mas os filhos continuam intactos, e restaurar é apagar a marca. A exclusão
-- definitiva continua existindo — como segundo passo, dentro da lixeira, onde
-- o gesto é deliberado.
--
-- As funções de cascata aprendem a marca: contrato na lixeira devolve a fatia
-- que reservava na ATA (valor e quantitativos), e a recupera ao ser restaurado
-- — os gatilhos recalculam por SOMA, então a ida e a volta se acertam sozinhas.
-- =============================================================================

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluido_por UUID;

COMMENT ON COLUMN public.contratos.excluido_em IS
  'Quando foi enviado à lixeira. Nulo = ativo. Registro marcado sai das telas '
  'e dos cálculos de consumo da ATA, mas mantém itens/aditivos/arquivos — '
  'restaurar é voltar a nulo. Exclusão definitiva é o DELETE, feito na lixeira.';

-- ── 1 · consumo da ATA ignora quem está na lixeira ───────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_consumo_ata_pai()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ata_id UUID;
  v_total_consumido NUMERIC;
BEGIN
  v_ata_id := COALESCE(NEW.ata_srp_id, OLD.ata_srp_id);
  IF v_ata_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(c.valor_global), 0)
  INTO v_total_consumido
  FROM public.contratos c
  WHERE c.ata_srp_id = v_ata_id
    AND c.tipo_documento = 'contrato'
    AND c.excluido_em IS NULL
    AND COALESCE(c.status, 'vigente') NOT IN ('cancelado','rescindido');

  UPDATE public.contratos
  SET valor_consumido = v_total_consumido,
      updated_at = now()
  WHERE id = v_ata_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- O gatilho precisa disparar quando a marca muda — é ela que move a fatia.
DROP TRIGGER IF EXISTS trg_recalc_consumo_ata_pai_iu ON public.contratos;
CREATE TRIGGER trg_recalc_consumo_ata_pai_iu
AFTER INSERT OR UPDATE OF valor_global, status, ata_srp_id, excluido_em
ON public.contratos
FOR EACH ROW
WHEN (NEW.ata_srp_id IS NOT NULL)
EXECUTE FUNCTION public.recalc_consumo_ata_pai();

-- ── 2 · saldo QUANTITATIVO do item da ATA idem ───────────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_saldo_ata_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ata_item_id UUID;
  v_total_consumido NUMERIC;
BEGIN
  v_ata_item_id := COALESCE(NEW.ata_item_id, OLD.ata_item_id);
  IF v_ata_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(ci.quantidade_contratada), 0)
  INTO v_total_consumido
  FROM public.contrato_itens ci
  JOIN public.contratos c ON c.id = ci.contrato_id
  WHERE ci.ata_item_id = v_ata_item_id
    AND c.tipo_documento = 'contrato'
    AND c.excluido_em IS NULL
    AND COALESCE(c.status, 'ativo') NOT IN ('cancelado','rescindido');

  UPDATE public.contrato_itens
  SET quantidade_ata_consumida = v_total_consumido,
      saldo_quantitativo = GREATEST(quantidade_contratada - v_total_consumido, 0),
      updated_at = now()
  WHERE id = v_ata_item_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ── 3 · saldo FINANCEIRO do item da ATA idem ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_saldo_financeiro_ata_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ata_item_id UUID;
  v_total_valor NUMERIC;
BEGIN
  v_ata_item_id := COALESCE(NEW.ata_item_id, OLD.ata_item_id);
  IF v_ata_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(ci.valor_total), 0)
  INTO v_total_valor
  FROM public.contrato_itens ci
  JOIN public.contratos c ON c.id = ci.contrato_id
  WHERE ci.ata_item_id = v_ata_item_id
    AND c.tipo_documento = 'contrato'
    AND c.excluido_em IS NULL
    AND COALESCE(c.status,'vigente') NOT IN ('cancelado','rescindido');

  UPDATE public.contrato_itens
  SET saldo_financeiro = GREATEST(valor_total - v_total_valor, 0),
      updated_at = now()
  WHERE id = v_ata_item_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ── 4 · itens de contrato na lixeira saem da soma AGORA ──────────────────────
-- Os gatilhos de item só disparam quando o ITEM muda; mandar o contrato à
-- lixeira muda o contrato. Este gatilho auxiliar cutuca os itens da ATA
-- afetados quando a marca do contrato muda.
CREATE OR REPLACE FUNCTION public.recutucar_itens_da_ata_ao_marcar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.excluido_em IS DISTINCT FROM OLD.excluido_em THEN
    FOR r IN
      SELECT DISTINCT ata_item_id FROM public.contrato_itens
      WHERE contrato_id = NEW.id AND ata_item_id IS NOT NULL
    LOOP
      -- Reescrever ata_item_id com o MESMO valor dispara os dois recálculos:
      -- "UPDATE OF coluna" reage à coluna estar no SET, mudando ou não — e
      -- ata_item_id é a única coluna presente nas listas de ambos os gatilhos.
      UPDATE public.contrato_itens SET ata_item_id = ata_item_id
      WHERE ata_item_id = r.ata_item_id AND contrato_id = NEW.id;
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'recutucar_itens_da_ata_ao_marcar: %', SQLERRM;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_recutucar_itens_lixeira ON public.contratos;
CREATE TRIGGER trg_recutucar_itens_lixeira
AFTER UPDATE OF excluido_em ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.recutucar_itens_da_ata_ao_marcar();
