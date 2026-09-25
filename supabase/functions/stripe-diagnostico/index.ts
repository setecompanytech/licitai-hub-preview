import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  cicloDoPreco, modoDaChave, nomeDoProduto, slugDoProduto, tabelaDeResolucao, type PrecoStripe, type ProdutoStripe,
} from "../_shared/precos-stripe.ts";

/**
 * A conta Stripe que o servidor usa, vista de dentro — só para o
 * administrador do sistema.
 *
 * A chave vive nos secrets do projeto e não sai de lá: a Management API só
 * mostra o digest, e ninguém consegue conferir "qual conta está cadastrada"
 * por fora. Esta função responde de dentro: conta (id, nome, e-mail, país),
 * modo (produção × teste), produtos, preços e a tabela plano × ciclo com o
 * preço que o botão Assinar vai cobrar — ou o motivo de faltar.
 *
 * Só leitura. Nunca devolve a chave.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization header is required" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: "Usuário não autenticado" }, 401);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: papeis } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").limit(1);
    if ((papeis?.length ?? 0) === 0) {
      return json({ error: "Só o administrador do sistema consulta a conta Stripe." }, 403);
    }

    const chave = Deno.env.get("STRIPE_SECRET_KEY");
    if (!chave) {
      return json({ configurado: false, modo: "desconhecido", conta: null, erro_conta: "STRIPE_SECRET_KEY não está nos secrets do projeto.", produtos: [], precos: [], resolucao: [], faltam: 0 });
    }

    const stripe = new Stripe(chave, { apiVersion: "2025-08-27.basil" });
    const modo = modoDaChave(chave);

    let conta: Record<string, unknown> | null = null;
    let erroConta: string | null = null;
    try {
      const a = await stripe.accounts.retrieve();
      conta = {
        id: a.id,
        nome: a.business_profile?.name ?? a.settings?.dashboard?.display_name ?? null,
        email: a.email ?? a.business_profile?.support_email ?? null,
        pais: a.country ?? null,
        moeda: a.default_currency ?? null,
        cobrancas_ativas: a.charges_enabled ?? null,
        repasses_ativos: a.payouts_enabled ?? null,
      };
    } catch (e) {
      erroConta = e instanceof Error ? e.message : String(e);
      return json({ configurado: true, modo, conta: null, erro_conta: erroConta, produtos: [], precos: [], resolucao: [], faltam: 0 });
    }

    const [produtosStripe, precosStripe, { data: planos }] = await Promise.all([
      stripe.products.list({ limit: 100 }),
      stripe.prices.list({ limit: 100, expand: ["data.product"] }),
      adminClient.from("planos").select("slug, preco_mensal").eq("ativo", true),
    ]);

    const produtos = produtosStripe.data.map((p) => ({
      id: p.id,
      nome: p.name,
      ativo: p.active,
      plano: slugDoProduto(p as unknown as ProdutoStripe),
    }));
    const precos = (precosStripe.data as unknown as PrecoStripe[]).map((p) => ({
      id: p.id,
      produto: nomeDoProduto(p.product),
      plano: slugDoProduto(p.product),
      valor_centavos: p.unit_amount,
      moeda: p.currency,
      ciclo: cicloDoPreco(p.recurring),
      ativo: p.active,
      producao: p.livemode ?? null,
      criado_em: p.created ? new Date(p.created * 1000).toISOString() : null,
    }));
    const resolucao = tabelaDeResolucao(
      precosStripe.data as unknown as PrecoStripe[],
      ((planos ?? []) as Array<{ slug: string; preco_mensal: number | string }>).map((p) => ({ slug: p.slug, preco_mensal: Number(p.preco_mensal) })),
    );

    return json({
      configurado: true,
      modo,
      conta,
      erro_conta: null,
      produtos,
      precos,
      resolucao,
      faltam: resolucao.filter((l) => !l.price_id).length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[STRIPE-DIAGNOSTICO] Error:", msg);
    return json({ error: msg }, 500);
  }
});
