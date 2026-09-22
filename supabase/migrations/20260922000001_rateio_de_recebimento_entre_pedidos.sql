-- ═══════════════════════════════════════════════════════════════════════════
-- Rateio de um recebimento entre vários pedidos (22/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Órgão público paga várias notas num TED só: a SEDUC pagou as NFs 725 a
-- 730 da ETHOS com um crédito de R$ 1.819.739,36 em 27/05. O modelo tinha
-- um lançamento apontando para UM pedido (contrato_pedido_id), e o caso
-- N para 1 foi resolvido em 21/09 com a quitação manual dos seis pedidos.
--
-- Aqui nasce o rateio: uma linha por (recebimento, pedido, valor). Regras:
--   · só recebimento (a receber) já baixado e SEM pedido próprio se rateia —
--     um lançamento é de um pedido OU rateado entre vários, nunca os dois;
--   · pedido com título próprio no Financeiro não entra em rateio (os dois
--     caminhos de quitação não se somam);
--   · a soma dos rateios não passa do valor do recebimento, e cada parte não
--     passa do valor do pedido (1 centavo de tolerância);
--   · a quitação do pedido passa a enxergar o rateio: sem título próprio,
--     cobriu o valor → quitado na data do recebimento. Com título próprio a
--     regra de 31/08 continua mandando (todas as parcelas pagas);
--   · "Desfazer quitação" recusa quando a quitação vem de rateio: desfaz-se
--     o rateio (com motivo) e a quitação acompanha sozinha;
--   · trilha: a auditoria genérica do Financeiro grava inserção, alteração
--     e exclusão da tabela; o motivo do desfazer vai para a observação
--     antes de apagar, e fica no log.
-- Quem chama: VincularLancamentoDialog (Gestão de Contratos → Pedidos →
-- Vincular lançamento), botão "Ratear" no recebimento maior que o pedido.

-- ── 1. A tabela ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financeiro_lancamento_rateios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL,
  lancamento_id       uuid NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  contrato_pedido_id  uuid NOT NULL REFERENCES public.contrato_pedidos(id) ON DELETE CASCADE,
  valor               numeric(14,2) NOT NULL CHECK (valor > 0),
  observacao          text,
  criado_por_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_email    text,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lancamento_id, contrato_pedido_id)
);

COMMENT ON TABLE public.financeiro_lancamento_rateios IS
  'Parte de um recebimento (a receber, baixado, sem pedido próprio) destinada a um pedido de contrato. '
  'Um recebimento que paga várias notas tem uma linha por pedido; a soma não passa do valor do recebimento.';

CREATE INDEX IF NOT EXISTS financeiro_lancamento_rateios_pedido_idx ON public.financeiro_lancamento_rateios (contrato_pedido_id);
CREATE INDEX IF NOT EXISTS financeiro_lancamento_rateios_lancamento_idx ON public.financeiro_lancamento_rateios (lancamento_id);
CREATE INDEX IF NOT EXISTS financeiro_lancamento_rateios_empresa_idx ON public.financeiro_lancamento_rateios (empresa_id);

ALTER TABLE public.financeiro_lancamento_rateios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros leem rateios da empresa" ON public.financeiro_lancamento_rateios;
CREATE POLICY "Membros leem rateios da empresa"
  ON public.financeiro_lancamento_rateios FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));
-- Escrita só pelas funções abaixo (SECURITY DEFINER).

-- A auditoria genérica do Financeiro (empresa_id + id + to_jsonb) serve à tabela.
DROP TRIGGER IF EXISTS trg_audit_flr ON public.financeiro_lancamento_rateios;
CREATE TRIGGER trg_audit_flr
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamento_rateios
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_audit_trigger();

