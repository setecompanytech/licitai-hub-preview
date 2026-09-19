import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo de texto — 40px, raio 8px, borda `input`, foco na cor de ação com
 * anel suave (sem deslocamento). No celular a fonte sobe para 16px, o piso
 * que evita o zoom automático do iOS.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground-tertiary hover:border-foreground-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
