
-- Tabela para armazenar cotações extraídas de PDFs de fornecedores
CREATE TABLE public.cotacoes_fornecedor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome_fornecedor TEXT NOT NULL,
  cnpj_fornecedor TEXT,
  arquivo_nome TEXT NOT NULL,
  arquivo_path TEXT,
  data_cotacao DATE,
  validade_dias INTEGER DEFAULT 30,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cotacoes_fornecedor ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can CRUD own cotacoes_fornecedor"
  ON public.cotacoes_fornecedor
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_cotacoes_fornecedor_updated_at
  BEFORE UPDATE ON public.cotacoes_fornecedor
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
