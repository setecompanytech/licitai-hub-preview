-- 1) Trigger: ao deletar lançamento financeiro vinculado a um pedido de contrato,
--    remove também o pedido (e o ContratoDashboard recalcula o saldo).
CREATE OR REPLACE FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.contrato_pedido_id IS NOT NULL THEN
    -- Apaga o pedido vinculado se ainda existir
    DELETE FROM public.contrato_pedidos WHERE id = OLD.contrato_pedido_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_contrato_pedido_on_lancamento_delete ON public.financeiro_lancamentos;
CREATE TRIGGER trg_cleanup_contrato_pedido_on_lancamento_delete
AFTER DELETE ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete();

-- 2) Realtime: garante propagação de mudanças nas tabelas que afetam o módulo Gestão/Contratos.
ALTER TABLE public.contrato_pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.contrato_itens REPLICA IDENTITY FULL;
ALTER TABLE public.financeiro_lancamentos REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='contrato_pedidos') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contrato_pedidos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='contrato_itens') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contrato_itens';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='financeiro_lancamentos') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_lancamentos';
  END IF;
END$$;