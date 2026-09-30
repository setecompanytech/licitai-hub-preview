import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';

/**
 * O documento fiscal de um pedido, pelo VÍNCULO — não pelo número.
 *
 * A coluna NF-e casava `contrato_pedidos.nota_fiscal` com o número gravado no
 * documento. Funciona quando o número está lá, e não está sempre: um pedido
 * criado a partir de um lançamento cujo `numero_documento` ainda estava vazio
 * nasce sem nota, e nunca mais a recebe. Foi o que aconteceu com o 001 do
 * 008/2026 — vinculado antes de o DANFE ser lido, e a coluna ficou em "—" com
 * o arquivo guardado a dois cliques dali.
 *
 * O caminho por chave estrangeira não tem esse buraco:
 *
 *   contrato_pedidos.id
 *     ← financeiro_lancamentos.contrato_pedido_id
 *       → financeiro_documentos_fiscais.lancamento_id
 *
 * Casamento por texto depende de alguém ter digitado igual dos dois lados.
 * Chave estrangeira não depende de ninguém.
 *
 * Uma consulta por empresa, cacheada: a aba mostra dezenas de pedidos e uma
 * requisição por linha derrubaria a rolagem.
 */

export type NotaDoPedido = {
  /** Nulo quando o título existe e o documento ainda não foi anexado. */
  documento_id: string | null;
  storage_path: string | null;
  arquivo_nome: string | null;
  /** O número que o Financeiro conhece — pode existir aqui e faltar no pedido. */
  numero: string | null;
  tem_xml: boolean;
  /** O XML da nota, quando é ele que está arquivado: o espelho da NF-e é lido dele. */
  arquivo_xml: string | null;
  /** O título ao qual a nota está ligada — é nele que o DANFE gerado é guardado. */
  lancamento_id: string | null;
  /** O arquivo aberto é um PDF (DANFE)? Se não, o DANFE ainda pode ser gerado do XML. */
  tem_pdf: boolean;
};

export function useNotasDosPedidos(contratoId: string | undefined) {
  const { empresaAtiva } = useEmpresa();
  return useQuery({
    queryKey: ['nf-por-pedido', empresaAtiva?.id, contratoId],
    enabled: !!empresaAtiva?.id && !!contratoId,
    staleTime: 15_000,
    queryFn: async (): Promise<Record<string, NotaDoPedido>> => {
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .select('id, contrato_pedido_id, numero_documento, lote_id')
        .eq('empresa_id', empresaAtiva!.id)
        .eq('contrato_id', contratoId!)
        .or('contrato_pedido_id.not.is.null,lote_id.not.is.null');
      // Falha aqui não pode derrubar a aba: a coluna é informação, e a tabela
      // de pedidos vale sem ela.
      if (error || !data?.length) return {};

      type Lido = { id: string; contrato_pedido_id: string | null; numero_documento: string | null; lote_id?: string | null };
      const lidos = data as unknown as Lido[];
      // Título ÚNICO de lote (29/09): vale para todas as partes do lote.
      const lotes = [...new Set(lidos.map((l) => l.lote_id).filter((x): x is string => !!x))];
      const partesPorLote = new Map<string, string[]>();
      if (lotes.length > 0) {
        // `lote_id` veio de migration colada à mão: o types.ts gerado não a conhece.
        const consulta = supabase.from('contrato_pedidos' as never) as unknown as {
          select: (c: string) => { eq: (c: string, v: string) => { in: (c: string, v: string[]) => PromiseLike<{ data: unknown }> } };
        };
        const { data: partes } = await consulta.select('id, lote_id').eq('contrato_id', contratoId!).in('lote_id', lotes);
        for (const pt of (partes ?? []) as unknown as Array<{ id: string; lote_id: string }>) {
          (partesPorLote.get(pt.lote_id) ?? partesPorLote.set(pt.lote_id, []).get(pt.lote_id)!).push(pt.id);
        }
      }
      const lancamentos: Array<{ id: string; contrato_pedido_id: string; numero_documento: string | null }> = [];
      for (const l of lidos) {
        if (l.contrato_pedido_id) lancamentos.push({ id: l.id, contrato_pedido_id: l.contrato_pedido_id, numero_documento: l.numero_documento });
        else if (l.lote_id) for (const pid of partesPorLote.get(l.lote_id) ?? []) lancamentos.push({ id: l.id, contrato_pedido_id: pid, numero_documento: l.numero_documento });
      }
      if (lancamentos.length === 0) return {};
      const { data: docs } = await supabase
        .from('financeiro_documentos_fiscais' as never)
        .select('id, lancamento_id, storage_path, arquivo_nome, numero, arquivo_xml')
        .in('lancamento_id', [...new Set(lancamentos.map((l) => l.id))]);

      const porLancamento = new Map<string, {
        id: string; storage_path: string; arquivo_nome: string;
        numero: string | null; arquivo_xml: string | null;
      }>();
      // Um título pode ter o XML E o DANFE em PDF (30/09). O arquivo que abre
      // é o PDF, quando existe; o XML fica junto, para o espelho da nota.
      const xmlPorLancamento = new Map<string, string>();
      for (const d of (docs ?? []) as unknown as Array<{
        id: string; lancamento_id: string; storage_path: string;
        arquivo_nome: string; numero: string | null; arquivo_xml: string | null;
      }>) {
        if (d.arquivo_xml && !xmlPorLancamento.has(d.lancamento_id)) xmlPorLancamento.set(d.lancamento_id, d.arquivo_xml);
        if (!d.storage_path) continue;
        const atual = porLancamento.get(d.lancamento_id);
        const ehXml = !!d.arquivo_xml || /\.xml$/i.test(d.arquivo_nome ?? "");
        const atualEhXml = !!atual && (!!atual.arquivo_xml || /\.xml$/i.test(atual.arquivo_nome ?? ""));
        if (!atual || (atualEhXml && !ehXml)) porLancamento.set(d.lancamento_id, d);
      }

      const mapa: Record<string, NotaDoPedido> = {};
      for (const l of lancamentos) {
        const d = porLancamento.get(l.id);
        // Entra mesmo SEM documento: o número da nota vem do título e vale
        // ser mostrado. "000.000.125" sem arquivo diz qual nota é e que falta
        // anexá-la; um traço não diz nem uma coisa nem outra.
        mapa[l.contrato_pedido_id] = {
          documento_id: d?.id ?? null,
          storage_path: d?.storage_path ?? null,
          arquivo_nome: d?.arquivo_nome ?? null,
          // O número do documento vale mais que o do registro: é o que a nota
          // diz. Faltando, o do lançamento.
          numero: d?.numero ?? l.numero_documento ?? null,
          tem_xml: !!(d?.arquivo_xml || xmlPorLancamento.get(l.id)),
          arquivo_xml: d?.arquivo_xml ?? xmlPorLancamento.get(l.id) ?? null,
          lancamento_id: l.id,
          tem_pdf: !!d?.storage_path && /\.pdf$/i.test(d.arquivo_nome ?? ''),
        };
      }
      return mapa;
    },
  });
}
