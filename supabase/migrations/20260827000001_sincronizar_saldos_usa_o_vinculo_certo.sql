-- ═══════════════════════════════════════════════════════════════════════════
-- "Sincronizar saldos" falhava por conferir pertencimento onde ele não mora
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A função checava o vínculo do usuário com a empresa assim:
--
--     WHERE e.id = p_empresa_id
--       AND (e.user_id = v_uid
--            OR EXISTS (SELECT 1 FROM jsonb_array_elements(e.membros) m
--                        WHERE (m->>'user_id')::uuid = v_uid))
--
-- `empresas` não tem `user_id` nem `membros`. Tem `created_by`, e o
-- pertencimento mora em `empresa_membros` — que é exatamente o que
-- `public.is_empresa_member` consulta, e o que todo o resto do sistema usa
-- (CLAUDE.md, princípio 2).
--
-- O resultado é que a função levantava `column e.user_id does not exist` em
-- TODA chamada, para todo usuário, desde que foi criada em 30/04. O botão
-- nunca funcionou uma vez.
--
-- E o erro não chegava a quem clicava. A tela faz
-- `e instanceof Error ? e.message : "Falha ao sincronizar saldos."`, e o erro
-- do Supabase é um `PostgrestError` — um objeto simples, não um `Error`. A
-- causa exata existia, vinha pela rede, e era descartada na última linha antes
-- de virar texto na tela.
--
-- ── O que a função faz, para quem for ler depois ────────────────────────────
-- Ela zera a defasagem SÓ das contas que não têm lançamento nenhum: saldo
-- gravado diferente do saldo de abertura, sem movimento que o justifique, é
-- resíduo. Conta com lançamento não é tocada aqui — para essa existe
-- `financeiro_recalcular_saldo_conta`, que deriva o saldo do movimento.

CREATE OR REPLACE FUNCTION public.sincronizar_saldos_contas_sem_movimento(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não informada.';
  END IF;

  -- O vínculo é lido de onde ele mora. `is_empresa_member` consulta
  -- `empresa_membros`, e é a mesma autoridade que as políticas de RLS usam —
  -- duas leituras diferentes do mesmo conceito é como se erra duas vezes.
  IF NOT public.is_empresa_member(v_uid, p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada.';
  END IF;

  WITH alvos AS (
    SELECT c.id
    FROM public.financeiro_contas c
    WHERE c.empresa_id = p_empresa_id
      AND COALESCE(c.ativa, true) = true
      AND COALESCE(c.saldo_atual, 0) <> COALESCE(c.saldo_inicial, 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_lancamentos l
        WHERE l.conta_id = c.id OR l.conta_destino_id = c.id
      )
  )
  UPDATE public.financeiro_contas c
     SET saldo_atual = COALESCE(c.saldo_inicial, 0),
         updated_at  = now()
    FROM alvos
   WHERE c.id = alvos.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) TO authenticated;

COMMENT ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) IS
  'Zera a defasagem das contas SEM lançamento nenhum — saldo gravado diferente '
  'do de abertura, sem movimento que o justifique, é resíduo. Conta com '
  'lançamento não é tocada: para essa, quem manda é '
  'financeiro_recalcular_saldo_conta. O vínculo do usuário é lido por '
  'is_empresa_member; a versão de 30/04 procurava em empresas.user_id e '
  'empresas.membros, colunas que não existem, e por isso falhava em toda '
  'chamada desde que nasceu.';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Quais contas seriam ajustadas (rode antes, se quiser ver):
--   SELECT c.nome, c.saldo_inicial, c.saldo_atual
--     FROM public.financeiro_contas c
--     JOIN public.empresas e ON e.id = c.empresa_id
--    WHERE e.razao_social ILIKE 'ETHOS%'
--      AND COALESCE(c.ativa, true)
--      AND COALESCE(c.saldo_atual,0) <> COALESCE(c.saldo_inicial,0)
--      AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l
--                       WHERE l.conta_id = c.id OR l.conta_destino_id = c.id);
