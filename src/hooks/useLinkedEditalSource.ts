import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { extractTextFromBlob } from '@/lib/pdf-text-extractor';

type LinkedLicitacao = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string | null;
  valor_estimado: number | null;
  url_edital: string | null;
};

type PncpCacheMatch = {
  ano_compra: string | null;
  cnpj_orgao: string | null;
  link_sistema_origem: string | null;
  numero_controle_pncp: string | null;
  orgao: string | null;
  sequencial_compra: string | null;
  url_pncp: string | null;
};

type ResolveLinkedEditalResult = {
  cacheMatch: PncpCacheMatch | null;
  licitacao: LinkedLicitacao | null;
  source: string;
  text: string;
};

function base64ToBlob(base64: string, contentType = 'application/pdf'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
}

async function extractRemoteUrlText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) return '';

  const blob = await response.blob();
  const fileName = url.split('/').pop()?.split('?')[0] || 'edital';
  return extractTextFromBlob(blob, fileName, 150, true);
}

export function useLinkedEditalSource() {
  const { user } = useAuth();

  const fetchLinkedLicitacao = useCallback(async (licitacaoId: string): Promise<LinkedLicitacao | null> => {
    if (!user || !licitacaoId) return null;

    const { data, error } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, valor_estimado, url_edital')
      .eq('id', licitacaoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar processo vinculado:', error);
      return null;
    }

    return (data as LinkedLicitacao | null) || null;
  }, [user]);

  const findPncpCacheMatch = useCallback(async (
    licitacao: Pick<LinkedLicitacao, 'numero' | 'orgao'>,
  ): Promise<PncpCacheMatch | null> => {
    if (!licitacao.numero) return null;

    const { data, error } = await supabase
      .from('pncp_editais_cache')
      .select('orgao, cnpj_orgao, ano_compra, sequencial_compra, numero_controle_pncp, link_sistema_origem, url_pncp')
      .or(`numero_compra.eq.${licitacao.numero},numero_compra.ilike.%${licitacao.numero}%`)
      .limit(10);

    if (error) {
      console.error('Erro ao localizar edital vinculado no cache:', error);
      return null;
    }

    if (!data?.length) return null;

    const orgaoLower = (licitacao.orgao || '').toLowerCase();
    const best = data.find((row: any) => {
      if (!orgaoLower) return false;
      return (row.orgao || '').toLowerCase().includes(orgaoLower.slice(0, 15));
    }) || data[0];

    return best as PncpCacheMatch;
  }, []);

  const resolveLinkedEditalText = useCallback(async (licitacaoId: string): Promise<ResolveLinkedEditalResult> => {
    if (!user || !licitacaoId) {
      return { licitacao: null, cacheMatch: null, text: '', source: '' };
    }

    const licitacao = await fetchLinkedLicitacao(licitacaoId);
    if (!licitacao) {
      return { licitacao: null, cacheMatch: null, text: '', source: '' };
    }

    const { data: docs, error: docsError } = await supabase
      .from('documentos')
      .select('arquivo_path, nome, created_at')
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (docsError) {
      console.error('Erro ao buscar documentos vinculados:', docsError);
    }

    for (const doc of docs || []) {
      if (!doc.arquivo_path) continue;

      try {
        const { data: fileData, error } = await supabase.storage.from('documentos').download(doc.arquivo_path);
        if (error || !fileData) continue;

        const text = await extractTextFromBlob(fileData, doc.nome || doc.arquivo_path, 150, true);
        if (text.trim().length >= 50) {
          return { licitacao, cacheMatch: null, text, source: 'documento_vinculado' };
        }
      } catch (error) {
        console.error('Erro ao ler documento vinculado do processo:', error);
      }
    }

    const cacheMatch = await findPncpCacheMatch(licitacao);
    const directUrls = Array.from(new Set([
      licitacao.url_edital,
      cacheMatch?.link_sistema_origem,
      cacheMatch?.url_pncp,
    ].filter((value): value is string => Boolean(value && value.trim()))));

    for (const url of directUrls) {
      try {
        const text = await extractRemoteUrlText(url);
        if (text.trim().length >= 50) {
          return { licitacao, cacheMatch, text, source: 'link_vinculado' };
        }
      } catch (error) {
        console.error('Erro ao ler edital pelo link vinculado:', error);
      }
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (token && (licitacao.url_edital || (cacheMatch?.cnpj_orgao && cacheMatch?.ano_compra && cacheMatch?.sequencial_compra))) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-edital`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            numero: licitacao.numero,
            url: licitacao.url_edital || cacheMatch?.link_sistema_origem || cacheMatch?.url_pncp || undefined,
            orgao: licitacao.orgao,
            objeto: licitacao.objeto,
            cnpjOrgao: cacheMatch?.cnpj_orgao || undefined,
            anoCompra: cacheMatch?.ano_compra || undefined,
            sequencialCompra: cacheMatch?.sequencial_compra || undefined,
          }),
        });

        const data = await response.json();

        if (response.ok && data?.success && data.tipo === 'arquivo_direto' && data.arquivo?.conteudo_base64) {
          const blob = base64ToBlob(data.arquivo.conteudo_base64, data.arquivo.content_type || 'application/pdf');
          const text = await extractTextFromBlob(blob, data.arquivo.nome || 'edital.pdf', 150, true);

          if (text.trim().length >= 50) {
            return { licitacao, cacheMatch, text, source: 'download_automatico' };
          }
        }
      }
    } catch (error) {
      console.error('Erro ao baixar edital automaticamente:', error);
    }

    return { licitacao, cacheMatch, text: '', source: '' };
  }, [user, fetchLinkedLicitacao, findPncpCacheMatch]);

  return {
    fetchLinkedLicitacao,
    findPncpCacheMatch,
    resolveLinkedEditalText,
  };
}