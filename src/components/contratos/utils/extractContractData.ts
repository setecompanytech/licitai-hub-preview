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
    // TODO leitor passa pelo extrator da casa — nada de loop pdfjs próprio.
    //
    // Esta função tinha uma CÓPIA do leitor antigo: varria a camada de texto e,
    // só se o documento inteiro fosse fraco, mandava 5 páginas como foto. Num
    // documento misto (processo nato-digital com a ata escaneada no meio), as
    // páginas escaneadas ficavam invisíveis e o servidor recebia texto sem
    // paginação — caía no recorte por caractere e devolvia fragmentos: total de
    // uma parte, itens de outra. O importador foi reformado e este caminho não;
    // o mesmo arquivo lia certo numa tela e errado na outra.
    const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
    const texto = await extractTextFromFile(file, 156, false, 40);

    if (texto.trim().length < 80) return null;

    const { data, error } = await supabase.functions.invoke('extrair-contrato-pdf', {
      body: {
        texto_pdf: texto,
        nome_arquivo: file.name,
        tipo_arquivo: tipoArquivoHint,
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
