-- Saldo do item por PERÍODO DE VIGÊNCIA (30/09/2026).
--
-- O saldo era um pote único: toda linha de termo aplicada somava quantidade,
-- sem olhar tipo nem período. Uma renovação (art. 107 da Lei 14.133/21) virava
-- acréscimo, e o 772/2024 oferecia 196.924 unidades quando o período corrente
-- tem 67.508 — "o sistema duplica as quantidades" (dono, 30/09).
--
-- Regra nova: cada período tem a SUA quantidade. A renovação (tipo
-- 'prorrogacao' com periodo_inicio) abre um período e repõe; o que sobrou do
-- período anterior é "não executado", nunca saldo. `saldo_quantitativo` passa
-- a medir o PERÍODO CORRENTE: quantidade do período (linhas da renovação que o
-- abriu, ou a contratada no período da contratação) + acréscimos de termos
-- aplicados dentro do período − pedidos que caem nele (pelo carimbo
-- `origem_aditivo_id` e, sem carimbo, pela data). `quantidade_consumida`
-- continua sendo o consumo na vida do contrato.
--
-- Contrato sem renovação com período: conta exatamente como antes.
-- O período corrente muda com o calendário, e nenhum gatilho dispara por
-- data: um job diário recalcula os contratos que têm períodos.
--
-- Também: o empenho ganha `origem_aditivo_id` (o carimbo do termo), como o
-- pedido já tinha. O empenho reserva; a nota consome.

ALTER TABLE public.contrato_empenhos
  ADD COLUMN IF NOT EXISTS origem_aditivo_id uuid REFERENCES public.contrato_aditivos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contrato_empenhos_origem_aditivo ON public.contrato_empenhos(origem_aditivo_id) WHERE origem_aditivo_id IS NOT NULL;
COMMENT ON COLUMN public.contrato_empenhos.origem_aditivo_id IS 'Termo aditivo de referência do empenho (janela do contrato). Sem carimbo, a janela é a da data de emissão.';

