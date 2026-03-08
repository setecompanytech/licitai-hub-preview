import { Trophy, XCircle, Clock, Gavel, FileCheck2, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticsKpis } from '@/hooks/useAnalyticsData';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type Props = { kpis: AnalyticsKpis };

export default function AnalyticsKpiCards({ kpis }: Props) {
  const cards = [
    { label: 'Ganhas', value: kpis.ganhas, icon: Trophy, color: 'hsl(142, 71%, 45%)', sub: `Pregões: ${kpis.pregoesGanhos} · Dispensas: ${kpis.dispensasGanhas}` },
    { label: 'Perdidas', value: kpis.perdidas, icon: XCircle, color: 'hsl(0, 72%, 51%)' },
    { label: 'Em Andamento', value: kpis.emAndamento, icon: Clock, color: 'hsl(38, 92%, 50%)', sub: formatCurrency(kpis.valorEmDisputa) + ' em disputa' },
    { label: 'Taxa de Vitória', value: `${kpis.taxaVitoria}%`, icon: TrendingUp, color: 'hsl(174, 72%, 40%)' },
    { label: 'Valor Ganho', value: formatCurrency(kpis.valorTotalGanho), icon: DollarSign, color: 'hsl(210, 100%, 40%)' },
    { label: 'Pregões', value: kpis.pregoes, icon: Gavel, color: 'hsl(280, 60%, 50%)' },
    { label: 'Dispensas', value: kpis.dispensas, icon: FileCheck2, color: 'hsl(174, 72%, 40%)' },
    { label: 'Total Processos', value: kpis.totalProcessos, icon: Activity, color: 'hsl(var(--accent))' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="stat-card group animate-fade-in">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">{card.label}</p>
                <p className="text-lg font-bold mt-0.5 tracking-tight">{card.value}</p>
                {card.sub && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{card.sub}</p>
                )}
              </div>
              <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${card.color}15` }}>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
