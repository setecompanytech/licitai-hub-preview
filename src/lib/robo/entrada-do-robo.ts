/**
 * O que a página da disputa diz enquanto o robô entra (17/09/2026).
 *
 * Pedido do Ian depois de testar: ao mandar o robô entrar, a tela "não tem
 * muita reação e deixa o usuário ocioso". Entre o clique e o primeiro retrato
 * da sala passam de 10 segundos a um minuto (login com a sessão guardada,
 * pesquisa, abrir a compra), e nada na página mudava além de um selo.
 *
 * Só estados reais, lidos da sessão — nada de barra de progresso inventada:
 * enviando o pedido, entrando no portal (com o tempo correndo), esperando o
 * clique no captcha, e "acabou de entrar" na primeira leitura.
 */
import type { EstadoDoRobo } from './situacao-da-participacao';

export type FaixaDaEntrada = {
  tom: 'andamento' | 'atencao' | 'na-sala';
  titulo: string;
  detalhe: string;
  /** Mostra o atalho para a aba Acompanhamento. */
  verAcompanhamento: boolean;
} | null;

/** Depois disto a entrada é mais demorada que o normal (login reaproveitado: 10 a 60 s nas provas de 16 e 17/09). */
export const SEGUNDOS_DE_ENTRADA_DEMORADA = 120;
/** Por quanto tempo depois de entrar a faixa diz "acabou de entrar". */
export const SEGUNDOS_DE_RECEM_CHEGADO = 90;

export function segundosDesde(iso: string | null | undefined, agora: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.round((agora.getTime() - t) / 1000));
}

export function tempoCorrido(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const min = Math.floor(segundos / 60);
  const s = segundos % 60;
  return s ? `${min} min ${s} s` : `${min} min`;
}

export function faixaDaEntrada(e: {
  estado: EstadoDoRobo;
  /** O pedido "Entrar agora" ainda está indo ao servidor. */
  enviando: boolean;
  sessaoCriadaEm: string | null;
  esperandoPessoa: boolean;
  portal: string;
  agora: Date;
}): FaixaDaEntrada {
  if (e.enviando) {
    return {
      tom: 'andamento',
      titulo: 'Enviando ao robô…',
      detalhe: 'O servidor do robô está recebendo a disputa.',
      verAcompanhamento: false,
    };
  }
  if (e.estado === 'enviando') {
    if (e.esperandoPessoa) {
      return {
        tom: 'atencao',
        titulo: 'O robô está esperando o clique no captcha do gov.br',
        detalhe: 'A equipe Praefectus foi avisada para clicar na tela remota. Sem o clique, a entrada expira em alguns minutos.',
        verAcompanhamento: false,
      };
    }
    const corrido = segundosDesde(e.sessaoCriadaEm, e.agora);
    const tempo = corrido === null ? '' : ` · há ${tempoCorrido(corrido)}`;
    if (corrido !== null && corrido >= SEGUNDOS_DE_ENTRADA_DEMORADA) {
      return {
        tom: 'atencao',
        titulo: `Ainda entrando no ${e.portal}${tempo}`,
        detalhe: 'Está mais demorado que o normal. Se passar de 5 minutos, confira os avisos ou pare e mande entrar de novo.',
        verAcompanhamento: false,
      };
    }
    return {
      tom: 'andamento',
      titulo: `Ligando o robô${tempo}`,
      detalhe: `Abrindo o navegador, entrando com a conta da empresa e procurando a compra no ${e.portal}. Costuma levar menos de um minuto.`,
      verAcompanhamento: false,
    };
  }
  if (e.estado === 'operando') {
    const desdeQueEntrou = segundosDesde(e.sessaoCriadaEm, e.agora);
    if (desdeQueEntrou !== null && desdeQueEntrou <= SEGUNDOS_DE_RECEM_CHEGADO) {
      return {
        tom: 'na-sala',
        titulo: 'Robô na sala',
        detalhe: 'Lendo itens, posição e lances. O retrato da sala e a linha do tempo aparecem em Acompanhamento.',
        verAcompanhamento: true,
      };
    }
  }
  return null;
}
