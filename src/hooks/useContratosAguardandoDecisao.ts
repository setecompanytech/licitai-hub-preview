import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { contratosAguardandoDecisao, type ContratoParaDecisao } from '@/lib/contratos/encerramento';

/**
 * Os contratos da empresa ativa que esperam a decisão de fim (decisão 4 do
 * dono, 21/09): saldo esgotado ou vigência vencida, sem encerramento
 * declarado. Lê só as colunas que a régua usa; a régua é a mesma do Resumo
 * (`contratosAguardandoDecisao`). Nada é gravado.
 */
export function useContratosAguardandoDecisao() {
  const { empresaAtiva } = useEmpresa();
  const empresaId = empresaAtiva?.id ?? null;
  return useQuery({
    queryKey: ['contratos-aguardando-decisao', empresaId],
    enabled: !!empresaId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id, numero_contrato, numero_ata, tipo_documento, status, valor_global, valor_consumido, data_fim, excluido_em')
        .eq('empresa_id', empresaId!)
        .neq('status', 'encerrado')
        .is('excluido_em', null);
      if (error) throw error;
      return contratosAguardandoDecisao(((data ?? []) as unknown) as ContratoParaDecisao[]);
    },
  });
}
