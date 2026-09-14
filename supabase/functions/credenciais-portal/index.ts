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
//
// Esta função só CIFRA. Decifrar mora exclusivamente em `credencialEmClaro`,
// chamada por dentro do servidor no envio da sessão — nunca devolvida ao
// navegador (ver a ação `decrypt`, desativada, mais abaixo).
import { encrypt, deriveKey } from "../_shared/credenciais-cifra.ts";

/**
 * O que a lista devolve. Tudo da credencial MENOS o texto cifrado da senha —
 * a tela só precisa saber SE há senha, para desenhar "••••••••".
 */
const COLUNAS_DA_LISTA =
  "id, user_id, portal_id, portal_nome, login, certificado_path, certificado_tipo, " +
  "certificado_nome, validade_certificado, status, created_at, updated_at";

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

    // A chave é derivada só onde a cifra é usada (save). Assim, segredo ausente
    // não derruba listar nem apagar — que é justamente como se sai do buraco.

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: lista as credenciais — SEM o texto cifrado da senha.
    //
    // O `select("*")` anterior mandava `senha_hash` ao navegador em toda
    // abertura da aba Portais. `senha_hash` entra na consulta só para virar o
    // booleano `tem_senha`, e sai do objeto antes da resposta.
    if (req.method === "GET" && action === "list") {
      const { data, error } = await adminClient
        .from("credenciais_portais")
        .select(`${COLUNAS_DA_LISTA}, senha_hash`)
        .eq("user_id", user.id)
        .order("portal_nome");
      if (error) throw error;
      const lista = (data || []).map(({ senha_hash, ...resto }) => ({
        ...resto,
        tem_senha: !!senha_hash,
      }));
      return new Response(JSON.stringify(lista), {
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

    // DECIFRAR PARA O NAVEGADOR: RETIRADO em 14/09/2026.
    //
    // Esta ação devolvia a senha do portal EM CLARO a qualquer sessão logada do
    // dono — um token de navegador roubado virava a senha do Compras.gov da
    // empresa. E nenhuma tela a chamava (conferido por busca em `src/`): quem
    // precisa da senha é o agente, e ela chega a ele por dentro do servidor,
    // via `credencialEmClaro` no `robo-lances-webhook/enviar-sessao`.
    //
    // 410 e não 404: o endereço existiu e saiu de propósito. Quem ainda o
    // chamar precisa ler o motivo, não procurar um erro de digitação.
    if (action === "decrypt") {
      return new Response(
        JSON.stringify({
          error:
            "A leitura da senha em claro foi desativada. A senha do portal só é " +
            "decifrada dentro do servidor, no envio da sessão ao robô.",
        }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
