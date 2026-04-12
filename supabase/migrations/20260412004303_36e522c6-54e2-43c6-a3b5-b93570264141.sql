-- Fix: previous migration subtracted 3h but should have added 3h
-- Net correction: +6 hours (undo -3, then apply +3)
UPDATE pncp_editais_cache
SET
  data_publicacao_pncp = data_publicacao_pncp + INTERVAL '6 hours',
  data_abertura_proposta = data_abertura_proposta + INTERVAL '6 hours',
  data_encerramento_proposta = data_encerramento_proposta + INTERVAL '6 hours'
WHERE fonte = 'pncp'
  AND data_publicacao_pncp IS NOT NULL;