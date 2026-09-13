import { cn } from '@/lib/utils';

/**
 * BrandLogo — a marca Praefectus (prancha oficial recebida em 12/09/2026).
 *
 * O símbolo são dois arcos AFILADOS (crescentes: grossos no meio, ponta fina
 * no lado direito do navy e no esquerdo do verde, pé rombudo nos outros dois
 * extremos) e um pequeno quadrado. Os paths abaixo foram vetorizados da
 * prancha aprovada e conferidos lado a lado com ela; os mesmos paths geram o
 * favicon.svg, os arquivos de public/marca/ e os ícones PWA — mudou aqui,
 * regenerar lá (scripts/gerar-icones-marca.py).
 *
 * Versões (cores fixas nos dois temas — por isso os tokens `--brand-*`, que
 * não são redefinidos no bloco dark):
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

/** Geometria oficial do símbolo — compartilhada com favicon e ícones. */
export const SIMBOLO_PATHS = {
  arcoSuperior: 'M4 60 A44 44 0 0 1 90 49 A47 47 0 0 0 12 65.5 Z',
  arcoInferior: 'M30 47 A28 28 0 0 1 80 66 L74 68 A30 30 0 0 0 30 47 Z',
  quadrado: { x: 34, y: 52, lado: 12, raio: 2.5 },
} as const;

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
  const q = SIMBOLO_PATHS.quadrado;

  return (
    <svg
      viewBox={mode === 'full' ? '0 12 372 58' : '0 12 94 58'}
      width={width}
      role="img"
      aria-label={label}
      className={cn('h-auto select-none', className)}
    >
      <path d={SIMBOLO_PATHS.arcoSuperior} fill={nomeEArcoSuperior} />
      <path d={SIMBOLO_PATHS.arcoInferior} fill={arcoInferior} />
      <rect x={q.x} y={q.y} width={q.lado} height={q.lado} rx={q.raio} fill={quadrado} />
      {mode === 'full' && (
        <text
          x="110"
          y="62"
          fontFamily="'Manrope', 'Inter', ui-sans-serif, sans-serif"
          fontWeight={800}
          fontSize="46"
          letterSpacing="-0.9"
          fill={nomeEArcoSuperior}
          textLength="252"
          lengthAdjust="spacingAndGlyphs"
        >
          praefectus
        </text>
      )}
    </svg>
  );
}
