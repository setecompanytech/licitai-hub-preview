/**
 * O quadro de status da disputa, em texto (D13, 16/09/2026).
 *
 * O robô manda o que vê na sala (callback `estado-da-sala`), o webhook guarda
 * em `sessoes_lance_real.estado_sala` com o motivo já em linguagem de cliente,
 * e a aba Acompanhamento mostra numa linha: "Item 1 · Modo aberto · 8º lugar ·
 * Melhor R$ 3.100,00 · Nosso R$ 4.999,70" e, embaixo, o que o robô está
 * fazendo. É o que dispensa abrir a tela remota para saber como a disputa vai.
 */

export type EstadoNoQuadro = {
  item?: number | null;
  melhor_lance?: number | null;
  nosso_lance?: number | null;
  posicao?: number | null;
  /**
   * A FAIXA, quando há empate (02/10/2026). A sala do Compras.gov não publica a
   * colocação: ela é a ORDEM da linha no painel "Melhores valores por
   * fornecedor", e os concorrentes são anônimos. Com valores repetidos — há
   * quatro propostas de R$ 1.034,1900 num item real — não existe posição única,
   * e o robô manda a faixa em vez de escolher um número.
   */
  posicao_de?: number | null;
  posicao_ate?: number | null;
  empatados?: number | null;
  /** Quantos concorrentes já lançaram (os demais estão só com a proposta). */
  ja_lancaram?: number | null;
  /** Quando a posição foi lida: ela não é relida a cada rodada (custa navegação). */
  posicao_lida_em?: string | null;
  /**
   * O cronômetro DO ITEM na última leitura, em segundos. Cada item prorroga por
   * conta própria a cada lance recebido — os dois itens do 37/2026 marcavam
   * 01:39 e 01:57 ao mesmo tempo —, então não existe "o tempo da sessão".
   */
  segundos_restantes?: number | null;
  sou_lider?: boolean | null;
  tem_proposta?: boolean | null;
  nossa_desclassificada?: boolean | null;
  modo?: string | null;
  fase?: string | null;
  decisao?: { acao?: string | null; motivo?: string | null; motivo_legivel?: string | null } | null;
  /** Último estado de cada item, quando o robô acompanha vários (Fase 7). */
  por_item?: Record<string, EstadoNoQuadro> | null;
};

const ROTULO_DA_FASE: Record<string, string> = {
  aguardando: 'Aguardando abrir',
  aberta: 'Etapa aberta',
  encerramento_aleatorio: 'Encerramento aleatório',
  fechada: 'Lance final fechado',
  desempate_me_epp: 'Desempate de ME/EPP',
  suspensa: 'Suspensa',
  encerrada: 'Encerrada',
};

/** Sem notícia do robô por mais que isto, com a sessão de pé, a tela avisa. */
export const MINUTOS_SEM_NOTICIA = 2;

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function posicaoNoQuadro(estado: EstadoNoQuadro): string | null {
  if (estado.nossa_desclassificada) return 'Proposta desclassificada';
  if (estado.tem_proposta === false) return 'Sem proposta da empresa';
  if (estado.sou_lider === true) return '1º lugar';
  if (Number.isFinite(estado.posicao as number)) return `${estado.posicao}º lugar`;

  // EMPATE: a faixa, dita por extenso (02/10/2026). Mostrar nada seria pior —
  // a tela pareceria sem informação justamente quando ela existe. E inventar um
  // número seria pior ainda: numa disputa, precisão falsa leva a decidir como
  // se soubesse. "Entre 4º e 7º (4 empatados)" é a resposta honesta, e a
  // palavra "empatados" explica por que não há um número só.
  const de = estado.posicao_de;
  const ate = estado.posicao_ate;
  if (Number.isFinite(de as number) && Number.isFinite(ate as number) && de !== ate) {
    const empate = Number.isFinite(estado.empatados as number) && (estado.empatados as number) > 1
      ? ` (${estado.empatados} empatados)`
      : '';
    return `Entre ${de}º e ${ate}º${empate}`;
  }
  if (Number.isFinite(de as number)) return `${de}º lugar`;
  return null;
}

