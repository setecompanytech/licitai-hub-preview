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
  // O dourado da marca agora existe como token. Antes esta linha apontava para
  // `--accent`, que era o laranja — a variável já se chamava `goldColor`, então
  // a intenção era essa desde o começo. No protótipo o dourado é a cor da
  // logo, e só dela.
  const navyColor = variant === 'light' ? 'text-white' : 'text-primary';
  const goldColor = 'text-gold-logo';

  return (
    <span
      className={cn(
        'font-brand font-bold tracking-[0.18em] uppercase select-none',
        sizeClasses[size],
        className
      )}
      style={{ fontVariant: 'small-caps' }}
    >
      <span className={navyColor}>PRAE</span>
      <span className={goldColor}>FECTUS</span>
    </span>
  );
}
