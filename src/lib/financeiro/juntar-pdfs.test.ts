import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { juntarEmUmPdf } from './juntar-pdfs';

async function pdfDeUmaPagina(texto: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([200, 100]);
  pagina.drawText(texto, { x: 10, y: 50, size: 12 });
  return doc.save();
}

describe('juntar anexos num PDF só', () => {
  it('copia as páginas na ordem dada e ignora o que não é PDF nem imagem, dizendo o nome', async () => {
    const a = await pdfDeUmaPagina('NF 725');
    const b = await pdfDeUmaPagina('NF 726');
    const r = await juntarEmUmPdf([
      { nome: 'NFe 725.pdf', bytes: a, tipo: 'application/pdf' },
      { nome: 'planilha.xlsx', bytes: new Uint8Array([1, 2, 3]), tipo: 'application/vnd.ms-excel' },
      { nome: 'NFe 726.pdf', bytes: b },
    ]);
    expect(r.paginas).toBe(2);
    expect(r.ignorados).toEqual(['planilha.xlsx']);
    const lido = await PDFDocument.load(r.pdf);
    expect(lido.getPageCount()).toBe(2);
  });
});
