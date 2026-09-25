import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  CICLOS, NOME_DO_PLANO, centavosDoCiclo, ehCiclo, ehPlano, escolherPreco, reais, type PrecoStripe,
} from "../_shared/precos-stripe.ts";

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

    const userEmail = user.email;
    if (!userEmail) throw new Error("E-mail do usuário não encontrado");

    const { priceId, plano, ciclo, successPath, cancelPath } = await req.json();

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    /**
     * O preço a cobrar (25/09): pelo plano e pelo ciclo, nunca por id gravado.
     *
     * O valor mensal vem da tabela `planos` — a mesma que a tela mostra — e o
     * preço é o ATIVO da conta Stripe que cobra esse valor nesse ciclo
     * (`_shared/precos-stripe.ts`). Os ids `price_…` de março sumiram do
     * Stripe e o botão Assinar parou sem que nada no código tivesse mudado.
     * `priceId` ainda é aceito para quem chama do jeito antigo.
     */
    let price: string;
    if (plano !== undefined || ciclo !== undefined) {
      if (!ehPlano(plano)) throw new Error(`Plano inválido: ${String(plano)}`);
      if (!ehCiclo(ciclo)) throw new Error(`Ciclo inválido: ${String(ciclo)}`);
      const { data: linha, error: erroPlano } = await supabaseClient
        .from("planos")
        .select("preco_mensal")
        .eq("slug", plano)
        .eq("ativo", true)
        .maybeSingle();
      if (erroPlano) throw new Error(`Não foi possível ler o plano: ${erroPlano.message}`);
      if (!linha) throw new Error(`O plano ${NOME_DO_PLANO[plano]} não está ativo na tabela de planos.`);
      const esperado = centavosDoCiclo(Number(linha.preco_mensal), ciclo);
      const lista = await stripe.prices.list({ active: true, type: "recurring", limit: 100, expand: ["data.product"] });
      const escolha = escolherPreco(lista.data as unknown as PrecoStripe[], plano, ciclo, esperado);
      if (!escolha.ok) throw new Error(escolha.erro);
      price = escolha.preco.id;
      console.log("[CREATE-CHECKOUT]", userEmail, "→", NOME_DO_PLANO[plano], CICLOS[ciclo].rotulo, reais(esperado), "=", price, `(${escolha.motivo})`);
    } else if (typeof priceId === "string" && priceId) {
      price = priceId;
      console.log("[CREATE-CHECKOUT] Creating session for", userEmail, "price:", priceId);
    } else {
      throw new Error("Informe plano e ciclo");
    }

    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://praefectus.com.br";
    const resolvedSuccessPath = successPath || "/configuracoes?checkout=success&scroll=planos#plano";
    const resolvedCancelPath = cancelPath || "/configuracoes?checkout=cancel&scroll=planos#plano";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [{ price, quantity: 1 }],
      mode: "subscription",
      payment_method_types: ["card", "boleto"],
      subscription_data: {
        description: "Assinatura PRAEFECTUS - Plataforma de Gestão Inteligente de Licitações",
      },
      success_url: `${origin}${resolvedSuccessPath}`,
      cancel_url: `${origin}${resolvedCancelPath}`,
    });

    console.log("[CREATE-CHECKOUT] Session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
