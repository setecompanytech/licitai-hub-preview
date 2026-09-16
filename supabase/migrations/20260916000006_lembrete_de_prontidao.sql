-- 20260916000006 — lembrete de prontidão da disputa agendada (véspera e 1 hora antes)
--
-- APLICAR ANTES de publicar o robo-lances-webhook com os lembretes. Sem as
-- colunas, o agendador segue despachando normalmente e só não lembra ninguém.
--
-- POR QUÊ (Fase 8, 16/09/2026). A disputa pode ser cadastrada com meses de
-- antecedência, e nada lembrava ninguém de que o robô ia entrar num pregão —
-- nem conferia, antes da hora, o que faria o robô não entrar (robô da empresa
-- desligado, credencial ausente, sessão do gov.br vencida) ou entrar sem
-- disputar (item sem piso). O agendador passa a mandar dois lembretes, cada
-- um uma vez: na véspera (24 horas antes) e 1 hora antes. Estas colunas são a
-- marca de "já lembrei".
--
-- Disputa remarcada volta a ser lembrada: o gatilho da migration
-- 20260916000004 passa a zerar também as duas marcas quando a data muda.
--
-- Reversão:
--   ALTER TABLE public.robo_lances_disputas DROP COLUMN IF EXISTS lembrete_vespera_em, DROP COLUMN IF EXISTS lembrete_1h_em;
--   (e recriar a função abaixo sem as duas linhas dos lembretes)

ALTER TABLE public.robo_lances_disputas
  ADD COLUMN IF NOT EXISTS lembrete_vespera_em timestamptz,
  ADD COLUMN IF NOT EXISTS lembrete_1h_em timestamptz;

COMMENT ON COLUMN public.robo_lances_disputas.lembrete_vespera_em IS
  'Quando saiu o lembrete de prontidão da véspera (24 h antes da sessão). Zera quando a data da sessão muda.';
COMMENT ON COLUMN public.robo_lances_disputas.lembrete_1h_em IS
  'Quando saiu o lembrete de prontidão de 1 hora antes da sessão. Zera quando a data da sessão muda.';

CREATE OR REPLACE FUNCTION public.robo_disputa_remarcada_volta_a_agenda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.inicio_sessao IS DISTINCT FROM OLD.inicio_sessao THEN
    NEW.enviada_em := NULL;
    NEW.tentativas_envio := 0;
    NEW.lembrete_vespera_em := NULL;
    NEW.lembrete_1h_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
