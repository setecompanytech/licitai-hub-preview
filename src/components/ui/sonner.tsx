import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Avisos do sistema — cartão branco, sombra `lg`, botão de ação verde. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-lg group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:text-sm group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-md group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-semibold",
          cancelButton: "group-[.toast]:rounded-md group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
