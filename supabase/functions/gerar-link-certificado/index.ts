import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://app.praefectus.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { empresa_id } = await req.json();
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: empresa } = await adminClient
      .from("empresas")
      .select("razao_social, cnpj")
      .eq("id", empresa_id)
      .single();

    if (!empresa) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenData, error: tokenErr } = await adminClient
      .from("cert_upload_tokens")
      .insert({ user_id: user.id, empresa_id })
      .select("token, expires_at")
      .single();

    if (tokenErr) throw tokenErr;

    const { data: profile } = await adminClient
      .from("profiles")
      .select("nome_completo")
      .eq("user_id", user.id)
      .single();

    const uploadUrl = `${SITE_URL}/certificado-upload?token=${tokenData.token}`;

    const expiresFormatted = new Date(tokenData.expires_at).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    const nomeUsuario = profile?.nome_completo || user.email;

    // Send transactional email
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "cert-upload-link",
          recipientEmail: user.email,
          idempotencyKey: `cert-upload-${tokenData.token}`,
          templateData: {
            nome: nomeUsuario,
            empresa: empresa.razao_social,
            cnpj: empresa.cnpj,
            link: uploadUrl,
            expira: expiresFormatted,
          },
        },
      });
    } catch (emailErr) {
      console.warn("Email notification failed (non-blocking):", emailErr);
    }

    // Send WhatsApp notification (best-effort, using correct interface)
    try {
      await supabase.functions.invoke("whatsapp-envio", {
        body: {
          telefone: "0",
          setor: "documentos",
          mensagem_custom:
            `🔐 *PRAEFECTUS — Upload de Certificado Digital*\n\n` +
            `Olá ${nomeUsuario}!\n\n` +
            `Seu Agente Cloud Enterprise foi ativado com sucesso para a empresa *${empresa.razao_social}*.\n\n` +
            `📎 Acesse o link abaixo para enviar seu certificado digital (.pfx) de forma segura:\n\n` +
            `${uploadUrl}\n\n` +
            `⏰ Este link expira em *24 horas* (${expiresFormatted}).\n\n` +
            `⚠️ O certificado será armazenado em container isolado e criptografado, exclusivo da sua empresa.`,
        },
      });
    } catch (wpErr) {
      console.warn("WhatsApp notification failed (non-blocking):", wpErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        upload_url: uploadUrl,
        token: tokenData.token,
        expires_at: tokenData.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
