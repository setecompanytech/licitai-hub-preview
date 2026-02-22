
-- Tabela de templates de documentos (gerenciada apenas por admins)
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  descricao TEXT,
  prompt_sistema TEXT NOT NULL,
  modelo_conteudo TEXT,
  legislacao_base TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Admins podem tudo
CREATE POLICY "Admins can manage templates"
ON public.document_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Usuários autenticados podem apenas ler templates ativos
CREATE POLICY "Authenticated users can view active templates"
ON public.document_templates
FOR SELECT
USING (ativo = true AND auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
