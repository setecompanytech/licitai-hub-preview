-- ═══════════════════════════════════════════════════════════════════════════
-- saldo_remanescente é coluna GERADA — não se escreve nela
-- ═══════════════════════════════════════════════════════════════════════════
--
-- "Erro ao excluir pedido: column saldo_remanescente can only be updated to
-- DEFAULT" (01/09, 13:41). Esse erro só existe para coluna GENERATED: no banco
-- de produção, contratos.saldo_remanescente deriva sozinha de
-- valor_global − valor_consumido.
--
-- A 20260901000004 reintroduziu a escrita direta ao copiar a fórmula da
-- migration de março DO REPOSITÓRIO — e o repositório, de novo, não bate com
-- o banco: a versão vigente da função já tinha parado de escrever nessa
-- coluna quando ela virou gerada. Terceira vez que o descompasso repo × banco
-- morde no mesmo dia; a lição continua a mesma: estado de banco se verifica,
-- não se deduz do código.
--
-- A correção é ficar do lado CERTO da coluna gerada: escrever só
-- valor_consumido (e valor_global, no gatilho de aditivos) e deixar o saldo
-- derivar — que é, aliás, o princípio da casa. As duas funções da 0004 são
-- recriadas idênticas, menos a escrita proibida.

-- ── Gatilho de PEDIDOS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_saldo_item_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contrato_id UUID;
  v_total_val NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato_id);

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_val
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  -- saldo_remanescente NÃO entra: é coluna gerada e se deriva sozinha.
  UPDATE public.contratos
  SET valor_consumido = v_total_val,
      updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ── Gatilho de ADITIVOS ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_contrato_id UUID;
  v_total_acrescimo NUMERIC;
  v_total_supressao NUMERIC;
  v_ultima_data_fim DATE;
  v_data_inicio DATE;
  v_total_pedidos NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  SELECT
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0)
  INTO v_total_acrescimo, v_total_supressao
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  SELECT data_inicio INTO v_data_inicio FROM public.contratos WHERE id = v_contrato_id;

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pedidos
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  -- valor_global e valor_consumido são escritos; o saldo deriva deles.
  UPDATE public.contratos
  SET
    valor_global = COALESCE(valor_global_original, 0) + v_total_acrescimo - v_total_supressao,
    valor_consumido = v_total_pedidos,
    data_fim = COALESCE(v_ultima_data_fim, data_fim),
    vigencia_meses = CASE
      WHEN COALESCE(v_ultima_data_fim, data_fim) IS NOT NULL AND v_data_inicio IS NOT NULL THEN
        GREATEST(1, ROUND(
          (EXTRACT(EPOCH FROM (COALESCE(v_ultima_data_fim, data_fim)::timestamp - v_data_inicio::timestamp)) / 86400) / 30
        )::int)
      ELSE vigencia_meses
    END,
    updated_at = now()
  WHERE id = v_contrato_id;

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato_id);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Após aplicar, repita a exclusão dos pedidos 002 e 004 pela lixeira. Depois:
--
--   SELECT c.valor_consumido, c.saldo_remanescente,
--          i.saldo_quantitativo, i.saldo_financeiro
--     FROM public.contratos c
--     JOIN public.contrato_itens i ON i.contrato_id = c.id
--    WHERE c.numero_contrato = '149/2024';
--
-- Com 002 e 004 excluídos: consumido 72.092,35 · saldo 90.267,65 ·
-- item 4.003 QCG / 90.267,65.
