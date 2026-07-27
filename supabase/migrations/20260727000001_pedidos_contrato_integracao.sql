-- =============================================================================
-- MIGRATION: Integração Gestão de Contratos ↔ Gestão de Compras e Pedidos
-- Data: 2026-07-27
-- Objetivo: Permitir que pedidos criados em Gestão de Contratos apareçam
--           automaticamente no kanban de Gestão de Compras e Pedidos,
--           mantendo o vínculo bidirecional entre os dois módulos.
-- =============================================================================

-- 1. Adiciona contrato_id na tabela pedidos
--    Permite identificar pedidos originados de um contrato no kanban
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS contrato_id uuid
    REFERENCES public.contratos(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_contrato_id
  ON public.pedidos (contrato_id)
  WHERE contrato_id IS NOT NULL;

-- 2. Adiciona pedido_id na tabela contrato_pedidos
--    Permite rastrear, a partir do contrato, qual registro do kanban
--    foi criado para aquele lançamento
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS pedido_id uuid
    REFERENCES public.pedidos(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contrato_pedidos_pedido_id
  ON public.contrato_pedidos (pedido_id)
  WHERE pedido_id IS NOT NULL;
