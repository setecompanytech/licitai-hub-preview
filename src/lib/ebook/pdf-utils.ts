import jsPDF from 'jspdf';
import { EbookSection } from './content';

export const ABNT_LAYOUT = {
  marginLeft: 30,
  marginRight: 20,
  marginTop: 30,
  marginBottom: 20,
  lineHeight: 7,
  bodyFontSize: 12,
};

const COLORS = {
  text: [20, 20, 20] as const,
  muted: [85, 85, 85] as const,
  line: [170, 170, 170] as const,
  accent: [0, 92, 169] as const,
  soft: [240, 245, 250] as const,
  tipBg: [245, 250, 255] as const,
  tipBorder: [0, 92, 169] as const,
};

export function getPageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

export function getPageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

export function getContentWidth(doc: jsPDF) {
  return getPageWidth(doc) - ABNT_LAYOUT.marginLeft - ABNT_LAYOUT.marginRight;
}

export function setBodyStyle(doc: jsPDF) {
  doc.setFont('times', 'normal');
  doc.setFontSize(ABNT_LAYOUT.bodyFontSize);
  doc.setTextColor(...COLORS.text);
}

export function setSectionTitleStyle(doc: jsPDF) {
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
}

export function setSubheadingStyle(doc: jsPDF) {
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
}

