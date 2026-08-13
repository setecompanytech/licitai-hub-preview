-- =============================================================================
-- Onda 3 — Permitir eventos de sessão na trilha de auditoria
--
-- As policies originais de `atividades_colaborador` (migration 20260310202304)
-- exigem `is_empresa_member(auth.uid(), empresa_id)` tanto no INSERT quanto no
-- SELECT. Com `empresa_id IS NULL` a função não retorna verdadeiro, então a
-- linha é recusada.
--
-- Isso inviabiliza justamente os eventos que a auditoria mais precisa:
-- login e logout acontecem fora de qualquer empresa — no login a empresa ativa
-- ainda não carregou, e no logout ela já foi descartada. Sem esta migration, a
-- trilha de sessão seria escrita, recusada pelo RLS e ninguém notaria: o mesmo
-- padrão de falha silenciosa que deixou a tabela vazia desde que foi criada.
--
-- O escopo é estreito de propósito: `empresa_id IS NULL` só é aceito para o
-- próprio usuário. Ninguém passa a enxergar atividade de outra pessoa.
-- =============================================================================

DROP POLICY IF EXISTS "Members can view empresa activities" ON public.atividades_colaborador;
CREATE POLICY "Members can view empresa activities"
ON public.atividades_colaborador FOR SELECT TO authenticated
USING (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR (empresa_id IS NULL AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own activities" ON public.atividades_colaborador;
CREATE POLICY "Users can insert own activities"
ON public.atividades_colaborador FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id))
);

-- A policy de DELETE continua exigindo admin da empresa, o que significa que
-- eventos de sessão (empresa_id nulo) não são apagáveis pela interface. É o
-- comportamento desejado para uma trilha de acesso — a limpeza por retenção
-- continua acontecendo pela rotina de expurgo, que roda com service_role.

-- A aba Histórico do prontuário filtra por metadata->>'licitacao_id'.
-- Sem este índice a consulta faz varredura completa da trilha, que cresce
-- rápido por ser escrita em toda operação de processo.
CREATE INDEX IF NOT EXISTS idx_atividades_licitacao
  ON public.atividades_colaborador ((metadata->>'licitacao_id'))
  WHERE metadata ? 'licitacao_id';

-- Consulta "o que esta pessoa fez nesta sessão", que é a leitura natural de
-- uma auditoria de acesso.
CREATE INDEX IF NOT EXISTS idx_atividades_sessao
  ON public.atividades_colaborador ((metadata->>'sessao_id'))
  WHERE metadata ? 'sessao_id';
