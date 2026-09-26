-- ============================================================================
-- Itens do termo aditivo: o que cada termo muda em cada item, com vigência
-- ============================================================================
--
-- O caso (26/09/2026): contrato 772/2024 (Barcarena, cesta básica, um lote com
-- 18 itens). Quatro termos: o 1º TA reequilibra 12 itens (art. 124, II, "d");
-- o 2º e o 3º renovam por 12 meses (art. 107) com as quantidades repostas aos
-- preços reequilibrados — R$ 578.929,32 = 416.693,13 + 162.236,19, conferido
-- item a item; o 4º reequilibra 4 itens, dois deles já reequilibrados no 1º.
-- O registro do aditivo só tinha valor e quantidade do contrato inteiro e uma
-- calculadora com UM par "custo atual × novo custo": doze itens não cabem num
-- par. As camadas de item por termo (`contrato_itens.origem_aditivo_id`)
-- existiam e nenhum contrato as usava; o histórico de preço tinha uma linha.
--
-- O modelo que fica:
--   · UMA linha física por item em contrato_itens; `valor_unitario` é o preço
--     VIGENTE e `valor_unitario_original` guarda o da contratação;
--   · `contrato_aditivo_itens` diz o que cada termo fez em cada item: preço
--     anterior → novo, quantidade acrescida ou suprimida, e de onde o número
--     veio (leitura do anexo ou digitação), com o valor LIDO preservado mesmo
--     depois de corrigido à mão;
--   · aplicar o termo (RPC) regrava o preço vigente — o gatilho de histórico
--     escreve a trilha, e o motivo recebe o número do termo — e o saldo do
--     item passa a somar as quantidades exatas das linhas;
--   · reverter (RPC, e o DELETE do termo) devolve o preço anterior, e recusa
--     quando um termo posterior já mexeu nos mesmos itens;
--   · o termo ganha data de efeitos (vigência dos novos preços), período
--     (renovação, art. 107) e fundamento legal.
--
-- MEDIDO ANTES DE MEXER (26/09, só leitura): 27 itens em contrato_itens, ZERO
-- com |saldo_financeiro − saldo_quantitativo × valor_unitario| > 1. A fórmula
-- exata "saldo × preço vigente" — a que a aba Itens já usa e que a conferência
-- da 20260923000003 já assumia — não muda número nenhum hoje.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk. Idempotente.

-- ── 1) Colunas novas ────────────────────────────────────────────────────────
ALTER TABLE public.contrato_aditivos
  ADD COLUMN IF NOT EXISTS data_efeitos date,
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date,
  ADD COLUMN IF NOT EXISTS fundamento_legal text,
  ADD COLUMN IF NOT EXISTS itens_aplicados_em timestamptz;

COMMENT ON COLUMN public.contrato_aditivos.data_efeitos IS
  'Dia em que os novos preços/quantidades passam a valer. Padrão: a assinatura. Antecipação além de 1 mês exige formalização (Lei 14.133/2021, art. 132) e é registrada com ressalva.';
COMMENT ON COLUMN public.contrato_aditivos.periodo_inicio IS 'Renovação (art. 107): primeiro dia do novo período.';
COMMENT ON COLUMN public.contrato_aditivos.periodo_fim IS 'Renovação (art. 107): último dia do novo período (= nova_data_fim).';
COMMENT ON COLUMN public.contrato_aditivos.fundamento_legal IS 'Artigo da Lei 14.133/2021 (ou norma correlata) que ampara o termo, pelo tipo escolhido.';
COMMENT ON COLUMN public.contrato_aditivos.itens_aplicados_em IS 'Quando as linhas de contrato_aditivo_itens foram aplicadas aos itens; nulo = nada aplicado.';

ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS valor_unitario_original numeric;
COMMENT ON COLUMN public.contrato_itens.valor_unitario_original IS
  'Preço da contratação, guardado na primeira vez que um termo muda valor_unitario (que é o preço VIGENTE).';

