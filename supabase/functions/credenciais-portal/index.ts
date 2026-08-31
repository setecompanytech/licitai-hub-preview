// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Prefixo gravado junto do valor cifrado. Existe para que a PRÓXIMA troca de chave
// saiba, olhando a linha, com qual chave ela foi escrita — que é exatamente o que
// faltava no desenho anterior e obrigou esta mudança.
const VERSAO_CIFRA = "v2";

// A cifra tem chave própria, separada da credencial de infraestrutura. Antes ela era
// derivada da SUPABASE_SERVICE_ROLE_KEY, e isso custava duas coisas: rotacionar a
// service role key — prática normal — tornava toda senha de portal indecifrável, e
// quem obtivesse essa chave decifrava a senha de portal de todos os assinantes.
function segredoDeCifra(): string {
  const secret = Deno.env.get("CREDENCIAIS_ENCRYPTION_KEY");
  if (!secret) {
    // Falha alta de propósito: cair de volta para a service role key reintroduziria
    // o acoplamento em silêncio, e ninguém perceberia até a próxima rotação.
    throw new Error(
      "CREDENCIAIS_ENCRYPTION_KEY não configurada — cadastre o segredo nas Edge Functions antes de usar credenciais de portal"
    );
  }
  return secret;
}

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredoDeCifra()),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("praefectus-credenciais-v2"),
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
  // versao:iv:ciphertext em base64 — o alfabeto base64 não usa ":", então o split é seguro
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(
    String.fromCharCode(...new Uint8Array(ciphertext))
  );
  return `${VERSAO_CIFRA}:${ivB64}:${ctB64}`;
}

async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const [versao, ivB64, ctB64] = encrypted.split(":");
  // Recusa o que não reconhece em vez de tentar adivinhar: senha devolvida errada é
  // pior que erro, porque vira tentativa de login falha no portal sem explicação.
  if (versao !== VERSAO_CIFRA || !ivB64 || !ctB64) {
    throw new Error("Formato de senha cifrada não reconhecido");
  }
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
