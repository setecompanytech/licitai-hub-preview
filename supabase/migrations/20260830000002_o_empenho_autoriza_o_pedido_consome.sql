-- ═══════════════════════════════════════════════════════════════════════════
-- O empenho autoriza; o pedido consome
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Erro de modelagem meu, da 20260830000001: tratei o empenho como CAMPO do
-- pedido. Ele é outra coisa — é o pai.
--
-- O defeito aparece no contrato 008/2026 da Polícia Militar. O upload da nota
-- de empenho criou DOIS PEDIDOS somando R$ 175.440,00, que é o valor global
-- inteiro. O contrato marca 100% consumido e nenhuma entrega foi feita.
--
-- É a mecânica do empenho global e do estimativo que o modelo não comportava:
--
--   empenho global de 100 pacotes
--     → cliente pede 10 hoje       → NF-e, 10 consumidos
--     → pede 30 amanhã             → NF-e, 40 consumidos
--     → pede 60 depois             → NF-e, 100 — empenho esgotado
--
-- Com o empenho virando pedido, o upload consome os 100 de uma vez, e as três
-- entregas reais somam 200. O contrato estoura sem nada ter sido entregue a
-- mais.
--
-- ── Os três tipos, e por que o modelo precisa distingui-los ─────────────────
--
--   ORDINÁRIO    valor certo, pagamento de uma vez. Um pedido só o consome
--                inteiro. Excesso é irregularidade.
--
--   GLOBAL       valor total conhecido, pagamento parcelado. Vários pedidos
--                até esgotar. Excesso é despesa sem cobertura (Lei 4.320/64,
--                art. 60).
--
--   ESTIMATIVO   montante não determinável — água, energia, combustível.
--                Vários pedidos, e ultrapassar não é erro: exige REFORÇO do
--                empenho antes de continuar.
--
-- A mesma diferença de R$ 5.000 tem três leituras e três providências. Guardar
-- só o número, sem o tipo e sem o total, não permite nenhuma delas.

CREATE TABLE IF NOT EXISTS public.contrato_empenhos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id  uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,

  -- Normalizado como AAAANEnnnnnn. O mesmo documento aparece como
  -- "2026NE003716", "2026.260101NE003716" e "2026 NE 003716" — três grafias
  -- viram três empenhos na hora de somar, e o controle de saldo deixa de
  -- existir sem ninguém perceber.
  numero       text NOT NULL,
  tipo         text NOT NULL,
  valor        numeric(15,2),
  quantidade   numeric(15,4),
  unidade      text,
  data_emissao date,

  -- O PDF que autoriza. Fica UMA vez, no empenho, e não repetido em cada
  -- pedido que nasce dele.
  arquivo_id   uuid REFERENCES public.contrato_arquivos(id) ON DELETE SET NULL,
  observacao   text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

COMMENT ON TABLE public.contrato_empenhos IS
  'A nota de empenho que AUTORIZA os pedidos. O empenho autoriza um total; '
  'cada pedido consome parte dele. Antes o empenho era campo do pedido, e o '
  'upload dele consumia o contrato inteiro antes de qualquer entrega.';

COMMENT ON COLUMN public.contrato_empenhos.tipo IS
  'ordinario | global | estimativo. Muda o SENTIDO do excesso: no ordinário é '
  'irregularidade, no global é despesa sem cobertura (art. 60), no estimativo '
  'é rotina que exige reforço antes de continuar.';

COMMENT ON COLUMN public.contrato_empenhos.valor IS
  'O total EMPENHADO — não o de um pedido. É contra ele que a soma dos '
  'pedidos do empenho é conferida.';

COMMENT ON COLUMN public.contrato_empenhos.quantidade IS
  'Quantidade autorizada, quando o empenho a fixa. Empenho global de 100 '
  'pacotes esgota na centésima unidade, não no valor.';

ALTER TABLE public.contrato_empenhos
  DROP CONSTRAINT IF EXISTS chk_empenho_tipo;
ALTER TABLE public.contrato_empenhos
  ADD CONSTRAINT chk_empenho_tipo
  CHECK (tipo IN ('ordinario','global','estimativo'));

