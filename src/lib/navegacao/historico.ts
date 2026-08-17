/**
 * Histórico de navegação DENTRO do aplicativo — autoridade única do "Voltar".
 *
 * O botão do navegador não serve aqui, e as tentativas anteriores mostraram por
 * quê. `navigate(-1)` volta para o que estiver na pilha do navegador: um
 * redirecionamento de login, uma rota que já se auto-substituiu, ou nada — e aí
 * sai do aplicativo. Botões com rota fixa (`navigate('/painel')`) sempre
 * "voltam" para o mesmo lugar, independentemente de onde a pessoa estava; é o
 * que fazia o sistema parecer levar a uma página aleatória.
 *
 * Aqui a pilha é do aplicativo. Três regras que a mantêm honesta:
 *
 *  1. **Rota repetida não empilha.** Trocar `?lid=` da mesma tela não é uma
 *     navegação nova; empilhar faria o Voltar andar em falso.
 *  2. **Voltar despila, não empilha.** Sem isso, A→B→Voltar gravaria A de novo
 *     e o próximo Voltar traria B: o giro em círculos já relatado.
 *  3. **Entrada direta não inventa origem.** Quem abre um link em aba nova não
 *     tem para onde voltar, e o botão simplesmente não aparece.
 *
 * Vive em módulo, não em estado de componente: o layout remonta a cada troca de
 * rota, e um `useState` perderia a pilha exatamente quando ela é necessária.
 */

let pilha: string[] = [];
let voltando = false;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((f) => f());

/** Rotas que são destino final: estar nelas não é ter vindo de algum lugar. */
const RAIZES = new Set(['/painel', '/dashboard', '/']);

export function registrarRota(caminho: string): void {
  if (voltando) { voltando = false; return; }          // regra 2
  if (pilha[pilha.length - 1] === caminho) return;      // regra 1
  // Chegar a uma raiz zera o rastro: dali não se volta para trás.
  pilha = RAIZES.has(caminho) ? [caminho] : [...pilha, caminho];
  avisar();
}

/** Caminho para onde o Voltar leva, ou null quando não há de onde voltar. */
export function destinoDoVoltar(): string | null {
  return pilha.length >= 2 ? pilha[pilha.length - 2] : null;
}

/**
 * Prepara a volta e devolve o destino. Quem chama navega — assim o hook não
 * precisa conhecer o roteador e a lógica continua testável sem React.
 */
export function prepararVolta(): string | null {
  const destino = destinoDoVoltar();
  if (!destino) return null;
  pilha = pilha.slice(0, -1);
  voltando = true;
  avisar();
  return destino;
}

export function subscribeHistorico(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}

/** Só para os testes: a pilha é global de propósito. */
export function _reiniciarHistorico(): void {
  pilha = [];
  voltando = false;
}

export function _pilhaAtual(): string[] {
  return [...pilha];
}
