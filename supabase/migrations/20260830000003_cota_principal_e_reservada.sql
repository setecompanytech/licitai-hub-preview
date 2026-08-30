-- ═══════════════════════════════════════════════════════════════════════════
-- Cota principal e cota reservada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Os dois "pedidos" do contrato 008/2026 são a mesma coisa dividida em duas:
--
--   2026.260101NE003716-1   306.000 un   R$ 131.580,00   75,0%
--   2026.260101NE003716-2   102.000 un   R$  43.860,00   25,0%
--                           408.000      R$ 175.440,00
--
-- É a divisão do art. 48, III da Lei Complementar 123/2006, ao centavo: em
-- licitação de bem divisível, até 25% do objeto é reservado à disputa
-- exclusiva de ME, EPP e MEI, e o restante vai à ampla concorrência.
--
-- O sistema não conhecia o conceito. Nenhuma coluna, em tabela nenhuma.
--
-- ── Por que precisa existir ─────────────────────────────────────────────────
--
-- Não é rótulo. Três consequências práticas:
--
--   1. O saldo de cada cota é INDEPENDENTE. Esgotada a reservada, a entrega
--      seguinte sai da principal — e isso muda o que se pode faturar. Somar as
--      duas num saldo só esconde exatamente o momento em que uma acaba.
--
--   2. A reservada é executável só por quem mantém o enquadramento. Empresa
--      que ultrapassa o teto do Simples ou cresce para média porte perde o
--      direito a ela; o contrato continua, a cota não.
--
--   3. Empenho e nota fiscal as apresentam separadas. É assim que o órgão
--      confere, e é assim que o dossiê precisa estar.

-- ── A cota no item do contrato ──────────────────────────────────────────────
-- É no item que ela nasce: a licitação divide o LOTE, e o contrato herda a
-- divisão. O pedido descobre sua cota pelo item que consome.
ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS cota text;

COMMENT ON COLUMN public.contrato_itens.cota IS
  'principal | reservada. Divisão do art. 48, III da LC 123/2006: até 25% do '
  'objeto reservado a ME/EPP/MEI, o restante em ampla concorrência. Nulo em '
  'item que não foi dividido — a maioria dos contratos.';

ALTER TABLE public.contrato_itens
  DROP CONSTRAINT IF EXISTS chk_item_cota;
ALTER TABLE public.contrato_itens
  ADD CONSTRAINT chk_item_cota
  CHECK (cota IS NULL OR cota IN ('principal','reservada')) NOT VALID;

-- ── E no item do empenho ────────────────────────────────────────────────────
-- O empenho empenha as duas cotas em linhas separadas, com valores próprios.
-- Guardar só o total do empenho perderia justamente a divisão que interessa.
CREATE TABLE IF NOT EXISTS public.contrato_empenho_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  empenho_id    uuid NOT NULL REFERENCES public.contrato_empenhos(id) ON DELETE CASCADE,
  -- O item do contrato que esta linha empenha. Nulo quando o empenho traz
  -- descrição que não casa com nenhum item cadastrado — acontece, e é melhor
  -- guardar solto do que forçar um vínculo errado.
  contrato_item_id uuid REFERENCES public.contrato_itens(id) ON DELETE SET NULL,

  cota          text,
  descricao     text,
  quantidade    numeric(15,4),
  unidade       text,
  valor_unitario numeric(15,4),
  valor_total   numeric(15,2),

  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contrato_empenho_itens IS
  'As linhas de um empenho. Um empenho de bem divisível traz a cota principal '
  'e a reservada como linhas separadas, com quantidades e valores próprios — '
  'e é por linha que o saldo de cada cota se esgota.';

ALTER TABLE public.contrato_empenho_itens
  DROP CONSTRAINT IF EXISTS chk_empenho_item_cota;
ALTER TABLE public.contrato_empenho_itens
  ADD CONSTRAINT chk_empenho_item_cota
  CHECK (cota IS NULL OR cota IN ('principal','reservada'));

CREATE INDEX IF NOT EXISTS idx_empenho_itens_empenho
  ON public.contrato_empenho_itens(empenho_id);

ALTER TABLE public.contrato_empenho_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empenho_itens_select" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_select" ON public.contrato_empenho_itens
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_itens_insert" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_insert" ON public.contrato_empenho_itens
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_itens_update" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_update" ON public.contrato_empenho_itens
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenho_itens_delete" ON public.contrato_empenho_itens;
CREATE POLICY "empenho_itens_delete" ON public.contrato_empenho_itens
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── O pedido consome de uma cota ────────────────────────────────────────────
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS cota text;

COMMENT ON COLUMN public.contrato_pedidos.cota IS
  'De qual cota esta entrega sai. Herda do item quando ele tem cota definida; '
  'nulo em contrato não dividido.';

