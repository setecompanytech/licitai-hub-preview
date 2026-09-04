import { cn } from "@/lib/utils";

/**
 * Bloco de carregamento com a varredura de luz do protótipo.
 *
 * Era `animate-pulse bg-muted` — piscar de opacidade, que some no tema escuro
 * e não indica direção. A varredura anda da esquerda para a direita e diz que
 * algo está a caminho; o estilo mora em `.skeleton` no `index.css`.
 *
 * A API não mudou: os 22 arquivos que já usam `<Skeleton className="h-4 w-32" />`
 * pegam o visual novo sem edição, e `className` continua vencendo (a classe
 * está em `@layer components`, as utilitárias do Tailwind entram depois).
 *
 * `aria-hidden` por padrão: leitor de tela não deve narrar retângulo nenhum.
 * Quem está carregando se anuncia no contêiner, com `role="status"` — é o que
 * `SkeletonPagina` faz.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
