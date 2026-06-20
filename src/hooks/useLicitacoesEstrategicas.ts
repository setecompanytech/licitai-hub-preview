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

      if (error) {
        // FunctionsHttpError: extrai o corpo real da resposta para obter a mensagem
        let mensagemReal = error.message || 'Erro ao contactar o servidor';
        try {
          const corpo = await (error as any).context?.json?.();
          if (corpo?.error) mensagemReal = corpo.error;
        } catch { /* ignora se não conseguir ler o corpo */ }

        if (/Rate limit|429/i.test(mensagemReal)) {
          toast.error('Limite de requisições atingido', {
            description: 'Aguarde alguns minutos e tente novamente.',
            duration: 7000,
          });
        } else if (/Payment|402|crédito/i.test(mensagemReal)) {
          toast.error('Créditos de IA esgotados', {
            description: 'Verifique o plano da conta.',
            duration: 7000,
          });
        } else if (/not deployed|FunctionsRelay|não encontrada/i.test(mensagemReal)) {
          toast.error('Serviço de classificação indisponível', {
            description: 'A função de análise estratégica ainda não foi implantada. Contate o suporte.',
            duration: 9000,
          });
        } else {
          toast.error('Falha ao carregar oportunidades estratégicas', {
            description: mensagemReal,
            duration: 8000,
          });
        }
        return;
      }

      if (data?.error) {
        const msg: string = data.error;
        if (/Rate limit|429/i.test(msg)) {
          toast.error('Limite de requisições atingido', { description: 'Aguarde alguns minutos e tente novamente.', duration: 7000 });
        } else if (/Payment|402/i.test(msg)) {
          toast.error('Créditos de IA esgotados', { description: 'Verifique o plano da conta.', duration: 7000 });
        } else {
          toast.error('Falha ao classificar licitações', { description: msg, duration: 8000 });
        }
        return;
      }

      setLicitacoes(data?.licitacoes || []);
      setFonteClassificacao(data?.fonte || null);

      if (data?.fonte === 'fallback') {
        toast.info('Classificação por IA indisponível. Exibindo dados sem pontuação inteligente.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar licitações estratégicas:', err);
      toast.error('Falha ao carregar oportunidades estratégicas', {
        description: err?.message || 'Verifique sua conexão e tente novamente.',
        duration: 7000,
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
