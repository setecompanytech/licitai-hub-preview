/**
 * O caminho de volta: do lançamento para o contrato.
 *
 * O vínculo entre Financeiro e Gestão já existia — `contrato_pedido_id` no
 * lançamento —, mas só tinha UMA porta: partir do pedido e procurar o título.
 * Isso pressupõe que o pedido veio primeiro, e nem sempre vem. Contrato que
 * entra na gestão depois de meses de faturamento tem dezenas de lançamentos e
 * nenhum pedido, e a única porta existente exigia justamente o que ainda não
 * existe.
 *
 * Quem está olhando o lançamento é quem sabe a que contrato ele pertence. A
 * porta precisa estar onde a pessoa está.
 */

export type LancamentoParaVincular = {
  id: string;
  descricao: string | null;
  valor: number;
  numero_documento: string | null;
  data_competencia: string | null;
  data_emissao: string | null;
  pessoa_id: string | null;
  projeto_id: string | null;
  /** O nome do cliente, quando a consulta o trouxe. É por ele que se reconhece
   *  o órgão: `contratos` guarda `orgao_contratante` como TEXTO, e não tem
   *  chave para a pessoa do Financeiro. */
  pessoa_nome?: string | null;
  contrato_id: string | null;
  contrato_pedido_id: string | null;
};

export type ContratoCandidato = {
  id: string;
  numero_contrato: string | null;
  objeto: string | null;
  /**
   * O contratante, em TEXTO LIVRE — `contratos` não tem chave para a pessoa
   * do Financeiro. Por isso o reconhecimento é por palavras, e não por id: o
   * mesmo órgão é "POLICIA MILITAR DO ESTADO DO PARA" num cadastro e "Polícia
   * Militar do Pará" no outro.
   */
  orgao_contratante: string | null;
  saldo_remanescente?: number | null;
};

const palavrasDe = (s: string) =>
  new Set(
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      .split(' ')
      // Preposições e artigos casariam com qualquer órgão do estado.
      .filter(p => p.length >= 3 && !['do','da','de','dos','das','the'].includes(p)),
  );

/** Quanto dois nomes de organização se parecem, de 0 a 1. */
function parecencaDeNome(a: string, b: string): number {
  const x = palavrasDe(a), y = palavrasDe(b);
  if (x.size === 0 || y.size === 0) return 0;
  let comuns = 0;
  for (const p of x) if (y.has(p)) comuns++;
  return comuns / Math.min(x.size, y.size);
}

/**
 * Quanto um contrato parece ser o dono deste lançamento.
 *
 * Pontuação, não filtro. Filtrar esconde o contrato certo quando o cadastro
 * diverge — cliente gravado com outro id, projeto em branco —, e quem
 * conferiu o papel sabe mais do que o cadastro. A lista mostra todos; o mais
 * provável vem primeiro.
 */
export function pontuarContrato(
  lancamento: LancamentoParaVincular,
  contrato: ContratoCandidato,
): number {
  let pontos = 0;

  // Já apontado: o lançamento carrega o contrato mas não o pedido. É o caso do
  // vínculo feito pela metade, e o candidato certo é óbvio.
  if (lancamento.contrato_id && lancamento.contrato_id === contrato.id) pontos += 100;

  // O contratante. Comparado por PALAVRAS porque os dois cadastros são
  // independentes e escrevem o mesmo órgão de formas diferentes — "POLICIA
  // MILITAR DO ESTADO DO PARA" e "Polícia Militar do Pará" são o mesmo, e
  // nenhuma string contém a outra.
  if (lancamento.pessoa_nome && contrato.orgao_contratante) {
    const p = parecencaDeNome(lancamento.pessoa_nome, contrato.orgao_contratante);
    // Metade das palavras em comum já é reconhecimento; abaixo disso são dois
    // órgãos que por acaso compartilham uma palavra ("Secretaria", "Estado").
    if (p >= 0.5) pontos += Math.round(50 * p);
  }

  // O número do contrato citado na descrição do lançamento. Vale menos que o
  // cadastro porque é texto livre, mas resgata o que o cadastro não ligou.
  const numero = (contrato.numero_contrato ?? '').replace(/\s+/g, '');
  if (numero.length >= 4 && (lancamento.descricao ?? '').replace(/\s+/g, '').includes(numero)) {
    pontos += 30;
  }

  return pontos;
}

/** Do mais provável ao menos. Empate mantém a ordem recebida. */
export function ordenarContratos(
  lancamento: LancamentoParaVincular,
  contratos: ContratoCandidato[],
): Array<ContratoCandidato & { pontos: number }> {
  return contratos
    .map((c, i) => ({ ...c, pontos: pontuarContrato(lancamento, c), _i: i }))
    .sort((a, b) => (b.pontos - a.pontos) || (a._i - b._i))
    .map(({ _i, ...c }) => c);
}

