// ═══════════════════════════════════════════════════════════════════════════
// A compra do Compras.gov por UASG + número/ano — Fase 6 do robô (16/09/2026)
//
// Recebe { uasg, edital } (ou { uasg, numero, ano }) e devolve a compra com os
// itens, lida dos dados abertos do Compras.gov: órgão, objeto, SRP, modalidade,
// modo de disputa, prazos de proposta (com o fuso de Brasília) e, por item,
// número, descrição, quantidade, unidade, valor estimado (nulo se sigiloso),
// grupo e benefício ME/EPP. Por que essa fonte, e não o PNCP: ver
// `_shared/compra-comprasgov.ts`.
//
// Resposta sempre 200 com `success`, para a tela mostrar a mensagem real
// (princípio 3) — `functions.invoke` troca o corpo de um 4xx por texto genérico.
// ═══════════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";
import { buscarComprasNosDadosAbertos, lerNumeroEAno, uasgValida } from "../_shared/compra-comprasgov.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function responder(corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req, { functionName: "compra-comprasgov", maxRequests: 40, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = await req.json();
  } catch {
    return responder({ success: false, error: "Corpo da requisição inválido." });
  }

  const uasg = uasgValida(corpo.uasg as string);
  if (!uasg) return responder({ success: false, error: "Informe a UASG com 6 dígitos." });

  const numeroEAno = corpo.numero && corpo.ano
    ? lerNumeroEAno(`${corpo.numero}/${corpo.ano}`)
    : lerNumeroEAno(corpo.edital as string);
  if (!numeroEAno) {
    return responder({ success: false, error: "Informe o número da compra no formato número/ano — ex.: 90012/2025." });
  }
  const { numero, ano } = numeroEAno;

  let compras;
  let falhas = 0;
  try {
    ({ compras, falhas } = await buscarComprasNosDadosAbertos(uasg, numero, ano));
  } catch (e) {
    console.error(`compra-comprasgov ${uasg} ${numero}/${ano}: itens`, e);
    return responder({
      success: false,
      error: "A compra foi encontrada, mas a leitura dos itens falhou. Tente de novo em instantes.",
    });
  }

  if (compras.length === 0) {
    if (falhas > 0) {
      console.warn(`compra-comprasgov ${uasg} ${numero}/${ano}: ${falhas} consulta(s) falharam`);
      return responder({
        success: false,
        error: "Não foi possível consultar os dados abertos do Compras.gov agora. Tente de novo em instantes.",
      });
    }
    return responder({
      success: false,
      error: `Nenhuma compra ${numero}/${ano} na UASG ${uasg} (pregão, concorrência ou dispensa). Confira o número, o ano e a UASG no edital — compra publicada hoje pode levar até um dia para aparecer nos dados abertos.`,
    });
  }

  console.log(`compra-comprasgov ${uasg} ${numero}/${ano}: ${compras.map((c) => `${c.idCompra} (${c.itens.length} itens)`).join(", ")}`);
  return responder({ success: true, compras, consultado_em: new Date().toISOString() });
});
