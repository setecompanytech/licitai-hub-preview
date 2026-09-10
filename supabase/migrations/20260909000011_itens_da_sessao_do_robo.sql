-- ═══════════════════════════════════════════════════════════════════════════
-- O robô deixa de ser uma ilha: os itens da disputa ganham lugar (09/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui, o que atravessava da tela para o agente era `edital` (string),
-- portal e três valores agregados da disputa inteira. Nem lista de itens, nem
-- lote, nem `licitacao_id`. Num pregão com 40 itens o robô achava o processo e
-- não sabia em qual item estava.
--
-- E havia um achatamento silencioso no caminho. A Precificação JÁ separa custo
-- de preço de venda (`catalogo_itens_precificados` tem `custo_unitario` e
-- `preco_unitario` em colunas distintas). Quem juntava tudo num campo só era o
-- transporte — de modo que o "valor de referência" da disputa podia ser a
-- estimativa do órgão, o nosso preço de venda, ou uma linha de custo, sem que
-- desse para distinguir depois de gravado.
--
-- Por isso as três colunas de valor nascem SEPARADAS e NULLABLE. Nulo aqui
-- significa "não sabido", e é informação: zero seria uma afirmação falsa sobre
-- dinheiro, do tipo que ninguém confere porque parece preenchido.

CREATE TABLE IF NOT EXISTS public.sessao_lance_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  sessao_id uuid NOT NULL REFERENCES public.sessoes_lance_real(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- Nullable como em `documentos`: a sessão-mãe é escopada por usuário, e a
  -- tela envia a empresa quando há uma ativa. A policy aceita os dois casos.
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- De onde o item veio no nosso lado. SET NULL: apagar o item do edital não
  -- pode apagar o rastro de uma disputa que já aconteceu.
  licitacao_item_id uuid REFERENCES public.licitacao_itens(id) ON DELETE SET NULL,

  -- ── Identificação do que está sendo disputado ─────────────────────────────
  numero integer NOT NULL DEFAULT 1,
  lote text,
  descricao text NOT NULL,
  marca text,
  modelo text,
  fabricante text,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'UN',

  -- ── Os três valores, cada um com o seu nome ───────────────────────────────
  -- Nunca colapsar em "valor_unitario": foi exatamente o colapso que criou o
  -- defeito que esta migration existe para corrigir.
  preco_venda numeric,            -- o nosso preço, vindo da Precificação/Proposta
  custo_unitario numeric,         -- o custo interno, que não é preço
  valor_estimado_orgao numeric,   -- o teto publicado no edital

  -- Piso PRÓPRIO do item. Antes existia um só para a disputa inteira, o que
  -- num pregão com margens diferentes por item não serve.
  valor_minimo numeric,

  -- ── Estado lido do portal durante a disputa ───────────────────────────────
  -- Tudo nullable: `sou_lider` nulo é "o portal não informou", que é diferente
  -- de false e faz o robô parar em vez de arriscar (ver `decidirLance`).
  melhor_lance numeric,
  sou_lider boolean,
  seu_ultimo_lance numeric,
  situacao text NOT NULL DEFAULT 'aguardando',

  -- 'precificacao' | 'proposta' | 'ia' | 'manual' — sem CHECK de propósito:
  -- origem nova não pode quebrar o envio de uma disputa.
  origem text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sessao_lance_itens IS
  'Itens/lotes de uma sessão do robô de lances. Um registro por item disputado, com os três valores (preço de venda, custo, estimativa do órgão) separados e o piso próprio.';
COMMENT ON COLUMN public.sessao_lance_itens.preco_venda IS
  'Nosso preço de venda. NULL = não sabido; nunca preencher com custo nem com a estimativa do órgão.';
COMMENT ON COLUMN public.sessao_lance_itens.valor_minimo IS
  'Piso deste item. NULL = não definido — o robô não deve dar lance sem piso.';
COMMENT ON COLUMN public.sessao_lance_itens.sou_lider IS
  'NULL = o portal não informou (diferente de false). Nesse estado o robô aguarda.';

CREATE INDEX IF NOT EXISTS idx_sessao_lance_itens_sessao
  ON public.sessao_lance_itens(sessao_id);
CREATE INDEX IF NOT EXISTS idx_sessao_lance_itens_empresa
  ON public.sessao_lance_itens(empresa_id);

ALTER TABLE public.sessao_lance_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessao_lance_itens_select ON public.sessao_lance_itens;
DROP POLICY IF EXISTS sessao_lance_itens_insert ON public.sessao_lance_itens;
DROP POLICY IF EXISTS sessao_lance_itens_update ON public.sessao_lance_itens;
DROP POLICY IF EXISTS sessao_lance_itens_delete ON public.sessao_lance_itens;

CREATE POLICY sessao_lance_itens_select ON public.sessao_lance_itens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id)));

CREATE POLICY sessao_lance_itens_insert ON public.sessao_lance_itens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id)));

-- Update por membro: quem acompanha a disputa pela tela pode ajustar o piso de
-- um item enquanto o pregão corre, e o agente grava o estado lido do portal.
CREATE POLICY sessao_lance_itens_update ON public.sessao_lance_itens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id)))
  WITH CHECK (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY sessao_lance_itens_delete ON public.sessao_lance_itens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_admin(auth.uid(), empresa_id)));

-- ── Aditivo em sessoes_lance_real ──────────────────────────────────────────
--
-- A sessão passa a dizer de qual processo ela nasceu e se a disputa é por item
-- ou por lote. As duas informações já existiam na tela (o diálogo deduz o tipo
-- dos lotes importados) e morriam no caminho — a sessão gravada não sabia
-- responder "de que processo é isto?" sem passar pela config da disputa.
ALTER TABLE public.sessoes_lance_real
  ADD COLUMN IF NOT EXISTS licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE SET NULL;

ALTER TABLE public.sessoes_lance_real
  ADD COLUMN IF NOT EXISTS tipo_disputa text;

COMMENT ON COLUMN public.sessoes_lance_real.tipo_disputa IS
  '''item'' ou ''lote''. NULL nas sessões anteriores a 09/09/2026, quando a informação não atravessava.';

-- ── Aditivo em licitacao_itens ─────────────────────────────────────────────
--
-- Uma coluna, nullable. `licitacao_itens` é usada por 17 arquivos (Precificação,
-- Proposta, Workspace, Gestão) e `valor_unitario` NÃO muda de semântica aqui —
-- mudar o significado de uma coluna com esse alcance é o tipo de alteração que
-- quebra tela em silêncio.
--
-- Serve ao piso por item quando os itens vêm pelo caminho central da cascata,
-- onde hoje o custo não sobrevive ao transporte.
ALTER TABLE public.licitacao_itens
  ADD COLUMN IF NOT EXISTS custo_unitario numeric;

COMMENT ON COLUMN public.licitacao_itens.custo_unitario IS
  'Custo interno do item, quando conhecido (fonte: Precificação). NULL = não sabido. Não confundir com valor_unitario, que é o valor da proposta/edital conforme a origem.';

NOTIFY pgrst, 'reload schema';
