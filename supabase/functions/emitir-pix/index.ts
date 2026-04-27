// =============================================================================
// PRAEFECTUS — Edge Function: emitir-pix
// Gera BR Code (Pix Copia e Cola) estático conforme especificação BACEN/BCB.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ---- BR Code (Pix) ---- conforme Manual BR Code BCB
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function sanitize(s: string, max: number): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").slice(0, max).toUpperCase();
}
function gerarBRCode(args: {
  chave: string; nome: string; cidade: string; valor?: number; txid?: string; descricao?: string;
}): string {
  const merchantInfo =
    tlv("00", "BR.GOV.BCB.PIX") +
    tlv("01", args.chave) +
    (args.descricao ? tlv("02", sanitize(args.descricao, 72)) : "");
  const additional = tlv("05", args.txid ? sanitize(args.txid, 25) : "***");
  let payload =
    tlv("00", "01") +
    tlv("26", merchantInfo) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (args.valor ? tlv("54", args.valor.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitize(args.nome, 25)) +
    tlv("60", sanitize(args.cidade, 15)) +
    tlv("62", additional);
  payload += "6304";
  return payload + crc16(payload);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      empresa_id, lancamento_id, pessoa_id,
      valor, descricao, chave_pix, beneficiario_nome,
      beneficiario_cidade = "BELEM", tipo = "estatico", txid,
    } = body;

    if (!empresa_id || !valor || !chave_pix || !beneficiario_nome) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: empresa_id, valor, chave_pix, beneficiario_nome" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const valorNum = Number(valor);
    if (!isFinite(valorNum) || valorNum <= 0) {
      return new Response(JSON.stringify({ error: "Valor inválido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const txidFinal = txid || `PRAE${Date.now().toString(36).toUpperCase()}`;
    const brCode = gerarBRCode({
      chave: chave_pix,
      nome: beneficiario_nome,
      cidade: beneficiario_cidade,
      valor: valorNum,
      txid: txidFinal,
      descricao,
    });

    const { data: cobranca, error } = await supabase
      .from("fin_pix_cobrancas")
      .insert({
        empresa_id, lancamento_id, pessoa_id,
        txid: txidFinal,
        valor: valorNum,
        descricao,
        chave_pix,
        beneficiario_nome,
        beneficiario_cidade,
        br_code: brCode,
        tipo,
        status: "pendente",
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, cobranca, br_code: brCode }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[emitir-pix]", e);
    return new Response(JSON.stringify({ error: e.message ?? "Erro interno" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
