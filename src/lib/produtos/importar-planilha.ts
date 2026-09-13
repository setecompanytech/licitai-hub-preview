/**
 * Leitura de planilha de produtos — a parte que não toca no banco.
 *
 * Por que existe um módulo só para isto: o botão "Importar Planilha" do
 * cadastro de produtos era decorativo (nenhum `onClick`, nenhum parser) nas
 * DUAS cópias da tela. O padrão visual proíbe botão fictício, e a alternativa
 * de simplesmente apagá-lo tirava do comando uma ação que ele pede por escrito.
 *
 * A separação em módulo puro tem uma razão prática: a regra que decide o que
 * é linha nova, o que é repetida e o que é inválida é a regra que impede
 * lançamento em duplicidade — e regra dessas se verifica em teste, não no
 * olho, rodando a importação de verdade contra o banco de alguém.
 */

/** Uma linha já interpretada, pronta para virar (ou não) um produto. */
export interface LinhaPlanilha {
  /** 1-based, contando o cabeçalho — é o número que a pessoa vê no Excel. */
  linha: number;
  descricao: string;
  unidade: string;
  ncm: string;
  codigo_ean: string;
  familia: string;
  /** Já em número: a planilha vem com "1.234,56" ou "1234.56". */
  preco_venda: number;
}

export interface LinhaRejeitada {
  linha: number;
  descricao: string;
  motivo: 'sem-descricao' | 'repetida-na-planilha' | 'ja-cadastrada';
}

export interface ResultadoLeitura {
  novas: LinhaPlanilha[];
  rejeitadas: LinhaRejeitada[];
  /** Total de linhas de dado lidas (sem contar o cabeçalho). */
  lidas: number;
}

/**
 * Cabeçalhos aceitos por campo. A planilha que a pessoa tem em mãos quase
 * nunca usa o nome interno da coluna, então cada campo aceita os apelidos que
 * aparecem nas exportações de ERP mais comuns.
 */
const SINONIMOS: Record<keyof Omit<LinhaPlanilha, 'linha'>, string[]> = {
  descricao: ['descricao', 'descrição', 'produto', 'nome', 'item', 'descricao do produto'],
  unidade: ['unidade', 'un', 'und', 'unid', 'unidade de medida'],
  ncm: ['ncm', 'codigo ncm', 'código ncm'],
  codigo_ean: ['ean', 'gtin', 'codigo ean', 'código ean', 'codigo de barras', 'código de barras'],
  familia: ['familia', 'família', 'familia de produto', 'família de produto', 'categoria', 'grupo'],
  preco_venda: ['preco', 'preço', 'preco de venda', 'preço de venda', 'preco venda', 'valor', 'preco unitario de venda'],
};

/** Tira acento, colapsa espaço e baixa a caixa — para comparar cabeçalho e
 *  para comparar descrição de produto sem depender de como foi digitada. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * "1.234,56" → 1234.56 · "1234.56" → 1234.56 · "" → 0
 *
 * O desempate entre o separador brasileiro e o americano é pela ÚLTIMA
 * pontuação: em "1.234,56" a vírgula vem depois, em "1,234.56" o ponto vem
 * depois. Chutar pela vírgula sozinha transformava "1,234.56" em 1,23456.
 */
