
-- Table to track user interest in bidding processes per company
CREATE TABLE public.processos_interesse (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  orgao TEXT NOT NULL,
  objeto TEXT NOT NULL,
  modalidade TEXT DEFAULT 'Pregão Eletrônico',
  valor_estimado NUMERIC DEFAULT NULL,
  uf TEXT DEFAULT NULL,
  municipio TEXT DEFAULT NULL,
  data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  data_encerramento TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  portal TEXT DEFAULT NULL,
  url TEXT DEFAULT NULL,
  -- Interest & workflow status
  status TEXT NOT NULL DEFAULT 'interessado',
  aprovado_usuario BOOLEAN DEFAULT FALSE,
  auto_cadastro BOOLEAN DEFAULT FALSE,
  preco_validado BOOLEAN DEFAULT FALSE,
  -- Alert config
  alerta_7dias BOOLEAN DEFAULT TRUE,
  alerta_3dias BOOLEAN DEFAULT TRUE,
  alerta_1dia BOOLEAN DEFAULT TRUE,
  alerta_email BOOLEAN DEFAULT TRUE,
  alerta_whatsapp BOOLEAN DEFAULT FALSE,
  alerta_sistema BOOLEAN DEFAULT TRUE,
  -- Tracking
  ultimo_alerta_enviado TEXT DEFAULT NULL,
  ia_recomendacao TEXT DEFAULT NULL,
  ia_score NUMERIC DEFAULT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  notas TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processos_interesse ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can CRUD own processos_interesse"
  ON public.processos_interesse
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_processos_interesse_updated_at
  BEFORE UPDATE ON public.processos_interesse
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for AI workflow steps
CREATE TABLE public.workflow_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  processo_interesse_id UUID REFERENCES public.processos_interesse(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL DEFAULT 'pesquisa',
  status TEXT NOT NULL DEFAULT 'pendente',
  descricao TEXT DEFAULT NULL,
  resultado_ia TEXT DEFAULT NULL,
  dados_json JSONB DEFAULT '{}'::jsonb,
  aprovado BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own workflow_ia"
  ON public.workflow_ia
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_workflow_ia_updated_at
  BEFORE UPDATE ON public.workflow_ia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for processos_interesse
ALTER PUBLICATION supabase_realtime ADD TABLE public.processos_interesse;
