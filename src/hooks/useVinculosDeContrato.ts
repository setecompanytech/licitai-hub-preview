import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { casarDanfesComAsPartes, type DocumentoAnexado, type ParteDoRateio } from '@/lib/financeiro/partes-do-rateio';

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
  rateios?: ParteDoRateio[];
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
        .select('lancamento_id, contrato_pedido_id, valor, pedido:contrato_pedidos(numero_pedido, nota_fiscal, contrato_id, contrato:contratos(numero_contrato))')
        .eq('empresa_id', empresaAtiva!.id);
      type LinhaRateio = {
        lancamento_id: string; contrato_pedido_id: string; valor: number;
        pedido: { numero_pedido: string | null; nota_fiscal: string | null; contrato_id: string; contrato: { numero_contrato: string | null } | null } | null;
      };
      const linhas = ((rateios ?? []) as unknown as LinhaRateio[]).filter((r) => !!r.pedido);
      if (linhas.length === 0) return mapa;

      // As DANFEs anexadas aos recebimentos rateados — cada parte acha a sua
      // pelo número da nota do pedido.
      const idsRateados = [...new Set(linhas.map((r) => r.lancamento_id))];
      const { data: docs } = await supabase
        .from('financeiro_documentos_fiscais' as never)
        .select('id, lancamento_id, numero, storage_path, arquivo_nome')
        .in('lancamento_id', idsRateados);
      const docsPorLancamento = new Map<string, DocumentoAnexado[]>();
      for (const d of ((docs ?? []) as unknown as Array<DocumentoAnexado & { lancamento_id: string }>)) {
        const lista = docsPorLancamento.get(d.lancamento_id) ?? [];
        lista.push(d);
        docsPorLancamento.set(d.lancamento_id, lista);
      }

      const partesPorLancamento = new Map<string, Array<Omit<ParteDoRateio, 'danfe'>>>();
      for (const r of linhas) {
        const lista = partesPorLancamento.get(r.lancamento_id) ?? [];
        lista.push({
          contrato_pedido_id: r.contrato_pedido_id,
          numero_pedido: r.pedido!.numero_pedido,
          nota_fiscal: r.pedido!.nota_fiscal,
          valor: Number(r.valor) || 0,
        });
        partesPorLancamento.set(r.lancamento_id, lista);
        if (!mapa[r.lancamento_id]) {
          mapa[r.lancamento_id] = {
            contrato_id: r.pedido!.contrato_id,
            numero_contrato: r.pedido!.contrato?.numero_contrato ?? null,
            numero_pedido: null,
          };
        }
      }
      for (const [lancamentoId, partes] of partesPorLancamento) {
        mapa[lancamentoId].rateios = casarDanfesComAsPartes(partes, docsPorLancamento.get(lancamentoId) ?? []);
      }
      return mapa;
    },
  });
}
