import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tom do ícone. Semântico SÓ quando o ícone comunica estado real
 * (andamento/ganho/perda); o resto fica neutro — regra da auditoria de cor.
 * Cada tom é um par fundo-tinta da paleta (identidade 12/09), nunca cor
 * escrita à mão.
 */
export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive';

const TONS: Record<StatTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success-ink',
  warning: 'bg-warning-tint text-warning-ink',
  destructive: 'bg-destructive-tint text-destructive-ink',
};

type Props = {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  /** 'neutral' = ícone no cinza de texto secundário (padrão para ícones sem estado). */
  tone?: StatTone;
};

export default function StatCard({ label, value, change, changeType = 'neutral', icon: Icon, tone = 'primary' }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground font-medium truncate">{label}</p>
          {/* `break-all` quebrava em QUALQUER ponto, inclusive no meio da palavra:
              "R$ 540 mil" virava "R$ 540 m" / "il". Valor de dinheiro não se
              parte — daí o nowrap, com a fonte tabular para os dígitos alinharem
              entre cartões. KPI na régua: 32/40. */}
          <p className="text-[2rem] leading-10 font-bold tabular-nums mt-1 whitespace-nowrap">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                'text-xs mt-1 break-words',
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
          aria-hidden="true"
          className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md', TONS[tone])}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
