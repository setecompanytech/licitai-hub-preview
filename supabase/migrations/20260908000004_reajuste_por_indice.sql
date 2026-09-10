-- ═══════════════════════════════════════════════════════════════════════════
-- Reajuste em sentido estrito — Fase 1 + fonte oficial dos índices (08/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O contrato/ata anexado tem cláusula de reajuste (obrigatória: art. 25, §7º
-- e art. 92, V da Lei 14.133/2021) e a leitura inteligente a descartava. As
-- três colunas guardam o que a cláusula diz — índice, data-base e a frase
-- literal para conferência (o mesmo padrão dos prazos de entrega/pagamento).
-- É delas que o alerta de aniversário anual parte: interregno de 1 ano
-- (Lei 10.192/2001, arts. 2º-3º), aplicação por apostila (art. 136, I).

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS indice_reajuste text,
  ADD COLUMN IF NOT EXISTS data_base_reajuste date,
  ADD COLUMN IF NOT EXISTS reajuste_clausula text;

COMMENT ON COLUMN public.contratos.indice_reajuste IS
  'Sigla do índice da cláusula de reajuste (IPCA, IGP-M, INPC…) — extraída do documento ou preenchida à mão';
COMMENT ON COLUMN public.contratos.data_base_reajuste IS
  'Data-base da contagem do interregno anual (data do orçamento estimado/proposta, conforme a cláusula)';
COMMENT ON COLUMN public.contratos.reajuste_clausula IS
  'Frase literal da cláusula de reajuste, para conferência humana';

-- ── Cron mensal dos índices oficiais ────────────────────────────────────────
-- A base indices_economicos era populada sob demanda por IA generativa —
-- aceitável para painel informativo, inaceitável como base de requerimento
-- formal de reajuste. A função passa a buscar no SGS do Banco Central
-- (determinístico, auditável); este cron a roda todo dia 15 (o IPCA do mês
-- anterior sai por volta do dia 10). Rotina PERMANENTE por natureza — índice
-- novo todo mês —, não cai na regra de condição de parada.

SELECT cron.unschedule('indices-oficiais-mensal')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'indices-oficiais-mensal');

SELECT cron.schedule(
  'indices-oficiais-mensal',
  '0 9 15 * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/indices-economicos',
    headers := public.cron_auth_header(),
    body := '{"action": "atualizar_indices"}'::jsonb
  );
  $$
);
