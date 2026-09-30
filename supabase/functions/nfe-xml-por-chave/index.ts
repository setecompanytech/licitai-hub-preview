/**
 * nfe-xml-por-chave (30/09/2026) — o XML de uma NF-e a partir da chave, pela
 * porta oficial: NFeDistribuicaoDFe (consChNFe), com o certificado A1 da
 * empresa, via proxy mTLS (services/sefaz-proxy). A SEFAZ entrega a nota a
 * quem é parte dela (destinatário, transportador, terceiro autorizado); nota
 * sem "Ciência da Operação" vem só como resumo.
 *
 *   { empresa_id, chave }            → { ok, xml, resumo } | { ok:false, motivo, ... }
 *   { empresa_id, modo: "status" }   → { tem_certificado, arquivo, enviado_em, proxy_configurado }
 *
 * O certificado e a senha nunca voltam ao navegador nem vão para o log.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { carregarCertificadoA1, chamarProxy, statusDoCertificado, urlDoProxy } from "../_shared/certificado-a1.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  for (let i = 0; i < 43; i++) soma += Number(chave[42 - i]) * (2 + (i % 8));
  const r = 11 - (soma % 11);
  return (r >= 10 ? 0 : r) === Number(chave[43]);
}

type DocDoProxy = {
  tipo: "procNFe" | "resNFe" | "outro"; chave: string | null; numero: string | null; serie: string | null;
  emitente_cnpj: string | null; emitente_razao: string | null; destinatario_cnpj: string | null;
  valor_total: number | null; data_emissao: string | null; protocolo: string | null; situacao?: string | null; xml: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Sessão não enviada: entre de novo." }, 401);
    const token = auth.slice(7).trim();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sessão inválida ou expirada: entre de novo." }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const empresaId = String(body.empresa_id ?? "");
    if (!empresaId) return json({ error: "empresa_id é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: membro } = await admin.from("empresa_membros").select("user_id").eq("empresa_id", empresaId).eq("user_id", userId).maybeSingle();
    if (!membro) return json({ error: "Seu usuário não é membro da empresa selecionada." }, 403);

    const proxy = urlDoProxy();

    if (body.modo === "status") {
      const status = await statusDoCertificado(admin, empresaId);
      return json({ ...status, proxy_configurado: "url" in proxy, proxy_motivo: "erro" in proxy ? proxy.erro : null });
    }

    const chave = String(body.chave ?? "").replace(/\D/g, "");
    if (!chaveValida(chave)) return json({ error: "Chave de acesso inválida: precisa de 44 dígitos com dígito verificador correto." }, 400);

    if ("erro" in proxy) return json({ ok: false, setup_required: true, motivo: proxy.erro });

    const { data: emp } = await admin.from("empresas").select("cnpj").eq("id", empresaId).maybeSingle();
    const cnpj = String(emp?.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) return json({ ok: false, motivo: "Empresa sem CNPJ cadastrado." });

    const cert = await carregarCertificadoA1(admin, empresaId);
    if ("erro" in cert) return json({ ok: false, sem_certificado: !!cert.sem_certificado, motivo: cert.erro });

    const inicio = Date.now();
    let resp: { status: number; corpo: string };
    try {
      resp = await chamarProxy(proxy.url, "/consulta-chave", {
        cnpj, chave, ambiente: Deno.env.get("SEFAZ_AMBIENTE") === "homologacao" ? "homologacao" : "producao",
        uf_autor: chave.slice(0, 2), pfx_base64: cert.certificado.pfxBase64, senha: cert.certificado.senha,
      });
    } catch (e) {
      return json({ ok: false, setup_required: true, motivo: e instanceof Error ? e.message : String(e) });
    }
    let ret: { ok?: boolean; cStat?: string; mensagem?: string; error?: string; documentos?: DocDoProxy[] } = {};
    try { ret = JSON.parse(resp.corpo); } catch { ret = { error: resp.corpo.slice(0, 300) }; }
    console.log(`[nfe-xml-por-chave] empresa=${empresaId} chave=…${chave.slice(-8)} http=${resp.status} cStat=${ret.cStat ?? "-"} ${Date.now() - inicio}ms`);
    if (resp.status === 401) return json({ ok: false, setup_required: true, motivo: "O proxy recusou o token: SEFAZ_PROXY_TOKEN (edge) e PROXY_TOKEN (proxy) precisam ser iguais." });
    if (resp.status < 200 || resp.status >= 300 || ret.error) return json({ ok: false, motivo: `O proxy da SEFAZ falhou: ${ret.error ?? `HTTP ${resp.status}`}` });

    const docs = ret.documentos ?? [];
    const inteira = docs.find((d) => d.tipo === "procNFe" && d.chave === chave) ?? docs.find((d) => d.tipo === "procNFe");
    if (inteira) {
      const { xml, ...resumo } = inteira;
      return json({ ok: true, cStat: ret.cStat, xml, resumo });
    }
    const resumo = docs.find((d) => d.tipo === "resNFe");
    if (resumo) {
      const { xml: _x, ...r } = resumo;
      return json({
        ok: false, cStat: ret.cStat, precisa_manifestar: true, resumo: r,
        motivo: `A SEFAZ entregou só o resumo da NF-e ${r.chave?.slice(25, 34).replace(/^0+/, "") ?? ""}: o XML inteiro sai depois da "Ciência da Operação" (manifestação do destinatário). Registre a ciência e busque de novo.`,
      });
    }
    return json({ ok: false, cStat: ret.cStat, motivo: ret.mensagem ?? "A SEFAZ não devolveu a nota." });
  } catch (e) {
    console.error("[nfe-xml-por-chave] erro:", e instanceof Error ? e.message : e);
    return json({ error: `Erro interno: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
