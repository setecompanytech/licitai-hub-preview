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
  aoProgredir?: (msg: string) => void,
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
    const texto = await extractTextFromFile(file, 156, false, 40, aoProgredir);
    aoProgredir?.('Estruturando os dados lidos…');

    if (texto.trim().length < 80) {
      ultimoErroDeExtracao = 'O documento não rendeu texto legível, nem por OCR.';
      return null;
    }

    // Mesma reversão automática do importador: o limite por minuto (429) é o
    // erro NORMAL logo após o OCR de um documento grande, e se resolve
    // esperando. E o motivo REAL fica em error.context — sem lê-lo, todo erro
    // vira um null mudo e o usuário recebe "não foi possível" sem porquê.
    const chamar = () => supabase.functions.invoke('extrair-contrato-pdf', {
      body: { texto_pdf: texto, nome_arquivo: file.name, tipo_arquivo: tipoArquivoHint },
    });

    let resposta = await chamar();
    for (let tentativa = 1; resposta.error && tentativa <= 2; tentativa++) {
      const st = (resposta.error as { context?: Response }).context?.status ?? 0;
      if (st !== 429 && st !== 502 && st !== 503 && st !== 504) break;
      await new Promise((r) => setTimeout(r, 20000));
      resposta = await chamar();
    }

    if (resposta.error) {
      const ctx = (resposta.error as { context?: Response }).context;
      let motivo = resposta.error.message;
      try {
        const corpo = ctx ? await ctx.clone().json() : null;
        if (corpo?.error) motivo = String(corpo.error);
      } catch { /* corpo não era JSON */ }
      ultimoErroDeExtracao = motivo;
      return null;
    }
    if (!resposta.data?.success || !resposta.data?.data) {
      ultimoErroDeExtracao = String(resposta.data?.error || 'A IA não devolveu dados estruturados.');
      return null;
    }
    ultimoErroDeExtracao = null;
    return resposta.data.data;
  } catch (e) {
    ultimoErroDeExtracao = e instanceof Error ? e.message : 'Erro inesperado na leitura.';
    console.warn('[extractContractDataFromFile]', e);
    return null;
  }
}

/**
 * Por que a última leitura falhou — para o chamador dizer ao usuário o motivo
 * em vez de "não foi possível". Nulo quando a última leitura deu certo.
 */
export let ultimoErroDeExtracao: string | null = null;
export function motivoDaUltimaFalha(): string | null {
  return ultimoErroDeExtracao;
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
