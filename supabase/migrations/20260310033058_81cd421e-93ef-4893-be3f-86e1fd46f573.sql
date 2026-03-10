
-- WhatsApp CRM: Conversas (inbox)
CREATE TABLE public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  setor text NOT NULL DEFAULT 'licitações',
  contato_nome text NOT NULL,
  contato_telefone text NOT NULL,
  contato_empresa text,
  contato_avatar_url text,
  ultima_mensagem text,
  ultima_mensagem_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'aberta',
  atribuido_a text,
  tags text[] DEFAULT '{}',
  lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own whatsapp_conversas" ON public.whatsapp_conversas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WhatsApp CRM: Mensagens
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  direcao text NOT NULL DEFAULT 'entrada',
  tipo text NOT NULL DEFAULT 'texto',
  conteudo text NOT NULL,
  metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'recebida',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own whatsapp_mensagens" ON public.whatsapp_mensagens FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WhatsApp CRM: Leads (pipeline)
CREATE TABLE public.whatsapp_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  telefone text NOT NULL,
  empresa text,
  email text,
  setor text NOT NULL DEFAULT 'licitações',
  etapa text NOT NULL DEFAULT 'novo',
  valor_estimado numeric DEFAULT 0,
  origem text DEFAULT 'whatsapp',
  notas text,
  ordem integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own whatsapp_leads" ON public.whatsapp_leads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WhatsApp CRM: Templates de mensagem
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  conteudo text NOT NULL,
  variaveis text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  uso_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own whatsapp_templates" ON public.whatsapp_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WhatsApp CRM: Campanhas de envio em massa
CREATE TABLE public.whatsapp_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id),
  mensagem text NOT NULL,
  setor text,
  status text NOT NULL DEFAULT 'rascunho',
  total_destinatarios integer DEFAULT 0,
  enviados integer DEFAULT 0,
  erros integer DEFAULT 0,
  agendado_para timestamptz,
  executado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own whatsapp_campanhas" ON public.whatsapp_campanhas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WhatsApp CRM: Destinatários de campanha
CREATE TABLE public.whatsapp_campanha_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campanha_id uuid NOT NULL REFERENCES public.whatsapp_campanhas(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  nome text,
  status text NOT NULL DEFAULT 'pendente',
  erro text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_campanha_destinatarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own campanha_destinatarios" ON public.whatsapp_campanha_destinatarios FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
