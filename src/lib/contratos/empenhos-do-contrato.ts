/**
 * O que os empenhos de um contrato somam (28/09/2026). A tira da aba Pedidos
 * dizia só "13 empenhos registrados"; quem gere o contrato quer saber quanto
 * está empenhado, que fração do valor global isso cobre e quanto ainda falta
 * o órgão empenhar. Puro: a tela só chama.
 */
export type EmpenhoParaSomar = { vigente: number; cancelado: boolean };

export type ResumoDosEmpenhos = {
  quantidade: number;
  ativos: number;
  cancelados: number;
  /** Soma do valor VIGENTE (original + reforços − anulações) dos empenhos não cancelados. */
  empenhado: number;
  /** empenhado ÷ valor global, em %; nulo sem valor global. */
  cobertura: number | null;
  /** valor global − empenhado; nunca negativo (excesso vira `excesso`). */
  aEmpenhar: number | null;
  /** quanto o empenhado passa do valor global, quando passa. */
  excesso: number;
};

export function resumoDosEmpenhos(empenhos: EmpenhoParaSomar[], valorGlobal: number | null | undefined): ResumoDosEmpenhos {
  const ativos = empenhos.filter((e) => !e.cancelado);
  const empenhado = Math.round(ativos.reduce((s, e) => s + (Number(e.vigente) || 0), 0) * 100) / 100;
  const global = Number(valorGlobal) || 0;
  const cobertura = global > 0 ? Math.round((empenhado / global) * 1000) / 10 : null;
  return {
    quantidade: empenhos.length,
    ativos: ativos.length,
    cancelados: empenhos.length - ativos.length,
    empenhado,
    cobertura,
    aEmpenhar: global > 0 ? Math.max(0, Math.round((global - empenhado) * 100) / 100) : null,
    excesso: global > 0 && empenhado > global ? Math.round((empenhado - global) * 100) / 100 : 0,
  };
}

const brl = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0|\u202f/g, ' ');

/** A linha de detalhe da tira: "13 empenhos · 12,3% do valor global · a empenhar R$ 1.522.…". */
export function detalheDosEmpenhos(r: ResumoDosEmpenhos): string {
  const partes = [`${r.ativos} empenho(s) vigente(s)${r.cancelados ? `, ${r.cancelados} cancelado(s)` : ''}`];
  if (r.cobertura !== null) partes.push(`${r.cobertura.toLocaleString('pt-BR')}% do valor global`);
  if (r.excesso > 0) partes.push(`${brl(r.excesso)} ACIMA do valor global`);
  else if (r.aEmpenhar !== null) partes.push(`a empenhar ${brl(r.aEmpenhar)}`);
  return partes.join(' · ');
}
