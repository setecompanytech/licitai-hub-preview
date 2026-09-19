import { cn } from '@/lib/utils';
import type { AnalyticsKpis } from '@/hooks/useAnalyticsData';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type Props = { kpis: AnalyticsKpis };

export default function AnalyticsKpiCards({ kpis }: Props) {
  const itens = [
    { label: 'Ganhas',         valor: kpis.ganhas,                     sub: `Pregões: ${kpis.pregoesGanhos} · Dispensas: ${kpis.dispensasGanhas}` },
    { label: 'Perdidas',       valor: kpis.perdidas,                   sub: undefined },
    { label: 'Em andamento',   valor: kpis.emAndamento,                sub: `${fmt(kpis.valorEmDisputa)} em disputa` },
    { label: 'Taxa de vitória',valor: `${kpis.taxaVitoria}%`,          sub: undefined },
    { label: 'Valor ganho',    valor: fmt(kpis.valorTotalGanho),       sub: 'Adjudicado' },
    { label: 'Pregões',        valor: kpis.pregoes,                    sub: undefined },
    { label: 'Dispensas',      valor: kpis.dispensas,                  sub: undefined },
    { label: 'Total processos',valor: kpis.totalProcessos,             sub: undefined },
  ];

  return (
    <div
      className="ds-kpi-strip"
      style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
    >
      {itens.map((item) => (
        <div key={item.label} className="ds-kpi">
          <div className="ds-kpi__label">{item.label}</div>
          <div className={cn('ds-kpi__value', String(item.valor).length > 8 && 'text-[17px]')}>
            {item.valor}
          </div>
          {item.sub && <div className="ds-kpi__sub">{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}
