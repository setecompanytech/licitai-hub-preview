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

const ENTERPRISE_PRODUCT_ID = "prod_UFFzoFGvapTwRU";

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const extractSubscriptionInfo = (subscriptions: Stripe.ApiList<Stripe.Subscription>) => {
  const hasActiveSub = subscriptions.data.length > 0;
  let productId = null;
  let subscriptionEnd = null;

  if (hasActiveSub) {
    const sub = subscriptions.data[0];
    logStep("Active subscription found", { subId: sub.id, rawPeriodEnd: sub.current_period_end, typeofPeriodEnd: typeof sub.current_period_end });

    try {
      const periodEnd = sub.current_period_end;
      if (typeof periodEnd === 'number' && periodEnd > 0) {
        subscriptionEnd = new Date(periodEnd * 1000).toISOString();
      } else if (typeof periodEnd === 'string') {
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
  }

  return { hasActiveSub, productId, subscriptionEnd };
};

const getActiveSubscriptionByEmail = async (stripe: Stripe, email: string) => {
  const customers = await withTimeout(stripe.customers.list({ email, limit: 1 }), 5000, "Stripe customers.list");
  if (customers.data.length === 0) {
    logStep("No Stripe customer found for email", { email });
    return { customers, hasActiveSub: false, productId: null, subscriptionEnd: null };
  }

  const customerId = customers.data[0].id;
  logStep("Found customer", { customerId, billingEmail: email });

  const subscriptions = await withTimeout(
    stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    }),
    5000,
    "Stripe subscriptions.list",
  );

  const info = extractSubscriptionInfo(subscriptions);
  if (!info.hasActiveSub) logStep("No active subscription for customer", { customerId, billingEmail: email });

  return { customers, ...info };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const [{ data: systemRoles }, { data: adminMembership }] = await Promise.all([
      adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").limit(1),
      adminClient.from("empresa_membros").select("empresa_id").eq("user_id", user.id).eq("papel", "admin").limit(1),
    ]);

    if ((systemRoles?.length ?? 0) > 0 || (adminMembership?.length ?? 0) > 0) {
      logStep("Admin bypass granted", { userId: user.id, systemAdmin: (systemRoles?.length ?? 0) > 0, empresaAdmin: (adminMembership?.length ?? 0) > 0 });
      return new Response(
        JSON.stringify({ subscribed: true, product_id: ENTERPRISE_PRODUCT_ID, subscription_end: null, inherited_from: "admin_bypass" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Convidados (membros) normalmente NÃO têm assinatura própria — herdam o
    // plano da empresa que os convidou. Mesmo se houver customer Stripe antigo
    // para o e-mail convidado, se ele não tiver assinatura ativa tentamos a
    // assinatura do dono da empresa antes de bloquear o acesso.
    let inheritedFrom: string | null = null;
    const directSubscription = await getActiveSubscriptionByEmail(stripe, userEmail);

    if (directSubscription.hasActiveSub) {
      return new Response(
        JSON.stringify({ subscribed: true, product_id: directSubscription.productId, subscription_end: directSubscription.subscriptionEnd, inherited_from: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    {
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
            inheritedFrom = empresa.created_by;
            logStep("Inheriting plan from empresa owner", { ownerEmail, empresa_id: membership.empresa_id });
            const inheritedSubscription = await getActiveSubscriptionByEmail(stripe, ownerEmail);

            if (inheritedSubscription.hasActiveSub) {
              return new Response(
                JSON.stringify({ subscribed: true, product_id: inheritedSubscription.productId, subscription_end: inheritedSubscription.subscriptionEnd, inherited_from: inheritedFrom }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
              );
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ subscribed: false, product_id: null, subscription_end: null, inherited_from: inheritedFrom }),
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
