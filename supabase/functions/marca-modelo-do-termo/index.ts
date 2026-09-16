// ═══════════════════════════════════════════════════════════════════════════
// Marca e modelo indicados no termo de referência — Fase 6 do robô (16/09/2026)
//
// Recebe as coordenadas da compra no PNCP ({ cnpj, ano, sequencial }) e os
// itens da disputa ({ numero, descricao }), abre os arquivos publicados (PDF,
// ZIP ou RAR), lê o termo de referência e devolve, por item, a marca e o
// modelo que o ÓRGÃO indica — com o trecho que prova. O porquê de cada etapa
// (recorte antes da IA, prova conferida, leitura sob demanda) está em
// `_shared/termo-de-referencia.ts`.
//
// Resposta sempre 200 com `success`, para a tela mostrar a mensagem real.
// ═══════════════════════════════════════════════════════════════════════════
import { requireAuth } from "../_shared/auth-rate-limit.ts";
import { chamarClaude, parsearJson } from "../_shared/claude-client.ts";
import {
  instrucaoDaMarcaEModelo,
  prioridadeDoArquivo,
  respostaDaMarcaEModelo,
  trechosDeMarcaEModelo,
} from "../_shared/termo-de-referencia.ts";
import { pdfsDoArquivo, textoDoPdf } from "./leitura.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_ARQUIVOS_BAIXADOS = 3;

function responder(corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Leitura com IA paga: poucas por janela.
    await requireAuth(req, { functionName: "marca-modelo-do-termo", maxRequests: 10, windowMinutes: 10 });
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

  const cnpj = String(corpo.cnpj ?? "").replace(/\D/g, "");
  const ano = String(corpo.ano ?? "");
  const seq = String(Number(corpo.sequencial ?? 0));
  const itens = (Array.isArray(corpo.itens) ? corpo.itens : [])
    .map((i: Record<string, unknown>) => ({ numero: Number(i?.numero), descricao: String(i?.descricao ?? "") }))
    .filter((i) => Number.isFinite(i.numero) && i.numero > 0)
    .slice(0, 500);
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || seq === "0" || seq === "NaN") {
    return responder({ success: false, error: "Coordenadas da compra no PNCP inválidas." });
  }
  if (itens.length === 0) return responder({ success: false, error: "Nenhum item para procurar marca e modelo." });

  // 1. Os arquivos publicados, termo de referência primeiro.
  let arquivos: Array<{ titulo: string; url: string }> = [];
  try {
    const r = await fetch(`https://pncp.gov.br/pncp-api/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`PNCP ${r.status}`);
    const lista = await r.json();
    arquivos = (Array.isArray(lista) ? lista : lista?.data ?? [])
      .filter((a: Record<string, unknown>) => a?.url && a?.statusAtivo !== false)
      .map((a: Record<string, unknown>) => ({ titulo: String(a.titulo ?? a.url), url: String(a.url) }))
      .sort((a: { titulo: string }, b: { titulo: string }) => prioridadeDoArquivo(a.titulo) - prioridadeDoArquivo(b.titulo));
  } catch (e) {
    console.warn("marca-modelo-do-termo: lista de arquivos", String(e));
    return responder({ success: false, error: "Não foi possível listar os arquivos da compra no PNCP agora. Tente de novo em instantes." });
  }
  if (arquivos.length === 0) return responder({ success: false, error: "A compra não tem arquivo publicado no PNCP." });

  // 2. O primeiro PDF de termo de referência (ou edital) que der para ler.
  let lido: { nome: string; texto: string; paginas: number } | null = null;
  for (const arquivo of arquivos.slice(0, MAX_ARQUIVOS_BAIXADOS)) {
    try {
      const r = await fetch(arquivo.url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) continue;
      const pdfs = await pdfsDoArquivo(buf, arquivo.titulo);
      const pdf = pdfs.find((p) => prioridadeDoArquivo(p.nome) < 9) ?? null;
      if (!pdf) continue;
      const { texto, paginas } = await textoDoPdf(pdf.bytes);
      if (texto.trim().length < 200) continue; // PDF escaneado, sem texto
      lido = { nome: pdf.nome, texto, paginas };
      break;
    } catch (e) {
      console.warn(`marca-modelo-do-termo: ${arquivo.titulo}`, String(e));
    }
  }
  if (!lido) {
    return responder({
      success: false,
      error: "Não foi possível ler o termo de referência: nenhum arquivo publicado trouxe um PDF com texto (pode ser digitalizado como imagem).",
    });
  }

  // 3. Só os recortes que falam de marca, modelo ou fabricante. Sem recorte, sem IA.
  const trechos = trechosDeMarcaEModelo(lido.texto);
  const base = { success: true, arquivo: lido.nome, paginas: lido.paginas, trechos: trechos.length };
  if (trechos.length === 0) return responder({ ...base, itens: [] });

  try {
    const resposta = await chamarClaude(
      instrucaoDaMarcaEModelo(itens),
      { texto: trechos.map((t, i) => `[${i + 1}] ${t}`).join("\n\n") },
      { maxTokens: 4000, timeoutMs: 90000 },
    );
    const achados = respostaDaMarcaEModelo(parsearJson(resposta), new Set(itens.map((i) => i.numero)), trechos);
    console.log(`marca-modelo-do-termo ${cnpj}/${ano}/${seq}: ${lido.nome}, ${lido.paginas} pág., ${trechos.length} trechos, ${achados.length} com marca/modelo`);
    return responder({ ...base, itens: achados });
  } catch (e) {
    console.error("marca-modelo-do-termo: IA", String(e));
    return responder({ success: false, error: "O termo de referência foi lido, mas a análise dos trechos falhou. Tente de novo em instantes." });
  }
});
