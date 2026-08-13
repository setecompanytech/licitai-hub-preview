-- =============================================================================
-- Onda 4 — Processo licitatório passa a ser da EMPRESA, não do colaborador
--
-- O painel anuncia "Resultados de: <empresa>" e entrega apenas os processos do
-- usuário logado: as policies de `licitacoes` são estritamente
-- `auth.uid() = user_id` desde a criação da tabela (20260222151544). O efeito é
-- que dois colaboradores da mesma empresa veem painéis diferentes, nenhum vê o
-- do outro, e um processo iniciado por quem saiu da empresa fica invisível para
-- todos — inclusive para o admin. O Kanban, apresentado como quadro de equipe,
-- nunca foi colaborativo.
--
-- O risco clássico desta mudança — processos legados sem `empresa_id` sumirem
-- do painel de todo mundo — não existe aqui: a coluna é NOT NULL desde
-- 2026-08-08 (20260808000005), com backfill feito em 20260808000004.
--
-- Papéis preservados:
--   user_id     — quem criou o processo
--   operador_id — quem responde por ele hoje (passou a ser preenchido na Onda 3)
-- Nenhum dos dois deixa de enxergar o próprio processo, mesmo que saia da
-- empresa: as cláusulas por usuário continuam no OR.
-- =============================================================================

-- ---- SELECT -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Operadores can view assigned licitacoes" ON public.licitacoes;
CREATE POLICY "Membros da empresa veem os processos"
ON public.licitacoes FOR SELECT TO authenticated
USING (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR user_id = auth.uid()
  OR operador_id = auth.uid()
);

-- ---- INSERT -----------------------------------------------------------------
-- Continua exigindo que a pessoa assine o próprio INSERT (`user_id`), e agora
-- também que ela seja membro da empresa que está recebendo o processo — sem
-- isso, seria possível criar processo dentro de empresa alheia.
DROP POLICY IF EXISTS "Users can insert own licitacoes" ON public.licitacoes;
CREATE POLICY "Membros da empresa criam processos"
ON public.licitacoes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_empresa_member(auth.uid(), empresa_id)
);

-- ---- UPDATE -----------------------------------------------------------------
-- O WITH CHECK impede mover um processo para outra empresa como forma de
-- exfiltrá-lo: o destino também precisa ser uma empresa da qual se é membro.
DROP POLICY IF EXISTS "Users can update own licitacoes" ON public.licitacoes;
CREATE POLICY "Membros da empresa atualizam os processos"
ON public.licitacoes FOR UPDATE TO authenticated
USING (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR user_id = auth.uid()
  OR operador_id = auth.uid()
)
WITH CHECK (
  public.is_empresa_member(auth.uid(), empresa_id)
  OR user_id = auth.uid()
);

-- ---- DELETE -----------------------------------------------------------------
-- Convenção do repo: delete via `is_empresa_admin`. O criador continua podendo
-- excluir o que criou — tirar isso removeria uma capacidade que ele já tem hoje,
-- e a exclusão agora fica registrada na trilha (Onda 3).
DROP POLICY IF EXISTS "Users can delete own licitacoes" ON public.licitacoes;
CREATE POLICY "Admin da empresa ou autor excluem o processo"
ON public.licitacoes FOR DELETE TO authenticated
USING (
  public.is_empresa_admin(auth.uid(), empresa_id)
  OR user_id = auth.uid()
);

-- ---- Índices ----------------------------------------------------------------
-- As telas passam a filtrar por empresa_id em vez de user_id; o índice antigo
-- (idx_licitacoes_user) deixa de atender a consulta principal do painel.
CREATE INDEX IF NOT EXISTS idx_licitacoes_empresa_recentes
  ON public.licitacoes (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_licitacoes_operador
  ON public.licitacoes (operador_id) WHERE operador_id IS NOT NULL;

COMMENT ON COLUMN public.licitacoes.operador_id IS
  'Colaborador responsável pelo processo hoje, que pode não ser quem o criou '
  '(user_id). Preenchido desde a Onda 3 em iniciarProcesso(). Usado para '
  'redistribuir carteira e para manter acesso de quem toca o processo.';
