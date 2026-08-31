/**
 * A releitura de um documento não pertence à aba onde foi disparada.
 *
 * Ler um contrato escaneado de 150 páginas leva MINUTOS: o OCR renderiza cada
 * página sem texto e manda para o modelo, em lotes de quatro. Ninguém fica
 * parado olhando. A pessoa troca de aba — e a aba, sendo Radix, desmonta.
 *
 * O trabalho em si continua: uma promessa pendente não é cancelada por um
 * componente sair da tela. O que se perde é tudo o que dizia que ele existe —
 * o spinner, o texto de progresso, e a recarga no fim. Quem volta encontra a
 * tela como se nada tivesse sido pedido, conclui que a leitura morreu, e
 * dispara de novo a mesma leitura que ainda está rodando.
 *
 * Por isso o estado mora aqui, num módulo, e não no componente: o módulo não
 * desmonta. A aba passa a ser uma janela para o que está acontecendo, não o
 * dono do que acontece.
 */

export type Releitura = {
  arquivoId: string;
  nome: string;
  /** Onde a leitura está agora — "Lendo por OCR: página 9–12 de 40…". */
  mensagem: string;
};

const emCurso = new Map<string, Releitura>();
const ouvintes = new Set<() => void>();

/**
 * Lista imutável, reconstruída só quando algo muda.
 *
 * `useSyncExternalStore` compara por identidade e entra em laço infinito se o
 * getSnapshot devolver um array novo a cada chamada.
 */
let instantaneo: Releitura[] = [];

function publicar(): void {
  instantaneo = [...emCurso.values()];
  for (const f of ouvintes) f();
}

export function assinarReleituras(f: () => void): () => void {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

export function releiturasEmCurso(): Releitura[] {
  return instantaneo;
}

export function releituraDe(arquivoId: string): Releitura | null {
  return emCurso.get(arquivoId) ?? null;
}

/**
 * Marca o início. Devolve `false` quando aquele arquivo JÁ está sendo lido —
 * disparar a segunda leitura do mesmo PDF dobraria o custo de OCR para chegar
 * ao mesmo resultado.
 */
export function comecarReleitura(arquivoId: string, nome: string): boolean {
  if (emCurso.has(arquivoId)) return false;
  emCurso.set(arquivoId, { arquivoId, nome, mensagem: 'Baixando o documento…' });
  publicar();
  return true;
}

export function progredirReleitura(arquivoId: string, mensagem: string): void {
  const atual = emCurso.get(arquivoId);
  if (!atual) return;
  emCurso.set(arquivoId, { ...atual, mensagem });
  publicar();
}

export function terminarReleitura(arquivoId: string): void {
  if (!emCurso.delete(arquivoId)) return;
  publicar();
}

/** Só para os testes: devolve o módulo ao estado inicial. */
export function limparReleituras(): void {
  emCurso.clear();
  publicar();
}
