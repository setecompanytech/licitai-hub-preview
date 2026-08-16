import { supabase } from '@/integrations/supabase/client';
import type { CategoriaAnexo } from '@/hooks/useProcessoWorkspace';

/**
 * Arquiva na pasta do processo o documento que um módulo acabou de produzir.
 *
 * Sem isto, cada módulo terminava no vazio: a proposta ficava pronta e só
 * existia como download no computador do usuário; a peça jurídica idem. A
 * pasta do processo é o destino — Proposta vai para a pasta Proposta, recurso
 * para Recursos, declaração para Declarações, e assim por diante.
 */

const BUCKET = 'processo-arquivos';

/** Chave de storage só aceita [\w.-]: o nome bonito vive em nome_arquivo. */
const chaveSegura = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]/g, '_');

/** Resultado plano (o projeto não usa strictNullChecks — união discriminada
 *  não estreitaria no consumidor). */
export type ResultadoArquivamento = { ok: boolean; nome?: string; erro?: string };

export async function salvarNaPastaDoProcesso(opts: {
  licitacaoId: string;
  categoria: CategoriaAnexo;
  nomeArquivo: string;
  blob: Blob;
  descricao?: string;
  metadata?: Record<string, unknown>;
  /** Substitui versão anterior de mesmo nome nesta pasta (padrão: true). */
  substituir?: boolean;
}): Promise<ResultadoArquivamento> {
  const { licitacaoId, categoria, nomeArquivo, blob, descricao, metadata, substituir = true } = opts;
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return { ok: false, erro: 'Sessão expirada — entre novamente.' };

    if (substituir) {
      const { data: antigos } = await supabase
        .from('processo_anexos')
        .select('id, storage_path')
        .eq('licitacao_id', licitacaoId)
        .eq('categoria', categoria)
        .eq('nome_arquivo', nomeArquivo);
      if (antigos?.length) {
        await supabase.storage.from(BUCKET).remove(antigos.map((a) => a.storage_path));
        await supabase.from('processo_anexos').delete().in('id', antigos.map((a) => a.id));
      }
    }

    const path = `${u.user.id}/${licitacaoId}/${categoria}/${Date.now()}_${chaveSegura(nomeArquivo)}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) return { ok: false, erro: `upload: ${upErr.message}` };

    const { error: insErr } = await supabase.from('processo_anexos').insert({
      licitacao_id: licitacaoId,
      user_id: u.user.id,
      categoria,
      nome_arquivo: nomeArquivo,
      storage_path: path,
      mime_type: blob.type || 'application/octet-stream',
      tamanho_bytes: blob.size,
      origem: 'gerado',
      descricao: descricao || null,
      metadata: (metadata ?? {}) as never,
    });
    if (insErr) return { ok: false, erro: `registro: ${insErr.message}` };

    // Trilha de auditoria — o documento entrou na pasta, isso é fato do processo
    const { data: lic } = await supabase.from('licitacoes').select('empresa_id').eq('id', licitacaoId).maybeSingle();
    await supabase.from('atividades_colaborador').insert({
      user_id: u.user.id,
      empresa_id: lic?.empresa_id ?? null,
      acao: 'documento_arquivado',
      modulo: 'licitacoes',
      descricao: `Documento arquivado na pasta ${categoria}: ${nomeArquivo}`,
      metadata: { licitacao_id: licitacaoId, categoria, nome_arquivo: nomeArquivo },
    });

    return { ok: true, nome: nomeArquivo };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'erro inesperado' };
  }
}

/**
 * Pasta de destino de cada peça do Apoio Jurídico, pela categoria do modelo.
 * As funções da aba Módulos escrevem nas pastas correspondentes do processo.
 */
export function pastaDaPecaJuridica(categoria: string | null | undefined): CategoriaAnexo {
  const c = (categoria || '').toLowerCase();
  if (/recurso|impugna|esclarecim|represent|defesa|judicial|mandado/.test(c)) return 'recursos';
  if (/declara/.test(c)) return 'declaracoes';
  if (/contrato|aditivo|reequil/.test(c)) return 'contrato';
  if (/proposta/.test(c)) return 'proposta';
  return 'outros';
}
