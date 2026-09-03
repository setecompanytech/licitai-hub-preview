-- ═══════════════════════════════════════════════════════════════════════════
-- Embeddings do acervo PNCP ganham o cron que nunca tiveram (03/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A infraestrutura de abril (coluna vector, índice HNSW, função de geração)
-- nunca teve agendamento: em 03/09 o acervo tinha 15.861 editais e ZERO
-- embeddings — o mesmo padrão do licitacoes-cleanup que rodou meses sem
-- existir. O backfill inicial foi disparado manualmente em 03/09; este cron
-- cobre o dia a dia: vetoriza o que as buscas e o sync incluíram na véspera.
--
-- 06:35 UTC = 03:35 em Brasília — janela de madrugada recomendada pelo PNCP,
-- depois do sync das 03:05 (para vetorizar o que ele acabou de trazer).
-- Lote 500: a função processa ~1,7/s; meio-dia de publicações cabe num lote.

SELECT cron.unschedule('pncp-embeddings-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-embeddings-diario');

SELECT cron.schedule(
  'pncp-embeddings-diario',
  '35 6 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/pncp-gerar-embeddings',
    headers := public.cron_auth_header(),
    body := '{"limite": 500}'::jsonb
  );
  $$
);
