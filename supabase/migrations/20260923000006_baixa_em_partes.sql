-- ============================================================================
-- Baixa em partes: dividir um título para conciliar com pagamentos fracionados
-- ============================================================================
--
-- Decisão do dono (22/09/2026, estudo "Custo por pedido e conciliação
-- fracionada", decisão 5): o empenho de R$ 10.000 que a administração paga
-- em dois PIX de R$ 5.000 no mesmo dia. O motor de conciliação exige valor
-- igual (± R$ 0,02) e a baixa manual marcava o título inteiro como conciliado
-- na primeira parte — os outros R$ 5.000 ficavam órfãos ou viravam título
-- novo.
--
-- A resolução reaproveita o que existe: PARCELAS. "Baixar em parte" = dividir
-- o título — a parte com o valor do movimento, o restante como parcela em
-- aberto, as duas apontando o original por `parcela_pai_id` (coluna que
-- existia sem uso). O movimento concilia a parte exata pela regra de hoje; a
-- quitação do pedido, que já exige todas as parcelas pagas, quita no segundo
-- pagamento e não antes. Nenhum status novo, nenhum painel reaprendendo.

CREATE OR REPLACE FUNCTION public.dividir_lancamento(
  p_lancamento_id uuid,
  p_valor_parte   numeric,
  p_motivo        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_l         public.financeiro_lancamentos%ROWTYPE;
  v_restante  numeric;
  v_novo_id   uuid;
  v_parte     numeric;
  v_n         int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  SELECT * INTO v_l FROM public.financeiro_lancamentos WHERE id = p_lancamento_id;
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;
  IF v_l.empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_l.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para dividir este lançamento';
  END IF;
  IF v_l.status IN ('realizado', 'conciliado', 'cancelado') THEN
    RAISE EXCEPTION 'Só título em aberto se divide; este está como %', v_l.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.financeiro_lancamento_rateios r WHERE r.lancamento_id = p_lancamento_id) THEN
    RAISE EXCEPTION 'Este lançamento está rateado entre pedidos; desfaça o rateio antes de dividi-lo';
  END IF;
  v_parte := round(COALESCE(p_valor_parte, 0), 2);
  IF v_parte <= 0 OR v_parte >= round(v_l.valor, 2) - 0.005 THEN
    RAISE EXCEPTION 'A parte precisa ser maior que zero e menor que o valor do título (%)', v_l.valor;
  END IF;
  v_restante := round(v_l.valor - v_parte, 2);

  -- O original vira a parte (é ele que o movimento vai conciliar); o
  -- restante nasce ao lado, com tudo que identifica o título: documento,
  -- contrato, pedido, categoria, conta, pessoa, competência, vencimento.
  UPDATE public.financeiro_lancamentos
     SET valor = v_parte,
         observacoes = concat_ws(' | ', observacoes,
           'Dividido em ' || to_char(now(), 'DD/MM/YYYY') || ': parte ' || public.reais(v_parte) || ' + restante ' || public.reais(v_restante)
           || CASE WHEN NULLIF(btrim(p_motivo), '') IS NOT NULL THEN ' — ' || btrim(p_motivo) ELSE '' END)
   WHERE id = p_lancamento_id;

  INSERT INTO public.financeiro_lancamentos (
    empresa_id, tipo, natureza, status, descricao, valor,
    data_competencia, data_vencimento, data_emissao,
    categoria_id, centro_custo_id, conta_id, pessoa_id, projeto_id, edital_id,
    contrato_id, contrato_item_id, contrato_pedido_id, documento_fiscal_id,
    tipo_documento, numero_documento, serie_documento, chave_acesso_nfe,
    parcela_pai_id, parcela_numero, parcela_total,
    vendedor_responsavel_id, observacoes, origem, created_by
  )
  SELECT
    l.empresa_id, l.tipo, l.natureza, l.status, l.descricao || ' (restante)', v_restante,
    l.data_competencia, l.data_vencimento, l.data_emissao,
    l.categoria_id, l.centro_custo_id, l.conta_id, l.pessoa_id, l.projeto_id, l.edital_id,
    l.contrato_id, l.contrato_item_id, l.contrato_pedido_id, l.documento_fiscal_id,
    l.tipo_documento, l.numero_documento, l.serie_documento, l.chave_acesso_nfe,
    COALESCE(l.parcela_pai_id, l.id), NULL, NULL,
    l.vendedor_responsavel_id,
    'Restante de ' || public.reais(v_l.valor) || ' dividido em ' || to_char(now(), 'DD/MM/YYYY') || ' (parte de ' || public.reais(v_parte) || ' ficou no título original).',
    l.origem, auth.uid()
    FROM public.financeiro_lancamentos l
   WHERE l.id = p_lancamento_id
  RETURNING id INTO v_novo_id;

  -- As duas partes apontam o original.
  UPDATE public.financeiro_lancamentos
     SET parcela_pai_id = COALESCE(parcela_pai_id, id)
   WHERE id = p_lancamento_id;

  SELECT count(*) INTO v_n FROM public.financeiro_lancamentos
   WHERE parcela_pai_id = COALESCE(v_l.parcela_pai_id, p_lancamento_id);

  RETURN jsonb_build_object(
    'ok', true,
    'parte_id', p_lancamento_id,
    'restante_id', v_novo_id,
    'parte', v_parte,
    'restante', v_restante,
    'partes', v_n
  );
END;
$$;

COMMENT ON FUNCTION public.dividir_lancamento(uuid, numeric, text) IS
  'Baixa em partes: o título em aberto vira a parte (valor dado) e o restante nasce ao lado como parcela, os dois com parcela_pai_id no original. '
  'Guardas: membro; título em aberto; sem rateio; 0 < parte < valor. A quitação do pedido segue exigindo todas as parcelas pagas.';

REVOKE ALL ON FUNCTION public.dividir_lancamento(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dividir_lancamento(uuid, numeric, text) TO authenticated;

-- ── Nota × título nos dois sentidos (decisão 5, lado do documento) ──────────
-- N notas → 1 pagamento já cabe em `financeiro_documentos_fiscais.lancamento_id`
-- (sem unicidade); 1 nota → N pagamentos usa `financeiro_lancamentos.
-- documento_fiscal_id`, que existia sem uso. O índice abaixo é o que a régua
-- e as telas consultam para saber quanto de um pagamento já tem nota.
CREATE INDEX IF NOT EXISTS financeiro_documentos_fiscais_lancamento_idx
  ON public.financeiro_documentos_fiscais (lancamento_id);
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_documento_fiscal_idx
  ON public.financeiro_lancamentos (documento_fiscal_id)
  WHERE documento_fiscal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_parcela_pai_idx
  ON public.financeiro_lancamentos (parcela_pai_id)
  WHERE parcela_pai_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Depois de dividir um título de teste em ambiente isolado:
--   SELECT id, valor, status, parcela_pai_id, descricao FROM public.financeiro_lancamentos
--    WHERE parcela_pai_id = '<id do original>' ORDER BY created_at;
-- Esperado: duas linhas (parte + restante), soma = valor original.
