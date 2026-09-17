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
 *
 * Dois modos (17/09):
 *   `botao`  — o texto e, abaixo, um botão "Ver descrição completa". É o de sempre.
 *   `texto`  — o PRÓPRIO texto é o botão: duas linhas, e o clique em cima abre.
 *              Pedido para a ficha do processo, onde um rótulo de botão a cada
 *              campo longo custaria mais espaço do que o texto que esconde.
 *              A dica (`title`) e o texto só-para-leitor dizem o que o clique faz.
 */
interface TextoExpansivelProps {
  texto: string;
  /** Quantas linhas ficam à mostra antes de expandir. */
  linhas?: 1 | 2 | 3 | 4;
  className?: string;
  rotuloAbrir?: string;
  rotuloFechar?: string;
  /** `botao` (padrão) ou `texto` — ver o cabeçalho do arquivo. */
  modo?: 'botao' | 'texto';
  /**
   * Caracteres por linha para decidir se vale truncar. O padrão (90) serve a um
   * parágrafo largo; num campo estreito da ficha, 40 é mais honesto.
   */
  limiarPorLinha?: number;
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
  modo = 'botao',
  limiarPorLinha = LIMIAR_POR_LINHA,
}: TextoExpansivelProps) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const longo = texto.length > limiarPorLinha * linhas;

  if (!longo) return <p className={cn('g-corpo', className)}>{texto}</p>;

  if (modo === 'texto') {
    return (
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        title={aberto ? 'Clique para recolher' : 'Clique para ler o texto inteiro'}
        className={cn(
          'g-corpo block w-full cursor-pointer rounded-sm text-left text-foreground',
          'decoration-dotted underline-offset-4 hover:underline',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {/* O clamp fica no span: `display: -webkit-box` direto no botão não é
            confiável entre navegadores. */}
        <span className={cn('block', !aberto && CLAMP[linhas])}>{texto}</span>
        <span className="sr-only">{aberto ? ' (clique para recolher)' : ' (clique para ler o texto inteiro)'}</span>
      </button>
    );
  }

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
