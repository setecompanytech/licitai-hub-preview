import jsPDF from 'jspdf';
import { ebookSections } from '@/lib/ebook/content';
import { loadChapterImages } from '@/lib/ebook/image-loader';
import {
  ABNT_LAYOUT,
  drawChapterHeader,
  drawClosingPage,
  drawCoverPage,
  drawLogicalPageNumber,
  ensureSpace,
  getContentWidth,
  getPageHeight,
  getPageWidth,
  setBodyStyle,
  setSubheadingStyle,
  writeBulletList,
  writeList,
  writeParagraph,
  writeTipBox,
} from '@/lib/ebook/pdf-utils';

interface TocEntry {
  chapter: number;
  title: string;
  physicalPage: number;
}

function addChapterImage(
  doc: jsPDF,
  dataUrl: string,
  y: number,
  chapterNumber: number,
  chapterTitle: string,
): number {
  const contentWidth = getContentWidth(doc);
  const imgWidth = contentWidth;
  const imgHeight = imgWidth * (750 / 1200);

  y = ensureSpace(doc, y, imgHeight + 18, chapterNumber, chapterTitle);

  const x = ABNT_LAYOUT.marginLeft;

  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(0.3);
  doc.roundedRect(x - 1, y - 1, imgWidth + 2, imgHeight + 2, 1, 1, 'S');

  doc.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);

  y += imgHeight + 4;

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(
    `Figura ${chapterNumber} — Tela do módulo "${chapterTitle}" na plataforma PRAEFECTUS.`,
    x,
    y,
  );
  y += 10;

  return y;
}

function renderChapter(
  doc: jsPDF,
  chapterNumber: number,
  title: string,
  descricao: string,
  contextualizacao: string,
  comoUsar: string[],
  funcionalidades: string[],
  dicaPratica: string,
  routeHint: string,
  chapterImage?: string,
) {
  doc.addPage();
  drawChapterHeader(doc, chapterNumber, title);

  let y = ABNT_LAYOUT.marginTop + 6;

  // 1. O que é este módulo
  setSubheadingStyle(doc);
  doc.text('O que é este módulo', ABNT_LAYOUT.marginLeft, y);
  y += 7;
  y = writeParagraph(doc, descricao, y, chapterNumber, title);

  // 2. Image
  if (chapterImage) {
    y += 2;
    y = addChapterImage(doc, chapterImage, y, chapterNumber, title);
  }

  // 3. Por que é importante
  setSubheadingStyle(doc);
  y = ensureSpace(doc, y, 14, chapterNumber, title);
  setSubheadingStyle(doc);
  doc.text('Por que é importante', ABNT_LAYOUT.marginLeft, y);
  y += 7;
  y = writeParagraph(doc, contextualizacao, y, chapterNumber, title);

  // 4. Como usar — passo a passo
  y = writeList(doc, 'Como usar — passo a passo', comoUsar, y, chapterNumber, title);

  // 5. Funcionalidades principais
  y = writeBulletList(doc, 'Funcionalidades principais', funcionalidades, y, chapterNumber, title);

  // 6. Dica prática
  y = writeTipBox(doc, dicaPratica, y, chapterNumber, title);

  // 7. Rota de acesso
  y = ensureSpace(doc, y, 14, chapterNumber, title);
  setBodyStyle(doc);
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(`Rota de acesso no sistema: ${routeHint}`, ABNT_LAYOUT.marginLeft, y);
}

function renderTableOfContents(doc: jsPDF, toc: TocEntry[]) {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);
  const contentWidth = getContentWidth(doc);

  doc.setPage(2);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(0, 92, 169);
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('SUMÁRIO', ABNT_LAYOUT.marginLeft, 32);

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(85, 85, 85);
  doc.text(
    'Clique em qualquer item para navegar ao capítulo correspondente.',
    ABNT_LAYOUT.marginLeft,
    40,
  );

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

    doc.link(ABNT_LAYOUT.marginLeft, y - 5, contentWidth, 7, {
      pageNumber: entry.physicalPage,
    });

    y += 10;
  });

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(
    'Padrão tipográfico único: Times New Roman, conforme ABNT NBR 14724.',
    ABNT_LAYOUT.marginLeft,
    pageHeight - 24,
  );
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

export async function generateEbook(): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const chapterImages = await loadChapterImages();

  drawCoverPage(doc, ebookSections.length);

  // Placeholder for TOC
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
      section.descricao,
      section.contextualizacao,
      section.comoUsar,
      section.funcionalidades,
      section.dicaPratica,
      section.routeHint,
      chapterImages[chapterNumber],
    );
  });

  drawClosingPage(doc);
  renderTableOfContents(doc, tocEntries);
  applyLogicalPagination(doc);

  doc.save('PRAEFECTUS-Guia-Completo.pdf');
}
