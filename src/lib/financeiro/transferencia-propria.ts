/**
 * Transferência entre contas da própria empresa.
 *
 * O extrato de cada conta enxerga metade da operação. O Banpará registra uma
 * saída de R$ 300.000; o Itaú registra uma entrada de R$ 300.000. São duas
 * linhas em dois arquivos, e nada nelas diz que são a mesma coisa.
 *
 * Conciliadas às cegas, viram dois lançamentos independentes: uma despesa e
 * uma receita. O saldo de cada conta fica certo — o dinheiro realmente saiu de
 * uma e entrou na outra — mas o RESULTADO fica errado, porque a empresa passa
 * a exibir R$ 300.000 de faturamento e R$ 300.000 de custo que nunca
 * existiram. Foi assim que R$ 19,17 milhões em pernas de transferência
 * entraram nos relatórios de margem da ETHOS.
 *
 * ── O que identifica uma transferência própria ──────────────────────────────
 *
 * A descrição ajuda, mas é fraca: "PIX RECEBIDO" aparece tanto num pagamento
 * de cliente quanto num aporte do sócio. Em 25/08 foi exatamente essa fraqueza
 * que fez oito PIX de abril serem lançados com a conta de origem no chute.
 *
 * O sinal forte é aritmético: **mesmo valor, sinais opostos, contas próprias
 * diferentes, datas próximas**. Dois extratos independentes registrarem o
 * mesmo centavo em sentidos contrários no mesmo intervalo é coincidência
 * improvável — e quando não é coincidência, é transferência.
 *
 * Por isso a pontuação abaixo dá o peso ao casamento de valor e data, e trata
 * a descrição como reforço, nunca como prova.
 */

/** Um movimento de extrato ainda não conciliado. */
export type MovimentoExtrato = {
  id: string;
  conta_id: string | null;
  /** Positivo entra, negativo sai — convenção do extrato. */
  valor: number;
  data_movimento: string;
  descricao?: string | null;
};

/** Uma contrapartida possível: outro movimento, ou um lançamento já gravado. */
export type Contrapartida = {
  id: string;
  conta_id: string | null;
  valor: number;
  data: string;
  descricao?: string | null;
  /** 'movimento' = outra linha de extrato; 'lancamento' = já está no sistema. */
  origem: 'movimento' | 'lancamento';
};

export type ParTransferencia = {
  contrapartida: Contrapartida;
  /** 0–100. Acima de 85 o casamento é praticamente certo. */
  score: number;
  motivos: string[];
  diasDeDiferenca: number;
};

// ─── Vocabulário ─────────────────────────────────────────────────────────────

/**
 * Termos que sugerem movimentação entre contas próprias.
 *
 * "resgate" e "aplicacao" entram porque o CDB automático do banco é
 * transferência: o dinheiro vai da conta corrente para a aplicação e volta.
 * Na ETHOS, R$ 1,86 milhão de "INT RESGATE MAPFRERFDI" foi lançado como
 * conta a receber por não ter esse reconhecimento.
 */
const TERMOS_TRANSFERENCIA = [
  'transferencia entre', 'transf propria', 'transf entre contas', 'entre contas',
  'mesma titularidade', 'mesmo titular', 'conta propria',
  'resgate', 'aplicacao', 'aplic automatica', 'cdb', 'rdb', 'poupanca',
  'ted propria', 'tev', 'transf ted', 'transferencia interna',
];

