
CREATE TABLE public.composicoes_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  licitacao_id uuid REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  licitacao_item_id uuid REFERENCES public.licitacao_itens(id) ON DELETE SET NULL,
  descricao_item text NOT NULL DEFAULT '',
  regime_tributario text,
  uf text,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ia_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.composicoes_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own composicoes"
  ON public.composicoes_custo FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_composicoes_custo_updated_at
  BEFORE UPDATE ON public.composicoes_custo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
