import { cn } from '@/lib/utils';

interface PraefectusLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Use light variant for dark backgrounds */
  variant?: 'default' | 'light';
}

const sizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export default function PraefectusLogo({ size = 'md', className, variant = 'default' }: PraefectusLogoProps) {
  const navyColor = variant === 'light' ? 'text-white' : 'text-primary';
  const goldColor = 'text-accent';

  return (
    <span
      className={cn(
        'font-brand font-bold tracking-[0.18em] uppercase select-none',
        sizeClasses[size],
        className
      )}
      style={{ fontVariant: 'small-caps' }}
    >
      <span className={navyColor}>Prae</span>
      <span className={goldColor}>fectus</span>
    </span>
  );
}
