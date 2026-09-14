import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avisosVigentes, tabelaAusente, type AvisoDoPortal } from './robo-do-cliente';

/**
 * Avisos da operação Praefectus aos clientes do robô.
 *
 * Lidos uma vez pela página e repassados à faixa da empresa (contagem e lista)
 * e à faixa de avisos acima do painel — duas leituras da mesma tabela dariam
 * dois números diferentes no intervalo entre elas.
 *
 * Tabela ausente (migration ainda não aplicada) = nenhum aviso, sem erro. Erro
 * de verdade é devolvido para a lista de avisos poder dizer que não conseguiu
 * ler — lista vazia sem explicação é indistinguível de "não há aviso".
 */
export function useAvisosDosPortais(habilitado = true) {
  const consulta = useQuery({
    queryKey: ['robo-avisos-portal'],
    enabled: habilitado,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<AvisoDoPortal[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela de 14/09 fora do types.ts (parado em 16/08)
      const { data, error } = await (supabase as any)
        .from('robo_avisos_portal')
        .select('id, portal_id, severidade, titulo, mensagem, ativo, inicio_em, fim_em')
        .eq('ativo', true)
        .order('inicio_em', { ascending: false });
      if (error) {
        if (tabelaAusente(error)) return [];
        console.error('[robo-lances] ler robo_avisos_portal', error.message);
        throw new Error(error.message || 'sem resposta do banco');
      }
      return avisosVigentes(Array.isArray(data) ? data : []);
    },
  });

  return {
    avisos: consulta.data ?? [],
    erro: consulta.isError ? 'Não foi possível ler os avisos agora.' : null,
    recarregar: consulta.refetch,
  };
}
