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

  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageWidth, 6, 'F');

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30, 'S');

  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.text);
  doc.text('LICITAIA', pageWidth / 2, 72, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('GUIA TECNICO E OPERACIONAL', pageWidth / 2, 84, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.muted);
  doc.text('Padrao documental alinhado a ABNT NBR 14724 e Lei 14.133/2021', pageWidth / 2, 98, { align: 'center' });

  const intro =
    'Este documento apresenta os modulos da plataforma LicitaIA com contextualizacao operacional, fundamento tecnico e fluxo recomendado de uso. O material foi estruturado para treinamento, padronizacao interna e consulta rapida.';

  const introLines = doc.splitTextToSize(intro, pageWidth - 90);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(introLines, 45, 124);

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(`Total de capitulos: ${chapterCount}`, 45, 172);
  doc.text(`Data de geracao: ${new Date().toLocaleDateString('pt-BR')}`, 45, 180);

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text('Uso interno. Distribuicao externa nao autorizada.', pageWidth / 2, pageHeight - 26, {
    align: 'center',
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text('LicitaIA - Plataforma inteligente para licitacoes publicas.', pageWidth / 2, pageHeight - 17, {
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
  doc.text(`CAPITULO ${String(chapterNumber).padStart(2, '0')}`, ABNT_LAYOUT.marginLeft, 15);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.text(chapterTitle, ABNT_LAYOUT.marginLeft, ABNT_LAYOUT.marginTop - 2);

  const backToToc = 'Voltar ao sumario';
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
  drawChapterHeader(doc, chapterNumber, `${chapterTitle} (continuacao)`);
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
    const lines = doc.splitTextToSize(item, getContentWidth(doc) - 2);

    for (const line of lines) {
      y = ensureSpace(doc, y, ABNT_LAYOUT.lineHeight, chapterNumber, chapterTitle);
      setBodyStyle(doc);
      doc.text(line, ABNT_LAYOUT.marginLeft + 2, y);
      y += ABNT_LAYOUT.lineHeight;
    }

    y += 1;
  }

  return y + 2;
}

export function drawModuleFigure(
  doc: jsPDF,
  y: number,
  section: EbookSection,
  chapterNumber: number,
  chapterTitle: string,
) {
  y = ensureSpace(doc, y, 74, chapterNumber, chapterTitle);

  const x = ABNT_LAYOUT.marginLeft;
  const width = getContentWidth(doc);
  const height = 50;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'S');

  doc.setFillColor(247, 250, 252);
  doc.roundedRect(x + 1, y + 1, width - 2, 8, 1, 1, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text(`FIGURA FUNCIONAL - ${section.title.toUpperCase()}`, x + 3, y + 6.5);

  doc.setFillColor(236, 242, 248);
  doc.rect(x + 2, y + 10, 24, height - 13, 'F');

  doc.setFillColor(220, 232, 244);
  doc.rect(x + 4, y + 13, 20, 4, 'F');
  doc.rect(x + 4, y + 19, 20, 4, 'F');
  doc.rect(x + 4, y + 25, 20, 4, 'F');
  doc.rect(x + 4, y + 31, 20, 4, 'F');

  const chartX = x + 30;
  const chartY = y + 13;
  const barBase = [12, 19, 26, 16, 23];

  for (let i = 0; i < barBase.length; i++) {
    const barHeight = barBase[i] + ((chapterNumber * 3 + i) % 5);
    doc.setFillColor(...COLORS.accent);
    doc.rect(chartX + i * 10, chartY + (24 - barHeight), 7, barHeight, 'F');
  }

  doc.setFillColor(232, 240, 247);
  doc.roundedRect(x + 30, y + 39, 24, 8, 1, 1, 'F');
  doc.roundedRect(x + 56, y + 39, 24, 8, 1, 1, 'F');
  doc.roundedRect(x + 82, y + 39, 24, 8, 1, 1, 'F');

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Figura ${chapterNumber} - Representacao funcional do modulo em tela.`, x, y + height + 7);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Rota de acesso no sistema: ${section.routeHint}`, x, y + height + 13);

  return y + height + 18;
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
  doc.rect(0, 0, pageWidth, 6, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  doc.text('ENCERRAMENTO', pageWidth / 2, 70, { align: 'center' });

  const finalText =
    'A LicitaIA integra inteligencia operacional, conformidade documental e automacao de processos para aumentar previsibilidade, produtividade e governanca na participacao em licitacoes publicas.';

  const lines = doc.splitTextToSize(finalText, pageWidth - 90);
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.text(lines, 45, 95);

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text('Documento gerado automaticamente pela plataforma LicitaIA.', pageWidth / 2, pageHeight - 32, {
    align: 'center',
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text('Suporte: suporte@licitaia.com.br', pageWidth / 2, pageHeight - 24, { align: 'center' });
}