export function lerNumero(bruto: string | number | null | undefined): number {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : 0;
  if (!bruto) return 0;
  const limpo = String(bruto).replace(/[^\d.,-]/g, '').trim();
  if (!limpo) return 0;
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  let normalizado: string;
  if (ultimaVirgula > ultimoPonto) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else {
    normalizado = limpo.replace(/,/g, '');
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/** Qual coluna da planilha corresponde a qual campo. -1 = não veio. */
export function mapearColunas(cabecalho: string[]): Record<keyof Omit<LinhaPlanilha, 'linha'>, number> {
  const normalizado = cabecalho.map(normalizar);
  const mapa = {} as Record<keyof Omit<LinhaPlanilha, 'linha'>, number>;
  (Object.keys(SINONIMOS) as Array<keyof typeof SINONIMOS>).forEach((campo) => {
    mapa[campo] = normalizado.findIndex((h) => SINONIMOS[campo].includes(h));
  });
  return mapa;
}

/**
 * Separa uma linha de CSV respeitando aspas. Escrito à mão porque a única
 * coisa que o arquivo precisa suportar é o que o Excel brasileiro exporta:
 * separador `;` ou `,`, campo entre aspas duplas, aspas escapadas em pares.
 */
export function separarLinhaCsv(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === separador && !dentroDeAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** `;` ou `,` — o que aparecer mais na primeira linha. */
export function detectarSeparador(primeiraLinha: string): string {
  const pontoEVirgula = (primeiraLinha.match(/;/g) ?? []).length;
  const virgula = (primeiraLinha.match(/,/g) ?? []).length;
  return pontoEVirgula >= virgula ? ';' : ',';
}

/** CSV inteiro → matriz de células. */
export function lerCsv(texto: string): string[][] {
  const linhas = texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (linhas.length === 0) return [];
  const sep = detectarSeparador(linhas[0]);
  return linhas.map((l) => separarLinhaCsv(l, sep));
}

/**
 * O coração da importação: matriz de células + o que já existe no cadastro
 * → o que entra e o que é recusado, com o motivo.
 *
 * Duas defesas contra duplicidade, e elas são diferentes:
 *
 *  - `ja-cadastrada` compara com o catálogo atual da empresa. É o que impede
 *    a mesma planilha importada duas vezes de dobrar o cadastro.
 *  - `repetida-na-planilha` compara com as linhas anteriores DO PRÓPRIO
 *    arquivo. É o que impede uma planilha com a mesma descrição repetida de
 *    criar dois produtos numa importação só — o primeiro passa, o segundo não.
 *
 * A chave das duas é a descrição normalizada, porque é o único campo
 * obrigatório do cadastro; código EAN e NCM são opcionais e voltam vazios com
 * frequência, então não servem de identidade.
 */
export function interpretarPlanilha(
  celulas: string[][],
  descricoesExistentes: string[],
): ResultadoLeitura {
  if (celulas.length < 2) return { novas: [], rejeitadas: [], lidas: 0 };

  const mapa = mapearColunas(celulas[0]);
  const jaNoCadastro = new Set(descricoesExistentes.map(normalizar));
  const jaNesteArquivo = new Set<string>();

  const novas: LinhaPlanilha[] = [];
  const rejeitadas: LinhaRejeitada[] = [];
  let lidas = 0;

  for (let i = 1; i < celulas.length; i++) {
    const celula = (indice: number) => (indice >= 0 ? (celulas[i][indice] ?? '').trim() : '');
    const descricao = celula(mapa.descricao);
    // Linha totalmente vazia não é erro de ninguém: é o rodapé em branco que
    // o Excel arrasta junto. Não conta como lida nem vira rejeição.
    if (celulas[i].every((c) => (c ?? '').trim() === '')) continue;
    lidas++;

    const numeroDaLinha = i + 1;
    if (!descricao) {
      rejeitadas.push({ linha: numeroDaLinha, descricao: '', motivo: 'sem-descricao' });
      continue;
    }
    const chave = normalizar(descricao);
    if (jaNoCadastro.has(chave)) {
      rejeitadas.push({ linha: numeroDaLinha, descricao, motivo: 'ja-cadastrada' });
      continue;
    }
    if (jaNesteArquivo.has(chave)) {
      rejeitadas.push({ linha: numeroDaLinha, descricao, motivo: 'repetida-na-planilha' });
      continue;
    }
    jaNesteArquivo.add(chave);
    novas.push({
      linha: numeroDaLinha,
      descricao,
      unidade: celula(mapa.unidade) || 'PC',
      ncm: celula(mapa.ncm).replace(/\D/g, ''),
      codigo_ean: celula(mapa.codigo_ean),
      familia: celula(mapa.familia),
      preco_venda: lerNumero(celula(mapa.preco_venda)),
    });
  }

  return { novas, rejeitadas, lidas };
}

export const MOTIVO_LEGIVEL: Record<LinhaRejeitada['motivo'], string> = {
  'sem-descricao': 'Sem descrição',
  'repetida-na-planilha': 'Repetida na planilha',
  'ja-cadastrada': 'Já cadastrada',
};