-- ── 2. A quitação do pedido enxerga o rateio ────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_quitacao_do_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total          int;
  v_pagos          int;
  v_ultima         date;
  v_rateado        numeric := 0;
  v_ultima_rateio  date;
  v_valor          numeric;
  v_quitado        boolean;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('realizado','conciliado')),
         max(data_competencia) FILTER (WHERE status IN ('realizado','conciliado'))
    INTO v_total, v_pagos, v_ultima
    FROM public.financeiro_lancamentos
   WHERE contrato_pedido_id = p_pedido_id;

  -- A data segue a competência, como no caminho do título (e é a coluna que
  -- o gatilho do lançamento observa).
  SELECT COALESCE(sum(r.valor), 0),
         max(l.data_competencia)
    INTO v_rateado, v_ultima_rateio
    FROM public.financeiro_lancamento_rateios r
    JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id
   WHERE r.contrato_pedido_id = p_pedido_id
     AND l.status IN ('realizado','conciliado');

  SELECT valor_total INTO v_valor FROM public.contrato_pedidos WHERE id = p_pedido_id;

  -- Título próprio manda quando existe: quita quando TODAS as parcelas estão
  -- pagas (regra de 31/08, espelhada em `quitacaoDoPedido` no front). Sem
  -- título próprio, o rateio quita quando cobre o valor do pedido.
  v_quitado := (v_total > 0 AND v_pagos = v_total)
            OR (v_total = 0 AND v_rateado > 0 AND v_rateado + 0.01 >= COALESCE(v_valor, 0));

  UPDATE public.contrato_pedidos
     SET nf_quitada    = v_quitado,
         data_quitacao = CASE WHEN v_quitado
                              THEN (CASE WHEN v_total > 0 THEN v_ultima ELSE v_ultima_rateio END)
                         END
   WHERE id = p_pedido_id;
END;
$$;

