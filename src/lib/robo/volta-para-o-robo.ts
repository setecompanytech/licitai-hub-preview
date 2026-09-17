/**
 * A volta para o robô — o atalho que a tela de Configurações do Robô de Lances
 * oferece para quem veio da tela da disputa (17/09/2026, pedido do Ian).
 *
 * O problema observado por ele: a chamada da tela remota leva a pessoa para o
 * admin; lá ela para o robô, confere a sessão — e depois precisa abrir o menu e
 * navegar de novo até o Robô de Lances. Um botão resolve, mas ele não pode
 * mentir: "Voltar para o robô" só faz sentido quando existe um lugar de onde a
 * pessoa veio.
 *
 * Por isso o destino viaja na URL (`?voltar=/robo-lances/disputa/<id>`), e não
 * em estado de componente nem em `localStorage`:
 * - quem chega pela chamada da tela remota traz o parâmetro → "Voltar para o
 *   robô", destacado, apontando para a disputa de onde saiu;
 * - quem abre o admin pelo menu não traz nada → "Ir para o Robô de Lances",
 *   discreto, apontando para a lista;
 * - sair navegando por outro caminho e voltar depois ao admin pelo menu é uma
 *   URL nova, sem o parâmetro: o botão volta sozinho ao estado inicial, que é
 *   exatamente o que o Ian descreveu. O F5 e o voltar do navegador, ao
 *   contrário, continuam na mesma visita e mantêm o atalho.
 *
 * `destinoDaVolta` é a única porta de entrada do parâmetro. Ele vem da barra de
 * endereço, então é texto de fora: só caminho relativo dentro de
 * `/robo-lances` passa. `//outro-site`, `https://…` e `..` são recusados — um
 * "voltar" que sai do app seria um redirecionamento aberto com a nossa cara.
 */
import { LINK_DA_TELA_REMOTA } from './chamada-da-tela-remota';

/** A lista de disputas do cliente — o destino quando não há de onde voltar. */
export const LINK_DO_ROBO = '/robo-lances';

/** O parâmetro que carrega o caminho de volta na URL do admin. */
export const PARAMETRO_DA_VOLTA = 'voltar';

/** A página de uma disputa (a rota é `/robo-lances/disputa/:id`). */
export function caminhoDaDisputa(disputaId: string): string {
  return `${LINK_DO_ROBO}/disputa/${disputaId}`;
}

/** Caminho de volta aceito: relativo, dentro do Robô de Lances do cliente. */
export function destinoDaVolta(bruto: string | null | undefined): string | null {
  const caminho = String(bruto ?? '').trim();
  if (!caminho || caminho.includes('..') || caminho.includes('\\')) return null;
  // `/admin/robo-lances` não casa de propósito: o botão nunca aponta para a
  // própria tela onde ele está.
  return /^\/robo-lances(?:\/[\w\-.~%]+)*\/?$/.test(caminho) ? caminho : null;
}

/** O link do admin do robô, levando de onde a pessoa saiu quando há de onde. */
export function linkDaTelaRemotaDe(origem: string | null | undefined): string {
  const destino = destinoDaVolta(origem);
  if (!destino) return LINK_DA_TELA_REMOTA;
  return `${LINK_DA_TELA_REMOTA}&${PARAMETRO_DA_VOLTA}=${encodeURIComponent(destino)}`;
}

/**
 * De onde a chamada da tela remota tira a volta: a disputa dela (o clique em
 * "Entrar agora" sabe qual é) ou, quando o aviso não diz, a tela do robô em que
 * a pessoa estava. Fora do robô, não há volta a oferecer.
 */
export function origemDaChamada(chamada: { disputaId: string | null }, caminhoAtual: string): string | null {
  if (chamada.disputaId) return caminhoDaDisputa(chamada.disputaId);
  return destinoDaVolta(caminhoAtual);
}

export interface BotaoDaVolta {
  rotulo: string;
  para: string;
  /** Verde e piscando: a pessoa chegou aqui de outra tela e tem para onde voltar. */
  destacado: boolean;
  /** O `title` do botão — diz para onde ele leva antes do clique. */
  descricao: string;
}

/** O que o botão do admin diz e para onde ele leva, conforme a URL da visita. */
export function botaoDaVolta(bruto: string | null | undefined): BotaoDaVolta {
  const destino = destinoDaVolta(bruto);
  if (destino) {
    return {
      rotulo: 'Voltar para o robô',
      para: destino,
      destacado: true,
      descricao: 'Volta para a tela do Robô de Lances de onde você veio',
    };
  }
  return {
    rotulo: 'Ir para o Robô de Lances',
    para: LINK_DO_ROBO,
    destacado: false,
    descricao: 'Abre a lista de disputas do Robô de Lances',
  };
}
