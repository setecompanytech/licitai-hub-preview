import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { badgeVariants } from "@/components/ui/badge";
import EstadoVazio from "@/components/shared/EstadoVazio";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    /* Estado vazio sóbrio (manual §5): um cartão centrado, o ícone no ladrilho
       da ação, o código como selo e a saída para o painel como ação principal.
       O destino é o mesmo <a href="/dashboard"> de antes. */
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-sm">
        <EstadoVazio
          icone={<SearchX />}
          titulo={
            <span className="flex flex-col items-center gap-2">
              <span className={badgeVariants({ variant: "muted" })}>404</span>
              <span>Oops! Page not found</span>
            </span>
          }
          acao={
            <Button asChild>
              <a href="/dashboard">Return to Home</a>
            </Button>
          }
        />
      </div>
    </div>
  );
};

export default NotFound;
