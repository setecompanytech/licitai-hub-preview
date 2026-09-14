/**
 * Formatos da aba "Robô de Lances" do processo — dinheiro e horário.
 *
 * Horário SEMPRE com fuso explícito. A sessão do robô é gravada pelo agente
 * em UTC; sem `timeZone`, quem abre a pasta de outro fuso (ou de um navegador
 * com o relógio do sistema errado) lê "lance às 13:02" para um lance dado às
 * 10:02 de Brasília — e numa disputa de segundos isso decide o que se entende
 * que aconteceu. A tela sempre acompanha o horário do rótulo "horário de
 * Brasília".
 *
 * Ausência devolve `null`, nunca "R$ 0,00": zero é uma afirmação sobre
 * dinheiro, e o que chega nulo aqui é "o portal não informou".
 */

const FUSO_DE_BRASILIA = 'America/Sao_Paulo';
const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(valor: number | string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? MOEDA.format(n) : null;
}

/** Percentual 0–100, como a disputa grava (`1.5` = 1,5%) — nunca fração. */
export function formatarPercentual(valor: number | string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : null;
}

function paraData(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "10:02:13" no horário de Brasília. */
export function horaDeBrasilia(valor: string | Date | null | undefined): string | null {
  const d = paraData(valor);
  if (!d) return null;
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: FUSO_DE_BRASILIA,
  });
}

/** "14/09/2026 às 10:02" (ou "…10:02:13" com segundos) no horário de Brasília. */
export function dataHoraDeBrasilia(
  valor: string | Date | null | undefined,
  { segundos = false }: { segundos?: boolean } = {},
): string | null {
  const d = paraData(valor);
  if (!d) return null;
  const data = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUSO_DE_BRASILIA,
  });
  const hora = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    ...(segundos ? { second: '2-digit' as const } : {}),
    timeZone: FUSO_DE_BRASILIA,
  });
  return `${data} às ${hora}`;
}
