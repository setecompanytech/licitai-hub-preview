import { formatBRL, formatDate } from './formatters';

/**
 * A âncora do saldo declarado pelo banco — a única verdade que vem de fora.
 *
 * Todo OFX pode trazer `<LEDGERBAL>`: `BALAMT` (o saldo) e `DTASOF` (a data a
 * que ele se refere). A edge `import-ofx` gravava `saldo_final_em` como a
 * data de geração do arquivo e nunca preenchia `saldo_apos` (auditoria de
 * 21/09/2026, defeito 5). E os bancos não dizem a mesma coisa:
 *
 *  - o Banpará informa o saldo ANTERIOR ao período, com DTASOF = DTSTART
 *    (o primeiro dia do extrato): é o saldo antes de qualquer movimento
 *    daquele dia;
 *  - o Itaú informa o saldo na data de geração, DTASOF ≥ DTEND: depois de
 *    todos os movimentos do arquivo.
 *
 * Uma semântica só, para o banco de dados e para a conferência: `em` é o
 * dia no FIM do qual o saldo vale. Para o saldo anterior (DTASOF = início),
 * `em` é o dia anterior. A partir daí o saldo após cada movimento se acumula
 * em qualquer direção — e sem LEDGERBAL não há âncora: `saldo_apos` fica
 * nulo e a tela diz isso, em vez de inventar.
 *
 * Espelho Deno em `supabase/functions/_shared/ofx-ancora.ts` (a edge usa o
 * espelho; o teste roda os mesmos casos nos dois).
 */
export type PosicaoDaAncora = 'abertura' | 'fechamento' | 'intermediaria';

export type AncoraDoExtrato = {
  /** O saldo declarado (BALAMT). */
  valor: number;
  /** O dia no FIM do qual `valor` vale (AAAA-MM-DD). */
  em: string;
  posicao: PosicaoDaAncora;
  /** O DTASOF cru do arquivo, para rastreio. */
  dtasof: string;
  /** DTASOF ausente: o fim do período foi assumido como data do saldo. */
  dtasofAssumido: boolean;
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/**
 * Onde a âncora está em relação ao período do extrato.
 *
 * Primeiro o fechamento (DTASOF ≥ DTEND), pela especificação OFX: LEDGERBAL é
 * o saldo "as of" DTASOF, depois dos movimentos daquele dia. Depois a abertura
 * (DTASOF ≤ DTSTART), o formato do Banpará. O resto é intermediário: vale no
 * fim de DTASOF, e os movimentos posteriores acumulam a partir dele.
 */
export function posicaoDaAncora(dtasof: string, dtstart: string, dtend: string): PosicaoDaAncora {
  if (dtend && dtasof >= dtend) return 'fechamento';
  if (dtstart && dtasof <= dtstart) return 'abertura';
  return 'intermediaria';
}

export function ancoraDoExtrato(entrada: {
  saldo: number | null | undefined;
  dtasof: string | null | undefined;
  dtstart: string | null | undefined;
  dtend: string | null | undefined;
}): AncoraDoExtrato | null {
  const saldo = entrada.saldo;
  if (saldo === null || saldo === undefined || !Number.isFinite(saldo)) return null;

  const dtstart = DATA.test(entrada.dtstart ?? '') ? (entrada.dtstart as string) : '';
  const dtend = DATA.test(entrada.dtend ?? '') ? (entrada.dtend as string) : '';
  let dtasof = DATA.test(entrada.dtasof ?? '') ? (entrada.dtasof as string) : '';
  let dtasofAssumido = false;
  if (!dtasof) {
    // Sem DTASOF, o único momento plausível para um saldo declarado é o fim
    // do período — e sem período também não há âncora.
    if (!dtend) return null;
    dtasof = dtend;
    dtasofAssumido = true;
  }

  const posicao = posicaoDaAncora(dtasof, dtstart, dtend);
  // Saldo anterior ao período com DTASOF no primeiro dia: vale no fim do dia
  // ANTERIOR, antes dos movimentos desse primeiro dia. Se o banco já apontou
  // um dia antes do início, é esse mesmo.
  const em = posicao === 'abertura' && dtstart && dtasof === dtstart ? diaAnterior(dtasof) : dtasof;
  return { valor: saldo, em, posicao, dtasof, dtasofAssumido };
}

export type MovimentoParaSaldo = { data: string; valor: number };

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * O saldo depois de cada movimento, na ordem do arquivo.
 *
 * Os movimentos são postos em ordem de data (empate pela ordem do arquivo —
 * o banco não numera dentro do dia). O saldo antes do primeiro movimento é a
 * âncora menos tudo que aconteceu até o dia dela, inclusive; daí em diante é
 * soma corrida. Fechamento: o último movimento termina na âncora. Abertura: o
 * primeiro parte dela.
 */
export function saldosApos(movimentos: MovimentoParaSaldo[], ancora: Pick<AncoraDoExtrato, 'valor' | 'em'>): number[] {
  const ordenados = movimentos
    .map((m, i) => ({ ...m, i }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.i - b.i);
  const ateAncora = ordenados.filter((m) => m.data <= ancora.em).reduce((s, m) => s + m.valor, 0);
  let saldo = centavos(ancora.valor - ateAncora);
  const resultado = new Array<number>(movimentos.length);
  for (const m of ordenados) {
    saldo = centavos(saldo + m.valor);
    resultado[m.i] = saldo;
  }
  return resultado;
}

/** A frase para a tela — dizer o que o arquivo trouxe, ou que não trouxe. */
export function descricaoDaAncora(ancora: AncoraDoExtrato | null): string {
  if (!ancora) {
    return 'O arquivo não traz o saldo declarado pelo banco (LEDGERBAL): a conferência contra o banco e o saldo após cada movimento ficam sem preenchimento.';
  }
  const base = `Saldo declarado pelo banco: ${formatBRL(ancora.valor)} no fim de ${formatDate(ancora.em)}`;
  const assumido = ancora.dtasofAssumido ? ' (sem DTASOF no arquivo — assumido o fim do período)' : '';
  if (ancora.posicao === 'abertura') {
    return `${base} — saldo anterior ao período; o banco o informou em ${formatDate(ancora.dtasof)}, o início do extrato.${assumido}`;
  }
  if (ancora.posicao === 'fechamento') return `${base} — saldo ao fim do período.${assumido}`;
  return `${base} — dentro do período; os movimentos posteriores acumulam a partir dele.${assumido}`;
}
