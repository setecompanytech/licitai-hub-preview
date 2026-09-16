-- 20260916000007 — pregão remarcado: a disputa do robô acompanha a data nova do processo
--
-- POR QUÊ (Fase 8, 16/09/2026). A disputa copia a data da sessão do processo
-- quando é cadastrada. Se o pregão é adiado e alguém corrige a data no processo
-- (edição no kanban, leitura do edital, integração), a disputa continuava na
-- data velha: o robô entraria num pregão que não vai acontecer e faltaria ao
-- verdadeiro.
--
-- A REGRA, disputa por disputa (só as ligadas ao processo e ainda não enviadas):
--   - a disputa estava na data velha do processo (ninguém mexeu nela à mão) →
--     passa para a data nova, e quem a cadastrou é avisado;
--   - a disputa foi ajustada à mão, está sem data, ou o processo perdeu a data →
--     NÃO muda nada; só avisa, com as duas datas, para a pessoa decidir.
-- A data do processo é a mesma que o cadastro usa: a abertura, e sem ela o fim
-- do prazo de propostas (`sessaoDoProcesso` em src/lib/robo/agendamento.ts).
--
-- A disputa movida volta à agenda sozinha: o gatilho da migration
-- 20260916000004/000006 zera `enviada_em`, as tentativas e os lembretes.
--
-- SEGURANÇA DO PROCESSO: `licitacoes` é tabela central. Qualquer falha aqui
-- vira WARNING no log do banco e o processo é salvo normalmente — um aviso do
-- robô nunca pode impedir alguém de corrigir a data de um processo.
--
-- SECURITY DEFINER: quem edita o processo pode não ser o dono da disputa, e o
-- aviso vai para o dono (a policy de `notificacoes` só deixa cada um escrever
-- as suas).
--
-- Reversão:
--   DROP TRIGGER IF EXISTS trg_robo_processo_remarcado ON public.licitacoes;
--   DROP FUNCTION IF EXISTS public.robo_processo_remarcado_move_disputa();

CREATE OR REPLACE FUNCTION public.robo_processo_remarcado_move_disputa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  antes  timestamptz := date_trunc('minute', COALESCE(OLD.data_abertura, OLD.data_encerramento));
  depois timestamptz := date_trunc('minute', COALESCE(NEW.data_abertura, NEW.data_encerramento));
  d record;
  quando_depois text;
BEGIN
  IF depois IS NOT DISTINCT FROM antes THEN
    RETURN NEW;
  END IF;

  BEGIN
    quando_depois := COALESCE(to_char(depois AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'), 'sem data');

    FOR d IN
      SELECT id, user_id, edital, inicio_sessao
        FROM public.robo_lances_disputas
       WHERE licitacao_id = NEW.id
         AND enviada_em IS NULL
    LOOP
      IF depois IS NOT NULL AND antes IS NOT NULL AND d.inicio_sessao IS NOT NULL
         AND date_trunc('minute', d.inicio_sessao) = antes THEN
        UPDATE public.robo_lances_disputas SET inicio_sessao = depois WHERE id = d.id;
        INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
        VALUES (
          d.user_id, 'alerta',
          '📅 Pregão remarcado — ' || d.edital,
          'A data do processo mudou para ' || quando_depois || ', e a disputa do robô acompanhou: o robô entra 15 minutos antes. Confira no edital.',
          '/robo-lances/disputa/' || d.id
        );
      ELSE
        INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
        VALUES (
          d.user_id, 'alerta',
          '📅 A data do processo mudou — ' || d.edital,
          'O processo agora está ' || CASE WHEN depois IS NULL THEN 'sem data' ELSE 'em ' || quando_depois END ||
          ', mas a disputa do robô continua ' ||
          COALESCE('em ' || to_char(d.inicio_sessao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'), 'sem data') ||
          ' (ajustada à mão ou sem agendamento) e não foi mudada. Confira e ajuste a disputa se for o caso.',
          '/robo-lances/disputa/' || d.id
        );
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'robo_processo_remarcado_move_disputa (processo %): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_robo_processo_remarcado ON public.licitacoes;
CREATE TRIGGER trg_robo_processo_remarcado
  AFTER UPDATE OF data_abertura, data_encerramento ON public.licitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.robo_processo_remarcado_move_disputa();