/** A partir de quantos pontos a tela pré-seleciona o contrato. */
export const PONTOS_PARA_PRESELECIONAR = 50;

export type PedidoNovo = {
  contrato_id: string;
  numero_pedido: string;
  descricao: string | null;
  contrato_item_id: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  data_pedido: string | null;
  status: string;
  nota_fiscal: string | null;
  cota: string | null;
  empenho_id: string | null;
  observacoes: string;
};

/**
 * O pedido que este lançamento representa.
 *
 * O valor NÃO é recalculado a partir de quantidade × unitário: ele é o do
 * lançamento, que é o que foi faturado de fato. Recalcular faria o pedido
 * divergir da nota por centavos de arredondamento, e o saldo do contrato
 * passaria a contar uma coisa que nenhum documento diz.
 *
 * A quantidade, essa sim, vem de quem está preenchendo — a nota traz o valor,
 * e nem sempre a quantidade em unidades do contrato.
 *
 * `status` nasce 'entregue': o lançamento existe porque a nota foi emitida, e
 * nota emitida pressupõe entrega feita. Nascer 'pendente' criaria uma fila de
 * entregas por fazer que já foram feitas.
 */
export function pedidoAPartirDoLancamento(
  lancamento: LancamentoParaVincular,
  escolhas: {
    contratoId: string;
    numeroPedido: string;
    itemId?: string | null;
    quantidade: number;
    cota?: string | null;
    empenhoId?: string | null;
  },
): PedidoNovo {
  const qtd = Number(escolhas.quantidade) || 0;
  const valor = Number(lancamento.valor) || 0;
  return {
    contrato_id: escolhas.contratoId,
    numero_pedido: escolhas.numeroPedido,
    descricao: lancamento.descricao?.trim() || null,
    contrato_item_id: escolhas.itemId || null,
    quantidade: qtd,
    // Derivado do valor faturado, não o contrário. Zero na quantidade não pode
    // virar divisão por zero.
    valor_unitario: qtd > 0 ? Number((valor / qtd).toFixed(4)) : valor,
    valor_total: valor,
    // A data do FATO, não a de hoje: o pedido é retroativo por definição, e
    // datá-lo com o dia do cadastro apagaria justamente a informação que
    // permite conferi-lo contra a nota.
    data_pedido: lancamento.data_emissao || lancamento.data_competencia || null,
    status: 'entregue',
    nota_fiscal: lancamento.numero_documento || null,
    cota: escolhas.cota || null,
    empenho_id: escolhas.empenhoId || null,
    observacoes:
      'Pedido criado a partir de lançamento retroativo do Financeiro '
      + `(${lancamento.numero_documento ? 'NF ' + lancamento.numero_documento : 'sem número de nota'}).`,
  };
}

// ── O que a nota diz sobre o item ───────────────────────────────────────────

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Qual item do contrato a linha da nota descreve.
 *
 * Pontua por palavras em comum, não por "um contém o outro": a nota escreve
 * "AGUA MINERAL NATURAL 200ML COPO" e o contrato "Água mineral em copo de no
 * mínimo 200ml" — nenhuma das duas contém a outra, e são o mesmo produto.
 *
 * Devolve `null` abaixo do limiar. Sugestão fraca é pior que sugestão nenhuma:
 * a pessoa confirma sem olhar, e o pedido vai consumir o saldo do item errado
 * — que é o tipo de erro que ninguém volta a conferir.
 */
export function sugerirItem(
  descricaoDaNota: string,
  itens: Array<{ id: string; descricao: string }>,
): string | null {
  const alvo = new Set(normalizar(descricaoDaNota).split(' ').filter(p => p.length >= 3));
  if (alvo.size === 0) return null;

  let melhor: { id: string; pontos: number } | null = null;
  for (const item of itens) {
    const palavras = new Set(normalizar(item.descricao).split(' ').filter(p => p.length >= 3));
    let comuns = 0;
    for (const p of alvo) if (palavras.has(p)) comuns++;
    // Proporção sobre a MENOR das duas: a descrição do contrato costuma ser
    // longa e cheia de condições ("destinada a atender as necessidades…"), e
    // dividir pelo total dela puniria o casamento certo.
    const pontos = comuns / Math.min(alvo.size, palavras.size || 1);
    if (comuns >= 2 && (!melhor || pontos > melhor.pontos)) melhor = { id: item.id, pontos };
  }
  return melhor && melhor.pontos >= 0.5 ? melhor.id : null;
}
