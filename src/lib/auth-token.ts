import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Returns the current user's JWT access token, auto-refreshing if expired.
 * Uses getUser() first (server-side validation + auto-refresh), then getSession() for the token.
 * Returns null and optionally shows a toast if the user is not authenticated.
 */
export async function getUserJwt(opts?: { showToastOnFail?: boolean }): Promise<string | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      if (opts?.showToastOnFail) {
        toast.error("Sessão expirada", {
          description: "Recarregue a página (F5) e faça login novamente.",
          duration: 7000,
        });
      }
      return null;
    }
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
