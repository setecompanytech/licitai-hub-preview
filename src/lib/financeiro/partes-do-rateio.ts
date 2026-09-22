/**
 * As partes de um recebimento rateado, como a tela as mostra (22/09).
 *
 * Um recebimento que pagou várias notas (a TED de 27/05: seis notas, seis
 * pedidos) fica em Contas a Receber como UMA linha — conciliada uma vez com o
 * extrato, contada uma vez na receita. As partes vivem em
 * `financeiro_lancamento_rateios`. Parcelar o título em seis dobraria a
 * receita e deixaria cinco "recebidos" sem lastro no banco; a leitura por
 * partes dá o mesmo que as parcelas dariam, sem mexer na contabilidade.
 *
 * A DANFE de cada parte é a nota anexada ao recebimento cujo número casa
 * com a nota do pedido (o número gravado no documento; o nome do arquivo
 * como segunda chance, para anexos antigos sem número).
 */
import { numeroDaNota, textoCitaNota } from './recebimento-da-nota';

export type DocumentoAnexado = {
  id?: string;
  numero: string | null;
  storage_path: string | null;
  arquivo_nome: string | null;
};

export type ParteDoRateio = {
  contrato_pedido_id: string;
  numero_pedido: string | null;
  nota_fiscal: string | null;
  valor: number;
  danfe: { storage_path: string; arquivo_nome: string } | null;
};

export const reais = (v: number) =>
  (Number.isFinite(Number(v)) ? Number(v) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** A DANFE da nota entre os anexos do recebimento: pelo número gravado, ou pelo nome do arquivo. */
export function danfeDaNota(nota: string | null | undefined, docs: DocumentoAnexado[]): ParteDoRateio['danfe'] {
  const numero = numeroDaNota(nota);
  if (!numero) return null;
  const comArquivo = docs.filter((d) => !!d.storage_path);
  const porNumero = comArquivo.find((d) => numeroDaNota(d.numero) === numero);
  const doc = porNumero ?? comArquivo.find((d) => !d.numero && textoCitaNota(d.arquivo_nome, numero));
  return doc ? { storage_path: doc.storage_path!, arquivo_nome: doc.arquivo_nome ?? 'Nota fiscal' } : null;
}

export function casarDanfesComAsPartes(
  partes: Array<Omit<ParteDoRateio, 'danfe'>>,
  docs: DocumentoAnexado[],
): ParteDoRateio[] {
  return [...partes]
    .map((p) => ({ ...p, valor: Number(p.valor) || 0, danfe: danfeDaNota(p.nota_fiscal, docs) }))
    .sort((a, b) => String(a.numero_pedido ?? '').localeCompare(String(b.numero_pedido ?? ''), 'pt-BR', { numeric: true }));
}

export function somaDasPartes(partes: Array<{ valor: number }>): number {
  return Math.round(partes.reduce((s, p) => s + (Number(p.valor) || 0), 0) * 100) / 100;
}

/** "soma = o recebimento" ou "soma de R$ X" — a diferença é informação, não erro. */
export function fraseDaSoma(partes: Array<{ valor: number }>, valorDoRecebimento: number): string {
  const soma = somaDasPartes(partes);
  if (Math.abs(soma - (Number(valorDoRecebimento) || 0)) < 0.01) return `${reais(soma)}, igual ao recebimento`;
  return `${reais(soma)} de ${reais(valorDoRecebimento)} — ${reais(Math.round(((Number(valorDoRecebimento) || 0) - soma) * 100) / 100)} sem pedido`;
}
