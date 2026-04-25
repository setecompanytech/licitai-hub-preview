// ============================================================================
// PRAEFECTUS — Parser OFX (client-side)
// Path no Lovable: src/lib/financeiro/ofx-parser.ts
// ============================================================================
// Por que parsear no client:
//   - Permite preview antes de enviar para servidor
//   - Reduz custo de Edge Function
//   - Permite validação imediata de formato
//
// O servidor também pode parsear (idem lógica em import-ofx) para casos onde
// arquivo é enviado por integração automática.
// ============================================================================

export interface OFXTransaction {
  fitid: string;
  type: "DEBIT" | "CREDIT" | "FEE" | "INT" | "DIV" | "OTHER";
  amount: number;
  date: string;        // ISO yyyy-MM-dd
  description: string;
  memo?: string;
}

export interface OFXStatement {
  bankId?: string;
  branchId?: string;
  accountId: string;
  accountType: string;
  startDate: string;
  endDate: string;
  finalBalance?: number;
  currency: string;
  transactions: OFXTransaction[];
}

export class OFXParseError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = "OFXParseError";
  }
}

export function parseOFX(content: string): OFXStatement {
  if (!content || !content.includes("<OFX>")) {
    throw new OFXParseError("Arquivo OFX inválido", "Tag <OFX> não encontrada");
  }

  const body = content
    .replace(/^.*?<OFX>/s, "<OFX>")
    .replace(/\r/g, "")
    .trim();

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
  if (!accountId) {
    throw new OFXParseError(
      "Conta não identificada no arquivo OFX",
      "Tag <ACCTID> ausente em <BANKACCTFROM>"
    );
  }

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

  if (transactions.length === 0) {
    throw new OFXParseError("Nenhuma transação encontrada no arquivo");
  }

  return {
    bankId: get("BANKACCTFROM", "BANKID") ?? undefined,
    branchId: get("BANKACCTFROM", "BRANCHID") ?? undefined,
    accountId,
    accountType: get("BANKACCTFROM", "ACCTTYPE") ?? "CHECKING",
    startDate: parseOFXDate(get("BANKTRANLIST", "DTSTART") ?? ""),
    endDate: parseOFXDate(get("BANKTRANLIST", "DTEND") ?? ""),
    finalBalance: parseFloat(get("LEDGERBAL", "BALAMT") ?? "0"),
    currency: get("CURDEF", "CURDEF") ?? "BRL",
    transactions,
  };
}

function sgmlToXml(sgml: string): string {
  return sgml.replace(/<([A-Z0-9.]+)>([^<\n]*)(?=<|$)/g, (_m, tag, val) => {
    if (val.trim() === "") return `<${tag}>`;
    return `<${tag}>${val}</${tag}>`;
  });
}

function parseOFXDate(s: string): string {
  const clean = s.replace(/[^\d]/g, "").substring(0, 8);
  if (clean.length !== 8) return "";
  return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
}

function mapType(raw: string, amount: number): OFXTransaction["type"] {
  const t = raw.toUpperCase();
  if (t === "FEE" || t === "SRVCHG") return "FEE";
  if (t === "INT") return "INT";
  if (t === "DIV") return "DIV";
  return amount > 0 ? "CREDIT" : "DEBIT";
}

// ----------------------------------------------------------------------------
// Helper: validação rápida antes de enviar ao servidor
// ----------------------------------------------------------------------------

export interface OFXSummary {
  accountId: string;
  bankName?: string;
  totalTransactions: number;
  totalCredits: number;
  totalDebits: number;
  startDate: string;
  endDate: string;
  finalBalance?: number;
}

export function summarizeOFX(stmt: OFXStatement): OFXSummary {
  let credits = 0, debits = 0;
  for (const t of stmt.transactions) {
    if (t.amount > 0) credits += t.amount;
    else debits += Math.abs(t.amount);
  }
  return {
    accountId: stmt.accountId,
    bankName: stmt.bankId ? bankFromCode(stmt.bankId) : undefined,
    totalTransactions: stmt.transactions.length,
    totalCredits: credits,
    totalDebits: debits,
    startDate: stmt.startDate,
    endDate: stmt.endDate,
    finalBalance: stmt.finalBalance,
  };
}

const BANCOS_BR: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "260": "Nu Pagamentos",
  "341": "Itaú",
  "356": "Banco Real",
  "389": "Mercantil do Brasil",
  "422": "Safra",
  "748": "Sicredi",
  "756": "Sicoob",
  "077": "Inter",
  "212": "Banco Original",
  "336": "C6 Bank",
};

function bankFromCode(code: string): string | undefined {
  const padded = code.padStart(3, "0");
  return BANCOS_BR[padded];
}
