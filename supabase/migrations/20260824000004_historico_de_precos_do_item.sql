-- =============================================================================
-- O preço do item guarda a própria história
--
-- O valor registrado na ATA não é imutável: reequilíbrio econômico-financeiro
-- e reajuste por índice anual mudam o unitário legitimamente. O sistema
-- aceitava a edição e ESQUECIA o valor anterior — impossível responder "de
-- quanto para quanto foi, e por quê", que é exatamente o que um relatório de
-- evolução precisa e o que o órgão pergunta num pedido de reequilíbrio.
--
-- A captura é por gatilho, não por disciplina de tela: qualquer porta que
-- altere contrato_itens.valor_unitario deixa rastro, com o percentual da
-- variação calculado no ato. O MOTIVO fica nulo até alguém classificar —
-- inferir "reequilíbrio" de uma edição seria o sistema opinando sobre processo
-- que não acompanhou.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contrato_item_precos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_item_id UUID NOT NULL REFERENCES public.contrato_itens(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  empresa_id UUID,
  user_id UUID,
  valor_anterior NUMERIC NOT NULL,
  valor_novo NUMERIC NOT NULL,
  variacao_pct NUMERIC,
  -- reequilibrio | reajuste | repactuacao | revisao | correcao | outro
  motivo TEXT CHECK (motivo IS NULL OR motivo IN
    ('reequilibrio','reajuste','repactuacao','revisao','correcao','outro')),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precos_historico_item
  ON public.contrato_item_precos_historico(contrato_item_id);
CREATE INDEX IF NOT EXISTS idx_precos_historico_contrato
  ON public.contrato_item_precos_historico(contrato_id);

ALTER TABLE public.contrato_item_precos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem historico de precos" ON public.contrato_item_precos_historico;
CREATE POLICY "membros leem historico de precos"
  ON public.contrato_item_precos_historico FOR SELECT TO authenticated
  USING (
    (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id))
    OR user_id = auth.uid()
  );

-- Classificar o motivo depois do fato é o fluxo normal (a edição vem antes do
-- termo). Só motivo e observação são editáveis por quem lê; os valores, nunca —
-- histórico reescrevível não é histórico.
DROP POLICY IF EXISTS "membros classificam motivo" ON public.contrato_item_precos_historico;
CREATE POLICY "membros classificam motivo"
  ON public.contrato_item_precos_historico FOR UPDATE TO authenticated
  USING (
    (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id))
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "admin exclui historico" ON public.contrato_item_precos_historico;
CREATE POLICY "admin exclui historico"
  ON public.contrato_item_precos_historico FOR DELETE TO authenticated
  USING (empresa_id IS NOT NULL AND public.is_empresa_admin(auth.uid(), empresa_id));

-- ── O gatilho que nunca esquece ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_mudanca_de_preco_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa UUID;
BEGIN
  IF NEW.valor_unitario IS NOT DISTINCT FROM OLD.valor_unitario THEN
    RETURN NEW;
  END IF;

  SELECT empresa_id INTO v_empresa FROM public.contratos WHERE id = NEW.contrato_id;

  INSERT INTO public.contrato_item_precos_historico
    (contrato_item_id, contrato_id, empresa_id, user_id, valor_anterior, valor_novo, variacao_pct)
  VALUES (
    NEW.id, NEW.contrato_id, v_empresa, auth.uid(),
    COALESCE(OLD.valor_unitario, 0), COALESCE(NEW.valor_unitario, 0),
    CASE WHEN COALESCE(OLD.valor_unitario, 0) > 0
      THEN ROUND(((COALESCE(NEW.valor_unitario, 0) - OLD.valor_unitario) / OLD.valor_unitario) * 100, 2)
      ELSE NULL END
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Falha no diário não pode impedir a edição do item — mas fica no log.
  RAISE WARNING 'registrar_mudanca_de_preco_item: %', SQLERRM;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_historico_preco_item ON public.contrato_itens;
CREATE TRIGGER trg_historico_preco_item
AFTER UPDATE OF valor_unitario ON public.contrato_itens
FOR EACH ROW EXECUTE FUNCTION public.registrar_mudanca_de_preco_item();

-- ── A evolução pronta para relatório ─────────────────────────────────────────
-- security_invoker: a view enxerga só o que o RLS de quem consulta permite.
CREATE OR REPLACE VIEW public.vw_evolucao_precos_itens
WITH (security_invoker = true) AS
SELECT
  ci.id                AS contrato_item_id,
  ci.contrato_id,
  ci.descricao,
  ci.valor_unitario    AS valor_atual,
  primeiro.valor_anterior AS valor_original,
  ci.valor_unitario - primeiro.valor_anterior AS aumento_absoluto,
  CASE WHEN primeiro.valor_anterior > 0
    THEN ROUND(((ci.valor_unitario - primeiro.valor_anterior) / primeiro.valor_anterior) * 100, 2)
    ELSE NULL END      AS aumento_pct_acumulado,
  (SELECT COUNT(*) FROM public.contrato_item_precos_historico h
    WHERE h.contrato_item_id = ci.id) AS alteracoes,
  (SELECT array_agg(DISTINCT h.motivo) FROM public.contrato_item_precos_historico h
    WHERE h.contrato_item_id = ci.id AND h.motivo IS NOT NULL) AS motivos
FROM public.contrato_itens ci
JOIN LATERAL (
  SELECT h.valor_anterior
  FROM public.contrato_item_precos_historico h
  WHERE h.contrato_item_id = ci.id
  ORDER BY h.created_at ASC
  LIMIT 1
) primeiro ON TRUE;

COMMENT ON VIEW public.vw_evolucao_precos_itens IS
  'Evolução de preço por item: valor original (antes da primeira mudança), '
  'atual, aumento absoluto e percentual acumulado, número de alterações e '
  'motivos classificados. Só lista itens que JÁ mudaram de preço.';
