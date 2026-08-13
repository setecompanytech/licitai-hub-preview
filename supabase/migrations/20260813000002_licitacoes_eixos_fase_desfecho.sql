-- =============================================================================
-- Onda 2 — Separar os três eixos que disputavam a coluna `status`
--
-- `status` respondia a três perguntas ao mesmo tempo:
--   1. em que fase do funil o processo está   (muda várias vezes)
--   2. como ele terminou                       (escrito uma vez, nunca muda)
--   3. se ainda ocupa a mesa de trabalho       (arquivado_em)
--
-- Como as três dividiam o mesmo campo, escrever uma apagava as outras. O caso
-- concreto: `arquivarProcesso()` gravava status='Arquivada' sobre 'Homologada',
-- e restaurar devolvia 'Monitorando' — apagando o fato de a empresa ter ganhado
-- a licitação, que alimenta os KPIs "Ganhas" e "Valor Ganho" do painel.
--
-- DECISÃO DE DESENHO: `status` continua sendo a coluna de escrita. `fase` e
-- `desfecho` são DERIVADAS por trigger, nunca escritas pelo app.
-- Motivo: os triggers `comercial_marcar_proposta_enviada` e
-- `comercial_exigir_motivo_perda` (migration 20260803000002) comparam
-- `NEW.status` com literais exatos, e o Lovable escreve direto no `main` sem
-- passar por revisão. Um modelo em que o app precisa lembrar de preencher três
-- colunas volta a divergir na primeira tela nova. Derivar no banco não tem essa
-- exposição.
-- =============================================================================

ALTER TABLE public.licitacoes
  ADD COLUMN IF NOT EXISTS fase text,
  ADD COLUMN IF NOT EXISTS desfecho text;

COMMENT ON COLUMN public.licitacoes.fase IS
  'DERIVADA de status. Posição no funil operacional: Monitorando, Em Análise, '
  'Proposta Enviada, Em Disputa, Encerrada. Não escrever pelo app.';

COMMENT ON COLUMN public.licitacoes.desfecho IS
  'DERIVADA de status + resultado. Como o processo terminou: Ganho, Perdido, '
  'Deserto, Fracassado, Revogado, Anulado, Desclassificada. NULL enquanto '
  'estiver em andamento. Não escrever pelo app.';

-- -----------------------------------------------------------------------------
-- Derivação — ESPELHO de src/lib/licitacao/status.ts (normalizarStatus).
-- As duas versões precisam mudar juntas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.licitacoes_derivar_eixos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text := lower(coalesce(NEW.status, ''));
  v_result text := lower(coalesce(NEW.resultado, ''));
BEGIN
  -- ---- Desfecho ----------------------------------------------------------
  -- Vem primeiro porque, uma vez definido, ele congela a fase em 'Encerrada'.
  IF v_result IN ('deserto', 'fracassado', 'revogado', 'anulado', 'desclassificada') THEN
    NEW.desfecho := initcap(v_result);
  ELSIF v_status LIKE '%homolog%' OR v_status LIKE '%vencid%'
        OR v_status LIKE '%adjudic%' OR v_result = 'vencedor' THEN
    NEW.desfecho := 'Ganho';
  ELSIF v_status LIKE '%perdid%' OR v_result = 'perdedor' THEN
    NEW.desfecho := 'Perdido';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Desfecho não se apaga: um processo que já terminou e voltou ao Kanban
    -- por engano continua tendo terminado. Mesma lógica de
    -- `comercial_marcar_proposta_enviada`, que também é irreversível.
    -- (OLD só existe em UPDATE — referenciá-lo em INSERT levanta
    -- 'record "old" is not assigned yet'.)
    NEW.desfecho := OLD.desfecho;
  ELSE
    NEW.desfecho := NULL;
  END IF;

  -- ---- Fase --------------------------------------------------------------
  IF NEW.desfecho IS NOT NULL THEN
    NEW.fase := 'Encerrada';
  ELSIF v_status LIKE '%disputa%' THEN
    NEW.fase := 'Em Disputa';
  ELSIF v_status LIKE '%proposta%' OR v_status = 'enviada' THEN
    NEW.fase := 'Proposta Enviada';
  ELSIF v_status LIKE '%anális%' OR v_status LIKE '%analis%' THEN
    NEW.fase := 'Em Análise';
  ELSE
    -- 'Publicado', 'novo', 'monitorando' e qualquer desconhecido entram pelo
    -- topo do funil: é o único destino que não afirma nada de errado.
    NEW.fase := 'Monitorando';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS licitacoes_derivar_eixos ON public.licitacoes;
CREATE TRIGGER licitacoes_derivar_eixos
  BEFORE INSERT OR UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION public.licitacoes_derivar_eixos();

-- -----------------------------------------------------------------------------
-- Backfill — reprocessa todas as linhas existentes pelo trigger.
-- O UPDATE no-op dispara o BEFORE UPDATE e preenche fase/desfecho.
-- -----------------------------------------------------------------------------
UPDATE public.licitacoes SET status = status WHERE fase IS NULL;

-- -----------------------------------------------------------------------------
-- Higiene do legado: linhas cujo `status` é 'Arquivada' perderam o desfecho
-- real na gravação antiga e não há como recuperá-lo do próprio campo. O que dá
-- para recuperar vem de `resultado`, `vencedor` e `data_homologacao`, que o
-- arquivamento nunca tocou. As demais ficam sem desfecho — honesto é registrar
-- que não se sabe, não inventar 'Perdido'.
-- -----------------------------------------------------------------------------
UPDATE public.licitacoes
   SET desfecho = 'Ganho', fase = 'Encerrada'
 WHERE desfecho IS NULL
   AND (vencedor IS TRUE OR data_homologacao IS NOT NULL);

-- Marca o arquivamento das que estavam com status='Arquivada' mas sem a data,
-- para que a Onda 1 (que decide a faixa por `arquivado_em`) não as mostre como
-- ativas no painel.
UPDATE public.licitacoes
   SET arquivado_em = COALESCE(arquivado_em, updated_at, now())
 WHERE lower(coalesce(status, '')) LIKE '%arquiv%'
   AND arquivado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_licitacoes_fase
  ON public.licitacoes (empresa_id, fase) WHERE arquivado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_licitacoes_desfecho
  ON public.licitacoes (empresa_id, desfecho) WHERE desfecho IS NOT NULL;
