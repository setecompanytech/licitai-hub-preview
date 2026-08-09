import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts text from a PDF file (first 50 pages) and runs the
 * `extrair-contrato-pdf` IA edge function. Returns the structured payload
 * (including tipo_documento_detectado and aditivo data) or null on failure.
 * For scanned/image PDFs, falls back to canvas rendering + GPT-4o vision.
 */
export async function extractContractDataFromFile(
  file: File,
  tipoArquivoHint?: string,
): Promise<any | null> {
  try {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    let texto = '';
    const images: { dataUrl: string }[] = [];

    if (isPdf) {
      const pdfjsLib = await import('pdfjs-dist');
      const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        texto += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      if (texto.trim().length < 80) {
        const canvas = document.createElement('canvas');
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          images.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
        }
      }
    } else {
      const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
      texto = await extractTextFromFile(file, 50);
    }

    if (texto.trim().length < 80 && images.length === 0) return null;

    const { data, error } = await supabase.functions.invoke('extrair-contrato-pdf', {
      body: {
        texto_pdf: texto.trim().length >= 80 ? texto : '',
        nome_arquivo: file.name,
        tipo_arquivo: tipoArquivoHint,
        images: images.length > 0 ? images : undefined,
      },
    });
    if (error) throw error;
    if (!data?.success || !data?.data) return null;
    return data.data;
  } catch (e) {
    console.warn('[extractContractDataFromFile]', e);
    return null;
  }
}

/** Maps IA tipo_documento_detectado to the file-type slug used in contrato_arquivos */
export function mapDetectedToFileTipo(detected: string | null | undefined, aditivoTipo?: string | null): string | null {
  if (!detected) return null;
  if (detected === 'ata_srp') return 'ata_srp';
  if (detected === 'contrato') return 'contrato_original';
  if (detected === 'aditivo') {
    switch (aditivoTipo) {
      case 'valor': return 'aditivo_valor';
      case 'quantidade': return 'aditivo_quantidade';
      case 'valor_quantidade': return 'aditivo_valor_quantidade';
      case 'prazo': return 'aditivo_prazo';
      case 'escopo': return 'aditivo_escopo';
      default: return 'aditivo_valor';
    }
  }
  return null;
}
