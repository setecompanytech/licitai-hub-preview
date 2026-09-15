import { supabase } from '@/integrations/supabase/client';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';

/**
 * Lê o edital que a pessoa ANEXOU à pasta do processo (Anexos › Edital).
 *
 * Processo fora do PNCP — dispensa no Paradigma do Banpará, por exemplo — não
 * tem de onde o `pncp-arquivos-edital` baixar nada. O edital desses processos
 * mora em `processo_anexos` (categoria 'edital', bucket `processo-arquivos`), e
 * checklist, proposta e robô precisam lê-lo de lá, com os mesmos critérios de
 * leitura do espelho PNCP (`textoDoEdital`).
 *
 * A consulta roda com a sessão de quem abriu a pasta: o RLS de
 * `processo_anexos` é por `user_id`, então o anexo de um colega não aparece.
 */

export type TipoDocumentoEdital = 'edital' | 'termo_referencia' | 'anexo_edital';

export const ROTULO_TIPO_EDITAL: Record<TipoDocumentoEdital, string> = {
  edital: 'Edital',
  termo_referencia: 'Termo de Referência',
  anexo_edital: 'Anexo do edital',
};

const BUCKET = 'processo-arquivos';
/** Mesmo corte do `textoDoEdital`: abaixo disso é capa, índice ou PDF sem OCR. */
const TAMANHO_MINIMO = 200;
const PAGINAS_POR_ARQUIVO = 100;

type AnexoEdital = {
  id: string;
  nome_arquivo: string | null;
  storage_path: string;
  descricao: string | null;
  metadata: unknown;
  created_at: string;
};

export type LeituraDoEditalAnexado = {
  texto: string;
  /** Nomes dos documentos efetivamente lidos — o que sustenta o resultado. */
  lidos: string[];
  /** Quantos anexos a pasta Edital tinha, lidos ou não. */
  encontrados: number;
};

const RE_EDITAL = /edital/i;
const RE_TERMO_REFERENCIA = /termo\s*de\s*refer|(^|[^a-z0-9])tr([^a-z0-9]|$)/i;

/** Classificação pelo nome ou descrição — para anexos sem `metadata.tipo`. */
export function tipoPeloNome(texto: string): TipoDocumentoEdital | null {
  if (RE_TERMO_REFERENCIA.test(texto)) return 'termo_referencia';
  if (/anexo/i.test(texto)) return 'anexo_edital';
  if (RE_EDITAL.test(texto)) return 'edital';
  return null;
}

const PESO_TIPO: Record<TipoDocumentoEdital, number> = { edital: 0, termo_referencia: 1, anexo_edital: 2 };

function tipoDeclarado(a: AnexoEdital): TipoDocumentoEdital | null {
  const t = (a.metadata as { tipo?: unknown } | null)?.tipo;
  return typeof t === 'string' && t in PESO_TIPO ? (t as TipoDocumentoEdital) : null;
}

/**
 * Edital → Termo de Referência → anexo, e o mais recente desempata. O tipo vem
 * de `metadata.tipo` quando declarado e, nos anexos antigos sem tipo, da mesma
 * leitura do nome que o diálogo da pasta usa para sugerir (`tipoPeloNome`):
 * um "edital.pdf" enviado antes da marcação de tipo existir pesa como edital,
 * e não atrás de um anexo que só é "anexo" porque foi marcado. Sem pista
 * nenhuma, vai para o fim. O edital vem primeiro porque, quando o texto é
 * cortado mais adiante, o que fica é o que mais pesa.
 */
function peso(a: AnexoEdital): number {
  const tipo = tipoDeclarado(a) ?? tipoPeloNome(`${a.nome_arquivo || ''} ${a.descricao || ''}`);
  return tipo ? PESO_TIPO[tipo] : 3;
}

export function ordenarAnexosDoEdital<T extends AnexoEdital>(anexos: T[]): T[] {
  return [...anexos].sort((a, b) => peso(a) - peso(b) || (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function lerEditalAnexado(
  licitacaoId: string,
  opts: { limitePorArquivo?: number; aoProgredir?: (fase: string) => void } = {},
): Promise<LeituraDoEditalAnexado> {
  const { limitePorArquivo = 60_000, aoProgredir } = opts;

  aoProgredir?.('Lendo o edital anexado na pasta…');
  const { data, error } = await supabase
    .from('processo_anexos')
    .select('id, nome_arquivo, storage_path, descricao, metadata, created_at')
    .eq('licitacao_id', licitacaoId)
    .eq('categoria', 'edital')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Não foi possível listar os anexos da pasta Edital: ${error.message}`);

  const anexos = ordenarAnexosDoEdital((data || []) as AnexoEdital[]);
  const partes: string[] = [];
  const lidos: string[] = [];

  for (let i = 0; i < anexos.length; i++) {
    const anexo = anexos[i];
    const nome = anexo.nome_arquivo || anexo.storage_path.split('/').pop() || 'documento.pdf';
    aoProgredir?.(`Lendo o edital anexado na pasta (${i + 1}/${anexos.length}): ${nome}…`);
    try {
      const { data: assinada } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.storage_path, 600);
      if (!assinada?.signedUrl) continue;
      const resposta = await fetch(assinada.signedUrl);
      if (!resposta.ok) continue;
      const blob = await resposta.blob();
      const bruto = await extractTextFromBlob(blob, nome, PAGINAS_POR_ARQUIVO, true);
      if (bruto && bruto.trim().length >= TAMANHO_MINIMO) {
        lidos.push(nome);
        partes.push(`===== DOCUMENTO: ${nome} =====\n${bruto.slice(0, limitePorArquivo)}`);
      }
    } catch {
      // Anexo ilegível (imagem sem OCR, formato exótico) — segue para o próximo.
    }
  }

  return { texto: partes.join('\n\n'), lidos, encontrados: anexos.length };
}

/** A pasta tem algum arquivo na categoria Edital? Consulta leve, sem baixar nada. */
export async function temEditalAnexado(licitacaoId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('processo_anexos')
    .select('id', { count: 'exact', head: true })
    .eq('licitacao_id', licitacaoId)
    .eq('categoria', 'edital');
  if (error) throw new Error(`Não foi possível verificar o edital anexado: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Aviso entre telas irmãs da pasta: o card da preparação e o gerenciador de
 * anexos têm cada um a sua consulta, e o card dizia "Sem edital" logo depois
 * de a pessoa enviar o edital na mesma página.
 */
const EVENTO_ANEXOS_ALTERADOS = 'processo-anexos-alterados';

export function avisarAnexosAlterados(licitacaoId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENTO_ANEXOS_ALTERADOS, { detail: { licitacaoId } }));
}

export function aoAlterarAnexos(licitacaoId: string, cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const ouvinte = (e: Event) => {
    if ((e as CustomEvent<{ licitacaoId?: string }>).detail?.licitacaoId === licitacaoId) cb();
  };
  window.addEventListener(EVENTO_ANEXOS_ALTERADOS, ouvinte);
  return () => window.removeEventListener(EVENTO_ANEXOS_ALTERADOS, ouvinte);
}
