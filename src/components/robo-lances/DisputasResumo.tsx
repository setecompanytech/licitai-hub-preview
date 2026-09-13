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

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const statusVariant: Record<string, BadgeVariant> = {
  ativo: 'info',
  vencendo: 'success',
  perdendo: 'warning',
  aguardando: 'muted',
  encerrado: 'muted',
};

/** O selo nunca sai em caixa baixa: "ativo" aqui e "Ativo" na lista ao lado
 *  eram a mesma coisa escrita de dois jeitos na mesma dobra. */
const rotuloStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Zap className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold">
          {ativas.length} disputa(s) simultânea(s)
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          Total em referência: {formatCurrency(totalValor)}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ativas.map((lance) => {
          const Icon = statusIcon[lance.status] || Pause;
          return (
            <button
              key={lance.id}
              type="button"
              onClick={() => onSelect(lance.id)}
              aria-pressed={selectedId === lance.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                selectedId === lance.id
                  ? 'bg-primary-tint border-primary/40 text-primary'
                  : 'bg-card border-border hover:bg-muted text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="font-medium">{lance.edital}</span>
              <Badge variant={statusVariant[lance.status] || 'muted'}>
                {lance.status === 'ativo' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" aria-hidden="true" />}
                {rotuloStatus(lance.status)}
              </Badge>
              <span className="text-muted-foreground tabular-nums">{formatCurrency(lance.valorReferencia)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
