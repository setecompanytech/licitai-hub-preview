/**
 * Um índice por sigla, o mês mais novo.
 *
 * `indices_economicos` guarda cada mês em linha própria (a atualização apaga
 * e reinsere só o mês corrente), então INPC de jul e de ago convivem na
 * tabela. Toda tela que lista "os índices" mostra a última leitura de cada um
 * (27/09/2026: esteira, cartões e chips do Apoio Jurídico repetiam INPC,
 * IPCA e SELIC).
 */
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "ago/2026" → número ordenável; formato desconhecido vale 0 (fica atrás). */
export function ordemDoPeriodo(periodo: string | null | undefined): number {
  const [m, a] = String(periodo ?? '').toLowerCase().split('/');
  const mes = MESES_ABREV.indexOf(m);
  const ano = Number(a);
  if (!Number.isFinite(ano) || mes < 0) return 0;
  return ano * 12 + mes;
}

export function indicesMaisRecentes<T extends { sigla: string; periodo: string }>(indices: T[]): T[] {
  const porSigla = new Map<string, T>();
  for (const i of indices) {
    const atual = porSigla.get(i.sigla);
    if (!atual || ordemDoPeriodo(i.periodo) > ordemDoPeriodo(atual.periodo)) porSigla.set(i.sigla, i);
  }
  return [...porSigla.values()];
}
