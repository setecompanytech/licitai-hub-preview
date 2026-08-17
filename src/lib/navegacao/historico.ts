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
 * Aqui a pilha é do aplicativo. Cinco regras que a mantêm honesta:
 *
 *  1. **Rota repetida não empilha.** Trocar `?lid=` da mesma tela não é uma
 *     navegação nova; empilhar faria o Voltar andar em falso.
 *  2. **Voltar despila, não empilha.** Sem isso, A→B→Voltar gravaria A de novo
 *     e o próximo Voltar traria B: o giro em círculos já relatado.
 *  3. **Entrada direta não inventa origem.** Quem abre um link em aba nova não
 *     tem para onde voltar, e o botão simplesmente não aparece.
 *  4. **Rota já visitada trunca a pilha.** Chegar de novo a uma tela do próprio
 *     percurso é retorno, não avanço — vale mesmo quando quem navegou foi um
 *     botão da tela, e não o Voltar.
 *  5. **Parâmetro de contexto não conta.** `?lid=` identifica o processo ativo,
 *     não a página, e o sistema o reescreve na URL sozinho. Contá-lo fazia cada
 *     navegação virar dois passos, e o Voltar ir para a MESMA tela.
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

/**
 * Parâmetros que são CONTEXTO, não página. Ficam de fora da identidade da rota.
 *
 * `lid` é o processo ativo, e o sistema o reescreve na URL logo depois que a
 * tela carrega. Sem esta exclusão, cada navegação gravava DOIS passos —
 * `/documentos` e, um instante depois, `/documentos?lid=…` — e o Voltar
 * consumia o primeiro indo para a mesma tela. Clicava-se e nada acontecia,
 * porque de fato nada mudava.
 *
 * Guardar a rota sem o `lid` também não perde o processo: quem o recoloca é o
 * ProcessoAtivoContext, no destino.
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

export function registrarRota(caminhoCru: string): void {
  const caminho = chaveDaRota(caminhoCru);
  if (voltando) { voltando = false; return; }          // regra 2
  if (pilha[pilha.length - 1] === caminho) return;      // regra 1

  // Chegar a uma raiz zera o rastro: dali não se volta para trás.
  if (RAIZES.has(caminho)) { pilha = [caminho]; avisar(); return; }

  // Regra 4 — voltar a uma tela que já está no percurso TRUNCA a pilha ali,
  // em vez de empilhar de novo.
  //
  // Sem isso, qualquer botão que navegue para trás por conta própria — a seta
  // da pasta do processo saltando para o Kanban, o "Voltar ao Hub" do
  // financeiro — entrava como avanço, e o Voltar seguinte trazia de volta para
  // a tela de onde a pessoa tinha acabado de sair. Era o giro em círculos.
  const jaVisitada = pilha.lastIndexOf(caminho);
  pilha = jaVisitada >= 0 ? pilha.slice(0, jaVisitada + 1) : [...pilha, caminho];
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
