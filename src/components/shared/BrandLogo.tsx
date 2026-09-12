import { cn } from '@/lib/utils';

/**
 * BrandLogo — a marca Praefectus (identidade 12/09/2026).
 *
 * O repositório não tem arquivo SVG/PNG da marca; o símbolo abaixo foi
 * vetorizado aqui a partir da prancha aprovada (dois arcos e um pequeno
 * quadrado). Quando o arquivo oficial existir, os paths deste componente são
 * o único lugar a substituir — todos os pontos do app passam por aqui.
 *
 * Versões (cores da prancha, fixas nos dois temas — por isso os tokens
 * `--brand-*`, que não mudam no dark):
 *  - principal (variant="light", fundo claro): nome e arco superior navy
 *    #102A43; arco inferior e quadrado verde #087F5B.
 *  - fundo escuro (variant="dark"): nome, arco superior e quadrado brancos;
 *    arco inferior verde.
 *
 * A proporção é fixa (altura acompanha a largura); nunca esticar, recortar
 * ou sombrear. Área livre mínima ao redor: a largura do quadrado do símbolo.
 */
interface BrandLogoProps {
  /** 'light' = versão principal, para fundo claro; 'dark' = para fundo escuro. */
  variant?: 'light' | 'dark';
  /** 'full' = símbolo + nome; 'symbol' = só o símbolo (menu recolhido, favicon). */
  mode?: 'full' | 'symbol';
  /** Largura em px. Alternativa: dimensionar via `className` (w-[200px] etc.). */
  width?: number;
  className?: string;
  /** Nome acessível do desenho. */
  label?: string;
}

export default function BrandLogo({
  variant = 'light',
  mode = 'full',
  width,
  className,
  label = 'Praefectus',
}: BrandLogoProps) {
  const principal = variant === 'light';
  const nomeEArcoSuperior = principal ? 'hsl(var(--brand-navy))' : 'white';
  const arcoInferior = 'hsl(var(--brand-green))';
  const quadrado = principal ? 'hsl(var(--brand-green))' : 'white';

  return (
    <svg
      viewBox={mode === 'full' ? '0 15 326 47' : '0 15 88 44'}
      width={width}
      role="img"
      aria-label={label}
      className={cn('h-auto select-none', className)}
    >
      <rect x="2" y="39" width="13" height="13" rx="2.5" fill={quadrado} />
      <path
        d="M21 52 A30 30 0 0 1 81 52"
        fill="none"
        stroke={nomeEArcoSuperior}
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M38 52 A16 16 0 0 1 70 52"
        fill="none"
        stroke={arcoInferior}
        strokeWidth="11"
        strokeLinecap="round"
      />
      {mode === 'full' && (
        <text
          x="100"
          y="52"
          fontFamily="'Manrope', 'Inter', ui-sans-serif, sans-serif"
          fontWeight={800}
          fontSize="40"
          letterSpacing="-0.8"
          fill={nomeEArcoSuperior}
          textLength="224"
          lengthAdjust="spacingAndGlyphs"
        >
          praefectus
        </text>
      )}
    </svg>
  );
}
