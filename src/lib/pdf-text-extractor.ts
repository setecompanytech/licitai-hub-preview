/**
 * Extracts readable text from a file (PDF, DOC, DOCX, TXT).
 * For PDFs, uses pdfjs-dist to properly parse the binary content.
 * For text files, uses file.text().
 */
export async function extractTextFromFile(file: File, maxPages = 50): Promise<string> {
  const name = file.name.toLowerCase();

  // Plain text files
  if (name.endsWith('.txt')) {
    return file.text();
  }

  // PDF files - must use pdfjs-dist
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return extractTextFromPDF(file, maxPages);
  }

  // DOC/DOCX - try text extraction (limited but better than nothing)
  if (name.endsWith('.doc') || name.endsWith('.docx')) {
    // For DOCX, we can try basic text extraction from the XML inside the zip
    try {
      return await extractTextFromDocx(file);
    } catch {
      // Fallback: try raw text (may work for older .doc)
      return file.text();
    }
  }

  // Fallback
  return file.text();
}

async function extractTextFromPDF(file: File, maxPages: number): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = Math.min(pdf.numPages, maxPages);
  const pages: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ');
    if (text.trim()) {
      pages.push(text);
    }
  }

  return pages.join('\n\n');
}

async function extractTextFromDocx(file: File): Promise<string> {
  // DOCX is a ZIP containing XML files
  const JSZip = (await import('jszip')).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const docXml = await zip.file('word/document.xml')?.async('text');
  if (!docXml) {
    throw new Error('Not a valid DOCX file');
  }
  
  // Strip XML tags to get plain text
  const text = docXml
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<w:p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
