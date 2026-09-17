-- 20260917000004 — histórico do robô no admin, e o sininho do robô só com as últimas 24 horas
--
-- POR QUÊ (17/09/2026, pedido do Ian). Os avisos do robô no sininho acumulavam
-- sem prazo, e o que o robô fez só era rastreável conta por conta: o aviso mora
-- na conta de quem o recebeu, e a linha do tempo das sessões só a empresa dona
-- lê. Decisões do Ian:
--   - o sininho guarda o aviso do robô por 24 horas, e depois APAGA (não só
--     esconde);
--   - tudo fica no histórico do robô, em Admin › Configurações do Robô de
--     Lances, para alguém verificar depois;
--   - o histórico guarda 12 meses.
--
-- A TABELA É DA PLATAFORMA. Diferente da regra geral (tabela nova com leitura
-- por membro da empresa), só o admin da PLATAFORMA (`user_roles.role = 'admin'`)
-- lê: o histórico junta avisos que só a equipe recebe — o pedido de captcha
-- traz o endereço da tela remota, que é compartilhada entre todas as empresas e
-- não pode chegar a cliente. `empresa_id` existe para filtrar, não para dar
-- acesso. Ninguém escreve nem apaga pela API: só os gatilhos abaixo gravam, e
-- só a rotina de 12 meses apaga.
--
-- COMO ENCHE. Dois gatilhos copiam no momento em que nascem, venha de onde vier
-- (webhook, lembretes, gatilho de pregão remarcado):
--   - `notificacoes` com link do robô (/robo-lances… ou /admin/robo-lances…,
--     a mesma régua de `ehAvisoDoRobo` no front) → origem 'aviso'. O mesmo aviso
--     para várias pessoas no mesmo minuto vira UMA linha, com `destinatarios`;
--   - `robo_eventos_sessao` (entrou, lance enviado/recusado, encerrou…) →
--     origem 'evento'.
-- Falha ao copiar vira WARNING: um histórico nunca impede o aviso de chegar.
-- A carga inicial traz o que já existe nas duas tabelas.
--
-- A ROTINA (`robo-limpeza-sininho-e-historico`, de hora em hora). Comportamento
-- de produto, não rotina temporária (princípio 5): vive enquanto existir o
-- sininho do robô. Apaga do sininho só o aviso do robô com mais de 24 horas QUE
-- JÁ ESTÁ NO HISTÓRICO — se a cópia tiver falhado, o aviso fica. Apaga do
-- histórico o que passou de 12 meses.
--
-- Reversão:
--   SELECT cron.unschedule('robo-limpeza-sininho-e-historico');
--   DROP TRIGGER IF EXISTS trg_robo_historico_do_aviso ON public.notificacoes;
--   DROP TRIGGER IF EXISTS trg_robo_historico_do_evento ON public.robo_eventos_sessao;
--   DROP FUNCTION IF EXISTS public.robo_historico_do_aviso();
--   DROP FUNCTION IF EXISTS public.robo_historico_do_evento();
--   DROP FUNCTION IF EXISTS public.robo_historico_chave_do_aviso(text, text, text, timestamptz);
--   DROP TABLE IF EXISTS public.robo_historico;
-- (os avisos já apagados do sininho continuam no histórico até o DROP)

CREATE TABLE IF NOT EXISTS public.robo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL CHECK (origem IN ('aviso', 'evento')),
  tipo text,
  titulo text NOT NULL,
  mensagem text,
  link text,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  -- Sem chave estrangeira de propósito: a disputa ou a sessão podem ser
  -- apagadas, e o histórico do que o robô fez nelas continua.
  disputa_id uuid,
  sessao_id uuid,
  edital text,
  portal text,
  destinatarios integer NOT NULL DEFAULT 1,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  chave text NOT NULL UNIQUE,
  ocorreu_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.robo_historico IS
  'Histórico do robô para a plataforma: avisos do sininho (origem aviso) e linha do tempo das sessões (origem evento). Gravado por gatilho; lido só por admin da plataforma; guarda 12 meses.';