-- ── 2) As linhas do termo por item ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contrato_aditivo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  aditivo_id uuid NOT NULL REFERENCES public.contrato_aditivos(id) ON DELETE CASCADE,
  contrato_item_id uuid NOT NULL REFERENCES public.contrato_itens(id) ON DELETE CASCADE,
  user_id uuid,
  -- Como o documento escreveu a linha (evidência da leitura)
  numero_item_lido text,
  descricao_lida text,
  unidade_lida text,
  valor_lido numeric,
  quantidade_lida numeric,
  -- O que o termo faz no item
  valor_unitario_anterior numeric,
  valor_unitario_novo numeric CHECK (valor_unitario_novo IS NULL OR valor_unitario_novo > 0),
  quantidade_acrescimo numeric NOT NULL DEFAULT 0 CHECK (quantidade_acrescimo >= 0),
  quantidade_supressao numeric NOT NULL DEFAULT 0 CHECK (quantidade_supressao >= 0),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('leitura', 'manual')),
  editado boolean NOT NULL DEFAULT false,
  observacao text,
  aplicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrato_aditivo_itens_algo_muda
    CHECK (valor_unitario_novo IS NOT NULL OR quantidade_acrescimo > 0 OR quantidade_supressao > 0),
  CONSTRAINT contrato_aditivo_itens_um_por_item UNIQUE (aditivo_id, contrato_item_id)
);
COMMENT ON TABLE public.contrato_aditivo_itens IS
  'O que cada termo aditivo muda em cada item do contrato: preço anterior → novo (reequilíbrio, reajuste, repactuação), quantidade acrescida/suprimida (alteração quantitativa, renovação). origem diz se veio da leitura do anexo ou da digitação; valor_lido/quantidade_lida guardam o que foi lido mesmo depois de corrigido.';

CREATE INDEX IF NOT EXISTS contrato_aditivo_itens_contrato_idx ON public.contrato_aditivo_itens (contrato_id);
CREATE INDEX IF NOT EXISTS contrato_aditivo_itens_item_idx ON public.contrato_aditivo_itens (contrato_item_id);
CREATE INDEX IF NOT EXISTS contrato_aditivo_itens_aditivo_idx ON public.contrato_aditivo_itens (aditivo_id);

ALTER TABLE public.contrato_aditivo_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros gerenciam itens dos termos da empresa" ON public.contrato_aditivo_itens;
CREATE POLICY "Membros gerenciam itens dos termos da empresa"
  ON public.contrato_aditivo_itens FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contratos c
     WHERE c.id = contrato_aditivo_itens.contrato_id
       AND (public.is_empresa_member(auth.uid(), c.empresa_id)
            OR (c.empresa_id IS NULL AND auth.uid() = c.user_id))))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contratos c
     WHERE c.id = contrato_aditivo_itens.contrato_id
       AND (public.is_empresa_member(auth.uid(), c.empresa_id)
            OR (c.empresa_id IS NULL AND auth.uid() = c.user_id))));

-- A empresa e o autor vêm do contrato e da sessão: quem grava não os informa.
CREATE OR REPLACE FUNCTION public.preencher_linha_do_termo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato_do_aditivo uuid;
  v_contrato_do_item uuid;
BEGIN
  SELECT contrato_id INTO v_contrato_do_aditivo FROM public.contrato_aditivos WHERE id = NEW.aditivo_id;
  SELECT contrato_id INTO v_contrato_do_item FROM public.contrato_itens WHERE id = NEW.contrato_item_id;
  IF v_contrato_do_aditivo IS NULL THEN
    RAISE EXCEPTION 'Termo aditivo % não existe', NEW.aditivo_id;
  END IF;
  IF v_contrato_do_aditivo <> NEW.contrato_id OR v_contrato_do_item IS DISTINCT FROM NEW.contrato_id THEN
    RAISE EXCEPTION 'Termo, item e contrato não batem: a linha do termo só pode apontar itens do próprio contrato';
  END IF;
  NEW.empresa_id := (SELECT empresa_id FROM public.contratos WHERE id = NEW.contrato_id);
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_preencher_linha_do_termo ON public.contrato_aditivo_itens;
CREATE TRIGGER trg_preencher_linha_do_termo
BEFORE INSERT OR UPDATE ON public.contrato_aditivo_itens
FOR EACH ROW EXECUTE FUNCTION public.preencher_linha_do_termo();

