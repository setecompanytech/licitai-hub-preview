-- ============================================================================
-- Lote de pedidos: a nota rateada em N itens é UMA linha na aba Pedidos
-- ============================================================================
--
-- 29/09/2026. A Extração de Documentos (Financeiro) rateia uma nota pelos
-- itens do contrato e cria um pedido por item — cada um consome o saldo do
-- seu item, e isso continua. Mas na aba Pedidos a NF-e 595 do 772/2024 virou
-- 18 linhas "595-1 … 595-18 (parte n/18)". `lote_id` liga as partes: a tela
-- mostra uma linha por lote e abre as partes no painel do lote.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS lote_id uuid;

COMMENT ON COLUMN public.contrato_pedidos.lote_id IS
  'Partes de um mesmo lançamento (uma nota rateada em N itens) compartilham o '
  'mesmo lote_id. Nulo = pedido solto. Gravado pela Extração de Documentos; '
  'as partes antigas foram ligadas pela migration 20260929000001.';

CREATE INDEX IF NOT EXISTS idx_contrato_pedidos_lote
  ON public.contrato_pedidos (lote_id) WHERE lote_id IS NOT NULL;

-- ── Retroalimentação: as partes já gravadas ("(parte n/N)") viram lote ──────
-- Grupo = contrato + nota + número sem o sufixo "-n". Só grupos com 2+ linhas.
WITH grupos AS (
  SELECT contrato_id,
         COALESCE(nota_fiscal, '') AS nota,
         regexp_replace(numero_pedido, '-\d+$', '') AS numero_base,
         gen_random_uuid() AS novo_lote
    FROM public.contrato_pedidos
   WHERE lote_id IS NULL
     AND descricao ~ '\(parte \d+/\d+\)'
   GROUP BY contrato_id, COALESCE(nota_fiscal, ''), regexp_replace(numero_pedido, '-\d+$', '')
  HAVING count(*) >= 2
)
UPDATE public.contrato_pedidos p
   SET lote_id = g.novo_lote
  FROM grupos g
 WHERE p.lote_id IS NULL
   AND p.contrato_id = g.contrato_id
   AND COALESCE(p.nota_fiscal, '') = g.nota
   AND regexp_replace(p.numero_pedido, '-\d+$', '') = g.numero_base
   AND p.descricao ~ '\(parte \d+/\d+\)';
-- Esperado hoje: UPDATE 18 (as 18 partes da NF-e 595 do 772/2024).

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT lote_id, count(*), min(numero_pedido), max(numero_pedido), sum(valor_total)
--     FROM public.contrato_pedidos WHERE lote_id IS NOT NULL GROUP BY lote_id;
--   -- Esperado: 1 lote, 18 partes, 595-1 … 595-9, 17283.00.
