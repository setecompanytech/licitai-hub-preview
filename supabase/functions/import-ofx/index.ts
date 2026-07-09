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

// ---------------------------------------------------------------------------
// Parser OFX/SGML robusto baseado em tokenização + árvore.
// Funciona para OFX 1.x (SGML, sem fechamentos) e OFX 2.x (XML estrito).
// Não depende de heurísticas de split/regex frágeis: respeita o aninhamento
// real das tags container do padrão OFX.
// ---------------------------------------------------------------------------

// Tags container conhecidas do OFX (precisam de fechamento lógico).
// Qualquer outra tag é tratada como folha (carrega valor textual).
const OFX_CONTAINERS = new Set<string>([
  "OFX",
  "SIGNONMSGSRSV1", "SONRS", "FI", "STATUS",
  "BANKMSGSRSV1", "STMTTRNRS", "STMTRS",
  "BANKACCTFROM", "CCACCTFROM", "BANKTRANLIST",
  "STMTTRN", "LEDGERBAL", "AVAILBAL",
  "CREDITCARDMSGSRSV1", "CCSTMTTRNRS", "CCSTMTRS",
  "INVSTMTMSGSRSV1", "INVSTMTTRNRS", "INVSTMTRS",
  "BALLIST", "BAL",
]);

interface OFXNode {
  tag: string;
  value?: string;          // valor (somente folhas)
  children: OFXNode[];     // filhos (somente containers)
  parent?: OFXNode;
}

function tokenizeOFX(raw: string): OFXNode {
  // Limpeza: BOM, CR, normaliza tags para uppercase preservando texto.
  let body = raw.replace(/^\uFEFF/, "").replace(/\r/g, "");
  // Descarta cabeçalho SGML/XML antes de <OFX>
  const ofxIdx = body.search(/<OFX[\s>]/i);
  if (ofxIdx === -1) {
    throw new Error("Arquivo OFX inválido: tag <OFX> não encontrada.");
  }
  body = body.slice(ofxIdx);
  // Uppercase apenas em nomes de tag
  body = body.replace(/<\/?[a-zA-Z0-9._-]+\s*\/?>/g, (m) => m.toUpperCase());

  const root: OFXNode = { tag: "__ROOT__", children: [] };
  let current: OFXNode = root;

  // Regex que captura tags e texto entre elas.
  const tagRe = /<\s*\/?\s*([A-Z0-9._-]+)\s*\/?\s*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  // Helper: adiciona texto entre tags como valor da folha "current".
  // Apenas relevante quando current é uma folha pendente.
  let pendingLeaf: OFXNode | null = null;

  const flushTextTo = (text: string) => {
    if (!pendingLeaf) return;
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      pendingLeaf.value = (pendingLeaf.value ?? "") + trimmed;
    }
  };

  while ((m = tagRe.exec(body)) !== null) {
    const between = body.slice(lastIndex, m.index);
    if (between.length > 0) flushTextTo(between);
    lastIndex = tagRe.lastIndex;

    const fullTag = m[0];
    const tagName = m[1];
    const isClose = /^<\s*\//.test(fullTag);
    const isSelfClose = /\/\s*>$/.test(fullTag);

    // Qualquer nova tag (open/close/self) finaliza folha pendente.
    pendingLeaf = null;

    if (isClose) {
      // Fechamento explícito: sobe até encontrar a tag correspondente.
      let node: OFXNode | undefined = current;
      while (node && node.tag !== tagName) node = node.parent;
      if (node && node.parent) current = node.parent;
      // Se não achou, ignora silenciosamente (OFX malformado tolerado).
      continue;
    }

    const isContainer = OFX_CONTAINERS.has(tagName);

    if (isContainer) {
      const node: OFXNode = { tag: tagName, children: [], parent: current };
      current.children.push(node);
      if (!isSelfClose) current = node;
    } else {
      // Folha: cria nó vazio, marca como pendente p/ receber texto.
      const leaf: OFXNode = { tag: tagName, children: [], parent: current };
      current.children.push(leaf);
      if (!isSelfClose) pendingLeaf = leaf;
    }
  }
  return root;
}

