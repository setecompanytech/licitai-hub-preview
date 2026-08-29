/**
 * A data de hoje segundo o relógio de quem está usando o sistema.
 *
 * O Financeiro chamava `new Date().toISOString().slice(0, 10)` para saber que
 * dia é hoje. `toISOString()` devolve UTC, e o Brasil está três horas atrás:
 * às 21h em Belém já é o dia seguinte em Londres. A partir desse horário a
 * tela passava a mostrar os vencimentos de AMANHÃ em "Receber hoje", e os de
 * hoje apareciam como atraso — a conta a pagar do dia virava pendência antes
 * mesmo de o dia acabar.
 *
 * Não é um erro de arredondamento: é um dia inteiro de diferença, todo dia,
 * das 21h à meia-noite. E some quando alguém vai conferir de manhã, o que o
 * torna especialmente difícil de acreditar quando relatado.
 *
 * `hojeLocal()` monta a data a partir dos componentes locais, sem passar por
 * UTC. `somarDiasLocal()` faz o mesmo para janelas — e usa meio-dia como
 * âncora, para que o horário de verão (que tira ou põe uma hora à meia-noite)
 * não empurre o resultado para o dia vizinho.
 */

/** Formata um `Date` como AAAA-MM-DD usando os componentes LOCAIS. */
export function dataLocal(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * O caminho de volta: AAAA-MM-DD para `Date`, no fuso local.
 *
 * `new Date('2026-08-29')` é interpretado como meia-noite UTC — no Brasil,
 * 21h do dia 28. Todo cálculo que parte de uma data ISO precisa disto, ou
 * repete o mesmo erro de um dia que `dataLocal` existe para evitar.
 *
 * Meio-dia como âncora, pela mesma razão de `somarDiasLocal`: a virada do
 * horário de verão acontece na madrugada.
 */
export function deDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 12, 0, 0, 0);
}

/** Hoje, no fuso de quem está olhando a tela. */
export function hojeLocal(): string {
  return dataLocal(new Date());
}

/** A data N dias à frente (ou atrás, com N negativo), no fuso local. */
export function somarDiasLocal(dias: number, base = new Date()): string {
  // Meio-dia como âncora: virada de horário de verão acontece na madrugada e
  // deslocaria uma data ancorada em 00:00 para o dia anterior ou seguinte.
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

/** O mês corrente como AAAA-MM, no fuso local. */
export function mesLocal(base = new Date()): string {
  return dataLocal(base).slice(0, 7);
}
