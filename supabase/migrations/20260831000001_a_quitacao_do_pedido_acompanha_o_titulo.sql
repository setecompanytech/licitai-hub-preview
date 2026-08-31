-- ═══════════════════════════════════════════════════════════════════════════
-- A quitação do pedido acompanha o título — sempre, não só no dia do vínculo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `contrato_pedidos.nf_quitada` e `data_quitacao` eram calculados no INSTANTE
-- em que alguém ligava o lançamento ao pedido, pelos dois diálogos de vínculo,
-- e nunca mais. Depois disso o número ficava parado.
--
-- A sequência que quebra é a mais comum de todas:
--
--   1. O pedido é registrado, com o título ainda `previsto`.
--   2. Alguém liga o título ao pedido. Não está pago → nf_quitada = false. ✓
--   3. Semanas depois o dinheiro entra e a CONCILIAÇÃO marca `conciliado`.
--   4. O pedido continua dizendo que não foi pago. ✗
--
-- Ninguém volta ao diálogo de vínculo depois que o vínculo já existe — não há
-- por quê. Então o passo 4 dura para sempre, e o relatório de contrato mostra
-- entrega paga como pendente, indefinidamente.
--
-- É o mesmo defeito que `financeiro_contas.saldo_atual` tinha antes de virar
-- derivado: um número gravado numa hora, correto naquela hora, que descola do
-- que o originou e passa a mentir em silêncio.
--
-- ── Por que gatilho, e não coluna derivada ──────────────────────────────────
--
-- `nf_quitada` já é coluna, e é lida em relatório, filtro e Kanban. Trocá-la
-- por função exigiria mexer em tudo isso de uma vez. O gatilho dá a garantia
-- que interessa — o valor nunca fica velho — sem essa reforma.

CREATE OR REPLACE FUNCTION public.recalcular_quitacao_do_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   int;
  v_pagos   int;
  v_ultima  date;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('realizado','conciliado')),
         max(data_competencia) FILTER (WHERE status IN ('realizado','conciliado'))
    INTO v_total, v_pagos, v_ultima
    FROM public.financeiro_lancamentos
   WHERE contrato_pedido_id = p_pedido_id;

  UPDATE public.contrato_pedidos
     -- Quita quando TODAS as parcelas estão pagas, e a data é a da última:
     -- o pedido só está pago quando não falta nenhuma. Mesma regra de
     -- `quitacaoDoPedido` no front — aqui ela vira a autoridade, e lá vira
     -- espelho, para não haver duas.
     SET nf_quitada    = (v_total > 0 AND v_pagos = v_total),
         data_quitacao = CASE WHEN v_total > 0 AND v_pagos = v_total THEN v_ultima END
   WHERE id = p_pedido_id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_quitacao_do_pedido(uuid) IS
  'Refaz nf_quitada/data_quitacao de um pedido a partir dos títulos ligados a '
  'ele. Chamada pelo gatilho de financeiro_lancamentos: sem isso a quitação '
  'congela no dia do vínculo e o pedido pago segue aparecendo como pendente.';

CREATE OR REPLACE FUNCTION public.tg_quitacao_do_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Os DOIS pedidos: o que a linha deixou e o que ela passou a apontar. Um
  -- lançamento remanejado de um pedido para outro precisa acertar os dois —
  -- só o novo deixaria o antigo quitado por um título que não é mais dele.
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.contrato_pedido_id IS NOT NULL THEN
    PERFORM public.recalcular_quitacao_do_pedido(OLD.contrato_pedido_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.contrato_pedido_id IS NOT NULL THEN
    PERFORM public.recalcular_quitacao_do_pedido(NEW.contrato_pedido_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_quitacao_do_pedido ON public.financeiro_lancamentos;
CREATE TRIGGER trg_quitacao_do_pedido
  AFTER INSERT OR DELETE OR UPDATE OF status, contrato_pedido_id, data_competencia
  ON public.financeiro_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_quitacao_do_pedido();

-- ── Acerta o que já está torto ──────────────────────────────────────────────
-- Os pedidos vinculados antes do gatilho carregam a foto do dia do vínculo.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT contrato_pedido_id AS id
      FROM public.financeiro_lancamentos
     WHERE contrato_pedido_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_quitacao_do_pedido(r.id);
  END LOOP;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Nenhum pedido deve dizer "não quitado" com todos os títulos conciliados:
--
--    SELECT p.numero_pedido, p.nf_quitada, p.data_quitacao,
--           count(*) AS titulos,
--           count(*) FILTER (WHERE l.status IN ('realizado','conciliado')) AS pagos
--      FROM public.contrato_pedidos p
--      JOIN public.financeiro_lancamentos l ON l.contrato_pedido_id = p.id
--     GROUP BY p.id, p.numero_pedido, p.nf_quitada, p.data_quitacao
--    HAVING count(*) = count(*) FILTER (WHERE l.status IN ('realizado','conciliado'))
--       AND p.nf_quitada IS NOT TRUE;
--
--    Esperado depois desta migration: zero linhas.
--
-- 2. E o inverso — quitado com título em aberto:
--
--    ... HAVING count(*) <> count(*) FILTER (...) AND p.nf_quitada IS TRUE;
--
--    Esperado: zero linhas.
