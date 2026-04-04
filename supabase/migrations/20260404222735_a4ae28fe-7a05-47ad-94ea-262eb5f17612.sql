
-- Tabela para armazenar sugestões de marca/fabricante/modelo por item de licitação
CREATE TABLE public.sugestoes_marca_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  licitacao_item_id uuid REFERENCES public.licitacao_itens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  descricao_item text NOT NULL,
  marca_sugerida text NOT NULL,
  fabricante_sugerido text,
  modelo_sugerido text,
  fonte text NOT NULL DEFAULT 'historico',
  fonte_detalhe text,
  orgao_origem text,
  numero_processo_origem text,
  data_processo_origem timestamptz,
  preco_historico numeric,
  preco_cotacao_atual numeric,
  score_confianca numeric DEFAULT 0,
  ranking integer DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente',
  justificativa_ia text,
  aceito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sugestoes_marca_modelo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own sugestoes"
  ON public.sugestoes_marca_modelo FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_sugestoes_licitacao ON public.sugestoes_marca_modelo(licitacao_id);
CREATE INDEX idx_sugestoes_item ON public.sugestoes_marca_modelo(licitacao_item_id);
CREATE INDEX idx_sugestoes_status ON public.sugestoes_marca_modelo(status);
