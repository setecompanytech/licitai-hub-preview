-- ═══════════════════════════════════════════════════════════════════════════
-- Desfazer a quitação de um pedido — na ordem inversa em que foi feita
-- ═══════════════════════════════════════════════════════════════════════════
--
-- "Quitar NF" grava `nf_quitada`/`data_quitacao` no pedido e gera a
-- bonificação do vendedor. Não havia caminho de volta: um pedido quitado por
-- engano ficava travado para sempre (edição parcial desde 21/09, exclusão
-- nunca). Esta função desfaz exatamente o que a quitação manual fez, com as
-- três guardas que a cronologia exige:
--
--   1. Quitação que veio de TÍTULO PAGO no Financeiro não se desfaz aqui —
--      o dinheiro entrou; o caminho é "Desfazer conciliação" lá, e o gatilho
--      de 31/08 (trg_quitacao_do_pedido) devolve o pedido sozinho.
--   2. Bonificação já PAGA bloqueia: pagamento feito a uma pessoa é fato
--      consumado; estorna-se a bonificação em Comissões antes.
--   3. Tudo o que foi desfeito fica registrado (quem, quando, motivo, data
--      anterior, bonificações apagadas) — o mesmo padrão de pedidos_exclusoes.
--
-- Só apaga bonificação NÃO paga (pendente/aprovada); a exclusão de pedido já
-- apagava em cadeia, inclusive paga, e é justamente isso que este caminho
-- evita. A lixeira continua indisponível em pedido quitado.

CREATE TABLE IF NOT EXISTS public.pedidos_quitacoes_desfeitas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL,
  contrato_id             uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  pedido_id               uuid NOT NULL,
  numero_pedido           text NOT NULL,
  nota_fiscal             text,
  valor_total             numeric(14,2) DEFAULT 0,
  data_quitacao_anterior  date,
  bonificacoes_apagadas   jsonb NOT NULL DEFAULT '[]'::jsonb,
  desfeito_por_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  desfeito_por_email      text,
  motivo                  text NOT NULL,
  desfeito_em             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pedidos_quitacoes_desfeitas IS
  'Trilha de auditoria de "Desfazer quitação": quem desfez, quando, por quê, '
  'qual era a data de quitação e quais bonificações pendentes foram apagadas.';

ALTER TABLE public.pedidos_quitacoes_desfeitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros leem quitações desfeitas da empresa" ON public.pedidos_quitacoes_desfeitas;
CREATE POLICY "Membros leem quitações desfeitas da empresa"
  ON public.pedidos_quitacoes_desfeitas FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

-- A escrita acontece SÓ pela função abaixo (SECURITY DEFINER). Sem policy de
-- INSERT/UPDATE/DELETE, ninguém grava ou apaga a trilha pela API.

CREATE OR REPLACE FUNCTION public.desfazer_quitacao_do_pedido(p_pedido_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido        public.contrato_pedidos%ROWTYPE;
  v_empresa_id    uuid;
  v_titulos_pagos int;
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

  -- Guarda 1: quitação que veio de título pago é do Financeiro.
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

  -- Guarda 2: bonificação paga é fato consumado.
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

  -- Apaga as bonificações NÃO pagas geradas por esta quitação, guardando o que eram.
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
$$;

COMMENT ON FUNCTION public.desfazer_quitacao_do_pedido(uuid, text) IS
  'Desfaz a quitação MANUAL de um pedido: bloqueia se houver título pago ligado '
  '(caminho é o Financeiro) ou bonificação já paga; apaga bonificação pendente; '
  'registra em pedidos_quitacoes_desfeitas; devolve nf_quitada/data_quitacao ao estado anterior.';

REVOKE ALL ON FUNCTION public.desfazer_quitacao_do_pedido(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.desfazer_quitacao_do_pedido(uuid, text) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. A tabela e a função existem:
--    SELECT to_regclass('public.pedidos_quitacoes_desfeitas'),
--           to_regprocedure('public.desfazer_quitacao_do_pedido(uuid, text)');
--
-- 2. Depois de desfazer um pedido de teste:
--    SELECT numero_pedido, data_quitacao_anterior, jsonb_array_length(bonificacoes_apagadas), motivo, desfeito_em
--      FROM public.pedidos_quitacoes_desfeitas ORDER BY desfeito_em DESC LIMIT 5;
