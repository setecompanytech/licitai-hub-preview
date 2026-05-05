-- Job/microação para reprocessar aditivos já cadastrados
-- Limpa alertas indevidos de prazo/vigência e recalcula apenas os legítimos

CREATE OR REPLACE FUNCTION public.reprocessar_alertas_aditivos_todos_contratos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_contrato record;
  v_contratos_processados int := 0;
  v_alertas_antes int := 0;
  v_alertas_depois int := 0;
  v_alertas_removidos_prazo int := 0;
BEGIN
  -- Apenas admins podem executar este job global
  SELECT public.has_role(v_user_id, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem executar o reprocessamento global de aditivos';
  END IF;

  -- Snapshot do total de alertas antes
  SELECT COUNT(*) INTO v_alertas_antes
  FROM public.contrato_ia_auditoria
  WHERE origem = 'alerta_limite_legal';

  -- Limpeza prévia explícita: remove alertas indevidos de aditivos de prazo/vigência
  -- (aditivos sem acréscimo de valor nem de quantidade não devem gerar alerta de art. 125)
  WITH removidos AS (
    DELETE FROM public.contrato_ia_auditoria a
    USING public.contrato_aditivos ad
    WHERE a.origem = 'alerta_limite_legal'
      AND a.contrato_id = ad.contrato_id
      AND (
        LOWER(COALESCE(ad.tipo, '')) IN ('prazo', 'vigencia', 'vigência', 'prazo/vigencia', 'prazo/vigência')
        OR (
          COALESCE(ad.valor_acrescimo, 0) = 0
          AND COALESCE(ad.quantidade_acrescimo, 0) = 0
        )
      )
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_alertas_removidos_prazo FROM removidos;

  -- Para cada contrato que possua aditivos, executa o recálculo legal
  FOR v_contrato IN
    SELECT DISTINCT contrato_id
    FROM public.contrato_aditivos
    WHERE contrato_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.recalcular_alertas_aditivos_contrato(v_contrato.contrato_id);
      v_contratos_processados := v_contratos_processados + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Não interrompe o job em caso de erro pontual em um contrato
      INSERT INTO public.contrato_ia_auditoria (
        contrato_id, campo, valor_anterior, valor_novo, origem
      ) VALUES (
        v_contrato.contrato_id,
        'reprocessamento_aditivos',
        NULL,
        'Erro ao reprocessar: ' || SQLERRM,
        'recalculo_saldo'
      );
    END;
  END LOOP;

  -- Snapshot do total de alertas depois
  SELECT COUNT(*) INTO v_alertas_depois
  FROM public.contrato_ia_auditoria
  WHERE origem = 'alerta_limite_legal';

  RETURN jsonb_build_object(
    'ok', true,
    'contratos_processados', v_contratos_processados,
    'alertas_antes', v_alertas_antes,
    'alertas_removidos_prazo_vigencia', v_alertas_removidos_prazo,
    'alertas_depois', v_alertas_depois,
    'delta_alertas', v_alertas_depois - v_alertas_antes,
    'executado_em', now(),
    'executado_por', v_user_id
  );
END;
$$;

COMMENT ON FUNCTION public.reprocessar_alertas_aditivos_todos_contratos() IS
'Job administrativo: reprocessa todos os contratos com aditivos, removendo alertas indevidos (prazo/vigência sem acréscimo) e recalculando alertas legais conforme art. 125 da Lei 14.133/21.';