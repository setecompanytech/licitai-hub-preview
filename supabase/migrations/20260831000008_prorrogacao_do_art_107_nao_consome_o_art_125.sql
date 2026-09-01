-- ═══════════════════════════════════════════════════════════════════════════
-- Prorrogação do art. 107 não consome o limite do art. 125
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O contrato 149/2024 recebeu o 1º Termo Aditivo: prorrogação de vigência por
-- 12 meses, de 22/10/2025 a 22/10/2026, com fundamento no art. 107 da Lei
-- 14.133/2021 — fornecimento contínuo.
--
-- Registrado, o sistema acusou: "acréscimos acumulados em QUANTIDADE atingiram
-- 100,00% (3.600 sobre 3.600)". Alerta falso, e falso por confundir dois
-- institutos que a lei separa:
--
--   ART. 125   ACRÉSCIMO dentro da MESMA vigência. A contratada é obrigada a
--              aceitar até 25% do valor inicial atualizado (50% em reforma).
--              É teto, e o aditivo o consome.
--
--   ART. 107   PRORROGAÇÃO de serviço ou fornecimento CONTÍNUO. Abre um NOVO
--              período, com a estimativa do período. Não acresce coisa alguma
--              ao período anterior, e não toca o limite do art. 125.
--
-- Tratar a renovação anual como acréscimo faz todo contrato contínuo estourar
-- o limite na primeira prorrogação — e um alerta legal que sempre dispara é um
-- alerta que ninguém lê, inclusive quando ele estiver certo.
--
-- ── Duas autoridades sobre a mesma regra ────────────────────────────────────
--
-- `consomeLimiteDoArt125` em lib/contratos/rotulos.ts já dizia que prazo não
-- consome. Esta função somava por conta própria, com uma lista de exclusões
-- diferente. Duas cópias da mesma regra divergem sempre; é só questão de qual
-- das duas alguém lembra de atualizar — e desta vez foi a de baixo.

CREATE OR REPLACE FUNCTION public.fn_alerta_legal_contrato(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato       record;
  v_valor_original numeric;
  v_qtd_total      numeric;
  v_tem_quant      boolean;
  v_total_acrescimo     numeric;
  v_total_qtd_acrescimo numeric;
  v_pct_valor      numeric;
  v_pct_qtd        numeric;
  v_limite         numeric;
BEGIN
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- O teto do art. 125: 25% no geral, 50% em reforma de edifício ou de
  -- equipamento.
  v_limite := CASE
    WHEN COALESCE(v_contrato.objeto, '') ~* 'reforma' THEN 50
    ELSE 25
  END;

  v_valor_original := COALESCE(v_contrato.valor_global_original, v_contrato.valor_global, 0);

  SELECT COALESCE(SUM(quantidade_contratada), 0)
    INTO v_qtd_total
    FROM public.contrato_itens WHERE contrato_id = p_contrato_id;
  v_tem_quant := v_qtd_total > 0;

  -- ── A soma que importa ────────────────────────────────────────────────────
  --
  -- Só entram os tipos que de fato ACRESCEM dentro da mesma vigência. A lista
  -- é por INCLUSÃO, não por exclusão: com exclusão, todo tipo novo entra na
  -- conta por omissão, e foi assim que `prazo_quantidade` — uma prorrogação —
  -- passou a contar como acréscimo.
  SELECT COALESCE(SUM(valor_acrescimo), 0), COALESCE(SUM(quantidade_acrescimo), 0)
    INTO v_total_acrescimo, v_total_qtd_acrescimo
    FROM public.contrato_aditivos
   WHERE contrato_id = p_contrato_id
     AND tipo IN ('valor', 'quantidade', 'valor_quantidade', 'escopo');

  IF v_valor_original > 0 AND v_total_acrescimo > 0 THEN
    v_pct_valor := ROUND(v_total_acrescimo / v_valor_original * 100, 2);
    IF v_pct_valor > v_limite THEN
      INSERT INTO public.contrato_auditoria
        (contrato_id, tipo, titulo, limite_legal, situacao_detectada)
      VALUES (p_contrato_id, 'alerta_legal', 'Alerta — Aditivo de Valor',
        'Limite legal Lei 14.133/21, art. 125: ' || v_limite::text || '%',
        'ATENÇÃO: acréscimos acumulados em VALOR atingiram ' || v_pct_valor::text
          || '% (R$ ' || v_total_acrescimo::text || ' sobre R$ ' || v_valor_original::text || ')');
    END IF;
  END IF;

  IF v_tem_quant AND v_total_qtd_acrescimo > 0 THEN
    v_pct_qtd := ROUND(v_total_qtd_acrescimo / v_qtd_total * 100, 2);
    IF v_pct_qtd > v_limite THEN
      INSERT INTO public.contrato_auditoria
        (contrato_id, tipo, titulo, limite_legal, situacao_detectada)
      VALUES (p_contrato_id, 'alerta_legal', 'Alerta — Aditivo de Quantidade',
        'Limite legal Lei 14.133/21, art. 125: ' || v_limite::text || '%',
        'ATENÇÃO: acréscimos acumulados em QUANTIDADE atingiram ' || v_pct_qtd::text
          || '% (' || v_total_qtd_acrescimo::text || ' sobre ' || v_qtd_total::text || ')');
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_alerta_legal_contrato(uuid) IS
  'Alerta do art. 125 da Lei 14.133/2021. Só somam os aditivos que ACRESCEM '
  'dentro da mesma vigência — valor, quantidade, valor_quantidade e escopo. '
  'Prorrogação (art. 107) abre NOVO período e não consome o limite; tratá-la '
  'como acréscimo faz todo contrato contínuo estourar na primeira renovação. '
  'A lista é por INCLUSÃO: com exclusão, todo tipo novo entrava na conta por '
  'omissão. Mesma regra de `consomeLimiteDoArt125` em lib/contratos/rotulos.ts.';

-- ── Limpa o alerta falso já emitido ─────────────────────────────────────────
DELETE FROM public.contrato_auditoria a
 USING public.contratos c
 WHERE c.id = a.contrato_id
   AND a.tipo = 'alerta_legal'
   AND a.titulo ILIKE '%Quantidade%'
   AND NOT EXISTS (
     SELECT 1 FROM public.contrato_aditivos ad
      WHERE ad.contrato_id = a.contrato_id
        AND ad.tipo IN ('valor', 'quantidade', 'valor_quantidade', 'escopo')
        AND COALESCE(ad.quantidade_acrescimo, 0) > 0
   );

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT c.numero_contrato, a.titulo, a.situacao_detectada
--     FROM public.contrato_auditoria a
--     JOIN public.contratos c ON c.id = a.contrato_id
--    WHERE a.tipo = 'alerta_legal'
--    ORDER BY c.numero_contrato;
--
-- O 149/2024 não deve mais aparecer: o único aditivo dele é prorrogação.
