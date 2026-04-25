import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type AdminClient = ReturnType<typeof createClient<any, "public", any>>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type AuthResult = {
  userId: string;
  supabase: AdminClient;
};

/**
 * Validates JWT from Authorization header and optionally checks rate limit.
 * Returns userId + admin supabase client, or throws an error Response.
 */
export async function requireAuth(
  req: Request,
  options?: { functionName?: string; maxRequests?: number; windowMinutes?: number }
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: "Autenticação necessária" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate user token
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await anonClient.auth.getUser(token);

  if (error || !data?.user) {
    throw new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = data.user.id;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limiting (optional)
  if (options?.functionName) {
    const maxReq = options.maxRequests ?? 30;
    const windowMin = options.windowMinutes ?? 5;

    const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_function_name: options.functionName,
      p_max_requests: maxReq,
      p_window_minutes: windowMin,
    });

    if (rlError) {
      console.error("Rate limit check error:", rlError);
      // Don't block on rate limit errors, just log
    } else if (allowed === false) {
      throw new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Aguarde alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return { userId, supabase };
}
