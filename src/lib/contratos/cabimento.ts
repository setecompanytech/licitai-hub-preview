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
  /**
   * Aparece no aviso, mas NÃO decide se o pedido cabe.
   *
   * Existe para um caso só, e ele é honesto: o empenho estimativo, cujo saldo
   * o sistema sabe estar incompleto porque não conhece os reforços. Afirmar
   * "não cabe" a partir de um número reconhecidamente parcial seria acusar
   * falta com base no que não se sabe.
   */
  informativo?: boolean;
};

export type Cabimento = {
  cabe: boolean;
  /** O limite mais apertado ENTRE OS QUE DECIDEM. */
  gargalo: LimiteAvaliado | null;
  /** Limites informativos estourados — dizem-se, sem barrar. */
  avisos: LimiteAvaliado[];
  /** Todos os limites avaliados, para a tela poder mostrar o quadro inteiro. */
  limites: LimiteAvaliado[];
  frase: string;
};

export type SaldosDisponiveis = {
  /**
   * O saldo do empenho. Ausente = sem empenho vinculado.
   *
   * Vem nas DUAS unidades porque a que vale muda com a espécie — ver a nota
   * sobre o estimativo em `avaliarCabimento`.
   */
  empenho?: {
    rotulo: string;
    saldoQtd: number | null;
    saldoValor?: number | null;
    tipo?: string | null;
    /**
     * O empenho tem reforços ou anulações registrados?
     *
     * Reforço é ato de VALOR: a quantidade impressa na nota original fica
     * obsoleta no primeiro reforço. O 2025NE000064 acusava "−395 de 2.802"
     * em quantidade enquanto tinha R$ 63 mil positivos em valor — a nota
     * original dizia 2.802 CX, e os dez reforços autorizaram muito mais.
     */
    reforcado?: boolean;
  } | null;
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
/** A frase de um limite estourado, na unidade dele. */
export function fraseDoLimite(l: LimiteAvaliado): string {
  const f = l.unidade === 'quantidade' ? fmtQtd : fmtBRL;
  const falta = Math.abs(l.folga);
  return l.folga >= -0.0001
    ? `${l.rotulo}: restam ${f(l.folga)}.`
    : `${l.rotulo}: ${f(l.solicitado)} pedidos, ${f(l.disponivel)} disponíveis. Faltam ${f(falta)}.`;
}

export function avaliarCabimento(
  pedido: { quantidade: number; valor: number },
  saldos: SaldosDisponiveis,
): Cabimento {
  const limites: LimiteAvaliado[] = [];

  // ── O empenho: qual unidade vale depende da espécie ─────────────────────
  //
  // O empenho reserva DINHEIRO — é o que o art. 60 da Lei 4.320/64 protege. A
  // quantidade impressa nele é descrição, e a fidelidade dessa descrição muda
  // com a espécie:
  //
  //   ORDINÁRIO e GLOBAL  empenham quantidade definida. "100 pacotes" são 100
  //                       pacotes, e a centésima entrega esgota. A quantidade
  //                       vale como limite.
  //
  //   ESTIMATIVO          o montante NÃO é determinável — é a própria razão de
  //                       ele existir (Lei 4.320/64, art. 60, §2º; modalidades
  //                       detalhadas no Decreto 93.872/86). A quantidade que aparece
  //                       na nota é formalidade: o 149/2024 traz "1 pacote"
  //                       num contrato de 3.600. Conferir o pedido contra esse
  //                       1 acusaria falta em TODA entrega, e alerta que sempre
  //                       dispara é alerta que ninguém lê.
  //
  // Quem governa a quantidade no estimativo é o CONTRATO e o ITEM, que estão
  // logo abaixo. O empenho continua sendo conferido — pelo valor, que é o que
  // ele de fato reservou.
  if (saldos.empenho) {
    const ehEstimativo = saldos.empenho.tipo === 'estimativo';
    // Estimativo OU reforçado: a régua é o VALOR. No estimativo, porque a
    // quantidade da nota é formalidade; no reforçado, porque os reforços são
    // atos de valor e a quantidade original ficou para trás. A diferença
    // entre eles: o estimativo só AVISA (saldo sabidamente parcial); o
    // reforçado BARRA, porque o vigente com os movimentos registrados é
    // número completo e confiável.
    const confereEmValor = ehEstimativo || !!saldos.empenho.reforcado;
    const providencia = ehEstimativo
      ? 'Peça o reforço do empenho antes de faturar — no estimativo isso é rotina, não irregularidade.'
      : 'Peça novo empenho: entregar além do empenhado é despesa sem cobertura (Lei 4.320/64, art. 60).';

    if (confereEmValor) {
      if (saldos.empenho.saldoValor != null) {
        const disp = saldos.empenho.saldoValor;
        limites.push({
          origem: 'empenho',
          rotulo: `${saldos.empenho.rotulo} (valor empenhado${saldos.empenho.reforcado ? ', com reforços' : ''})`,
          disponivel: disp,
          solicitado: pedido.valor,
          unidade: 'valor',
          folga: Number((disp - pedido.valor).toFixed(2)),
          providencia,
          // ── Por que o estimativo não barra ───────────────────────────────
          //
          // O órgão empenha um valor inicial e REFORÇA conforme o consumo se
          // materializa — no 149/2024 a nota inicial é de R$ 22,55 num
          // contrato de R$ 81.180,00, e isso é prática regular.
          //
          // Enquanto os reforços não estiverem registrados aqui, o saldo que
          // o sistema conhece é reconhecidamente parcial. Afirmar "não cabe"
          // com base nele seria acusar falta a partir do que não se sabe — e
          // quem governa a quantidade no estimativo é o contrato, que está
          // sendo conferido logo abaixo. O ordinário/global REFORÇADO não é
          // informativo: barra, porque o vigente é completo.
          informativo: ehEstimativo ? true : undefined,
        });
      }
    } else if (saldos.empenho.saldoQtd != null) {
      const disp = saldos.empenho.saldoQtd;
      limites.push({
        origem: 'empenho',
        rotulo: saldos.empenho.rotulo,
        disponivel: disp,
        solicitado: pedido.quantidade,
        unidade: 'quantidade',
        folga: Number((disp - pedido.quantidade).toFixed(4)),
        providencia,
      });
    }
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

  const decidem = limites.filter(l => !l.informativo);
  const avisos = limites.filter(l => l.informativo && l.folga < -0.0001);

  if (decidem.length === 0) {
    return {
      cabe: true, gargalo: null, avisos, limites,
      frase: limites.length === 0
        ? 'Nenhum saldo registrado para conferir — o pedido passa sem verificação.'
        : 'Sem limite que decida: o que há é referência. O pedido passa.',
    };
  }

  // O mais apertado manda. Empate de folga: a ordem de `limites` decide, e ela
  // põe o empenho primeiro de propósito — é o que tem a consequência legal
  // mais grave.
  const gargalo = decidem.reduce((pior, l) => (l.folga < pior.folga ? l : pior));
  const cabe = gargalo.folga >= -0.0001;

  if (cabe) {
    return {
      cabe: true, gargalo, avisos, limites,
      frase: gargalo.unidade === 'quantidade'
        ? `Cabe. O mais apertado é ${gargalo.rotulo}: restam ${fmtQtd(gargalo.folga)} depois deste pedido.`
        : `Cabe. O mais apertado é ${gargalo.rotulo}: restam ${fmtBRL(gargalo.folga)} depois deste pedido.`,
    };
  }

  const falta = Math.abs(gargalo.folga);
  return {
    cabe: false, gargalo, avisos, limites,
    frase: gargalo.unidade === 'quantidade'
      ? `Não cabe: ${fmtQtd(gargalo.solicitado)} pedidos, ${fmtQtd(gargalo.disponivel)} disponíveis em ${gargalo.rotulo}. Faltam ${fmtQtd(falta)}.`
      : `Não cabe: ${fmtBRL(gargalo.solicitado)} pedidos, ${fmtBRL(gargalo.disponivel)} disponíveis em ${gargalo.rotulo}. Faltam ${fmtBRL(falta)}.`,
  };
}
