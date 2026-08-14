-- =============================================================================
-- Fase 3 do prontuário integrado — checklist de habilitação como ENTIDADE
--
-- A extração de exigências já existia (verificar-documentos-edital, IA), mas o
-- resultado era efêmero: vivia na resposta HTTP e evaporava. Sem entidade não
-- há casamento auditável, nem estados, nem aceite, nem alerta. Esta tabela é o
-- checklist do processo: cada exigência do edital vira uma linha, classificada
-- na taxonomia (functions/_shared/habilitacao-tipos.ts), casada com o cofre da
-- empresa (agent_documentos, que já é por empresa) e carregando o estado real.
--
-- Estados do casamento (status): a IA sugere; `conferido` marca o aceite
-- humano — habilitação é risco jurídico, IA propõe e gente confirma, com
-- registro na trilha (atividades_colaborador).
--   ok                 documento do cofre casado e válido na data da sessão
--   vence_antes_sessao documento existe mas a validade expira antes do fim
--                      do recebimento de propostas (faltante na prática)
--   faltante           nenhum documento do tipo no cofre
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.processo_habilitacao_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  licitacao_id uuid NOT NULL,
  -- Classificação
  tipo text,                             -- id da taxonomia (null = não classificado)
  grupo text,                            -- juridica|fiscal|economica|tecnica|declaracoes|outro
  exigencia text NOT NULL,               -- texto extraído do edital
  referencia text,                       -- artigo/item do edital (ex.: "9.1.2")
  obrigatorio boolean NOT NULL DEFAULT true,
  observacao text,
  -- Casamento com o cofre
  status text NOT NULL DEFAULT 'faltante'
    CHECK (status IN ('ok', 'vence_antes_sessao', 'faltante')),
  documento_origem text,                 -- 'agent_documentos' | 'documentos'
  documento_id uuid,
  documento_nome text,
  documento_validade date,
  -- Aceite humano (IA propõe, gente confirma)
  conferido boolean NOT NULL DEFAULT false,
  aceito_por uuid,
  aceito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.processo_habilitacao_checklist IS
  'Checklist de habilitação do processo: exigências extraídas do edital pela '
  'IA, classificadas por tipo e casadas com o cofre da empresa. conferido=true '
  'após aceite humano (registrado na trilha de auditoria).';

-- Sem FK para licitacoes: o expurgo de 120 dias apaga o processo e o checklist
-- deve morrer junto — mas via limpeza explícita, não cascade silencioso que
-- esconderia checklist órfão de bug. Índice cobre a consulta do prontuário.
CREATE INDEX IF NOT EXISTS idx_habilitacao_checklist_licitacao
  ON public.processo_habilitacao_checklist (licitacao_id);

CREATE INDEX IF NOT EXISTS idx_habilitacao_checklist_empresa
  ON public.processo_habilitacao_checklist (empresa_id, status);

ALTER TABLE public.processo_habilitacao_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros da empresa veem o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa veem o checklist"
ON public.processo_habilitacao_checklist FOR SELECT TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa escrevem o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa escrevem o checklist"
ON public.processo_habilitacao_checklist FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa atualizam o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa atualizam o checklist"
ON public.processo_habilitacao_checklist FOR UPDATE TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Membros da empresa apagam o checklist" ON public.processo_habilitacao_checklist;
CREATE POLICY "Membros da empresa apagam o checklist"
ON public.processo_habilitacao_checklist FOR DELETE TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

-- updated_at automático (gatilho já padrão no projeto)
DROP TRIGGER IF EXISTS set_updated_at_habilitacao_checklist ON public.processo_habilitacao_checklist;
CREATE TRIGGER set_updated_at_habilitacao_checklist
  BEFORE UPDATE ON public.processo_habilitacao_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
