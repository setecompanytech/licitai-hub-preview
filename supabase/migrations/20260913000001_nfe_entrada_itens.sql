-- ============================================================================
-- Itens da NF-e de entrada — o registro que faltava
--
-- Até aqui os itens de uma nota de entrada viviam em três lugares, todos
-- derivados e nenhum consultável:
--
--   nfe_entradas.itens  jsonb, sem chave estrangeira, sem produto_id
--   nfe_entradas.xml    texto cru, reparseado em runtime a cada leitura
--   estoque_movimentos  uma linha por item vinculado, que guarda quantidade e
--                       preço e perde todo o resto
--
-- Sem esta tabela não havia onde gravar três coisas que o dono do produto
-- pediu em 13/09/2026:
--
--   1. a FINALIDADE de cada item (revenda, uso e consumo, imobilizado), que é
--      o parâmetro do direito a crédito de ICMS. É do ITEM, não do produto: a
--      mesma resma entra para o escritório numa nota e para o cliente noutra;
--   2. os dados fiscais DA OPERAÇÃO (CFOP, CST/CSOSN, impostos destacados),
--      que desde 13/09 não podem mais contaminar a ficha do produto — comprar
--      com 1.102 fazia vender com 1.102 — mas precisam existir para
--      escrituração e apuração de crédito;
--   3. o vínculo com o PROCESSO/contrato que a compra vai atender, quando
--      houver. Compra de abastecimento interno não tem, e forçá-lo inventaria
--      relação.
--
-- O molde é `fin_nfe_itens` (20260410214034), que já resolvia isto bem para o
-- acervo do Financeiro. Aqui não se reusa aquela tabela porque ela pende de
-- `fin_notas_fiscais`, outro acervo, com outra chave e outro ciclo de vida.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nfe_entrada_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nfe_entrada_id uuid NOT NULL REFERENCES public.nfe_entradas(id) ON DELETE CASCADE,

  -- Posição do item DENTRO da nota (det@nItem). É o que permite reconciliar
  -- esta linha com o XML depois, e o que impede a mesma linha de entrar duas
  -- vezes numa reimportação.
  n_item integer NOT NULL,

  -- ── O que a mercadoria é (atravessa a operação) ───────────────────────────
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  c_prod text,          -- código no sistema do FORNECEDOR, não o nosso
  c_ean text,
  x_prod text,
  ncm text,
  cest text,
  origem_mercadoria text,

  -- ── O que a operação foi (NÃO atravessa para a saída) ─────────────────────
  cfop text,
  cst_icms text,
  csosn text,
  cst_pis text,
  cst_cofins text,

  -- ── Quantidades e valores ─────────────────────────────────────────────────
  u_com text,
  q_com numeric,
  v_un_com numeric,
  v_prod numeric,
  v_desc numeric,

  -- ── Impostos destacados na entrada ────────────────────────────────────────
  -- Alíquotas em PERCENTUAL 0–100, como o CLAUDE.md determina para alíquota
  -- transcrita de documento (o XML traz `pICMS` como 18, não como 0,18).
  p_icms numeric,
  v_icms numeric,
  v_ipi numeric,
  v_pis numeric,
  v_cofins numeric,
  v_icms_st numeric,

  -- ── Finalidade e crédito ──────────────────────────────────────────────────
  finalidade text NOT NULL DEFAULT 'nao_informada'
    CHECK (finalidade IN ('revenda','uso_consumo','imobilizado','materia_prima','nao_informada')),

  -- De onde veio a finalidade: 'cfop', 'cadastro', 'manual'. Serve para separar
  -- o que alguém confirmou do que o sistema sugeriu — a diferença entre uma
  -- classificação fiscal e um palpite pré-preenchido.
  finalidade_origem text,

  -- A classificação do crédito no momento do lançamento, congelada. Não é
  -- cálculo: é o que a regra vigente dizia quando a nota entrou. A regra do
  -- uso e consumo já foi adiada cinco vezes, e recalcular o passado com a lei
  -- de hoje reescreveria a escrituração de exercícios fechados.
  credito_icms_situacao text
    CHECK (credito_icms_situacao IS NULL OR credito_icms_situacao IN ('permitido','vedado','parcelado','a_conferir')),
  credito_icms_fundamento text,

  -- ── Vínculo com o processo que a compra atende (quando houver) ────────────
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  contrato_item_id uuid REFERENCES public.contrato_itens(id) ON DELETE SET NULL,
  licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE SET NULL,

  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Reimportar a mesma nota não duplica item. `nfe_entradas` já tem
  -- UNIQUE (empresa_id, chave); esta é a mesma proteção um nível abaixo.
  CONSTRAINT uq_nfe_entrada_item UNIQUE (nfe_entrada_id, n_item)
);

CREATE INDEX IF NOT EXISTS idx_nfe_entrada_itens_nota
  ON public.nfe_entrada_itens (nfe_entrada_id, n_item);

-- "De quais notas veio este produto?" — a pergunta que a tela /produtos passa
-- a responder. Parcial porque item sem produto vinculado não interessa a ela.
CREATE INDEX IF NOT EXISTS idx_nfe_entrada_itens_produto
  ON public.nfe_entrada_itens (produto_id, created_at DESC)
  WHERE produto_id IS NOT NULL;

