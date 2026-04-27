/**
 * Converte um extrato bancário CSV em pseudo-OFX SGML, reaproveitando
 * o pipeline backend `import-ofx` (parsing, dedup por FITID, criação
 * de movimentos e auditoria).
 *
 * Formato esperado do CSV (cabeçalho na 1ª linha, separador `,` ou `;`):
 *   data, descricao, valor[, documento]
 *
 * Aceita variações comuns de cabeçalho em PT-BR:
 *   - data | data_movimento | dt | dt_lancamento
 *   - descricao | historico | memo | descrição | histórico
 *   - valor | montante | amount
 *   - documento | doc | nro_doc | id (opcional, usado como FITID)
 *
 * Datas aceitas: dd/MM/yyyy, yyyy-MM-dd, dd-MM-yyyy.
 * Valores: usa último separador como decimal (1.234,56 ou 1,234.56).
 */

export interface CsvLinha {
  data: string; // YYYYMMDD
  valor: number;
  descricao: string;
  fitid: string;
}

function detectarSeparador(headerLine: string): string {
  const c = (headerLine.match(/,/g) ?? []).length;
  const sc = (headerLine.match(/;/g) ?? []).length;
  return sc > c ? ";" : ",";
}

function normalizarHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^["']|["']$/g, "");
}

function mapearColunas(headers: string[]) {
  const map: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = normalizarHeader(raw);
    if (["data", "data_movimento", "dt", "dt_lancamento", "date"].includes(h)) map.data = i;
    else if (["descricao", "historico", "memo", "description", "historic"].includes(h)) map.descricao = i;
    else if (["valor", "montante", "amount", "value"].includes(h)) map.valor = i;
    else if (["documento", "doc", "nro_doc", "id", "fitid"].includes(h)) map.fitid = i;
    else if (["credito", "credit"].includes(h)) map.credito = i;
    else if (["debito", "debit"].includes(h)) map.debito = i;
  });
  return map;
}

function parseData(s: string): string | null {
  const v = s.trim().replace(/^["']|["']$/g, "");
  if (!v) return null;
  // dd/MM/yyyy ou dd-MM-yyyy
  const br = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(v);
  if (br) return `${br[3]}${br[2]}${br[1]}`;
  // yyyy-MM-dd
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  return null;
}

function parseValor(s: string): number {
  const v = s.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  if (!v) return 0;
  // Detecta o último separador (vírgula ou ponto) como decimal
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  let normalizado = v;
  if (lastComma > lastDot) {
    // vírgula é decimal
    normalizado = v.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalizado = v.replace(/,/g, "");
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === sep && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsvExtrato(texto: string): CsvLinha[] {
  const linhas = texto
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];
  const sep = detectarSeparador(linhas[0]);
  const headers = splitCsvLine(linhas[0], sep);
  const cols = mapearColunas(headers);
  if (cols.data === undefined) {
    throw new Error("Cabeçalho 'data' não encontrado no CSV.");
  }
  if (cols.valor === undefined && cols.credito === undefined && cols.debito === undefined) {
    throw new Error("Cabeçalho 'valor' (ou 'credito'/'debito') não encontrado no CSV.");
  }

  const out: CsvLinha[] = [];
  for (let li = 1; li < linhas.length; li++) {
    const campos = splitCsvLine(linhas[li], sep);
    const data = parseData(campos[cols.data] ?? "");
    if (!data) continue;
    let valor = 0;
    if (cols.valor !== undefined) {
      valor = parseValor(campos[cols.valor] ?? "0");
    } else {
      const c = cols.credito !== undefined ? parseValor(campos[cols.credito] ?? "0") : 0;
      const d = cols.debito !== undefined ? parseValor(campos[cols.debito] ?? "0") : 0;
      valor = c - d;
    }
    if (valor === 0) continue;
    const descricao = (cols.descricao !== undefined ? campos[cols.descricao] : "Movimento bancário")
      ?.trim()
      .replace(/^["']|["']$/g, "") || "Movimento bancário";
    const fitid =
      (cols.fitid !== undefined && campos[cols.fitid]?.trim()) ||
      `${data}-${valor.toFixed(2)}-${li}`;
    out.push({ data, valor, descricao, fitid });
  }
  return out;
}

/** Gera um envelope OFX SGML mínimo aceito pelo parser de `import-ofx`. */
export function csvParaOfx(linhas: CsvLinha[]): string {
  const head = `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX>\n<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n`;
  const tail = `</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>\n</OFX>\n`;
  const body = linhas
    .map((l) => {
      const tipo = l.valor >= 0 ? "CREDIT" : "DEBIT";
      return [
        "<STMTTRN>",
        `<TRNTYPE>${tipo}`,
        `<DTPOSTED>${l.data}120000`,
        `<TRNAMT>${l.valor.toFixed(2)}`,
        `<FITID>${l.fitid.replace(/[<>&]/g, "")}`,
        `<MEMO>${l.descricao.replace(/[<>&]/g, " ").slice(0, 255)}`,
        "</STMTTRN>",
      ].join("\n");
    })
    .join("\n");
  return head + body + "\n" + tail;
}
