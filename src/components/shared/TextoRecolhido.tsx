import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Texto longo numa célula ou linha de resultado (22/09): recolhido em duas
 * linhas por padrão, com "ver mais" para abrir. A descrição de um item de
 * edital tem vinte linhas de especificação; deixá-la solta na tabela
 * derrubava a coluna e escondia o número ao lado. O texto inteiro fica no
 * `title` enquanto recolhido, e abre no clique — nada é cortado, só dobrado.
 */
const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' } as const;

export default function TextoRecolhido({
  texto,
  linhas = 2,
  limiar = 140,
  className,
}: {
  texto: string | null | undefined;
  linhas?: 1 | 2 | 3;
  /** A partir de quantos caracteres o texto ganha o "ver mais". */
  limiar?: number;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const t = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const longo = t.length > limiar;
  return (
    <span className={cn('block', className)}>
      <span className={cn('block leading-5', longo && !aberto && CLAMP[linhas])} title={longo && !aberto ? t : undefined}>{t}</span>
      {longo && (
        <button
          type="button"
          className="mt-0.5 text-xs font-medium text-primary hover:underline"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
        >
          {aberto ? 'ver menos' : 'ver mais'}
        </button>
      )}
    </span>
  );
}
