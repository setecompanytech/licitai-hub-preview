-- ============================================================================
-- Apagar o título único do lote apaga as partes (os pedidos) do lote
-- ============================================================================
--
-- 30/09/2026. O gatilho de limpeza (`cleanup_contrato_pedido_on_lancamento_
-- delete`) apagava o pedido ligado por `contrato_pedido_id` quando o título
-- era excluído. O título de LOTE não tem `contrato_pedido_id` — as partes
-- ficam presas por `lote_id` — e por isso a NF-e 595 excluída no Contas a
-- Receber deixou 18 pedidos vivos em Gestão de Contratos. Agora a exclusão
-- do título de lote leva as partes junto, desde que nenhuma esteja quitada
-- e não reste outro título do mesmo lote. Título a pagar continua fora,
-- como antes.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk (depois da 20260929000002).

CREATE OR REPLACE FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_outros int;
BEGIN
  IF OLD.tipo IS DISTINCT FROM 'a_pagar' THEN
    IF OLD.contrato_pedido_id IS NOT NULL THEN
      DELETE FROM public.contrato_pedidos WHERE id = OLD.contrato_pedido_id;
    ELSIF OLD.lote_id IS NOT NULL THEN
      SELECT count(*) INTO v_outros
        FROM public.financeiro_lancamentos
       WHERE lote_id = OLD.lote_id AND id <> OLD.id;
      IF v_outros = 0 THEN
        DELETE FROM public.contrato_pedidos
         WHERE lote_id = OLD.lote_id
           AND COALESCE(nf_quitada, false) = false;
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete() IS
  'Excluir um título a receber apaga o pedido dele (contrato_pedido_id) ou, se for o '
  'título único de um lote, as partes não quitadas do lote (lote_id). A pagar não apaga pedido.';

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT pg_get_functiondef('public.cleanup_contrato_pedido_on_lancamento_delete'::regproc);
