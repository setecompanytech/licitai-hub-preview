import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization header is required");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado");

    const body = await req.json();

    // Health check mode — verify Stripe is reachable and boleto is supported
    if (body.check === true) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        await stripe.paymentMethods.list({ type: "boleto", limit: 1 });
        return new Response(JSON.stringify({ configured: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (e) {
        console.error("[EMITIR-BOLETO] Health check failed:", e);
        return new Response(JSON.stringify({ configured: false, error: e instanceof Error ? e.message : String(e) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Validate required fields
    const { valor, vencimento, sacado_nome, sacado_cpf_cnpj, sacado_endereco, sacado_cidade, sacado_uf, sacado_cep, descricao, numero_documento, empresa_id } = body;
    if (!valor || !vencimento || !sacado_nome || !sacado_cpf_cnpj) {
      throw new Error("Campos obrigatórios: valor, vencimento, sacado_nome, sacado_cpf_cnpj");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create Stripe customer
    const userEmail = user.email || "";
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        name: sacado_nome,
      });
      customerId = newCustomer.id;
    }

    // Calculate due date (Stripe expects Unix timestamp for boleto)
    const dueDate = new Date(vencimento + "T23:59:59-03:00");
    const dueDateUnix = Math.floor(dueDate.getTime() / 1000);

    // Create PaymentIntent with boleto
    const amountCents = Math.round(valor * 100);

    // Dias até o vencimento comparando DATAS no fuso de Brasília — comparar
    // instantes com ceil() empurrava o boleto para um dia depois do pedido
    // (M14 da auditoria). Stripe limita a 60 dias: acima disso, erro claro
    // em vez de exceção críptica.
    const hojeBR = new Date(
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) + "T12:00:00Z",
    );
    const vencBR = new Date(dueDate.toISOString().slice(0, 10) + "T12:00:00Z");
    const diasAteVencimento = Math.max(
      1,
      Math.round((vencBR.getTime() - hojeBR.getTime()) / 86400000),
    );
    if (diasAteVencimento > 60) {
      return new Response(
        JSON.stringify({ error: "Vencimento além de 60 dias — o limite do boleto Stripe. Escolha uma data mais próxima." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "brl",
      customer: customerId,
      payment_method_types: ["boleto"],
      payment_method_options: {
        boleto: {
          expires_after_days: diasAteVencimento,
        },
      },
      description: descricao || `Boleto ${numero_documento || ""}`.trim(),
      metadata: {
        user_id: user.id,
        empresa_id: empresa_id || "",
        numero_documento: numero_documento || "",
      },
    });

    console.log("[EMITIR-BOLETO] PaymentIntent created:", paymentIntent.id);

    // Confirm the PaymentIntent with boleto payment method data
    const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method_data: {
        type: "boleto",
        boleto: {
          tax_id: sacado_cpf_cnpj.replace(/\D/g, ""),
        },
        billing_details: {
          name: sacado_nome,
          email: userEmail,
          address: {
            line1: sacado_endereco || "Não informado",
            city: sacado_cidade || "Não informado",
            state: sacado_uf || "SP",
            postal_code: (sacado_cep || "00000000").replace(/\D/g, ""),
            country: "BR",
          },
        },
      },
    });

    // O Stripe devolve a linha digitável (number) e o PDF — eram descartados
    // e a tabela guardava NULL: boleto impagável offline e inconciliável pelo
    // próprio leitor do sistema (C9 da auditoria).
    let linhaDigitavel: string | null = null;
    let urlPdf: string | null = null;
    let urlPagamento: string | null = null;

    if (confirmedIntent.next_action?.type === "boleto_display_details") {
      const boletoDetails = confirmedIntent.next_action.boleto_display_details as {
        hosted_voucher_url?: string | null;
        number?: string | null;
        pdf?: string | null;
      } | null;
      if (boletoDetails) {
        urlPagamento = boletoDetails.hosted_voucher_url ?? null;
        linhaDigitavel = boletoDetails.number ?? null;
        urlPdf = boletoDetails.pdf ?? null;
      }
    }

    // Update the boleto record in the database
    const { error: updateError } = await supabaseClient.from("boletos").update({
      status: "registrado",
      linha_digitavel: linhaDigitavel,
      codigo_barras: linhaDigitavel,
      nosso_numero: paymentIntent.id,
      api_response: {
        stripe_payment_intent_id: paymentIntent.id,
        stripe_status: confirmedIntent.status,
        url_pagamento: urlPagamento,
        url_pdf: urlPdf,
      },
    }).eq("id", body.boleto_id);

    if (updateError) {
      console.error("[EMITIR-BOLETO] Failed to update boleto record:", updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: paymentIntent.id,
      status: confirmedIntent.status,
      url_pagamento: urlPagamento,
      url_pdf: urlPdf,
      linha_digitavel: linhaDigitavel,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[EMITIR-BOLETO] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
