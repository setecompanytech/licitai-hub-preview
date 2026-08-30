/**
 * Um pedido cabe? E, se não cabe, o que exatamente o barra?
 *
 * Três saldos limitam a mesma entrega, e nenhum implica o outro:
 *
 *   CONTRATO   quanto do ajuste ainda pode ser executado
 *   ITEM       quanto DESTE produto ainda pode ser entregue
 *   EMPENHO    quanto DESTA autorização orçamentária ainda há — e, quando o
 *              objeto é divisível, por COTA, porque a reservada e a principal
 *              correm separadas
 *
 * O contrato pode ter saldo com o item esgotado; o item pode ter saldo com o
 * empenho esgotado. Verificar um só deixa passar o que os outros dois
 * barrariam.
 *
 * ── Por que nomear o gargalo, e não só dizer "não cabe" ─────────────────────
 *
 * A providência é diferente em cada caso, e quem recebe o aviso precisa saber
 * qual tomar:
 *
 *   empenho esgotado  →  pedir reforço (estimativo) ou novo empenho
 *   item esgotado     →  aditivo de quantidade, se ainda houver margem no 25%
 *   contrato esgotado →  aditivo de valor, ou o contrato acabou
 *
 * "Não cabe" manda a pessoa procurar; "restam 60 na cota principal" já diz
 * onde.
 */

export type UnidadeDoLimite = 'quantidade' | 'valor';

export type LimiteAvaliado = {
  origem: 'empenho' | 'item' | 'contrato';
  rotulo: string;
  disponivel: number;
  solicitado: number;
  unidade: UnidadeDoLimite;
  /** Negativo = o quanto falta. */
  folga: number;
  providencia: string;
};

export type Cabimento = {
  cabe: boolean;
  /** O limite mais apertado — o que de fato decide. */
  gargalo: LimiteAvaliado | null;
  /** Todos os limites avaliados, para a tela poder mostrar o quadro inteiro. */
  limites: LimiteAvaliado[];
  frase: string;
};

export type SaldosDisponiveis = {
  /** Saldo da cota do empenho, em quantidade. Ausente = sem empenho vinculado. */
  empenho?: { rotulo: string; saldoQtd: number | null; tipo?: string | null } | null;
  /** Saldo do item do contrato, em quantidade. */
  item?: { rotulo: string; saldoQtd: number | null } | null;
  /** Saldo do contrato, em VALOR — é assim que ele é controlado. */
  contrato?: { saldoValor: number | null } | null;
};

const fmtQtd = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Avalia os três limites e devolve o quadro completo.
 *
 * Saldo ausente (`null`) NÃO vira zero nem infinito: o limite simplesmente não
 * é avaliado, e a tela pode dizer que ele não foi verificado. Tratar ausência
 * como "cabe" libera o que ninguém conferiu; tratar como "não cabe" trava
 * quem não tem empenho registrado — e a maioria dos contratos não tem.
 */
export function avaliarCabimento(
  pedido: { quantidade: number; valor: number },
  saldos: SaldosDisponiveis,
): Cabimento {
  const limites: LimiteAvaliado[] = [];

  if (saldos.empenho && saldos.empenho.saldoQtd != null) {
    const disp = saldos.empenho.saldoQtd;
    limites.push({
      origem: 'empenho',
      rotulo: saldos.empenho.rotulo,
      disponivel: disp,
      solicitado: pedido.quantidade,
      unidade: 'quantidade',
      folga: Number((disp - pedido.quantidade).toFixed(4)),
      providencia: saldos.empenho.tipo === 'estimativo'
        ? 'Peça o reforço do empenho antes de entregar — no estimativo isso é rotina, não irregularidade.'
        : 'Peça novo empenho: entregar além do empenhado é despesa sem cobertura (Lei 4.320/64, art. 60).',
    });
  }

  if (saldos.item && saldos.item.saldoQtd != null) {
    const disp = saldos.item.saldoQtd;
    limites.push({
      origem: 'item',
      rotulo: saldos.item.rotulo,
      disponivel: disp,
      solicitado: pedido.quantidade,
      unidade: 'quantidade',
      folga: Number((disp - pedido.quantidade).toFixed(4)),
      providencia: 'O item acabou. Só um aditivo de quantidade amplia — e ele consome o limite de 25% do art. 125.',
    });
  }

  if (saldos.contrato && saldos.contrato.saldoValor != null) {
    const disp = saldos.contrato.saldoValor;
    limites.push({
      origem: 'contrato',
      rotulo: 'saldo do contrato',
      disponivel: disp,
      solicitado: pedido.valor,
      unidade: 'valor',
      folga: Number((disp - pedido.valor).toFixed(2)),
      providencia: 'O contrato chegou ao fim do valor. Aditivo de valor, ou nova contratação.',
    });
  }

  if (limites.length === 0) {
    return {
      cabe: true, gargalo: null, limites: [],
      frase: 'Nenhum saldo registrado para conferir — o pedido passa sem verificação.',
    };
  }

  // O mais apertado manda. Empate de folga: a ordem de `limites` decide, e ela
  // põe o empenho primeiro de propósito — é o que tem a consequência legal
  // mais grave.
  const gargalo = limites.reduce((pior, l) => (l.folga < pior.folga ? l : pior));
  const cabe = gargalo.folga >= -0.0001;

  if (cabe) {
    return {
      cabe: true, gargalo, limites,
      frase: gargalo.unidade === 'quantidade'
        ? `Cabe. O mais apertado é ${gargalo.rotulo}: restam ${fmtQtd(gargalo.folga)} depois deste pedido.`
        : `Cabe. O mais apertado é ${gargalo.rotulo}: restam ${fmtBRL(gargalo.folga)} depois deste pedido.`,
    };
  }

  const falta = Math.abs(gargalo.folga);
  return {
    cabe: false, gargalo, limites,
    frase: gargalo.unidade === 'quantidade'
      ? `Não cabe: ${fmtQtd(gargalo.solicitado)} pedidos, ${fmtQtd(gargalo.disponivel)} disponíveis em ${gargalo.rotulo}. Faltam ${fmtQtd(falta)}.`
      : `Não cabe: ${fmtBRL(gargalo.solicitado)} pedidos, ${fmtBRL(gargalo.disponivel)} disponíveis em ${gargalo.rotulo}. Faltam ${fmtBRL(falta)}.`,
  };
}
