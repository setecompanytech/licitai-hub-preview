-- ═══════════════════════════════════════════════════════════════════════════
-- O guarda de exclusão em massa PERMITE sessões internas — não as engole
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Descoberto em 01/09/2026, às custas de dois DELETEs que "rodaram com
-- sucesso" e não excluíram nada: `guard_financeiro_lancamentos_mass_delete`
-- devolvia NULL quando `auth.uid()` era nulo, com o comentário "Permite
-- operações de service_role / superuser".
--
-- Em gatilho BEFORE ... FOR EACH ROW, RETURN NULL não permite: CANCELA a
-- linha, em silêncio. O código fazia o oposto exato do que o comentário
-- prometia. Desde 07/05, todo DELETE em financeiro_lancamentos vindo do SQL
-- Editor ou de job interno era descartado sem erro, sem aviso, sem rastro —
-- "Success. No rows returned". Pela tela (auth.uid presente) funcionava, o
-- que tornou o defeito quase invisível.
--
-- Falha silenciosa é proibida nesta casa. Para permitir, devolve-se OLD.
-- O resto do guarda — limite de 1000 exclusões/minuto por usuário — segue
-- exatamente como era.

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
  -- Sessão interna (SQL Editor, service_role, job): sem auth.uid.
  -- Permitir de verdade é devolver OLD — RETURN NULL cancelava o DELETE.
  IF v_uid IS NULL THEN
    RETURN OLD;
  END IF;

  -- Conta DELETEs do usuário no último minuto
  SELECT COALESCE(SUM(qtd),0) INTO v_total
  FROM public.financeiro_delete_rate
  WHERE user_id = v_uid AND deleted_at > now() - interval '1 minute';

  IF v_total >= 1000 THEN
    RAISE EXCEPTION 'Limite de exclusão em massa atingido (1000 lançamentos/minuto). Operação bloqueada por segurança.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.financeiro_delete_rate(user_id, qtd) VALUES (v_uid, 1);
  RETURN OLD;
END $$;

COMMENT ON FUNCTION public.guard_financeiro_lancamentos_mass_delete() IS
  'Limita exclusões de lançamentos a 1000/minuto por usuário. Sessões sem '
  'auth.uid (SQL Editor, service_role) passam direto — RETURN OLD, nunca '
  'NULL: em gatilho de linha, NULL cancela a operação em silêncio, e foi '
  'exatamente assim que este guarda engoliu DELETEs legítimos por quatro meses.';