ALTER TABLE public.contrato_pedidos
  DROP CONSTRAINT IF EXISTS chk_pedido_cota;
ALTER TABLE public.contrato_pedidos
  ADD CONSTRAINT chk_pedido_cota
  CHECK (cota IS NULL OR cota IN ('principal','reservada')) NOT VALID;

-- ── De onde veio a espécie ──────────────────────────────────────────────────
-- Espécie lida do documento é fato; escolhida à mão é declaração de quem
-- preencheu. Como o mesmo excesso é irregularidade num tipo e rotina noutro,
-- quem confere precisa saber em que dos dois está apoiado.
ALTER TABLE public.contrato_empenhos
  ADD COLUMN IF NOT EXISTS tipo_origem  text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo_trecho  text;

COMMENT ON COLUMN public.contrato_empenhos.tipo_origem IS
  'documento | manual. Como a espécie do empenho foi determinada. A IA só '
  'devolve `documento` quando encontra o campo ROTULADO na nota (ESPÉCIE DE '
  'EMPENHO, TIPO DE EMPENHO); sem rótulo ela devolve nulo e quem tem a nota '
  'escolhe — e aí fica `manual`.';

COMMENT ON COLUMN public.contrato_empenhos.tipo_trecho IS
  'O trecho literal onde a espécie aparece no documento. Permite conferir a '
  'leitura sem reabrir o PDF — o mesmo que se faz com as cláusulas de prazo.';

ALTER TABLE public.contrato_empenhos
  DROP CONSTRAINT IF EXISTS chk_empenho_tipo_origem;
ALTER TABLE public.contrato_empenhos
  ADD CONSTRAINT chk_empenho_tipo_origem
  CHECK (tipo_origem IN ('documento','manual'));

-- ── O saldo POR COTA ────────────────────────────────────────────────────────
-- Derivado, como todo saldo neste sistema. Devolve uma linha por cota do
-- empenho: somar as duas esconderia o momento em que uma acaba.
CREATE OR REPLACE FUNCTION public.contrato_empenho_saldo_por_cota(p_empenho_id uuid)
RETURNS TABLE (
  cota             text,
  valor_empenhado  numeric,
  valor_consumido  numeric,
  saldo_valor      numeric,
  qtd_empenhada    numeric,
  qtd_consumida    numeric,
  saldo_qtd        numeric,
  pedidos          integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH empenhado AS (
    SELECT COALESCE(i.cota, 'principal') AS cota,
           SUM(i.valor_total) AS valor,
           SUM(i.quantidade)  AS qtd
      FROM public.contrato_empenho_itens i
     WHERE i.empenho_id = p_empenho_id
     GROUP BY 1
  ),
  consumido AS (
    SELECT COALESCE(p.cota, 'principal') AS cota,
           SUM(p.valor_total) AS valor,
           SUM(p.quantidade)  AS qtd,
           count(*)::int      AS n
      FROM public.contrato_pedidos p
     WHERE p.empenho_id = p_empenho_id
       AND p.status <> 'cancelado'
     GROUP BY 1
  )
  SELECT COALESCE(e.cota, c.cota),
         COALESCE(e.valor, 0),
         COALESCE(c.valor, 0),
         COALESCE(e.valor, 0) - COALESCE(c.valor, 0),
         COALESCE(e.qtd, 0),
         COALESCE(c.qtd, 0),
         COALESCE(e.qtd, 0) - COALESCE(c.qtd, 0),
         COALESCE(c.n, 0)
    FROM empenhado e
    FULL OUTER JOIN consumido c ON c.cota = e.cota;
$$;

COMMENT ON FUNCTION public.contrato_empenho_saldo_por_cota(uuid) IS
  'O que resta de cada cota do empenho, em valor e em quantidade. Uma linha '
  'por cota: somar principal e reservada num saldo só esconde o momento em '
  'que uma delas acaba, que é justamente quando a informação importa.';

GRANT EXECUTE ON FUNCTION public.contrato_empenho_saldo_por_cota(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT e.numero, e.tipo, s.*
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_saldo_por_cota(e.id) s
--    ORDER BY e.numero, s.cota;
--
-- A proporção, para conferir contra a LC 123: a reservada não pode passar de
-- 25% do objeto.
--
--   SELECT e.numero,
--          SUM(i.valor_total) FILTER (WHERE i.cota = 'reservada')
--            / NULLIF(SUM(i.valor_total), 0) * 100 AS pct_reservada
--     FROM public.contrato_empenhos e
--     JOIN public.contrato_empenho_itens i ON i.empenho_id = e.id
--    GROUP BY 1;
