-- =============================================================================
-- MIGRATION: Metas do Comercial — agendamento dos relatorios (Fase E)
-- Data: 2026-08-08
-- Objetivo: avisar o colaborador nas datas devidas de emissao.
--
-- LIMITE DESTA ENTREGA, declarado de proposito:
--   O relatorio em PDF/planilha e montado no navegador, porque quem calcula a
--   projecao e o motor em TypeScript (src/lib/metas/projecao.ts). Reproduzir
--   esse motor em SQL para gerar o arquivo aqui criaria uma segunda
--   implementacao das formulas — o mesmo problema que a normalizacao de
--   modalidade ja tem, e que so nao mordeu porque ha teste de paridade.
--
--   Entao o cron NAO emite o arquivo: ele cria a notificacao na data certa,
--   com link para a tela onde a emissao acontece em um clique e o snapshot e
--   gravado. "Automatico" aqui e o disparo, nao o arquivo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comercial_notificar_relatorios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje        date;
  v_dia         int;
  v_ultimo_dia  int;
  v_referencia  text;
  v_titulo      text;
  v_mensagem    text;
  v_enviadas    int := 0;
BEGIN
  -- O negocio opera em America/Sao_Paulo; o cron roda em UTC.
  v_hoje       := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dia        := EXTRACT(DAY FROM v_hoje)::int;
  v_ultimo_dia := EXTRACT(DAY FROM (date_trunc('month', v_hoje) + interval '1 month - 1 day'))::int;

  -- Dia 1 tem precedencia: fecha o mes anterior antes de abrir a quinzena.
  IF v_dia = 1 THEN
    v_referencia := 'MES';
    v_titulo     := 'Relatório mensal de metas disponível';
    v_mensagem   := 'O mês anterior fechou. Emita o relatório mensal com o desempenho e o registro dos trabalhos do período.';
  ELSIF v_dia = 15 THEN
    v_referencia := 'Q1';
    v_titulo     := 'Relatório quinzenal de metas disponível';
    v_mensagem   := 'Primeira quinzena encerrada. O relatório traz a projeção do mês e o que falta para bater a meta.';
  ELSIF v_dia = v_ultimo_dia THEN
    v_referencia := 'Q2';
    v_titulo     := 'Relatório quinzenal de metas disponível';
    v_mensagem   := 'Segunda quinzena encerrada. Confira a projeção de fechamento e os riscos apontados.';
  ELSE
    RETURN jsonb_build_object('data', v_hoje, 'referencia', null, 'notificacoes', 0);
  END IF;

  -- Um aviso por membro do comercial (admin incluso: ele tambem tem meta).
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link, tipo)
  SELECT DISTINCT m.user_id,
         v_titulo,
         v_mensagem,
         '/metas-comercial',
         'info'
    FROM public.empresa_membros m
   WHERE m.equipe = 'comercial' OR m.papel = 'admin';

  GET DIAGNOSTICS v_enviadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'data', v_hoje,
    'referencia', v_referencia,
    'notificacoes', v_enviadas
  );
END;
$$;

COMMENT ON FUNCTION public.comercial_notificar_relatorios() IS
  'Avisa o comercial nas datas de emissao: dia 1 (mensal do mes anterior), '
  'dia 15 (1a quinzena) e ultimo dia (2a quinzena). Nao gera o arquivo — o '
  'PDF/planilha sai da tela, onde o motor de projecao roda.';

-- Uma execucao diaria decide sozinha se e dia de avisar. Agendar tres crons
-- separados exigiria um por mes para o "ultimo dia", que varia.
SELECT cron.unschedule('comercial-notificar-relatorios')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'comercial-notificar-relatorios'
 );

-- 11:00 UTC = 08:00 em America/Sao_Paulo, inicio do expediente
SELECT cron.schedule(
  'comercial-notificar-relatorios',
  '0 11 * * *',
  $$ SELECT public.comercial_notificar_relatorios(); $$
);
