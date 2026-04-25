-- =====================================================
-- SPRINT B — SALDOS DE ABERTURA (BALANÇO INICIAL)
-- Base normativa: ITG 2000, NBC TG 1000
-- =====================================================

CREATE TABLE IF NOT EXISTS public.financeiro_saldos_iniciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL REFERENCES public.financeiro_plano_contas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid REFERENCES public.financeiro_contas(id) ON DELETE SET NULL,
  data_corte date NOT NULL,
  saldo_devedor numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_devedor >= 0),
  saldo_credor numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_credor >= 0),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE(empresa_id, conta_id, data_corte),
  CONSTRAINT chk_fsi_um_saldo CHECK (
    (saldo_devedor > 0 AND saldo_credor = 0)
    OR (saldo_credor > 0 AND saldo_devedor = 0)
    OR (saldo_devedor = 0 AND saldo_credor = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_fsi_empresa_data ON public.financeiro_saldos_iniciais(empresa_id, data_corte);
CREATE INDEX IF NOT EXISTS idx_fsi_conta ON public.financeiro_saldos_iniciais(conta_id);

ALTER TABLE public.financeiro_saldos_iniciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsi_select_member" ON public.financeiro_saldos_iniciais
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fsi_insert_member" ON public.financeiro_saldos_iniciais
  FOR INSERT WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fsi_update_member" ON public.financeiro_saldos_iniciais
  FOR UPDATE USING (public.is_empresa_member(auth.uid(), empresa_id));
CREATE POLICY "fsi_delete_admin" ON public.financeiro_saldos_iniciais
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

CREATE TRIGGER trg_fsi_updated_at
  BEFORE UPDATE ON public.financeiro_saldos_iniciais
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

CREATE TRIGGER trg_fsi_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_saldos_iniciais
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trigger();

-- Função: valida partida dobrada do balancete de abertura
CREATE OR REPLACE FUNCTION public.financeiro_validar_balancete_abertura(
  p_empresa_id uuid,
  p_data_corte date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_d numeric(14,2);
  v_total_c numeric(14,2);
  v_diff numeric(14,2);
  v_qtd int;
BEGIN
  IF NOT public.is_empresa_member(auth.uid(), p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(saldo_devedor), 0),
    COALESCE(SUM(saldo_credor), 0),
    COUNT(*)
  INTO v_total_d, v_total_c, v_qtd
  FROM public.financeiro_saldos_iniciais
  WHERE empresa_id = p_empresa_id AND data_corte = p_data_corte;

  v_diff := v_total_d - v_total_c;

  RETURN jsonb_build_object(
    'data_corte', p_data_corte,
    'qtd_contas', v_qtd,
    'total_devedor', v_total_d,
    'total_credor', v_total_c,
    'diferenca', v_diff,
    'em_equilibrio', (v_diff = 0)
  );
END;
$$;

-- =====================================================
-- SPRINT D — TIPOS DE DOCUMENTO FISCAIS
-- Base normativa: Manual NF-e v7.0 + FEBRABAN
-- =====================================================

DO $$ BEGIN
  CREATE TYPE public.financeiro_tipo_documento AS ENUM (
    'nfe_55','nfce_65','nfse','nfa_e','recibo','rpa',
    'boleto','duplicata_mercantil','duplicata_servico',
    'pix','ted','doc','cheque','cartao_credito','cartao_debito',
    'dinheiro','transferencia_interna','outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS tipo_documento public.financeiro_tipo_documento,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS serie_documento text,
  ADD COLUMN IF NOT EXISTS chave_acesso_nfe char(44),
  ADD COLUMN IF NOT EXISTS data_emissao date;

ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS chk_fl_chave_nfe_44;
ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT chk_fl_chave_nfe_44
  CHECK (chave_acesso_nfe IS NULL OR (chave_acesso_nfe ~ '^[0-9]{44}$'));

CREATE INDEX IF NOT EXISTS idx_fl_chave_nfe ON public.financeiro_lancamentos(chave_acesso_nfe) WHERE chave_acesso_nfe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fl_doc ON public.financeiro_lancamentos(empresa_id, tipo_documento, numero_documento);