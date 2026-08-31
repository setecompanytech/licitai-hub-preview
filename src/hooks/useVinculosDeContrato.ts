import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';

/**
 * O que cada título sustenta na Gestão de Contratos.
 *
 * Uma consulta por empresa, cacheada — a conciliação mostra centenas de linhas
 * e uma requisição por linha derrubaria a rolagem. Mesmo padrão do clipe do
 * documento fiscal.
 */
export type VinculoDeContrato = {
  contrato_id: string;
  numero_contrato: string | null;
  numero_pedido: string | null;
};

export function useVinculosDeContrato() {
  const { empresaAtiva } = useEmpresa();
  return useQuery({
    queryKey: ['fin-vinculos-de-contrato', empresaAtiva?.id],
    enabled: !!empresaAtiva?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, VinculoDeContrato>> => {
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .select('id, contrato_id, contrato:contratos(numero_contrato), pedido:contrato_pedidos(numero_pedido)')
        .eq('empresa_id', empresaAtiva!.id)
        .not('contrato_id', 'is', null);
      // Falha aqui não pode derrubar a conciliação: o selo é informação
      // adicional, e conciliar sem ele continua sendo possível.
      if (error) return {};
      const mapa: Record<string, VinculoDeContrato> = {};
      type Linha = {
        id: string; contrato_id: string;
        contrato: { numero_contrato: string | null } | null;
        pedido: { numero_pedido: string | null } | null;
      };
      for (const l of (data ?? []) as unknown as Linha[]) {
        mapa[l.id] = {
          contrato_id: l.contrato_id,
          numero_contrato: l.contrato?.numero_contrato ?? null,
          numero_pedido: l.pedido?.numero_pedido ?? null,
        };
      }
      return mapa;
    },
  });
}
