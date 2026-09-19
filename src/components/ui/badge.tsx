import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — selo suave: fundo tingido, tinta escura, contorno fino, raio 6px.
 * Status sempre com TEXTO — a cor é reforço, nunca a única pista.
 *
 *   success  verde   (ganha, ativo, concluído)
 *   info     azul    (em disputa, em andamento)
 *   warning  âmbar   (pendente, aguardando)
 *   danger   vermelho (perdida, vencida, erro)
 *   muted    cinza   (encerrada, arquivada)
 *   ia       verde-claro (selo "Praefectus IA", automação)
 */
const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-success-line bg-success-tint text-success-ink",
        warning: "border-warning-line bg-warning-tint text-warning-ink",
        danger: "border-destructive-line bg-destructive-tint text-destructive-ink",
        info: "border-info-line bg-info-tint text-info-ink",
        muted: "border-border bg-muted text-muted-foreground",
        /* Selo "Praefectus IA" / automação: a tinta verde da ação, discreta. */
        ia: "border-primary-line bg-primary-tint text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Quando true, aplica truncamento com reticências ao conteúdo do badge. */
  truncate?: boolean;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, truncate, children, title, ...props }, ref) => {
    const inferredTitle =
      title ?? (truncate && typeof children === "string" ? children : undefined);
    return (
      <div
        ref={ref}
        className={cn(
          badgeVariants({ variant }),
          truncate && "min-w-0 [&>span]:truncate",
          className,
        )}
        title={inferredTitle}
        {...props}
      >
        {truncate ? <span className="truncate">{children}</span> : children}
      </div>
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
