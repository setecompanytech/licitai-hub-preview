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
  /**
   * Rateio (22/09): um recebimento que pagou várias notas não tem pedido
   * próprio — tem uma parte em cada pedido. Sem isto a linha dizia "sem
   * vínculo" para a TED de 27/05 que quita seis pedidos.
   */
  rateios?: Array<{ numero_pedido: string | null; valor: number }>;
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

      // Os rateios. A tabela vem de migration colada à mão: ausente, o mapa
      // segue só com os vínculos diretos.
      const { data: rateios } = await supabase
        .from('financeiro_lancamento_rateios' as never)
        .select('lancamento_id, valor, pedido:contrato_pedidos(numero_pedido, contrato_id, contrato:contratos(numero_contrato))')
        .eq('empresa_id', empresaAtiva!.id);
      type LinhaRateio = {
        lancamento_id: string; valor: number;
        pedido: { numero_pedido: string | null; contrato_id: string; contrato: { numero_contrato: string | null } | null } | null;
      };
      for (const r of ((rateios ?? []) as unknown as LinhaRateio[])) {
        if (!r.pedido) continue;
        const atual = mapa[r.lancamento_id] ?? {
          contrato_id: r.pedido.contrato_id,
          numero_contrato: r.pedido.contrato?.numero_contrato ?? null,
          numero_pedido: null,
        };
        atual.rateios = [...(atual.rateios ?? []), { numero_pedido: r.pedido.numero_pedido, valor: Number(r.valor) || 0 }];
        atual.rateios.sort((a, b) => String(a.numero_pedido ?? '').localeCompare(String(b.numero_pedido ?? ''), 'pt-BR', { numeric: true }));
        mapa[r.lancamento_id] = atual;
      }
      return mapa;
    },
  });
}