-- "O que foi comprado para atender este contrato?"
CREATE INDEX IF NOT EXISTS idx_nfe_entrada_itens_contrato
  ON public.nfe_entrada_itens (contrato_id)
  WHERE contrato_id IS NOT NULL;

-- Relatório de crédito por período precisa varrer por empresa e finalidade.
CREATE INDEX IF NOT EXISTS idx_nfe_entrada_itens_empresa_finalidade
  ON public.nfe_entrada_itens (empresa_id, finalidade);

COMMENT ON TABLE public.nfe_entrada_itens IS
  'Itens da NF-e de entrada, com a finalidade da compra (parâmetro do crédito de ICMS) e os dados fiscais da operação. Ver docs/nfe-entrada-e-produtos.md.';
COMMENT ON COLUMN public.nfe_entrada_itens.finalidade IS
  'Destino da mercadoria. É do ITEM, não do produto: o mesmo item entra para consumo numa nota e para revenda noutra.';
COMMENT ON COLUMN public.nfe_entrada_itens.cfop IS
  'CFOP da ENTRADA (1/2/3). Nunca alimenta a saída, que usa 5/6/7 — ver docs/nfe-entrada-e-produtos.md.';
COMMENT ON COLUMN public.nfe_entrada_itens.credito_icms_situacao IS
  'Classificação congelada no lançamento. Não é apuração: crédito depende de regra estadual, benefício e ST.';

ALTER TABLE public.nfe_entrada_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membro le itens da nfe de entrada" ON public.nfe_entrada_itens;
CREATE POLICY "membro le itens da nfe de entrada" ON public.nfe_entrada_itens
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membro grava itens da nfe de entrada" ON public.nfe_entrada_itens;
CREATE POLICY "membro grava itens da nfe de entrada" ON public.nfe_entrada_itens
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membro atualiza itens da nfe de entrada" ON public.nfe_entrada_itens;
CREATE POLICY "membro atualiza itens da nfe de entrada" ON public.nfe_entrada_itens
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin apaga itens da nfe de entrada" ON public.nfe_entrada_itens;
CREATE POLICY "admin apaga itens da nfe de entrada" ON public.nfe_entrada_itens
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- ============================================================================
-- Correção de rota: `estoque_movimentos.nfe_id` apontava para a tabela errada
--
-- A coluna foi criada com FK para `nfe_recebidas` (a tabela legada), mas o
-- código grava ali o id de `nfe_entradas` desde que o acervo mudou de casa.
-- Ou a constraint foi removida à mão em produção, ou todo lançamento de
-- estoque vindo de NF-e vem violando a chave em silêncio.
--
-- `ON DELETE SET NULL` e não CASCADE: apagar a nota não pode apagar o
-- histórico do estoque — o saldo já foi movimentado, e o trigger de saldo
-- recalcula somando os movimentos. Sumir com a linha mudaria o saldo atual
-- para corrigir um registro do passado.
-- ============================================================================

ALTER TABLE public.estoque_movimentos
  DROP CONSTRAINT IF EXISTS estoque_movimentos_nfe_id_fkey;

-- Saneamento ANTES de apontar a chave para o outro lado. Sem isto, uma única
-- linha herdada de `nfe_recebidas` derruba a migration inteira com violação de
-- chave, e o banco fica sem FK nenhuma — pior do que estava.
--
-- Duas passadas, nesta ordem, porque a primeira preserva o vínculo e a segunda
-- só desiste do que não tem para onde ir:

-- 1) Reaponta pelo que identifica a nota de verdade: a chave de 44 dígitos.
--    A mesma nota costuma existir nos dois acervos — o novo nasceu quando o
--    webhook passou a gravar em `nfe_entradas`, e o histórico ficou no velho.
UPDATE public.estoque_movimentos em
   SET nfe_id = ne.id
  FROM public.nfe_recebidas nr
  JOIN public.nfe_entradas ne
    ON ne.empresa_id = nr.empresa_id
   AND ne.chave = nr.chave_acesso
 WHERE em.nfe_id = nr.id
   AND nr.chave_acesso IS NOT NULL
   AND nr.chave_acesso <> '';

-- 2) O que sobrou não existe em `nfe_entradas`: solta a referência em vez de
--    apagar o movimento. O saldo do produto é a soma dos movimentos — sumir
--    com a linha para consertar um ponteiro mudaria o estoque de hoje por
--    causa de um registro do passado. A observação guarda o rastro para quem
--    for investigar depois.
UPDATE public.estoque_movimentos em
   SET nfe_id = NULL,
       observacoes = COALESCE(em.observacoes || ' · ', '')
         || 'Vínculo com a NF-e perdido na migração de 13/09/2026: a nota não existe em nfe_entradas.'
 WHERE em.nfe_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.nfe_entradas ne WHERE ne.id = em.nfe_id);

ALTER TABLE public.estoque_movimentos
  ADD CONSTRAINT estoque_movimentos_nfe_id_fkey
  FOREIGN KEY (nfe_id) REFERENCES public.nfe_entradas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.estoque_movimentos.nfe_id IS
  'NF-e de entrada que originou o movimento (nfe_entradas). Antes de 13/09/2026 a FK apontava para a legada nfe_recebidas, enquanto o código gravava ids de nfe_entradas.';

-- Item da entrada que originou o movimento — fecha a rastreabilidade
-- nota → item → produto → saldo.
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS nfe_entrada_item_id uuid
  REFERENCES public.nfe_entrada_itens(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
