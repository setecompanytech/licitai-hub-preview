import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * SkeletonTabela — a espera na forma de uma tabela do Design System v3.
 *
 * Cabeçalho `bg-secondary` de 44px e linhas de 48px separadas por um fio,
 * como a tabela de verdade que vai ocupar o lugar: o olho já sabe onde cada
 * coisa vai aparecer, e a tela não pula quando os dados chegam. Substitui o
 * spinner centralizado, que o manual proíbe, e a cópia à mão de
 * "`gap-px bg-border` + `Skeleton`s" que cinco arquivos do Financeiro
 * repetiam.
 *
 * `rotulo` é o texto lido pelo leitor de tela (`role="status"`); o texto que
 * a tela mostrava antes ("Carregando lançamentos…") vai aqui, não some.
 */
interface SkeletonTabelaProps {
  linhas?: number;
  colunas?: number;
  /** Sem cabeçalho quando a tabela real também não tem (lista dentro de cartão). */
  cabecalho?: boolean;
  rotulo?: string;
  className?: string;
}

/* Larguras alternadas para a fileira não parecer uma régua. */
const LARGURAS = ['w-28', 'w-1/3', 'w-20', 'w-24', 'w-16', 'w-32'] as const;

export default function SkeletonTabela({
  linhas = 5,
  colunas = 4,
  cabecalho = true,
  rotulo = 'Carregando',
  className,
}: SkeletonTabelaProps) {
  const cols = Math.max(1, colunas);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}
    >
      <span className="sr-only">{rotulo}</span>
      {cabecalho && (
        <div aria-hidden="true" className="flex h-11 items-center gap-4 border-b border-border bg-secondary px-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className={cn('h-3', LARGURAS[c % LARGURAS.length], c === cols - 1 && cols > 1 && 'ml-auto')}
            />
          ))}
        </div>
      )}
      <div aria-hidden="true" className="flex flex-col gap-px bg-border">
        {Array.from({ length: Math.max(1, linhas) }, (_, l) => (
          <div key={l} className="flex h-12 items-center gap-4 bg-card px-4">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton
                key={c}
                className={cn('h-4', LARGURAS[(c + l) % LARGURAS.length], c === cols - 1 && cols > 1 && 'ml-auto')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
