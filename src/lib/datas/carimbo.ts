/**
 * Carimbo de "quando este dado foi atualizado".
 *
 * Nasceu de um defeito do painel: o selo da sincronização do PNCP mostrava
 * apenas `HH:mm`. Uma coleta de três dias atrás aparecia como "Sync: 14:20" e
 * passava por recente — o pior erro possível num dado de FRESCOR, porque a
 * pessoa decide o dia inteiro com base nele (se vale a pena procurar edital
 * novo, se a base está no ar).
 *
 * A distância é contada por DIA de calendário, não por horas: uma coleta de
 * ontem às 23h é "ontem", mesmo faltando poucas horas para ela.
 */

/** "hoje, 13/09/2026 14:20" · "ontem, …" · "11/09/2026 14:20 — há 2 dias". */
export function carimboDeAtualizacao(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data de sincronização inválida';

  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const dias = Math.round((hoje - dia) / 86400000);

  const quando = d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Data no futuro (relógio do servidor adiantado) não vira "há -1 dias":
  // cai em "hoje", que é o que a pessoa consegue usar.
  if (dias <= 0) return `hoje, ${quando}`;
  if (dias === 1) return `ontem, ${quando}`;
  return `${quando} — há ${dias} dias`;
}
