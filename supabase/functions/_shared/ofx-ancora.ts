/**
 * A âncora do saldo declarado pelo banco (LEDGERBAL/DTASOF) — espelho Deno de
 * `src/lib/financeiro/ancora-do-extrato.ts`, onde a regra está explicada e
 * testada (o vitest roda os mesmos casos nos dois arquivos; mudam juntos).
 *
 * Uma semântica só: `em` é o dia no FIM do qual o saldo vale. O Banpará
 * declara o saldo ANTERIOR ao período com DTASOF = DTSTART — aqui vira o dia
 * anterior; o Itaú declara na data de geração (DTASOF ≥ DTEND) e fica como
 * está. Sem LEDGERBAL não há âncora, e `saldo_apos` fica nulo.
 *
 * Sem `Deno.*` de propósito.
 */
export type PosicaoDaAncora = "abertura" | "fechamento" | "intermediaria";

export type AncoraDoExtrato = {
  valor: number;
  em: string;
  posicao: PosicaoDaAncora;
  dtasof: string;
  dtasofAssumido: boolean;
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function posicaoDaAncora(dtasof: string, dtstart: string, dtend: string): PosicaoDaAncora {
  if (dtend && dtasof >= dtend) return "fechamento";
  if (dtstart && dtasof <= dtstart) return "abertura";
  return "intermediaria";
}

export function ancoraDoExtrato(entrada: {
  saldo: number | null | undefined;
  dtasof: string | null | undefined;
  dtstart: string | null | undefined;
  dtend: string | null | undefined;
}): AncoraDoExtrato | null {
  const saldo = entrada.saldo;
  if (saldo === null || saldo === undefined || !Number.isFinite(saldo)) return null;

  const dtstart = DATA.test(entrada.dtstart ?? "") ? (entrada.dtstart as string) : "";
  const dtend = DATA.test(entrada.dtend ?? "") ? (entrada.dtend as string) : "";
  let dtasof = DATA.test(entrada.dtasof ?? "") ? (entrada.dtasof as string) : "";
  let dtasofAssumido = false;
  if (!dtasof) {
    if (!dtend) return null;
    dtasof = dtend;
    dtasofAssumido = true;
  }

  const posicao = posicaoDaAncora(dtasof, dtstart, dtend);
  const em = posicao === "abertura" && dtstart && dtasof === dtstart ? diaAnterior(dtasof) : dtasof;
  return { valor: saldo, em, posicao, dtasof, dtasofAssumido };
}

export type MovimentoParaSaldo = { data: string; valor: number };

const centavos = (n: number) => Math.round(n * 100) / 100;

export function saldosApos(movimentos: MovimentoParaSaldo[], ancora: Pick<AncoraDoExtrato, "valor" | "em">): number[] {
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

/**
 * BALAMT pela gramática brasileira: o separador que aparece por ÚLTIMO é o
 * decimal ("1.234,56" e "1234,56" não perdem os centavos; "1234.56" segue
 * exato). Vazio ou lixo: `null` — nunca zero, porque zero é um saldo.
 */
export function valorDeclarado(bruto: string | null | undefined): number | null {
  const t = (bruto ?? "").trim();
  if (!t) return null;
  const temVirgula = t.includes(",");
  const temPonto = t.includes(".");
  let norm = t;
  if (temVirgula && temPonto) {
    norm = t.lastIndexOf(",") > t.lastIndexOf(".")
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");
  } else if (temVirgula) {
    norm = t.replace(",", ".");
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}
