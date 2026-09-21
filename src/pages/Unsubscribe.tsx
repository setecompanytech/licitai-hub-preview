import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MolduraAcesso from "@/components/auth/MolduraAcesso";
import { CheckCircle2, XCircle, Loader2, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (res.ok && data.valid === true) {
          setStatus("valid");
        } else if (data.reason === "already_unsubscribed") {
          setStatus("already");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  // Régua v3 das telas de acesso (a mesma moldura do login): título 24/600 e
  // o ícone num ladrilho tingido (trio tint/ink), no lugar do ícone solto.
  const classeTitulo = "text-3xl font-semibold leading-8 tracking-tight text-foreground";
  const classeLadrilho = "inline-flex h-14 w-14 items-center justify-center rounded-full [&>svg]:h-7 [&>svg]:w-7";

  return (
    <MolduraAcesso>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        {status === "loading" && (
          /* A espera na forma do aviso que vai chegar (manual §5); o texto
             segue existindo, para o leitor de tela. */
          <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-3">
            <span className="sr-only">Verificando...</span>
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {status === "valid" && (
          <>
            <span aria-hidden="true" className={`${classeLadrilho} bg-muted text-muted-foreground`}>
              <MailX />
            </span>
            <h1 className={classeTitulo}>Cancelar Inscrição</h1>
            <p className="text-sm leading-5 text-muted-foreground">
              Deseja deixar de receber e-mails do PRAEFECTUS? Esta ação pode ser revertida entrando em contato com o suporte.
            </p>
            <Button onClick={handleUnsubscribe} disabled={submitting} size="lg" className="mt-2 w-full">
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Confirmar Cancelamento
            </Button>
          </>
        )}

        {status === "success" && (
          <>
            <span aria-hidden="true" className={`${classeLadrilho} bg-success-tint text-success-ink`}>
              <CheckCircle2 />
            </span>
            <h1 className={classeTitulo}>Inscrição Cancelada</h1>
            <p className="text-sm leading-5 text-muted-foreground">
              Você não receberá mais e-mails do PRAEFECTUS. Se mudar de ideia, entre em contato com o suporte.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <span aria-hidden="true" className={`${classeLadrilho} bg-muted text-muted-foreground`}>
              <CheckCircle2 />
            </span>
            <h1 className={classeTitulo}>Já Cancelado</h1>
            <p className="text-sm leading-5 text-muted-foreground">
              Sua inscrição já foi cancelada anteriormente.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <span aria-hidden="true" className={`${classeLadrilho} bg-destructive-tint text-destructive-ink`}>
              <XCircle />
            </span>
            <h1 className={classeTitulo}>Link Inválido</h1>
            <p className="text-sm leading-5 text-muted-foreground">
              Este link de cancelamento é inválido ou expirou.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <span aria-hidden="true" className={`${classeLadrilho} bg-destructive-tint text-destructive-ink`}>
              <XCircle />
            </span>
            <h1 className={classeTitulo}>Erro</h1>
            <p className="text-sm leading-5 text-muted-foreground">
              Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.
            </p>
          </>
        )}
      </div>
    </MolduraAcesso>
  );
};

export default Unsubscribe;
