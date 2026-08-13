-- =============================================================================
-- Onda 1 — Agendar o arquivamento/expurgo de processos licitatórios
--
-- A edge function `licitacoes-cleanup` existe desde 20260223030808 e nunca teve
-- agendamento: nenhum dos 12 jobs em cron.job aponta para ela. A política de
-- retenção declarada no próprio COMMENT da coluna `licitacoes.arquivado_em`
-- ("Após 120 dias, será excluído automaticamente") nunca executou.
--
-- A URL vem do vault em vez de literal. Quatro migrations antigas fixaram
-- 'https://sbnlovigyifvrkgsoalj.supabase.co', que não é o projeto atual
-- (uwtyuwktxalnpgrcbbgk, conforme supabase/config.toml e .env) — aqueles jobs
-- provavelmente estão batendo em host errado desde a migração de projeto.
-- Aceita as duas grafias de chave em uso no vault ('SUPABASE_URL' e
-- 'supabase_url').
-- =============================================================================

-- Idempotência: derruba o agendamento anterior antes de recriar.
SELECT cron.unschedule('licitacoes-cleanup-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'licitacoes-cleanup-diario');

SELECT cron.schedule(
  'licitacoes-cleanup-diario',
  '20 6 * * *', -- 06:20 UTC = 03:20 BRT, fora do horário de operação
  $$
  SELECT net.http_post(
    url := COALESCE(
             (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1),
             (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1),
             -- Último recurso: o vault do projeto de produção não tem essas
             -- chaves (verificado em 2026-08-13), e sem fallback a URL vira
             -- NULL — o job seria criado e falharia toda madrugada em silêncio.
             -- O literal aqui é o projeto ao qual o app está preso em quatro
             -- lugares (client.ts:5, vite.config.ts:12, .env, config.toml).
             'https://uwtyuwktxalnpgrcbbgk.supabase.co'
           ) || '/functions/v1/licitacoes-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Índice que o novo cleanup usa: ele passou a filtrar por `updated_at` para
-- respeitar a carência de 30 dias entre o desfecho e o arquivamento.
CREATE INDEX IF NOT EXISTS idx_licitacoes_pendente_arquivamento
  ON public.licitacoes (updated_at)
  WHERE arquivado_em IS NULL;
