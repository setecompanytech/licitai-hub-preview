-- Aumenta timeout para o role postgres durante seed e desativa triggers de audit/apuracao temporariamente
ALTER TABLE public.financeiro_lancamentos DISABLE TRIGGER trg_audit_fl;
ALTER TABLE public.financeiro_lancamentos DISABLE TRIGGER trg_marcar_apuracao_desatualizada;