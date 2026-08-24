import { supabase } from '@/integrations/supabase/client';

export type VisionImagePayload = {
  name: string;
  dataUrl: string;
};

/** Quantas páginas cabem numa chamada sem estourar o payload da função. */
const PAGINAS_POR_LOTE = 4;

export async function extractTextFromVisionImages(
  images: VisionImagePayload[],
  fileName: string,
): Promise<string> {
  const validas = images.filter((image) => image.dataUrl.startsWith('data:image/'));
  if (validas.length === 0) return '';

  // Antes havia um `slice(0, 4)`: de um documento escaneado de 40 páginas, só 4
  // iam ao OCR e as demais sumiam SEM AVISO — o chamador recebia texto e não
  // tinha como saber que era um décimo do documento. Truncar em silêncio é o
  // defeito; o tamanho da chamada continua limitado, mas por LOTES sequenciais
  // que cobrem o documento inteiro.
  const partes: string[] = [];
  for (let i = 0; i < validas.length; i += PAGINAS_POR_LOTE) {
    const lote = validas.slice(i, i + PAGINAS_POR_LOTE);
    let { data, error } = await supabase.functions.invoke('document-vision-extract', {
      body: { fileName, images: lote },
    });
    // O limite por minuto do provedor é o erro NORMAL de um documento grande:
    // dezenas de lotes em sequência esbarram nele no meio. Sem esta espera, um
    // 429 no lote 3 jogava fora o documento inteiro.
    const st = (error as { context?: Response } | null)?.context?.status ?? 0;
    if (error && (st === 429 || st === 502 || st === 503 || st === 504)) {
      await new Promise((r) => setTimeout(r, 20000));
      ({ data, error } = await supabase.functions.invoke('document-vision-extract', {
        body: { fileName, images: lote },
      }));
    }
    if (error) {
      // Falha no meio não joga fora o que já foi lido: devolve o parcial com a
      // falha declarada, para o chamador decidir.
      if (partes.length > 0) {
        partes.push(`[OCR interrompido na página ${i + 1}: ${error.message}]`);
        break;
      }
      throw new Error(error.message);
    }
    if (typeof data?.text === 'string' && data.text.trim()) partes.push(data.text.trim());
  }

  return partes.join('\n\n');
}