-- ============================================================================
-- Financeiro › Custos por Contrato: a carteira inteira, não um contrato por vez
-- ============================================================================
--
-- `contrato_custo_realizado` responde por UM contrato; para saber quanto os
-- contratos vigentes custam, era preciso abrir um a um. A carteira devolve
-- uma linha por contrato com a MESMA lógica anti-dupla-contagem: despesa do
-- Financeiro vinculada ao contrato (pago × comprometido separados — o
-- comprometido já é custo pelo regime de competência, mas não saiu do caixa)
-- + custo digitado cuja origem não seja um lançamento já atribuído.
--
-- Acesso: admin da empresa ou membro da equipe financeiro. Negado é ERRO
-- declarado, não resultado vazio — falha silenciosa é proibida (princípio 3).
--
-- Rateio de despesas indiretas (aluguel, energia, folha…): política de
-- cliente, não regra de produto (princípio 7) — nasce como configuração por
-- empresa, DESLIGADA por padrão. Quem não configurou vê só custo direto +
-- digitado; nenhum critério inventado entra sozinho na margem de ninguém.

-- 1) Configuração por empresa do rateio -------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_config_custos (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ratear_indiretas boolean NOT NULL DEFAULT false,
  criterio_rateio text NOT NULL DEFAULT 'faturamento',
  rateio_meses integer NOT NULL DEFAULT 12 CHECK (rateio_meses BETWEEN 1 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_config_custos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem config de custos" ON public.financeiro_config_custos;
CREATE POLICY "membros leem config de custos" ON public.financeiro_config_custos
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin ou financeiro criam config de custos" ON public.financeiro_config_custos;
CREATE POLICY "admin ou financeiro criam config de custos" ON public.financeiro_config_custos
  FOR INSERT WITH CHECK (
    public.is_empresa_admin(auth.uid(), empresa_id)
    OR EXISTS (
      SELECT 1 FROM public.empresa_membros m
       WHERE m.empresa_id = financeiro_config_custos.empresa_id
         AND m.user_id = auth.uid() AND m.equipe = 'financeiro'
    )
  );

DROP POLICY IF EXISTS "admin ou financeiro alteram config de custos" ON public.financeiro_config_custos;
CREATE POLICY "admin ou financeiro alteram config de custos" ON public.financeiro_config_custos
  FOR UPDATE USING (
    public.is_empresa_admin(auth.uid(), empresa_id)
    OR EXISTS (
      SELECT 1 FROM public.empresa_membros m
       WHERE m.empresa_id = financeiro_config_custos.empresa_id
         AND m.user_id = auth.uid() AND m.equipe = 'financeiro'
    )
  );

DROP POLICY IF EXISTS "admin apaga config de custos" ON public.financeiro_config_custos;
CREATE POLICY "admin apaga config de custos" ON public.financeiro_config_custos
  FOR DELETE USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- 2) A carteira -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contratos_custos_carteira(
  p_empresa_id uuid,
  p_incluir_encerrados boolean DEFAULT false
)
RETURNS TABLE (
  contrato_id uuid,
  numero_contrato text,
  orgao_contratante text,
  tipo_documento text,
  data_fim date,
  vigente boolean,
  valor_global numeric,
  faturamento numeric,
  custo_pago numeric,
  custo_comprometido numeric,
  custo_digitado numeric,
  lancamentos integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT c.id,
         c.numero_contrato,
         c.orgao_contratante,
         c.tipo_documento,
         c.data_fim,
         (c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE) AS eh_vigente,
         COALESCE(c.valor_global, 0),
         COALESCE(c.valor_consumido, 0),
         COALESCE(f.pago, 0),
         COALESCE(f.comprometido, 0),
         COALESCE(d.total, 0),
         COALESCE(f.n, 0)
    FROM public.contratos c
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.status IN ('realizado','conciliado')), 0) AS pago,
             COALESCE(SUM(l.valor) FILTER (WHERE l.status NOT IN ('realizado','conciliado','cancelado')), 0) AS comprometido,
             count(*)::int AS n
        FROM public.financeiro_lancamentos l
       WHERE l.contrato_id = c.id
         AND l.tipo = 'a_pagar'
         AND l.status <> 'cancelado'
    ) f ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(cc.valor), 0) AS total
        FROM public.contrato_custos cc
        LEFT JOIN public.financeiro_lancamentos l2 ON l2.id = cc.lancamento_id
       WHERE cc.contrato_id = c.id
         AND (l2.id IS NULL OR l2.contrato_id IS DISTINCT FROM c.id)
    ) d ON true
   WHERE c.empresa_id = p_empresa_id
     AND c.excluido_em IS NULL
     AND (p_incluir_encerrados OR c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
   ORDER BY 6 DESC, c.data_fim NULLS LAST, c.numero_contrato;
END;
$$;

COMMENT ON FUNCTION public.contratos_custos_carteira(uuid, boolean) IS
  'Carteira de custos: uma linha por contrato da empresa com custo pago, '
  'comprometido e digitado (mesma lógica anti-dupla-contagem de '
  'contrato_custo_realizado) e faturamento. Vigente = data_fim ausente ou '
  'futura. Acesso restrito a admin da empresa e equipe financeiro — negado '
  'gera exceção declarada, não resultado vazio.';

GRANT EXECUTE ON FUNCTION public.contratos_custos_carteira(uuid, boolean) TO authenticated;

-- 3) Base do rateio: despesas sem contrato ----------------------------------
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
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo = 'a_pagar'
     AND l.status <> 'cancelado'
     AND l.contrato_id IS NULL
     AND COALESCE(l.data_competencia, l.data_vencimento) >= (CURRENT_DATE - make_interval(months => GREATEST(p_meses, 1)))::date;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.despesas_indiretas_da_empresa(uuid, integer) IS
  'Soma das despesas a pagar SEM vínculo de contrato (aluguel, energia, '
  'folha…) na janela de meses dada, por competência (vencimento como '
  'fallback). É a base do rateio opcional do painel Custos por Contrato.';

GRANT EXECUTE ON FUNCTION public.despesas_indiretas_da_empresa(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
