-- ============================================================================
-- Alertas de vencimento de documentos por E-MAIL (assessorias + setores)
-- ============================================================================
--
-- O sistema JÁ rastreia vencimento (documentos.validade + lib de lembretes
-- in-app, janela de 30 dias, gravidade por proximidade). O que faltava era o
-- disparo EXTERNO — o alerta que chega à assessoria contábil antes de o
-- humano esquecer. Este pacote adiciona:
--   1) destinatários por empresa (e-mail; coluna whatsapp reservada — o envio
--      por WhatsApp aguarda contratação de provedor Meta/Twilio, mesmo padrão
--      FocusNFe);
--   2) configuração opt-in POR EMPRESA (desligada por padrão — princípio 7);
--   3) trilha de envios (dedupe de 1 disparo/dia por destinatário e auditoria);
--   4) cron diário chamando a edge alertas-documentos.
--
-- A CESSAÇÃO é estrutural, não detectada: o upload da renovação atualiza
-- documentos.validade; o documento sai da janela e simplesmente deixa de
-- entrar no digest — mesma propriedade da lib de lembretes in-app.

CREATE TABLE IF NOT EXISTS public.documentos_alertas_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  antecedencia_dias integer NOT NULL DEFAULT 30 CHECK (antecedencia_dias BETWEEN 5 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_alertas_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membros leem config de alertas de docs" ON public.documentos_alertas_config;
CREATE POLICY "membros leem config de alertas de docs" ON public.documentos_alertas_config
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "membros criam config de alertas de docs" ON public.documentos_alertas_config;
CREATE POLICY "membros criam config de alertas de docs" ON public.documentos_alertas_config
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "membros alteram config de alertas de docs" ON public.documentos_alertas_config;
CREATE POLICY "membros alteram config de alertas de docs" ON public.documentos_alertas_config
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "admin apaga config de alertas de docs" ON public.documentos_alertas_config;
CREATE POLICY "admin apaga config de alertas de docs" ON public.documentos_alertas_config
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TABLE IF NOT EXISTS public.documentos_alertas_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  tipo text NOT NULL DEFAULT 'interno' CHECK (tipo IN ('assessoria_contabil','interno','outro')),
  -- Reservado para a fase WhatsApp (aguarda provedor); nunca exibido sem uso.
  whatsapp text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, email)
);

ALTER TABLE public.documentos_alertas_destinatarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membros leem destinatarios de alertas" ON public.documentos_alertas_destinatarios;
CREATE POLICY "membros leem destinatarios de alertas" ON public.documentos_alertas_destinatarios
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "membros criam destinatarios de alertas" ON public.documentos_alertas_destinatarios;
CREATE POLICY "membros criam destinatarios de alertas" ON public.documentos_alertas_destinatarios
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "membros alteram destinatarios de alertas" ON public.documentos_alertas_destinatarios;
CREATE POLICY "membros alteram destinatarios de alertas" ON public.documentos_alertas_destinatarios
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "membros apagam destinatarios de alertas" ON public.documentos_alertas_destinatarios;
CREATE POLICY "membros apagam destinatarios de alertas" ON public.documentos_alertas_destinatarios
  FOR DELETE USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE TABLE IF NOT EXISTS public.documentos_alertas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  destinatario_email text NOT NULL,
  docs_no_digest integer NOT NULL,
  vencidos integer NOT NULL DEFAULT 0,
  dias_mais_critico integer,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_alertas_log_dedupe
  ON public.documentos_alertas_log (empresa_id, destinatario_email, enviado_em);

ALTER TABLE public.documentos_alertas_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "membros leem trilha de alertas de docs" ON public.documentos_alertas_log;
CREATE POLICY "membros leem trilha de alertas de docs" ON public.documentos_alertas_log
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
-- Escrita só pela edge (service role) — nenhuma policy de INSERT.

-- Cron diário: 10:00 UTC = 07:00 em Belém — a assessoria abre o dia com o
-- alerta na caixa. Princípio 5: helpers oficiais de URL e auth.
SELECT cron.unschedule('alertas-documentos-diario')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alertas-documentos-diario');

SELECT cron.schedule(
  'alertas-documentos-diario',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/alertas-documentos',
    -- cron_auth_header() já devolve o jsonb completo (Content-Type + Bearer).
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
