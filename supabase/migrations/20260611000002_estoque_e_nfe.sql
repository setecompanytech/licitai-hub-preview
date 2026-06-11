-- ═══════════════════════════════════════════════════════════════
-- Módulo de Compras — Estoque e NF-e Recebidas
-- Tabelas: produtos, nfe_recebidas, estoque_movimentos
-- nfe_recebidas é criada antes de estoque_movimentos (FK dep)
-- RLS via is_empresa_member / is_empresa_admin
-- ═══════════════════════════════════════════════════════════════

-- ── Catálogo de produtos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.produtos (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id        uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo            text,
  descricao         text        NOT NULL,
  unidade           text        NOT NULL DEFAULT 'UN',
  categoria         text,
  saldo_atual       numeric     NOT NULL DEFAULT 0,
  saldo_minimo      numeric     NOT NULL DEFAULT 0,
  preco_custo_medio numeric     NOT NULL DEFAULT 0,
  ativo             boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);

DROP TRIGGER IF EXISTS produtos_updated_at ON public.produtos;
CREATE TRIGGER produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── NF-e recebidas ────────────────────────────────────────────
-- Declarada antes de estoque_movimentos (que referencia nfe_id)
CREATE TABLE IF NOT EXISTS public.nfe_recebidas (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id     uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id      uuid                 REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  numero         text        NOT NULL,
  serie          text        NOT NULL DEFAULT '1',
  chave_acesso   text,
  data_emissao   date,
  cnpj_emitente  text,
  nome_emitente  text,
  valor_total    numeric     NOT NULL DEFAULT 0,
  xml_content    text,
  itens          jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_empresa ON public.nfe_recebidas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_nfe_pedido  ON public.nfe_recebidas(pedido_id);
-- Evita importar a mesma chave duas vezes para a mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_chave_empresa
  ON public.nfe_recebidas(empresa_id, chave_acesso)
  WHERE chave_acesso IS NOT NULL AND chave_acesso <> '';

-- ── Movimentações de estoque ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id     uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id     uuid        NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  pedido_id      uuid                 REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  nfe_id         uuid                 REFERENCES public.nfe_recebidas(id) ON DELETE SET NULL,
  tipo           text        NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  origem         text        NOT NULL DEFAULT 'manual',
  quantidade     numeric     NOT NULL,   -- positivo p/ entrada/saida; sinalizado p/ ajuste
  preco_unitario numeric,
  observacoes    text,
  created_by     uuid                 REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emov_empresa ON public.estoque_movimentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_emov_produto ON public.estoque_movimentos(produto_id);

-- ── Trigger: recalcula saldo_atual do produto ─────────────────
CREATE OR REPLACE FUNCTION public.atualizar_saldo_produto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_produto_id uuid;
BEGIN
  v_produto_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.produto_id ELSE NEW.produto_id END;

  UPDATE public.produtos
  SET
    saldo_atual = COALESCE((
      SELECT SUM(
        CASE tipo
          WHEN 'entrada' THEN  ABS(quantidade)
          WHEN 'saida'   THEN -ABS(quantidade)
          ELSE                 quantidade        -- ajuste: já sinalizado
        END
      )
      FROM public.estoque_movimentos
      WHERE produto_id = v_produto_id
    ), 0),
    updated_at = now()
  WHERE id = v_produto_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'atualizar_saldo_produto: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_saldo_produto ON public.estoque_movimentos;
CREATE TRIGGER trg_atualizar_saldo_produto
AFTER INSERT OR UPDATE OR DELETE ON public.estoque_movimentos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_produto();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.produtos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_recebidas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos  ENABLE ROW LEVEL SECURITY;

-- produtos
CREATE POLICY "produtos_select" ON public.produtos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "produtos_insert" ON public.produtos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "produtos_update" ON public.produtos
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- nfe_recebidas
CREATE POLICY "nfe_select" ON public.nfe_recebidas
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "nfe_insert" ON public.nfe_recebidas
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "nfe_update" ON public.nfe_recebidas
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "nfe_delete" ON public.nfe_recebidas
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- estoque_movimentos (append-only para membros; delete só para admin)
CREATE POLICY "emov_select" ON public.estoque_movimentos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "emov_insert" ON public.estoque_movimentos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "emov_delete" ON public.estoque_movimentos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));
