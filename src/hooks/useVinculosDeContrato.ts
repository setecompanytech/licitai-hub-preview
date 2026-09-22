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
      const empresaId = empresaAtiva!.id;
      // O número do contrato vem numa consulta própria, casada em memória.
      // `financeiro_lancamentos.contrato_id` NÃO tem chave estrangeira para
      // `contratos`: o embed `contrato:contratos(...)` que vivia aqui era
      // recusado pelo PostgREST (PGRST200, "could not find a relationship"),
      // o erro era engolido e a lista inteira ficava sem selo — e o
      // recebimento rateado de 27/05, "sem vínculo" (descoberto em 22/09).
      const [lancamentos, contratos] = await Promise.all([
        supabase
          .from('financeiro_lancamentos')
          .select('id, contrato_id, pedido:contrato_pedidos(numero_pedido)')
          .eq('empresa_id', empresaId)
          .not('contrato_id', 'is', null),
        supabase
          .from('contratos')
          .select('id, numero_contrato')
          .eq('empresa_id', empresaId),
      ]);
      // Falha aqui não pode derrubar a conciliação: o selo é informação
      // adicional, e conciliar sem ele continua sendo possível. Mas deixa
      // rastro — foi o silêncio que escondeu o embed recusado por três semanas.
      if (lancamentos.error) {
        console.error('[vinculos-de-contrato] lançamentos:', lancamentos.error.message);
        return {};
      }
      if (contratos.error) console.error('[vinculos-de-contrato] contratos:', contratos.error.message);
      const numeroDoContrato = new Map<string, string | null>(
        ((contratos.data ?? []) as Array<{ id: string; numero_contrato: string | null }>).map((c) => [c.id, c.numero_contrato]),
      );
      const mapa: Record<string, VinculoDeContrato> = {};
      type Linha = {
        id: string; contrato_id: string;
        pedido: { numero_pedido: string | null } | null;
      };
      for (const l of (lancamentos.data ?? []) as unknown as Linha[]) {
        mapa[l.id] = {
          contrato_id: l.contrato_id,
          numero_contrato: numeroDoContrato.get(l.contrato_id) ?? null,
          numero_pedido: l.pedido?.numero_pedido ?? null,
        };
      }

      // Os rateios. A tabela vem de migration colada à mão: ausente, o mapa
      // segue só com os vínculos diretos — com o motivo no console.
      const { data: rateios, error: erroRateios } = await supabase
        .from('financeiro_lancamento_rateios' as never)
        .select('lancamento_id, contrato_pedido_id, valor, pedido:contrato_pedidos(numero_pedido, nota_fiscal, contrato_id)')
        .eq('empresa_id', empresaId);
      if (erroRateios) console.error('[vinculos-de-contrato] rateios:', erroRateios.message);
      type LinhaRateio = {
        lancamento_id: string; contrato_pedido_id: string; valor: number;
        pedido: { numero_pedido: string | null; nota_fiscal: string | null; contrato_id: string } | null;
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
            numero_contrato: numeroDoContrato.get(r.pedido!.contrato_id) ?? null,
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
