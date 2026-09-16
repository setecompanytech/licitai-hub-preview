-- 20260916000004 — disputa remarcada volta para a agenda; contagem de tentativas de envio
--
-- APLICAR ANTES de publicar o robo-lances-webhook que lê `tentativas_envio`.
-- Sem a coluna, o agendador segue funcionando como antes (sem nova tentativa).
--
-- POR QUÊ (16/09/2026). A disputa pode ser cadastrada com meses de
-- antecedência, e pregão é adiado com frequência. O agendador marca
-- `enviada_em` ao despachar e nunca mais olha a disputa. Se o pregão foi
-- remarcado DEPOIS do despacho — o robô entrou, o pregoeiro suspendeu e marcou
-- nova data —, corrigir a data no Praefectus não fazia o robô voltar: a marca
-- de "já enviada" continuava lá.
--
-- O gatilho mora no banco, e não na tela, de propósito: vale para qualquer
-- caminho que mude a data (tela, Lovable, SQL). E só dispara quando a data
-- MUDA DE VERDADE (IS DISTINCT FROM): salvar a disputa sem mexer na data não
-- rearma nada.
--
-- `tentativas_envio` conta quantas vezes o agendador tentou e o robô não
-- respondeu (falha passageira: VPS reiniciando, tempo estourado, erro 5xx). Até
-- 5 tentativas, uma por minuto; remarcar a disputa zera a conta.
--
-- Reversão:
--   DROP TRIGGER IF EXISTS trg_robo_disputa_remarcada ON public.robo_lances_disputas;
--   DROP FUNCTION IF EXISTS public.robo_disputa_remarcada_volta_a_agenda();
--   ALTER TABLE public.robo_lances_disputas DROP COLUMN IF EXISTS tentativas_envio;

ALTER TABLE public.robo_lances_disputas
  ADD COLUMN IF NOT EXISTS tentativas_envio integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.robo_lances_disputas.tentativas_envio IS
  'Quantas vezes o agendador tentou despachar e o robô não respondeu (falha passageira). Zera quando a data da sessão muda.';

CREATE OR REPLACE FUNCTION public.robo_disputa_remarcada_volta_a_agenda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.inicio_sessao IS DISTINCT FROM OLD.inicio_sessao THEN
    NEW.enviada_em := NULL;
    NEW.tentativas_envio := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_robo_disputa_remarcada ON public.robo_lances_disputas;
CREATE TRIGGER trg_robo_disputa_remarcada
  BEFORE UPDATE OF inicio_sessao ON public.robo_lances_disputas
  FOR EACH ROW
  EXECUTE FUNCTION public.robo_disputa_remarcada_volta_a_agenda();
