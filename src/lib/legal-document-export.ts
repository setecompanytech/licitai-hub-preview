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
  if (pageNum < startFrom) return;
  const pw = getPageWidth(doc);
  doc.setFont('times', 'normal');
  doc.setFontSize(LEGAL_LAYOUT.footnoteSize);
  doc.setTextColor(...COLORS.text);
  doc.text(String(pageNum), pw - LEGAL_LAYOUT.marginRight, 15, { align: 'right' });
}

/**
 * Justify a single line of text by distributing extra space between words.
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
    .replace(/\*{2,}/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
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

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'title', content: stripMarkdown(trimmed.replace(/^#\s+/, '')), level: 1 });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'title', content: stripMarkdown(trimmed.replace(/^##\s+/, '')), level: 2 });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'subtitle', content: stripMarkdown(trimmed.replace(/^###\s+/, '')), level: 3 });
    } else if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'subtitle', content: stripMarkdown(trimmed.replace(/^####\s+/, '')), level: 4 });
    } else if (/^[-_*]{3,}$/.test(trimmed)) {
      blocks.push({ type: 'separator', content: '' });
    } else if (/^[-•*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      blocks.push({ type: 'list-item', content: stripMarkdown(trimmed.replace(/^[-•*]\s/, '').replace(/^\d+[.)]\s/, '')) });
    } else if (trimmed.startsWith('___') || trimmed.startsWith('---') && lines[i + 1]?.trim()) {
      // Skip, handled by separator
    } else {
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
export async function exportLegalPDF(
  content: string,
  title: string,
  metadata?: {
    empresa?: string;
    cnpj?: string;
    edital?: string;
    modalidade?: string;
    fundamentacao?: string;
    timbradoUrl?: string | null;
    certificado_nome?: string | null;
    certificado_tipo?: string | null;
    rep_nome?: string;
    rep_cpf?: string;
  }
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const contentWidth = getContentWidth();
  const blocks = parseMarkdownToBlocks(content);

  // Load timbrado image if available — supports direct URLs and Supabase storage paths
  let timbradoImg: HTMLImageElement | null = null;
  let timbradoAspect = 1;
  const timbradoSrc = metadata?.timbradoUrl || null;
  if (timbradoSrc) {
    try {
      timbradoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Timbrado load failed'));
        img.src = timbradoSrc;
      });
      timbradoAspect = timbradoImg.width / timbradoImg.height;
    } catch {
      console.warn('Não foi possível carregar o timbrado:', timbradoSrc);
      timbradoImg = null;
    }
  }

  // Header height accounts for timbrado image space
  const headerH = timbradoImg ? 22 : 0;
  // Effective top margin: base margin + timbrado space
  const effectiveTopMargin = LEGAL_LAYOUT.marginTop + headerH;

  const drawTimbrado = () => {
    if (!timbradoImg) return;
    const imgW = contentWidth;
    const imgH = imgW / timbradoAspect;
    const finalH = Math.min(imgH, 20);
    const finalW = finalH * timbradoAspect;
    doc.addImage(timbradoImg, 'PNG', LEGAL_LAYOUT.marginLeft, 8, finalW, finalH);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    const ph = getPageHeight(doc);
    const footerLineY = ph - LEGAL_LAYOUT.marginBottom + 2;
    const footerTextY = footerLineY + 4;

    if (footerTextY < ph - 2) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(LEGAL_LAYOUT.marginLeft, footerLineY, getPageWidth(doc) - LEGAL_LAYOUT.marginRight, footerLineY);

      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);

      const footerParts: string[] = [];
      if (metadata?.empresa) footerParts.push(metadata.empresa);
      if (metadata?.cnpj) footerParts.push(`CNPJ: ${metadata.cnpj}`);
      footerParts.push(`Página ${pageNum} de ${totalPages}`);

      doc.text(
        footerParts.join(' — '),
        getPageWidth(doc) / 2,
        footerTextY,
        { align: 'center' }
      );
    }
  };

  // Draw timbrado on first page
  drawTimbrado();

  let y = effectiveTopMargin;
  let listCounter = 0;

  // ensureSpace now correctly accounts for timbrado on new pages
  const ensureSpace = (needed: number): void => {
    const maxY = getPageHeight(doc) - LEGAL_LAYOUT.marginBottom;
    if (y + needed <= maxY) return;
    doc.addPage();
    drawTimbrado();
    y = effectiveTopMargin;
  };

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
        ensureSpace(16);
        y += LEGAL_LAYOUT.sectionSpacing;
        doc.setFont('times', 'bold');
        doc.setFontSize(block.level === 1 ? LEGAL_LAYOUT.headerFontSize : LEGAL_LAYOUT.subHeaderFontSize);
        doc.setTextColor(...COLORS.text);
        const tLines = doc.splitTextToSize(block.content.toUpperCase(), contentWidth);
        for (const l of tLines) {
          ensureSpace(LEGAL_LAYOUT.lineHeight);
          doc.text(l, LEGAL_LAYOUT.marginLeft, y);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 2;
        listCounter = 0;
        break;
      }

      case 'subtitle': {
        ensureSpace(14);
        y += 6;
        doc.setFont('times', 'bold');
        doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
        doc.setTextColor(...COLORS.text);
        const sLines = doc.splitTextToSize(block.content, contentWidth);
        for (const l of sLines) {
          ensureSpace(LEGAL_LAYOUT.lineHeight);
          doc.text(l, LEGAL_LAYOUT.marginLeft, y);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 2;
        listCounter = 0;
        break;
      }

      case 'paragraph': {
        ensureSpace(LEGAL_LAYOUT.lineHeight * 2);
        doc.setFont('times', 'normal');
        doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
        doc.setTextColor(...COLORS.text);
        const pWidthFirst = contentWidth - LEGAL_LAYOUT.paragraphIndent;
        const pWidthRest = contentWidth;
        const pLines = doc.splitTextToSize(block.content, pWidthFirst);
        for (let li = 0; li < pLines.length; li++) {
          ensureSpace(LEGAL_LAYOUT.lineHeight);
          const isFirstLine = li === 0;
          const isLastLine = li === pLines.length - 1;
          const xPos = isFirstLine ? LEGAL_LAYOUT.marginLeft + LEGAL_LAYOUT.paragraphIndent : LEGAL_LAYOUT.marginLeft;
          const lineWidth = isFirstLine ? pWidthFirst : pWidthRest;
          drawJustifiedLine(doc, pLines[li], xPos, y, lineWidth, isLastLine);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 2;
        break;
      }

      case 'citation': {
        ensureSpace(LEGAL_LAYOUT.citationLineHeight * 3);
        y += 3;
        doc.setFont('times', 'italic');
        doc.setFontSize(LEGAL_LAYOUT.citationFontSize);
        doc.setTextColor(...COLORS.muted);
        const citWidth = getPageWidth(doc) - LEGAL_LAYOUT.marginRight - LEGAL_LAYOUT.citationIndent;
        const cLines = doc.splitTextToSize(block.content, citWidth);
        for (let ci = 0; ci < cLines.length; ci++) {
          ensureSpace(LEGAL_LAYOUT.citationLineHeight);
          const isLastCit = ci === cLines.length - 1;
          drawJustifiedLine(doc, cLines[ci], LEGAL_LAYOUT.citationIndent, y, citWidth, isLastCit);
          y += LEGAL_LAYOUT.citationLineHeight;
        }
        y += 4;
        break;
      }

      case 'list-item': {
        listCounter++;
        ensureSpace(LEGAL_LAYOUT.lineHeight * 2);
        doc.setFont('times', 'normal');
        doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
        doc.setTextColor(...COLORS.text);
        const prefix = `${listCounter}. `;
        const itemText = prefix + block.content;
        const itemWidth = contentWidth - LEGAL_LAYOUT.paragraphIndent;
        const iLines = doc.splitTextToSize(itemText, itemWidth);
        for (let il = 0; il < iLines.length; il++) {
          ensureSpace(LEGAL_LAYOUT.lineHeight);
          const isLastItem = il === iLines.length - 1;
          drawJustifiedLine(doc, iLines[il], LEGAL_LAYOUT.marginLeft + LEGAL_LAYOUT.paragraphIndent, y, itemWidth, isLastItem);
          y += LEGAL_LAYOUT.lineHeight;
        }
        y += 1;
        break;
      }

      case 'separator': {
        ensureSpace(8);
        y += 6;
        break;
      }
    }
  }

  // ── Assinatura do Representante Legal + Certificado Digital ──
  // Calculate total space needed for signature + digital cert together
  const hasSignature = !!(metadata?.empresa || metadata?.rep_nome);
  const hasDigitalCert = !!metadata?.certificado_nome;
  const signatureLines = hasSignature ? 8 : 0;
  const certLines = hasDigitalCert ? 7 : 0;
  const totalSignatureSpace = (signatureLines + certLines) * LEGAL_LAYOUT.lineHeight;

  if (hasSignature) {
    ensureSpace(totalSignatureSpace);
    y += LEGAL_LAYOUT.lineHeight * 3;

    // Linha de assinatura
    const sigX = getPageWidth(doc) / 2 - 40;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(sigX, y, sigX + 80, y);
    y += LEGAL_LAYOUT.lineHeight;

    // Nome da empresa
    doc.setFont('times', 'bold');
    doc.setFontSize(LEGAL_LAYOUT.bodyFontSize);
    doc.setTextColor(...COLORS.text);
    if (metadata?.empresa) {
      doc.text(metadata.empresa.toUpperCase(), getPageWidth(doc) / 2, y, { align: 'center' });
      y += LEGAL_LAYOUT.lineHeight * 0.8;
    }
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    if (metadata?.cnpj) {
      doc.text(`CNPJ: ${metadata.cnpj}`, getPageWidth(doc) / 2, y, { align: 'center' });
      y += LEGAL_LAYOUT.lineHeight;
    }
    if (metadata?.rep_nome) {
      doc.text(metadata.rep_nome.toUpperCase(), getPageWidth(doc) / 2, y, { align: 'center' });
      y += LEGAL_LAYOUT.lineHeight * 0.8;
    }
    if (metadata?.rep_cpf) {
      doc.text(`CPF: ${metadata.rep_cpf}`, getPageWidth(doc) / 2, y, { align: 'center' });
      y += LEGAL_LAYOUT.lineHeight * 0.8;
    }
    if (metadata?.rep_cargo) {
      doc.text(metadata.rep_cargo, getPageWidth(doc) / 2, y, { align: 'center' });
      y += LEGAL_LAYOUT.lineHeight;
    }
  }

  // ── Digital Signature Block — always rendered when certificate is configured ──
  if (hasDigitalCert) {
    if (!hasSignature) ensureSpace(totalSignatureSpace);
    y += LEGAL_LAYOUT.lineHeight * 1.5;
    
    const boxX = LEGAL_LAYOUT.marginLeft + 10;
    const boxW = contentWidth - 20;
    const boxH = LEGAL_LAYOUT.lineHeight * 5;
    
    // Green border box
    doc.setDrawColor(0, 128, 80);
    doc.setLineWidth(0.8);
    doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'S');
    
    // Light green background
    doc.setFillColor(240, 255, 245);
    doc.roundedRect(boxX + 0.4, y + 0.4, boxW - 0.8, boxH - 0.8, 2.6, 2.6, 'F');
    
    const centerX = getPageWidth(doc) / 2;
    let certY = y + LEGAL_LAYOUT.lineHeight;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 100, 60);
    doc.text('DOCUMENTO ASSINADO DIGITALMENTE', centerX, certY, { align: 'center' });
    certY += LEGAL_LAYOUT.lineHeight * 0.9;
    
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const certTipo = metadata!.certificado_tipo === 'e-cnpj' ? 'e-CNPJ' : metadata!.certificado_tipo === 'e-cpf' ? 'e-CPF' : 'Certificado Digital';
    doc.text(`Tipo: ${certTipo} — ${metadata!.certificado_nome}`, centerX, certY, { align: 'center' });
    certY += LEGAL_LAYOUT.lineHeight * 0.8;
    
    const assinante = metadata?.rep_nome || metadata?.empresa || '';
    const cpfInfo = metadata?.rep_cpf ? ` | CPF: ${metadata.rep_cpf}` : '';
    doc.text(`Assinante: ${assinante}${cpfInfo}`, centerX, certY, { align: 'center' });
    certY += LEGAL_LAYOUT.lineHeight * 0.8;
    
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(`Data/Hora da Assinatura: ${new Date().toLocaleString('pt-BR')} — Validação via ICP-Brasil`, centerX, certY, { align: 'center' });
    
    y += boxH + LEGAL_LAYOUT.lineHeight;
    doc.setTextColor(...COLORS.text);
  }

  // ── Timbrado, paginação e rodapé em TODAS as páginas ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) drawTimbrado();
    drawPageNumber(doc, p, 2);
    drawFooter(p, totalPages);
  }

  const safeName = title.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  doc.save(`${safeName}.pdf`);
}

/**
 * Export legal document as Word-compatible HTML (.doc).
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
    timbradoUrl?: string | null;
    certificado_nome?: string | null;
    certificado_tipo?: string | null;
    rep_nome?: string;
    rep_cpf?: string;
    rep_cargo?: string;
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
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  /* ABNT NBR 14724: margens sup/esq 3cm, inf/dir 2cm */
  @page {
    size: A4;
    margin: 3cm 2cm 2.5cm 3cm;
    mso-header-margin: 1.5cm;
    mso-footer-margin: 1cm;
    mso-page-numbers: true;
  }
  @page Section1 {
    mso-header: h1;
    mso-footer: f1;
  }
  div.Section1 { page: Section1; }
  div.header {
    text-align: right;
    font-family: 'Times New Roman', Times, serif;
    font-size: 10pt;
    color: #141414;
    border: none;
    mso-element: header;
    margin-bottom: 0;
  }
  div.footer-section {
    text-align: center;
    font-family: 'Times New Roman', Times, serif;
    font-size: 8pt;
    color: #999;
    font-style: italic;
    border-top: 0.5pt solid #ddd;
    padding-top: 4pt;
    mso-element: footer;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #141414;
    text-align: justify;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 14pt;
    font-weight: bold;
    text-align: left;
    text-transform: uppercase;
    margin-top: 0;
    margin-bottom: 12pt;
    line-height: 1.5;
  }
  h2 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    text-align: left;
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
    text-indent: 1.25cm;
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
    margin-left: 4cm;
    margin-right: 0;
    margin-top: 6pt;
    margin-bottom: 6pt;
    font-size: 10pt;
    line-height: 1.0;
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
  .doc-footer {
    text-align: center;
    font-size: 8pt;
    color: #999;
    font-style: italic;
    margin-top: 24pt;
    border-top: 1px solid #ddd;
    padding-top: 6pt;
  }
  .signature-block {
    text-align: center;
    margin-top: 36pt;
  }
  .signature-block p {
    text-indent: 0;
    text-align: center;
    margin: 0 0 2pt 0;
  }
  .digital-sig-box {
    margin-top: 24pt;
    border: 2px solid #008050;
    border-radius: 6pt;
    padding: 12pt;
    text-align: center;
  }
  .digital-sig-box p {
    text-indent: 0;
    text-align: center;
    margin: 0 0 2pt 0;
  }