export function drawCoverPage(doc: jsPDF, chapterCount: number) {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Top accent bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Border frame
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30, 'S');

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.accent);
  doc.text('PRAEFECTUS', pageWidth / 2, 65, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.text);
  doc.text('GUIA COMPLETO DA PLATAFORMA', pageWidth / 2, 80, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.muted);
  doc.text('Manual Didático e Operacional', pageWidth / 2, 92, { align: 'center' });

  // Divider
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(60, 100, pageWidth - 60, 100);

  // Intro
  const intro =
    'Este documento apresenta, de forma didática e ilustrada, todos os módulos da plataforma PRAEFECTUS. ' +
    'Cada capítulo explica o que a função faz, por que ela é importante, como utilizá-la passo a passo ' +
    'e inclui dicas práticas para maximizar os resultados da sua equipe em licitações públicas.';

  const introLines = doc.splitTextToSize(intro, pageWidth - 90);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(introLines, 45, 118);

  // Metadata
  const metaY = 170;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Total de capítulos: ${chapterCount}`, 45, metaY);
  doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 45, metaY + 8);
  doc.text('Padrão documental: ABNT NBR 14724 | Lei 14.133/2021', 45, metaY + 16);

  // Footer
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text('Uso interno. Distribuição externa não autorizada.', pageWidth / 2, pageHeight - 26, {
    align: 'center',
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text('PRAEFECTUS — Plataforma inteligente para licitações públicas.', pageWidth / 2, pageHeight - 17, {
    align: 'center',
  });
}

export function drawChapterHeader(doc: jsPDF, chapterNumber: number, chapterTitle: string) {
  const pageWidth = getPageWidth(doc);

  doc.setFillColor(...COLORS.soft);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(ABNT_LAYOUT.marginLeft, 24, pageWidth - ABNT_LAYOUT.marginRight, 24);

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.muted);
  doc.text(`CAPÍTULO ${String(chapterNumber).padStart(2, '0')}`, ABNT_LAYOUT.marginLeft, 15);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.text(chapterTitle, ABNT_LAYOUT.marginLeft, ABNT_LAYOUT.marginTop - 2);

  const backToToc = 'Voltar ao sumário';
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.accent);
  const textWidth = doc.getTextWidth(backToToc);
  const textX = pageWidth - ABNT_LAYOUT.marginRight - textWidth;
  doc.text(backToToc, textX, 15);
  doc.link(textX, 10, textWidth, 6, { pageNumber: 2 });

  doc.setTextColor(...COLORS.text);
}

export function ensureSpace(
  doc: jsPDF,
  y: number,
  neededHeight: number,
  chapterNumber: number,
  chapterTitle: string,
) {
  const maxY = getPageHeight(doc) - ABNT_LAYOUT.marginBottom;
  if (y + neededHeight <= maxY) return y;

  doc.addPage();
  drawChapterHeader(doc, chapterNumber, `${chapterTitle} (continuação)`);
  return ABNT_LAYOUT.marginTop + 6;
}

export function writeParagraph(
  doc: jsPDF,
  text: string,
  y: number,
  chapterNumber: number,
  chapterTitle: string,
) {
  setBodyStyle(doc);
  const lines = doc.splitTextToSize(text, getContentWidth(doc));

  for (const line of lines) {
    y = ensureSpace(doc, y, ABNT_LAYOUT.lineHeight, chapterNumber, chapterTitle);
    setBodyStyle(doc);
    doc.text(line, ABNT_LAYOUT.marginLeft, y);
    y += ABNT_LAYOUT.lineHeight;
  }

  return y + 2;
}

export function writeList(
  doc: jsPDF,
  title: string,
  items: string[],
  y: number,
  chapterNumber: number,
  chapterTitle: string,
) {
  y = ensureSpace(doc, y, 12, chapterNumber, chapterTitle);
  setSubheadingStyle(doc);
  doc.text(title, ABNT_LAYOUT.marginLeft, y);
  y += 7;

  for (let i = 0; i < items.length; i++) {
    const item = `${i + 1}. ${items[i]}`;
    const lines = doc.splitTextToSize(item, getContentWidth(doc) - 4);

    for (const line of lines) {
      y = ensureSpace(doc, y, ABNT_LAYOUT.lineHeight, chapterNumber, chapterTitle);
      setBodyStyle(doc);
      doc.text(line, ABNT_LAYOUT.marginLeft + 4, y);
      y += ABNT_LAYOUT.lineHeight;
    }

    y += 1;
  }

  return y + 2;
}

export function writeBulletList(
  doc: jsPDF,
  title: string,
  items: string[],
  y: number,
  chapterNumber: number,
  chapterTitle: string,
) {
  y = ensureSpace(doc, y, 12, chapterNumber, chapterTitle);
  setSubheadingStyle(doc);
  doc.text(title, ABNT_LAYOUT.marginLeft, y);
  y += 7;

  for (const item of items) {
    const bullet = `\u2022  ${item}`;
    const lines = doc.splitTextToSize(bullet, getContentWidth(doc) - 4);

    for (const line of lines) {
      y = ensureSpace(doc, y, ABNT_LAYOUT.lineHeight, chapterNumber, chapterTitle);
      setBodyStyle(doc);
      doc.text(line, ABNT_LAYOUT.marginLeft + 4, y);
      y += ABNT_LAYOUT.lineHeight;
    }

    y += 1;
  }

  return y + 2;
}

export function writeTipBox(
  doc: jsPDF,
  tip: string,
  y: number,
  chapterNumber: number,
  chapterTitle: string,
) {
  const contentWidth = getContentWidth(doc);
  const tipText = `Dica prática: ${tip}`;
  const lines = doc.splitTextToSize(tipText, contentWidth - 14);
  const boxHeight = lines.length * ABNT_LAYOUT.lineHeight + 8;

  y = ensureSpace(doc, y, boxHeight + 4, chapterNumber, chapterTitle);

  const x = ABNT_LAYOUT.marginLeft;

  // Background
  doc.setFillColor(...COLORS.tipBg);
  doc.roundedRect(x, y - 4, contentWidth, boxHeight, 2, 2, 'F');

  // Left accent border
  doc.setFillColor(...COLORS.tipBorder);
  doc.rect(x, y - 4, 3, boxHeight, 'F');

  // Text
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.accent);
  doc.text(lines, x + 8, y + 2);

  doc.setTextColor(...COLORS.text);

  return y + boxHeight + 4;
}

export function drawLogicalPageNumber(doc: jsPDF, logicalPage: number) {
  const pageWidth = getPageWidth(doc);
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.text(String(logicalPage), pageWidth - ABNT_LAYOUT.marginRight, 16, { align: 'right' });
}

export function drawClosingPage(doc: jsPDF) {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);

  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 8, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  doc.text('ENCERRAMENTO', pageWidth / 2, 70, { align: 'center' });

  const finalText =
    'A PRAEFECTUS integra inteligência operacional, conformidade documental e automação de processos ' +
    'para aumentar previsibilidade, produtividade e governança na participação em licitações públicas. ' +
    'Este guia foi elaborado para capacitar equipes, padronizar operações e servir como referência rápida no dia a dia.';

  const lines = doc.splitTextToSize(finalText, pageWidth - 90);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.text(lines, 45, 95);

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text('Documento gerado automaticamente pela plataforma PRAEFECTUS.', pageWidth / 2, pageHeight - 32, {
    align: 'center',
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text('Suporte: suporte@praefectus.com.br', pageWidth / 2, pageHeight - 24, { align: 'center' });
}
