// Abrir os arquivos da contratação e tirar o texto do PDF — separado do
// `index.ts` para ser testado com o Deno local, sem subir servidor.
//
// O Compras.gov publica no PNCP o edital em PDF solto, em ZIP ou em RAR (o
// 7/2026 é um RAR com seis PDFs). O RAR abre com `node-unrar-js` (WebAssembly,
// sem binário do sistema); o .wasm vem do jsdelivr, porque o empacotador das
// edge functions não leva arquivo que não seja código.
import JSZip from "npm:jszip@3.10.1";
import { createExtractorFromData } from "npm:node-unrar-js@2.0.2";
import { getDocumentProxy } from "npm:unpdf@1.3.2";
import { prioridadeDoArquivo, tipoDoArquivo } from "../_shared/termo-de-referencia.ts";

const WASM_DO_UNRAR = "https://cdn.jsdelivr.net/npm/node-unrar-js@2.0.2/dist/js/unrar.wasm";
let wasmDoUnrar: ArrayBuffer | null = null;

export interface PdfAchado {
  nome: string;
  bytes: Uint8Array;
}

/** Os PDFs de um arquivo publicado, na ordem de leitura (termo de referência primeiro). */
export async function pdfsDoArquivo(bytes: Uint8Array, nome: string): Promise<PdfAchado[]> {
  const tipo = tipoDoArquivo(bytes);
  const achados: PdfAchado[] = [];
  if (tipo === "pdf") {
    achados.push({ nome, bytes });
  } else if (tipo === "zip") {
    const zip = await JSZip.loadAsync(bytes);
    for (const entrada of Object.values(zip.files)) {
      if (entrada.dir || !/\.pdf$/i.test(entrada.name)) continue;
      achados.push({ nome: entrada.name, bytes: await entrada.async("uint8array") });
    }
  } else if (tipo === "rar") {
    if (!wasmDoUnrar) {
      const r = await fetch(WASM_DO_UNRAR, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`não foi possível carregar o leitor de RAR (HTTP ${r.status})`);
      wasmDoUnrar = await r.arrayBuffer();
    }
    const copia = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const extrator = await createExtractorFromData({ data: copia, wasmBinary: wasmDoUnrar });
    const { files } = extrator.extract({ files: (h) => !h.flags.directory && /\.pdf$/i.test(h.name) });
    for (const f of files) {
      if (f.extraction) achados.push({ nome: f.fileHeader.name, bytes: f.extraction });
    }
  }
  return achados.sort((a, b) => prioridadeDoArquivo(a.nome) - prioridadeDoArquivo(b.nome));
}

/** Texto de todas as páginas, até `maxPaginas`. */
export async function textoDoPdf(bytes: Uint8Array, maxPaginas = 250): Promise<{ texto: string; paginas: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const ate = Math.min(pdf.numPages, maxPaginas);
  let texto = "";
  for (let p = 1; p <= ate; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // deno-lint-ignore no-explicit-any
    texto += (tc.items as any[]).map((x) => x.str ?? "").join(" ") + "\n";
  }
  return { texto, paginas: pdf.numPages };
}
