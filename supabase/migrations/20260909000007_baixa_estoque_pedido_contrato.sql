-- ============================================================================
-- Fase C — pedido do contrato baixa o estoque na entrega (trigger, uma vez só)
-- ============================================================================
--
-- O pedido entregue de um item cujo produto está no catálogo vira UMA saída
-- em estoque_movimentos, mantida por trigger — assim todos os caminhos
-- (criação, edição, lixeira/reenvio, extração) produzem o mesmo efeito, e
-- desfazer a entrega desfaz a baixa. O saldo_atual do produto continua sendo
-- recalculado pelo trigger já existente de estoque_movimentos.
--
-- SEM backfill dos pedidos antigos, de propósito: criaria saídas retroativas
-- (318 mil kg no 068/2025) sem as entradas correspondentes e afundaria o
-- estoque em negativo fictício. A regra vale do registro/edição em diante;
-- estoque negativo daqui para frente é SINAL (entrada não lançada), não bug.

ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS contrato_pedido_id uuid REFERENCES public.contrato_pedidos(id) ON DELETE CASCADE;

-- Uma baixa por pedido: o trigger recria em vez de acumular.
CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_mov_contrato_pedido
  ON public.estoque_movimentos (contrato_pedido_id)
  WHERE contrato_pedido_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sincronizar_estoque_do_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_produto uuid;
  v_empresa uuid;
  v_user uuid;
  v_numero_contrato text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.estoque_movimentos WHERE contrato_pedido_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Recria do zero: quantidade, item ou status podem ter mudado.
  DELETE FROM public.estoque_movimentos WHERE contrato_pedido_id = NEW.id;

  IF NEW.status = 'entregue' AND NEW.contrato_item_id IS NOT NULL THEN
    SELECT ci.produto_id, c.empresa_id, c.user_id, c.numero_contrato
      INTO v_produto, v_empresa, v_user, v_numero_contrato
      FROM public.contrato_itens ci
      JOIN public.contratos c ON c.id = ci.contrato_id
     WHERE ci.id = NEW.contrato_item_id;

    IF v_produto IS NOT NULL AND COALESCE(NEW.quantidade, 0) > 0 THEN
      INSERT INTO public.estoque_movimentos
        (empresa_id, produto_id, contrato_pedido_id, tipo, origem,
         quantidade, preco_unitario, observacoes, created_by)
      VALUES
        (v_empresa, v_produto, NEW.id, 'saida', 'contrato_pedido',
         ABS(NEW.quantidade), NEW.valor_unitario,
         'Entrega do pedido ' || COALESCE(NEW.numero_pedido, '?') ||
           ' — contrato ' || COALESCE(v_numero_contrato, '?'),
         COALESCE(NEW.user_id, v_user));
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Estoque é reflexo do pedido, nunca obstáculo a ele.
  RAISE WARNING 'sincronizar_estoque_do_pedido: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_estoque_do_pedido ON public.contrato_pedidos;
CREATE TRIGGER trg_sincronizar_estoque_do_pedido
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_estoque_do_pedido();

NOTIFY pgrst, 'reload schema';
