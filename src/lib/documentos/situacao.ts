import { DIAS_DE_ANTECEDENCIA, diasAteVencer, prazoPorExtenso } from './lembretes';

/**
 * Em que situação a validade coloca um documento — a régua que o painel e o
 * calendário compartilham.
 *
 * NÃO reimplementa a conta de dias: ela já existe em `./lembretes`
 * (`diasAteVencer`), contada por DATA, sem hora e sem deslocamento de fuso. É
 * exatamente a conta que faltava no calendário, e ter uma segunda cópia aqui
 * seria repetir o erro que o vocabulário de status já pagou.
 *
 * O que este arquivo acrescenta é a CLASSIFICAÇÃO, que não existia:
 *
 *   1. "VENCE HOJE" não era uma categoria. A `calcDocStatus` do calendário
 *      tinha três estados ('ok' | 'vencendo' | 'vencido') e o documento que
 *      vence hoje caía em 'vencendo', no mesmo balde dos 30 dias seguintes —
 *      o único dia em que ainda dá para protocolar recebia o aviso de um
 *      prazo de um mês.
 *
 *   2. A comparação era com hora. `new Date(validade) < new Date()` põe a
 *      validade na meia-noite e o "agora" na hora corrente: às 9h da manhã,
 *      um documento válido o dia inteiro já aparecia VENCIDO.
 *
 * `validade` sem data reconhecível devolve `null` em `situacaoDaValidade` —
 * "não sei" não pode virar "vencido" nem "regular".
 */

export type SituacaoValidade = 'ok' | 'vencendo' | 'vence_hoje' | 'vencido';

export { DIAS_DE_ANTECEDENCIA, diasAteVencer };

const SO_DATA = /(\d{4})-(\d{2})-(\d{2})/;

/**
 * A validade como DIA no fuso de quem lê — meia-noite local.
 *
 * Use sempre isto para FORMATAR a data: `new Date('2026-09-13')` é meia-noite
 * UTC e, em Belém (UTC-3), imprime 12/09 — o dia anterior ao cadastrado.
 * `documentos.validade` é coluna `date` e chega exatamente nesse formato.
 */
export function diaDaValidade(valor: string): Date {
  const m = String(valor).match(SO_DATA);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(valor);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function situacaoDaValidade(
  valor: string,
  opcoes?: { diasDeAlerta?: number; hoje?: Date },
): SituacaoValidade | null {
  const dias = diasAteVencer(valor, opcoes?.hoje ?? new Date());
  if (dias === null) return null;
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'vence_hoje';
  return dias <= (opcoes?.diasDeAlerta ?? DIAS_DE_ANTECEDENCIA) ? 'vencendo' : 'ok';
}

/** Ordem de urgência — o que já venceu primeiro, o que está em dia por último. */
export const ORDEM_DE_URGENCIA: Record<SituacaoValidade, number> = {
  vencido: 0,
  vence_hoje: 1,
  vencendo: 2,
  ok: 3,
};

/** Quem precisa de atenção agora. */
export function exigeAtencao(situacao: SituacaoValidade): boolean {
  return situacao !== 'ok';
}

/** O selo curto de cada situação — o mesmo texto no painel e no calendário. */
export const ROTULO_DA_SITUACAO: Record<SituacaoValidade, string> = {
  vencido: 'Vencido',
  vence_hoje: 'Vence hoje',
  vencendo: 'Vencendo',
  ok: 'Regular',
};

/**
 * A frase do prazo, já diferenciando atraso, dia e futuro. O texto vem de
 * `prazoPorExtenso` (a mesma frase do lembrete de vencimento), com a primeira
 * letra em caixa alta para servir de linha própria.
 */
export function frasePrazo(valor: string, hoje = new Date()): string {
  const dias = diasAteVencer(valor, hoje);
  if (dias === null) return 'Validade não reconhecida';
  const frase = prazoPorExtenso(dias);
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}
