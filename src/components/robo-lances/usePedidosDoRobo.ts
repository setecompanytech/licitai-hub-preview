import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * O que o robô está esperando de uma pessoa, e como os últimos pedidos
 * terminaram.
 *
 * Fica num hook porque DUAS telas precisam da mesma resposta: o cartão que
 * recebe o código, e o painel do VNC — que só sabe dizer "clique aqui, o clique
 * funciona" quando há um pedido de verdade em aberto.
 *
 * Chave única no react-query de propósito: as duas telas compartilham a mesma
 * requisição em vez de perguntarem separado a cada 3 segundos.
 */

export type PedidoDoRobo = {
  sessao_id: string;
  tipo: string;
  mensagem: string;
  tela: string | null;
  criado_em: string;
  /** Até quando o robô espera. Null quando o agente não informa. */
  expira_em: string | null;
};

export type DesfechoDoRobo = {
  sessao_id: string;
  tipo: string;
  /** 'atendido' quando alguém respondeu a tempo; 'expirado' quando não. */
  desfecho: string;
  em: string;
};

/** Uma sessão que o agente diz estar de pé AGORA. */
export type SessaoViva = {
  sessao_id: string;
  status: string;
  portal_id: string;
  edital: string;
};

type Saude = {
  agentes?: Array<{
    aguardando_humano?: PedidoDoRobo[] | null;
    desfechos_humano?: DesfechoDoRobo[] | null;
    sessoes?: SessaoViva[] | null;
  }>;
};

export function usePedidosDoRobo() {
  return useQuery({
    queryKey: ['pedidos-do-robo'],
    // Curto de propósito: um código de verificação vale segundos, e saber dele
    // com 20s de atraso é o mesmo que não saber.
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('robo-lances-webhook/healthcheck', {
        body: {},
      });
      const agentes = (data as Saude | null)?.agentes || [];
      return {
        pedidos: agentes.flatMap((a) => a.aguardando_humano || []),
        desfechos: agentes.flatMap((a) => a.desfechos_humano || []),
        // Só o que está DE PÉ. O /health devolve o histórico recente da
        // memória do agente junto, e contar as encerradas ofereceria freio
        // para o que já parou — que treina a pessoa a ignorar o botão
        // vermelho, o oposto do que ele existe para fazer.
        sessoesVivas: agentes
          .flatMap((a) => a.sessoes || [])
          .filter((s) => s.status === 'ativo' || s.status === 'enviando'),
      };
    },
  });
}
