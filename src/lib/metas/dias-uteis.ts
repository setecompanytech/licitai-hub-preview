/**
 * Dias úteis no fuso do negócio (America/Sao_Paulo).
 *
 * Decisão (6): dia útil = segunda a sexta, menos as datas cadastradas em
 * `comercial_feriados`. Com a tabela vazia, o cálculo é só seg–sex.
 *
 * As datas trafegam como `YYYY-MM-DD` e são tratadas como datas civis, sem
 * hora. Isso evita o clássico erro de `new Date('2026-08-03')` ser interpretado
 * como UTC e "voltar um dia" no horário de Brasília.
 */

export type DataCivil = string; // 'YYYY-MM-DD'

const MS_DIA = 86_400_000;

/** Converte 'YYYY-MM-DD' em Date ancorada ao meio-dia UTC, imune a fuso. */
function paraData(iso: DataCivil): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
}

function paraIso(d: Date): DataCivil {
  return d.toISOString().slice(0, 10);
}

/** Sábado ou domingo? */
export function ehFimDeSemana(iso: DataCivil): boolean {
  const dia = paraData(iso).getUTCDay();
  return dia === 0 || dia === 6;
}

/** Dia útil = não é fim de semana e não está na lista de feriados. */
export function ehDiaUtil(iso: DataCivil, feriados: Iterable<DataCivil> = []): boolean {
  if (ehFimDeSemana(iso)) return false;
  const conjunto = feriados instanceof Set ? feriados : new Set(feriados);
  return !conjunto.has(iso);
}

/** Dias úteis no intervalo, incluindo as duas pontas. Intervalo invertido = 0. */
export function contarDiasUteis(
  inicio: DataCivil,
  fim: DataCivil,
  feriados: Iterable<DataCivil> = [],
): number {
  const conjunto = feriados instanceof Set ? feriados : new Set(feriados);
  const dInicio = paraData(inicio);
  const dFim = paraData(fim);
  if (dInicio > dFim) return 0;

  let total = 0;
  for (let t = dInicio.getTime(); t <= dFim.getTime(); t += MS_DIA) {
    if (ehDiaUtil(paraIso(new Date(t)), conjunto)) total += 1;
  }
  return total;
}

export function primeiroDiaDoMes(ano: number, mes: number): DataCivil {
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

export function ultimoDiaDoMes(ano: number, mes: number): DataCivil {
  const ultimo = new Date(Date.UTC(ano, mes, 0, 12)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

/**
 * Reparte o mês em decorrido e restante a partir de uma data de referência.
 * O próprio dia de referência conta como decorrido — o trabalho dele já rendeu.
 */
export function repartirMes(
  ano: number,
  mes: number,
  hoje: DataCivil,
  feriados: Iterable<DataCivil> = [],
): { decorridos: number; restantes: number; totais: number } {
  const conjunto = feriados instanceof Set ? feriados : new Set(feriados);
  const primeiro = primeiroDiaDoMes(ano, mes);
  const ultimo = ultimoDiaDoMes(ano, mes);

  const totais = contarDiasUteis(primeiro, ultimo, conjunto);

  // Referência fora do mês: antes = nada decorrido; depois = mês inteiro.
  if (hoje < primeiro) return { decorridos: 0, restantes: totais, totais };
  if (hoje > ultimo) return { decorridos: totais, restantes: 0, totais };

  const decorridos = contarDiasUteis(primeiro, hoje, conjunto);
  return { decorridos, restantes: totais - decorridos, totais };
}
