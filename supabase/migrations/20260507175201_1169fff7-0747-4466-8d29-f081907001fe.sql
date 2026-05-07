CREATE INDEX IF NOT EXISTS idx_audit_lanc_delete_id ON public.financeiro_audit_log (((dados_antes->>'id')::uuid)) WHERE tabela='financeiro_lancamentos' AND operacao='DELETE';
CREATE INDEX IF NOT EXISTS idx_audit_lanc_delete_origem ON public.financeiro_audit_log ((dados_antes->>'origem_tipo')) WHERE tabela='financeiro_lancamentos' AND operacao='DELETE';
ANALYZE public.financeiro_audit_log;