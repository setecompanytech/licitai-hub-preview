import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SugestaoMarca {
  id: string;
  licitacao_id: string;
  licitacao_item_id: string | null;
  descricao_item: string;
  marca_sugerida: string;
  fabricante_sugerido: string | null;
  modelo_sugerido: string | null;
  fonte: string;
  fonte_detalhe: string | null;
  orgao_origem: string | null;
  numero_processo_origem: string | null;
  preco_historico: number | null;
  preco_cotacao_atual: number | null;
  score_confianca: number;
  ranking: number;
  status: string;
  justificativa_ia: string | null;
  aceito_em: string | null;
  created_at: string;
}

export function useSugestaoMarcas() {
  const { user } = useAuth();
  const [sugestoes, setSugestoes] = useState<SugestaoMarca[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchSugestoes = useCallback(async (licitacaoId: string) => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('sugestoes_marca_modelo')
      .select('*')
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user.id)
      .order('descricao_item')
      .order('ranking', { ascending: true });

    if (error) {
      console.error('Erro ao buscar sugestões:', error);
      return [];
    }
    const typed = (data as unknown as SugestaoMarca[]) || [];
    setSugestoes(typed);
    return typed;
  }, [user]);

  const gerarSugestoes = useCallback(async (
    licitacaoId: string,
    itens: Array<{ id?: string; numero?: number; descricao: string; quantidade?: number; unidade?: string; valor_unitario?: number }>
  ) => {
    if (!user || !itens.length) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('sugerir-marcas', {
        body: { licitacao_id: licitacaoId, itens },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar sugestões');

      toast.success(`${data.total_sugestoes} sugestões geradas para ${data.itens_analisados} itens!`);
      await fetchSugestoes(licitacaoId);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao gerar sugestões';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [user, fetchSugestoes]);

  const aceitarSugestao = useCallback(async (sugestaoId: string) => {
    const { error } = await supabase
      .from('sugestoes_marca_modelo')
      .update({ status: 'aceito', aceito_em: new Date().toISOString() } as any)
      .eq('id', sugestaoId);

    if (error) {
      toast.error('Erro ao aceitar sugestão');
      return false;
    }
    setSugestoes(prev => prev.map(s =>
      s.id === sugestaoId ? { ...s, status: 'aceito', aceito_em: new Date().toISOString() } : s
    ));
    return true;
  }, []);

  const rejeitarSugestao = useCallback(async (sugestaoId: string) => {
    const { error } = await supabase
      .from('sugestoes_marca_modelo')
      .update({ status: 'rejeitado' } as any)
      .eq('id', sugestaoId);

    if (error) {
      toast.error('Erro ao rejeitar sugestão');
      return false;
    }
    setSugestoes(prev => prev.map(s =>
      s.id === sugestaoId ? { ...s, status: 'rejeitado' } : s
    ));
    return true;
  }, []);

  const aplicarNaProposta = useCallback(async (
    sugestaoId: string,
    licitacaoItemId: string
  ) => {
    const sugestao = sugestoes.find(s => s.id === sugestaoId);
    if (!sugestao) return false;

    // Update the licitacao_itens with the accepted brand/model
    const { error } = await supabase
      .from('licitacao_itens')
      .update({
        marca: sugestao.marca_sugerida,
        fabricante: sugestao.fabricante_sugerido,
        modelo: sugestao.modelo_sugerido,
      } as any)
      .eq('id', licitacaoItemId);

    if (error) {
      toast.error('Erro ao aplicar marca no item');
      return false;
    }

    await aceitarSugestao(sugestaoId);
    toast.success(`Marca "${sugestao.marca_sugerida}" aplicada ao item!`);
    return true;
  }, [sugestoes, aceitarSugestao]);

  // Group suggestions by item
  const sugestoesPorItem = sugestoes.reduce<Record<string, SugestaoMarca[]>>((acc, s) => {
    const key = s.descricao_item;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return {
    sugestoes,
    sugestoesPorItem,
    isLoading,
    isGenerating,
    fetchSugestoes,
    gerarSugestoes,
    aceitarSugestao,
    rejeitarSugestao,
    aplicarNaProposta,
  };
}
