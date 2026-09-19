import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Situação do espelho PNCP para um conjunto de processos, numa consulta só.
 *
 * `pncp_editais_cache` é lida por qualquer usuário autenticado (policy
 * "Anyone authenticated can read pncp cache") e é atualizada pelo sync
 * diário. Não há FK entre `licitacoes.numero_controle_pncp` e o cache, então
 * o PostgREST não embute — vai por `.in()`, em lotes de 100 números, para a
 * URL não estourar (cada número de controle tem ~30 caracteres).
 *
 * Quem chama passa só os processos abertos (radar e em jogo): o espelho de um
 * processo decidido não muda o que a agenda cobra.
 */
export interface SituacaoDoEspelho {
  situacao: string | null;
  /** Quando o espelho foi gravado/atualizado pela última vez. */
  atualizadoEm: string | null;
}

export const CHAVE_ESPELHO_PNCP = 'espelho-pncp-situacao';

const LOTE = 100;

export function useSituacaoDoEspelhoPNCP(numerosDeControle: Array<string | null | undefined>) {
  const numeros = [...new Set(numerosDeControle.filter((n): n is string => !!n))].sort();

  const consulta = useQuery({
    queryKey: [CHAVE_ESPELHO_PNCP, numeros.join('|')],
    enabled: numeros.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const mapa: Record<string, SituacaoDoEspelho> = {};
      for (let i = 0; i < numeros.length; i += LOTE) {
        const lote = numeros.slice(i, i + LOTE);
        const { data, error } = await supabase
          .from('pncp_editais_cache')
          .select('numero_controle_pncp, situacao, updated_at')
          .in('numero_controle_pncp', lote);
        // Erro nomeado, não engolido: a agenda diz "Espelho PNCP: <motivo>" e
        // oferece tentar de novo, como faz com as outras fontes.
        if (error) throw new Error(error.message);
        (data || []).forEach((l) => {
          if (l.numero_controle_pncp) {
            mapa[l.numero_controle_pncp] = { situacao: l.situacao, atualizadoEm: l.updated_at };
          }
        });
      }
      return mapa;
    },
  });

  return {
    situacoes: consulta.data ?? {},
    carregando: numeros.length > 0 && consulta.isLoading,
    erro: (consulta.error as Error | null) ?? null,
    recarregar: () => void consulta.refetch(),
  };
}
