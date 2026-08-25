import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { mensagemDeErro } from '@/lib/financeiro/erro-do-banco';

/**
 * O arquivo fiscal, guardado.
 *
 * A regra de ordem aqui é a única coisa que importa: o arquivo sobe ANTES de
 * a leitura automática rodar. A leitura pode falhar — a IA pode não achar a
 * chave, o PDF pode ser um escaneado ruim, a rede pode cair no meio. Se o
 * envio dependesse do sucesso da leitura, exatamente os documentos difíceis
 * seriam os que se perderiam, e são justamente esses que alguém vai querer
 * reabrir depois para conferir à mão.
 *
 * A chegada do documento é um fato; o conteúdo dele é uma interpretação. São
 * dois momentos, e o primeiro não pode depender do segundo.
 */

export type DocumentoFiscalSalvo = {
  id: string;
  storage_path: string;
  arquivo_nome: string;
};

export function useDocumentoFiscal() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  /**
   * Sobe o arquivo e registra o documento. Devolve `null` em caso de falha —
   * com toast já disparado por quem chama, porque só ele sabe se a falha é
   * fatal para o fluxo ou apenas priva o usuário do anexo.
   */
  const guardarArquivo = useCallback(async (
    file: File,
    extras?: {
      tipo?: string;
      numero?: string | null;
      serie?: string | null;
      chave_acesso?: string | null;
      data_emissao?: string | null;
      valor_total?: number | null;
      lancamento_id?: string | null;
      ocr_data?: unknown;
      arquivo_xml?: string | null;
    },
  ): Promise<DocumentoFiscalSalvo | null> => {
    if (!empresaAtiva?.id) return null;

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
    const ano = (extras?.data_emissao ?? new Date().toISOString()).slice(0, 4);
    // A empresa é a PRIMEIRA pasta — é ela que a política do bucket confere.
    // Documento fiscal é da empresa, não de quem fez o upload: isolar por
    // usuário deixaria a nota que o contador subiu invisível para o sócio.
    const path = `${empresaAtiva.id}/${ano}/${crypto.randomUUID()}.${ext}`;

    const { error: erroUpload } = await supabase.storage
      .from('financeiro-documentos')
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (erroUpload) {
      console.error('[documento-fiscal] falha no upload:', erroUpload);
      return null;
    }

    const { data, error } = await supabase
      .from('financeiro_documentos_fiscais' as never)
      .insert({
        empresa_id: empresaAtiva.id,
        tipo: extras?.tipo ?? 'outro',
        numero: extras?.numero ?? null,
        serie: extras?.serie ?? null,
        chave_acesso: extras?.chave_acesso ?? null,
        data_emissao: extras?.data_emissao ?? null,
        valor_total: extras?.valor_total ?? 0,
        lancamento_id: extras?.lancamento_id ?? null,
        arquivo_xml: extras?.arquivo_xml ?? null,
        ocr_data: (extras?.ocr_data ?? null) as never,
        storage_path: path,
        arquivo_nome: file.name,
        arquivo_mime: file.type || null,
        arquivo_bytes: file.size,
        enviado_por: user?.id ?? null,
        origem: 'ocr',
      } as never)
      .select('id, storage_path, arquivo_nome')
      .single();

    if (error) {
      // O arquivo já está no bucket. Deixá-lo lá órfão é melhor do que apagar:
      // o registro pode ser refeito, o documento do cliente não.
      console.error('[documento-fiscal] arquivo enviado mas não registrado:', mensagemDeErro(error));
      return null;
    }
    return data as unknown as DocumentoFiscalSalvo;
  }, [empresaAtiva?.id, user?.id]);

  /** Amarra o documento ao lançamento depois que ele nasce. */
  const vincularLancamento = useCallback(async (documentoId: string, lancamentoId: string) => {
    const { error } = await supabase
      .from('financeiro_documentos_fiscais' as never)
      .update({ lancamento_id: lancamentoId } as never)
      .eq('id', documentoId);
    if (error) console.error('[documento-fiscal] falha ao vincular:', mensagemDeErro(error));
  }, []);

  /** Abre o arquivo guardado. URL assinada, porque o bucket é privado. */
  const abrirArquivo = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('financeiro-documentos')
      .createSignedUrl(storagePath, 300);
    if (error) {
      console.error('[documento-fiscal] falha ao gerar link:', error);
      return null;
    }
    return data?.signedUrl ?? null;
  }, []);

  return { guardarArquivo, vincularLancamento, abrirArquivo };
}
