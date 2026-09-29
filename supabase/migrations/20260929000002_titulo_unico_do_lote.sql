-- ============================================================================
-- Título único do lote: uma nota rateada em N pedidos tem UM título a receber
-- ============================================================================
--
-- 29/09/2026. A Extração de Documentos criava um título por parte da nota
-- (18 títulos para a NF-e 595). O órgão paga a nota uma vez: o título é um
-- só, ligado ao lote pelo `lote_id` (o mesmo de `contrato_pedidos.lote_id`,
-- migration 20260929000001), sem `contrato_pedido_id`. As partes (pedidos)
-- recebem o dinheiro por rateio (`financeiro_lancamento_rateios`), que o
-- gatilho abaixo mantém: proporcional ao valor de cada parte, refeito quando
-- o valor do título muda, e a quitação de cada parte recalculada quando o
-- título é baixado (a quitação só conta rateio de título realizado/conciliado
-- — `recalcular_quitacao_do_pedido`).
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS lote_id uuid;

COMMENT ON COLUMN public.financeiro_lancamentos.lote_id IS
  'Título único de um lote de pedidos (contrato_pedidos.lote_id). Nulo = título '
  'comum. Um título de lote nunca tem contrato_pedido_id: as partes recebem por rateio.';

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_lote
  ON public.financeiro_lancamentos (lote_id) WHERE lote_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_titulo_do_lote_rateia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_partes   record;
  v_soma     numeric := 0;
  v_restante numeric;
  v_fatia    numeric;
  v_n        int := 0;
  v_i        int := 0;
BEGIN
  IF NEW.lote_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.contrato_pedido_id IS NOT NULL THEN
    RAISE EXCEPTION 'Título de lote não pertence a um pedido: as partes recebem por rateio';
  END IF;

  SELECT count(*), COALESCE(sum(valor_total), 0) INTO v_n, v_soma
    FROM public.contrato_pedidos
   WHERE lote_id = NEW.lote_id AND status <> 'cancelado';
  IF v_n = 0 OR v_soma <= 0 THEN RETURN NEW; END IF;

  -- Refaz o rateio deste título (valor mudou, parte cancelada, título novo).
  DELETE FROM public.financeiro_lancamento_rateios WHERE lancamento_id = NEW.id;
  v_restante := round(COALESCE(NEW.valor, 0)::numeric, 2);
  FOR v_partes IN
    SELECT id, valor_total FROM public.contrato_pedidos
     WHERE lote_id = NEW.lote_id AND status <> 'cancelado'
     ORDER BY numero_pedido
  LOOP
    v_i := v_i + 1;
    v_fatia := CASE WHEN v_i = v_n THEN v_restante
                    ELSE round(COALESCE(NEW.valor, 0) * v_partes.valor_total / v_soma, 2) END;
    v_restante := round(v_restante - v_fatia, 2);
    IF v_fatia > 0 THEN
      INSERT INTO public.financeiro_lancamento_rateios
        (empresa_id, lancamento_id, contrato_pedido_id, valor, observacao, criado_por_user_id)
      VALUES
        (NEW.empresa_id, NEW.id, v_partes.id, v_fatia, 'Título único do lote (rateio automático)', NEW.created_by)
      ON CONFLICT (lancamento_id, contrato_pedido_id) DO UPDATE SET valor = EXCLUDED.valor;
    END IF;
    PERFORM public.recalcular_quitacao_do_pedido(v_partes.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titulo_do_lote_rateia ON public.financeiro_lancamentos;
CREATE TRIGGER trg_titulo_do_lote_rateia
  AFTER INSERT OR UPDATE OF status, valor, lote_id ON public.financeiro_lancamentos
  FOR EACH ROW
  WHEN (NEW.lote_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_titulo_do_lote_rateia();

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'financeiro_lancamentos' AND column_name = 'lote_id';
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_titulo_do_lote_rateia';
--   -- Depois de lançar uma nota com vários itens pela Extração:
--   SELECT l.descricao, l.valor, count(r.*) AS partes, sum(r.valor) AS rateado
--     FROM public.financeiro_lancamentos l
--     LEFT JOIN public.financeiro_lancamento_rateios r ON r.lancamento_id = l.id
--    WHERE l.lote_id IS NOT NULL GROUP BY l.id;
