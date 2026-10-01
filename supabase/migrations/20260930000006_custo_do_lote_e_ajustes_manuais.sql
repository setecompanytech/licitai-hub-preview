-- ============================================================================
-- Custo do lote numa transação + ajustes manuais do custo por contrato
-- ============================================================================
--
-- 30/09/2026. (1) "Editar lote" ganha o custo da nota inteira: a RPC reparte
-- na proporção do valor de cada parte (a última fecha o centavo) e declara
-- parte a parte pela porta única `declarar_custo_do_pedido` (trilha +
-- cruzamento), em ordem fixa — sem 18 chamadas paralelas. (2) Financeiro ›
-- Custo por contrato passa a somar também despesas DECLARADAS À MÃO
-- (imposto, administrativa, operacional, BDI, outra), sempre nomeadas e com
-- ressalva na tela: o automático (contas a pagar, rateio, imposto estimado)
-- continua sendo a parte comprovada.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

CREATE OR REPLACE FUNCTION public.declarar_custo_do_lote(p_lote_id uuid, p_custo_total numeric, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric := 0;
  v_restante numeric;
  v_n integer := 0;
  v_total integer;
  r record;
  v_fatia numeric;
  v_unit numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_lote_id IS NULL THEN RAISE EXCEPTION 'lote obrigatório'; END IF;
  IF p_custo_total IS NULL OR p_custo_total < 0 THEN RAISE EXCEPTION 'custo inválido'; END IF;

  SELECT coalesce(sum(valor_total), 0), count(*) INTO v_base, v_total
    FROM public.contrato_pedidos WHERE lote_id = p_lote_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'lote não encontrado'; END IF;

  v_restante := round(p_custo_total, 2);
  FOR r IN SELECT id, valor_total, quantidade FROM public.contrato_pedidos WHERE lote_id = p_lote_id ORDER BY id LOOP
    v_n := v_n + 1;
    IF v_n = v_total THEN
      v_fatia := v_restante;
    ELSIF v_base > 0 THEN
      v_fatia := round(round(p_custo_total, 2) * coalesce(r.valor_total, 0) / v_base, 2);
    ELSE
      v_fatia := round(round(p_custo_total, 2) / v_total, 2);
    END IF;
    v_restante := round(v_restante - v_fatia, 2);
    v_unit := CASE WHEN coalesce(r.quantidade, 0) > 0 THEN round(v_fatia / r.quantidade, 4) ELSE 0 END;
    -- A porta única do custo declarado: trilha em contrato_pedidos_custo_log e cruzamento.
    PERFORM public.declarar_custo_do_pedido(r.id, v_unit, p_motivo);
  END LOOP;

  RETURN jsonb_build_object('partes', v_n, 'custo_total', round(p_custo_total, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.declarar_custo_do_lote(uuid, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.declarar_custo_do_lote(uuid, numeric, text) TO authenticated;
COMMENT ON FUNCTION public.declarar_custo_do_lote(uuid, numeric, text) IS
  'Declara o custo de compra de um lote inteiro: reparte pelo valor de cada parte e chama declarar_custo_do_pedido em ordem fixa, numa transação.';

-- ── Ajustes manuais do custo por contrato ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contrato_custos_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('imposto', 'administrativa', 'operacional', 'bdi', 'outra')),
  descricao text NOT NULL,
  valor numeric NOT NULL CHECK (valor >= 0),
  competencia date,
  observacao text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contrato_custos_ajustes IS
  'Despesas do contrato declaradas À MÃO (imposto, administrativa, operacional, BDI, outra). Parcela nomeada e com ressalva no resultado do contrato; nunca substitui o comprovado (contas a pagar) nem o estimado (imposto/rateio).';
CREATE INDEX IF NOT EXISTS idx_contrato_custos_ajustes_contrato ON public.contrato_custos_ajustes (contrato_id);

ALTER TABLE public.contrato_custos_ajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membros leem ajustes de custo da empresa" ON public.contrato_custos_ajustes;
CREATE POLICY "Membros leem ajustes de custo da empresa"
  ON public.contrato_custos_ajustes FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "Financeiro e admin escrevem ajustes de custo" ON public.contrato_custos_ajustes;
CREATE POLICY "Financeiro e admin escrevem ajustes de custo"
  ON public.contrato_custos_ajustes FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_custos_da_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "Financeiro e admin alteram ajustes de custo" ON public.contrato_custos_ajustes;
CREATE POLICY "Financeiro e admin alteram ajustes de custo"
  ON public.contrato_custos_ajustes FOR UPDATE TO authenticated
  USING (public.pode_ver_custos_da_empresa(auth.uid(), empresa_id));
DROP POLICY IF EXISTS "Financeiro e admin apagam ajustes de custo" ON public.contrato_custos_ajustes;
CREATE POLICY "Financeiro e admin apagam ajustes de custo"
  ON public.contrato_custos_ajustes FOR DELETE TO authenticated
  USING (public.pode_ver_custos_da_empresa(auth.uid(), empresa_id));
