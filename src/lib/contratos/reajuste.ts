/**
 * Reajuste em sentido estrito — a régua do interregno anual.
 *
 * A inflação rotineira do contrato se recompõe pelo índice previsto na
 * cláusula (Lei 14.133/2021, art. 92, §3º), respeitado o interregno MÍNIMO de
 * 1 ano contado da data-base (Lei 10.192/2001, arts. 2º-3º — periodicidade
 * menor é nula). A aplicação é por simples apostila (art. 136, I), sem termo
 * aditivo — mas a orientação prática do TCU ao contratado é pedir formalmente
 * e em tempo hábil, ANTES de assinar qualquer aditivo: prorrogação aceita sem
 * ressalva pode ser lida como renúncia (preclusão lógica, Parecer AGU 3/2023).
 *
 * O marco da contagem anda: nasce na data-base da cláusula e, a cada reajuste
 * registrado, recomeça na data dele. Sem data-base registrada a régua NÃO
 * calcula — palpite de data geraria alerta em dia errado, e alerta errado
 * ensina a ignorar os certos.
 */

export type SituacaoDoReajuste = {
  /** De onde a contagem partiu: a data-base ou o último reajuste registrado. */
  marco: string;
  /** true quando o marco veio de um reajuste já registrado, não da data-base. */
  marcoEhReajusteAnterior: boolean;
  /** O aniversário: marco + 12 meses. */
  aniversario: string;
  /** O interregno se cumpriu — o reajuste é devido desde `aniversario`. */
  devido: boolean;
  /** Quantos meses inteiros se passaram desde o aniversário (0 quando não devido). */
  mesesDesdeAniversario: number;
};

/** Soma meses a uma data ISO (YYYY-MM-DD), com o fim de mês preso ao mês
 *  certo: 29/02 + 12 meses = 28/02, nunca 01/03. */
export function somarMeses(dataIso: string, meses: number): string {
  const [a, m, d] = dataIso.slice(0, 10).split('-').map(Number);
  const alvoMes = m - 1 + meses;
  const ano = a + Math.floor(alvoMes / 12);
  const mes = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mesesEntre(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = deIso.split('-').map(Number);
  const [a2, m2, d2] = ateIso.split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.max(0, meses);
}

export function situacaoDoReajuste(params: {
  /** Data-base da cláusula (contratos.data_base_reajuste). */
  dataBase: string | null | undefined;
  /** Datas dos reajustes já registrados (aditivos tipo reajuste/repactuação:
   *  data_base_reajuste do aditivo, ou a assinatura na falta dela). */
  reajustesRegistrados?: Array<string | null | undefined>;
  /** Hoje, em YYYY-MM-DD (o chamador decide o fuso — como na vigência). */
  hoje: string;
}): SituacaoDoReajuste | null {
  const base = params.dataBase?.slice(0, 10);
  if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) return null;

  const registrados = (params.reajustesRegistrados ?? [])
    .map((d) => d?.slice(0, 10))
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const ultimo = registrados.length > 0 ? registrados[registrados.length - 1] : null;

  // O marco é o mais recente entre a data-base e o último reajuste: reajuste
  // registrado reinicia a contagem (é assim que o TCU descreve a mecânica).
  const marco = ultimo && ultimo > base ? ultimo : base;
  const aniversario = somarMeses(marco, 12);
  const hoje = params.hoje.slice(0, 10);
  const devido = hoje >= aniversario;

  return {
    marco,
    marcoEhReajusteAnterior: marco !== base,
    aniversario,
    devido,
    mesesDesdeAniversario: devido ? mesesEntre(aniversario, hoje) : 0,
  };
}

/** Valor estimado do reajuste: acumulado de 12 meses do índice sobre o valor.
 *  É ESTIMATIVA para o alerta — o cálculo do requerimento usa a série exata
 *  entre as datas, no simulador. */
export function valorEstimadoDoReajuste(
  valorBase: number,
  acumulado12mPct: number | null | undefined,
): number | null {
  if (!Number.isFinite(valorBase) || valorBase <= 0) return null;
  if (acumulado12mPct == null || !Number.isFinite(acumulado12mPct)) return null;
  return valorBase * (acumulado12mPct / 100);
}
