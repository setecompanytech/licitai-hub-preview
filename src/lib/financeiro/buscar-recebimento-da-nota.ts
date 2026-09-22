import { supabase } from '@/integrations/supabase/client';
import {
  JANELA_MESMO_CNPJ_DIAS,
  numeroDaNota,
  procurarRecebimentoDaNota,
  type NotaParaCasar,
  type RecebimentoCandidato,
  type ResultadoDaBusca,
} from './recebimento-da-nota';

/**
 * Traz do Financeiro os lançamentos que podem ser desta nota e aplica a
 * régua de identidade (`procurarRecebimentoDaNota`).
 *
 * Candidatos: lançamentos do tipo pedido (a receber para nota emitida, a
 * pagar para nota de fornecedor), já baixados (realizado ou conciliado) e
 * sem pedido. Recortes, unidos: os que citam o número da nota (no número do
 * documento ou na descrição), os de valor igual (sugestão fraca) e — para o
 * fracionado de 22/09 — os do mesmo CNPJ dentro de 90 dias da emissão. Cada
 * candidato traz a soma das notas já anexadas a ele: é o que diz se um
 * pagamento maior ainda tem sobra para esta nota.
 */
export async function buscarRecebimentoDaNota(
  empresaId: string,
  nota: NotaParaCasar,
  tipo: 'a_receber' | 'a_pagar' = 'a_receber',
): Promise<ResultadoDaBusca> {
  const numero = numeroDaNota(nota.numero);
  const chave = (nota.chave ?? '').replace(/\D+/g, '');
  const cnpj = (nota.cnpj ?? '').replace(/\D+/g, '');
  const colunas = 'id, descricao, numero_documento, chave_acesso_nfe, valor, data_realizado, data_competencia, status, contrato_pedido_id, pessoa:financeiro_pessoas(documento), notas:financeiro_documentos_fiscais!financeiro_documentos_fiscais_lancamento_id_fkey(valor_total)';
  const base = () => supabase
    .from('financeiro_lancamentos')
    .select(colunas)
    .eq('empresa_id', empresaId)
    .eq('tipo', tipo)
    .in('status', ['realizado', 'conciliado'])
    .is('contrato_pedido_id', null)
    .limit(60);

  const consultas: Array<Promise<{ data: unknown; error: { message: string } | null }>> = [];
  if (numero) {
    consultas.push(base().or(`numero_documento.ilike.%${numero}%,descricao.ilike.%${numero}%`) as never);
  }
  if (chave.length === 44) {
    consultas.push(base().eq('chave_acesso_nfe', chave) as never);
  }
  if (Number.isFinite(nota.valor) && nota.valor > 0) {
    consultas.push(base().eq('valor', nota.valor) as never);
  }
  // O mesmo CNPJ na janela da emissão: só faz sentido com a data, porque é a
  // janela — não o CNPJ — que sustenta a hipótese do fracionado.
  if (cnpj.length >= 11 && nota.dataEmissao) {
    const formatado = cnpj.length === 14
      ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : cnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    const { data: pessoas } = await supabase
      .from('financeiro_pessoas')
      .select('id')
      .eq('empresa_id', empresaId)
      .in('documento', [cnpj, formatado])
      .limit(20);
    const ids = ((pessoas ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (ids.length > 0) {
      const emissao = new Date(`${String(nota.dataEmissao).slice(0, 10)}T12:00:00Z`);
      const de = new Date(emissao.getTime() - JANELA_MESMO_CNPJ_DIAS * 86400000).toISOString().slice(0, 10);
      const ate = new Date(emissao.getTime() + JANELA_MESMO_CNPJ_DIAS * 86400000).toISOString().slice(0, 10);
      consultas.push(base().in('pessoa_id', ids).gte('data_competencia', de).lte('data_competencia', ate) as never);
    }
  }
  if (consultas.length === 0) return { veredito: 'nenhum' };

  type Linha = Omit<RecebimentoCandidato, 'pessoa_documento' | 'coberto_por_notas'> & {
    pessoa?: { documento?: string | null } | null;
    notas?: Array<{ valor_total?: number | null }> | null;
  };
  const vistos = new Map<string, RecebimentoCandidato>();
  for (const r of await Promise.all(consultas)) {
    if (r.error) throw new Error(r.error.message);
    for (const c of (r.data as Linha[]) ?? []) {
      const { pessoa, notas, ...resto } = c;
      vistos.set(c.id, {
        ...resto,
        pessoa_documento: pessoa?.documento ?? null,
        coberto_por_notas: (notas ?? []).reduce((s, n) => s + (Number(n.valor_total) || 0), 0),
      });
    }
  }
  return procurarRecebimentoDaNota(nota, [...vistos.values()]);
}