function chave(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A descrição sugere transferência entre contas próprias? Indício, não prova. */
export function pareceTransferencia(descricao: string | null | undefined): boolean {
  const d = chave(descricao);
  if (!d) return false;
  return TERMOS_TRANSFERENCIA.some((t) => d.includes(t));
}

/** Distância em dias entre duas datas AAAA-MM-DD. */
export function diasEntre(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T12:00:00`);
  const db = Date.parse(`${b.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(da - db) / 86400000);
}

const CENTAVO = 0.005;

/**
 * Procura a outra metade da transferência.
 *
 * Regras, em ordem de dureza:
 *   1. Valor igual em módulo — até um centavo de tolerância. Transferência não
 *      tem desconto nem juros; se o valor difere, não é a mesma operação.
 *   2. Sinais opostos. Duas saídas não são as duas pontas de nada.
 *   3. Conta DIFERENTE, e ambas da empresa. Este é o ponto que faltava: sem
 *      conferir que a origem é uma conta própria, aceita-se qualquer conta —
 *      e foi assim que R$ 2,05 milhões "saíram" de uma conta que tinha
 *      R$ 39,75.
 *   4. Data próxima. Mesmo dia é o normal; TED e agendamento podem levar dois
 *      ou três dias úteis.
 *
 * A descrição só acrescenta pontos. Sozinha, nunca basta.
 */
export function acharContrapartida(
  mov: MovimentoExtrato,
  candidatos: Contrapartida[],
  opcoes?: { contasProprias?: string[]; janelaDias?: number },
): ParTransferencia[] {
  const janela = opcoes?.janelaDias ?? 3;
  const proprias = opcoes?.contasProprias;

  const pares: ParTransferencia[] = [];

  for (const c of candidatos) {
    if (c.id === mov.id) continue;
    if (!c.conta_id || !mov.conta_id) continue;
    if (c.conta_id === mov.conta_id) continue;
    // Ambas precisam ser contas da empresa. Sem esta linha, o casamento
    // aceitaria conta de terceiro e inventaria transferência onde há venda.
    if (proprias && (!proprias.includes(c.conta_id) || !proprias.includes(mov.conta_id))) continue;

    if (Math.abs(Math.abs(c.valor) - Math.abs(mov.valor)) > CENTAVO) continue;
    if (Math.sign(c.valor) === Math.sign(mov.valor)) continue;

    const dias = diasEntre(mov.data_movimento, c.data);
    if (dias > janela) continue;

    const motivos: string[] = [];
    // Valor exato e sentidos opostos em contas próprias distintas: é o cerne.
    let score = 70;
    motivos.push('mesmo valor em sentidos opostos');
    motivos.push('contas próprias diferentes');

    if (dias === 0) { score += 15; motivos.push('mesma data'); }
    else if (dias === 1) { score += 10; motivos.push('1 dia de diferença'); }
    else { score += 5; motivos.push(`${dias} dias de diferença`); }

    if (pareceTransferencia(mov.descricao) || pareceTransferencia(c.descricao)) {
      score += 10;
      motivos.push('descrição indica transferência');
    }
    // Já existir do outro lado como lançamento é mais forte do que outra linha
    // de extrato: alguém já classificou aquela ponta.
    if (c.origem === 'lancamento') { score += 5; motivos.push('a outra ponta já está lançada'); }

    pares.push({ contrapartida: c, score: Math.min(score, 100), motivos, diasDeDiferenca: dias });
  }

  // Mais provável primeiro; empate desfeito pela data mais próxima.
  return pares.sort((a, b) => b.score - a.score || a.diasDeDiferenca - b.diasDeDiferenca);
}

/**
 * O que fazer com o movimento, dito em uma palavra.
 *
 * `casar`      — a contrapartida existe: unir as duas pontas num par.
 * `criar_par`  — não existe: lançar a transferência com as duas pernas.
 * `nenhum`     — não parece transferência; segue o fluxo normal.
 */
export type AcaoTransferencia = 'casar' | 'criar_par' | 'nenhum';

export function decidirAcao(
  mov: MovimentoExtrato,
  pares: ParTransferencia[],
  limiar = 85,
): AcaoTransferencia {
  if (pares.length > 0 && pares[0].score >= limiar) return 'casar';
  if (pareceTransferencia(mov.descricao)) return 'criar_par';
  return 'nenhum';
}


// ─── O par nasce marcado como transferência ──────────────────────────────────

/**
 * O que identifica o par para o CAIXA e para o DRE.
 *
 * A tela de lançamento criava a transferência como duas pernas com a MESMA
 * categoria dos dois lados ("Transferências Recebidas" na saída e na
 * entrada — natureza despesa no remetente), e sem nada na linha dizendo que
 * as duas são uma operação só além do lote (auditoria de 21/09, defeito 7).
 * Funcionava para o saldo; quebrava o significado e permitia a perna sem
 * contrapartida.
 *
 * Aqui o par nasce com o que o schema já tem: `tipo = transferencia` (enum
 * `financeiro_tipo_lancamento`), `conta_destino_id` apontando a outra conta
 * em cada perna, e a categoria de cada LADO — "enviada" na perna que sai da
 * origem, "recebida" na que entra no destino. É isso que a régua do caixa
 * (`ehTransferenciaEntreContasProprias`) e a do DRE (`ehMovimentacao`)
 * reconhecem.
 */
export type CategoriaClassificavel = {
  id: string;
  nome: string;
  natureza?: string | null;
  grupo_dre?: string | null;
  ativa?: boolean | null;
};

export function categoriasDeTransferencia(categorias: CategoriaClassificavel[]): {
  enviada: CategoriaClassificavel | null;
  recebida: CategoriaClassificavel | null;
} {
  const candidatas = categorias.filter((c) => {
    if (c.ativa === false) return false;
    const movimentacao = c.natureza === 'movimentacao' || c.grupo_dre === 'movimentacao';
    return movimentacao && /transf/.test(chave(c.nome));
  });
  const acha = (re: RegExp) => candidatas.find((c) => re.test(chave(c.nome))) ?? null;
  const enviada = acha(/enviad|saida|remetid/);
  const recebida = acha(/recebid|entrada/);
  // Só existe a genérica ("Transferência entre contas"): serve aos dois
  // lados — o tipo e a conta de destino já dizem qual perna é qual.
  const generica = candidatas.find((c) => !/enviad|saida|remetid|recebid|entrada/.test(chave(c.nome))) ?? null;
  return { enviada: enviada ?? generica, recebida: recebida ?? generica };
}

export type PernaDeTransferencia = {
  tipo: 'transferencia';
  natureza: 'despesa' | 'receita';
  conta_id: string;
  conta_destino_id: string;
  categoria_id: string | null;
  origem_lote_id: string;
};

export function montarParDeTransferencia(input: {
  contaOrigem: string | null | undefined;
  contaDestino: string | null | undefined;
  /** O lote que amarra as duas pernas (a edição de uma sincroniza a outra). */
  loteId: string;
  categorias?: CategoriaClassificavel[];
  /** A categoria escolhida na tela, usada só quando não há "enviada"/"recebida". */
  categoriaEscolhida?: string | null;
}): { saida: PernaDeTransferencia; entrada: PernaDeTransferencia } {
  const { contaOrigem, contaDestino, loteId } = input;
  if (!contaOrigem || !contaDestino) {
    throw new Error('Transferência precisa da conta de origem e da conta de destino.');
  }
  if (contaOrigem === contaDestino) {
    throw new Error('Origem e destino são a mesma conta — isso não é transferência.');
  }
  const { enviada, recebida } = categoriasDeTransferencia(input.categorias ?? []);
  const escolhida = input.categoriaEscolhida || null;
  return {
    saida: {
      tipo: 'transferencia',
      natureza: 'despesa',
      conta_id: contaOrigem,
      conta_destino_id: contaDestino,
      categoria_id: enviada?.id ?? escolhida,
      origem_lote_id: loteId,
    },
    entrada: {
      tipo: 'transferencia',
      natureza: 'receita',
      conta_id: contaDestino,
      conta_destino_id: contaOrigem,
      categoria_id: recebida?.id ?? escolhida,
      origem_lote_id: loteId,
    },
  };
}

// ─── Títulos que já nasceram errados ─────────────────────────────────────────

/**
 * Um título (`a_receber`/`a_pagar`) já gravado que, pelo texto, é transferência.
 *
 * Na ETHOS há R$ 1,86 milhão de "INT RESGATE MAPFRERFDI" lançado como conta a
 * receber. Não é recebimento de cliente: é dinheiro da empresa voltando do CDB
 * para a conta corrente. Inflava o "Total a receber em aberto" e, até a
 * correção de hoje, entrava como faturamento na calculadora de margem.
 *
 * Mas o remédio depende de uma pergunta que só os dados respondem: **a
 * transferência correspondente já existe?**
 *
 *  • Se existe, o título é DUPLICATA — a mesma operação contada duas vezes, e
 *    o certo é remover o título, não convertê-lo. Converter criaria uma
 *    terceira contagem.
 *  • Se não existe, o título é a transferência MAL LANÇADA, e o certo é
 *    convertê-lo, dando-lhe a conta de destino que falta.
 *
 * Confundir os dois casos dobra o erro em vez de corrigi-lo. Por isso esta
 * função não decide sozinha pelo texto: ela procura o par antes.
 */
export type ClassificacaoTitulo =
  | 'duplicata_de_transferencia'
  | 'transferencia_mal_lancada'
  | 'nenhum';

export type TituloSuspeito = {
  id: string;
  conta_id: string | null;
  /** Sempre em módulo, como o banco grava. */
  valor: number;
  data: string;
  descricao?: string | null;
  natureza?: string | null;
};

/** Uma transferência já existente, para conferir se o título é duplicata. */
export type TransferenciaExistente = {
  id: string;
  conta_id: string | null;
  conta_destino_id?: string | null;
  valor: number;
  data: string;
};

export function classificarTitulo(
  titulo: TituloSuspeito,
  transferencias: TransferenciaExistente[],
  opcoes?: { janelaDias?: number },
): { classificacao: ClassificacaoTitulo; par?: TransferenciaExistente } {
  if (!pareceTransferencia(titulo.descricao)) return { classificacao: 'nenhum' };

  const janela = opcoes?.janelaDias ?? 3;
  const alvo = Math.abs(titulo.valor);

  const par = transferencias.find((t) => {
    if (Math.abs(Math.abs(t.valor) - alvo) > CENTAVO) return false;
    if (diasEntre(titulo.data, t.data) > janela) return false;
    // A transferência tem de tocar a conta do título — de um lado ou do outro.
    return t.conta_id === titulo.conta_id || t.conta_destino_id === titulo.conta_id;
  });

  return par
    ? { classificacao: 'duplicata_de_transferencia', par }
    : { classificacao: 'transferencia_mal_lancada' };
}
