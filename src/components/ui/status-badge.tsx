import { cn } from '@/lib/utils';

export type StatusColor = 'green' | 'red' | 'yellow' | 'blue' | 'gray';

interface StatusBadgeProps {
  label: string;
  color: StatusColor;
  className?: string;
}

/**
 * Badge semântico compacto — padrão do design system corporativo.
 * Dot + label em 22px de altura, fundo tingido, borda sutil.
 */
export function StatusBadge({ label, color, className }: StatusBadgeProps) {
  return (
    <span className={cn(`ds-status ds-status--${color}`, className)}>
      {label}
    </span>
  );
}
