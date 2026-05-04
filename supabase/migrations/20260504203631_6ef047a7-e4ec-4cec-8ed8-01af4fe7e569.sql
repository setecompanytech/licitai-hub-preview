REVOKE ALL ON FUNCTION public.cleanup_contrato_pedido_dependencias(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_contrato_pedido_dependencias(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_contrato_pedido_dependencias(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete() FROM authenticated;