-- Um número de empenho é único dentro do contrato: dois registros com o mesmo
-- número seriam dois saldos para a mesma autorização.
CREATE UNIQUE INDEX IF NOT EXISTS idx_empenho_unico
  ON public.contrato_empenhos(contrato_id, numero);

ALTER TABLE public.contrato_empenhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empenhos_select" ON public.contrato_empenhos;
CREATE POLICY "empenhos_select" ON public.contrato_empenhos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenhos_insert" ON public.contrato_empenhos;
CREATE POLICY "empenhos_insert" ON public.contrato_empenhos
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenhos_update" ON public.contrato_empenhos;
CREATE POLICY "empenhos_update" ON public.contrato_empenhos
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "empenhos_delete" ON public.contrato_empenhos;
CREATE POLICY "empenhos_delete" ON public.contrato_empenhos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ── O pedido passa a apontar para o empenho ─────────────────────────────────
-- ON DELETE SET NULL, não CASCADE: apagar o empenho não pode apagar entregas
-- que aconteceram. O pedido fica órfão e VISÍVEL, que é o que permite
-- descobrir o engano.
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS empenho_id uuid
    REFERENCES public.contrato_empenhos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contrato_pedidos.empenho_id IS
  'O empenho que autoriza este pedido. Nulo em pedido anterior à adesão ao '
  'sistema, ou em contrato sem empenho registrado — e é por isso que a tela '
  'diferencia "sem empenho" de "dentro do empenho".';

CREATE INDEX IF NOT EXISTS idx_pedidos_empenho_id
  ON public.contrato_pedidos(empenho_id) WHERE empenho_id IS NOT NULL;

-- ── O saldo do empenho, derivado ────────────────────────────────────────────
-- Função e não coluna, pela mesma razão que `saldo_atual` do Financeiro passou
-- a ser derivado: número gravado descola do que o originou e mente em
-- silêncio.
CREATE OR REPLACE FUNCTION public.contrato_empenho_saldo(p_empenho_id uuid)
RETURNS TABLE (
  valor_empenhado   numeric,
  valor_consumido   numeric,
  saldo_valor       numeric,
  qtd_empenhada     numeric,
  qtd_consumida     numeric,
  saldo_qtd         numeric,
  pedidos           integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.valor,
         COALESCE(SUM(p.valor_total), 0),
         e.valor - COALESCE(SUM(p.valor_total), 0),
         e.quantidade,
         COALESCE(SUM(p.quantidade), 0),
         e.quantidade - COALESCE(SUM(p.quantidade), 0),
         count(p.id)::int
    FROM public.contrato_empenhos e
    LEFT JOIN public.contrato_pedidos p
           ON p.empenho_id = e.id
          AND p.status <> 'cancelado'
   WHERE e.id = p_empenho_id
   GROUP BY e.id, e.valor, e.quantidade;
$$;

COMMENT ON FUNCTION public.contrato_empenho_saldo(uuid) IS
  'O que resta de um empenho, em valor e em quantidade. Derivado dos pedidos, '
  'nunca gravado: número de saldo que se guarda descola do que o originou.';

GRANT EXECUTE ON FUNCTION public.contrato_empenho_saldo(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT e.numero, e.tipo, s.*
--     FROM public.contrato_empenhos e
--    CROSS JOIN LATERAL public.contrato_empenho_saldo(e.id) s
--    ORDER BY s.saldo_valor;
--
-- ── O que NÃO é feito aqui ──────────────────────────────────────────────────
--
-- Os dois "pedidos" do 008/2026 (2026.260101NE003716-1 e -2, somando o valor
-- global inteiro) são o empenho, não entregas. Convertê-los exige decidir se
-- viram UM empenho de R$ 175.440,00 com dois itens, ou dois empenhos — e isso
-- depende do documento, que só quem o tem em mãos pode ler.
--
-- Enquanto não forem convertidos, o contrato segue marcando 100% consumido
-- sem entrega nenhuma. O roteiro está na conversa; a decisão é de quem
-- conhece a nota.
