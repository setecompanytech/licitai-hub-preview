import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 max-w-full",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Famílias semânticas em tinta suave (identidade 12/09): fundo `*-tint`,
        // texto `*-ink`, contorno `*-line`. Status sempre com TEXTO — a cor é
        // reforço, nunca a única pista.
        success: "border-success-line bg-success-tint text-success-ink",
        warning: "border-warning-line bg-warning-tint text-warning-ink",
        danger: "border-destructive-line bg-destructive-tint text-destructive-ink",
        info: "border-border bg-muted text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
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
