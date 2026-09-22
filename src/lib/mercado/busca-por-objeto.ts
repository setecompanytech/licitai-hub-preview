/**
 * Preço por objeto — as réguas da busca (22/09/2026).
 *
 * "CARNE MOIDA PATINHO" no Pará voltava "nenhum edital similar" com três
 * editais de carne moída no acervo: a busca era só por significado, com piso
 * absoluto de 45%, e a por palavras só rodava quando o vetor falhava. Agora a
 * tela escolhe COMO comparar, e o vazio diz o que foi tentado e oferece o
 * próximo passo em vez de afirmar que não existe.
 */
export type ModoDeBusca = 'todas' | 'qualquer' | 'significado';

export const MODO_PADRAO: ModoDeBusca = 'qualquer';

export const MODOS_DE_BUSCA: ReadonlyArray<{ valor: ModoDeBusca; rotulo: string; explicacao: string }> = [
  {
    valor: 'todas',
    rotulo: 'Todas as palavras',
    explicacao: 'só editais cuja descrição traz cada palavra digitada; amostra menor e mais fiel',
  },
  {
    valor: 'qualquer',
    rotulo: 'Qualquer palavra, por semelhança (recomendado)',
    explicacao: 'editais com ao menos uma das palavras, os mais parecidos primeiro',
  },
  {
    valor: 'significado',
    rotulo: 'Só por significado',
    explicacao: 'sem exigir palavra; inclui vizinhos e o que foi escrito de outro jeito',
  },
];

export function ehModoDeBusca(valor: unknown): valor is ModoDeBusca {
  return valor === 'todas' || valor === 'qualquer' || valor === 'significado';
}

const FRASE_DO_MODO: Record<ModoDeBusca, string> = {
  todas: 'todas as palavras',
  qualquer: 'qualquer palavra',
  significado: 'só o significado',
};

/** O que a busca tentou, para o vazio e para o rodapé do resultado. */
export interface TentativaDeBusca {
  modo: ModoDeBusca;
  uf: string | null;
  municipio?: string | null;
  anos?: number;
  anoExato?: number | null;
}

/** "qualquer palavra, em PA, nos últimos 3 anos" */
export function descricaoDaTentativa(t: TentativaDeBusca): string {
  const onde = t.uf ? `em ${t.uf}` : 'em todas as UFs';
  const cidade = t.municipio ? `, município "${t.municipio}"` : '';
  const quando = t.anoExato
    ? `no ano de ${t.anoExato}`
    : (t.anos ?? 3) === 1 ? 'no último ano' : `nos últimos ${t.anos ?? 3} anos`;
  return `${FRASE_DO_MODO[t.modo]}, ${onde}${cidade}, ${quando}`;
}

/** Como a busca ordenou, no vocabulário de quem lê. */
export function rotuloDoProvedor(provedor: string): string {
  switch (provedor) {
    case 'palavras+significado': return 'palavras, ordenadas por semelhança de significado';
    case 'palavras': return 'palavras, por relevância do texto';
    case 'palavras (por data)': return 'palavras, por data';
    case 'significado': return 'semelhança de significado';
    case 'semantico': return 'semelhança de significado';
    case 'textual': return 'palavras';
    default: return provedor || 'acervo';
  }
}

export interface ProximoPasso {
  rotulo: string;
  modo?: ModoDeBusca;
  uf?: 'todas';
}

/**
 * O que oferecer quando nada veio: alargar a régua, e alargar o mapa. Nunca
 * um beco sem saída — "nenhum edital similar" era falso e não dava para onde ir.
 */
export function proximosPassos(modo: ModoDeBusca, uf: string | null): ProximoPasso[] {
  const passos: ProximoPasso[] = [];
  if (modo === 'todas') passos.push({ modo: 'qualquer', rotulo: 'Tentar com qualquer palavra' });
  if (modo === 'qualquer') passos.push({ modo: 'significado', rotulo: 'Tentar só por significado' });
  if (modo === 'significado') passos.push({ modo: 'qualquer', rotulo: 'Tentar por palavras' });
  if (uf) passos.push({ uf: 'todas', rotulo: 'Buscar em todas as UFs' });
  return passos;
}

/**
 * Palavras que contam numa busca por objeto: três letras ou mais, sem
 * repetição, na ordem em que vieram. Espelho de
 * `supabase/functions/_shared/busca-por-objeto.ts` — mudou lá, muda aqui.
 */
export function palavrasDaBusca(texto: string): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const palavra of texto.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (palavra.length < 3 || vistas.has(palavra)) continue;
    vistas.add(palavra);
    saida.push(palavra);
  }
  return saida;
}
