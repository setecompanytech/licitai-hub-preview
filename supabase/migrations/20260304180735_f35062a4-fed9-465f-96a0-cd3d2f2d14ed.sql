
-- Table to store priced item catalogs from Precificação
CREATE TABLE public.catalogo_itens_precificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  licitacao_numero TEXT,
  licitacao_orgao TEXT,
  tipo_calculo TEXT NOT NULL DEFAULT 'produto',
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'UN',
  marca TEXT,
  fabricante TEXT,
  modelo TEXT,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  preco_total NUMERIC NOT NULL DEFAULT 0,
  margem_lucro NUMERIC DEFAULT 15,
  tributos_total NUMERIC DEFAULT 0,
  frete_percentual NUMERIC DEFAULT 0,
  bdi_percentual NUMERIC DEFAULT 0,
  regime_tributario TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_itens_precificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own catalogo items"
  ON public.catalogo_itens_precificados
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_catalogo_itens_updated_at
  BEFORE UPDATE ON public.catalogo_itens_precificados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
