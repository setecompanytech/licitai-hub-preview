// Sprint 5 — Pluggy Open Finance integration
// Sincroniza contas bancárias e transações via Pluggy API
// Requer: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (configurar via secrets)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLUGGY_API = "https://api.pluggy.ai";

async function getPluggyApiKey(clientId: string, clientSecret: string): Promise<string> {
  const r = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!r.ok) throw new Error(`Pluggy auth falhou: ${r.status}`);
  const data = await r.json();
  return data.apiKey;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PLUGGY_CLIENT_ID = Deno.env.get("PLUGGY_CLIENT_ID");
    const PLUGGY_CLIENT_SECRET = Deno.env.get("PLUGGY_CLIENT_SECRET");

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
      return new Response(JSON.stringify({
        error: "Pluggy não configurado",
        message: "Configure as credenciais PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nas configurações de Lovable Cloud para habilitar a sincronização bancária via Open Finance.",
        setup_required: true,
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!auth) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${auth}` } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list_items";

    const apiKey = await getPluggyApiKey(PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET);
    const headers = { "X-API-KEY": apiKey, "Content-Type": "application/json" };

    // --- create_connect_token: gera token para abrir o widget Pluggy Connect ---
    if (action === "create_connect_token") {
      const r = await fetch(`${PLUGGY_API}/connect_token`, {
        method: "POST", headers,
        body: JSON.stringify({ clientUserId: userId }),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- sync_item: importa transações de um item Pluggy ---
    if (action === "sync_item" && body.itemId) {
      const accountsResp = await fetch(`${PLUGGY_API}/accounts?itemId=${body.itemId}`, { headers });
      const accounts = (await accountsResp.json()).results ?? [];

      const nowIso = new Date().toISOString();
      let importadas = 0;
      for (const acc of accounts) {
        const txResp = await fetch(`${PLUGGY_API}/transactions?accountId=${acc.id}&pageSize=500`, { headers });
        const txs = (await txResp.json()).results ?? [];

        for (const tx of txs) {
          const { error } = await supabase.from("financeiro_lancamentos").upsert({
            user_id: userId,
            descricao: tx.description,
            valor: Math.abs(tx.amount),
            tipo: tx.amount < 0 ? "despesa" : "receita",
            data_vencimento: tx.date.slice(0, 10),
            data_pagamento: tx.date.slice(0, 10),
            status: "pago",
            origem: `pluggy:${tx.id}`,
            origem_tipo: "pluggy",
            origem_job: "pluggy-sync",
            origem_usuario_id: userId,
            origem_timestamp: nowIso,
            origem_metadata: { itemId: body.itemId, accountId: acc.id, pluggy_tx_id: tx.id },
          } as any, { onConflict: "origem" });
          if (!error) importadas++;
        }
      }
      return new Response(JSON.stringify({ ok: true, importadas }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[pluggy-sync] erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
