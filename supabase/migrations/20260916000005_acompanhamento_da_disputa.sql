-- 20260916000005 — acompanhamento da disputa sem a tela remota (D13)
--
-- APLICAR ANTES de publicar o robo-lances-webhook que grava `estado_sala` e
-- `robo_eventos_sessao`, e antes de instalar o agente que envia o callback
-- `estado-da-sala`.
--
-- POR QUÊ (16/09/2026). A cada rodada o robô lê o melhor lance, a posição da
-- empresa, se ela lidera, o modo de disputa e decide o que fazer — e nada disso
-- chegava ao Praefectus. A página da disputa (feita em 14/09) já tem as colunas
-- "Seu último lance", "Melhor lance" e "Situação" e a aba de eventos, e elas
-- ficavam "não informado". O cliente pediu acompanhar a disputa pela tela do
-- sistema, com a tela remota só para auditoria e captcha.
--
--   1. `sessoes_lance_real.estado_sala` — o ÚLTIMO estado lido da sala, para o
--      quadro de status do Acompanhamento. Sobrescrito a cada envio; o
--      histórico é a tabela abaixo.
--   2. `robo_eventos_sessao` — a linha do tempo: só o que importa (entrou,
--      assumiu ou perdeu a liderança, lance enviado ou recusado, aguardando
--      com motivo novo, encerrou). Separada de `lances_historico` de propósito:
--      lá `valor` é obrigatório e a tela conta as linhas como lances.
--
-- Escrita só pelo servidor (webhook, service role): não há policy de INSERT
-- nem de UPDATE para usuário. Leitura igual à dos itens da sessão.
--
-- Reversão:
--   DROP TABLE IF EXISTS public.robo_eventos_sessao;
--   ALTER TABLE public.sessoes_lance_real DROP COLUMN IF EXISTS estado_sala,
--     DROP COLUMN IF EXISTS estado_sala_em;

ALTER TABLE public.sessoes_lance_real
  ADD COLUMN IF NOT EXISTS estado_sala jsonb,
  ADD COLUMN IF NOT EXISTS estado_sala_em timestamptz;

COMMENT ON COLUMN public.sessoes_lance_real.estado_sala IS
  'Último estado da sala enviado pelo robô: item, melhor lance, nosso lance, posição, liderança, modo, fase e a decisão da rodada com o motivo.';

CREATE TABLE IF NOT EXISTS public.robo_eventos_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.sessoes_lance_real(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- Nullable como em `sessao_lance_itens`: a sessão pode não ter empresa.
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  item integer,
  mensagem text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.robo_eventos_sessao IS
  'Linha do tempo do robô numa sessão: entrou, liderança, lance enviado ou recusado, aguardando com motivo, encerrou. Escrita pelo webhook.';

CREATE INDEX IF NOT EXISTS idx_robo_eventos_sessao_sessao
  ON public.robo_eventos_sessao (sessao_id, created_at DESC);

ALTER TABLE public.robo_eventos_sessao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS robo_eventos_sessao_select ON public.robo_eventos_sessao;
CREATE POLICY robo_eventos_sessao_select ON public.robo_eventos_sessao
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id)));

DROP POLICY IF EXISTS robo_eventos_sessao_delete ON public.robo_eventos_sessao;
CREATE POLICY robo_eventos_sessao_delete ON public.robo_eventos_sessao
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR (empresa_id IS NOT NULL AND public.is_empresa_admin(auth.uid(), empresa_id)));

NOTIFY pgrst, 'reload schema';
