// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// A cifra mora em _shared: o robo-lances-webhook tambem precisa decifrar a senha
// para entregar ao agente, e duas copias de codigo de cripto divergem em
// silencio — basta alguem mudar o salt ou as iteracoes de um lado.
import { encrypt, decrypt, deriveKey } from "../_shared/credenciais-cifra.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth validation
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // A chave é derivada só onde a cifra é usada (save e decrypt). Assim, segredo
    // ausente não derruba listar nem apagar — que é justamente como se sai do buraco.

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: List credentials (decrypt passwords for display masking is done client-side)
    if (req.method === "GET" && action === "list") {
      const { data, error } = await adminClient
        .from("credenciais_portais")
        .select("*")
        .eq("user_id", user.id)
        .order("portal_nome");
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Save credential with encrypted password
    if (req.method === "POST" && action === "save") {
      const body = await req.json();
      const { portal_id, portal_nome, login, senha } = body;

      if (!portal_id || !portal_nome) {
        return new Response(
          JSON.stringify({ error: "portal_id e portal_nome são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const senhaEncrypted = senha
        ? await encrypt(senha, await deriveKey())
        : null;

      const { error } = await adminClient
        .from("credenciais_portais")
        .upsert(
          {
            user_id: user.id,
            portal_id,
            portal_nome,
            login: login || null,
            senha_hash: senhaEncrypted,
            status: "ativo",
          },
          { onConflict: "user_id,portal_id" }
        );
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Decrypt password (for agent use only)
    if (req.method === "POST" && action === "decrypt") {
      const body = await req.json();
      const { credential_id } = body;

      if (!credential_id) {
        return new Response(
          JSON.stringify({ error: "credential_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await adminClient
        .from("credenciais_portais")
        .select("senha_hash, login, portal_id")
        .eq("id", credential_id)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Credencial não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sem rede de segurança que "adivinha" o formato: a antiga caía para
      // atob(senha_hash), devolvendo texto qualquer como se fosse a senha. Falhar
      // aqui é o comportamento certo — o chamador precisa saber que não decifrou.
      const decryptedPassword = data.senha_hash
        ? await decrypt(data.senha_hash, await deriveKey())
        : null;

      return new Response(
        JSON.stringify({
          login: data.login,
          portal_id: data.portal_id,
          senha: decryptedPassword,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE: Remove credential
    if (req.method === "DELETE") {
      const body = await req.json();
      const { id } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await adminClient
        .from("credenciais_portais")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
