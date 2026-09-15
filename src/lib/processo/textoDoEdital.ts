import { supabase } from '@/integrations/supabase/client';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';
import { lerEditalAnexado } from '@/lib/processo/edital-anexado';

/**
 * Lê o edital e os anexos do processo e devolve o texto.
 *
 * Extraído de `gerarChecklist`, que já fazia isso, porque a Proposta precisa da
 * mesma leitura: prazo de entrega, local, condições de liquidação e garantia
 * moram no edital e no Termo de Referência. Sem isso, a montagem da proposta
 * pedia upload manual de um documento que o sistema já tem em Anexos — e caía
 * nos valores padrão quando ninguém subia nada.
 *
 * Duas fontes, nesta ordem: o PNCP (espelho oficial) e, quando ele não tem
 * fonte, falha ou não devolve texto, o edital anexado à pasta — o único que
 * existe para processo fora do portal (dispensa no Paradigma, por exemplo).
 *
 * O edital vem primeiro na ordem: quando o conteúdo precisa ser cortado por
 * limite de tamanho, o que fica é o que mais pesa.
 */

export type ProgressoLeitura = (fase: string) => void;

export const MENSAGEM_SEM_EDITAL =
  'Nenhum edital localizado no PNCP nem anexado à pasta. Envie o edital em Anexos › Edital.';

export const MENSAGEM_EDITAL_ILEGIVEL =
  'O edital foi localizado, mas nenhum documento pôde ser lido (PDF digitalizado sem OCR?). Envie uma versão pesquisável em Anexos › Edital.';

/** Extrai a mensagem real de um FunctionsHttpError (o corpo JSON da resposta). */
async function mensagemReal(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    const body = await ctx.json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return fallback;
}

type ArquivoPncp = { sequencial: number; nome?: string; tipo?: string; titulo?: string };

/** Edital primeiro, Termo de Referência em seguida, o resto depois. */
function ordenar(arquivos: ArquivoPncp[]): ArquivoPncp[] {
  const peso = (a: ArquivoPncp) => {
    const t = `${a.tipo || ''} ${a.titulo || ''} ${a.nome || ''}`;
    if (/edital/i.test(t)) return 0;
    if (/(termo\s*de\s*refer|^tr\b|anexo\s*i\b)/i.test(t)) return 1;
    return 2;
  };
  return [...arquivos].sort((a, b) => peso(a) - peso(b));
}

export type LeituraDoEdital = {
  texto: string;
  /** Nomes dos documentos efetivamente lidos — o que sustenta o resultado. */
  lidos: string[];
};

/** Leitura pelo PNCP. Lança quando o processo não tem fonte no portal. */
async function lerDoPncp(
  licitacaoId: string,
  limitePorArquivo: number,
  aoProgredir?: ProgressoLeitura,
): Promise<LeituraDoEdital & { encontrados: number }> {
  aoProgredir?.('Localizando o edital no PNCP…');
  const { data: lista, error: listaErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
    body: { licitacao_id: licitacaoId, action: 'listar' },
  });
  if (listaErr || !lista?.success || !lista?.arquivos?.length) {
    throw new Error(await mensagemReal(listaErr, 'Edital não localizado no PNCP.'));
  }

  const arquivos = ordenar(lista.arquivos as ArquivoPncp[]);
  const partes: string[] = [];
  const lidos: string[] = [];

  for (let i = 0; i < arquivos.length; i++) {
    const arq = arquivos[i];
    const rotulo = arq.titulo || arq.nome || `anexo ${arq.sequencial}`;
    aoProgredir?.(`Lendo documento ${i + 1}/${arquivos.length}: ${rotulo}…`);
    try {
      const { data: abrir, error: abrirErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
        body: { licitacao_id: licitacaoId, action: 'abrir', sequencial: arq.sequencial },
      });
      if (abrirErr || !abrir?.success || !abrir?.path) continue;
      const { data: signed } = await supabase.storage
        .from('processo-arquivos').createSignedUrl(abrir.path, 600);
      if (!signed?.signedUrl) continue;

      const blob = await fetch(signed.signedUrl).then((r) => r.blob());
      // `extractTextFromBlob` abre .zip — formato em que o PNCP publica a
      // maior parte dos editais.
      const bruto = await extractTextFromBlob(blob, abrir.nome || 'documento.pdf', 100, true);
      if (bruto && bruto.trim().length >= 200) {
        const nome = abrir.nome || rotulo;
        lidos.push(nome);
        partes.push(`===== DOCUMENTO: ${nome} =====\n${bruto.slice(0, limitePorArquivo)}`);
      }
    } catch {
      // Anexo ilegível (imagem sem OCR, formato exótico) — segue para o próximo.
    }
  }

  return { texto: partes.join('\n\n'), lidos, encontrados: arquivos.length };
}

export async function lerTextoDoEdital(
  licitacaoId: string,
  opts: { limitePorArquivo?: number; aoProgredir?: ProgressoLeitura } = {},
): Promise<LeituraDoEdital> {
  const { limitePorArquivo = 60_000, aoProgredir } = opts;

  let noPncp = 0;
  try {
    const pncp = await lerDoPncp(licitacaoId, limitePorArquivo, aoProgredir);
    if (pncp.texto.trim()) return { texto: pncp.texto, lidos: pncp.lidos };
    noPncp = pncp.encontrados;
  } catch (e) {
    // Sem fonte no PNCP não é erro para processo fora do portal: a leitura
    // segue para a pasta. O motivo fica no console para quem investigar.
    console.warn('[textoDoEdital] PNCP sem texto, tentando o edital anexado:', e instanceof Error ? e.message : e);
  }

  const anexado = await lerEditalAnexado(licitacaoId, { limitePorArquivo, aoProgredir });
  if (anexado.texto.trim()) return { texto: anexado.texto, lidos: anexado.lidos };

  // Achar arquivo e não conseguir ler é outro problema, com outra saída.
  throw new Error(noPncp + anexado.encontrados > 0 ? MENSAGEM_EDITAL_ILEGIVEL : MENSAGEM_SEM_EDITAL);
}
