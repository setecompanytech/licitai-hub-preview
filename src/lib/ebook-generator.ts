import jsPDF from 'jspdf';
import { ebookSections } from '@/lib/ebook/content';
import {
  ABNT_LAYOUT,
  drawChapterHeader,
  drawClosingPage,
  drawCoverPage,
  drawLogicalPageNumber,
  drawModuleFigure,
  getContentWidth,
  getPageHeight,
  getPageWidth,
  setSubheadingStyle,
  writeList,
  writeParagraph,
} from '@/lib/ebook/pdf-utils';

interface TocEntry {
  chapter: number;
  title: string;
  physicalPage: number;
}

function renderChapter(doc: jsPDF, chapterNumber: number, title: string, contextualizacao: string, fundamento: string, fluxos: string[], funcionalidades: string[], routeHint: string) {
  doc.addPage();
  drawChapterHeader(doc, chapterNumber, title);

  let y = ABNT_LAYOUT.marginTop + 6;

  setSubheadingStyle(doc);
  doc.text('Contextualizacao operacional', ABNT_LAYOUT.marginLeft, y);
  y += 7;
  y = writeParagraph(doc, contextualizacao, y, chapterNumber, title);

  setSubheadingStyle(doc);
  doc.text('Fundamento tecnico e juridico', ABNT_LAYOUT.marginLeft, y);
  y += 7;
  y = writeParagraph(doc, fundamento, y, chapterNumber, title);

  y = drawModuleFigure(
    doc,
    y,
    {
      title,
      contextualizacao,
      fundamento,
      fluxos,
      funcionalidades,
      routeHint,
    },
    chapterNumber,
    title,
  );

  y = writeList(doc, 'Fluxo recomendado de uso', fluxos, y, chapterNumber, title);
  y = writeList(doc, 'Funcionalidades essenciais', funcionalidades, y, chapterNumber, title);

  setSubheadingStyle(doc);
  doc.text('Observacao de governanca', ABNT_LAYOUT.marginLeft, y);
  y += 7;

  writeParagraph(
    doc,
    'Este capitulo integra padronizacao de processo, rastreabilidade das decisoes e melhoria continua do desempenho da operacao de licitacoes.',
    y,
    chapterNumber,
    title,
  );
}

function renderTableOfContents(doc: jsPDF, toc: TocEntry[]) {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const contentWidth = getContentWidth(doc);

  doc.setPage(2);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(0, 92, 169);
  doc.rect(0, 0, pageWidth, 6, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('SUMARIO', ABNT_LAYOUT.marginLeft, 32);

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(85, 85, 85);
  doc.text('Clique em qualquer item para navegar ao capitulo correspondente.', ABNT_LAYOUT.marginLeft, 40);

  let y = 52;

  toc.forEach((entry) => {
    const chapterText = `${String(entry.chapter).padStart(2, '0')}  ${entry.title}`;
    const logicalPage = entry.physicalPage - 2;

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(chapterText, ABNT_LAYOUT.marginLeft, y);

    const titleWidth = doc.getTextWidth(chapterText);
    const pageText = String(logicalPage);

    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(
      ABNT_LAYOUT.marginLeft + titleWidth + 3,
      y - 1,
      pageWidth - ABNT_LAYOUT.marginRight - 10,
      y - 1,
    );
    doc.setLineDashPattern([], 0);

    doc.setFont('times', 'bold');
    doc.text(pageText, pageWidth - ABNT_LAYOUT.marginRight, y, { align: 'right' });

    doc.link(ABNT_LAYOUT.marginLeft, y - 5, contentWidth, 7, { pageNumber: entry.physicalPage });

    y += 10;
  });

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text('Padrao tipografico unico: Times New Roman, conforme ABNT NBR 14724.', ABNT_LAYOUT.marginLeft, pageHeight - 24);
}

function applyLogicalPagination(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  let logicalPage = 1;

  for (let page = 3; page <= totalPages; page++) {
    doc.setPage(page);
    drawLogicalPageNumber(doc, logicalPage);
    logicalPage += 1;
  }
}

export function generateEbook(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawCoverPage(doc, ebookSections.length);

  // Placeholder do sumario; sera preenchido ao final com paginas corretas.
  doc.addPage();

  const tocEntries: TocEntry[] = [];

  ebookSections.forEach((section, index) => {
    const chapterNumber = index + 1;
    const chapterStartPhysicalPage = doc.getNumberOfPages() + 1;

    tocEntries.push({
      chapter: chapterNumber,
      title: section.title,
      physicalPage: chapterStartPhysicalPage,
    });

    renderChapter(
      doc,
      chapterNumber,
      section.title,
      section.contextualizacao,
      section.fundamento,
      section.fluxos,
      section.funcionalidades,
      section.routeHint,
    );
  });

  drawClosingPage(doc);
  renderTableOfContents(doc, tocEntries);
  applyLogicalPagination(doc);

  doc.save('LicitaIA-Guia-ABNT.pdf');
}
