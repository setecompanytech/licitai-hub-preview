
-- Table for routing configuration and auto-response settings
CREATE TABLE public.whatsapp_roteamento_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  resposta_automatica boolean NOT NULL DEFAULT true,
  mensagem_boas_vindas text DEFAULT 'Olá! Recebi sua mensagem. Estou analisando e encaminhando ao setor responsável. Em breve retornaremos!',
  mensagem_fora_horario text DEFAULT 'Olá! No momento estamos fora do horário de atendimento. Sua mensagem foi registrada e será respondida em breve.',
  horario_inicio time DEFAULT '08:00',
  horario_fim time DEFAULT '18:00',
  dias_semana integer[] DEFAULT '{1,2,3,4,5}',
  provider text DEFAULT 'evolution',
  provider_url text,
  provider_api_key_id text,
  provider_instance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_roteamento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own routing config"
  ON public.whatsapp_roteamento_config FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add classification fields to whatsapp_mensagens
ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS setor_classificado text,
  ADD COLUMN IF NOT EXISTS confianca_classificacao numeric,
  ADD COLUMN IF NOT EXISTS auto_resposta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

-- Add provider fields to whatsapp_conversas
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS provider_chat_id text,
  ADD COLUMN IF NOT EXISTS classificacao_ia text,
  ADD COLUMN IF NOT EXISTS auto_roteada boolean DEFAULT false;

-- Log table for routing events
CREATE TABLE public.whatsapp_roteamento_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversa_id uuid REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  mensagem_id uuid,
  setor_origem text,
  setor_destino text NOT NULL,
  confianca numeric,
  motivo text,
  acao text NOT NULL DEFAULT 'classificacao',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_roteamento_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routing logs"
  ON public.whatsapp_roteamento_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert routing logs"
  ON public.whatsapp_roteamento_log FOR INSERT TO public
  WITH CHECK (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_roteamento_log;
