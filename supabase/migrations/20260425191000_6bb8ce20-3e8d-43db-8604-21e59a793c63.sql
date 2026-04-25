-- Sprint C — Orçamento Empresarial (Budget vs Actual)
CREATE TABLE IF NOT EXISTS public.financeiro_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ano smallint NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  conta_id uuid NOT NULL REFERENCES public.financeiro_plano_contas(id) ON DELETE CASCADE,
  valor_orcado numeric(14,2) NOT NULL DEFAULT 0,
  metodo_projecao text NOT NULL DEFAULT 'manual'
    CHECK (metodo_projecao IN ('manual','media_movel_3m','media_movel_12m','inflacao_ipca','crescimento_perc')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, ano, mes, conta_id)
);

CREATE INDEX IF NOT EXISTS idx_fin_metas_empresa_ano ON public.financeiro_metas(empresa_id, ano);
CREATE INDEX IF NOT EXISTS idx_fin_metas_conta ON public.financeiro_metas(conta_id);

ALTER TABLE public.financeiro_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros empresa podem ver metas"
  ON public.financeiro_metas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Membros empresa podem criar metas"
  ON public.financeiro_metas FOR INSERT
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id) AND user_id = auth.uid());

CREATE POLICY "Membros empresa podem atualizar metas"
  ON public.financeiro_metas FOR UPDATE
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Membros empresa podem excluir metas"
  ON public.financeiro_metas FOR DELETE
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE TRIGGER trg_fin_metas_updated_at
  BEFORE UPDATE ON public.financeiro_metas
  FOR EACH ROW EXECUTE FUNCTION public.fin_updated_at();

CREATE TRIGGER trg_fin_metas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_metas
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trigger();

-- Função utilitária: realizado por conta + mês (lançamentos com status='realizado')
CREATE OR REPLACE FUNCTION public.financeiro_realizado_mensal(
  p_empresa_id uuid,
  p_ano smallint
)
RETURNS TABLE(conta_id uuid, mes smallint, valor_realizado numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.categoria_id AS conta_id,
    EXTRACT(MONTH FROM l.data_competencia)::smallint AS mes,
    SUM(l.valor)::numeric AS valor_realizado
  FROM public.financeiro_lancamentos l
  WHERE l.empresa_id = p_empresa_id
    AND l.status IN ('realizado','conciliado')
    AND EXTRACT(YEAR FROM l.data_competencia) = p_ano
    AND l.categoria_id IS NOT NULL
  GROUP BY l.categoria_id, EXTRACT(MONTH FROM l.data_competencia);
$$;