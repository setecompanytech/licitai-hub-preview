-- 20260916000002 — o job que manda o robô entrar sozinho
--
-- APLICAR DEPOIS de publicar a edge function com a ação `disparar-agendadas`.
-- Antes disso o job existiria batendo numa rota que responde 400 a cada
-- minuto — barulho sem efeito, e do tipo que ninguém lê.
--
-- Reversão:
--   SELECT cron.unschedule('robo-disparar-agendadas');
--
-- O QUE ELE FAZ. A cada minuto pergunta à função quais disputas começam nos
-- próximos minutos e ainda não foram despachadas (`inicio_sessao` preenchido,
-- `enviada_em` nulo, robô da empresa ligado). Quem decide é a função; o job
-- só a acorda — a regra de negócio não mora em SQL.
--
-- CONDIÇÃO DE PARADA (princípio 5). Este job é comportamento de produto, não
-- rotina temporária: ele vive enquanto existir agendamento de disputa. Mas
-- ele só age sobre disputa com data marcada e empresa com o robô ligado —
-- desligar o robô da empresa (`robo_empresa_config.ligado = false`) já o
-- neutraliza para aquele cliente, sem mexer no cron. Para desligar de vez,
-- basta o `cron.unschedule` acima.
--
-- POR QUE A CADA MINUTO. A sessão pública abre em hora cheia e o robô precisa
-- estar logado antes: a janela de despacho da função é de minutos, e um job
-- de 5 em 5 minutos poderia perder o começo. Uma chamada por minuto a uma
-- função que normalmente não encontra nada é barata.

-- Idempotente: reagendar sem duplicar o job.
SELECT cron.unschedule('robo-disparar-agendadas')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'robo-disparar-agendadas');

SELECT cron.schedule(
  'robo-disparar-agendadas',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/robo-lances-webhook/disparar-agendadas',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);

-- Conferência:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'robo-disparar-agendadas';
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'robo-disparar-agendadas')
--    ORDER BY start_time DESC LIMIT 5;
--
-- Lembrete que já custou meses neste projeto: `net.http_post` é assíncrono, e
-- o job aparece como `succeeded` mesmo quando a função devolve erro. A prova
-- de que o despacho aconteceu é a disputa com `enviada_em` preenchido e a
-- linha nova em `sessoes_lance_real` — não o status do job.
