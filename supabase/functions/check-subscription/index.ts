import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("User not authenticated");

    const userEmail = user.email;
    if (!userEmail) throw new Error("User email not found");

    logStep("User authenticated", { userId: user.id, email: userEmail });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Convidados (membros) NÃO têm assinatura própria — herdam o plano da
    // empresa que os convidou. Se não existir customer Stripe pelo e-mail
    // do user, busca o e-mail do dono (created_by) da empresa e tenta de novo.
    let billingEmail = userEmail;
    let inheritedFrom: string | null = null;
    let customers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (customers.data.length === 0) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data: membership } = await adminClient
        .from("empresa_membros")
        .select("empresa_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membership?.empresa_id) {
        const { data: empresa } = await adminClient
          .from("empresas")
          .select("created_by")
          .eq("id", membership.empresa_id)
          .maybeSingle();

        if (empresa?.created_by && empresa.created_by !== user.id) {
          const { data: ownerData } = await adminClient.auth.admin.getUserById(empresa.created_by);
          const ownerEmail = ownerData?.user?.email;
          if (ownerEmail) {
            billingEmail = ownerEmail;
            inheritedFrom = empresa.created_by;
            logStep("Inheriting plan from empresa owner", { ownerEmail, empresa_id: membership.empresa_id });
            customers = await stripe.customers.list({ email: ownerEmail, limit: 1 });
          }
        }
      }
    }

    if (customers.data.length === 0) {
      logStep("No Stripe customer found (direct or inherited)");
      return new Response(JSON.stringify({ subscribed: false, inherited_from: inheritedFrom }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId, billingEmail, inherited: !!inheritedFrom });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const sub = subscriptions.data[0];
      logStep("Active subscription found", { subId: sub.id, rawPeriodEnd: sub.current_period_end, typeofPeriodEnd: typeof sub.current_period_end });

      // Safely handle current_period_end - it could be a number (unix timestamp) or a string
      try {
        const periodEnd = sub.current_period_end;
        if (typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else if (typeof periodEnd === 'string') {
          // Already an ISO string or date string
          const parsed = new Date(periodEnd);
          if (!isNaN(parsed.getTime())) {
            subscriptionEnd = parsed.toISOString();
          }
        }
      } catch (e) {
        logStep("Warning: could not parse period end, continuing without it");
      }

      productId = sub.items.data[0]?.price?.product ?? null;
      logStep("Subscription details", { productId, subscriptionEnd });
    } else {
      logStep("No active subscription");
    }

    return new Response(
      JSON.stringify({ subscribed: hasActiveSub, product_id: productId, subscription_end: subscriptionEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CHECK-SUBSCRIPTION] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
