import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  /** Token de cor semântica SEM hsl(), ex.: 'var(--success)' — SÓ quando o ícone comunica estado real. */
  accentColor?: string;
  /** 'neutral' = ícone no cinza de texto secundário (padrão da auditoria para ícones sem estado). */
  tone?: 'accent' | 'neutral';
};

export default function StatCard({ label, value, change, changeType = 'neutral', icon: Icon, accentColor, tone = 'accent' }: Props) {
  const base = accentColor ?? (tone === 'neutral' ? 'var(--muted-foreground)' : 'var(--accent)');
  const corIcone = `hsl(${base})`;
  const corFundo = tone === 'neutral' && !accentColor ? 'hsl(var(--muted))' : `hsl(${base} / 0.12)`;
  return (
    <div className="stat-card group animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 tracking-tight break-all">{value}</p>
          {change && (
            <p
              className={cn(
                'text-xs sm:text-xs font-medium mt-0.5 sm:mt-1 break-words leading-snug',
                changeType === 'positive' && 'text-success',
                changeType === 'negative' && 'text-destructive',
                changeType === 'neutral' && 'text-muted-foreground'
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div
          className="p-1.5 sm:p-2.5 rounded-lg flex-shrink-0"
          style={{ background: corFundo }}
        >
          <Icon
            className="w-4 h-4 sm:w-5 sm:h-5"
            style={{ color: corIcone }}
          />
        </div>
      </div>
    </div>
  );
}
