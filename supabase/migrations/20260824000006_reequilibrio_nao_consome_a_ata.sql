-- =============================================================================
-- Reequilíbrio no contrato derivado não consome a ATA
--
-- A cadeia que existia: reequilíbrio econômico-financeiro (caso fortuito/força
-- maior, art. 124, II, "d") lançado no contrato derivado → valor_global do
-- contrato sobe → o consumo da ata é a soma dos globais dos derivados → o
-- saldo da ata ENCOLHE.
--
-- Doutrinariamente errado. A ata registra QUANTIDADES a preços registrados; o
-- contrato a consome tomando quantidade. O reequilíbrio (e o reajuste, a
-- revisão, a repactuação) repara a equação de preço DO CONTRATO — não toma um
-- quilo a mais do registrado. Deixar a álea extraordinária comer o saldo
-- bloquearia contratos futuros por um dinheiro que não saiu da ata.
--
-- A fatia que o contrato toma da ata passa a ser o global MENOS o efeito
-- líquido dos institutos fora-do-objeto (acréscimos − supressões de
-- reequilibrio/revisao/repactuacao/reajuste). O quantitativo por item já
-- estava certo — esses aditivos não têm quantidade.
-- =============================================================================

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

  SELECT COALESCE(SUM(
    c.valor_global
    - COALESCE((
        SELECT SUM(COALESCE(a.valor_acrescimo, 0)) - SUM(COALESCE(a.valor_supressao, 0))
        FROM public.contrato_aditivos a
        WHERE a.contrato_id = c.id
          AND a.tipo IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste')
      ), 0)
  ), 0)
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

COMMENT ON FUNCTION public.recalc_consumo_ata_pai() IS
  'Consumo da ata = soma dos contratos derivados vivos, DESCONTADO o efeito '
  'líquido dos institutos fora-do-objeto (reequilíbrio, revisão, repactuação, '
  'reajuste): eles reparam o preço do contrato, não tomam quantidade da ata. '
  'Ignora contratos na lixeira (excluido_em) e cancelados/rescindidos.';

-- O aditivo do DERIVADO também precisa cutucar a ata: o gatilho em contratos
-- dispara na mudança de valor_global (o aplicar_aditivo já a provoca), mas um
-- aditivo fora-do-objeto NÃO deveria mudar o consumo — e sem recálculo, o
-- consumo herdaria o global inflado até a próxima mudança. Recalcula direto.
CREATE OR REPLACE FUNCTION public.recalc_ata_apos_aditivo_derivado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ata_id UUID;
  v_contrato_id UUID;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);
  SELECT ata_srp_id INTO v_ata_id FROM public.contratos WHERE id = v_contrato_id;
  IF v_ata_id IS NOT NULL THEN
    -- UPDATE no-op numa coluna vigiada dispara o recálculo do consumo.
    UPDATE public.contratos SET ata_srp_id = ata_srp_id WHERE id = v_contrato_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'recalc_ata_apos_aditivo_derivado: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_recalc_ata_apos_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_recalc_ata_apos_aditivo
AFTER INSERT OR UPDATE OR DELETE ON public.contrato_aditivos
FOR EACH ROW EXECUTE FUNCTION public.recalc_ata_apos_aditivo_derivado();

-- Reaplica nas atas existentes, para o consumo já gravado obedecer à regra.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ata_srp_id AS id FROM public.contratos
    WHERE ata_srp_id IS NOT NULL AND tipo_documento = 'contrato'
  LOOP
    UPDATE public.contratos SET ata_srp_id = ata_srp_id
    WHERE ata_srp_id = r.id AND tipo_documento = 'contrato';
  END LOOP;
END $$;
