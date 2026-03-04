
-- Chat/Mural messages per licitação
CREATE TABLE public.licitacao_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id uuid NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'mensagem',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licitacao_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own licitacao_mensagens"
  ON public.licitacao_mensagens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.licitacao_mensagens;

-- Index for fast queries
CREATE INDEX idx_licitacao_mensagens_licitacao ON public.licitacao_mensagens(licitacao_id, created_at);
