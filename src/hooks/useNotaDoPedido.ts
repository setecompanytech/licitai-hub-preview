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
};

export function useNotasDosPedidos(contratoId: string | undefined) {
  const { empresaAtiva } = useEmpresa();
  return useQuery({
    queryKey: ['nf-por-pedido', empresaAtiva?.id, contratoId],
    enabled: !!empresaAtiva?.id && !!contratoId,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, NotaDoPedido>> => {
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .select('id, contrato_pedido_id, numero_documento')
        .eq('empresa_id', empresaAtiva!.id)
        .eq('contrato_id', contratoId!)
        .not('contrato_pedido_id', 'is', null);
      // Falha aqui não pode derrubar a aba: a coluna é informação, e a tabela
      // de pedidos vale sem ela.
      if (error || !data?.length) return {};

      const lancamentos = data as unknown as Array<{
        id: string; contrato_pedido_id: string; numero_documento: string | null;
      }>;
      const { data: docs } = await supabase
        .from('financeiro_documentos_fiscais' as never)
        .select('id, lancamento_id, storage_path, arquivo_nome, numero, arquivo_xml')
        .in('lancamento_id', lancamentos.map((l) => l.id));

      const porLancamento = new Map<string, {
        id: string; storage_path: string; arquivo_nome: string;
        numero: string | null; arquivo_xml: string | null;
      }>();
      for (const d of (docs ?? []) as unknown as Array<{
        id: string; lancamento_id: string; storage_path: string;
        arquivo_nome: string; numero: string | null; arquivo_xml: string | null;
      }>) {
        if (d.storage_path) porLancamento.set(d.lancamento_id, d);
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
          tem_xml: !!d?.arquivo_xml,
        };
      }
      return mapa;
    },
  });
}
