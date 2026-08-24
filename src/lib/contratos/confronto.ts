/**
 * O confronto entre o contrato derivado e a ATA que o origina.
 *
 * A doutrina, nas palavras do dono do produto: a ATA registra a quantidade
 * MÁXIMA; os contratos a fracionam até o esgotamento; todos devem seguir o
 * preço e as condições registradas; e só se assina dentro da vigência dela.
 *
 * Este módulo faz a análise ANTES de o registro existir — recebe o que a
 * leitura extraiu do PDF do contrato e o que a ata tem gravado, e devolve os
 * veredictos que a tela mostra: o que casa, o que excede, o que diverge. É
 * deliberadamente puro (sem banco, sem tela) para ter teste.
 */

export type ItemExtraido = {
  codigo_item?: string | null;
  descricao: string;
  quantidade?: number | null;
  unidade?: string | null;
  valor_unitario?: number | null;
  valor_total?: number | null;
};

export type ItemDaAta = {
  id: string;
  codigo_item?: string | null;
  descricao: string;
  unidade?: string | null;
  quantidade_contratada: number;
  quantidade_ata_consumida?: number | null;
  valor_unitario: number;
};

export type ConfrontoItem = {
  extraido: ItemExtraido;
  ataItem: ItemDaAta | null;
  /** Saldo quantitativo disponível no item da ata. */
  saldoDisponivel: number | null;
  quantidadeExcede: boolean;
  /** Preço do contrato difere do registrado (tolerância de meio centavo). */
  precoDiverge: boolean;
};

export type ConfrontoComAta = {
  valorContrato: number;
  saldoAta: number;
  /** Quanto da ATA ORIGINAL este contrato toma (fração do registrado, não do saldo). */
  pctDaAta: number | null;
  valorExcede: boolean;
  /** Nulo quando falta data de um dos lados. */
  dentroDaVigencia: boolean | null;
  dataFimAta: string | null;
  itens: ConfrontoItem[];
  casados: number;
  semPar: number;
  comProblema: number;
};

const chave = (s: string | null | undefined) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Encontra o item da ata que o item do contrato fraciona.
 *
 * Código idêntico decide sozinho. Sem código, decide a descrição — por
 * sobreposição de palavras, não por igualdade: o contrato transcreve a
 * descrição da ata com abreviações ("CARNE MOÍDA BOVINA CONG." para "CARNE
 * MOÍDA DE BOVINO CONGELADA…"), e exigir igualdade desfaria todo par real.
 */
export function casarItemComAta(item: ItemExtraido, ataItens: ItemDaAta[]): ItemDaAta | null {
  const cod = chave(item.codigo_item);
  if (cod) {
    const porCodigo = ataItens.find((a) => chave(a.codigo_item) === cod);
    if (porCodigo) return porCodigo;
  }

  const tokens = new Set(chave(item.descricao).split(' ').filter((t) => t.length >= 4));
  if (tokens.size === 0) return null;

  let melhor: { item: ItemDaAta; pontos: number } | null = null;
  for (const a of ataItens) {
    const tokensAta = chave(a.descricao).split(' ').filter((t) => t.length >= 4);
    if (tokensAta.length === 0) continue;
    const comuns = tokensAta.filter((t) => tokens.has(t)).length;
    // Cobertura do MENOR conjunto: o contrato costuma abreviar ("CARNE MOÍDA
    // BOVINA" para a descrição longa da ata), e medir contra o maior punia a
    // abreviação. O mínimo de 2 palavras comuns barra o falso par por uma
    // palavra genérica solta.
    const pontos = comuns / Math.min(tokens.size, tokensAta.length);
    if (comuns >= 2 && pontos >= 0.5 && (!melhor || pontos > melhor.pontos)) melhor = { item: a, pontos };
  }
  return melhor?.item ?? null;
}

export function confrontarContratoComAta(
  contrato: {
    valorGlobal: number;
    dataAssinatura?: string | null;
    itens: ItemExtraido[];
  },
  ata: {
    valorGlobal: number;
    valorConsumido: number;
    dataFim?: string | null;
    itens: ItemDaAta[];
  },
): ConfrontoComAta {
  const saldoAta = (ata.valorGlobal || 0) - (ata.valorConsumido || 0);

  const dataFimAta = ata.dataFim ? String(ata.dataFim).slice(0, 10) : null;
  const assinatura = contrato.dataAssinatura ? String(contrato.dataAssinatura).slice(0, 10) : null;
  const dentroDaVigencia = dataFimAta && assinatura ? assinatura <= dataFimAta : null;

  const itens: ConfrontoItem[] = contrato.itens.map((it) => {
    const ataItem = casarItemComAta(it, ata.itens);
    if (!ataItem) {
      return { extraido: it, ataItem: null, saldoDisponivel: null, quantidadeExcede: false, precoDiverge: false };
    }
    const saldoDisponivel = Math.max(
      (ataItem.quantidade_contratada || 0) - (ataItem.quantidade_ata_consumida || 0),
      0,
    );
    const qtd = Number(it.quantidade) || 0;
    const precoContrato = Number(it.valor_unitario) || 0;
    return {
      extraido: it,
      ataItem,
      saldoDisponivel,
      quantidadeExcede: qtd > saldoDisponivel,
      // Mesmo preço e condições da ata: divergência acima de meio centavo é
      // divergência — abaixo disso é arredondamento de transcrição.
      precoDiverge: precoContrato > 0 && Math.abs(precoContrato - (ataItem.valor_unitario || 0)) > 0.005,
    };
  });

  const casados = itens.filter((i) => i.ataItem).length;
  const semPar = itens.length - casados;
  const comProblema = itens.filter((i) => i.quantidadeExcede || i.precoDiverge).length;

  return {
    valorContrato: contrato.valorGlobal || 0,
    saldoAta,
    // O percentual é sobre o REGISTRADO: "este contrato toma 25% da ata" é a
    // leitura que a doutrina do fracionamento pede — o saldo muda a cada
    // contrato, o registrado é a régua fixa.
    pctDaAta: (ata.valorGlobal || 0) > 0
      ? Math.round(((contrato.valorGlobal || 0) / ata.valorGlobal) * 10000) / 100
      : null,
    valorExcede: (contrato.valorGlobal || 0) > saldoAta,
    dentroDaVigencia,
    dataFimAta,
    itens,
    casados,
    semPar,
    comProblema,
  };
}
