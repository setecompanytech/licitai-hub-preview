import { supabase } from '@/integrations/supabase/client';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';

/**
 * Lê o edital e os anexos do processo, direto do PNCP, e devolve o texto.
 *
 * Extraído de `gerarChecklist`, que já fazia isso, porque a Proposta precisa da
 * mesma leitura: prazo de entrega, local, condições de liquidação e garantia
 * moram no edital e no Termo de Referência. Sem isso, a montagem da proposta
 * pedia upload manual de um documento que o sistema já tem em Anexos — e caía
 * nos valores padrão quando ninguém subia nada.
 *
 * O edital vem primeiro na ordem: quando o conteúdo precisa ser cortado por
 * limite de tamanho, o que fica é o que mais pesa.
 */

export type ProgressoLeitura = (fase: string) => void;

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

export async function lerTextoDoEdital(
  licitacaoId: string,
  opts: { limitePorArquivo?: number; aoProgredir?: ProgressoLeitura } = {},
): Promise<LeituraDoEdital> {
  const { limitePorArquivo = 60_000, aoProgredir } = opts;

  aoProgredir?.('Localizando o edital no PNCP…');
  const { data: lista, error: listaErr } = await supabase.functions.invoke('pncp-arquivos-edital', {
    body: { licitacao_id: licitacaoId, action: 'listar' },
  });
  if (listaErr || !lista?.success || !lista?.arquivos?.length) {
    throw new Error(await mensagemReal(
      listaErr,
      'Edital não localizado no PNCP — confira o "Edital em tela" em Anexos.',
    ));
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

  return { texto: partes.join('\n\n'), lidos };
}
