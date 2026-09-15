import { supabase } from '@/integrations/supabase/client';

/**
 * Envio de um arquivo para a pasta do processo — o único caminho de escrita.
 *
 * Nasceu fora do `useProcessoWorkspace` porque a pasta manual (Compromissos ›
 * Nova pasta) precisa anexar arquivos a um processo que acabou de nascer, fora
 * da tela da pasta, sem montar o hook inteiro (que carrega anexos e documentos
 * ao montar). Duas cópias da lógica de upload divergiriam no caminho do
 * storage — e é pelo caminho e pela categoria que a extração por IA acha o
 * edital (`edital-auto-ingest` procura `processo_anexos.categoria = 'edital'`).
 *
 * Diferença deliberada em relação à versão que morava no hook: se o arquivo
 * sobe e o registro na tabela falha, o arquivo é removido. Antes ele ficava no
 * bucket sem linha em `processo_anexos` — invisível na aba Anexos, ocupando
 * espaço e impossível de apagar pela interface.
 */

export type CategoriaAnexo = 'edital' | 'habilitacao' | 'proposta' | 'recursos' | 'contrato' | 'declaracoes' | 'outros';

export const BUCKET_PROCESSO = 'processo-arquivos';

export type ParametrosDoEnvio = {
  licitacaoId: string;
  userId: string;
  arquivo: File;
  categoria: CategoriaAnexo;
  descricao?: string;
  metadata?: Record<string, unknown>;
};

export type ResultadoDoEnvio = {
  ok: boolean;
  /** Mensagem real do storage ou do banco — nunca um "erro" genérico. */
  erro?: string;
  /** Em que passo falhou: o arquivo não subiu, ou subiu e não foi registrado. */
  etapa?: 'upload' | 'registro';
  // `select().single()` devolve a linha inteira; o tipo gerado vive no client.
  anexo?: Record<string, unknown>;
};

/** O mesmo saneamento de nome que o hook sempre usou. */
export const nomeSeguro = (nome: string) => nome.replace(/[^\w.-]/g, '_');

export async function enviarAnexoDoProcesso({
  licitacaoId,
  userId,
  arquivo,
  categoria,
  descricao,
  metadata,
}: ParametrosDoEnvio): Promise<ResultadoDoEnvio> {
  const path = `${userId}/${licitacaoId}/${categoria}/${Date.now()}_${nomeSeguro(arquivo.name)}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET_PROCESSO)
    .upload(path, arquivo, { upsert: false });
  if (upErr) {
    return { ok: false, etapa: 'upload', erro: upErr.message || 'falha no envio do arquivo' };
  }

  const { data, error } = await supabase
    .from('processo_anexos')
    .insert({
      licitacao_id: licitacaoId,
      user_id: userId,
      categoria,
      nome_arquivo: arquivo.name,
      storage_path: path,
      mime_type: arquivo.type,
      tamanho_bytes: arquivo.size,
      origem: 'upload',
      descricao: descricao || null,
      metadata: (metadata ?? {}) as never,
    })
    .select()
    .single();

  if (error) {
    // Sem a linha, o arquivo é um órfão que nenhuma tela mostra. A remoção é
    // melhor esforço: se ela também falhar, o erro que importa continua sendo
    // o do registro, e é ele que volta para quem chamou.
    const { error: rmErr } = await supabase.storage.from(BUCKET_PROCESSO).remove([path]);
    if (rmErr) console.error('[enviarAnexoDoProcesso] arquivo órfão não removido', path, rmErr);
    return { ok: false, etapa: 'registro', erro: error.message || 'falha ao registrar o anexo' };
  }

  return { ok: true, anexo: data as Record<string, unknown> };
}
