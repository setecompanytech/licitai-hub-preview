import type { ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Cartão de método de acesso (prancha 12/09): botão semântico com a área
 * inteira clicável — ícone em círculo verde-claro, título e descrição ao
 * centro, seta à direita. Hover com borda verde e fundo esverdeado, foco
 * visível, ativação por teclado (é um <button>), e `disabled` enquanto
 * outra ação está em curso, para não haver acionamento duplicado.
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
        'group flex w-full items-center gap-4 rounded-[14px] border border-border bg-card p-5 text-left transition-colors',
        'hover:border-primary hover:bg-primary-tint/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary [&>svg]:h-6 [&>svg]:w-6"
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-6 text-foreground">{titulo}</span>
        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{descricao}</span>
        {badge && (
          <Badge variant="success" className="mt-2">
            {badge}
          </Badge>
        )}
      </span>
      <span aria-hidden="true" className="flex-shrink-0 text-primary transition-transform group-hover:translate-x-0.5">
        {carregando ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
      </span>
    </button>
  );
}
