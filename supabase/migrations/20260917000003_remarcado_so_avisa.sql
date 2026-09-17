-- 20260917000003 — pregão remarcado: a disputa do robô NÃO muda de data sozinha, só avisa
--
-- POR QUÊ (17/09/2026). O Rafael, dono do produto, sobre remarcar pela data:
-- "Tem processos que podem ser cancelados, suspensos, etc pra mudar algo no
-- edital e no TR. Mas acaba sendo um risco pro usuário porque na maioria dos
-- casos, muda tudo, não só a data, mas a quantidade, unidade, descrição."
--
-- O gatilho de 20260916000007 movia a disputa ligada ao processo para a data
-- nova — só a data. Os itens da disputa são uma cópia do cadastro, e o robô
-- entraria na sessão remarcada com os pisos calculados para os itens antigos.
-- Agora ele só avisa, e a pessoa confere na página da disputa ("Conferir
-- alterações da licitação": data, itens, quantidades e unidades, antes de
-- atualizar). Antes de o robô entrar, o webhook também confere e, se a
-- licitação mudou, o robô entra sem dar lance.
--
-- A REGRA, disputa por disputa (as ligadas ao processo e ainda não enviadas):
-- a data da disputa não muda; quem a cadastrou recebe o aviso com a data nova
-- do processo e o link da disputa.
--
-- O gatilho continua o mesmo (`trg_robo_processo_remarcado`); muda só a função.
-- Falha aqui vira WARNING e o processo é salvo normalmente, como antes.
--
-- Reversão: aplicar de novo a função de 20260916000007 (move a data).

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
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
      VALUES (
        d.user_id, 'alerta',
        '📅 Pregão remarcado — ' || d.edital,
        'A data do processo mudou para ' || quando_depois || '. A disputa do robô NÃO foi movida: '
          || 'pregão remarcado costuma voltar com itens, quantidades e unidades diferentes. '
          || 'Na página da disputa, use Ações › Conferir alterações da licitação antes de o robô entrar '
          || '(a disputa continua ' ||
          COALESCE('em ' || to_char(d.inicio_sessao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'), 'sem data') || ').',
        '/robo-lances/disputa/' || d.id
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'robo_processo_remarcado_move_disputa (processo %): %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Conferência: a função no ar é a que só avisa (true).
SELECT position('NÃO foi movida' IN prosrc) > 0 AS so_avisa
  FROM pg_proc
 WHERE proname = 'robo_processo_remarcado_move_disputa';
