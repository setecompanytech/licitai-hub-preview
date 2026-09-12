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
  // Direção LICITA360 (12/09): o acento da marca virou VERDE. Sobre fundo
  // escuro (variant light: splash, login) usa o verde-claro do token
  // `--logo-accent`, afinado para o navy; sobre fundo claro (topbar branca)
  // usa o verde cheio de ação — o claro lavava sobre branco. O nome
  // `goldColor` fica pela história: é a variável do ACENTO da marca.
  const navyColor = variant === 'light' ? 'text-white' : 'text-navy';
  const goldColor = variant === 'light' ? 'text-gold-logo' : 'text-accent';

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
