import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * TextoExpansivel — objeto de licitação em duas linhas, inteiro a um clique.
 *
 * O comando de 13/09 pede isto duas vezes: "não repetir descrições extensas do
 * processo no cabeçalho — mostrar resumo e permitir expandir" e "descrições
 * extensas truncadas com expansão acessível".
 *
 * Acessível é a parte que costuma faltar. Um `line-clamp` sozinho esconde o
 * texto de quem enxerga e o entrega inteiro ao leitor de tela, o que parece
 * generoso e não é: a pessoa ouve sete linhas de objeto sem ter pedido, e sem
 * saber que havia um botão. Aqui o botão é real, diz o que faz, e `aria-expanded`
 * conta o estado — o mesmo gesto para todo mundo.
 */
interface TextoExpansivelProps {
  texto: string;
  /** Quantas linhas ficam à mostra antes de expandir. */
  linhas?: 1 | 2 | 3 | 4;
  className?: string;
  rotuloAbrir?: string;
  rotuloFechar?: string;
}

const CLAMP = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
} as const;

/** Acima disto vale truncar; abaixo, o botão custaria mais que o texto. */
const LIMIAR_POR_LINHA = 90;

export default function TextoExpansivel({
  texto,
  linhas = 2,
  className,
  rotuloAbrir = 'Ver descrição completa',
  rotuloFechar = 'Recolher descrição',
}: TextoExpansivelProps) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const longo = texto.length > LIMIAR_POR_LINHA * linhas;

  if (!longo) return <p className={cn('g-corpo', className)}>{texto}</p>;

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <p id={id} className={cn('g-corpo', !aberto && CLAMP[linhas])}>
        {texto}
      </p>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={id}
        className="g-meta rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {aberto ? rotuloFechar : rotuloAbrir}
      </button>
    </div>
  );
}
