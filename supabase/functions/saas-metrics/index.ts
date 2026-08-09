// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) throw new Error("Unauthorized");

    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Admin only");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get all active subscriptions
    const allSubs: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;
    while (hasMore) {
      const params: any = { status: "active", limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;
      const subs = await stripe.subscriptions.list(params);
      allSubs.push(...subs.data);
      hasMore = subs.has_more;
      if (subs.data.length > 0) startingAfter = subs.data[subs.data.length - 1].id;
    }

    // Get canceled subs from last 30 days for churn
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
    const canceledSubs = await stripe.subscriptions.list({
      status: "canceled",
      limit: 100,
    });
    const recentCanceled = canceledSubs.data.filter(
      (s) => s.canceled_at && s.canceled_at >= thirtyDaysAgo
    );

    // Calculate MRR
    let mrr = 0;
    const planBreakdown: Record<string, { count: number; mrr: number }> = {};
    for (const sub of allSubs) {
      const item = sub.items.data[0];
      if (!item) continue;
      const price = item.price;
      let monthlyAmount = 0;
      if (price.recurring) {
        const unitAmount = (price.unit_amount || 0) / 100;
        switch (price.recurring.interval) {
          case "month": monthlyAmount = unitAmount / (price.recurring.interval_count || 1); break;
          case "year": monthlyAmount = unitAmount / ((price.recurring.interval_count || 1) * 12); break;
          case "week": monthlyAmount = (unitAmount * 52) / 12 / (price.recurring.interval_count || 1); break;
          case "day": monthlyAmount = (unitAmount * 365) / 12 / (price.recurring.interval_count || 1); break;
        }
      }
      mrr += monthlyAmount;

      const productId = typeof price.product === "string" ? price.product : price.product?.id;
      if (productId) {
        if (!planBreakdown[productId]) planBreakdown[productId] = { count: 0, mrr: 0 };
        planBreakdown[productId].count++;
        planBreakdown[productId].mrr += monthlyAmount;
      }
    }

    // Get product names
    const planDetails: any[] = [];
    for (const [prodId, data] of Object.entries(planBreakdown)) {
      try {
        const product = await stripe.products.retrieve(prodId);
        planDetails.push({ name: product.name, ...data });
      } catch {
        planDetails.push({ name: prodId, ...data });
      }
    }

    // Churn rate
    const totalAtStart = allSubs.length + recentCanceled.length;
    const churnRate = totalAtStart > 0 ? (recentCanceled.length / totalAtStart) * 100 : 0;

    // LTV (simplified: ARPU / churn)
    const arpu = allSubs.length > 0 ? mrr / allSubs.length : 0;
    const monthlyChurn = churnRate / 100;
    const ltv = monthlyChurn > 0 ? arpu / monthlyChurn : arpu * 24; // If no churn, assume 24 months

    // Get total customers
    const customers = await stripe.customers.list({ limit: 1 });
    // Get total from count header workaround
    const allCustomers = await stripe.customers.list({ limit: 100 });
    const totalCustomers = allCustomers.data.length;

    // Get total users from DB
    const { count: totalUsers } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Get total empresas
    const { count: totalEmpresas } = await supabaseClient
      .from("empresas")
      .select("*", { count: "exact", head: true });

    // Revenue last 30 days
    const invoices = await stripe.invoices.list({
      status: "paid",
      limit: 100,
      created: { gte: thirtyDaysAgo },
    });
    const revenue30d = invoices.data.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) / 100;

    // Monthly trend (last 6 months)
    const monthlyTrend: { month: string; mrr: number; customers: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthSubs = allSubs.filter((s) => {
        const created = new Date(s.created * 1000);
        return created <= monthEnd;
      });

      let monthMrr = 0;
      for (const sub of monthSubs) {
        const item = sub.items.data[0];
        if (!item) continue;
        const price = item.price;
        if (price.recurring) {
          const unitAmount = (price.unit_amount || 0) / 100;
          switch (price.recurring.interval) {
            case "month": monthMrr += unitAmount; break;
            case "year": monthMrr += unitAmount / 12; break;
          }
        }
      }

      monthlyTrend.push({ month: monthLabel, mrr: Math.round(monthMrr), customers: monthSubs.length });
    }

    return new Response(JSON.stringify({
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      activeSubscriptions: allSubs.length,
      churnRate: Math.round(churnRate * 10) / 10,
      ltv: Math.round(ltv * 100) / 100,
      arpu: Math.round(arpu * 100) / 100,
      revenue30d,
      totalCustomers,
      totalUsers: totalUsers || 0,
      totalEmpresas: totalEmpresas || 0,
      recentCancellations: recentCanceled.length,
      planBreakdown: planDetails,
      monthlyTrend,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error.message === "Admin only" ? 403 : 500,
    });
  }
});
