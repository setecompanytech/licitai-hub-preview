// Edge: fin-sefaz-nsu-puxar
// Importa NF-e via SEFAZ DistribuicaoDFe pelo último NSU armazenado.
// Usa proxy externo (SEFAZ_PROXY_URL) para mTLS com certificado A1; fallback grava status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: corsHeaders });

    const { agendamento_id } = await req.json();
    if (!agendamento_id) return new Response(JSON.stringify({ error: "agendamento_id obrigatório" }), { status: 400, headers: corsHeaders });

    const { data: agend, error: errA } = await supabase
      .from("fin_sefaz_agendamentos").select("*").eq("id", agendamento_id).single();
    if (errA || !agend) return new Response(JSON.stringify({ error: "Agendamento não encontrado" }), { status: 404, headers: corsHeaders });

    const { data: isMember } = await supabase.rpc("is_empresa_member", { _user_id: user.id, _empresa_id: agend.empresa_id });
    if (!isMember) return new Response(JSON.stringify({ error: "Sem acesso" }), { status: 403, headers: corsHeaders });

    const proxyUrl = Deno.env.get("SEFAZ_PROXY_URL");
    if (!proxyUrl) {
      // Marca como pendente de configuração
      await supabase.from("fin_sefaz_agendamentos").update({
        ultimo_status: "configuracao_pendente",
        ultimo_erro: "SEFAZ_PROXY_URL não configurado. Configure o proxy mTLS em Configurações > Integrações.",
        ultima_execucao: new Date().toISOString(),
      }).eq("id", agendamento_id);
      return new Response(JSON.stringify({
        ok: false,
        configuracao_pendente: true,
        message: "Proxy SEFAZ ainda não configurado. Importação manual via XML continua disponível.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Chama proxy mTLS (DistribuicaoDFe)
    const proxyResp = await fetch(`${proxyUrl}/distribuicao-dfe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": Deno.env.get("SEFAZ_PROXY_KEY") || "" },
      body: JSON.stringify({
        cnpj: agend.cnpj,
        ultimo_nsu: agend.ultimo_nsu || "0",
        ambiente: "producao",
      }),
    });

    if (!proxyResp.ok) {
      const erro = await proxyResp.text();
      await supabase.from("fin_sefaz_agendamentos").update({
        ultimo_status: "erro", ultimo_erro: erro.slice(0, 500),
        ultima_execucao: new Date().toISOString(),
      }).eq("id", agendamento_id);
      return new Response(JSON.stringify({ ok: false, erro }), { status: 502, headers: corsHeaders });
    }

    const result = await proxyResp.json();
    const documentos = result?.documentos || [];
    let importadas = 0;

    for (const doc of documentos) {
      // Insere NF-e (idempotente por chave)
      const { error: errIns } = await supabase.from("fin_notas_fiscais").upsert({
        empresa_id: agend.empresa_id,
        chave_acesso: doc.chave,
        numero: doc.numero,
        serie: doc.serie,
        emissor_cnpj: doc.emitente_cnpj,
        emissor_razao: doc.emitente_razao,
        valor_total: doc.valor_total,
        data_emissao: doc.data_emissao,
        xml_url: doc.xml_url || null,
        origem: "sefaz_distribuicao",
        user_id: user.id,
      }, { onConflict: "chave_acesso" });
      if (!errIns) importadas++;
    }

    const novoNSU = result?.ultimo_nsu || agend.ultimo_nsu;
    await supabase.from("fin_sefaz_agendamentos").update({
      ultimo_nsu: novoNSU,
      ultima_execucao: new Date().toISOString(),
      total_importadas: (agend.total_importadas || 0) + importadas,
      ultimo_status: "sucesso",
      ultimo_erro: null,
    }).eq("id", agendamento_id);

    return new Response(JSON.stringify({ ok: true, importadas, novo_nsu: novoNSU }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fin-sefaz-nsu-puxar:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
