import { supabase } from '@/integrations/supabase/client';
import {
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
 * sem pedido. Dois recortes, unidos: os que citam o número da nota (no
 * número do documento ou na descrição) e os de valor igual, para a sugestão
 * fraca. Sem número e sem chave, só o valor — e aí nunca é "certo".
 */
export async function buscarRecebimentoDaNota(
  empresaId: string,
  nota: NotaParaCasar,
  tipo: 'a_receber' | 'a_pagar' = 'a_receber',
): Promise<ResultadoDaBusca> {
  const numero = numeroDaNota(nota.numero);
  const chave = (nota.chave ?? '').replace(/\D+/g, '');
  const colunas = 'id, descricao, numero_documento, chave_acesso_nfe, valor, data_realizado, data_competencia, status, contrato_pedido_id, pessoa:financeiro_pessoas(documento)';
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
  if (consultas.length === 0) return { veredito: 'nenhum' };

  type Linha = Omit<RecebimentoCandidato, 'pessoa_documento'> & { pessoa?: { documento?: string | null } | null };
  const vistos = new Map<string, RecebimentoCandidato>();
  for (const r of await Promise.all(consultas)) {
    if (r.error) throw new Error(r.error.message);
    for (const c of (r.data as Linha[]) ?? []) {
      const { pessoa, ...resto } = c;
      vistos.set(c.id, { ...resto, pessoa_documento: pessoa?.documento ?? null });
    }
  }
  return procurarRecebimentoDaNota(nota, [...vistos.values()]);
}
