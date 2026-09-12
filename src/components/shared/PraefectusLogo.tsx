import BrandLogo from './BrandLogo';

/**
 * Casca de compatibilidade sobre o BrandLogo (identidade 12/09/2026): as
 * telas antigas pedem tamanho por nome e variante no vocabulário antigo
 * ('light' = sobre fundo escuro). Ponto novo de marca usa BrandLogo direto.
 */
interface PraefectusLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Use light variant for dark backgrounds */
  variant?: 'default' | 'light';
}

const LARGURAS: Record<NonNullable<PraefectusLogoProps['size']>, number> = {
  sm: 120,
  md: 150,
  lg: 180,
  xl: 220,
};

export default function PraefectusLogo({ size = 'md', className, variant = 'default' }: PraefectusLogoProps) {
  return (
    <BrandLogo
      variant={variant === 'light' ? 'dark' : 'light'}
      width={LARGURAS[size]}
      className={className}
    />
  );
}
