-- 1. Remove função residual de cleanup
DROP FUNCTION IF EXISTS public.cleanup_seed_impostos_27042026(integer);

-- 2. Trigger de proteção: bloqueia DELETEs em massa (>1000 linhas/min por usuário)
CREATE TABLE IF NOT EXISTS public.financeiro_delete_rate (
  id bigserial PRIMARY KEY,
  user_id uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  qtd integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_fin_del_rate_time ON public.financeiro_delete_rate(deleted_at);

ALTER TABLE public.financeiro_delete_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_rate" ON public.financeiro_delete_rate FOR SELECT USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.guard_financeiro_lancamentos_mass_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total int;
BEGIN
  -- Permite operações de service_role / superuser (NULL auth.uid em jobs internos)
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Conta DELETEs do usuário no último minuto
  SELECT COALESCE(SUM(qtd),0) INTO v_total
  FROM public.financeiro_delete_rate
  WHERE user_id = v_uid AND deleted_at > now() - interval '1 minute';

  IF v_total >= 1000 THEN
    RAISE EXCEPTION 'Limite de exclusão em massa atingido (1000 lançamentos/minuto). Operação bloqueada por segurança.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Registra a deleção (via statement-level trigger contaria 1 statement; aqui é per-row)
  INSERT INTO public.financeiro_delete_rate(user_id, qtd) VALUES (v_uid, 1);
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_guard_financeiro_mass_delete ON public.financeiro_lancamentos;
CREATE TRIGGER trg_guard_financeiro_mass_delete
BEFORE DELETE ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.guard_financeiro_lancamentos_mass_delete();

-- 3. Limpeza periódica do rate (mantém últimas 24h)
CREATE OR REPLACE FUNCTION public.cleanup_financeiro_delete_rate()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  DELETE FROM public.financeiro_delete_rate WHERE deleted_at < now() - interval '24 hours';
$$;