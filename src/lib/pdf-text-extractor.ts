/**
 * Extracts readable text from files/blobs (PDF, DOC, DOCX, TXT).
 * Keeps more of the original line structure to improve edital item extraction fidelity.
 */
import ExcelJS from 'exceljs';

const DEFAULT_MAX_PAGES = 150;
const PDF_VISION_PAGE_LIMIT = 5;
const PDF_VISION_PAGE_LIMIT_EDITAL = 20;
const SPREADSHEET_SHEET_LIMIT = 4;
const SPREADSHEET_ROW_LIMIT = 80;
const SPREADSHEET_COL_LIMIT = 16;

type VisionImageInput = {
  name: string;
  dataUrl: string;
};

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromFile(file: File, maxPages = DEFAULT_MAX_PAGES, isEdital = false): Promise<string> {
  return extractTextFromBlob(file, file.name, maxPages, isEdital);
}

export async function extractTextFromBlob(
  blob: Blob,
  fileName = 'documento.pdf',
  maxPages = DEFAULT_MAX_PAGES,
  isEdital = false,
): Promise<string> {
  const name = fileName.toLowerCase();
  const type = blob.type.toLowerCase();

  if (name.endsWith('.txt') || type.startsWith('text/')) {
    return normalizeExtractedText(await blob.text());
  }

  if (name.endsWith('.pdf') || type.includes('pdf')) {
    return extractTextFromPDFData(await blob.arrayBuffer(), maxPages, fileName);
  }

  if (name.endsWith('.docx') || type.includes('officedocument.wordprocessingml.document')) {
    try {
      return extractTextFromDocxArrayBuffer(await blob.arrayBuffer());
    } catch {
      return normalizeExtractedText(await blob.text());
    }
  }

  if (name.endsWith('.doc') || type.includes('msword')) {
    try {
      return extractTextFromDocxArrayBuffer(await blob.arrayBuffer());
    } catch {
      return normalizeExtractedText(await blob.text());
    }
  }

  if (isSpreadsheetFile(name, type)) {
    return extractTextFromSpreadsheetArrayBuffer(await blob.arrayBuffer(), fileName);
  }

  if (isImageFile(name, type)) {
    return extractTextFromImageBlob(blob, fileName);
  }

  return normalizeExtractedText(await blob.text());
}

async function extractTextFromPDFData(
  arrayBuffer: ArrayBuffer,
  maxPages: number,
  fileName: string,
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, maxPages);
  const pages: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => {
        const value = typeof item?.str === 'string' ? item.str : '';
        return item?.hasEOL ? `${value}\n` : value;
      })
      .join(' ')
      .replace(/ *\n */g, '\n');

    if (text.trim()) {
      pages.push(text);
    }
  }

  const extractedText = normalizeExtractedText(pages.join('\n\n'));

  if (!shouldUsePdfVisionFallback(extractedText)) {
    return extractedText;
  }

  try {
    const pageImages = await renderPdfPagesToVisionInputs(pdf, Math.min(totalPages, PDF_VISION_PAGE_LIMIT));
    if (pageImages.length === 0) {
      return extractedText;
    }

    const visionText = await runVisionExtraction(pageImages, fileName);
    return normalizeExtractedText([extractedText, visionText].filter(Boolean).join('\n\n'));
  } catch {
    return extractedText;
  }
}

async function extractTextFromDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXml = await zip.file('word/document.xml')?.async('text');
  if (!docXml) {
    throw new Error('Not a valid DOCX file');
  }

  const text = docXml
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<w:p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  return normalizeExtractedText(text);
}

function isSpreadsheetFile(name: string, type: string) {
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheetml') ||
    type.includes('application/vnd.ms-excel')
  );
}

function isImageFile(name: string, type: string) {
  return (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    type.startsWith('image/')
  );
}

function shouldUsePdfVisionFallback(text: string) {
  const normalized = normalizeExtractedText(text);
  const hasDate = /\b\d{2}[\/.\-]\d{2}[\/.\-]\d{4}\b/.test(normalized);
  const hasEmission = /data\s+de\s+emiss[aã]o|emitid[ao]|expedi[dç][ao]/i.test(normalized);
  const hasPlaceholder = /\b[xX]{5,}\b/.test(normalized);
  const likelyAdministrativeDocument = /alvar|certid|comprovante|consulta|qsa|cadastral|licen[cç]a/i.test(normalized);

  return normalized.length < 500 || (!hasDate && normalized.length < 2500) || (hasPlaceholder && !hasEmission && likelyAdministrativeDocument);
}

async function renderPdfPagesToVisionInputs(pdf: any, pagesToRender: number): Promise<VisionImageInput[]> {
  if (typeof document === 'undefined' || pagesToRender <= 0) {
    return [];
  }

  const results: VisionImageInput[] = [];

  for (let i = 1; i <= pagesToRender; i += 1) {
    const page = await pdf.getPage(i);
    const previewViewport = page.getViewport({ scale: 2.2 });
    const scaleFactor = previewViewport.width > 1800 ? 1800 / previewViewport.width : 1;
    const viewport = page.getViewport({ scale: 2.2 * scaleFactor });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) continue;

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    results.push({
      name: `${i.toString().padStart(2, '0')}-${pdf.fingerprints?.[0] || 'pagina'}.jpg`,
      dataUrl: canvas.toDataURL('image/jpeg', 0.84),
    });
  }

  return results;
}

async function extractTextFromImageBlob(blob: Blob, fileName: string): Promise<string> {
  const dataUrl = await blobToDataUrl(blob);
  const text = await runVisionExtraction([{ name: fileName, dataUrl }], fileName);
  return normalizeExtractedText(text);
}

async function extractTextFromSpreadsheetArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheetBlocks = workbook.worksheets.slice(0, SPREADSHEET_SHEET_LIMIT)
    .map((ws) => {
      if (!ws || ws.rowCount === 0) return '';

      const normalizedRows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > SPREADSHEET_ROW_LIMIT) return;
        const cells: string[] = [];
        for (let c = 1; c <= Math.min(row.cellCount, SPREADSHEET_COL_LIMIT); c++) {
          const val = row.getCell(c).value;
          const formatted = formatSpreadsheetCell(val);
          if (formatted.length > 0) cells.push(formatted);
        }
        if (cells.length > 0) normalizedRows.push(cells);
      });

      if (normalizedRows.length === 0) return '';

      return [
        `Planilha: ${ws.name}`,
        ...normalizedRows.map((row, index) => `Linha ${index + 1}: ${row.join(' | ')}`),
      ].join('\n');
    })
    .filter(Boolean);

  return normalizeExtractedText(sheetBlocks.join('\n\n')) || `Planilha ${fileName} sem conteúdo legível.`;
}

function formatSpreadsheetCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Falha ao converter imagem para data URL.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(blob);
  });
}

async function runVisionExtraction(images: VisionImageInput[], fileName: string) {
  const { extractTextFromVisionImages } = await import('@/lib/document-ocr');
  return extractTextFromVisionImages(images, fileName);
}
