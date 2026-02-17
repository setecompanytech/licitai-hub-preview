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
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
          {change && (
            <p
              className={cn(
                'text-xs font-medium mt-1',
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
          className="p-2.5 rounded-lg"
          style={{ background: accentColor ? `${accentColor}15` : 'hsl(var(--accent) / 0.1)' }}
        >
          <Icon
            className="w-5 h-5"
            style={{ color: accentColor || 'hsl(var(--accent))' }}
          />
        </div>
      </div>
    </div>
  );
}
