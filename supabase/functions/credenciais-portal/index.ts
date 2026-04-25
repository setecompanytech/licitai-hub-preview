// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Derive AES-GCM key from service role key
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("praefectus-credenciais-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Encode as iv:ciphertext in base64
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(
    String.fromCharCode(...new Uint8Array(ciphertext))
  );
  return `${ivB64}:${ctB64}`;
}

async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(":");
  if (!ivB64 || !ctB64) throw new Error("Invalid encrypted format");
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

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

    // Derive encryption key
    const cryptoKey = await deriveKey(serviceRoleKey);

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

      const senhaEncrypted = senha ? await encrypt(senha, cryptoKey) : null;

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

      let decryptedPassword: string | null = null;
      if (data.senha_hash) {
        try {
          decryptedPassword = await decrypt(data.senha_hash, cryptoKey);
        } catch {
          // If decryption fails (old base64 format), try decoding as base64
          try {
            decryptedPassword = atob(data.senha_hash);
          } catch {
            decryptedPassword = null;
          }
        }
      }

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
