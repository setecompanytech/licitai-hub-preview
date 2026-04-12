-- Fix existing dates that were stored as UTC but are actually Brasília time
-- Only fix records from PNCP source where dates don't have proper offset
-- Shift dates by +3 hours (from UTC to Brasília interpretation)
UPDATE pncp_editais_cache
SET
  data_publicacao_pncp = data_publicacao_pncp - INTERVAL '3 hours',
  data_abertura_proposta = data_abertura_proposta - INTERVAL '3 hours',
  data_encerramento_proposta = data_encerramento_proposta - INTERVAL '3 hours'
WHERE fonte = 'pncp'
  AND data_publicacao_pncp IS NOT NULL;