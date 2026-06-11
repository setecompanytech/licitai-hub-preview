-- ═══════════════════════════════════════════════════════════════
-- Módulo de Compras: fornecedores, pedidos_compra, itens_pedido_compra
-- RLS via is_empresa_member / is_empresa_admin
-- ═══════════════════════════════════════════════════════════════

-- Enum de status do pedido
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_pedido_compra') THEN
    CREATE TYPE public.status_pedido_compra AS ENUM ('rascunho', 'aguardando', 'entregue', 'cancelado');
  END IF;
END $$;

-- ── Fornecedores ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id          uuid        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  razao_social        text        NOT NULL,
  cnpj                text,
  categoria           text,
  prazo_entrega_dias  integer,
  contato_nome        text,
  contato_email       text,
  contato_telefone    text,
  observacoes         text,
  ativo               boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Pedidos de Compra ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedidos_compra (
  id                    uuid                         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id            uuid                         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id           uuid                         REFERENCES public.contratos(id) ON DELETE SET NULL,
  fornecedor_id         uuid                         REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  status                public.status_pedido_compra  NOT NULL DEFAULT 'rascunho',
  data_pedido           date,
  data_entrega_prevista date,
  data_entrega_real     date,
  valor_total           numeric                      NOT NULL DEFAULT 0,
  observacoes           text,
  created_at            timestamptz                  NOT NULL DEFAULT now()
);

-- ── Itens do Pedido ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.itens_pedido_compra (
  id              uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id       uuid    NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  descricao       text    NOT NULL,
  unidade         text    NOT NULL DEFAULT 'UN',
  quantidade      numeric NOT NULL DEFAULT 1,
  preco_unitario  numeric NOT NULL DEFAULT 0,
  preco_total     numeric NOT NULL DEFAULT 0
);

-- ── Trigger updated_at para fornecedores ────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────
ALTER TABLE public.fornecedores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_compra       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido_compra  ENABLE ROW LEVEL SECURITY;

-- fornecedores
CREATE POLICY "fornecedores_select" ON public.fornecedores
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fornecedores_insert" ON public.fornecedores
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fornecedores_update" ON public.fornecedores
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "fornecedores_delete" ON public.fornecedores
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- pedidos_compra
CREATE POLICY "pedidos_compra_select" ON public.pedidos_compra
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "pedidos_compra_insert" ON public.pedidos_compra
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "pedidos_compra_update" ON public.pedidos_compra
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "pedidos_compra_delete" ON public.pedidos_compra
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- itens_pedido_compra — sem empresa_id, acesso inferido via pedido
CREATE POLICY "itens_pedido_compra_select" ON public.itens_pedido_compra
  FOR SELECT USING (
    pedido_id IN (
      SELECT id FROM public.pedidos_compra
      WHERE public.is_empresa_member(auth.uid(), empresa_id)
    )
  );

CREATE POLICY "itens_pedido_compra_insert" ON public.itens_pedido_compra
  FOR INSERT WITH CHECK (
    pedido_id IN (
      SELECT id FROM public.pedidos_compra
      WHERE public.is_empresa_member(auth.uid(), empresa_id)
    )
  );

CREATE POLICY "itens_pedido_compra_update" ON public.itens_pedido_compra
  FOR UPDATE USING (
    pedido_id IN (
      SELECT id FROM public.pedidos_compra
      WHERE public.is_empresa_member(auth.uid(), empresa_id)
    )
  );

CREATE POLICY "itens_pedido_compra_delete" ON public.itens_pedido_compra
  FOR DELETE USING (
    pedido_id IN (
      SELECT id FROM public.pedidos_compra
      WHERE public.is_empresa_admin(auth.uid(), empresa_id)
    )
  );
