/**
 * Histórico de navegação DENTRO do aplicativo — modelo do explorador de arquivos.
 *
 * A primeira versão tratava "voltar" como DESEMPILHAR: o passo era destruído ao
 * voltar. Nenhum sistema operacional faz isso, e é por isso que o Windows
 * Explorer tem *avançar* e nunca gira em círculos. Sem cursor, voltar apaga o
 * caminho, a chegada regrava, e o pêndulo nasce sozinho — foi o que aconteceu
 * aqui três vezes seguidas, com causas diferentes e a mesma raiz.
 *
 * Agora o modelo é o mesmo do Explorer: uma LISTA de rotas visitadas e um
 * CURSOR apontando onde a pessoa está.
 *
 *   entradas:  /kanban → /processo/28 → /precificacao
 *   cursor:                  ▲
 *
 *   voltar   → cursor anda para a esquerda (o que fica à direita vira avançar)
 *   avançar  → cursor anda para a direita
 *   navegar  → descarta o que estava à direita do cursor e acrescenta ao fim
 *
 * O último ponto é o que separa caminhos sem misturá-los: abrir uma pasta nova
 * depois de ter voltado apaga o ramo antigo, exatamente como o explorador faz.
 *
 * Duas regras que o sistema operacional não precisa e este aplicativo sim:
 *
 *  - **Rota repetida não entra.** O `?lid=` é reescrito pelo próprio sistema
 *    logo depois que a tela carrega; sem ignorar isso, cada navegação viraria
 *    dois passos e voltar levaria à MESMA tela.
 *  - **Parâmetro de contexto fica fora da identidade.** `lid` diz qual processo
 *    está ativo, não qual página é — e ele é recolocado no destino pelo
 *    ProcessoAtivoContext.
 *
 * Vive em módulo, não em estado de componente: o layout remonta a cada troca de
 * rota, e um `useState` perderia a lista exatamente quando ela é necessária.
 */

let entradas: string[] = [];
let cursor = -1;
/** Marca a navegação disparada pelos próprios botões, para não virar entrada nova. */
let emTransito = false;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((f) => f());

/**
 * Parâmetros que são CONTEXTO, não página — ficam fora da identidade da rota.
 * `lid` é o processo ativo, reescrito na URL depois que a tela carrega.
 */
const PARAMETROS_DE_CONTEXTO = ['lid'];

export function chaveDaRota(caminho: string): string {
  const [base, busca] = caminho.split('?');
  if (!busca) return base;
  const p = new URLSearchParams(busca);
  PARAMETROS_DE_CONTEXTO.forEach((k) => p.delete(k));
  const resto = p.toString();
  return resto ? `${base}?${resto}` : base;
}

/** Chegada a uma rota. Só vira entrada nova quando a pessoa de fato navegou. */
export function registrarRota(caminhoCru: string): void {
  const caminho = chaveDaRota(caminhoCru);

  // Chegada provocada pelos botões: o cursor já foi movido por quem chamou.
  if (emTransito) { emTransito = false; return; }

  // Mesma tela (reescrita do `?lid=`, por exemplo): não é navegação.
  if (entradas[cursor] === caminho) return;

  // Navegar descarta o ramo à frente — é o que impede caminhos de se misturarem
  // quando a pessoa volta e toma outro rumo.
  entradas = [...entradas.slice(0, cursor + 1), caminho];
  cursor = entradas.length - 1;
  avisar();
}

export const podeVoltar = (): boolean => cursor > 0;
export const podeAvancar = (): boolean => cursor >= 0 && cursor < entradas.length - 1;

/** Caminho à esquerda do cursor, sem mover nada. */
export const destinoDoVoltar = (): string | null =>
  podeVoltar() ? entradas[cursor - 1] : null;

/** Caminho à direita do cursor, sem mover nada. */
export const destinoDoAvancar = (): string | null =>
  podeAvancar() ? entradas[cursor + 1] : null;

/** Move o cursor para trás e devolve o destino. Quem chama navega. */
export function voltar(): string | null {
  if (!podeVoltar()) return null;
  cursor -= 1;
  emTransito = true;
  avisar();
  return entradas[cursor];
}

/** Move o cursor para frente e devolve o destino. Quem chama navega. */
export function avancar(): string | null {
  if (!podeAvancar()) return null;
  cursor += 1;
  emTransito = true;
  avisar();
  return entradas[cursor];
}

export function subscribeHistorico(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}

/** Só para os testes: a lista é global de propósito. */
export function _reiniciarHistorico(): void {
  entradas = [];
  cursor = -1;
  emTransito = false;
}

export function _estadoAtual(): { entradas: string[]; cursor: number } {
  return { entradas: [...entradas], cursor };
}