/**
 * QUANTOS CONCORRENTES JÁ LANÇARAM, para o quadro.
 *
 * Quem está só com a proposta inicial ainda não disputou — e isso muda a
 * leitura de "8 empresas": oito cadastradas com duas lançando é outra disputa.
 */
export function concorrentesNoQuadro(estado: EstadoNoQuadro): string | null {
  const lancaram = estado.ja_lancaram;
  if (!Number.isFinite(lancaram as number)) return null;
  return `${lancaram} ${(lancaram as number) === 1 ? 'concorrente lançou' : 'concorrentes lançaram'}`;
}

export function resumoDoQuadro(
  estado: EstadoNoQuadro,
  opcoes: { estadoEm?: string | null; agora?: Date; sessaoViva: boolean },
): { partes: string[]; motivo: string | null; aviso: string | null } {
  const partes = [
    Number.isFinite(estado.item as number) ? `Item ${estado.item}` : null,
    estado.modo ? `Modo ${estado.modo.toLowerCase()}` : null,
    estado.fase ? ROTULO_DA_FASE[estado.fase] ?? estado.fase : null,
    posicaoNoQuadro(estado),
    Number.isFinite(estado.melhor_lance as number) ? `Melhor ${moeda(estado.melhor_lance as number)}` : null,
    Number.isFinite(estado.nosso_lance as number) ? `Nosso ${moeda(estado.nosso_lance as number)}` : null,
  ].filter((p): p is string => !!p);

  const motivo = estado.decisao?.motivo_legivel || estado.decisao?.motivo || null;

  let aviso: string | null = null;
  if (!opcoes.sessaoViva) {
    aviso = 'Última leitura antes de a sessão do robô terminar';
  } else if (opcoes.estadoEm) {
    const em = new Date(opcoes.estadoEm);
    const minutos = Math.floor(((opcoes.agora ?? new Date()).getTime() - em.getTime()) / 60_000);
    if (Number.isFinite(minutos) && minutos >= MINUTOS_SEM_NOTICIA) {
      aviso = `Sem notícia do robô há ${minutos} min — a leitura pode estar desatualizada`;
    }
  }

  return { partes, motivo, aviso };
}

/**
 * Os itens do quadro, na ordem do número (Fase 7, 16/09/2026). Com vários
 * itens, o robô grava o último estado de cada um em `por_item`; sem ele, o
 * estado único de antes vale como o único item.
 */
export function itensDoQuadro(estado: EstadoNoQuadro): EstadoNoQuadro[] {
  const porItem = estado.por_item ? Object.values(estado.por_item) : [];
  if (porItem.length === 0) return [estado];
  return [...porItem].sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0));
}

/**
 * ──────────────────────────────────────────────────────────────────────────
 * O CRONÔMETRO QUE CORRE NA TELA (02/10/2026)
 * ──────────────────────────────────────────────────────────────────────────
 * A sala do Compras.gov mostra um cronômetro POR ITEM, e é por ele que quem
 * disputa decide. O robô lê esse número a cada rodada e manda junto do estado —
 * mas o número que chega é de alguns segundos atrás, e exibi-lo parado faria a
 * tela mentir devagar: "01:56" congelado parece tempo que se tem.
 *
 * Aqui o tempo é RECALCULADO a partir de quando foi lido. E, acima de tudo, a
 * função diz **o quanto se pode confiar**: passada a idade máxima, ela para de
 * descontar e marca `confiavel: false`, porque um cronômetro estimado sobre uma
 * leitura velha é pior do que nenhum — numa disputa, ele faz a pessoa achar que
 * tem meio minuto quando o item já fechou.
 */
