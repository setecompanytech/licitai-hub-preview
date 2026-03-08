/**
 * Legal Document Export — ABNT NBR 14724 compliant
 * 
 * Padrão tipográfico e textual conforme:
 * - ABNT NBR 14724:2011 (Trabalhos acadêmicos)
 * - ABNT NBR 6024:2012 (Numeração progressiva)
 * - ABNT NBR 10520:2002 (Citações)
 * - Manual de Redação Jurídica do STF
 * 
 * Formatação:
 * - Fonte: Times New Roman (corpo 12pt, citações longas 10pt)
 * - Espaçamento: 1,5 entrelinhas (corpo), simples (citações longas)
 * - Margens: superior/esquerda 3cm, inferior/direita 2cm
 * - Alinhamento: justificado
 * - Recuo: 1,25cm (parágrafo); 4cm (citação longa)
 * - Paginação: canto superior direito
 */

import jsPDF from 'jspdf';

/* ── ABNT Legal Layout Constants ── */
const LEGAL_LAYOUT = {
  // Margins in mm (ABNT: 3cm top/left, 2cm bottom/right)
  marginTop: 30,
  marginBottom: 20,
  marginLeft: 30,
  marginRight: 20,
  // Typography
  bodyFontSize: 12,         // ABNT corpo: 12pt
  citationFontSize: 10,     // Citações longas: 10pt (ABNT NBR 10520)
  headerFontSize: 14,       // Títulos de seção
  subHeaderFontSize: 12,    // Subtítulos
  footnoteSize: 10,         // Notas de rodapé
  // Spacing  
  lineHeight: 7,            // ~1.5 entrelinhas para 12pt
  citationLineHeight: 5.5,  // ~simples para citações
  paragraphIndent: 12.5,    // 1,25cm recuo de parágrafo
  citationIndent: 40,       // 4cm recuo citação longa (ABNT NBR 10520)
  sectionSpacing: 10,       // Espaço antes de seção
};

const COLORS = {
  text: [20, 20, 20] as const,
  muted: [85, 85, 85] as const,
  accent: [0, 92, 169] as const,
};

function getPageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function getPageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

function getContentWidth() {
  return 210 - LEGAL_LAYOUT.marginLeft - LEGAL_LAYOUT.marginRight; // A4 = 210mm
}

function drawPageNumber(doc: jsPDF, pageNum: number, startFrom: number = 2) {
  // ABNT NBR 14724: paginação no canto superior direito, fonte 10pt
  // Primeira página é contada mas não numerada
  if (pageNum < startFrom) return;
  const pw = getPageWidth(doc);
  doc.setFont('times', 'normal');
  doc.setFontSize(LEGAL_LAYOUT.footnoteSize); // 10pt conforme ABNT
  doc.setTextColor(...COLORS.text);
  // Posição: canto superior direito, dentro da margem superior (a 15mm do topo)
  doc.text(String(pageNum), pw - LEGAL_LAYOUT.marginRight, 15, { align: 'right' });
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const maxY = getPageHeight(doc) - LEGAL_LAYOUT.marginBottom;
  if (y + needed <= maxY) return y;
  doc.addPage();
  return LEGAL_LAYOUT.marginTop;
}

/**
 * Justify a single line of text by distributing extra space between words.
 * Last line of a paragraph is left-aligned (standard typographic rule).
 */
function drawJustifiedLine(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, isLastLine: boolean) {
  if (isLastLine || !text.trim()) {
    doc.text(text, x, y);
    return;
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    doc.text(text, x, y);
    return;
  }
  const totalTextWidth = words.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
  const totalSpace = maxWidth - totalTextWidth;
  const spacePerGap = totalSpace / (words.length - 1);

  // Avoid absurd spacing (fallback to normal if text is too short)
  if (spacePerGap > 8) {
    doc.text(text, x, y);
    return;
  }

  let curX = x;
  for (let i = 0; i < words.length; i++) {
    doc.text(words[i], curX, y);
    curX += doc.getTextWidth(words[i]) + spacePerGap;
  }
}

