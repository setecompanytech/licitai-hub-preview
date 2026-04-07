import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type LicitacaoEstrategica = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  valor: number;
  uf: string;
  municipio: string;
  modalidade: string;
  dataAbertura: string;
  linkOrigem: string;
  fonte: string;
  scoreRelevancia: number;
  scoreViabilidade: number;
  scoreConcorrencia: number;
  scoreGeral: number;
  fatoresPositivos: string[];
  fatoresRisco: string[];
  recomendacao: 'alta' | 'media' | 'baixa';
  salva: boolean;
};

export function useLicitacoesEstrategicas() {
  const [licitacoes, setLicitacoes] = useState<LicitacaoEstrategica[]>([]);
  const [loading, setLoading] = useState(false);
  const [fonteClassificacao, setFonteClassificacao] = useState<'ia' | 'fallback' | null>(null);

  const carregar = useCallback(async (uf?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('classificar-licitacoes-estrategicas', {
        body: { limit: 30, uf: uf || null },
      });

      if (error) throw error;

      if (data?.error) {
        // Handle rate limit / payment errors
        if (data.error.includes('Rate limit') || data.error.includes('429')) {
          toast.error('Limite de requisições atingido. Tente novamente em alguns minutos.');
        } else if (data.error.includes('Payment') || data.error.includes('402')) {
          toast.error('Créditos de IA esgotados. Verifique seu plano.');
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setLicitacoes(data?.licitacoes || []);
      setFonteClassificacao(data?.fonte || null);

      if (data?.fonte === 'fallback') {
        toast.warning('Classificação por IA indisponível. Exibindo dados sem pontuação inteligente.');
      }
    } catch (err) {
      console.error('Erro ao carregar licitações estratégicas:', err);
      toast.error('Erro ao carregar oportunidades estratégicas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { licitacoes, loading, fonteClassificacao, recarregar: carregar };
}
