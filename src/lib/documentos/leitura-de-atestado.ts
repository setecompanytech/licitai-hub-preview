import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Preparo do atestado para a leitura por IA — o que vai no corpo da edge
 * `extrair-atestado-capacidade`.
 *
 * Mora fora da tela porque não é assunto de tela: são canvas, pdf.js e os
 * TETOS do contrato da edge (3 páginas de PDF, no máximo 4 imagens, texto de
 * apoio aparado). Estourar qualquer um deles não dá erro bonito — dá timeout
 * ou resposta vazia, e a pessoa conclui que "a IA não leu o documento".
 *
 * O texto de apoio acompanha as imagens de propósito: PDF gerado por editor
 * tem a camada de texto certa, e ela corrige o que a leitura visual erraria
 * (CNPJ, valores). PDF escaneado não tem nenhuma, e aí só a imagem responde.
 */

export type VisionImage = {
  name: string;
  dataUrl: string;
};

export type DocumentAnalysisPayload = {
  images: VisionImage[];
  supportText: string;
};

/** Páginas de PDF lidas e teto de imagens — contrato da edge, não preferência. */
const MAX_PAGINAS_PDF = 3;
const MAX_IMAGENS = 4;

export const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const imageFileToVisionPayload = async (file: File): Promise<VisionImage[]> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        // Foto de celular chega com 4000px de lado; o modelo não lê melhor por
        // isso e o payload em base64 estoura o limite da requisição.
        const maxDimension = 1800;
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível preparar a imagem para análise.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve([{ name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }]);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível abrir a imagem enviada.'));
    };

    img.src = objectUrl;
  });

/**
 * O pedaço do pdf.js que este preparo usa, escrito à mão.
 *
 * Os tipos publicados pela biblioteca descrevem muito mais do que isto (e um
 * `items` que mistura texto com marcação), então o código vivia de `any` — e
 * `any` some com a checagem justamente onde o formato do documento varia. A
 * conversão fica num ponto só, no `getDocument`; daqui para dentro há contrato.
 */
type VisorPdf = { width: number; height: number };
type PaginaPdf = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  getViewport: (params: { scale: number }) => VisorPdf;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: VisorPdf }) => { promise: Promise<void> };
};
type DocumentoPdf = { numPages: number; getPage: (numero: number) => Promise<PaginaPdf> };

const extractPdfSupportText = async (pdf: DocumentoPdf, maxPages: number) => {
  const pageTexts: string[] = [];

  for (let i = 1; i <= maxPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str ?? '').join(' ');

    pageTexts.push(pageText);
  }

  return normalizeWhitespace(pageTexts.join('\n'));
};

const renderPdfToVisionImages = async (
  pdf: DocumentoPdf,
  fileName: string,
  maxPages: number,
): Promise<VisionImage[]> => {
  const images: VisionImage[] = [];

  for (let i = 1; i <= maxPages && images.length < MAX_IMAGENS; i += 1) {
    const page = await pdf.getPage(i);
    const firstViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      1.5,
      1600 / Math.max(firstViewport.width, 1),
      1600 / Math.max(firstViewport.height, 1),
    );
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push({
      name: `${fileName}_p${i}`,
      dataUrl: canvas.toDataURL('image/jpeg', 0.88),
    });
  }

  return images;
};

/** Imagem ou PDF → imagens + texto de apoio. Formato desconhecido volta vazio. */
export const buildDocumentAnalysisPayload = async (file: File): Promise<DocumentAnalysisPayload> => {
  if (file.type.startsWith('image/')) {
    return {
      images: await imageFileToVisionPayload(file),
      supportText: '',
    };
  }

  if (file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    const arrayBuffer = await file.arrayBuffer();
    let pdf: DocumentoPdf;

    try {
      pdf = (await pdfjsLib.getDocument({ data: arrayBuffer }).promise) as unknown as DocumentoPdf;
    } catch {
      // Contingência para ambiente que bloqueia Worker. `disableWorker` não
      // está nos tipos publicados, daí a conversão explícita.
      const semWorker = { data: arrayBuffer, disableWorker: true } as Parameters<typeof pdfjsLib.getDocument>[0];
      pdf = (await pdfjsLib.getDocument(semWorker).promise) as unknown as DocumentoPdf;
    }

    const maxPages = Math.min(pdf.numPages, MAX_PAGINAS_PDF);
    const [supportText, images] = await Promise.all([
      extractPdfSupportText(pdf, maxPages),
      renderPdfToVisionImages(pdf, file.name, maxPages),
    ]);

    return { images, supportText };
  }

  return { images: [], supportText: '' };
};