-- O lançamento rateado que muda de situação (conciliação desfeita, por
-- exemplo) também recalcula os pedidos que recebem dele.
CREATE OR REPLACE FUNCTION public.tg_quitacao_do_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  -- Os DOIS pedidos: o que a linha deixou e o que ela passou a apontar.
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.contrato_pedido_id IS NOT NULL THEN
    PERFORM public.recalcular_quitacao_do_pedido(OLD.contrato_pedido_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.contrato_pedido_id IS NOT NULL THEN
    PERFORM public.recalcular_quitacao_do_pedido(NEW.contrato_pedido_id);
  END IF;
  -- E os pedidos que recebem esta linha por rateio (22/09).
  IF TG_OP IN ('UPDATE','DELETE') THEN
    FOR r IN SELECT contrato_pedido_id FROM public.financeiro_lancamento_rateios WHERE lancamento_id = OLD.id LOOP
      PERFORM public.recalcular_quitacao_do_pedido(r.contrato_pedido_id);
    END LOOP;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    FOR r IN SELECT contrato_pedido_id FROM public.financeiro_lancamento_rateios WHERE lancamento_id = NEW.id LOOP
      PERFORM public.recalcular_quitacao_do_pedido(r.contrato_pedido_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_rateio_recalcula_quitacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM public.recalcular_quitacao_do_pedido(OLD.contrato_pedido_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM public.recalcular_quitacao_do_pedido(NEW.contrato_pedido_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rateio_recalcula_quitacao ON public.financeiro_lancamento_rateios;
CREATE TRIGGER trg_rateio_recalcula_quitacao
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamento_rateios
  FOR EACH ROW EXECUTE FUNCTION public.tg_rateio_recalcula_quitacao();

-- Um lançamento é de um pedido OU rateado entre vários, nunca os dois. A RPC
-- de ratear recusa lançamento com pedido; este gatilho fecha o outro lado:
-- lançamento já rateado não ganha pedido próprio por nenhum caminho (tela de
-- vincular, `vincular_lancamento_a_pedido`, edição direta).
CREATE OR REPLACE FUNCTION public.tg_lancamento_rateado_nao_vira_de_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.contrato_pedido_id IS NOT NULL
     AND NEW.contrato_pedido_id IS DISTINCT FROM OLD.contrato_pedido_id
     AND EXISTS (SELECT 1 FROM public.financeiro_lancamento_rateios r WHERE r.lancamento_id = NEW.id) THEN
    RAISE EXCEPTION 'Este lançamento está rateado entre pedidos; desfaça o rateio antes de vinculá-lo a um pedido só'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lancamento_rateado_nao_vira_de_pedido ON public.financeiro_lancamentos;
CREATE TRIGGER trg_lancamento_rateado_nao_vira_de_pedido
  BEFORE UPDATE OF contrato_pedido_id ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_lancamento_rateado_nao_vira_de_pedido();

-- ── 3. Ratear ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ratear_lancamento_em_pedidos(
  p_lancamento_id uuid,
  p_rateios       jsonb,
  p_observacao    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_l              public.financeiro_lancamentos%ROWTYPE;
  v_pedido         public.contrato_pedidos%ROWTYPE;
  v_item           jsonb;
  v_pedido_id      uuid;
  v_valor          numeric;
  v_empresa_pedido uuid;
  v_titulos        int;
  v_ja_neste       numeric;
  v_ja_par         numeric;
  v_ja             numeric;
  v_novo           numeric := 0;
  v_n              int := 0;
  v_email          text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  SELECT * INTO v_l FROM public.financeiro_lancamentos WHERE id = p_lancamento_id;
  IF v_l.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;
  IF v_l.empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_l.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para ratear este lançamento';
  END IF;
  IF v_l.tipo <> 'a_receber' THEN
    RAISE EXCEPTION 'Só recebimento (a receber) se rateia entre pedidos';
  END IF;
  IF v_l.status NOT IN ('realizado','conciliado') THEN
    RAISE EXCEPTION 'O recebimento precisa estar baixado (realizado ou conciliado) para ser rateado; está como %', v_l.status;
  END IF;
  IF v_l.contrato_pedido_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este lançamento já pertence a um pedido. Um lançamento é de um pedido OU rateado entre vários, nunca os dois';
  END IF;
  IF p_rateios IS NULL OR jsonb_typeof(p_rateios) <> 'array' OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um pedido e o valor da parte';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT COALESCE(sum(valor), 0) INTO v_ja
    FROM public.financeiro_lancamento_rateios WHERE lancamento_id = p_lancamento_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rateios) LOOP
    v_pedido_id := (v_item->>'pedido_id')::uuid;
    v_valor     := round((v_item->>'valor')::numeric, 2);
    IF v_pedido_id IS NULL OR v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio com pedido ou valor inválido';
    END IF;
    SELECT * INTO v_pedido FROM public.contrato_pedidos WHERE id = v_pedido_id;
    IF v_pedido.id IS NULL THEN
      RAISE EXCEPTION 'Pedido % não encontrado', v_pedido_id;
    END IF;
    SELECT empresa_id INTO v_empresa_pedido FROM public.contratos WHERE id = v_pedido.contrato_id;
    IF v_empresa_pedido IS DISTINCT FROM v_l.empresa_id THEN
      RAISE EXCEPTION 'O pedido % é de outra empresa', v_pedido.numero_pedido;
    END IF;
    SELECT count(*) INTO v_titulos FROM public.financeiro_lancamentos WHERE contrato_pedido_id = v_pedido_id;
    IF v_titulos > 0 THEN
      RAISE EXCEPTION 'O pedido % já tem título próprio no Financeiro; case o título ou apague-o antes de ratear', v_pedido.numero_pedido;
    END IF;
    SELECT COALESCE(sum(valor), 0) INTO v_ja_neste
      FROM public.financeiro_lancamento_rateios
     WHERE contrato_pedido_id = v_pedido_id AND lancamento_id <> p_lancamento_id;
    IF v_ja_neste + v_valor > COALESCE(v_pedido.valor_total, 0) + 0.01 THEN
      RAISE EXCEPTION 'O pedido % vale % e já recebe % por outros rateios: % não cabe',
        v_pedido.numero_pedido, v_pedido.valor_total, v_ja_neste, v_valor;
    END IF;
    -- O par (lançamento, pedido) já rateado é substituído, não somado.
    SELECT valor INTO v_ja_par FROM public.financeiro_lancamento_rateios
     WHERE lancamento_id = p_lancamento_id AND contrato_pedido_id = v_pedido_id;
    v_ja := v_ja - COALESCE(v_ja_par, 0);

    INSERT INTO public.financeiro_lancamento_rateios (
      empresa_id, lancamento_id, contrato_pedido_id, valor, observacao, criado_por_user_id, criado_por_email
    ) VALUES (
      v_l.empresa_id, p_lancamento_id, v_pedido_id, v_valor, NULLIF(btrim(p_observacao), ''), auth.uid(), v_email
    )
    ON CONFLICT (lancamento_id, contrato_pedido_id) DO UPDATE
      SET valor = EXCLUDED.valor,
          observacao = COALESCE(EXCLUDED.observacao, public.financeiro_lancamento_rateios.observacao);
    v_novo := v_novo + v_valor;
    v_n := v_n + 1;
  END LOOP;

  IF v_ja + v_novo > v_l.valor + 0.01 THEN
    RAISE EXCEPTION 'A soma dos rateios (%) passa do valor do recebimento (%)', v_ja + v_novo, v_l.valor;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamento_id', p_lancamento_id,
    'rateios', v_n,
    'rateado_total', v_ja + v_novo,
    'valor_lancamento', v_l.valor,
    'sobra', v_l.valor - (v_ja + v_novo)
  );
END;
$$;

COMMENT ON FUNCTION public.ratear_lancamento_em_pedidos(uuid, jsonb, text) IS
  'Distribui um recebimento baixado e sem pedido próprio entre pedidos: [{pedido_id, valor}]. '
  'Guardas: membro; a receber; baixado; sem pedido próprio; pedido sem título próprio; parte ≤ valor do pedido; soma ≤ valor do recebimento. O gatilho recalcula a quitação.';

-- ── 4. Desfazer um rateio ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desfazer_rateio(p_rateio_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_r public.financeiro_lancamento_rateios%ROWTYPE;
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo para desfazer o rateio (mínimo de 5 caracteres)';
  END IF;
  SELECT * INTO v_r FROM public.financeiro_lancamento_rateios WHERE id = p_rateio_id;
  IF v_r.id IS NULL THEN
    RAISE EXCEPTION 'Rateio não encontrado';
  END IF;
  IF NOT public.is_empresa_member(auth.uid(), v_r.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para desfazer este rateio';
  END IF;
  -- O motivo vai para a observação ANTES de apagar: a auditoria genérica
  -- grava a alteração e a exclusão, e o motivo fica no log.
  UPDATE public.financeiro_lancamento_rateios
     SET observacao = concat_ws(' | ', observacao, 'Desfeito: ' || btrim(p_motivo))
   WHERE id = p_rateio_id;
  DELETE FROM public.financeiro_lancamento_rateios WHERE id = p_rateio_id;
  RETURN jsonb_build_object('ok', true, 'lancamento_id', v_r.lancamento_id, 'pedido_id', v_r.contrato_pedido_id, 'valor', v_r.valor);
END;
$$;

REVOKE ALL ON FUNCTION public.ratear_lancamento_em_pedidos(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.desfazer_rateio(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ratear_lancamento_em_pedidos(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_rateio(uuid, text) TO authenticated;

-- ── 5. "Desfazer quitação" recusa quitação que vem de rateio ────────────────
-- Corpo vivo de 21/09 (pg_get_functiondef) + a guarda nova depois dos títulos pagos.
CREATE OR REPLACE FUNCTION public.desfazer_quitacao_do_pedido(p_pedido_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido        public.contrato_pedidos%ROWTYPE;
  v_empresa_id    uuid;
  v_titulos_pagos int;
  v_rateios       int;
  v_rateado       numeric;
  v_bonus_pagas   int;
  v_apagadas      jsonb;
  v_email         text;
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo para desfazer a quitação (mínimo de 5 caracteres).'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pedido FROM public.contrato_pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.empresa_id INTO v_empresa_id FROM public.contratos c WHERE c.id = v_pedido.contrato_id;
  IF v_empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso a este pedido.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.nf_quitada IS NOT TRUE THEN
    RAISE EXCEPTION 'Este pedido não está quitado.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_titulos_pagos
    FROM public.financeiro_lancamentos
   WHERE contrato_pedido_id = p_pedido_id
     AND status IN ('realizado', 'conciliado');
  IF v_titulos_pagos > 0 THEN
    RAISE EXCEPTION
      'A quitação deste pedido veio de % título(s) pago(s) no Financeiro. Desfaça a conciliação do recebimento lá; o pedido acompanha sozinho.',
      v_titulos_pagos
      USING ERRCODE = '23514';
  END IF;

  -- Quitação por RATEIO de recebimento (22/09): desfaz-se o rateio, com
  -- motivo, no painel do pedido; a quitação acompanha sozinha.
  SELECT count(*), COALESCE(sum(r.valor), 0) INTO v_rateios, v_rateado
    FROM public.financeiro_lancamento_rateios r
    JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id
   WHERE r.contrato_pedido_id = p_pedido_id
     AND l.status IN ('realizado', 'conciliado');
  IF v_rateios > 0 THEN
    RAISE EXCEPTION
      'A quitação deste pedido vem de rateio de recebimento (% rateio(s), R$ %). Desfaça o rateio em Vincular lançamento; o pedido acompanha sozinho.',
      v_rateios, v_rateado
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO v_bonus_pagas
    FROM public.comissoes_lancamentos
   WHERE contrato_pedido_id = p_pedido_id
     AND status = 'pago';
  IF v_bonus_pagas > 0 THEN
    RAISE EXCEPTION
      'Há % bonificação(ões) já paga(s) sobre este pedido. Estorne-a(s) em Comissões antes de desfazer a quitação.',
      v_bonus_pagas
      USING ERRCODE = '23514';
  END IF;

  WITH apagadas AS (
    DELETE FROM public.comissoes_lancamentos
     WHERE contrato_pedido_id = p_pedido_id
       AND status <> 'pago'
    RETURNING id, user_id, status, valor_comissao, valor_base, percentual_comissao, nota_fiscal
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(apagadas)), '[]'::jsonb) INTO v_apagadas FROM apagadas;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.pedidos_quitacoes_desfeitas (
    empresa_id, contrato_id, pedido_id, numero_pedido, nota_fiscal, valor_total,
    data_quitacao_anterior, bonificacoes_apagadas, desfeito_por_user_id, desfeito_por_email, motivo
  ) VALUES (
    v_empresa_id, v_pedido.contrato_id, v_pedido.id, v_pedido.numero_pedido, v_pedido.nota_fiscal, v_pedido.valor_total,
    v_pedido.data_quitacao, v_apagadas, auth.uid(), v_email, btrim(p_motivo)
  );

  UPDATE public.contrato_pedidos
     SET nf_quitada = false,
         data_quitacao = NULL
   WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'pedido_id', p_pedido_id,
    'data_quitacao_anterior', v_pedido.data_quitacao,
    'bonificacoes_apagadas', jsonb_array_length(v_apagadas)
  );
END;
$function$;

-- ── 6. O TED de 27/05 vira rateio formal ────────────────────────────────────
-- Os seis pedidos foram quitados à mão em 21/09; com o rateio registrado, a
-- quitação passa a ter o recebimento como fonte, recalculada pelo gatilho
-- (mesma data, 27/05/2026). Só grava se tudo ainda estiver como a auditoria
-- viu em 22/09: recebimento eac00048 baixado, sem pedido próprio, de
-- R$ 1.819.739,36 (descrição "NFe N° 000.000.725; ...; 000.000.730."); cada
-- pedido com o mesmo valor total, a NF certa e sem título próprio.
INSERT INTO public.financeiro_lancamento_rateios (empresa_id, lancamento_id, contrato_pedido_id, valor, observacao)
SELECT '6fd7ea75-b22b-4947-a4c2-170c07d53e3d'::uuid,
       'eac00048-4b19-41e2-9e32-e40d93a58b37'::uuid,
       v.pedido_id, v.valor,
       'Rateio registrado pela migration 20260922000001: crédito TED da SEDUC de 27/05/2026 (R$ 1.819.739,36) cobriu as NFs 725 a 730.'
  FROM (VALUES
    ('dba5db27-323c-4f09-b19d-b176c3ec3e1b'::uuid, '725',   97090.99),
    ('1314fc78-356f-443f-8751-c1f51ca5110d'::uuid, '726',     684.99),
    ('6ad86c51-65ab-4bdd-a625-2a8b0e102d7a'::uuid, '727',  373015.11),
    ('8c67ae27-1c93-4f92-9563-888c369541f6'::uuid, '728', 1343620.57),
    ('e0a658cb-9227-4d36-a2f4-29966579e173'::uuid, '729',    2537.00),
    ('28c8c01b-bef8-4fc3-a4a5-492f5f1642ac'::uuid, '730',    2790.70)
  ) AS v(pedido_id, nf, valor)
 WHERE EXISTS (
   SELECT 1 FROM public.financeiro_lancamentos l
    WHERE l.id = 'eac00048-4b19-41e2-9e32-e40d93a58b37'::uuid
      AND l.empresa_id = '6fd7ea75-b22b-4947-a4c2-170c07d53e3d'::uuid
      AND l.tipo = 'a_receber'
      AND l.status IN ('realizado','conciliado')
      AND l.contrato_pedido_id IS NULL
      AND abs(l.valor - 1819739.36) < 0.005
 )
   AND EXISTS (
     SELECT 1 FROM public.contrato_pedidos p
      WHERE p.id = v.pedido_id
        AND p.contrato_id = 'ba015cc2-d869-4aea-a44c-fe52e75e9ee7'::uuid
        AND p.nota_fiscal = v.nf
        AND abs(p.valor_total - v.valor) < 0.005
        AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos f WHERE f.contrato_pedido_id = p.id)
   )
ON CONFLICT (lancamento_id, contrato_pedido_id) DO NOTHING;

-- Conferência (a colar depois): seis linhas, soma 1.819.739,36, seis pedidos
-- quitados em 2026-05-27.
-- SELECT count(*), sum(valor) FROM public.financeiro_lancamento_rateios
--  WHERE lancamento_id = 'eac00048-4b19-41e2-9e32-e40d93a58b37';
-- SELECT nota_fiscal, nf_quitada, data_quitacao FROM public.contrato_pedidos
--  WHERE contrato_id = 'ba015cc2-d869-4aea-a44c-fe52e75e9ee7' AND nota_fiscal BETWEEN '725' AND '730' ORDER BY 1;
