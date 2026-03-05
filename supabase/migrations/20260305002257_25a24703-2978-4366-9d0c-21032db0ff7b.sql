
CREATE TABLE public.licitacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  numero integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'UN',
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  lote text DEFAULT 'Único',
  marca text,
  fabricante text,
  modelo text,
  origem text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licitacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own licitacao_itens"
  ON public.licitacao_itens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_licitacao_itens_updated_at
  BEFORE UPDATE ON public.licitacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