-- ── 3) Saldo do item: exato por linha; rateio só para termo sem linhas ──────
--
-- Antes: quantidade e valor de TODO termo eram repartidos entre os itens na
-- proporção da quantidade contratada — uma aproximação que serve ao termo
-- registrado só no total. Termo com linhas aplicadas entra pelo número exato
-- de cada item e sai do rateio. E saldo financeiro = saldo × preço vigente:
-- o consumido já foi pago ao preço da sua época e vive nos pedidos.
CREATE OR REPLACE FUNCTION public.recalcular_saldos_itens_do_contrato(p_contrato_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acresc_qtd NUMERIC;
  v_supr_qtd   NUMERIC;
  v_qtd_total  NUMERIC;
BEGIN
  -- Só os termos SEM linhas aplicadas rateiam quantidade pela proporção.
  SELECT
    COALESCE(SUM(quantidade_acrescimo) FILTER (WHERE itens_aplicados_em IS NULL), 0),
    COALESCE(SUM(quantidade_supressao) FILTER (WHERE itens_aplicados_em IS NULL), 0)
  INTO v_acresc_qtd, v_supr_qtd
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id;

  SELECT COALESCE(SUM(quantidade_contratada), 0)
  INTO v_qtd_total
  FROM public.contrato_itens
  WHERE contrato_id = p_contrato_id;

  IF v_qtd_total <= 0 THEN RETURN; END IF;

  UPDATE public.contrato_itens AS ci
  SET
    quantidade_consumida = COALESCE((
      SELECT SUM(p.quantidade) FROM public.contrato_pedidos p
       WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
    ), 0),
    saldo_quantitativo =
      ci.quantidade_contratada
      + COALESCE((
          SELECT SUM(l.quantidade_acrescimo - l.quantidade_supressao)
            FROM public.contrato_aditivo_itens l
           WHERE l.contrato_item_id = ci.id AND l.aplicado_em IS NOT NULL
        ), 0)
      + (v_acresc_qtd - v_supr_qtd) * (ci.quantidade_contratada / v_qtd_total)
      - COALESCE((
          SELECT SUM(p.quantidade) FROM public.contrato_pedidos p
           WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
        ), 0),
    updated_at = now()
  WHERE ci.contrato_id = p_contrato_id;

  UPDATE public.contrato_itens AS ci
  SET saldo_financeiro = ROUND(COALESCE(ci.saldo_quantitativo, 0) * COALESCE(ci.valor_unitario, 0), 2)
  WHERE ci.contrato_id = p_contrato_id;
END $$;

COMMENT ON FUNCTION public.recalcular_saldos_itens_do_contrato(uuid) IS
  'Saldo de quantidade = contratada + linhas exatas dos termos aplicados + rateio proporcional dos termos sem linhas − pedidos; saldo financeiro = saldo × preço vigente (26/09/2026).';

-- ── 4) Quem pode mexer no contrato ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contrato_e_de_quem_chama(p_contrato_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contratos c
     WHERE c.id = p_contrato_id
       AND (public.is_empresa_member(auth.uid(), c.empresa_id)
            OR (c.empresa_id IS NULL AND c.user_id = auth.uid()))
  );
