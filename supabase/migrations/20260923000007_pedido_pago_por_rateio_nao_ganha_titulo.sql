-- ============================================================================
-- Pedido já recebido por rateio não ganha título próprio a receber
-- ============================================================================
--
-- O caso (22/09/2026, 16:06): os pedidos 725 a 730 do 068/2025 estavam
-- quitados pela TED de 27/05, rateada entre eles. Seis títulos a receber
-- novos, um por nota, foram ligados a esses pedidos por um caminho de tela.
-- Efeito: R$ 1.819.739,36 duplicados em Contas a Receber E os seis pedidos
-- perderam a quitação — "título próprio manda", e o título novo estava em
-- aberto.
--
-- A regra que faltava no banco (o par da de 22/09 de manhã, "lançamento
-- rateado não vira de pedido"): pedido que já recebe por rateio não aceita
-- título a receber próprio. A nota dele anexa-se ao recebimento que o pagou
-- (Extração de documentos → "Anexar como parte"). Recusa declarada, com o
-- caminho certo na mensagem — nunca uma gravação silenciosa.

CREATE OR REPLACE FUNCTION public.tg_pedido_rateado_nao_ganha_titulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero text;
  v_quando date;
  v_valor  numeric;
BEGIN
  IF NEW.contrato_pedido_id IS NULL OR NEW.tipo <> 'a_receber' OR NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.contrato_pedido_id IS NOT DISTINCT FROM OLD.contrato_pedido_id THEN
    RETURN NEW;
  END IF;
  SELECT p.numero_pedido, max(l.data_competencia), sum(r.valor)
    INTO v_numero, v_quando, v_valor
    FROM public.financeiro_lancamento_rateios r
    JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id
    JOIN public.contrato_pedidos p ON p.id = r.contrato_pedido_id
   WHERE r.contrato_pedido_id = NEW.contrato_pedido_id
     AND l.tipo = 'a_receber'
     AND l.status <> 'cancelado'
   GROUP BY p.numero_pedido;
  IF v_numero IS NOT NULL THEN
    RAISE EXCEPTION 'O pedido % já foi recebido por rateio (% em %). Um título próprio duplicaria o recebimento e tiraria a quitação do pedido. Anexe a nota ao recebimento que o pagou: Financeiro › Contas a Receber › Extração de documentos → "Anexar como parte".',
      v_numero, public.reais(v_valor), to_char(v_quando, 'DD/MM/YYYY')
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_rateado_nao_ganha_titulo ON public.financeiro_lancamentos;
CREATE TRIGGER trg_pedido_rateado_nao_ganha_titulo
  BEFORE INSERT OR UPDATE OF contrato_pedido_id ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_rateado_nao_ganha_titulo();

COMMENT ON FUNCTION public.tg_pedido_rateado_nao_ganha_titulo() IS
  'Par da regra "lançamento rateado não vira de pedido": pedido que já recebe por rateio não aceita título a receber próprio. A nota dele anexa-se ao recebimento que o pagou.';

NOTIFY pgrst, 'reload schema';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Deve dar zero (nenhum pedido com rateio a receber E título próprio a receber em aberto):
--   SELECT count(*) FROM public.financeiro_lancamentos t
--    WHERE t.tipo = 'a_receber' AND t.status <> 'cancelado' AND t.contrato_pedido_id IS NOT NULL
--      AND EXISTS (SELECT 1 FROM public.financeiro_lancamento_rateios r
--                    JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id AND l.tipo = 'a_receber'
--                   WHERE r.contrato_pedido_id = t.contrato_pedido_id);
