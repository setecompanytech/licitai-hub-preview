// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const prices = [
      { product: "prod_UFHAhv2lqyHXyT", amount: 53190, interval: "month" as const, interval_count: 3, nickname: "Básico Trimestral" },
      { product: "prod_UFHAhv2lqyHXyT", amount: 100470, interval: "month" as const, interval_count: 6, nickname: "Básico Semestral" },
      { product: "prod_UFHAhv2lqyHXyT", amount: 189120, interval: "year" as const, interval_count: 1, nickname: "Básico Anual" },
      { product: "prod_UFHBRsquFdT751", amount: 134190, interval: "month" as const, interval_count: 3, nickname: "Profissional Trimestral" },
      { product: "prod_UFHBRsquFdT751", amount: 253470, interval: "month" as const, interval_count: 6, nickname: "Profissional Semestral" },
      { product: "prod_UFHBRsquFdT751", amount: 477120, interval: "year" as const, interval_count: 1, nickname: "Profissional Anual" },
      { product: "prod_UFHBGUZhicRt8q", amount: 269190, interval: "month" as const, interval_count: 3, nickname: "Enterprise Trimestral" },
      { product: "prod_UFHBGUZhicRt8q", amount: 508470, interval: "month" as const, interval_count: 6, nickname: "Enterprise Semestral" },
      { product: "prod_UFHBGUZhicRt8q", amount: 957120, interval: "year" as const, interval_count: 1, nickname: "Enterprise Anual" },
    ];

    const results = [];
    for (const p of prices) {
      const price = await stripe.prices.create({
        product: p.product,
        unit_amount: p.amount,
        currency: "brl",
        nickname: p.nickname,
        recurring: { interval: p.interval, interval_count: p.interval_count },
      });
      results.push({ nickname: p.nickname, id: price.id });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});