</style>
</head>
<body>
<!-- Word Header -->
<div style="mso-element:header" id="h1">
  <p style="text-align:right;font-size:10pt;font-family:'Times New Roman';margin:0;border:none;">
    <span style="mso-field-code:'PAGE'"><!--[if supportFields]><span style="mso-element:field-begin"></span> PAGE <span style="mso-element:field-end"></span><![endif]--></span>
  </p>
</div>
<!-- Word Footer with empresa info -->
<div style="mso-element:footer" id="f1">
  <p style="text-align:center;font-size:8pt;font-family:'Times New Roman';font-style:italic;color:#999;border-top:0.5pt solid #ddd;padding-top:4pt;margin:0;">
    ${metadata?.empresa ? `${escapeHtml(metadata.empresa)}${metadata?.cnpj ? ` — CNPJ: ${escapeHtml(metadata.cnpj)}` : ''} — ` : ''}Página <span style="mso-field-code:'PAGE'"><!--[if supportFields]><span style="mso-element:field-begin"></span> PAGE <span style="mso-element:field-end"></span><![endif]--></span> de <span style="mso-field-code:'NUMPAGES'"><!--[if supportFields]><span style="mso-element:field-begin"></span> NUMPAGES <span style="mso-element:field-end"></span><![endif]--></span>
  </p>