-- O período (renovação) em que uma data cai: NULL = período da contratação.
CREATE OR REPLACE FUNCTION public.periodo_do_contrato_na_data(p_contrato_id uuid, p_data date)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT a.id
    FROM public.contrato_aditivos a
   WHERE a.contrato_id = p_contrato_id
     AND a.tipo = 'prorrogacao'
     AND a.periodo_inicio IS NOT NULL
     AND a.periodo_inicio <= COALESCE(p_data, CURRENT_DATE)
   ORDER BY a.periodo_inicio DESC
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.recalcular_saldos_itens_do_contrato(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acresc_qtd NUMERIC;
  v_supr_qtd   NUMERIC;
  v_qtd_total  NUMERIC;
  v_periodo_id uuid;     -- renovação que abre o período corrente; NULL = contratação
  v_inicio     date;     -- início do período corrente (NULL no da contratação)
  v_fim        date;     -- início do período seguinte (NULL = sem seguinte)
  v_qtd_periodo NUMERIC; -- quantidade do termo da renovação (rateio quando ela não tem linhas)
  v_periodo_sem_linhas boolean := false;
BEGIN
  -- Termos SEM linhas aplicadas e que NÃO abrem período rateiam quantidade pela proporção (como antes).
  SELECT
    COALESCE(SUM(quantidade_acrescimo) FILTER (WHERE itens_aplicados_em IS NULL AND NOT (tipo = 'prorrogacao' AND periodo_inicio IS NOT NULL)), 0),
    COALESCE(SUM(quantidade_supressao) FILTER (WHERE itens_aplicados_em IS NULL AND NOT (tipo = 'prorrogacao' AND periodo_inicio IS NOT NULL)), 0)
  INTO v_acresc_qtd, v_supr_qtd
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id;

  SELECT COALESCE(SUM(quantidade_contratada), 0)
  INTO v_qtd_total
  FROM public.contrato_itens
  WHERE contrato_id = p_contrato_id;

  IF v_qtd_total <= 0 THEN RETURN; END IF;

  -- O período corrente pelo calendário.
  v_periodo_id := public.periodo_do_contrato_na_data(p_contrato_id, CURRENT_DATE);
  IF v_periodo_id IS NULL THEN
    v_inicio := NULL;
    SELECT MIN(periodo_inicio) INTO v_fim
      FROM public.contrato_aditivos
     WHERE contrato_id = p_contrato_id AND tipo = 'prorrogacao' AND periodo_inicio IS NOT NULL;
  ELSE
    SELECT periodo_inicio, COALESCE(quantidade_acrescimo, 0),
           NOT EXISTS (SELECT 1 FROM public.contrato_aditivo_itens l WHERE l.aditivo_id = contrato_aditivos.id AND l.aplicado_em IS NOT NULL)
      INTO v_inicio, v_qtd_periodo, v_periodo_sem_linhas
      FROM public.contrato_aditivos WHERE id = v_periodo_id;
    SELECT MIN(periodo_inicio) INTO v_fim
      FROM public.contrato_aditivos
     WHERE contrato_id = p_contrato_id AND tipo = 'prorrogacao' AND periodo_inicio IS NOT NULL
       AND periodo_inicio > v_inicio;
  END IF;

  UPDATE public.contrato_itens AS ci
  SET
    quantidade_consumida = COALESCE((
      SELECT SUM(p.quantidade) FROM public.contrato_pedidos p
       WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
    ), 0),
    saldo_quantitativo =
      -- 1) A quantidade que abre o período corrente.
      CASE
        WHEN v_periodo_id IS NULL THEN ci.quantidade_contratada
        WHEN v_periodo_sem_linhas THEN
          CASE WHEN v_qtd_periodo > 0 THEN v_qtd_periodo * (ci.quantidade_contratada / v_qtd_total) ELSE ci.quantidade_contratada END
        ELSE COALESCE((
          SELECT SUM(l.quantidade_acrescimo - l.quantidade_supressao)
            FROM public.contrato_aditivo_itens l
           WHERE l.contrato_item_id = ci.id AND l.aditivo_id = v_periodo_id AND l.aplicado_em IS NOT NULL
        ), 0)
      END
      -- 2) Linhas aplicadas de termos que NÃO abrem período e cujos efeitos caem no período corrente.
      + COALESCE((
          SELECT SUM(l.quantidade_acrescimo - l.quantidade_supressao)
            FROM public.contrato_aditivo_itens l
            JOIN public.contrato_aditivos a ON a.id = l.aditivo_id
           WHERE l.contrato_item_id = ci.id AND l.aplicado_em IS NOT NULL
             AND NOT (a.tipo = 'prorrogacao' AND a.periodo_inicio IS NOT NULL)
             AND public.periodo_do_contrato_na_data(p_contrato_id, COALESCE(a.data_efeitos, a.data_assinatura, a.data_aditivo)) IS NOT DISTINCT FROM v_periodo_id
        ), 0)
      -- 3) Termos sem linhas que não abrem período: rateio proporcional (como antes).
      + (v_acresc_qtd - v_supr_qtd) * (ci.quantidade_contratada / v_qtd_total)
      -- 4) Menos os pedidos que caem no período corrente: carimbo do termo manda; sem carimbo, a data.
      - COALESCE((
          SELECT SUM(p.quantidade)
            FROM public.contrato_pedidos p
            LEFT JOIN public.contrato_aditivos t ON t.id = p.origem_aditivo_id
           WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
             AND (
               CASE
                 WHEN t.id IS NOT NULL AND t.tipo = 'prorrogacao' AND t.periodo_inicio IS NOT NULL THEN t.id
                 WHEN t.id IS NOT NULL THEN public.periodo_do_contrato_na_data(p_contrato_id, COALESCE(t.data_efeitos, t.data_assinatura, t.data_aditivo))
                 ELSE public.periodo_do_contrato_na_data(p_contrato_id, p.data_pedido::date)
               END
             ) IS NOT DISTINCT FROM v_periodo_id
        ), 0),
    updated_at = now()
  WHERE ci.contrato_id = p_contrato_id;

  UPDATE public.contrato_itens AS ci
  SET saldo_financeiro = ROUND(COALESCE(ci.saldo_quantitativo, 0) * COALESCE(ci.valor_unitario, 0), 2)
  WHERE ci.contrato_id = p_contrato_id;
END $function$;

COMMENT ON FUNCTION public.recalcular_saldos_itens_do_contrato(uuid) IS
  'Saldo do item = quantidade do PERÍODO CORRENTE (renovação repõe; o que sobrou do período anterior não entra) − pedidos que caem nele. quantidade_consumida = consumo na vida do contrato.';

-- Recalcula já os contratos que têm períodos (hoje: os que registraram renovação com período).
SELECT public.recalcular_saldos_itens_do_contrato(c.id)
  FROM public.contratos c
 WHERE EXISTS (SELECT 1 FROM public.contrato_aditivos a WHERE a.contrato_id = c.id AND a.tipo = 'prorrogacao' AND a.periodo_inicio IS NOT NULL);

-- O período corrente muda com o calendário: recálculo diário dos contratos com períodos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'saldos-por-periodo-diario') THEN
      PERFORM cron.schedule(
        'saldos-por-periodo-diario',
        '40 3 * * *',
        $job$
          SELECT public.recalcular_saldos_itens_do_contrato(c.id)
            FROM public.contratos c
           WHERE EXISTS (SELECT 1 FROM public.contrato_aditivos a
                          WHERE a.contrato_id = c.id AND a.tipo = 'prorrogacao' AND a.periodo_inicio IS NOT NULL)
        $job$
      );
    END IF;
  END IF;
END $$;
