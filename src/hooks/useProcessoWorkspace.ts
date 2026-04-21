import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type CategoriaAnexo = 'edital' | 'habilitacao' | 'proposta' | 'recursos' | 'contrato' | 'declaracoes' | 'outros';

export interface ProcessoAnexo {
  id: string;
  licitacao_id: string;
  user_id: string;
  categoria: CategoriaAnexo;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessoDocumento {
  id: string;
  licitacao_id: string;
  tipo: string;
  titulo: string;
  conteudo_html: string | null;
  versao: number;
  status: string;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'processo-arquivos';

export function useProcessoWorkspace(licitacaoId: string | null) {
  const { user } = useAuth();
  const [anexos, setAnexos] = useState<ProcessoAnexo[]>([]);
  const [documentos, setDocumentos] = useState<ProcessoDocumento[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!licitacaoId || !user) return;
    setLoading(true);
    const [a, d] = await Promise.all([
      supabase.from('processo_anexos').select('*').eq('licitacao_id', licitacaoId).order('created_at', { ascending: false }),
      supabase.from('processo_documentos').select('*').eq('licitacao_id', licitacaoId).order('updated_at', { ascending: false }),
    ]);
    setAnexos((a.data || []) as ProcessoAnexo[]);
    setDocumentos((d.data || []) as ProcessoDocumento[]);
    setLoading(false);
  }, [licitacaoId, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const uploadAnexo = useCallback(async (file: File, categoria: CategoriaAnexo, descricao?: string) => {
    if (!licitacaoId || !user) return null;
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const path = `${user.id}/${licitacaoId}/${categoria}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (upErr) { toast.error('Erro ao enviar arquivo: ' + upErr.message); return null; }
    const { data, error } = await supabase.from('processo_anexos').insert({
      licitacao_id: licitacaoId, user_id: user.id, categoria, nome_arquivo: file.name,
      storage_path: path, mime_type: file.type, tamanho_bytes: file.size, origem: 'upload', descricao: descricao || null,
    }).select().single();
    if (error) { toast.error('Erro ao registrar anexo'); return null; }
    toast.success('Arquivo enviado');
    fetchAll();
    return data;
  }, [licitacaoId, user, fetchAll]);

  const downloadAnexo = useCallback(async (anexo: ProcessoAnexo) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.storage_path, 60);
    if (error || !data) { toast.error('Erro ao gerar link'); return; }
    window.open(data.signedUrl, '_blank');
  }, []);

  const deleteAnexo = useCallback(async (anexo: ProcessoAnexo) => {
    await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
    await supabase.from('processo_anexos').delete().eq('id', anexo.id);
    toast.success('Arquivo removido');
    fetchAll();
  }, [fetchAll]);

  const criarDocumento = useCallback(async (tipo: string, titulo: string, conteudoHtml = '') => {
    if (!licitacaoId || !user) return null;
    const { data, error } = await supabase.from('processo_documentos').insert({
      licitacao_id: licitacaoId, user_id: user.id, tipo, titulo, conteudo_html: conteudoHtml, versao: 1, status: 'rascunho',
    }).select().single();
    if (error) { toast.error('Erro ao criar documento'); return null; }
    toast.success('Documento criado');
    fetchAll();
    return data as ProcessoDocumento;
  }, [licitacaoId, user, fetchAll]);

  const salvarDocumento = useCallback(async (id: string, conteudoHtml: string, titulo?: string) => {
    if (!user) return;
    // snapshot atual
    const atual = documentos.find(d => d.id === id);
    if (atual) {
      await supabase.from('processo_documentos_versoes').insert({
        documento_id: id, user_id: user.id, versao: atual.versao, conteudo_html: atual.conteudo_html,
      });
    }
    await supabase.from('processo_documentos').update({
      conteudo_html: conteudoHtml,
      ...(titulo ? { titulo } : {}),
      versao: (atual?.versao || 1) + 1,
    }).eq('id', id);
    toast.success('Documento salvo (nova versão)');
    fetchAll();
  }, [user, documentos, fetchAll]);

  const deleteDocumento = useCallback(async (id: string) => {
    await supabase.from('processo_documentos').delete().eq('id', id);
    toast.success('Documento excluído');
    fetchAll();
  }, [fetchAll]);

  return { anexos, documentos, loading, uploadAnexo, downloadAnexo, deleteAnexo, criarDocumento, salvarDocumento, deleteDocumento, refresh: fetchAll };
}