CREATE INDEX IF NOT EXISTS idx_robo_historico_ocorreu ON public.robo_historico (ocorreu_em DESC);
CREATE INDEX IF NOT EXISTS idx_robo_historico_empresa ON public.robo_historico (empresa_id, ocorreu_em DESC);
CREATE INDEX IF NOT EXISTS idx_robo_historico_disputa ON public.robo_historico (disputa_id);

ALTER TABLE public.robo_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plataforma lê o histórico do robô" ON public.robo_historico;
CREATE POLICY "Plataforma lê o histórico do robô"
ON public.robo_historico FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- A mesma chave no gatilho, na carga inicial e na rotina que apaga do sininho.
CREATE OR REPLACE FUNCTION public.robo_historico_chave_do_aviso(p_titulo text, p_mensagem text, p_link text, p_criado timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'aviso:' || md5(
    coalesce(p_titulo, '') || '|' || coalesce(p_mensagem, '') || '|' || coalesce(p_link, '') || '|' ||
    to_char(date_trunc('minute', p_criado AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI')
  );
$$;

CREATE OR REPLACE FUNCTION public.robo_historico_do_aviso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disputa uuid;
  v_empresa uuid;
  v_edital text;
  v_portal text;
BEGIN
  BEGIN
    v_disputa := substring(NEW.link FROM '^/robo-lances/disputa/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')::uuid;
    IF v_disputa IS NOT NULL THEN
      SELECT empresa_id, edital, portal INTO v_empresa, v_edital, v_portal
        FROM public.robo_lances_disputas WHERE id = v_disputa;
    END IF;

    INSERT INTO public.robo_historico (origem, tipo, titulo, mensagem, link, empresa_id, disputa_id, edital, portal, chave, ocorreu_em)
    VALUES (
      'aviso', NEW.tipo, NEW.titulo, NEW.mensagem, NEW.link, v_empresa, v_disputa, v_edital, v_portal,
      public.robo_historico_chave_do_aviso(NEW.titulo, NEW.mensagem, NEW.link, NEW.created_at),
      NEW.created_at
    )
    ON CONFLICT (chave) DO UPDATE SET destinatarios = public.robo_historico.destinatarios + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'robo_historico_do_aviso (notificação %): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_robo_historico_do_aviso ON public.notificacoes;
CREATE TRIGGER trg_robo_historico_do_aviso
  AFTER INSERT ON public.notificacoes
  FOR EACH ROW
  WHEN (NEW.link LIKE '/robo-lances%' OR NEW.link LIKE '/admin/robo-lances%')
  EXECUTE FUNCTION public.robo_historico_do_aviso();

CREATE OR REPLACE FUNCTION public.robo_historico_do_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config text;
  v_disputa uuid;
  v_edital text;
  v_portal text;
BEGIN
  BEGIN
    SELECT lance_config_id, edital, portal_nome INTO v_config, v_edital, v_portal
      FROM public.sessoes_lance_real WHERE id = NEW.sessao_id;
    IF v_config ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      v_disputa := v_config::uuid;
    END IF;

    INSERT INTO public.robo_historico (origem, tipo, titulo, mensagem, link, empresa_id, disputa_id, sessao_id, edital, portal, dados, chave, ocorreu_em)
    VALUES (
      'evento', NEW.tipo, initcap(replace(NEW.tipo, '-', ' ')), NEW.mensagem,
      CASE WHEN v_disputa IS NOT NULL THEN '/robo-lances/disputa/' || v_disputa END,
      NEW.empresa_id, v_disputa, NEW.sessao_id, v_edital, v_portal,
      coalesce(NEW.dados, '{}'::jsonb) || jsonb_build_object('item', NEW.item),
      'evento:' || NEW.id, NEW.created_at
    )
    ON CONFLICT (chave) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'robo_historico_do_evento (evento %): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_robo_historico_do_evento ON public.robo_eventos_sessao;
CREATE TRIGGER trg_robo_historico_do_evento
  AFTER INSERT ON public.robo_eventos_sessao
  FOR EACH ROW
  EXECUTE FUNCTION public.robo_historico_do_evento();

-- Carga inicial: os avisos do robô que ainda estão no sininho…
WITH avisos AS (
  SELECT n.tipo, n.titulo, n.mensagem, n.link, n.created_at,
         public.robo_historico_chave_do_aviso(n.titulo, n.mensagem, n.link, n.created_at) AS chave,
         substring(n.link FROM '^/robo-lances/disputa/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') AS disputa_txt
    FROM public.notificacoes n
   WHERE n.link LIKE '/robo-lances%' OR n.link LIKE '/admin/robo-lances%'
), agrupados AS (
  SELECT chave,
         (array_agg(tipo))[1] AS tipo,
         (array_agg(titulo))[1] AS titulo,
         (array_agg(mensagem))[1] AS mensagem,
         (array_agg(link))[1] AS link,
         (array_agg(disputa_txt))[1] AS disputa_txt,
         min(created_at) AS ocorreu_em,
         count(*)::integer AS destinatarios
    FROM avisos
   GROUP BY chave
)
INSERT INTO public.robo_historico (origem, tipo, titulo, mensagem, link, empresa_id, disputa_id, edital, portal, destinatarios, chave, ocorreu_em)
SELECT 'aviso', a.tipo, a.titulo, a.mensagem, a.link, d.empresa_id, a.disputa_txt::uuid, d.edital, d.portal,
       a.destinatarios, a.chave, a.ocorreu_em
  FROM agrupados a
  LEFT JOIN public.robo_lances_disputas d ON d.id = a.disputa_txt::uuid
ON CONFLICT (chave) DO NOTHING;

-- …e a linha do tempo das sessões.
INSERT INTO public.robo_historico (origem, tipo, titulo, mensagem, link, empresa_id, disputa_id, sessao_id, edital, portal, dados, chave, ocorreu_em)
SELECT 'evento', e.tipo, initcap(replace(e.tipo, '-', ' ')), e.mensagem,
       CASE WHEN s.lance_config_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN '/robo-lances/disputa/' || s.lance_config_id END,
       e.empresa_id,
       CASE WHEN s.lance_config_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN s.lance_config_id::uuid END,
       e.sessao_id, s.edital, s.portal_nome,
       coalesce(e.dados, '{}'::jsonb) || jsonb_build_object('item', e.item),
       'evento:' || e.id, e.created_at
  FROM public.robo_eventos_sessao e
  LEFT JOIN public.sessoes_lance_real s ON s.id = e.sessao_id
ON CONFLICT (chave) DO NOTHING;

-- A rotina: sininho do robô com 24 horas, histórico com 12 meses. Idempotente.
SELECT cron.unschedule('robo-limpeza-sininho-e-historico')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'robo-limpeza-sininho-e-historico');

SELECT cron.schedule(
  'robo-limpeza-sininho-e-historico',
  '23 * * * *',
  $$
  DELETE FROM public.notificacoes n
   WHERE (n.link LIKE '/robo-lances%' OR n.link LIKE '/admin/robo-lances%')
     AND n.created_at < now() - interval '24 hours'
     AND EXISTS (
       SELECT 1 FROM public.robo_historico h
        WHERE h.chave = public.robo_historico_chave_do_aviso(n.titulo, n.mensagem, n.link, n.created_at)
     );
  DELETE FROM public.robo_historico WHERE ocorreu_em < now() - interval '12 months';
  $$
);

NOTIFY pgrst, 'reload schema';

-- Conferência (uma linha): quantos avisos e eventos entraram na carga, e a rotina ativa.
SELECT
  (SELECT count(*) FROM public.robo_historico WHERE origem = 'aviso') AS avisos_no_historico,
  (SELECT count(*) FROM public.robo_historico WHERE origem = 'evento') AS eventos_no_historico,
  (SELECT count(*) FROM public.notificacoes
    WHERE (link LIKE '/robo-lances%' OR link LIKE '/admin/robo-lances%')
      AND created_at < now() - interval '24 hours') AS avisos_do_robo_a_apagar_do_sininho,
  (SELECT count(*) FROM cron.job WHERE jobname = 'robo-limpeza-sininho-e-historico' AND active) AS rotina_ativa;
