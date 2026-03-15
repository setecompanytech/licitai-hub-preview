import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  accentColor?: string;
};

export default function StatCard({ label, value, change, changeType = 'neutral', icon: Icon, accentColor }: Props) {
  return (
    <div className="stat-card group animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 tracking-tight break-all">{value}</p>
          {change && (
            <p
              className={cn(
                'text-[10px] sm:text-xs font-medium mt-0.5 sm:mt-1 break-words leading-snug',
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
          style={{ background: accentColor ? `${accentColor}15` : 'hsl(var(--accent) / 0.1)' }}
        >
          <Icon
            className="w-4 h-4 sm:w-5 sm:h-5"
            style={{ color: accentColor || 'hsl(var(--accent))' }}
          />
        </div>
      </div>
    </div>
  );
}
