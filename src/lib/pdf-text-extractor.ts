/**
 * Extracts readable text from files/blobs (PDF, DOC, DOCX, TXT, planilhas,
 * imagens e pacotes .zip — o formato em que o PNCP publica a maior parte dos
 * editais).
 * Keeps more of the original line structure to improve edital item extraction fidelity.
 */
import ExcelJS from 'exceljs';

const DEFAULT_MAX_PAGES = 150;
const PDF_VISION_PAGE_LIMIT = 5;
const PDF_VISION_PAGE_LIMIT_EDITAL = 50;
const SPREADSHEET_SHEET_LIMIT = 10;
const SPREADSHEET_ROW_LIMIT = 500;
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

/**
 * `paginasDeOcr` sobrepõe quantas páginas vão para o OCR por visão quando o PDF
 * é digitalizado. O padrão de 5 páginas serve a certidão; não serve a uma ATA
 * de 156 páginas escaneada, onde a tabela de itens pode estar em qualquer lugar.
 */
export async function extractTextFromFile(file: File, maxPages = DEFAULT_MAX_PAGES, isEdital = false, paginasDeOcr?: number): Promise<string> {
  return extractTextFromBlob(file, file.name, maxPages, isEdital, paginasDeOcr);
}

export async function extractTextFromBlob(
  blob: Blob,
  fileName = 'documento.pdf',
  maxPages = DEFAULT_MAX_PAGES,
  isEdital = false,
  paginasDeOcr?: number,
): Promise<string> {
  const name = fileName.toLowerCase();
  const type = blob.type.toLowerCase();

  if (name.endsWith('.txt') || type.startsWith('text/')) {
    return normalizeExtractedText(await blob.text());
  }

  if (name.endsWith('.pdf') || type.includes('pdf')) {
    return extractTextFromPDFData(await blob.arrayBuffer(), maxPages, fileName, isEdital, paginasDeOcr);
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

  // O PNCP publica a maior parte dos editais em .zip — edital, termo de
  // referência e anexos num pacote só. Sem abrir, o arquivo caía no fallback
  // abaixo, virava texto binário e era descartado por ser curto demais: a
  // leitura automática simplesmente não acontecia, sem dizer por quê.
  if (name.endsWith('.zip') || type.includes('zip')) {
    return extractTextFromZip(blob, fileName, maxPages, isEdital);
  }

  return normalizeExtractedText(await blob.text());
}

/** Entradas que nunca contêm texto útil e só gastam tempo. */
const IGNORADAS_NO_ZIP = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i;
const LEGIVEIS_NO_ZIP = /\.(pdf|docx?|txt|xlsx?|csv|odt)$/i;

/**
 * Abre um pacote e extrai o texto de cada arquivo legível dentro dele.
 *
 * Ordem importa: o edital vem primeiro, e o termo de referência logo depois —
 * quando o conteúdo precisa ser recortado por limite de tamanho, o que fica é o
 * que mais pesa na análise.
 *
 * @param profundidade Guarda contra zip dentro de zip: um pacote aninhado é
 *   aberto uma vez; a partir daí, ignorado. Sem isso, um arquivo malicioso ou
 *   apenas mal montado poderia recursar sem fim.
 */
async function extractTextFromZip(
  blob: Blob,
  fileName: string,
  maxPages: number,
  isEdital: boolean,
  profundidade = 0,
): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  const entradas = Object.values(zip.files).filter(
    (f) => !f.dir && !IGNORADAS_NO_ZIP.test(f.name) &&
      (LEGIVEIS_NO_ZIP.test(f.name) || (profundidade === 0 && /\.zip$/i.test(f.name))),
  );

  // Edital primeiro, termo de referência em seguida, o resto depois.
  const peso = (nome: string) =>
    /edital/i.test(nome) ? 0
    : /(termo[_\s-]*de[_\s-]*refer|^tr[_\s-]|anexo[_\s-]*i\b)/i.test(nome) ? 1
    : 2;
  entradas.sort((a, b) => peso(a.name) - peso(b.name) || a.name.localeCompare(b.name));

  const partes: string[] = [];
  for (const entrada of entradas) {
    try {
      const interno = await entrada.async('blob');
      const nomeCurto = entrada.name.split('/').pop() || entrada.name;
      const texto = /\.zip$/i.test(entrada.name)
        ? await extractTextFromZip(interno, nomeCurto, maxPages, isEdital, profundidade + 1)
        : await extractTextFromBlob(interno, nomeCurto, maxPages, isEdital);
      if (texto && texto.trim().length >= 100) {
        partes.push(`----- ${nomeCurto} -----\n${texto}`);
      }
    } catch {
      // Um anexo ilegível não invalida o pacote: segue para o próximo.
    }
  }

  return partes.length > 0
    ? normalizeExtractedText(partes.join('\n\n'))
    : '';
}

async function extractTextFromPDFData(
  arrayBuffer: ArrayBuffer,
  maxPages: number,
  fileName: string,
  isEdital = false,
  paginasDeOcr?: number,
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, maxPages);
  const pages: string[] = [];
  // Página sem camada de texto num documento que TEM texto nas demais: é o
  // documento misto — processo nato-digital com a ata escaneada no meio. A
  // decisão de OCR era por documento inteiro: bastava a parte nativa render
  // "texto suficiente" para o OCR nunca rodar, e as páginas escaneadas ficarem
  // invisíveis. Foi assim que uma ata de R$ 8.494.080 (no scan) foi cadastrada
  // com o total do processo, R$ 180.624.304 (na parte nativa).
  const paginasSemTexto: number[] = [];

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

    if (text.trim().length >= 50) {
      pages.push(text);
    } else {
      paginasSemTexto.push(i);
      // Marcador no lugar da página: o OCR devolve o texto dela aqui, e a
      // ordem de leitura do documento se preserva.
      pages.push(`\n[página ${i}: digitalizada — texto via OCR abaixo]\n`);
    }
  }

  const extractedText = normalizeExtractedText(pages.join('\n\n'));

  const visionPageLimit = paginasDeOcr ?? (isEdital ? PDF_VISION_PAGE_LIMIT_EDITAL : PDF_VISION_PAGE_LIMIT);
  const docInteiroFraco = isEdital
    ? extractedText.length < 2000
    : shouldUsePdfVisionFallback(extractedText);

  // Sem página escaneada e com texto saudável, não há o que OCR fazer.
  if (!docInteiroFraco && paginasSemTexto.length === 0) {
    return extractedText;
  }

  try {
    // Documento inteiro fraco → OCR do começo, como antes. Documento MISTO →
    // OCR exatamente das páginas sem texto, que são onde o conteúdo se escondeu.
    const alvos = paginasSemTexto.length > 0 && !docInteiroFraco
      ? paginasSemTexto.slice(0, visionPageLimit)
      : Array.from({ length: Math.min(totalPages, visionPageLimit) }, (_, k) => k + 1);

    const pageImages = await renderPdfPagesToVisionInputs(pdf, alvos);
    if (pageImages.length === 0) {
      return extractedText;
    }

    const visionText = await runVisionExtraction(pageImages, fileName);
    const combined = normalizeExtractedText([extractedText, visionText].filter(Boolean).join('\n\n'));
    return combined.length > extractedText.length ? combined : extractedText;
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

async function renderPdfPagesToVisionInputs(pdf: any, paginas: number[]): Promise<VisionImageInput[]> {
  if (typeof document === 'undefined' || paginas.length === 0) {
    return [];
  }

  const results: VisionImageInput[] = [];

  for (const i of paginas) {
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
