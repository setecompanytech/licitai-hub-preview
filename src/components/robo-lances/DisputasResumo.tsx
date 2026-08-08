import { Badge } from '@/components/ui/badge';
import { Zap, Play, Pause, Trophy, XCircle } from 'lucide-react';
import type { LanceConfig } from './ConfigurarLanceDialog';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusIcon: Record<string, typeof Zap> = {
  ativo: Play,
  vencendo: Trophy,
  perdendo: XCircle,
  aguardando: Pause,
  encerrado: XCircle,
};

const statusColor: Record<string, string> = {
  ativo: 'bg-info/15 text-info border-info/30',
  vencendo: 'bg-success/15 text-success border-success/30',
  perdendo: 'bg-warning/15 text-warning border-warning/30',
  aguardando: 'bg-muted text-muted-foreground border-border',
  encerrado: 'bg-secondary text-secondary-foreground border-border',
};

type Props = {
  lances: LanceConfig[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

export default function DisputasResumo({ lances, onSelect, selectedId }: Props) {
  const ativas = lances.filter(l => l.status === 'ativo' || l.status === 'vencendo' || l.status === 'perdendo');
  const totalValor = ativas.reduce((s, l) => s + l.valorReferencia, 0);

  if (ativas.length === 0) return null;

  return (
    <div className="border-b border-border bg-card/80 px-4 py-2">
      <div className="flex items-center gap-3 mb-2">
        <Zap className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold">
          {ativas.length} disputa(s) simultânea(s)
        </span>
        <span className="text-xs text-muted-foreground">
          Total em referência: {formatCurrency(totalValor)}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ativas.map((lance) => {
          const Icon = statusIcon[lance.status] || Pause;
          return (
            <button
              key={lance.id}
              onClick={() => onSelect(lance.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all whitespace-nowrap ${
                selectedId === lance.id
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-muted/30 border-border/50 hover:bg-muted/60 text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="font-medium">{lance.edital}</span>
              <Badge variant="outline" className={`text-xs scale-90 ${statusColor[lance.status]}`}>
                {lance.status === 'ativo' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
                {lance.status}
              </Badge>
              <span className="text-muted-foreground font-mono">{formatCurrency(lance.valorReferencia)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