/**
 * Parse markdown-like legal text into structured blocks for PDF rendering.
 */
interface TextBlock {
  type: 'title' | 'subtitle' | 'paragraph' | 'citation' | 'list-item' | 'separator' | 'signature';
  content: string;
  level?: number;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\*{2,}/g, '')  // leftover ** markers
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links
}

function parseMarkdownToBlocks(markdown: string): TextBlock[] {
  const lines = markdown.split('\n');
  const blocks: TextBlock[] = [];
  let inCitation = false;
  let citationBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (inCitation && citationBuffer) {
        blocks.push({ type: 'citation', content: stripMarkdown(citationBuffer.trim()) });
        citationBuffer = '';
        inCitation = false;
      }
      continue;
    }

    // Detect citation blocks (lines starting with > or indented quotes)
    if (trimmed.startsWith('>')) {
      inCitation = true;
      citationBuffer += (citationBuffer ? ' ' : '') + trimmed.replace(/^>\s*/, '');
      continue;
    }

    if (inCitation && citationBuffer) {
      blocks.push({ type: 'citation', content: stripMarkdown(citationBuffer.trim()) });
      citationBuffer = '';
      inCitation = false;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'title', content: stripMarkdown(trimmed.replace(/^#\s+/, '')), level: 1 });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'title', content: stripMarkdown(trimmed.replace(/^##\s+/, '')), level: 2 });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'subtitle', content: stripMarkdown(trimmed.replace(/^###\s+/, '')), level: 3 });
    } else if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'subtitle', content: stripMarkdown(trimmed.replace(/^####\s+/, '')), level: 4 });
    }
    // Horizontal rules / separators
    else if (/^[-_*]{3,}$/.test(trimmed)) {
      blocks.push({ type: 'separator', content: '' });
    }
    // List items
    else if (/^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      blocks.push({ type: 'list-item', content: stripMarkdown(trimmed.replace(/^[-•*]\s/, '').replace(/^\d+[.)]\s/, '')) });
    }
    // Signature block detection
    else if (trimmed.startsWith('___') || trimmed.startsWith('---') && lines[i + 1]?.trim()) {
      // Skip, handled by separator
    }
    // Regular paragraph
    else {
      blocks.push({ type: 'paragraph', content: stripMarkdown(trimmed) });
    }
  }

  if (inCitation && citationBuffer) {
    blocks.push({ type: 'citation', content: stripMarkdown(citationBuffer.trim()) });
  }

  return blocks;
}

/**
 * Export legal document as PDF following ABNT NBR 14724 standards.
 */
