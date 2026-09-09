-- ============================================================================
-- Base do rateio exclui movimentação — mesma regra dos relatórios de títulos
-- ============================================================================
--
-- `despesas_indiretas_da_empresa` somava TODO a_pagar sem vínculo de contrato.
-- Na ETHOS isso deu R$ 16,8 mi, dos quais R$ 9,86 mi eram MOVIMENTAÇÃO:
-- transferências entre contas próprias, aplicações financeiras, distribuição
-- de lucro, empréstimos recebidos — permuta de caixa e ato societário, não
-- despesa (CPC 47 / NBC TG 03). O rateio inflado empurrava margem de contrato
-- para -108% (09/09). A base passa a considerar só lançamentos cuja categoria
-- NÃO é de natureza 'movimentacao' (sem categoria continua entrando: despesa
-- não classificada é despesa até prova em contrário, e some da base quando
-- ganha vínculo ou categoria correta).

CREATE OR REPLACE FUNCTION public.despesas_indiretas_da_empresa(
  p_empresa_id uuid,
  p_meses integer DEFAULT 12
)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  IF NOT (
    public.is_empresa_admin(auth.uid(), p_empresa_id)
    OR EXISTS (
      SELECT 1 FROM public.empresa_membros m
       WHERE m.empresa_id = p_empresa_id
         AND m.user_id = auth.uid()
         AND m.equipe = 'financeiro'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso restrito: Custos por Contrato é do admin da empresa e da equipe financeiro.';
  END IF;

  SELECT COALESCE(SUM(l.valor), 0) INTO v_total
    FROM public.financeiro_lancamentos l
    LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo = 'a_pagar'
     AND l.status <> 'cancelado'
     AND l.contrato_id IS NULL
     AND (c.id IS NULL OR c.natureza <> 'movimentacao')
     AND COALESCE(l.data_competencia, l.data_vencimento) >= (CURRENT_DATE - make_interval(months => GREATEST(p_meses, 1)))::date;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.despesas_indiretas_da_empresa(uuid, integer) IS
  'Base do rateio do painel Custos por Contrato: despesas a pagar SEM vínculo '
  'de contrato na janela de meses dada, por competência (vencimento como '
  'fallback), EXCLUÍDA a movimentação (transferências entre contas próprias, '
  'aplicações, distribuição de lucro, empréstimos) — permuta de caixa não é '
  'despesa.';

NOTIFY pgrst, 'reload schema';
