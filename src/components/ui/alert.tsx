import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Alerta em linha — o trio tinta/tinta-escura/linha de cada estado, raio
 * 10px, ícone à esquerda. `info` é o azul informativo; `default` é neutro.
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        destructive: "border-destructive-line bg-destructive-tint text-destructive-ink [&>svg]:text-destructive-ink",
        success: "border-success-line bg-success-tint text-success-ink [&>svg]:text-success-ink",
        warning: "border-warning-line bg-warning-tint text-warning-ink [&>svg]:text-warning-ink",
        info: "border-info-line bg-info-tint text-info-ink [&>svg]:text-info-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 text-sm font-semibold leading-5 tracking-normal", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm leading-5 [&_p]:leading-5", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
