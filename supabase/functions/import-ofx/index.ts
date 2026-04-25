// Edge Function: import-ofx
// Recebe OFX (texto) + conta_id + empresa_id, parseia e persiste extrato + movimentos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface OFXTransaction {
  fitid: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  memo?: string;
}

function sgmlToXml(sgml: string): string {
  return sgml.replace(
    /<([A-Z0-9.]+)>([^<\n]*)(?=<|$)/g,
    (_m, tag, val) => (val.trim() === "" ? `<${tag}>` : `<${tag}>${val}</${tag}>`)
  );
}

function parseOFXDate(s: string): string {
  const clean = s.replace(/[^\d]/g, "").substring(0, 8);
  if (clean.length !== 8) return "";
  return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
}

function mapType(raw: string, amount: number): string {
  const t = raw.toUpperCase();
  if (t === "FEE" || t === "SRVCHG") return "FEE";
  if (t === "INT") return "INT";
  if (t === "DIV") return "DIV";
  return amount > 0 ? "CREDIT" : "DEBIT";
}

function parseOFX(content: string) {
  if (!content || !content.includes("<OFX>")) {
    throw new Error("Arquivo OFX inválido: tag <OFX> não encontrada");
  }
  const body = content.replace(/^.*?<OFX>/s, "<OFX>").replace(/\r/g, "").trim();
  const xml = sgmlToXml(body);

  const get = (parent: string, tag: string): string | null => {
    const re = new RegExp(`<${parent}>([\\s\\S]*?)</${parent}>`);
    const block = xml.match(re)?.[1];
    if (!block) return null;
    const m = block.match(new RegExp(`<${tag}>([^<]*)`));
    return m ? m[1].trim() : null;
  };
  const getInBlock = (block: string, tag: string): string | null => {
    const m = block.match(new RegExp(`<${tag}>([^<]*)`));
    return m ? m[1].trim() : null;
  };

  const accountId = get("BANKACCTFROM", "ACCTID");
  if (!accountId) throw new Error("Conta não identificada (ACCTID ausente)");

  const transactions: OFXTransaction[] = [];
  const trxBlocks = xml.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g);
  for (const match of trxBlocks) {
    const block = match[1];
    const fitid = getInBlock(block, "FITID");
    if (!fitid) continue;
    const trnType = getInBlock(block, "TRNTYPE") ?? "OTHER";
    const dtposted = parseOFXDate(getInBlock(block, "DTPOSTED") ?? "");
    const trnamt = parseFloat(getInBlock(block, "TRNAMT") ?? "0");
    const memo = getInBlock(block, "MEMO") ?? "";
    const name = getInBlock(block, "NAME") ?? "";
    transactions.push({
      fitid,
      type: mapType(trnType, trnamt),
      amount: trnamt,
      date: dtposted,
      description: (name || memo).trim(),
      memo: memo !== name ? memo : undefined,
    });
  }
  if (transactions.length === 0) throw new Error("Nenhuma transação encontrada");

  return {
    accountId,
    startDate: parseOFXDate(get("BANKTRANLIST", "DTSTART") ?? ""),
    endDate: parseOFXDate(get("BANKTRANLIST", "DTEND") ?? ""),
    transactions,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { empresa_id, conta_id, arquivo_nome, conteudo_ofx } = body;
    if (!empresa_id || !conta_id || !conteudo_ofx || !arquivo_nome) {
      return new Response(
        JSON.stringify({ error: "Parâmetros: empresa_id, conta_id, arquivo_nome, conteudo_ofx" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifica membership
    const { data: isMember } = await supabase.rpc("is_empresa_member", {
      _user_id: user.id,
      _empresa_id: empresa_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso a esta empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse
    const stmt = parseOFX(conteudo_ofx);
    const arquivo_hash = await sha256Hex(conteudo_ofx);

    // Verifica duplicata
    const { data: existente } = await supabase
      .from("financeiro_extratos_importados")
      .select("id, total_movimentos")
      .eq("empresa_id", empresa_id)
      .eq("conta_id", conta_id)
      .eq("arquivo_hash", arquivo_hash)
      .maybeSingle();

    if (existente) {
      return new Response(
        JSON.stringify({
          ok: true,
          duplicado: true,
          extrato_id: existente.id,
          total_movimentos: existente.total_movimentos,
          mensagem: "Arquivo já importado anteriormente.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cria extrato
    const { data: extrato, error: errExtrato } = await supabase
      .from("financeiro_extratos_importados")
      .insert({
        empresa_id,
        conta_id,
        formato: "ofx",
        arquivo_nome,
        arquivo_hash,
        data_inicio: stmt.startDate || null,
        data_fim: stmt.endDate || null,
        total_movimentos: stmt.transactions.length,
        status: "processando",
        importado_por: user.id,
      })
      .select()
      .single();

    if (errExtrato) throw errExtrato;

    // Insere movimentos (upsert por (conta_id, fitid))
    const movimentos = stmt.transactions.map((t) => ({
      empresa_id,
      extrato_id: extrato.id,
      conta_id,
      fitid: t.fitid,
      tipo: t.type,
      valor: t.amount,
      data_movimento: t.date,
      descricao: t.description || "(sem descrição)",
      descricao_extra: t.memo ?? null,
    }));

    const { error: errMov } = await supabase
      .from("financeiro_extrato_movimentos")
      .upsert(movimentos, { onConflict: "conta_id,fitid", ignoreDuplicates: true });

    if (errMov) {
      await supabase
        .from("financeiro_extratos_importados")
        .update({ status: "erro", erro_mensagem: errMov.message })
        .eq("id", extrato.id);
      throw errMov;
    }

    await supabase
      .from("financeiro_extratos_importados")
      .update({ status: "concluido" })
      .eq("id", extrato.id);

    return new Response(
      JSON.stringify({
        ok: true,
        extrato_id: extrato.id,
        total_movimentos: stmt.transactions.length,
        periodo: { inicio: stmt.startDate, fim: stmt.endDate },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-ofx error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
