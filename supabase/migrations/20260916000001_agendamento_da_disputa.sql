-- 20260916000001 — a disputa ganha data, e não só hora
--
-- Reversão:
--   DROP INDEX IF EXISTS public.idx_robo_lances_disputas_agendadas;
--   ALTER TABLE public.robo_lances_disputas DROP COLUMN IF EXISTS enviada_em;
--   ALTER TABLE public.robo_lances_disputas DROP COLUMN IF EXISTS inicio_sessao;
--
-- A disputa guarda `horario text` ("09:00") e mais nada. "09:00" de que dia?
-- Sem a data não existe agendamento possível, e o robô só entra na sala por
-- clique de alguém — que foi exatamente o que faltou em 14/09 às 20:07.
--
-- `horario` continua onde está, e continua sendo o que a tela mostra: apagá-lo
-- quebraria as disputas já cadastradas e as telas que o leem. Quem manda no
-- agendamento é `inicio_sessao`; sem ele preenchido, a disputa segue esperando
-- o clique, que é o comportamento de hoje (princípio 7: registro existente
-- herda o valor que reproduz o comportamento atual).
--
-- `enviada_em` existe para o agendador não disparar duas vezes a mesma
-- disputa. O job roda a cada minuto e a janela é de minutos: sem esta marca,
-- a mesma disputa viraria várias sessões no portal — com o mesmo CPF e o
-- mesmo certificado, uma derrubando a outra.

ALTER TABLE public.robo_lances_disputas
  ADD COLUMN IF NOT EXISTS inicio_sessao timestamptz;

ALTER TABLE public.robo_lances_disputas
  ADD COLUMN IF NOT EXISTS enviada_em timestamptz;

COMMENT ON COLUMN public.robo_lances_disputas.inicio_sessao IS
  'Data e hora da sessão pública, com fuso. É o que o agendador lê para '
  'mandar o robô entrar sozinho. Nulo = disputa sem agendamento, enviada por '
  'clique, como antes de 16/09/2026.';

COMMENT ON COLUMN public.robo_lances_disputas.enviada_em IS
  'Quando o agendador despachou esta disputa ao robô. Existe para o job de '
  'um minuto não despachar a mesma disputa duas vezes. Nulo = ainda não foi '
  'despachada automaticamente.';

-- O índice atende exatamente a pergunta do job ("o que começa agora e ainda
-- não foi despachado?"), e o WHERE mantém fora dele tudo o que já rodou.
CREATE INDEX IF NOT EXISTS idx_robo_lances_disputas_agendadas
  ON public.robo_lances_disputas (inicio_sessao)
  WHERE enviada_em IS NULL;

-- Sem política nova: as colunas entram numa tabela que já tem RLS por empresa
-- (migration 20260816000001), e quem lê e escreve continua sendo o mesmo.
