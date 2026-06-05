import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts text from a PDF file (first 50 pages) and runs the
 * `extrair-contrato-pdf` IA edge function. Returns the structured payload
 * (including tipo_documento_detectado and aditivo data) or null on failure.
 */
export async function extractContractDataFromFile(
  file: File,
  tipoArquivoHint?: string,
): Promise<any | null> {
  try {
    const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
    const texto = await extractTextFromFile(file, 50);

    if (texto.trim().length < 80) return null;

    const { data, error } = await supabase.functions.invoke('extrair-contrato-pdf', {
      body: { texto_pdf: texto, nome_arquivo: file.name, tipo_arquivo: tipoArquivoHint },
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
