import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: string;
  className?: string;
  compact?: boolean;
}

function getTimeRemaining(target: string) {
  const now = new Date().getTime();
  const end = new Date(target).getTime();
  const diff = end - now;

  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };

  return {
    expired: false,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    total: diff,
  };
}

export default function CountdownTimer({ targetDate, className, compact = false }: CountdownTimerProps) {
  const [time, setTime] = useState(getTimeRemaining(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (time.expired) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <CheckCircle2 className="w-3 h-3" /> Encerrado
      </span>
    );
  }

  const isUrgent = time.days === 0 && time.hours < 24;
  const isCritical = time.days === 0 && time.hours < 6;

  if (compact) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-xs font-mono font-medium',
        isCritical ? 'text-destructive animate-pulse' : isUrgent ? 'text-warning' : 'text-accent',
        className
      )}>
        {isCritical && <AlertTriangle className="w-3 h-3" />}
        {!isCritical && <Clock className="w-3 h-3" />}
        {time.days > 0 && `${time.days}d `}
        {String(time.hours).padStart(2, '0')}:{String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {[
        { value: time.days, label: 'd' },
        { value: time.hours, label: 'h' },
        { value: time.minutes, label: 'm' },
        { value: time.seconds, label: 's' },
      ].map((unit) => (
        <div
          key={unit.label}
          className={cn(
            'flex flex-col items-center rounded-md px-1.5 py-1 min-w-[32px] border',
            isCritical
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : isUrgent
              ? 'bg-warning/10 border-warning/30 text-warning'
              : 'bg-accent/10 border-accent/30 text-accent'
          )}
        >
          <span className="text-sm font-bold font-mono leading-none">{String(unit.value).padStart(2, '0')}</span>
          <span className="text-xs uppercase opacity-70">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
