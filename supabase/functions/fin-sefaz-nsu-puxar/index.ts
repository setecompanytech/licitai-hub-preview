// Edge: fin-sefaz-nsu-puxar
// Importa NF-e via SEFAZ DistribuicaoDFe pelo último NSU armazenado.
// Usa proxy externo (SEFAZ_PROXY_URL + SEFAZ_PROXY_TOKEN, services/sefaz-proxy) para mTLS
// com o certificado A1 da empresa (bucket `certificados` + senha cifrada); fallback grava status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carregarCertificadoA1, chamarProxy, urlDoProxy } from "../_shared/certificado-a1.ts";

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

    const proxy = urlDoProxy();
    if ("erro" in proxy) {
      // Marca como pendente de configuração — com o motivo dito.
      await supabase.from("fin_sefaz_agendamentos").update({
        ultimo_status: "configuracao_pendente",
        ultimo_erro: proxy.erro,
        ultima_execucao: new Date().toISOString(),
      }).eq("id", agendamento_id);
      return new Response(JSON.stringify({ ok: false, configuracao_pendente: true, message: proxy.erro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // O certificado A1 da empresa vai junto: o proxy não guarda nada (30/09).
    const cert = await carregarCertificadoA1(supabase, agend.empresa_id);
    if ("erro" in cert) {
      await supabase.from("fin_sefaz_agendamentos").update({
        ultimo_status: "configuracao_pendente", ultimo_erro: cert.erro, ultima_execucao: new Date().toISOString(),
      }).eq("id", agendamento_id);
      return new Response(JSON.stringify({ ok: false, configuracao_pendente: true, message: cert.erro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Chama proxy mTLS (DistribuicaoDFe). Falha de rede ou de token vira
    // registro no agendamento e resposta 200 com o motivo — nunca "non-2xx".
    let proxyResp: { status: number; corpo: string };
    try {
      proxyResp = await chamarProxy(proxy.url, "/distribuicao-dfe", {
        cnpj: agend.cnpj,
        ultimo_nsu: agend.ultimo_nsu || "0",
        ambiente: Deno.env.get("SEFAZ_AMBIENTE") === "homologacao" ? "homologacao" : "producao",
        pfx_base64: cert.certificado.pfxBase64,
        senha: cert.certificado.senha,
      }, 120000);
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      await supabase.from("fin_sefaz_agendamentos").update({ ultimo_status: "erro", ultimo_erro: erro.slice(0, 500), ultima_execucao: new Date().toISOString() }).eq("id", agendamento_id);
      return new Response(JSON.stringify({ ok: false, erro, message: erro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (proxyResp.status < 200 || proxyResp.status >= 300) {
      const erro = proxyResp.status === 401
        ? "O proxy recusou o token: SEFAZ_PROXY_TOKEN (edge) e PROXY_TOKEN (proxy) precisam ser iguais."
        : `Proxy respondeu HTTP ${proxyResp.status}: ${proxyResp.corpo.slice(0, 300)}`;
      await supabase.from("fin_sefaz_agendamentos").update({
        ultimo_status: "erro", ultimo_erro: erro.slice(0, 500),
        ultima_execucao: new Date().toISOString(),
      }).eq("id", agendamento_id);
      return new Response(JSON.stringify({ ok: false, erro, message: erro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(proxyResp.corpo);
    // Só a nota inteira (procNFe) vira registro; o resumo (resNFe) espera a manifestação.
    const documentos = (result?.documentos || []).filter((d: { tipo?: string }) => d?.tipo !== "resNFe");
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
