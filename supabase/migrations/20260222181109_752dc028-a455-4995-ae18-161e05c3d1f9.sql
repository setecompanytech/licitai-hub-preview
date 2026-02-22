
-- Planos disponíveis no sistema
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  preco_mensal numeric NOT NULL DEFAULT 0,
  preco_anual numeric,
  recursos jsonb DEFAULT '[]'::jsonb,
  limite_licitacoes integer DEFAULT 50,
  limite_usuarios integer DEFAULT 1,
  destaque boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Planos são visíveis publicamente
CREATE POLICY "Anyone can view active plans" ON public.planos
  FOR SELECT USING (ativo = true);

-- Admins podem gerenciar planos
CREATE POLICY "Admins can manage plans" ON public.planos
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Assinaturas por empresa (CNPJ)
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  plano_id uuid REFERENCES public.planos(id) NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  stripe_customer_id text,
  stripe_subscription_id text,
  data_inicio timestamptz,
  data_fim timestamptz,
  valor_pago numeric,
  forma_pagamento text DEFAULT 'stripe',
  observacoes text,
  liberado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own subscriptions" ON public.assinaturas
  FOR SELECT USING (is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Admins can manage all subscriptions" ON public.assinaturas
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Tickets de suporte (SAC)
CREATE TABLE public.tickets_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assunto text NOT NULL,
  descricao text NOT NULL,
  categoria text DEFAULT 'geral',
  prioridade text DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberto',
  resposta text,
  respondido_por uuid,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets_suporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own tickets" ON public.tickets_suporte
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tickets" ON public.tickets_suporte
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON public.tickets_suporte
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- FAQ
CREATE TABLE public.faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta text NOT NULL,
  resposta text NOT NULL,
  categoria text DEFAULT 'geral',
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active FAQs" ON public.faq
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage FAQs" ON public.faq
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Triggers de updated_at
CREATE TRIGGER update_planos_updated_at BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assinaturas_updated_at BEFORE UPDATE ON public.assinaturas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_suporte_updated_at BEFORE UPDATE ON public.tickets_suporte FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_faq_updated_at BEFORE UPDATE ON public.faq FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir planos iniciais
INSERT INTO public.planos (nome, slug, descricao, preco_mensal, preco_anual, recursos, limite_licitacoes, limite_usuarios, destaque) VALUES
('Básico', 'basico', 'Ideal para pequenas empresas que participam de poucas licitações', 197, 1970, '["Monitoramento de até 50 editais/mês", "Kanban de tarefas", "1 usuário", "Suporte por e-mail", "Alertas básicos"]'::jsonb, 50, 1, false),
('Profissional', 'profissional', 'Para empresas que competem ativamente em licitações', 497, 4970, '["Monitoramento ilimitado", "Robô de lances automático", "Análise de concorrentes", "Até 5 usuários", "Assistente IA", "Apoio jurídico básico", "Suporte prioritário"]'::jsonb, 500, 5, true),
('Enterprise', 'enterprise', 'Solução completa para grandes empresas e consórcios', 997, 9970, '["Tudo do Profissional", "Usuários ilimitados", "API de integração", "Precificação avançada com SINAPI", "Apoio jurídico completo", "Gerente de conta dedicado", "SLA garantido"]'::jsonb, -1, -1, false);

-- Inserir FAQs iniciais
INSERT INTO public.faq (pergunta, resposta, categoria, ordem) VALUES
('O que é o LicitIA?', 'O LicitIA é uma plataforma completa de gestão e monitoramento de licitações públicas brasileiras, utilizando inteligência artificial para automatizar processos e aumentar suas chances de vitória.', 'geral', 1),
('Como funciona o monitoramento de editais?', 'Nossa IA monitora automaticamente portais como Compras.gov.br, PNCP e BEC/SP, filtrando licitações compatíveis com o CNAE da sua empresa e enviando alertas em tempo real.', 'funcionalidades', 2),
('O robô de lances é seguro?', 'Sim, o robô opera dentro das regras de cada portal, com criptografia de ponta a ponta para suas credenciais e total conformidade com a legislação vigente.', 'funcionalidades', 3),
('Posso cancelar a qualquer momento?', 'Sim, não há fidelidade. Você pode cancelar seu plano a qualquer momento sem multas ou taxas adicionais.', 'pagamento', 4),
('Como funciona o suporte?', 'Oferecemos suporte por chat com IA 24/7, tickets por e-mail e, para planos Enterprise, um gerente de conta dedicado.', 'suporte', 5),
('Quais portais são monitorados?', 'Atualmente monitoramos Compras.gov.br, PNCP, BEC/SP e Licitações-e (Banco do Brasil), com novos portais sendo adicionados constantemente.', 'funcionalidades', 6);
