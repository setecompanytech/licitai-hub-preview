import type { ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Cartão de método de acesso (Design System v3): botão semântico com a área
 * inteira clicável — ícone num ladrilho verde-claro de 40px, título 16/600 e
 * descrição 13 ao centro, seta à direita. É o cartão clicável do manual (§4):
 * `rounded-lg border bg-card shadow-sm`, hover com borda verde e sombra `md`,
 * foco visível, ativação por teclado (é um <button>), e `disabled` enquanto
 * outra ação está em curso, para não haver acionamento duplicado.
 *
 * O selo é um <span> com a pele do `Badge`: dentro de um <button> só cabe
 * conteúdo de frase, e o componente renderiza uma <div>.
 */
interface OpcaoAcessoProps {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
  carregando?: boolean;
  className?: string;
}

export default function OpcaoAcesso({ icone, titulo, descricao, badge, onClick, disabled, carregando, className }: OpcaoAcessoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-sm',
        'transition-[color,background-color,border-color,box-shadow] duration-150',
        'hover:border-primary/40 hover:bg-primary-tint/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary [&>svg]:h-5 [&>svg]:w-5"
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-6 text-foreground">{titulo}</span>
        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{descricao}</span>
        {badge && (
          <span className={cn(badgeVariants({ variant: 'info' }), 'mt-2')}>
            {badge}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="flex-shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
      >
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      </span>
    </button>
  );
}
