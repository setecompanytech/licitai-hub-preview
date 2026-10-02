/**
 * O piso de MUITOS itens de uma vez.
 *
 * Por que isto existe (02/10/2026, auditoria de usabilidade). O robô de lances
 * foi feito para a pessoa não repetir a mesma operação 182 vezes — é o número
 * real de itens de um pregão que a operação do cliente disputa, e a frase dela
 * foi: *"são 182 itens […] aí eu tenho que ficar só nesse processo, dando os
 * lances, item por item"*. Só que, para ligar o robô, era preciso digitar 182
 * pisos, um por linha. O cadastro reproduzia exatamente o trabalho que o robô
 * existe para tirar.
 *
 * As regras abaixo geram o piso a partir de um número que a empresa já tem —
 * o valor unitário do item ou o custo da Precificação —, e a decisão continua
 * sendo de quem opera: a regra é escolhida, o percentual é digitado, e o
 * resultado aparece na grade para conferir item a item antes de salvar.
 *
 * TRÊS CUIDADOS que o módulo garante, e que a tela sozinha não garantiria:
 *
 * 1. **Item sem base não recebe piso.** Sem valor unitário (ou sem custo, na
 *    regra do custo) não há de onde derivar, e inventar zero autorizaria o robô
 *    a descer até zero. Esses itens voltam contados e nomeados, para a tela
 *    dizer quais ficaram de fora.
 * 2. **Piso já preenchido não some sem ordem.** Quem ajustou três itens à mão
 *    não pode perder o ajuste por aplicar uma regra geral; por isso
 *    `somenteVazios` existe e é o padrão na tela.
 * 3. **Nada de padrão inventado.** Não há percentual sugerido: quem não
 *    escolheu não pode ser atropelado por uma escolha nossa (princípio 7 do
 *    CLAUDE.md — política de cliente não vira regra de produto).
 */

export type BaseDoPiso = 'valor' | 'custo';

export interface ItemParaPiso {
  id: string;
  numero?: number | string | null;
  /** Valor unitário ofertado/estimado — a base mais comum. */
  valor?: number | null;
  /** Custo interno, quando a Precificação o conhece. Nunca é preço. */
  custoUnitario?: number | null;
  /** O piso de hoje: `null` é "ninguém decidiu", `0` é uma decisão. */
  valorMinimo?: number | null;
}

export interface RegraDoPiso {
  base: BaseDoPiso;
  /**
   * Percentual da base, como a pessoa digita ("85" = 85% da base). Fica em
   * escala 0–100 porque é número transcrito por quem opera, e não razão
   * derivada de uma divisão (ver a fronteira no CLAUDE.md).
   *
   * O TETO DEPENDE DA BASE, e isso não é detalhe:
   * - sobre o **valor**, o teto é 100 — um piso acima do preço ofertado faria
   *   o robô nascer impedido de dar qualquer lance;
   * - sobre o **custo**, passar de 100 é o caso NORMAL: "não vender por menos
   *   que custo + 10%" é 110%. Travar em 100 aqui obrigaria a vender no custo.
   */
  percentual: number;
  /** Quando true (o padrão da tela), só preenche quem está sem piso. */
  somenteVazios?: boolean;
}

export interface ResultadoDoPisoEmMassa<T extends ItemParaPiso> {
  itens: T[];
  /** Quantos receberam piso agora. */
  aplicados: number;
  /** Tinham piso e foram preservados (só em `somenteVazios`). */
  preservados: number;
  /** Não tinham base para o cálculo — ficam SEM piso, e a tela diz quais. */
  semBase: Array<{ id: string; numero: number | string | null }>;
}

/** Arredonda para centavos sem o escorregão de ponto flutuante. */
function emCentavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * O piso de UM item por uma regra. `null` quando não há base — e nunca zero
 * por falta de dado: zero é uma decisão, e esta função não a toma por ninguém.
 */
export function pisoPelaRegra(item: ItemParaPiso, regra: RegraDoPiso): number | null {
  const pct = Number(regra?.percentual);
  if (!Number.isFinite(pct) || pct <= 0 || pct > tetoDoPercentual(regra?.base)) return null;

  const base = regra.base === 'custo' ? Number(item.custoUnitario) : Number(item.valor);
  if (!Number.isFinite(base) || base <= 0) return null;

  return emCentavos((base * pct) / 100);
}

/**
 * O teto do percentual, por base — ver a explicação em `RegraDoPiso`.
 *
 * Exportado porque a tela precisa do mesmo número no `max` do campo: duas
 * cópias deste limite divergiriam, e a divergência só apareceria quando alguém
 * digitasse 150 e o botão não fizesse nada, sem dizer por quê.
 */
export function tetoDoPercentual(base: BaseDoPiso | undefined): number {
  return base === 'custo' ? 1000 : 100;
}

/**
 * Aplica a regra a uma lista e devolve a lista nova mais o que aconteceu.
 *
 * Devolve SEMPRE o resumo, inclusive quando não aplicou em ninguém: a tela
 * precisa poder dizer "nenhum item tinha custo cadastrado" em vez de parecer
 * que o botão não funcionou.
 */
export function aplicarPisoEmMassa<T extends ItemParaPiso>(
  itens: T[],
  regra: RegraDoPiso,
): ResultadoDoPisoEmMassa<T> {
  const lista = Array.isArray(itens) ? itens : [];
  const soVazios = regra?.somenteVazios !== false;

  let aplicados = 0;
  let preservados = 0;
  const semBase: Array<{ id: string; numero: number | string | null }> = [];

  const novos = lista.map((item) => {
    const temPiso = item.valorMinimo !== null && item.valorMinimo !== undefined;
    if (soVazios && temPiso) {
      preservados++;
      return item;
    }

    const piso = pisoPelaRegra(item, regra);
    if (piso === null) {
      // Sem base: fica como está. Um item que já tinha piso não o perde por
      // uma regra que não soube calcular o dele.
      if (!temPiso) semBase.push({ id: item.id, numero: item.numero ?? null });
      return item;
    }

    aplicados++;
    return { ...item, valorMinimo: piso };
  });

  return { itens: novos, aplicados, preservados, semBase };
}

/**
 * O que dizer depois de aplicar — uma frase, em português, pronta para o toast.
 *
 * Existe aqui, e não na tela, porque o texto é parte da regra: "aplicado em 180
 * itens; 2 ficaram sem piso porque não têm custo cadastrado" é a diferença
 * entre a pessoa conferir os dois e descobrir no meio da disputa.
 */
export function resumoDoPisoEmMassa(
  r: ResultadoDoPisoEmMassa<ItemParaPiso>,
  regra: RegraDoPiso,
): string {
  const nomeDaBase = regra.base === 'custo' ? 'custo' : 'valor unitário';
  const partes: string[] = [];

  if (r.aplicados > 0) {
    partes.push(
      `Piso de ${regra.percentual}% do ${nomeDaBase} aplicado em ${r.aplicados} ` +
        `${r.aplicados === 1 ? 'item' : 'itens'}.`,
    );
  } else {
    partes.push('Nenhum item recebeu piso.');
  }

  if (r.preservados > 0) {
    partes.push(
      `${r.preservados} ${r.preservados === 1 ? 'item já tinha piso e foi preservado' : 'itens já tinham piso e foram preservados'}.`,
    );
  }

  if (r.semBase.length > 0) {
    const numeros = r.semBase
      .map((i) => i.numero)
      .filter((n): n is number | string => n !== null && n !== undefined);
    const quais = numeros.length ? ` (${numeros.slice(0, 8).join(', ')}${numeros.length > 8 ? '…' : ''})` : '';
    partes.push(
      `${r.semBase.length} ${r.semBase.length === 1 ? 'item ficou' : 'itens ficaram'} sem piso por não ter ${nomeDaBase}${quais}.`,
    );
  }

  return partes.join(' ');
}
