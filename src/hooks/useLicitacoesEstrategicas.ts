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

function rowToEstrategica(e: any): LicitacaoEstrategica {
  return {
    id: e.id,
    numero: e.pncp_id || e.id.slice(0, 12),
    orgao: e.orgao || 'N/I',
    objeto: e.objeto || '',
    valor: e.valor_total_estimado || 0,
    uf: e.uf || '',
    municipio: e.municipio || '',
    modalidade: e.modalidade_nome || '',
    dataAbertura: e.data_abertura_proposta || '',
    linkOrigem: e.link_sistema_origem || e.url_pncp || '',
    fonte: e.fonte || '',
    scoreRelevancia: 50,
    scoreViabilidade: 50,
    scoreConcorrencia: 50,
    scoreGeral: 50,
    fatoresPositivos: ['Dados disponíveis no PNCP'],
    fatoresRisco: ['Classificação automática indisponível'],
    recomendacao: 'media',
    salva: false,
  };
}

async function carregarDoBanco(uf?: string): Promise<LicitacaoEstrategica[]> {
  let query = supabase
    .from('pncp_editais_cache')
    .select('id, pncp_id, orgao, objeto, valor_total_estimado, uf, municipio, modalidade_nome, data_abertura_proposta, data_encerramento_proposta, link_sistema_origem, url_pncp, fonte')
    .gte('data_abertura_proposta', new Date().toISOString())
    .order('data_abertura_proposta', { ascending: true })
    .limit(30);

  if (uf) query = query.eq('uf', uf);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToEstrategica);
}

export function useLicitacoesEstrategicas() {
  const [licitacoes, setLicitacoes] = useState<LicitacaoEstrategica[]>([]);
  const [loading, setLoading] = useState(false);
  const [fonteClassificacao, setFonteClassificacao] = useState<'ia' | 'fallback' | null>(null);

  const carregar = useCallback(async (uf?: string) => {
    setLoading(true);
    try {
      // Tenta a edge function com classificação por IA
      const { data, error } = await supabase.functions.invoke('classificar-licitacoes-estrategicas', {
        body: { limit: 30, uf: uf || null },
      });

      if (!error && data?.licitacoes && !data?.error) {
        setLicitacoes(data.licitacoes);
        setFonteClassificacao(data.fonte || null);
        if (data.fonte === 'fallback') {
          toast.info('Classificação por IA indisponível. Exibindo dados sem pontuação inteligente.');
        }
        setLoading(false);
        return;
      }

      // Edge function falhou — busca diretamente do banco
      console.warn('Edge function falhou, usando fallback direto do banco:', error?.message ?? data?.error);
    } catch (edgeFnErr) {
      console.warn('Edge function inacessível, usando fallback direto do banco:', edgeFnErr);
    }

    // Fallback: consulta direta à tabela sem classificação por IA
    try {
      const lics = await carregarDoBanco(uf);
      setLicitacoes(lics);
      setFonteClassificacao('fallback');
      if (lics.length === 0) {
        toast.info('Nenhuma licitação com abertura futura encontrada no momento.');
      }
    } catch (dbErr: any) {
      console.error('Erro ao carregar licitações estratégicas do banco:', dbErr);
      toast.error('Não foi possível carregar as oportunidades estratégicas', {
        description: dbErr?.message || 'Verifique sua conexão e tente novamente.',
        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { licitacoes, loading, fonteClassificacao, recarregar: carregar };
}
