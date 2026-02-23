
-- Add result and archival fields to licitacoes
ALTER TABLE public.licitacoes 
  ADD COLUMN IF NOT EXISTS resultado text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_adjudicado numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_homologacao timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vencedor boolean DEFAULT NULL;

-- Create index for archival cleanup
CREATE INDEX IF NOT EXISTS idx_licitacoes_arquivado_em ON public.licitacoes (arquivado_em) WHERE arquivado_em IS NOT NULL;

COMMENT ON COLUMN public.licitacoes.resultado IS 'Resultado: Vencida, Perdida, Desclassificada, Deserto, Fracassado, Revogado, Anulado';
COMMENT ON COLUMN public.licitacoes.vencedor IS 'Se a empresa foi vencedora do processo';
COMMENT ON COLUMN public.licitacoes.arquivado_em IS 'Data de arquivamento. Após 120 dias, será excluído automaticamente';
