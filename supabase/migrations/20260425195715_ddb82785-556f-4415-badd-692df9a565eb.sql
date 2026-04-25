-- 1. Tabela de notas importadas (NF-e mod 55 + NFS-e)
CREATE TABLE IF NOT EXISTS public.financeiro_notas_importadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfe','nfse')),
  direcao text NOT NULL CHECK (direcao IN ('entrada','saida')),
  chave_acesso text,
  numero text,
  serie text,
  data_emissao date NOT NULL,
  competencia date NOT NULL,
  cnpj_emitente text,
  nome_emitente text,
  cnpj_destinatario text,
  nome_destinatario text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  valor_servicos numeric(14,2) DEFAULT 0,
  valor_produtos numeric(14,2) DEFAULT 0,
  iss_retido numeric(14,2) DEFAULT 0,
  tipo_servico text CHECK (tipo_servico IN ('comercio','servico','outro')),
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  xml_original text,
  status text NOT NULL DEFAULT 'processada' CHECK (status IN ('processada','duplicada','erro','ignorada')),
  erro_mensagem text,
  importado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave_acesso)
);

CREATE INDEX IF NOT EXISTS idx_fni_empresa_competencia ON public.financeiro_notas_importadas(empresa_id, competencia);
CREATE INDEX IF NOT EXISTS idx_fni_lancamento ON public.financeiro_notas_importadas(lancamento_id);

ALTER TABLE public.financeiro_notas_importadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fni_sel_member" ON public.financeiro_notas_importadas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fni_ins_member" ON public.financeiro_notas_importadas FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fni_upd_member" ON public.financeiro_notas_importadas FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fni_del_admin" ON public.financeiro_notas_importadas FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER fni_updated_at BEFORE UPDATE ON public.financeiro_notas_importadas
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

-- 2. Coluna desatualizada nas apurações
ALTER TABLE public.financeiro_apuracoes
  ADD COLUMN IF NOT EXISTS apuracao_desatualizada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS desatualizada_motivo text,
  ADD COLUMN IF NOT EXISTS desatualizada_em timestamptz;

-- 3. Trigger: marca apuração como desatualizada quando lançamento mexe na competência
CREATE OR REPLACE FUNCTION public.fin_marcar_apuracao_desatualizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_data date;
  v_comp date;
BEGIN
  v_emp  := COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_data := COALESCE(NEW.data_competencia, OLD.data_competencia);
  IF v_emp IS NULL OR v_data IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_comp := date_trunc('month', v_data)::date;

  UPDATE public.financeiro_apuracoes
     SET apuracao_desatualizada = true,
         desatualizada_motivo = 'Novos lançamentos importados após apuração',
         desatualizada_em = now()
   WHERE empresa_id = v_emp
     AND competencia = v_comp
     AND status <> 'pago';

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_apuracao_desatualizada ON public.financeiro_lancamentos;
CREATE TRIGGER trg_marcar_apuracao_desatualizada
AFTER INSERT OR UPDATE OF valor, data_competencia, status, natureza, categoria_id OR DELETE
ON public.financeiro_lancamentos
FOR EACH ROW EXECUTE FUNCTION public.fin_marcar_apuracao_desatualizada();