$$;
REVOKE ALL ON FUNCTION public.contrato_e_de_quem_chama(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contrato_e_de_quem_chama(uuid) TO authenticated;

-- ── 5) Aplicar: o preço vigente muda, a trilha ganha o motivo ───────────────
CREATE OR REPLACE FUNCTION public.aplicar_itens_do_aditivo_interno(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato uuid;
  v_numero text;
  v_tipo text;
  v_motivo text;
  v_linha record;
  v_atual numeric;
  v_aplicadas int := 0;
BEGIN
  SELECT contrato_id, numero_aditivo, tipo INTO v_contrato, v_numero, v_tipo
    FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL THEN
    RAISE EXCEPTION 'Termo aditivo % não existe', p_aditivo_id;
  END IF;
  v_motivo := 'Termo ' || COALESCE(v_numero, '') || ' (' || COALESCE(v_tipo, '') || ')';

  FOR v_linha IN
    SELECT * FROM public.contrato_aditivo_itens
     WHERE aditivo_id = p_aditivo_id AND aplicado_em IS NULL
     ORDER BY created_at
  LOOP
    SELECT valor_unitario INTO v_atual
      FROM public.contrato_itens
     WHERE id = v_linha.contrato_item_id AND contrato_id = v_contrato
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % não pertence ao contrato do termo', v_linha.contrato_item_id;
    END IF;

    IF v_linha.valor_unitario_novo IS NOT NULL THEN
      UPDATE public.contrato_aditivo_itens
         SET valor_unitario_anterior = COALESCE(valor_unitario_anterior, v_atual)
       WHERE id = v_linha.id;
      UPDATE public.contrato_itens
         SET valor_unitario_original = COALESCE(valor_unitario_original, valor_unitario),
             valor_unitario = v_linha.valor_unitario_novo,
             updated_at = now()
       WHERE id = v_linha.contrato_item_id;
      -- O gatilho trg_historico_preco_item acabou de gravar a trilha sem
      -- motivo; o termo assina.
      UPDATE public.contrato_item_precos_historico h
         SET motivo = v_motivo,
             observacao = COALESCE(h.observacao, 'aplicado pelas linhas do termo')
       WHERE h.id = (
         SELECT id FROM public.contrato_item_precos_historico
          WHERE contrato_item_id = v_linha.contrato_item_id AND motivo IS NULL
          ORDER BY created_at DESC LIMIT 1);
    END IF;

    UPDATE public.contrato_aditivo_itens
       SET aplicado_em = now(), updated_at = now()
     WHERE id = v_linha.id;
    v_aplicadas := v_aplicadas + 1;
  END LOOP;

  UPDATE public.contrato_aditivos
     SET itens_aplicados_em = now(), updated_at = now()
   WHERE id = p_aditivo_id
     AND EXISTS (SELECT 1 FROM public.contrato_aditivo_itens WHERE aditivo_id = p_aditivo_id AND aplicado_em IS NOT NULL);

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato);
  RETURN jsonb_build_object('aplicadas', v_aplicadas);