export function exportLegalPDF(
  content: string,
  title: string,
  metadata?: {
    empresa?: string;
    cnpj?: string;
    edital?: string;
    modalidade?: string;
    fundamentacao?: string;
  }
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const contentWidth = getContentWidth();
  const blocks = parseMarkdownToBlocks(content);

  let y = LEGAL_LAYOUT.marginTop;
  let pageNum = 1;
  let listCounter = 0;

  // ── Document Header ──
  doc.setFont('times', 'bold');
  doc.setFontSize(LEGAL_LAYOUT.headerFontSize);
  doc.setTextColor(...COLORS.text);

  const titleLines = doc.splitTextToSize(title.toUpperCase(), contentWidth);
  for (const line of titleLines) {
    doc.text(line, getPageWidth(doc) / 2, y, { align: 'center' });
    y += 8;
  }
  y += 4;

  // Metadata line
  if (metadata) {
    doc.setFont('times', 'normal');
    doc.setFontSize(LEGAL_LAYOUT.footnoteSize);
    doc.setTextColor(...COLORS.muted);
    const metaParts: string[] = [];
    if (metadata.edital) metaParts.push(`Edital: ${metadata.edital}`);
    if (metadata.modalidade) metaParts.push(`Modalidade: ${metadata.modalidade}`);
    if (metadata.empresa) metaParts.push(`Empresa: ${metadata.empresa}`);
    if (metaParts.length > 0) {
      doc.text(metaParts.join(' | '), getPageWidth(doc) / 2, y, { align: 'center' });
      y += 6;
    }
    if (metadata.fundamentacao) {
      doc.text(`Fundamentação: ${metadata.fundamentacao}`, getPageWidth(doc) / 2, y, { align: 'center' });
      y += 6;
    }
  }

  // Separator
  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(0.4);
  doc.line(LEGAL_LAYOUT.marginLeft, y, getPageWidth(doc) - LEGAL_LAYOUT.marginRight, y);
  y += 8;

  // ── Render Blocks ──
  for (const block of blocks) {
    switch (block.type) {
      case 'title': {
        y = ensureSpace(doc, y, 16);
        y += LEGAL_LAYOUT.sectionSpacing;
        doc.setFont('times', 'bold');
        doc.setFontSize(block.level === 1 ? LEGAL_LAYOUT.headerFontSize : LEGAL_LAYOUT.subHeaderFontSize);
        doc.setTextColor(...COLORS.text);
        const tLines = doc.splitTextToSize(block.content.toUpperCase(), contentWidth);
        for (const l of tLines) {
          y = ensureSpace(doc, y, LEGAL_LAYOUT.lineHeight);
          // ABNT: títulos centralizados
          doc.text(l, getPageWidth(doc) / 2, y, { align: 'center' });
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 2;
        listCounter = 0;
        break;
      }

      case 'subtitle': {
        y = ensureSpace(doc, y, 14);
        y += 6;
        doc.setFont('times', 'bold');
        doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
        doc.setTextColor(...COLORS.text);
        const sLines = doc.splitTextToSize(block.content, contentWidth);
        for (const l of sLines) {
          y = ensureSpace(doc, y, LEGAL_LAYOUT.lineHeight);
          doc.text(l, LEGAL_LAYOUT.marginLeft, y);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 2;
        listCounter = 0;
        break;
      }

      case 'paragraph': {
        y = ensureSpace(doc, y, LEGAL_LAYOUT.lineHeight * 2);
        doc.setFont('times', 'normal');
        doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
        doc.setTextColor(...COLORS.text);
        // ABNT: recuo 1,25cm na primeira linha; largura disponível reduzida
        const pWidthFirst = contentWidth - LEGAL_LAYOUT.paragraphIndent;
        const pWidthRest = contentWidth;
        // Split using the narrower width to ensure no overflow on first line
        const pLines = doc.splitTextToSize(block.content, pWidthFirst);
        for (let li = 0; li < pLines.length; li++) {
          y = ensureSpace(doc, y, LEGAL_LAYOUT.lineHeight);
          const isFirstLine = li === 0;
          const isLastLine = li === pLines.length - 1;
          const xPos = isFirstLine ? LEGAL_LAYOUT.marginLeft + LEGAL_LAYOUT.paragraphIndent : LEGAL_LAYOUT.marginLeft;
          const lineWidth = isFirstLine ? pWidthFirst : pWidthRest;
          // ABNT: texto justificado
          drawJustifiedLine(doc, pLines[li], xPos, y, lineWidth, isLastLine);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 2;
        break;
      }

      case 'citation': {
        // ABNT NBR 10520: citação longa (>3 linhas) = recuo 4cm, fonte menor, espaçamento simples
        y = ensureSpace(doc, y, LEGAL_LAYOUT.citationLineHeight * 3);
        y += 3;
        doc.setFont('times', 'italic');
        doc.setFontSize(LEGAL_LAYOUT.citationFontSize);
        doc.setTextColor(...COLORS.muted);
        const citWidth = getPageWidth(doc) - LEGAL_LAYOUT.marginRight - LEGAL_LAYOUT.citationIndent;
        const cLines = doc.splitTextToSize(block.content, citWidth);
        for (let ci = 0; ci < cLines.length; ci++) {
          y = ensureSpace(doc, y, LEGAL_LAYOUT.citationLineHeight);
          const isLastCit = ci === cLines.length - 1;
          drawJustifiedLine(doc, cLines[ci], LEGAL_LAYOUT.citationIndent, y, citWidth, isLastCit);
          y += LEGAL_LAYOUT.citationLineHeight;
        }
        y += 4;
        break;
      }

      case 'list-item': {
        listCounter++;
        y = ensureSpace(doc, y, LEGAL_LAYOUT.lineHeight * 2);
        doc.setFont('times', 'normal');
        doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
        doc.setTextColor(...COLORS.text);
        const prefix = `${listCounter}. `;
        const itemText = prefix + block.content;
        const itemWidth = contentWidth - LEGAL_LAYOUT.paragraphIndent;
        const iLines = doc.splitTextToSize(itemText, itemWidth);
        for (let il = 0; il < iLines.length; il++) {
          y = ensureSpace(doc, y, LEGAL_LAYOUT.lineHeight);
          const isLastItem = il === iLines.length - 1;
          drawJustifiedLine(doc, iLines[il], LEGAL_LAYOUT.marginLeft + LEGAL_LAYOUT.paragraphIndent, y, itemWidth, isLastItem);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 1;
        break;
      }

      case 'separator': {
        y = ensureSpace(doc, y, 10);
        y += 4;
        doc.setDrawColor(...COLORS.muted);
        doc.setLineWidth(0.3);
        const midX = getPageWidth(doc) / 2;
        doc.line(midX - 30, y, midX + 30, y);
        y += 6;
        break;
      }
    }
  }

  // ── Header (paginação) e Rodapé em cada página ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // ABNT: número da página no canto superior direito (a partir da 2ª página)
    drawPageNumber(doc, p, 2);
    
    // Rodapé: linha fina + texto institucional DENTRO da margem inferior
    const ph = getPageHeight(doc);
    const footerLineY = ph - LEGAL_LAYOUT.marginBottom + 2;
    const footerTextY = footerLineY + 4;

    // Só desenha se couber na página (segurança)
    if (footerTextY < ph - 2) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(LEGAL_LAYOUT.marginLeft, footerLineY, getPageWidth(doc) - LEGAL_LAYOUT.marginRight, footerLineY);
      
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(
        `Documento gerado pela plataforma LicitaIA — ${new Date().toLocaleDateString('pt-BR')} — Página ${p} de ${totalPages}`,
        getPageWidth(doc) / 2,
        footerTextY,
        { align: 'center' }
      );
    }
  }

  const safeName = title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  doc.save(`${safeName}.pdf`);
}

/**
 * Export legal document as Word-compatible HTML (.doc).
 * Uses HTML/CSS within a .doc container that Word opens natively,
 * preserving ABNT formatting.
 */
export function exportLegalWord(
  content: string,
  title: string,
  metadata?: {
    empresa?: string;
    cnpj?: string;
    edital?: string;
    modalidade?: string;
    fundamentacao?: string;
  }
) {
  const blocks = parseMarkdownToBlocks(content);

  // Build Word-compatible HTML with ABNT CSS
  let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="generator" content="LicitaIA">
<style>
  @page {
    size: A4;
    margin: 3cm 2cm 2cm 3cm; /* ABNT: sup 3cm, inf 2cm, esq 3cm, dir 2cm */
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5; /* ABNT: 1,5 entrelinhas */
    color: #141414;
    text-align: justify; /* ABNT: alinhamento justificado */
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    margin-top: 0;
    margin-bottom: 12pt;
    line-height: 1.5;
  }
  h2 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 18pt;
    margin-bottom: 6pt;
    line-height: 1.5;
  }
  h3 {
    font-size: 12pt;
    font-weight: bold;
    margin-top: 12pt;
    margin-bottom: 6pt;
    line-height: 1.5;
  }
  p {
    text-indent: 1.25cm; /* ABNT: recuo de parágrafo */
    margin-top: 0;
    margin-bottom: 6pt;
    text-align: justify;
    orphans: 2;
    widows: 2;
  }
  p.no-indent {
    text-indent: 0;
  }
  p.metadata {
    text-indent: 0;
    text-align: center;
    font-size: 10pt;
    color: #555;
    margin-bottom: 4pt;
  }
  /* ABNT NBR 10520: citação longa */
  blockquote {
    margin-left: 4cm; /* Recuo 4cm */
    margin-right: 0;
    margin-top: 6pt;
    margin-bottom: 6pt;
    font-size: 10pt; /* Fonte menor */
    line-height: 1.0; /* Espaçamento simples */
    font-style: italic;
    color: #555;
    text-align: justify;
  }
  ol, ul {
    margin-left: 1.25cm;
    margin-top: 6pt;
    margin-bottom: 6pt;
  }
  li {
    margin-bottom: 3pt;
    text-align: justify;
  }
  hr {
    border: none;
    border-top: 1px solid #999;
    margin: 12pt auto;
    width: 40%;
  }
  .header-line {
    border-top: 1px solid #aaa;
    margin: 8pt 0 12pt 0;
  }
  .footer {
    text-align: center;
    font-size: 8pt;
    color: #999;
    font-style: italic;
    margin-top: 24pt;
    border-top: 1px solid #ddd;
    padding-top: 6pt;
  }
</style>
</head>
<body>
`;

  // Title
  html += `<h1>${escapeHtml(title)}</h1>\n`;

  // Metadata
  if (metadata) {
    const parts: string[] = [];
    if (metadata.edital) parts.push(`Edital: ${metadata.edital}`);
    if (metadata.modalidade) parts.push(`Modalidade: ${metadata.modalidade}`);
    if (metadata.empresa) parts.push(`Empresa: ${metadata.empresa}`);
    if (parts.length > 0) {
      html += `<p class="metadata">${escapeHtml(parts.join(' | '))}</p>\n`;
    }
    if (metadata.fundamentacao) {
      html += `<p class="metadata">${escapeHtml(`Fundamentação: ${metadata.fundamentacao}`)}</p>\n`;
    }
  }

  html += `<div class="header-line"></div>\n`;

  // Render blocks
  let inList = false;
  for (const block of blocks) {
    if (block.type !== 'list-item' && inList) {
      html += `</ol>\n`;
      inList = false;
    }

    switch (block.type) {
      case 'title':
        html += block.level === 1
          ? `<h1>${escapeHtml(block.content)}</h1>\n`
          : `<h2>${escapeHtml(block.content)}</h2>\n`;
        break;
      case 'subtitle':
        html += `<h3>${escapeHtml(block.content)}</h3>\n`;
        break;
      case 'paragraph':
        html += `<p>${escapeHtml(block.content)}</p>\n`;
        break;
      case 'citation':
        html += `<blockquote>${escapeHtml(block.content)}</blockquote>\n`;
        break;
      case 'list-item':
        if (!inList) {
          html += `<ol>\n`;
          inList = true;
        }
        html += `<li>${escapeHtml(block.content)}</li>\n`;
        break;
      case 'separator':
        html += `<hr>\n`;
        break;
    }
  }

  if (inList) html += `</ol>\n`;

  // Footer
  html += `<div class="footer">Documento gerado pela plataforma LicitaIA — ${new Date().toLocaleDateString('pt-BR')}</div>\n`;
  html += `</body></html>`;

  // Download as .doc (Word opens HTML natively)
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  a.download = `${safeName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