</div>
<div class="Section1">
`;

  // Timbrado header — accepts any image URL (Supabase storage or direct)
  if (metadata?.timbradoUrl) {
    html += `<div style="text-align:center;margin-bottom:12pt"><img src="${metadata.timbradoUrl}" style="max-height:60pt;max-width:100%" /></div>\n`;
  }

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

  // ── Bloco de assinatura do representante ──
  if (metadata?.empresa || metadata?.rep_nome) {
    html += `
      <div class="signature-block">
        <div style="width:200pt;border-bottom:2px solid #333;margin:0 auto 6pt auto"></div>
        ${metadata?.empresa ? `<p style="font-weight:bold;font-size:12pt">${escapeHtml(metadata.empresa.toUpperCase())}</p>` : ''}
        ${metadata?.cnpj ? `<p style="font-size:10pt">CNPJ: ${escapeHtml(metadata.cnpj)}</p>` : ''}
        ${metadata?.rep_nome ? `<p>${escapeHtml(metadata.rep_nome.toUpperCase())}</p>` : ''}
        ${metadata?.rep_cpf ? `<p style="font-size:10pt">CPF: ${escapeHtml(metadata.rep_cpf)}</p>` : ''}
        ${metadata?.rep_cargo ? `<p style="font-size:10pt">${escapeHtml(metadata.rep_cargo)}</p>` : ''}
      </div>\n`;
  }

  // ── Digital signature block ──
  if (metadata?.certificado_nome) {
    const certTipo = metadata.certificado_tipo === 'e-cnpj' ? 'e-CNPJ' : metadata.certificado_tipo === 'e-cpf' ? 'e-CPF' : 'Certificado Digital';
    const assinante = metadata.rep_nome || metadata.empresa || '';
    html += `
      <div class="digital-sig-box" style="background-color:#f0fff5">
        <p style="font-weight:bold;color:#006440;font-size:10pt">DOCUMENTO ASSINADO DIGITALMENTE</p>
        <p style="font-size:9pt;color:#444">Tipo: ${certTipo} &mdash; ${escapeHtml(metadata.certificado_nome)}</p>
        <p style="font-size:9pt;color:#444">Assinante: ${escapeHtml(assinante)}${metadata.rep_cpf ? ` | CPF: ${escapeHtml(metadata.rep_cpf)}` : ''}</p>
        <p style="font-size:8pt;color:#666">Data/Hora: ${new Date().toLocaleString('pt-BR')} &mdash; Validação via ICP-Brasil</p>
      </div>\n`;
  }

  // Footer and close
  const footerParts: string[] = [];
  if (metadata?.empresa) footerParts.push(metadata.empresa);
  if (metadata?.cnpj) footerParts.push(`CNPJ: ${metadata.cnpj}`);
  footerParts.push(new Date().toLocaleDateString('pt-BR'));
  
  html += `<div class="doc-footer">${escapeHtml(footerParts.join(' — '))}</div>\n`;
  html += `</div><!-- /Section1 -->\n</body></html>`;

  // Download as .doc
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
