-- ============================================================================
-- Rateio de indiretas só com despesa OPERACIONAL; ICMS efetivo configurável
-- ============================================================================
--
-- Auditoria de custos do contrato 068/2025 (22/09/2026), decisões 12 e 13 do
-- dono ("prossiga com as recomendações").
--
-- 12. A base do rateio (`despesas_indiretas_da_empresa`) somava toda conta a
--     pagar sem contrato que não fosse movimentação. Na ETHOS isso punha na
--     margem dos contratos R$ 810 mil de CAPEX (Investimentos, Veículos,
--     Computadores — grupo_dre 'movimentacao', mas natureza 'despesa'), R$ 485
--     mil de despesa financeira e R$ 427 mil de compra de mercadoria sem
--     vínculo: R$ 2,31 mi de base contra ≈ R$ 583 mil legítimos. Despesa
--     indireta rateável é a OPERACIONAL (grupo_dre 'desp_operacional'):
--     aluguel, energia, folha, pró-labore. CAPEX é ativo (CPC 27), despesa
--     financeira é resultado financeiro, CMV sem vínculo é custo direto que
--     falta atribuir. Categoria sem grupo continua entrando quando é de
--     natureza despesa (classificação que falta, não dinheiro que sobra), e
--     lançamento sem categoria também — os dois aparecem nomeados no detalhe.
--
-- 13. O imposto estimado do contrato aplicava o ICMS nominal (18%) cheio sobre
--     a receita, sem crédito das entradas nem benefício fiscal. A alíquota
--     EFETIVA passa a ser configuração da empresa (Apuração); nula = usa a
--     nominal, e a tela declara a premissa.

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
     AND (
       c.id IS NULL
       OR c.grupo_dre = 'desp_operacional'
       OR (c.grupo_dre IS NULL AND COALESCE(c.natureza, 'despesa') = 'despesa')
     )
     AND COALESCE(l.data_competencia, l.data_vencimento) >= (CURRENT_DATE - make_interval(months => GREATEST(p_meses, 1)))::date;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.despesas_indiretas_da_empresa(uuid, integer) IS
  'Base do rateio do painel Custos por Contrato: contas a pagar SEM vínculo de contrato na janela, só de categoria OPERACIONAL (grupo_dre desp_operacional), mais categoria sem grupo de natureza despesa e lançamento sem categoria. CAPEX, despesa financeira, CMV e movimentação ficam fora.';

-- ── ICMS efetivo ────────────────────────────────────────────────────────────
ALTER TABLE public.financeiro_config_tributaria
  ADD COLUMN IF NOT EXISTS aliquota_icms_efetiva numeric;
ALTER TABLE public.financeiro_config_tributaria DROP CONSTRAINT IF EXISTS financeiro_config_tributaria_icms_efetiva_check;
ALTER TABLE public.financeiro_config_tributaria ADD CONSTRAINT financeiro_config_tributaria_icms_efetiva_check
  CHECK (aliquota_icms_efetiva IS NULL OR (aliquota_icms_efetiva >= 0 AND aliquota_icms_efetiva <= 100));
COMMENT ON COLUMN public.financeiro_config_tributaria.aliquota_icms_efetiva IS
  'ICMS efetivo sobre a receita (percentual 0–100), já descontados crédito das entradas e benefício fiscal. Nulo = a estimativa usa a alíquota nominal e declara a premissa.';

NOTIFY pgrst, 'reload schema';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- A base nova da ETHOS (logado como admin), contra os R$ 2.309.980,73 de 22/09:
--   SELECT public.despesas_indiretas_da_empresa('6fd7ea75-b22b-4947-a4c2-170c07d53e3d', 12);
-- Esperado: perto de R$ 583 mil (varia com o que foi lançado depois).
-- O que ficou de fora, por grupo:
--   SELECT c.grupo_dre, c.natureza, count(*), sum(l.valor)
--     FROM public.financeiro_lancamentos l LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
--    WHERE l.empresa_id = '6fd7ea75-b22b-4947-a4c2-170c07d53e3d' AND l.tipo = 'a_pagar' AND l.status <> 'cancelado'
--      AND l.contrato_id IS NULL AND COALESCE(l.data_competencia, l.data_vencimento) >= CURRENT_DATE - interval '12 months'
--    GROUP BY 1, 2 ORDER BY 4 DESC;