END $$;
REVOKE ALL ON FUNCTION public.aplicar_itens_do_aditivo_interno(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.aplicar_itens_do_aditivo(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contrato uuid;
BEGIN
  SELECT contrato_id INTO v_contrato FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL OR NOT public.contrato_e_de_quem_chama(v_contrato) THEN
    RAISE EXCEPTION 'Sem permissão neste contrato';
  END IF;
  RETURN public.aplicar_itens_do_aditivo_interno(p_aditivo_id);
END $$;
REVOKE ALL ON FUNCTION public.aplicar_itens_do_aditivo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_itens_do_aditivo(uuid) TO authenticated;

-- ── 6) Reverter: o preço anterior volta; termo posterior barra ──────────────
CREATE OR REPLACE FUNCTION public.reverter_itens_do_aditivo_interno(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato uuid;
  v_numero text;
  v_aplicado timestamptz;
  v_posterior text;
  v_linha record;
  v_revertidas int := 0;
BEGIN
  SELECT contrato_id, numero_aditivo, itens_aplicados_em INTO v_contrato, v_numero, v_aplicado
    FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL THEN
    RAISE EXCEPTION 'Termo aditivo % não existe', p_aditivo_id;
  END IF;
  IF v_aplicado IS NULL THEN
    RETURN jsonb_build_object('revertidas', 0);
  END IF;

  -- Um termo mais novo que mexeu nos mesmos itens tem de ser revertido antes:
  -- o "preço anterior" deste já não é o preço que o item carrega.
  SELECT a2.numero_aditivo INTO v_posterior
    FROM public.contrato_aditivo_itens l2
    JOIN public.contrato_aditivos a2 ON a2.id = l2.aditivo_id
   WHERE l2.aditivo_id <> p_aditivo_id
     AND l2.aplicado_em > v_aplicado
     AND l2.valor_unitario_novo IS NOT NULL
     AND l2.contrato_item_id IN (
       SELECT contrato_item_id FROM public.contrato_aditivo_itens
        WHERE aditivo_id = p_aditivo_id AND valor_unitario_novo IS NOT NULL)
   ORDER BY l2.aplicado_em DESC LIMIT 1;
  IF v_posterior IS NOT NULL THEN
    RAISE EXCEPTION 'O termo % foi aplicado depois sobre os mesmos itens; reverta-o primeiro', v_posterior;
  END IF;

  FOR v_linha IN
    SELECT * FROM public.contrato_aditivo_itens
     WHERE aditivo_id = p_aditivo_id AND aplicado_em IS NOT NULL
     ORDER BY created_at DESC
  LOOP
    IF v_linha.valor_unitario_novo IS NOT NULL AND v_linha.valor_unitario_anterior IS NOT NULL THEN
      UPDATE public.contrato_itens
         SET valor_unitario = v_linha.valor_unitario_anterior, updated_at = now()
       WHERE id = v_linha.contrato_item_id;
      UPDATE public.contrato_item_precos_historico h
         SET motivo = 'Reversão do termo ' || COALESCE(v_numero, ''),
             observacao = COALESCE(h.observacao, 'revertido pelas linhas do termo')
       WHERE h.id = (
         SELECT id FROM public.contrato_item_precos_historico
          WHERE contrato_item_id = v_linha.contrato_item_id AND motivo IS NULL
          ORDER BY created_at DESC LIMIT 1);
    END IF;
    UPDATE public.contrato_aditivo_itens
       SET aplicado_em = NULL, updated_at = now()
     WHERE id = v_linha.id;
    v_revertidas := v_revertidas + 1;
  END LOOP;

  UPDATE public.contrato_aditivos
     SET itens_aplicados_em = NULL, updated_at = now()
   WHERE id = p_aditivo_id;

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato);
  RETURN jsonb_build_object('revertidas', v_revertidas);
END $$;
REVOKE ALL ON FUNCTION public.reverter_itens_do_aditivo_interno(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reverter_itens_do_aditivo(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contrato uuid;
BEGIN
  SELECT contrato_id INTO v_contrato FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL OR NOT public.contrato_e_de_quem_chama(v_contrato) THEN
    RAISE EXCEPTION 'Sem permissão neste contrato';
  END IF;
  RETURN public.reverter_itens_do_aditivo_interno(p_aditivo_id);
END $$;
REVOKE ALL ON FUNCTION public.reverter_itens_do_aditivo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverter_itens_do_aditivo(uuid) TO authenticated;

-- Apagar o termo desfaz o que ele fez nos itens ANTES de as linhas sumirem
-- em cascata. Termo posterior sobre os mesmos itens barra a exclusão.
CREATE OR REPLACE FUNCTION public.reverter_itens_antes_de_apagar_aditivo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.itens_aplicados_em IS NOT NULL THEN
    PERFORM public.reverter_itens_do_aditivo_interno(OLD.id);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_reverter_itens_antes_de_apagar_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_reverter_itens_antes_de_apagar_aditivo
BEFORE DELETE ON public.contrato_aditivos
FOR EACH ROW EXECUTE FUNCTION public.reverter_itens_antes_de_apagar_aditivo();

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'contrato_aditivos'
--      AND column_name IN ('data_efeitos','periodo_inicio','periodo_fim','fundamento_legal','itens_aplicados_em');
--   -- Esperado: 5 linhas.
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'contrato_aditivo_itens';
--   -- Esperado: 1.
--   SELECT proname FROM pg_proc WHERE proname IN ('aplicar_itens_do_aditivo','reverter_itens_do_aditivo','contrato_e_de_quem_chama');
--   -- Esperado: 3 linhas.
--   SELECT count(*) FROM public.contrato_itens
--    WHERE abs(coalesce(saldo_financeiro,0) - coalesce(saldo_quantitativo,0) * coalesce(valor_unitario,0)) > 1;
--   -- Esperado: 0 (era 0 antes; a fórmula nova não muda dado nenhum).
