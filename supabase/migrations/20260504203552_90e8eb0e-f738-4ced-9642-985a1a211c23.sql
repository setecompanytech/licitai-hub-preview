CREATE OR REPLACE FUNCTION public.cleanup_contrato_pedido_dependencias(_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.comissoes_lancamentos
  WHERE contrato_pedido_id = _pedido_id;

  UPDATE public.contrato_custos
  SET contrato_pedido_id = NULL
  WHERE contrato_pedido_id = _pedido_id;

  UPDATE public.notas_fiscais
  SET contrato_pedido_id = NULL
  WHERE contrato_pedido_id = _pedido_id;

  IF to_regclass('public.contas_receber') IS NOT NULL THEN
    EXECUTE 'UPDATE public.contas_receber SET contrato_pedido_id = NULL WHERE contrato_pedido_id = $1'
    USING _pedido_id;
  END IF;

  UPDATE public.pre_nota_itens
  SET contrato_pedido_id = NULL
  WHERE contrato_pedido_id = _pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.contrato_pedido_id IS NOT NULL THEN
    PERFORM public.cleanup_contrato_pedido_dependencias(OLD.contrato_pedido_id);

    DELETE FROM public.contrato_pedidos
    WHERE id = OLD.contrato_pedido_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_contrato_pedido_on_lancamento_delete ON public.financeiro_lancamentos;
CREATE TRIGGER trg_cleanup_contrato_pedido_on_lancamento_delete
AFTER DELETE ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete();