/**
 * Executou-se além do contratado. E agora?
 *
 * O caso concreto: o contrato 149/2024 tem 3.600 pacotes, e os pagamentos do
 * exercício de 2025 somam 5.997 CX — 66% acima. Isso não é um aviso na hora de
 * lançar; é um estado do contrato, que dura até ser regularizado, e a tela tem
 * de dizê-lo enquanto durar.
 *
 * ── O aviso na hora não basta ───────────────────────────────────────────────
 *
 * `avaliarCabimento` avisa quando o pedido estoura, e deixa seguir — há entrega
 * legítima com aditivo em tramitação. Mas depois de salvo, o excesso some da
 * tela: quem abre o contrato amanhã vê um consumo acima de 100% e nada que
 * diga o que fazer. Aviso que só existe no instante do clique é aviso que
 * ninguém audita.
 *
 * ── E nem todo excesso se resolve com aditivo ───────────────────────────────
 *
 * O art. 125 da Lei 14.133/2021 obriga a contratada a aceitar acréscimos de
 * até 25% do valor inicial atualizado — 50% em reforma de edifício ou de
 * equipamento. É um TETO, não uma autorização automática: acima dele, o
 * aditivo não regulariza nada, e o que houve foi execução sem cobertura
 * contratual.
 *
 * Confundir os dois casos é o erro que esta função existe para evitar. "Peça o
 * aditivo" dito a quem executou 66% a mais manda a pessoa buscar uma solução
 * que não existe — e atrasa a única conversa que resolve.
 */

export type LimiteDoAcrescimo = 'padrao' | 'reforma';

/** Art. 125: 25% no geral, 50% em reforma de edifício ou de equipamento. */
export const TETO_DO_ACRESCIMO: Record<LimiteDoAcrescimo, number> = {
  padrao: 0.25,
  reforma: 0.50,
};

export type Excesso = {
  excede: boolean;
  /** Quanto foi executado além do contratado, na unidade recebida. */
  quanto: number;
  /** O excesso como fração do valor inicial — é sobre ele que o art. 125 mede. */
  fracao: number;
  /** Fração do teto ainda livre, já descontados os aditivos anteriores. */
  margemLivre: number;
  /** O aditivo resolve? Falso quando o excesso passa do teto legal. */
  cabeNoArt125: boolean;
  frase: string;
  providencia: string;
};

const pct = (f: number) => `${(f * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/**
 * O estado do contrato quanto ao excesso.
 *
 * @param inicial       o valor (ou quantidade) INICIAL atualizado do contrato.
 *                      É a base do art. 125, e não o valor já aditivado —
 *                      medir sobre o aditivado permitiria acrescer 25% sobre
 *                      25% indefinidamente.
 * @param executado     o que de fato saiu.
 * @param jaAcrescido   o que aditivos anteriores já acresceram, na mesma
 *                      unidade. Consome o teto.
 */
export function excessoDeExecucao(e: {
  inicial: number | null | undefined;
  executado: number | null | undefined;
  jaAcrescido?: number | null;
  limite?: LimiteDoAcrescimo;
}): Excesso {
  const inicial = Number(e.inicial) || 0;
  const executado = Number(e.executado) || 0;
  const jaAcrescido = Number(e.jaAcrescido) || 0;
  const teto = TETO_DO_ACRESCIMO[e.limite ?? 'padrao'];

  const contratado = inicial + jaAcrescido;
  const quanto = Number((executado - contratado).toFixed(4));
  const margemLivre = inicial > 0 ? Math.max(0, teto - jaAcrescido / inicial) : 0;

  if (inicial <= 0) {
    return {
      excede: false, quanto: 0, fracao: 0, margemLivre: 0, cabeNoArt125: false,
      // Sem valor inicial não há contra o que medir. Dizer "não excede" seria
      // afirmar o que não se sabe.
      frase: 'O contrato não tem valor inicial registrado — não há contra o que medir a execução.',
      providencia: 'Preencha o valor do contrato para que o controle de excesso funcione.',
    };
  }

  if (quanto <= 0.0001) {
    return {
      excede: false, quanto: 0,
      fracao: 0,
      margemLivre,
      cabeNoArt125: true,
      frase: 'Execução dentro do contratado.',
      providencia: '',
    };
  }

  const fracao = quanto / inicial;
  const cabe = fracao <= margemLivre + 0.0001;

  return {
    excede: true,
    quanto,
    fracao,
    margemLivre,
    cabeNoArt125: cabe,
    frase: cabe
      ? `Executado ${pct(fracao)} além do contratado. Cabe no limite do art. 125, que ainda tem ${pct(margemLivre)} livres.`
      : `Executado ${pct(fracao)} além do contratado — acima do limite de ${pct(margemLivre)} que o art. 125 ainda permite.`,
    providencia: cabe
      ? 'Anexe o Termo Aditivo de Quantidade em Arquivos e Aditivos. Registrado o aditivo, o '
        + 'contratado é recalculado e o excesso deixa de existir.'
      // Acima do teto o aditivo não regulariza: mandar pedi-lo manda a pessoa
      // buscar uma solução que não existe.
      : 'O aditivo NÃO regulariza este excesso: o art. 125 não admite acréscimo além do teto. '
        + 'O que houve foi execução sem cobertura contratual, e a saída é outra — '
        + 'apostilamento não serve, e nova contratação exige novo procedimento. '
        + 'Confira antes se a unidade do contrato e a da execução são a mesma: '
        + 'divergência de unidade produz excesso que não existe.',
  };
}