export interface TempoNaTela {
  /** Segundos restantes agora, estimados a partir da leitura. `null` = não sei. */
  segundos: number | null;
  /** "01:39" — pronto para a tela. */
  texto: string | null;
  /** Há quantos segundos a leitura foi feita. */
  idadeDaLeitura: number | null;
  /**
   * `false` quando a leitura ficou velha demais para estimar. A tela mostra o
   * tempo em cinza, com a hora da leitura ao lado, em vez de fingir precisão.
   */
  confiavel: boolean;
  /** O item fechou enquanto ninguém olhava — pelo menos segundo esta conta. */
  zerou: boolean;
}

/**
 * Quantos segundos a leitura pode ter antes de o cronômetro deixar de ser
 * confiável. Quatro rodadas de 30 s: além disso, o robô provavelmente não está
 * lendo, e o número vira adivinhação.
 */
export const SEGUNDOS_MAXIMOS_DE_ESTIMATIVA = 120;

export function tempoRestanteAgora(
  segundosNaLeitura: number | null | undefined,
  lidoEm: string | null | undefined,
  agora: Date = new Date(),
): TempoNaTela {
  // `Number(null)` e `Number('')` dao 0 — e zero aqui seria "00:00" na tela,
  // ou seja, "o item fechou". Ausencia tem de continuar sendo ausencia.
  const base = segundosNaLeitura === null || segundosNaLeitura === undefined
    ? NaN
    : Number(segundosNaLeitura);
  if (!Number.isFinite(base) || base < 0) {
    return { segundos: null, texto: null, idadeDaLeitura: null, confiavel: false, zerou: false };
  }

  let idade: number | null = null;
  if (lidoEm) {
    const em = new Date(lidoEm).getTime();
    if (Number.isFinite(em)) idade = Math.max(0, Math.floor((agora.getTime() - em) / 1000));
  }

  // Sem hora de leitura não há como descontar: mostra o que veio, e diz que não
  // é de confiança.
  if (idade === null) {
    return { segundos: base, texto: formatarRelogio(base), idadeDaLeitura: null, confiavel: false, zerou: base <= 0 };
  }

  const confiavel = idade <= SEGUNDOS_MAXIMOS_DE_ESTIMATIVA;
  const restante = Math.max(0, base - idade);

  return {
    // Leitura velha: devolve o que foi lido, sem descontar — descontar sobre
    // uma base velha inventa precisão que não existe.
    segundos: confiavel ? restante : base,
    texto: formatarRelogio(confiavel ? restante : base),
    idadeDaLeitura: idade,
    confiavel,
    zerou: confiavel && restante === 0,
  };
}

/** 99 → "01:39"; 3750 → "1:02:30". */
export function formatarRelogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(seg)}` : `${dois(m)}:${dois(seg)}`;
}

/**
 * QUANTO ESTE ITEM PEDE ATENÇÃO AGORA — para ordenar e destacar.
 *
 * Com 182 itens na tela, mostrar tudo com o mesmo peso é o mesmo que não
 * mostrar nada. A ordem é a de quem disputa: o que está perdendo com o relógio
 * acabando vem primeiro; o que já encerrou vai para o fim.
 *
 * Número maior = mais urgente. Função pura.
 */
export function urgenciaDoItem(estado: EstadoNoQuadro, tempo: TempoNaTela): number {
  if (estado.fase === 'encerrada') return 0;

  let peso = 10;
  // Perder é o que exige decisão; liderar, não.
  if (estado.sou_lider === false) peso += 40;
  // Sem piso o robô não lança: é um item parado por falta de decisão de alguém.
  if (estado.decisao?.acao === 'aguardar') peso += 5;

  if (tempo.confiavel && tempo.segundos !== null) {
    if (tempo.segundos <= 30) peso += 40;
    else if (tempo.segundos <= 120) peso += 20;
  }
  if (estado.fase === 'aberta') peso += 10;
  return peso;
}
