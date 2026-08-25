/**
 * Linha de extrato que NÃO é transação.
 *
 * Todo extrato bancário imprime, no meio dos lançamentos, linhas que só
 * informam: o saldo do dia, o saldo anterior, o total do período, o saldo
 * disponível, o bloqueado. Elas têm data e têm valor — só não têm movimento.
 *
 * O importador de OFX descartava essas linhas por um critério só: valor igual
 * a zero. E é verdade que muitas vêm zeradas. Mas "SALDO TOTAL DISPONÍVEL DIA"
 * vem com o valor do saldo, que não é zero, e por isso passava direto e virava
 * conta a receber.
 *
 * O estrago foi grande e silencioso: numa única conta, dezoito dias de saldo
 * viraram dezoito recebimentos somando R$ 7,8 milhões. Ninguém notou pelo
 * valor — notou porque alguém foi conferir e cancelou as vinte linhas à mão,
 * meses depois. Um recebimento de R$ 828 mil que nunca existiu não se
 * distingue de um verdadeiro numa lista.
 *
 * Aqui o critério passa a ser o TEXTO, que é onde a informação está. A lista
 * cobre o vocabulário dos bancos com que o sistema já lidou (Itaú, Banpará,
 * Inter, Bradesco, Santander) e é conservadora de propósito: prefere deixar
 * passar uma linha duvidosa a engolir uma transação real. Linha informativa
 * que escapa é ruído que alguém apaga; transação descartada é dinheiro que
 * some sem deixar rastro.
 */

/** Normaliza para comparação: sem acento, sem pontuação, minúsculo. */
function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Padrões que identificam linha informativa.
 *
 * São ancorados no começo da descrição porque é lá que o banco põe o rótulo.
 * "SALDO TOTAL DISPONÍVEL DIA" começa com saldo; já um pagamento a fornecedor
 * chamado "SALDO REMANESCENTE CONTRATO 12/2025" não — e esse tem de passar.
 */
const PADROES: RegExp[] = [
  /^saldo\b/,                       // SALDO DO DIA, SALDO ANTERIOR, SALDO TOTAL DISPONÍVEL DIA
  /^s a l d o\b/,                   // alguns extratos espaçam as letras
  /^total\b/,                       // TOTAL DO PERIODO, TOTAL DE CREDITOS
  /^subtotal\b/,
  /^resumo\b/,
  /^extrato\b/,
  /^posicao\b/,                     // POSICAO CONSOLIDADA
  /^limite\b/,                      // LIMITE DISPONIVEL / LIMITE DE CREDITO
  /^valor bloqueado\b/,
  /^saldo bloqueado\b/,
  /\bsaldo (anterior|do dia|final|inicial|disponivel|em conta)\b/,
  /\bsaldo total disponivel\b/,
];

/**
 * A descrição é de uma linha informativa de extrato?
 *
 * Devolve `false` para descrição vazia: sem texto não há como afirmar que a
 * linha é informativa, e o padrão tem de ser deixar passar.
 */
export function ehLinhaInformativa(descricao: string | null | undefined): boolean {
  if (!descricao) return false;
  const k = chave(descricao);
  if (!k) return false;
  return PADROES.some((p) => p.test(k));
}

/**
 * Motivo legível, para a tela poder dizer o que descartou e por quê.
 * Descartar em silêncio é o mesmo defeito de outro sinal.
 */
export function motivoDoDescarte(descricao: string | null | undefined, valor: number): string | null {
  if (Math.abs(valor) < 0.005) return 'valor zero';
  if (ehLinhaInformativa(descricao)) return 'linha de saldo do extrato';
  return null;
}
