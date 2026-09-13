import type { ReactNode } from 'react';
import { Folder, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CartaoPasta — a pasta padrão do sistema (13/09/2026).
 *
 * Nasceu na vista de pastas dos Compromissos e virou componente quando o
 * Financeiro precisou da mesma coisa: seis categorias que, em lista, viravam
 * uma página de rolagem sem fim. A pasta guarda o que está dentro e só abre
 * quando a pessoa escolhe.
 *
 * Tamanho médio por padrão (três por linha no desktop): grande o bastante
 * para o nome e a descrição caberem sem cortar, pequeno o bastante para as
 * seis aparecerem sem rolagem.
 */
interface CartaoPastaProps {
  nome: string;
  descricao?: string;
  /** Quantas coisas há dentro — vai no canto, em dígitos alinhados. */
  quantidade?: number;
  /** Ícone do assunto. Sem ele, a pasta usa o desenho de pasta. */
  icone?: ReactNode;
  /** Cor do desenho da pasta; use tokens (text-primary, text-warning…). */
  corDoIcone?: string;
  onAbrir: () => void;
  /** Conteúdo extra no rodapé da pasta (selo, aviso). */
  rodape?: ReactNode;
  className?: string;
}

export default function CartaoPasta({
  nome,
  descricao,
  quantidade,
  icone,
  corDoIcone = 'text-primary',
  onAbrir,
  rodape,
  className,
}: CartaoPastaProps) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        'group flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-5 text-left shadow-sm',
        'transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className={cn('shrink-0', corDoIcone)}>
          {icone ?? <Folder className="h-9 w-9" strokeWidth={1.5} />}
        </span>
        {typeof quantidade === 'number' && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {quantidade}
          </span>
        )}
      </div>

      <p className="text-base font-semibold leading-6 text-foreground">{nome}</p>
      {descricao && <p className="text-sm leading-5 text-muted-foreground line-clamp-2">{descricao}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        {rodape}
        <ChevronRight
          aria-hidden="true"
          className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </div>
    </button>
  );
}
