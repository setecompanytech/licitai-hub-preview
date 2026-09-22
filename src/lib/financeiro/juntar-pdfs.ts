/**
 * Vários anexos, um PDF só — na ordem dada.
 *
 * pdf-lib copia as páginas de cada PDF para um documento novo; imagem (JPG,
 * PNG) vira uma página do tamanho dela. O que não for PDF nem imagem fica de
 * fora, e a lista `ignorados` diz o quê — nunca em silêncio.
 */
import { PDFDocument } from 'pdf-lib';

export type ParteParaJuntar = { nome: string; bytes: ArrayBuffer | Uint8Array; tipo?: string | null };

export async function juntarEmUmPdf(partes: ParteParaJuntar[]): Promise<{ pdf: Uint8Array; paginas: number; ignorados: string[] }> {
  const saida = await PDFDocument.create();
  const ignorados: string[] = [];
  for (const parte of partes) {
    const nome = parte.nome.toLowerCase();
    const tipo = (parte.tipo ?? '').toLowerCase();
    const bytes = parte.bytes instanceof Uint8Array ? parte.bytes : new Uint8Array(parte.bytes);
    try {
      if (tipo.includes('pdf') || nome.endsWith('.pdf') || (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await saida.copyPages(origem, origem.getPageIndices());
        for (const p of paginas) saida.addPage(p);
        continue;
      }
      if (tipo.includes('png') || nome.endsWith('.png') || tipo.includes('jpeg') || tipo.includes('jpg') || nome.endsWith('.jpg') || nome.endsWith('.jpeg')) {
        const imagem = (tipo.includes('png') || nome.endsWith('.png')) ? await saida.embedPng(bytes) : await saida.embedJpg(bytes);
        const pagina = saida.addPage([imagem.width, imagem.height]);
        pagina.drawImage(imagem, { x: 0, y: 0, width: imagem.width, height: imagem.height });
        continue;
      }
      ignorados.push(parte.nome);
    } catch {
      ignorados.push(parte.nome);
    }
  }
  return { pdf: await saida.save(), paginas: saida.getPageCount(), ignorados };
}
