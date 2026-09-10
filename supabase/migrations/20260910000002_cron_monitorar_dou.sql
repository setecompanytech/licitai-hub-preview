-- ============================================================================
-- Monitoramento dos Diários Oficiais sai da dormência (10/09)
-- ============================================================================
-- A função monitorar-dou existia sem cron: buscava só o Querido Diário e
-- nunca rodava. Agora ela busca DOU (in.gov.br) + diários municipais pelos
-- termos DA EMPRESA (CNPJ formatado, razão social, fantasia) e classifica
-- aviso de licitação / extrato de contrato / ata / aditivo. Varredura a cada
-- 4 horas, 24/7 — diário oficial publica uma edição por dia útil; seis
-- passadas diárias cobrem o relógio sem marretar as fontes.
SELECT cron.unschedule('monitorar-dou-4h')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitorar-dou-4h');

SELECT cron.schedule(
  'monitorar-dou-4h',
  '30 */4 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/monitorar-dou',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);
