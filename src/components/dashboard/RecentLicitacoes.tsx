import { licitacoesMock } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, MapPin } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string }> = {
  monitorando: { label: 'Monitorando', className: 'bg-info/10 text-info border-info/20' },
  analisando: { label: 'Analisando', className: 'bg-warning/10 text-warning border-warning/20' },
  proposta: { label: 'Proposta', className: 'bg-primary/10 text-primary border-primary/20' },
  enviada: { label: 'Enviada', className: 'bg-accent/10 text-accent border-accent/20' },
  vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function RecentLicitacoes() {
  const recent = licitacoesMock.slice(0, 5);

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Licitações Recentes</h3>
        <span className="text-xs text-muted-foreground">Últimas 5</span>
      </div>
      <div className="space-y-3">
        {recent.map((lic, i) => {
          const st = statusConfig[lic.status];
          return (
            <div
              key={lic.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* relevance indicator */}
              <div
                className="w-1.5 h-full min-h-[48px] rounded-full flex-shrink-0 mt-1"
                style={{
                  background:
                    lic.relevancia > 80
                      ? 'hsl(var(--success))'
                      : lic.relevancia > 60
                      ? 'hsl(var(--warning))'
                      : 'hsl(var(--muted-foreground))',
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{lic.numero}</span>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', st.className)}>
                    {st.label}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate">{lic.objeto}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {lic.cidade}/{lic.uf}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(lic.dataEncerramento).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="font-semibold text-foreground">{formatCurrency(lic.valor)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
