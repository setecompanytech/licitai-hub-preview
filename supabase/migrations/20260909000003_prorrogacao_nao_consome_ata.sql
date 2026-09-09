-- ============================================================================
-- Prorrogação de contrato derivado NÃO consome a ATA
-- ============================================================================
--
-- O consumo da ATA é o que os contratos derivados CONTRATARAM dela. A função
-- descontava só os aditivos de preço (reequilíbrio/revisão/repactuação/
-- reajuste) — a prorrogação ficou de fora da lista e o 2º T.A. do 068/2025
-- (arts. 106/107: renova o período de fornecimento do próprio contrato, com
-- a ata já encerrada) entrou como saque novo: a ATA-022/2024 foi a consumo
-- de R$ 18.723.264 sobre um global de R$ 8.494.080 — saldo NEGATIVO de
-- R$ 10.229.184 na tela (09/09).
--
-- A exclusão passa a usar o mesmo radical normalizado do alerta do art. 125
-- (alerta_limite_aditivo_25pct): acento não quebra a regra, e 'prorrogac'
-- alcança tanto o tipo novo (prorrogacao_continua) quanto o legado
-- (prorrogacao). Acréscimo quantitativo comum (art. 125) segue contando —
-- esse sim amplia o que foi tirado da ata.

CREATE OR REPLACE FUNCTION public.recalc_consumo_ata_pai()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          -- Não é saque da ata: recomposição de preço (art. 124/136) e
          -- prorrogação de fornecimento contínuo (arts. 106/107).
          AND translate(
                lower(COALESCE(a.tipo, '')),
                'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
              ) ~ '(reequilibr|revisao|repactua|reajust|prorrogac)'
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
$function$;

-- Reaplica o cálculo nas atas existentes: o UPDATE no-op numa coluna vigiada
-- dispara o trigger corrigido para cada contrato derivado.
UPDATE public.contratos
SET ata_srp_id = ata_srp_id
WHERE ata_srp_id IS NOT NULL
  AND tipo_documento = 'contrato'
  AND excluido_em IS NULL;

NOTIFY pgrst, 'reload schema';
