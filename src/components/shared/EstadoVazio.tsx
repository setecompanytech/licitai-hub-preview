import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * EstadoVazio — o "nada aqui ainda" padrão da identidade 12/09: ícone num
 * círculo verde-claro, título curto, texto secundário e (opcional) a ação
 * que tira a tela do vazio. Serve a listas, abas e cartões; quem precisa de
 * um estado de ERRO usa Alert variant="destructive".
 */
interface EstadoVazioProps {
  icone?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  /** 'compacto' cabe dentro de um cartão; o padrão ocupa a área da tela. */
  tamanho?: 'padrao' | 'compacto';
  className?: string;
}

export default function EstadoVazio({ icone, titulo, descricao, acao, tamanho = 'padrao', className }: EstadoVazioProps) {
  const compacto = tamanho === 'compacto';
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compacto ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className,
      )}
    >
      {icone && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-primary-tint text-primary',
            compacto ? 'h-10 w-10 [&>svg]:h-5 [&>svg]:w-5' : 'h-14 w-14 [&>svg]:h-7 [&>svg]:w-7',
          )}
        >
          {icone}
        </span>
      )}
      <p className={cn('font-semibold text-foreground', compacto ? 'text-base' : 'text-lg')}>{titulo}</p>
      {descricao && <p className="max-w-md text-sm leading-5 text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{acao}</div>}
    </div>
  );
}
