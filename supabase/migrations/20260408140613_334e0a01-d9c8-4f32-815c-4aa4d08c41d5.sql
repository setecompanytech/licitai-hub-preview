
-- Tabela de itens extraídos de documentos com controle de qualidade
CREATE TABLE IF NOT EXISTS public.edital_itens_extraidos (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacao_id     UUID REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  empresa_id       UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,

  -- Dados do item
  numero_item      INTEGER,
  numero_lote      INTEGER,
  codigo_catmat    TEXT,
  descricao        TEXT NOT NULL,
  unidade          TEXT DEFAULT 'UN',
  quantidade       NUMERIC(15, 4) DEFAULT 1,
  valor_unitario   NUMERIC(15, 4) DEFAULT 0,
  valor_total      NUMERIC(15, 2) DEFAULT 0,
  especificacoes   TEXT,
  exclusivo_me_epp BOOLEAN DEFAULT FALSE,
  marca            TEXT,
  fabricante       TEXT,
  modelo           TEXT,

  -- Controle de qualidade da extração
  confidence_score NUMERIC(3, 2) DEFAULT 1.0,
  erros            JSONB DEFAULT '[]',
  warnings         JSONB DEFAULT '[]',
  requer_revisao   BOOLEAN DEFAULT FALSE,

  -- Status do item
  status           TEXT DEFAULT 'pendente_revisao',

  -- Rastreabilidade
  estrategia_extracao TEXT,
  fonte_extracao   TEXT,
  aprovado_por     UUID,
  aprovado_em      TIMESTAMPTZ,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_edital_itens_licitacao ON public.edital_itens_extraidos(licitacao_id);
CREATE INDEX idx_edital_itens_revisao ON public.edital_itens_extraidos(licitacao_id) WHERE requer_revisao = TRUE AND status = 'pendente_revisao';
CREATE INDEX idx_edital_itens_empresa ON public.edital_itens_extraidos(empresa_id, status);
CREATE INDEX idx_edital_itens_user ON public.edital_itens_extraidos(user_id);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_edital_itens
  BEFORE UPDATE ON public.edital_itens_extraidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.edital_itens_extraidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own extracted items"
  ON public.edital_itens_extraidos FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own extracted items"
  ON public.edital_itens_extraidos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own extracted items"
  ON public.edital_itens_extraidos FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own extracted items"
  ON public.edital_itens_extraidos FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
