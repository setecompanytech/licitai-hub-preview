/**
 * Montagem dos insumos do painel a partir das linhas cruas do banco.
 *
 * Fica fora do componente de propósito: decidir *quais meses contam como
 * histórico* é regra de negócio, não detalhe de renderização, e é onde um erro
 * silencioso distorceria toda a projeção.
 */

import type { DataCivil } from './dias-uteis';
import { paraCentavos } from './dinheiro';
import type { HistoricoMes } from './projecao';

/** Base sobre a qual a meta é medida (espelha `comercial_metas.base_meta`). */
export type BaseMeta = 'faturamento' | 'contratos_ganhos';

/** Linha de `vw_comercial_realizado_mensal`, com valores em REAIS. */
export type LinhaRealizado = {
  user_id: string;
  ano: number;
  mes: number;
  participados: number;
  ganhos: number;
  valor_ganho: number;
  valor_faturado: number;
};

/** Ordena (ano, mes) como um número comparável: 2026-08 → 202608. */
function chaveMes(ano: number, mes: number): number {
  return ano * 100 + mes;
}

/**
 * Primeiro dia do mês em que a janela histórica começa.
 * Janela de 6 meses a partir de agosto/2026 começa em 01/02/2026 — os seis
 * meses FECHADOS anteriores, sem incluir agosto.
 */
export function inicioDaJanela(ano: number, mes: number, janelaMeses: number): DataCivil {
  const totalMeses = ano * 12 + (mes - 1) - janelaMeses;
  const anoInicio = Math.floor(totalMeses / 12);
  const mesInicio = (totalMeses % 12) + 1;
  return `${anoInicio}-${String(mesInicio).padStart(2, '0')}-01`;
}

/**
 * Histórico do colaborador na janela: os meses fechados anteriores ao de
 * referência.
 *
 * O mês de referência fica de fora por decisão explícita — ele está em
 * andamento, e uma taxa de conversão calculada com meio mês de dados puxaria a
 * projeção para baixo justamente quando ela mais importa.
 */
export function filtrarHistorico(
  linhas: LinhaRealizado[],
  params: { userId: string; ano: number; mes: number; janelaMeses: number },
): HistoricoMes[] {
  const { userId, ano, mes, janelaMeses } = params;
  const inicio = inicioDaJanela(ano, mes, janelaMeses);
  const [anoInicio, mesInicio] = inicio.split('-').map(Number);
  const de = chaveMes(anoInicio, mesInicio);
  const ate = chaveMes(ano, mes);

  return linhas
    .filter((l) => l.user_id === userId)
    .filter((l) => {
      const k = chaveMes(l.ano, l.mes);
      return k >= de && k < ate;
    })
    .sort((a, b) => chaveMes(a.ano, a.mes) - chaveMes(b.ano, b.mes))
    .map((l) => ({
      ano: l.ano,
      mes: l.mes,
      participados: l.participados,
      ganhos: l.ganhos,
      valorGanhoCent: paraCentavos(l.valor_ganho),
      valorFaturadoCent: paraCentavos(l.valor_faturado),
    }));
}

/**
 * Realizado do mês de referência, em centavos, conforme a base da meta.
 * Sem linha para o mês, o realizado é zero — a view só materializa meses com
 * movimento.
 */
export function realizadoDoMes(
  linhas: LinhaRealizado[],
  params: { userId: string; ano: number; mes: number; base: BaseMeta },
): number {
  const { userId, ano, mes, base } = params;
  const linha = linhas.find((l) => l.user_id === userId && l.ano === ano && l.mes === mes);
  if (!linha) return 0;
  return paraCentavos(base === 'faturamento' ? linha.valor_faturado : linha.valor_ganho);
}
