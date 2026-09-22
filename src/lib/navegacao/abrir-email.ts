/**
 * Entrega um `mailto:` ao programa de e-mail da pessoa.
 *
 * Mora num módulo próprio por um motivo só: a tela que registra a
 * solicitação precisa ser testada sem que o jsdom tente navegar. Trocar a
 * `location` do navegador é o jeito que funciona em todos eles para
 * `mailto:` — a página fica, o cliente de e-mail abre.
 */
export function abrirEmail(mailto: string): void {
  window.location.href = mailto;
}
