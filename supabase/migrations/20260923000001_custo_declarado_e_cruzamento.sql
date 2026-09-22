-- ============================================================================
-- Custo declarado no pedido (a EXCEÇÃO) e o cruzamento com o Financeiro
-- ============================================================================
--
-- Decisão do dono (22/09/2026, estudo "Custo por pedido e conciliação
-- fracionada", Downloads): o Admin ou o Financeiro DECLARA o custo de compra
-- dentro do pedido (custo unitário × quantidade), e o sistema cruza com o que
-- o Financeiro comprova em contas a pagar. É exceção nomeada: o declarado é
-- gerencial, não entra na DRE nem no estoque, e é substituído pelo comprovado
-- à medida que os documentos chegam.
--
-- O que já existia e é reaproveitado:
--   · `contrato_pedidos.custo_unitario` / `custo_total` e o gatilho
--     `calcular_custo_pedido` (06/04/2026) — custo × quantidade já era a
--     regra; nenhuma tela gravava o campo;
--   · `financeiro_lancamento_rateios` + `ratear_lancamento_em_pedidos`
--     (22/09) — a parte de um título destinada a um pedido. Passa a aceitar
--     conta A PAGAR: é por ela, e SÓ por ela, que a compra chega ao pedido.
--
-- Por que a compra NÃO usa `financeiro_lancamentos.contrato_pedido_id`:
-- essa coluna é o título PRÓPRIO da NF de saída. A quitação do pedido
-- (`recalcular_quitacao_do_pedido`) conta todo lançamento com essa coluna
-- como parcela do recebimento, e o gatilho de exclusão apaga o PEDIDO quando
-- o título some. Uma conta a pagar ali viraria "parcela" da venda e, apagada,
-- levaria o pedido junto. Aqui as duas funções ganham o filtro `a_receber`
-- que sempre lhes faltou, e a compra fica no rateio.
--
-- Régua do cruzamento, por pedido (tolerância por empresa, padrão 0,5% ou
-- R$ 50, o maior):
--   sem_custo    declarado = 0 e comprovado = 0
--   declarado    só o Comercial (aguardando nota/conta a pagar)
--   documentado  só o Financeiro (compra sem custo declarado)
--   parcial      comprovado < declarado − tolerância
--   conferido    |comprovado − declarado| ≤ tolerância
--   divergente   comprovado > declarado + tolerância
-- Aviso a quem lançou primeiro (conferido), aos dois (divergente) e ao setor
-- que falta (documentado → Comercial; declarado/parcial vencido o prazo →
-- Financeiro, pela rotina diária). Um aviso por pedido por mudança de
-- situação — nunca repetido.

-- ── 1. Configuração por empresa (princípio 7: política vira configuração) ──
ALTER TABLE public.financeiro_config_custos
  ADD COLUMN IF NOT EXISTS tolerancia_custo_pct numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS tolerancia_custo_valor numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS prazo_cobranca_custo_dias integer NOT NULL DEFAULT 15;

ALTER TABLE public.financeiro_config_custos DROP CONSTRAINT IF EXISTS financeiro_config_custos_tolerancia_pct_check;
ALTER TABLE public.financeiro_config_custos ADD CONSTRAINT financeiro_config_custos_tolerancia_pct_check
  CHECK (tolerancia_custo_pct >= 0 AND tolerancia_custo_pct <= 100);
ALTER TABLE public.financeiro_config_custos DROP CONSTRAINT IF EXISTS financeiro_config_custos_tolerancia_valor_check;
ALTER TABLE public.financeiro_config_custos ADD CONSTRAINT financeiro_config_custos_tolerancia_valor_check
  CHECK (tolerancia_custo_valor >= 0);
ALTER TABLE public.financeiro_config_custos DROP CONSTRAINT IF EXISTS financeiro_config_custos_prazo_check;
ALTER TABLE public.financeiro_config_custos ADD CONSTRAINT financeiro_config_custos_prazo_check
  CHECK (prazo_cobranca_custo_dias BETWEEN 0 AND 365);

COMMENT ON COLUMN public.financeiro_config_custos.tolerancia_custo_pct IS
  'Tolerância do cruzamento custo declarado × comprovado, em percentual 0–100 do declarado (0.5 = 0,5%). Vale o maior entre esta e a de valor.';
COMMENT ON COLUMN public.financeiro_config_custos.tolerancia_custo_valor IS
  'Tolerância do cruzamento em reais. Vale o maior entre esta e a percentual.';
COMMENT ON COLUMN public.financeiro_config_custos.prazo_cobranca_custo_dias IS
  'Dias após a entrega do pedido para cobrar do Financeiro o documento de um custo declarado ainda sem nota ou conta a pagar.';

-- ── 2. O pedido carimba a declaração ────────────────────────────────────────
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS custo_declarado_em timestamptz,
  ADD COLUMN IF NOT EXISTS custo_declarado_por uuid;

COMMENT ON COLUMN public.contrato_pedidos.custo_unitario IS
  'Custo de compra DECLARADO por unidade (Admin/Financeiro). Gerencial: não é prova; o comprovado vem das contas a pagar rateadas ao pedido.';
COMMENT ON COLUMN public.contrato_pedidos.custo_declarado_em IS 'Quando o custo foi declarado — quem lançou primeiro, contra a data do primeiro documento.';

-- ── 3. O resultado do cruzamento, fora da tabela do pedido ─────────────────
-- Tabela ao lado, 1:1, para o cruzamento (disparado por gatilho do
-- Financeiro) não acionar os gatilhos pesados de `contrato_pedidos` (saldo do
-- item, estoque) a cada conta a pagar que muda.
CREATE TABLE IF NOT EXISTS public.contrato_pedidos_custo (
  contrato_pedido_id uuid PRIMARY KEY REFERENCES public.contrato_pedidos(id) ON DELETE CASCADE,
  empresa_id         uuid NOT NULL,
  contrato_id        uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  comprovado_pago    numeric NOT NULL DEFAULT 0,
  comprovado_aberto  numeric NOT NULL DEFAULT 0,
  situacao           text NOT NULL DEFAULT 'sem_custo'
                     CHECK (situacao IN ('sem_custo','declarado','documentado','parcial','conferido','divergente')),
  documento_em       timestamptz,
  cruzado_em         timestamptz,
  cobrado_em         timestamptz
);
COMMENT ON TABLE public.contrato_pedidos_custo IS
  'Resultado do cruzamento custo declarado × comprovado de cada pedido. Escrita só por cruzar_custo_do_pedido. documento_em = primeira vez em que houve compra atribuída (quem lançou primeiro).';
CREATE INDEX IF NOT EXISTS contrato_pedidos_custo_contrato_idx ON public.contrato_pedidos_custo (contrato_id);
CREATE INDEX IF NOT EXISTS contrato_pedidos_custo_situacao_idx ON public.contrato_pedidos_custo (empresa_id, situacao);

ALTER TABLE public.contrato_pedidos_custo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membros leem o cruzamento do custo" ON public.contrato_pedidos_custo;
CREATE POLICY "Membros leem o cruzamento do custo" ON public.contrato_pedidos_custo
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

-- ── 4. Trilha da declaração ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contrato_pedidos_custo_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL,
  contrato_id         uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  contrato_pedido_id  uuid NOT NULL REFERENCES public.contrato_pedidos(id) ON DELETE CASCADE,
  custo_unitario_de   numeric,
  custo_unitario_para numeric,
  custo_total_de      numeric,
  custo_total_para    numeric,
  motivo              text,
  user_id             uuid,
  user_email          text,
  criado_em           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contrato_pedidos_custo_log_pedido_idx ON public.contrato_pedidos_custo_log (contrato_pedido_id);
ALTER TABLE public.contrato_pedidos_custo_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membros leem a trilha do custo" ON public.contrato_pedidos_custo_log;
CREATE POLICY "Membros leem a trilha do custo" ON public.contrato_pedidos_custo_log
  FOR SELECT USING (public.is_empresa_member(auth.uid(), empresa_id));

-- ── 5. Utilidades ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reais(p numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'R$ ' || replace(replace(replace(to_char(COALESCE(p, 0), 'FM999G999G999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;

-- Admin da empresa ou equipe financeiro: a mesma alçada de Custos por Contrato.
CREATE OR REPLACE FUNCTION public.pode_ver_custos_da_empresa(p_user_id uuid, p_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_empresa_admin(p_user_id, p_empresa_id)
      OR EXISTS (
        SELECT 1 FROM public.empresa_membros m
         WHERE m.empresa_id = p_empresa_id AND m.user_id = p_user_id AND m.equipe = 'financeiro'
      );
$$;

-- A régua, pura: mesma conta de `lib/contratos/cobertura-de-custo.ts`.
CREATE OR REPLACE FUNCTION public.situacao_do_custo(
  p_declarado numeric, p_pago numeric, p_aberto numeric, p_tol_pct numeric, p_tol_valor numeric
)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN COALESCE(p_declarado, 0) <= 0 AND (COALESCE(p_pago, 0) + COALESCE(p_aberto, 0)) <= 0 THEN 'sem_custo'
    WHEN COALESCE(p_declarado, 0) <= 0 THEN 'documentado'
    WHEN (COALESCE(p_pago, 0) + COALESCE(p_aberto, 0)) <= 0 THEN 'declarado'
    WHEN abs((COALESCE(p_pago, 0) + COALESCE(p_aberto, 0)) - p_declarado)
         <= GREATEST(p_declarado * COALESCE(p_tol_pct, 0) / 100, COALESCE(p_tol_valor, 0)) THEN 'conferido'
    WHEN (COALESCE(p_pago, 0) + COALESCE(p_aberto, 0)) < p_declarado THEN 'parcial'
    ELSE 'divergente'
  END;
$$;

-- Quanto o Financeiro já comprovou para um pedido: SÓ pelo rateio de contas a
-- pagar. Pago (baixado) separado do aberto (comprometido pela competência).
CREATE OR REPLACE FUNCTION public.custo_comprovado_do_pedido(p_pedido_id uuid)
RETURNS TABLE (pago numeric, aberto numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(r.valor) FILTER (WHERE l.status IN ('realizado','conciliado')), 0),
         COALESCE(SUM(r.valor) FILTER (WHERE l.status NOT IN ('realizado','conciliado')), 0)
    FROM public.financeiro_lancamento_rateios r
    JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id
   WHERE r.contrato_pedido_id = p_pedido_id
     AND l.tipo = 'a_pagar'
     AND l.status <> 'cancelado';
$$;

-- Aviso ao setor: admins da empresa + membros da equipe pedida.
CREATE OR REPLACE FUNCTION public.avisar_setor_da_empresa(
  p_empresa_id uuid, p_setor text, p_titulo text, p_mensagem text, p_link text, p_tipo text DEFAULT 'info'
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link, tipo)
  SELECT DISTINCT m.user_id, p_titulo, p_mensagem, p_link, p_tipo
    FROM public.empresa_membros m
   WHERE m.empresa_id = p_empresa_id
     AND m.user_id IS NOT NULL
     AND (m.papel = 'admin' OR m.equipe = p_setor);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ── 6. O cruzamento ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cruzar_custo_do_pedido(p_pedido_id uuid, p_notificar boolean DEFAULT true)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p          record;
  v_c          record;
  v_tol_pct    numeric;
  v_tol_valor  numeric;
  v_pago       numeric;
  v_aberto     numeric;
  v_declarado  numeric;
  v_sit        text;
  v_sit_ant    text;
  v_doc_em     timestamptz;
  v_primeiro   text;
  v_link       text;
  v_rotulo     text;
  v_comprovado numeric;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN NULL; END IF;

  SELECT p.id, p.numero_pedido, p.contrato_id, p.custo_total, p.custo_declarado_em, p.status
    INTO v_p FROM public.contrato_pedidos p WHERE p.id = p_pedido_id;
  IF v_p.id IS NULL THEN RETURN NULL; END IF;

  SELECT c.empresa_id, c.numero_contrato INTO v_c FROM public.contratos c WHERE c.id = v_p.contrato_id;
  IF v_c.empresa_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(f.tolerancia_custo_pct, 0.5), COALESCE(f.tolerancia_custo_valor, 50)
    INTO v_tol_pct, v_tol_valor
    FROM (SELECT 1) AS um
    LEFT JOIN public.financeiro_config_custos f ON f.empresa_id = v_c.empresa_id;

  SELECT x.pago, x.aberto INTO v_pago, v_aberto FROM public.custo_comprovado_do_pedido(p_pedido_id) x;
  v_comprovado := COALESCE(v_pago, 0) + COALESCE(v_aberto, 0);
  v_declarado  := CASE WHEN v_p.status = 'cancelado' THEN 0 ELSE COALESCE(v_p.custo_total, 0) END;
  v_sit := public.situacao_do_custo(v_declarado, v_pago, v_aberto, v_tol_pct, v_tol_valor);

  SELECT situacao, documento_em INTO v_sit_ant, v_doc_em
    FROM public.contrato_pedidos_custo WHERE contrato_pedido_id = p_pedido_id;
  v_sit_ant := COALESCE(v_sit_ant, 'sem_custo');
  IF v_comprovado > 0 THEN v_doc_em := COALESCE(v_doc_em, now()); ELSE v_doc_em := NULL; END IF;

  INSERT INTO public.contrato_pedidos_custo AS x
    (contrato_pedido_id, empresa_id, contrato_id, comprovado_pago, comprovado_aberto, situacao, documento_em, cruzado_em, cobrado_em)
  VALUES
    (p_pedido_id, v_c.empresa_id, v_p.contrato_id, COALESCE(v_pago, 0), COALESCE(v_aberto, 0), v_sit, v_doc_em, now(), NULL)
  ON CONFLICT (contrato_pedido_id) DO UPDATE
     SET comprovado_pago   = EXCLUDED.comprovado_pago,
         comprovado_aberto = EXCLUDED.comprovado_aberto,
         situacao          = EXCLUDED.situacao,
         documento_em      = EXCLUDED.documento_em,
         cruzado_em        = now(),
         -- A cobrança só vale enquanto o pedido segue esperando documento.
         cobrado_em        = CASE WHEN EXCLUDED.situacao IN ('declarado','parcial') THEN x.cobrado_em ELSE NULL END;

  IF NOT p_notificar OR v_sit = v_sit_ant THEN RETURN v_sit; END IF;

  v_link   := '/gestao-contratos?contrato=' || v_p.contrato_id || '&aba=pedidos';
  v_rotulo := 'Pedido ' || COALESCE(v_p.numero_pedido, '?') || ' do contrato ' || COALESCE(v_c.numero_contrato, '(sem número)');
  v_primeiro := CASE
    WHEN v_p.custo_declarado_em IS NULL THEN 'financeiro'
    WHEN v_doc_em IS NULL THEN 'comercial'
    WHEN v_p.custo_declarado_em <= v_doc_em THEN 'comercial'
    ELSE 'financeiro'
  END;

  IF v_sit = 'documentado' THEN
    PERFORM public.avisar_setor_da_empresa(v_c.empresa_id, 'comercial',
      'Compra atribuída sem custo declarado',
      v_rotulo || ': o Financeiro atribuiu ' || public.reais(v_comprovado)
        || ' em contas a pagar a este pedido e nenhum custo foi declarado nele. Declare o custo de compra em Editar pedido, ou confirme que a compra é de estoque.',
      v_link, 'documento');
  ELSIF v_sit = 'conferido' THEN
    PERFORM public.avisar_setor_da_empresa(v_c.empresa_id, v_primeiro,
      'Custo do pedido conferido',
      v_rotulo || ': custo declarado ' || public.reais(v_declarado) || ' e comprovado ' || public.reais(v_comprovado)
        || ' — dentro da tolerância.',
      v_link, 'info');
  ELSIF v_sit = 'divergente' THEN
    PERFORM public.avisar_setor_da_empresa(v_c.empresa_id, 'comercial',
      'Custo do pedido divergente',
      v_rotulo || ': comprovado ' || public.reais(v_comprovado) || ' contra ' || public.reais(v_declarado)
        || ' declarado (diferença ' || public.reais(v_comprovado - v_declarado) || '). Corrija a declaração ou revise as contas a pagar rateadas ao pedido.',
      v_link, 'alerta');
    PERFORM public.avisar_setor_da_empresa(v_c.empresa_id, 'financeiro',
      'Custo do pedido divergente',
      v_rotulo || ': comprovado ' || public.reais(v_comprovado) || ' contra ' || public.reais(v_declarado)
        || ' declarado (diferença ' || public.reais(v_comprovado - v_declarado) || '). Corrija a declaração ou revise as contas a pagar rateadas ao pedido.',
      v_link, 'alerta');
  END IF;
  -- 'declarado' e 'parcial' esperam o prazo: é a rotina diária que cobra.
  RETURN v_sit;
END;
$$;

COMMENT ON FUNCTION public.cruzar_custo_do_pedido(uuid, boolean) IS
  'Recalcula o comprovado (rateios de contas a pagar) de um pedido, grava a situação em contrato_pedidos_custo e avisa uma vez por mudança de situação: documentado → Comercial; conferido → quem lançou primeiro; divergente → os dois.';

-- ── 7. Declarar o custo (a única porta de escrita) ─────────────────────────
CREATE OR REPLACE FUNCTION public.declarar_custo_do_pedido(p_pedido_id uuid, p_custo_unitario numeric, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p        public.contrato_pedidos%ROWTYPE;
  v_empresa  uuid;
  v_email    text;
  v_total    numeric;
  v_sit      text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_custo_unitario IS NULL OR p_custo_unitario < 0 THEN
    RAISE EXCEPTION 'Custo unitário inválido';
  END IF;
  SELECT * INTO v_p FROM public.contrato_pedidos WHERE id = p_pedido_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  SELECT empresa_id INTO v_empresa FROM public.contratos WHERE id = v_p.contrato_id;
  IF v_empresa IS NULL OR NOT public.pode_ver_custos_da_empresa(auth.uid(), v_empresa) THEN
    RAISE EXCEPTION 'Só o admin da empresa e a equipe financeiro declaram custo de pedido';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Não trancado pela quitação: o custo é da compra, não da venda.
  UPDATE public.contrato_pedidos
     SET custo_unitario      = round(p_custo_unitario, 4),
         custo_declarado_em  = CASE WHEN p_custo_unitario > 0 THEN now() ELSE NULL END,
         custo_declarado_por = CASE WHEN p_custo_unitario > 0 THEN auth.uid() ELSE NULL END
   WHERE id = p_pedido_id
   RETURNING custo_total INTO v_total;

  INSERT INTO public.contrato_pedidos_custo_log
    (empresa_id, contrato_id, contrato_pedido_id, custo_unitario_de, custo_unitario_para, custo_total_de, custo_total_para, motivo, user_id, user_email)
  VALUES
    (v_empresa, v_p.contrato_id, p_pedido_id, v_p.custo_unitario, round(p_custo_unitario, 4), v_p.custo_total, v_total, NULLIF(btrim(p_motivo), ''), auth.uid(), v_email);

  v_sit := public.cruzar_custo_do_pedido(p_pedido_id, true);
  RETURN jsonb_build_object('ok', true, 'custo_unitario', round(p_custo_unitario, 4), 'custo_total', v_total, 'situacao', v_sit);
END;
$$;

COMMENT ON FUNCTION public.declarar_custo_do_pedido(uuid, numeric, text) IS
  'Declara o custo de compra por unidade de um pedido (Admin/Financeiro), com trilha, e dispara o cruzamento. Zero limpa a declaração.';

-- ── 8. Rateio de conta A PAGAR entre pedidos (o caminho da compra) ─────────
-- Corpo de 22/09 + a distinção por tipo: a receber mantém todas as guardas
-- (baixado, sem pedido próprio, pedido sem título próprio, parte ≤ pedido);
-- a pagar entra baixada OU em aberto (comprometido já é custo pela
-- competência) e sem teto por pedido — comprar mais caro que o declarado é
-- exatamente o que o cruzamento chama de divergente.
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
  v_compra         boolean;
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
  IF v_l.tipo NOT IN ('a_receber', 'a_pagar') THEN
    RAISE EXCEPTION 'Só recebimento (a receber) ou compra (a pagar) se rateia entre pedidos';
  END IF;
  v_compra := (v_l.tipo = 'a_pagar');
  IF v_compra AND NOT public.pode_ver_custos_da_empresa(auth.uid(), v_l.empresa_id) THEN
    RAISE EXCEPTION 'Só o admin da empresa e a equipe financeiro atribuem compra a pedido';
  END IF;
  IF v_l.status = 'cancelado' THEN
    RAISE EXCEPTION 'Lançamento cancelado não se rateia';
  END IF;
  IF NOT v_compra AND v_l.status NOT IN ('realizado','conciliado') THEN
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
    -- A compra pode ir a um pedido que já tem o título da NF de saída: são
    -- dinheiros diferentes. Só o recebimento disputa com o título próprio.
    IF NOT v_compra THEN
      SELECT count(*) INTO v_titulos FROM public.financeiro_lancamentos
       WHERE contrato_pedido_id = v_pedido_id AND tipo = 'a_receber';
      IF v_titulos > 0 THEN
        RAISE EXCEPTION 'O pedido % já tem título próprio no Financeiro; case o título ou apague-o antes de ratear', v_pedido.numero_pedido;
      END IF;
      SELECT COALESCE(sum(r.valor), 0) INTO v_ja_neste
        FROM public.financeiro_lancamento_rateios r
        JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id
       WHERE r.contrato_pedido_id = v_pedido_id AND r.lancamento_id <> p_lancamento_id AND l.tipo = 'a_receber';
      IF v_ja_neste + v_valor > COALESCE(v_pedido.valor_total, 0) + 0.01 THEN
        RAISE EXCEPTION 'O pedido % vale % e já recebe % por outros rateios: % não cabe',
          v_pedido.numero_pedido, v_pedido.valor_total, v_ja_neste, v_valor;
      END IF;
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

    -- A compra atribuída a um pedido carrega o contrato junto: a carteira de
    -- custos soma por `contrato_id`, e uma compra rateada sem contrato ficaria
    -- fora dela.
    IF v_compra AND v_l.contrato_id IS NULL THEN
      UPDATE public.financeiro_lancamentos SET contrato_id = v_pedido.contrato_id WHERE id = p_lancamento_id;
      v_l.contrato_id := v_pedido.contrato_id;
    END IF;
  END LOOP;

  IF v_ja + v_novo > v_l.valor + 0.01 THEN
    RAISE EXCEPTION 'A soma dos rateios (%) passa do valor do lançamento (%)', v_ja + v_novo, v_l.valor;
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
  'Distribui um lançamento entre pedidos: [{pedido_id, valor}]. A receber: baixado, sem pedido próprio, pedido sem título próprio, parte ≤ valor do pedido. '
  'A pagar (compra): admin/financeiro, baixada ou em aberto, sem teto por pedido; ganha o contrato do pedido. Soma ≤ valor do lançamento nos dois casos.';

-- ── 9. Quitação e limpeza só enxergam RECEBIMENTO ──────────────────────────
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
   WHERE contrato_pedido_id = p_pedido_id
     AND tipo = 'a_receber';

  SELECT COALESCE(sum(r.valor), 0),
         max(l.data_competencia)
    INTO v_rateado, v_ultima_rateio
    FROM public.financeiro_lancamento_rateios r
    JOIN public.financeiro_lancamentos l ON l.id = r.lancamento_id
   WHERE r.contrato_pedido_id = p_pedido_id
     AND l.tipo = 'a_receber'
     AND l.status IN ('realizado','conciliado');

  SELECT valor_total INTO v_valor FROM public.contrato_pedidos WHERE id = p_pedido_id;

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

COMMENT ON FUNCTION public.recalcular_quitacao_do_pedido(uuid) IS
  'Quitação da NF do pedido: só RECEBIMENTO (a receber) — título próprio manda (todas as parcelas pagas); sem título, rateio pago que cobre o valor quita. Compra rateada ao pedido não é parcela da venda.';

CREATE OR REPLACE FUNCTION public.cleanup_contrato_pedido_on_lancamento_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só o título da NF de saída carrega o pedido consigo. Conta a pagar nunca
  -- aponta pedido por esta coluna (vai pelo rateio), mas a guarda fica.
  IF OLD.contrato_pedido_id IS NOT NULL AND OLD.tipo IS DISTINCT FROM 'a_pagar' THEN
    DELETE FROM public.contrato_pedidos WHERE id = OLD.contrato_pedido_id;
  END IF;
  RETURN OLD;
END;
$$;

-- ── 10. Gatilhos que disparam o cruzamento ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_rateio_cruza_custo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN PERFORM public.cruzar_custo_do_pedido(OLD.contrato_pedido_id); END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN PERFORM public.cruzar_custo_do_pedido(NEW.contrato_pedido_id); END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_rateio_cruza_custo ON public.financeiro_lancamento_rateios;
CREATE TRIGGER trg_rateio_cruza_custo
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamento_rateios
  FOR EACH ROW EXECUTE FUNCTION public.tg_rateio_cruza_custo();

-- A conta a pagar mudou de valor ou de status (pagou, cancelou): os pedidos
-- que recebem parte dela recruzam. Na exclusão, o CASCADE dos rateios já
-- dispara o gatilho de cima.
CREATE OR REPLACE FUNCTION public.tg_lancamento_cruza_custo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.tipo = 'a_pagar' OR OLD.tipo = 'a_pagar' THEN
    FOR r IN SELECT contrato_pedido_id FROM public.financeiro_lancamento_rateios WHERE lancamento_id = NEW.id LOOP
      PERFORM public.cruzar_custo_do_pedido(r.contrato_pedido_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_lancamento_cruza_custo ON public.financeiro_lancamentos;
CREATE TRIGGER trg_lancamento_cruza_custo
  AFTER UPDATE OF status, valor, tipo ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_lancamento_cruza_custo();

-- O pedido mudou de quantidade ou de status (o custo_total acompanha): recruza.
CREATE OR REPLACE FUNCTION public.tg_pedido_cruza_custo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.custo_total IS DISTINCT FROM OLD.custo_total OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.cruzar_custo_do_pedido(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_pedido_cruza_custo ON public.contrato_pedidos;
CREATE TRIGGER trg_pedido_cruza_custo
  AFTER UPDATE OF custo_total, quantidade, status ON public.contrato_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_cruza_custo();

-- ── 11. A cobertura do contrato (o que o Resumo e a DRE mostram) ───────────
CREATE OR REPLACE FUNCTION public.cobertura_de_custo_do_contrato(p_contrato_id uuid)
RETURNS TABLE (
  declarado               numeric,
  comprovado_pago         numeric,
  comprovado_aberto       numeric,
  do_contrato_pago        numeric,
  do_contrato_aberto      numeric,
  a_distribuir            numeric,
  a_distribuir_n          integer,
  declarado_sem_documento numeric,
  cobertura_pct           numeric,
  pedidos_total           integer,
  pedidos_sem_custo       integer,
  pedidos_declarado       integer,
  pedidos_documentado     integer,
  pedidos_parcial         integer,
  pedidos_conferido       integer,
  pedidos_divergente      integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.contratos WHERE id = p_contrato_id;
  IF v_empresa IS NULL OR NOT public.pode_ver_custos_da_empresa(auth.uid(), v_empresa) THEN
    RAISE EXCEPTION 'Acesso restrito: o custo do contrato é do admin da empresa e da equipe financeiro.';
  END IF;

  RETURN QUERY
  WITH ped AS (
    SELECT p.id, p.custo_total, p.status, COALESCE(x.situacao, 'sem_custo') AS situacao,
           COALESCE(x.comprovado_pago, 0) AS pago, COALESCE(x.comprovado_aberto, 0) AS aberto
      FROM public.contrato_pedidos p
      LEFT JOIN public.contrato_pedidos_custo x ON x.contrato_pedido_id = p.id
     WHERE p.contrato_id = p_contrato_id AND p.status <> 'cancelado'
  ), fin AS (
    SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.status IN ('realizado','conciliado')), 0) AS pago,
           COALESCE(SUM(l.valor) FILTER (WHERE l.status NOT IN ('realizado','conciliado')), 0) AS aberto
      FROM public.financeiro_lancamentos l
     WHERE l.contrato_id = p_contrato_id AND l.tipo = 'a_pagar' AND l.status <> 'cancelado'
  ), livres AS (
    SELECT COALESCE(SUM(l.valor - COALESCE(r.rateado, 0)), 0) AS valor,
           count(*)::int AS n
      FROM public.financeiro_lancamentos l
      LEFT JOIN (SELECT lancamento_id, SUM(valor) AS rateado FROM public.financeiro_lancamento_rateios GROUP BY 1) r
        ON r.lancamento_id = l.id
     WHERE l.contrato_id = p_contrato_id AND l.tipo = 'a_pagar' AND l.status <> 'cancelado'
       AND l.valor - COALESCE(r.rateado, 0) > 0.01
  )
  SELECT COALESCE(SUM(ped.custo_total), 0),
         COALESCE(SUM(ped.pago), 0),
         COALESCE(SUM(ped.aberto), 0),
         fin.pago,
         fin.aberto,
         livres.valor,
         livres.n,
         GREATEST(0, COALESCE(SUM(ped.custo_total), 0) - (fin.pago + fin.aberto)),
         CASE WHEN COALESCE(SUM(ped.custo_total), 0) > 0
              THEN LEAST(100, round((fin.pago + fin.aberto) / SUM(ped.custo_total) * 100, 1))
              ELSE NULL END,
         count(ped.id)::int,
         count(*) FILTER (WHERE ped.situacao = 'sem_custo')::int,
         count(*) FILTER (WHERE ped.situacao = 'declarado')::int,
         count(*) FILTER (WHERE ped.situacao = 'documentado')::int,
         count(*) FILTER (WHERE ped.situacao = 'parcial')::int,
         count(*) FILTER (WHERE ped.situacao = 'conferido')::int,
         count(*) FILTER (WHERE ped.situacao = 'divergente')::int
    FROM ped, fin, livres
   GROUP BY fin.pago, fin.aberto, livres.valor, livres.n;
END;
$$;

COMMENT ON FUNCTION public.cobertura_de_custo_do_contrato(uuid) IS
  'Cobertura de custo do contrato: declarado nos pedidos × comprovado (rateado aos pedidos) × contas a pagar do contrato; a distribuir = parte das contas a pagar do contrato ainda sem pedido; declarado_sem_documento = o que o declarado excede as contas a pagar do contrato (entra no custo total como parcela nomeada).';

-- ── 12. As funções de custo ganham o declarado sem documento ───────────────
-- Mudar as colunas de retorno exige DROP: CREATE OR REPLACE não troca o tipo.
DROP FUNCTION IF EXISTS public.contrato_custo_realizado(uuid);
CREATE FUNCTION public.contrato_custo_realizado(p_contrato_id uuid)
RETURNS TABLE (
  custo_pago                numeric,
  custo_comprometido        numeric,
  custo_digitado            numeric,
  custo_total               numeric,
  lancamentos               integer,
  custo_declarado_sem_documento numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH do_financeiro AS (
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE status IN ('realizado','conciliado')), 0) AS pago,
      COALESCE(SUM(valor) FILTER (WHERE status NOT IN ('realizado','conciliado','cancelado')), 0) AS comprometido,
      count(*)::int AS n
      FROM public.financeiro_lancamentos
     WHERE contrato_id = p_contrato_id
       AND tipo = 'a_pagar'
       AND status <> 'cancelado'
  ),
  digitado AS (
    SELECT COALESCE(SUM(c.valor), 0) AS total
      FROM public.contrato_custos c
      LEFT JOIN public.financeiro_lancamentos l ON l.id = c.lancamento_id
     WHERE c.contrato_id = p_contrato_id
       AND (l.id IS NULL OR l.contrato_id IS DISTINCT FROM p_contrato_id)
  ),
  declarado AS (
    SELECT COALESCE(SUM(p.custo_total), 0) AS total
      FROM public.contrato_pedidos p
     WHERE p.contrato_id = p_contrato_id AND p.status <> 'cancelado'
  )
  SELECT f.pago,
         f.comprometido,
         d.total,
         f.pago + f.comprometido + d.total + GREATEST(0, dec.total - (f.pago + f.comprometido)),
         f.n,
         GREATEST(0, dec.total - (f.pago + f.comprometido))
    FROM do_financeiro f CROSS JOIN digitado d CROSS JOIN declarado dec;
$$;
COMMENT ON FUNCTION public.contrato_custo_realizado(uuid) IS
  'O que o contrato custou: despesas do Financeiro atribuídas a ele (pago × comprometido), custos digitados sem dupla contagem e o custo DECLARADO nos pedidos que as contas a pagar ainda não cobrem — parcela nomeada, nunca somada em silêncio.';
GRANT EXECUTE ON FUNCTION public.contrato_custo_realizado(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.contratos_custos_carteira(uuid, boolean);
CREATE FUNCTION public.contratos_custos_carteira(
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
  lancamentos integer,
  custo_declarado_sem_documento numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_ver_custos_da_empresa(auth.uid(), p_empresa_id) THEN
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
         COALESCE(f.n, 0),
         GREATEST(0, COALESCE(dec.total, 0) - (COALESCE(f.pago, 0) + COALESCE(f.comprometido, 0)))
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
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.custo_total), 0) AS total
        FROM public.contrato_pedidos p
       WHERE p.contrato_id = c.id AND p.status <> 'cancelado'
    ) dec ON true
   WHERE c.empresa_id = p_empresa_id
     AND c.excluido_em IS NULL
     AND (p_incluir_encerrados OR c.data_fim IS NULL OR c.data_fim >= CURRENT_DATE)
   ORDER BY 6 DESC, c.data_fim NULLS LAST, c.numero_contrato;
END;
$$;
COMMENT ON FUNCTION public.contratos_custos_carteira(uuid, boolean) IS
  'Carteira de custos: uma linha por contrato com custo pago, comprometido, digitado e o declarado nos pedidos ainda sem documento. Acesso: admin da empresa e equipe financeiro.';
GRANT EXECUTE ON FUNCTION public.contratos_custos_carteira(uuid, boolean) TO authenticated;

-- ── 13. A cobrança diária do documento ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cobrar_custos_declarados_sem_documento()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r     record;
  v_n   integer := 0;
BEGIN
  FOR r IN
    SELECT x.contrato_pedido_id, x.empresa_id, x.situacao, p.numero_pedido, p.contrato_id, p.custo_total,
           x.comprovado_pago + x.comprovado_aberto AS comprovado, c.numero_contrato
      FROM public.contrato_pedidos_custo x
      JOIN public.contrato_pedidos p ON p.id = x.contrato_pedido_id
      JOIN public.contratos c ON c.id = p.contrato_id
      LEFT JOIN public.financeiro_config_custos f ON f.empresa_id = x.empresa_id
     WHERE x.situacao IN ('declarado','parcial')
       AND x.cobrado_em IS NULL
       AND p.status <> 'cancelado'
       AND COALESCE(p.data_entrega, p.data_pedido, p.created_at::date)
           + make_interval(days => COALESCE(f.prazo_cobranca_custo_dias, 15)) <= CURRENT_DATE
  LOOP
    PERFORM public.avisar_setor_da_empresa(r.empresa_id, 'financeiro',
      CASE WHEN r.situacao = 'declarado' THEN 'Custo declarado sem documento' ELSE 'Custo declarado coberto só em parte' END,
      'Pedido ' || COALESCE(r.numero_pedido, '?') || ' do contrato ' || COALESCE(r.numero_contrato, '(sem número)')
        || ': custo declarado ' || public.reais(r.custo_total)
        || CASE WHEN r.situacao = 'declarado'
                THEN '. Nenhuma nota de entrada ou conta a pagar foi atribuída a este pedido.'
                ELSE ', comprovado ' || public.reais(r.comprovado) || '. Faltam ' || public.reais(r.custo_total - r.comprovado) || ' de nota ou conta a pagar.' END,
      '/gestao-contratos?contrato=' || r.contrato_id || '&aba=pedidos', 'documento');
    UPDATE public.contrato_pedidos_custo SET cobrado_em = now() WHERE contrato_pedido_id = r.contrato_pedido_id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
COMMENT ON FUNCTION public.cobrar_custos_declarados_sem_documento() IS
  'Rotina diária: pedidos com custo declarado e sem documento (ou coberto em parte) além do prazo da empresa recebem UMA cobrança ao Financeiro; cobrado_em impede repetição até a situação mudar.';

-- Job diário às 08:10 de Brasília (11:10 UTC). Comportamento de produto, não
-- rotina temporária (princípio 5): vive enquanto houver custo declarado; a
-- condição de parada de cada pedido é o próprio documento chegar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'custo-declarado-cobranca') THEN
      PERFORM cron.unschedule('custo-declarado-cobranca');
    END IF;
    PERFORM cron.schedule('custo-declarado-cobranca', '10 11 * * *', 'SELECT public.cobrar_custos_declarados_sem_documento();');
  ELSE
    RAISE NOTICE 'pg_cron ausente: a cobrança diária do custo declarado não foi agendada.';
  END IF;
END $$;

-- ── 14. Permissões ─────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.declarar_custo_do_pedido(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cobertura_de_custo_do_contrato(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cruzar_custo_do_pedido(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cobrar_custos_declarados_sem_documento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.avisar_setor_da_empresa(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.declarar_custo_do_pedido(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cobertura_de_custo_do_contrato(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.custo_comprovado_do_pedido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.situacao_do_custo(numeric, numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reais(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_custos_da_empresa(uuid, uuid) TO authenticated;

-- ── 15. Backfill silencioso: pedidos que já têm custo ou compra rateada ────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.contrato_pedidos p WHERE COALESCE(p.custo_total, 0) > 0
    UNION
    SELECT r2.contrato_pedido_id FROM public.financeiro_lancamento_rateios r2
      JOIN public.financeiro_lancamentos l ON l.id = r2.lancamento_id AND l.tipo = 'a_pagar'
  LOOP
    PERFORM public.cruzar_custo_do_pedido(r.id, false);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Nada de compra pela coluna do recebimento (deve dar zero):
--    SELECT count(*) FROM public.financeiro_lancamentos WHERE tipo = 'a_pagar' AND contrato_pedido_id IS NOT NULL;
--
-- 2. A régua, com os números do estudo (0,5% / R$ 50):
--    SELECT public.situacao_do_custo(1200000, 1200000, 0, 0.5, 50),   -- conferido
--           public.situacao_do_custo(1200000, 0, 0, 0.5, 50),         -- declarado
--           public.situacao_do_custo(0, 262500, 0, 0.5, 50),          -- documentado
--           public.situacao_do_custo(1200000, 600000, 0, 0.5, 50),    -- parcial
--           public.situacao_do_custo(1200000, 1300000, 0, 0.5, 50);   -- divergente
--
-- 3. A cobertura do 068/2025 (id ba015cc2-d869-4aea-a44c-fe52e75e9ee7), logado como admin:
--    SELECT * FROM public.cobertura_de_custo_do_contrato('ba015cc2-d869-4aea-a44c-fe52e75e9ee7');
--    Esperado hoje: declarado 0, do_contrato_pago 4.699.166,98, a_distribuir_n 19, pedidos_sem_custo 10.
--
-- 4. O job: SELECT jobname, schedule FROM cron.job WHERE jobname = 'custo-declarado-cobranca';
