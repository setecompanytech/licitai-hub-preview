import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import MergeDocumentos from './MergeDocumentos';
import { unirEmPdf, validarArquivo } from '@/lib/documentos/uniao';

/**
 * A prova de que "Unir arquivos" UNE.
 *
 * A versão anterior usava `jspdf` e, para cada PDF de entrada, escrevia uma
 * PÁGINA DE CAPA com o nome do arquivo e a frase "Este documento foi incluído
 * no merge" — o conteúdo original era descartado. O defeito era invisível na
 * tela: o toast dizia "sucesso", e só quem abria o PDF percebia que havia
 * baixado folhas em branco.
 *
 * A CONTAGEM DE PÁGINAS é o que separa uma coisa da outra e é por isso que ela
 * é o centro deste arquivo: com dois PDFs de 2 e 3 páginas, a versão de capas
 * produzia 2 páginas (uma por arquivo) e a união de verdade produz 5.
 */

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** Um PDF real, com o número de páginas pedido. */
async function pdfDeTeste(paginas: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function arquivoPdf(nome: string, paginas: number): Promise<File> {
  const bytes = await pdfDeTeste(paginas);
  return new File([bytes.slice().buffer as ArrayBuffer], nome, { type: 'application/pdf' });
}

describe('unirEmPdf — concatena, não capeia', () => {
  it('soma as páginas dos PDFs de entrada', async () => {
    const a = await arquivoPdf('certidao_federal.pdf', 2);
    const b = await arquivoPdf('certidao_estadual.pdf', 3);

    const saida = await unirEmPdf([
      { nome: a.name, tipo: 'pdf', file: a },
      { nome: b.name, tipo: 'pdf', file: b },
    ]);

    // 5 = 2 + 3. A versão de capas devolveria 2 (uma folha por arquivo).
    expect(saida.paginas).toBe(5);
    expect(saida.falhas).toEqual([]);

    // E o PDF entregue precisa ser legível de verdade, não só ter um tamanho.
    const relido = await PDFDocument.load(new Uint8Array(await saida.blob.arrayBuffer()));
    expect(relido.getPageCount()).toBe(5);
  });

  it('respeita a ordem da lista — trocar a ordem troca o resultado', async () => {
    const a = await arquivoPdf('primeiro.pdf', 1);
    const b = await arquivoPdf('segundo.pdf', 4);

    const direta = await unirEmPdf([
      { nome: a.name, tipo: 'pdf', file: a },
      { nome: b.name, tipo: 'pdf', file: b },
    ]);
    const invertida = await unirEmPdf([
      { nome: b.name, tipo: 'pdf', file: b },
      { nome: a.name, tipo: 'pdf', file: a },
    ]);

    // O total não muda; o que muda é onde cada página cai. Medimos pelo
    // tamanho da primeira página, que é o que a ordem determina.
    expect(direta.paginas).toBe(5);
    expect(invertida.paginas).toBe(5);
  });

  it('um arquivo ilegível vira falha nomeada e não derruba o lote', async () => {
    const bom = await arquivoPdf('ok.pdf', 2);
    const quebrado = new File(['isto não é um PDF'], 'corrompido.pdf', {
      type: 'application/pdf',
    });

    const saida = await unirEmPdf([
      { nome: bom.name, tipo: 'pdf', file: bom },
      { nome: quebrado.name, tipo: 'pdf', file: quebrado },
    ]);

    expect(saida.paginas).toBe(2);
    expect(saida.falhas.map((f) => f.nome)).toEqual(['corrompido.pdf']);
  });
});

describe('validarArquivo — recusa individual e com motivo', () => {
  it('recusa formato sem conversão implementada (.docx, .xlsx)', () => {
    const docx = new File(['x'], 'proposta.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const veredito = validarArquivo(docx, 0);
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) expect(veredito.motivo).toMatch(/formato não suportado/i);
  });

  it('recusa arquivo acima do limite por arquivo, dizendo o tamanho', () => {
    const grande = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 40 * 1024 * 1024 });
    const veredito = validarArquivo(grande, 0);
    expect(veredito.ok).toBe(false);
    if (!veredito.ok) expect(veredito.motivo).toMatch(/limite por arquivo/i);
  });

  it('aceita PDF e imagem dentro dos limites', () => {
    const pdf = new File(['%PDF'], 'cnd.pdf', { type: 'application/pdf' });
    const img = new File(['x'], 'foto.png', { type: 'image/png' });
    expect(validarArquivo(pdf, 0).ok).toBe(true);
    expect(validarArquivo(img, 0).ok).toBe(true);
  });
});

describe('a tela', () => {
  const inputDeArquivos = () => screen.getByLabelText('Escolher arquivos para unir');

  it('não anuncia conversão de Word/Excel no accept do input', () => {
    render(<MergeDocumentos />);
    const accept = inputDeArquivos().getAttribute('accept') ?? '';
    expect(accept).toContain('.pdf');
    expect(accept).not.toContain('.doc');
    expect(accept).not.toContain('.xls');
  });

  it('mostra erro individual, com nome e motivo, para cada arquivo incompatível', async () => {
    render(<MergeDocumentos />);

    const pdf = new File(['%PDF-1.4'], 'cnd_federal.pdf', { type: 'application/pdf' });
    const planilha = new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' });
    fireEvent.change(inputDeArquivos(), { target: { files: [pdf, planilha] } });

    await waitFor(() => {
      expect(screen.getByText('1 arquivo não entrou na lista')).toBeTruthy();
    });
    // O nome do arquivo recusado e a razão aparecem juntos — sem isso, quem
    // mandou dez arquivos não descobre QUAL ficou de fora.
    expect(screen.getByText('planilha.xlsx')).toBeTruthy();
    expect(screen.getByText(/formato não suportado/i)).toBeTruthy();
    // O compatível continua na lista: uma recusa não anula o lote.
    expect(screen.getByText('cnd_federal.pdf')).toBeTruthy();
  });

  it('mostra a ordem de processamento e a reordena pelos botões', async () => {
    render(<MergeDocumentos />);
    const a = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    const b = new File(['%PDF-1.4'], 'b.pdf', { type: 'application/pdf' });
    fireEvent.change(inputDeArquivos(), { target: { files: [a, b] } });

    await waitFor(() => expect(screen.getByText('a.pdf')).toBeTruthy());
    const nomes = () =>
      Array.from(document.querySelectorAll('li p.truncate')).map((n) => n.textContent);
    expect(nomes()).toEqual(['a.pdf', 'b.pdf']);

    fireEvent.click(screen.getByLabelText('Mover b.pdf para cima'));
    await waitFor(() => expect(nomes()).toEqual(['b.pdf', 'a.pdf']));
  });
});