function findFirst(node: OFXNode, tag: string): OFXNode | null {
  if (node.tag === tag) return node;
  for (const c of node.children) {
    const r = findFirst(c, tag);
    if (r) return r;
  }
  return null;
}
function findAll(node: OFXNode, tag: string, acc: OFXNode[] = []): OFXNode[] {
  if (node.tag === tag) acc.push(node);
  for (const c of node.children) findAll(c, tag, acc);
  return acc;
}
function leafValue(parent: OFXNode | null, tag: string): string | null {
  if (!parent) return null;
  for (const c of parent.children) {
    if (c.tag === tag) return (c.value ?? "").trim() || null;
  }
  return null;
}

function parseOFXDate(raw: string): string {
  if (!raw) return "";
  // Remove sufixo de timezone ex: "20240115120000.000[0:GMT]"
  const clean = raw.replace(/\[.*\]/, "").trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function mapType(trnType: string, amount: number): string {
  const tipo = trnType.toUpperCase();
  const creditTypes = ["CREDIT", "DEP", "INT", "DIV", "DIRECTDEP", "REPEATPMT"];
  if (creditTypes.includes(tipo)) return "credito";
  if (tipo === "DEBIT" || tipo === "DIRECTDEBIT") return "debito";
  return amount >= 0 ? "credito" : "debito";
}

function parseOFX(content: string) {
  const root = tokenizeOFX(content);

  // Conta: BANKACCTFROM ou CCACCTFROM
  const acctNode = findFirst(root, "BANKACCTFROM") ?? findFirst(root, "CCACCTFROM");
  const accountId = leafValue(acctNode, "ACCTID");
  if (!accountId) {
    throw new Error("Conta não identificada no OFX (ACCTID ausente em BANKACCTFROM/CCACCTFROM).");
  }

  const tranList = findFirst(root, "BANKTRANLIST");
  const startDate = parseOFXDate(leafValue(tranList, "DTSTART") ?? "");
  const endDate = parseOFXDate(leafValue(tranList, "DTEND") ?? "");

  const trxNodes = findAll(root, "STMTTRN");
  console.log("[import-ofx] STMTTRN encontradas:", trxNodes.length);
  if (trxNodes.length > 0) {
    console.log("[import-ofx] primeira:", JSON.stringify({
      type: leafValue(trxNodes[0], "TRNTYPE"),
      dt: leafValue(trxNodes[0], "DTPOSTED"),
      amt: leafValue(trxNodes[0], "TRNAMT"),
      memo: leafValue(trxNodes[0], "MEMO"),
      fitid: leafValue(trxNodes[0], "FITID"),
    }));
  }

  const transactions: OFXTransaction[] = [];
  let idx = 0;
  for (const node of trxNodes) {
    const trnType = leafValue(node, "TRNTYPE") ?? "OTHER";
    const dtposted = parseOFXDate(leafValue(node, "DTPOSTED") ?? "");
    const trnamt = parseFloat(leafValue(node, "TRNAMT") ?? "0");
    const memo = leafValue(node, "MEMO") ?? "";
    const name = leafValue(node, "NAME") ?? "";
    const checknum = leafValue(node, "CHECKNUM") ?? "";
    const refnum = leafValue(node, "REFNUM") ?? "";

    // FITID determinístico quando o banco omite (Banpará e outros)
    let fitid = leafValue(node, "FITID");
    if (!fitid) {
      const sig = `${dtposted}|${trnamt.toFixed(2)}|${(name || memo).replace(/\s+/g, " ").trim()}|${checknum}|${refnum}|${idx}`;
      fitid = `SYN-${sig.replace(/[^A-Za-z0-9.|-]/g, "_").slice(0, 80)}`;
    }
    idx++;

    transactions.push({
      fitid,
      type: mapType(trnType, trnamt),
      amount: trnamt,
      date: dtposted,
      description: (name || memo).trim() || "(sem descrição)",
      memo: memo && memo !== name ? memo : undefined,
    });
  }

  if (transactions.length === 0) {
    throw new Error("Nenhuma transação <STMTTRN> encontrada no arquivo OFX.");
  }

  return { accountId, startDate, endDate, transactions };
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
