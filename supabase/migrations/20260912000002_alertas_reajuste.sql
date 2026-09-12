-- ============================================================================
-- Alertas escalonados de reajuste contratual (12/09)
-- ============================================================================
-- A régua do interregno anual (lib contratos/reajuste) era PASSIVA: só
-- avisava quem abrisse a página do contrato. O momento juridicamente crítico
-- é ANTES — pedir o reajuste antes de assinar prorrogação (preclusão lógica,
-- Parecer AGU 3/2023). A edge alertas-reajuste roda diariamente e dispara nos
-- marcos 90/60/30/7/0 dias antes do aniversário e, depois de devido, um
-- lembrete mensal: alerta no sistema (alertas_gerados, feed que o Editais já
-- exibe) + e-mail aos destinatários de alertas da empresa (a mesma lista das
-- certidões). O log deduplica: um disparo por contrato por marco, para sempre.
CREATE TABLE IF NOT EXISTS public.contratos_reajuste_alertas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  marco_tag text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  destinatarios integer NOT NULL DEFAULT 0,
  UNIQUE (contrato_id, marco_tag)
);

ALTER TABLE public.contratos_reajuste_alertas_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reajuste_alertas_log_select" ON public.contratos_reajuste_alertas_log;
CREATE POLICY "reajuste_alertas_log_select" ON public.contratos_reajuste_alertas_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contratos c
    WHERE c.id = contrato_id AND public.is_empresa_member(auth.uid(), c.empresa_id)
  ));
-- Sem policy de escrita: só a edge (service_role) grava.

SELECT cron.unschedule('alertas-reajuste-diario')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alertas-reajuste-diario');

SELECT cron.schedule(
  'alertas-reajuste-diario',
  '20 10 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/alertas-reajuste',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);
