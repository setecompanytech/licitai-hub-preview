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

/**
 * O que o robô achou ao comparar os itens que recebeu com os que o portal
 * publicou no processo.
 *
 * `leu: false` é estado próprio e importa: significa "não consegui ler a lista
 * do portal", que é diferente de "os itens não existem". Sem essa distinção a
 * tela acusaria o cadastro do usuário por uma falha nossa de leitura.
 */
export type ConferenciaDeItens = {
  leu: boolean;
  /** `null` quando não houve leitura — nada a afirmar. */
  ok: boolean | null;
  resumo: string;
  /** Números dos itens que enviamos e o portal não lista. */
  faltando: number[];
  /** Quantos itens do edital ficaram de fora. Não é erro — é escolha. */
  sobrando_qtd: number;
  divergencias: Array<{ numero: number; nosso: number; portal: number }>;
};

/** Uma sessão que o agente diz estar de pé AGORA. */
export type SessaoViva = {
  sessao_id: string;
  status: string;
  portal_id: string;
  edital: string;
  /** Null enquanto o robô ainda não conferiu, ou em portal que não sabe ler. */
  conferencia?: ConferenciaDeItens | null;
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


/**
 * Interrompe UMA sessão do robô.
 *
 * Mora aqui, e não dentro de um componente, porque dois lugares precisam dela:
 * a lista de sessões e o painel do VNC — quem está vendo o robô agir é
 * justamente quem vai querer pará-lo.
 *
 * Diferente do freio de emergência, que encerra todas as sessões de uma vez.
 *
 * @returns `parou` false não é erro: o agente pode já ter encerrado sozinho. A
 *          linha do banco é atualizada de qualquer forma, para a lista não
 *          continuar dizendo "em operação" para algo que acabou.
 */
export async function pararSessaoDoRobo(sessaoId: string): Promise<{
  parou: boolean;
  erro?: string;
}> {
  const { data, error } = await supabase.functions.invoke('robo-lances-webhook', {
    body: { action: 'parar-sessao', sessao_id: sessaoId },
  });

  if (error) {
    // O corpo do erro vem em `context`, não em `message` — sem isto a pessoa
    // recebe "non-2xx status code" no lugar da causa.
    let detalhe = error.message;
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.error) detalhe = corpo.error;
    } catch {
      /* fica a mensagem original */
    }
    return { parou: false, erro: detalhe };
  }

  return { parou: (data as { parou?: boolean })?.parou === true };
}


/**
 * Traz para a frente, na tela do servidor, a janela DAQUELE pregão.
 *
 * O agente aguenta 8 sessões simultâneas e todas desenham na mesma tela
 * virtual. Sem isto, com dois pregões no mesmo horário o VNC mostra as janelas
 * empilhadas e não há como pedir para ver o outro.
 *
 * Mora aqui junto de `pararSessaoDoRobo` porque é a mesma família: as duas
 * agem sobre UMA sessão escolhida, e quem observa é quem usa as duas.
 *
 * @returns `focou` false não derruba nada — a sessão segue rodando, só não foi
 *          para a frente. `erro` costuma ser agente sem a rota (VPS
 *          desatualizada) ou janela já fechada.
 */
export async function focarSessaoDoRobo(sessaoId: string): Promise<{
  focou: boolean;
  erro?: string;
}> {
  const { data, error } = await supabase.functions.invoke('robo-lances-webhook', {
    body: { action: 'focar-sessao', sessao_id: sessaoId },
  });

  if (error) {
    // O corpo do erro vem em `context`, não em `message` — mesmo cuidado do
    // freio, senão a pessoa recebe "non-2xx status code" no lugar da causa.
    let detalhe = error.message;
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.error) detalhe = corpo.error;
    } catch {
      /* fica a mensagem original */
    }
    return { focou: false, erro: detalhe };
  }

  const corpo = data as { focou?: boolean; error?: string } | null;
  return { focou: corpo?.focou === true, erro: corpo?.error };
}
