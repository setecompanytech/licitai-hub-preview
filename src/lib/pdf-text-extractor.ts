/**
 * Extracts readable text from files/blobs (PDF, DOC, DOCX, TXT).
 * Keeps more of the original line structure to improve edital item extraction fidelity.
 */
const DEFAULT_MAX_PAGES = 150;

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromFile(file: File, maxPages = DEFAULT_MAX_PAGES): Promise<string> {
  return extractTextFromBlob(file, file.name, maxPages);
}

export async function extractTextFromBlob(
  blob: Blob,
  fileName = 'documento.pdf',
  maxPages = DEFAULT_MAX_PAGES
): Promise<string> {
  const name = fileName.toLowerCase();
  const type = blob.type.toLowerCase();

  if (name.endsWith('.txt') || type.startsWith('text/')) {
    return normalizeExtractedText(await blob.text());
  }

  if (name.endsWith('.pdf') || type.includes('pdf')) {
    return extractTextFromPDFData(await blob.arrayBuffer(), maxPages);
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

  return normalizeExtractedText(await blob.text());
}

async function extractTextFromPDFData(arrayBuffer: ArrayBuffer, maxPages: number): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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

  return normalizeExtractedText(pages.join('\n\n'));
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
