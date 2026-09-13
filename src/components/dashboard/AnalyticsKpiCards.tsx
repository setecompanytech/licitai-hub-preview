import { Trophy, XCircle, Clock, Gavel, FileCheck2, TrendingUp, DollarSign, Activity, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticsKpis } from '@/hooks/useAnalyticsData';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type Props = { kpis: AnalyticsKpis };

/** Tom do ícone: semântico só onde há estado real (ganho/perda/andamento). */
type Tom = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive';

const TONS: Record<Tom, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success-ink',
  warning: 'bg-warning-tint text-warning-ink',
  destructive: 'bg-destructive-tint text-destructive-ink',
};

interface Cartao {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tom: Tom;
  sub?: string;
}

export default function AnalyticsKpiCards({ kpis }: Props) {
  const cards: Cartao[] = [
    { label: 'Ganhas', value: kpis.ganhas, icon: Trophy, tom: 'success', sub: `Pregões: ${kpis.pregoesGanhos} · Dispensas: ${kpis.dispensasGanhas}` },
    { label: 'Perdidas', value: kpis.perdidas, icon: XCircle, tom: 'destructive' },
    { label: 'Em Andamento', value: kpis.emAndamento, icon: Clock, tom: 'warning', sub: formatCurrency(kpis.valorEmDisputa) + ' em disputa' },
    { label: 'Taxa de Vitória', value: `${kpis.taxaVitoria}%`, icon: TrendingUp, tom: 'primary' },
    { label: 'Valor Ganho', value: formatCurrency(kpis.valorTotalGanho), icon: DollarSign, tom: 'primary' },
    { label: 'Pregões', value: kpis.pregoes, icon: Gavel, tom: 'neutral' },
    { label: 'Dispensas', value: kpis.dispensas, icon: FileCheck2, tom: 'neutral' },
    { label: 'Total Processos', value: kpis.totalProcessos, icon: Activity, tom: 'neutral' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 [&>*]:min-w-0">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-lg border border-border bg-card p-6 shadow-sm animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground font-medium truncate">{card.label}</p>
                <p className="text-[2rem] leading-10 font-bold tabular-nums mt-1 whitespace-nowrap">{card.value}</p>
                {card.sub && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{card.sub}</p>
                )}
              </div>
              <div
                aria-hidden="true"
                className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md', TONS[card.tom])}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
