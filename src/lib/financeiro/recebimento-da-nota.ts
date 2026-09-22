/**
 * Uma nota já foi recebida? — a régua de identidade entre a DANFE que entra
 * no Gestão de Contratos e um recebimento que já está no Financeiro.
 *
 * O caso real (21/09/2026): o extrato foi importado e conciliado antes de a
 * DANFE ser anexada ao pedido. Cada anexo criou um segundo título a receber,
 * e a carteira da ETHOS foi a R$ 9 milhões com R$ 6 milhões já no banco.
 *
 * Regra do dono, na mesma data: **valor igual não prova duplicidade.** Um
 * cliente fatura o mesmo valor em pedidos diferentes, cada um com o seu
 * empenho e a sua nota — e aí são duas notas legítimas (NFs 692 e 693 da
 * ETHOS, R$ 158.000,00 cada). A identidade é o NÚMERO da nota (ou a chave
 * de acesso) e o número do pedido; o valor só confirma.
 *
 * Por isso a resposta tem três graus:
 *   · `certo`   — um único recebimento com a mesma chave, ou com o mesmo
 *                 número de nota E o mesmo valor: pode casar sem perguntar;
 *   · `ambiguo` — há candidato por número de nota com valor diferente, ou só
 *                 por valor: quem opera decide, pelo diálogo de casar;
 *   · `nenhum`  — nada parecido: criar o título é o certo.
 */

export type NotaParaCasar = {
  /** Número da NF-e como veio (aceita "000.000.719", "NF 719", "719"). */
  numero: string | null | undefined;
  chave?: string | null;
  valor: number;
  /**
   * CNPJ da outra parte — emitente na nota de fornecedor, destinatário na
   * nota emitida. Não decide sozinho: desempata entre dois candidatos fortes
   * e aparece como motivo.
   */
  cnpj?: string | null;
};

export type RecebimentoCandidato = {
  id: string;
  descricao: string | null;
  numero_documento: string | null;
  chave_acesso_nfe?: string | null;
  valor: number;
  data_realizado?: string | null;
  data_competencia?: string | null;
  status: string;
  contrato_pedido_id: string | null;
  /** CNPJ/CPF da pessoa do lançamento, quando a consulta trouxe. */
  pessoa_documento?: string | null;
};

export type Sugestao = { recebimento: RecebimentoCandidato; motivos: string[] };

export type ResultadoDaBusca =
  | { veredito: 'certo'; recebimento: RecebimentoCandidato; motivos: string[] }
  | { veredito: 'ambiguo'; sugestoes: Sugestao[] }
  | { veredito: 'nenhum' };

/** Só dígitos, sem zeros à esquerda: "000.000.719" → "719". */
export function numeroDaNota(s: string | null | undefined): string {
  return (s ?? '').replace(/\D+/g, '').replace(/^0+/, '');
}

/**
 * O número aparece no texto como número inteiro, não como pedaço de outro:
 * "719" casa "NFe N° 000.000.719 - SEDUC" e "NF 719", e NÃO casa "1719"
 * nem "7190". Zeros à esquerda são ignorados dos dois lados.
 */
export function textoCitaNota(texto: string | null | undefined, numero: string): boolean {
  if (!numero || !texto) return false;
  const re = new RegExp(`(^|[^0-9])0*${numero}(?=[^0-9]|$)`);
  return re.test(texto);
}

const mesmoValor = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 0.005;
const chaveLimpa = (s: string | null | undefined) => (s ?? '').replace(/\D+/g, '');

export function procurarRecebimentoDaNota(nota: NotaParaCasar, candidatos: RecebimentoCandidato[]): ResultadoDaBusca {
  const numero = numeroDaNota(nota.numero);
  const chave = chaveLimpa(nota.chave);
  const livres = candidatos.filter(
    (c) => !c.contrato_pedido_id && (c.status === 'realizado' || c.status === 'conciliado'),
  );

  const porChave = chave.length === 44
    ? livres.filter((c) => chaveLimpa(c.chave_acesso_nfe) === chave)
    : [];
  if (porChave.length === 1) {
    return { veredito: 'certo', recebimento: porChave[0], motivos: ['mesma chave de acesso'] };
  }

  const cnpj = chaveLimpa(nota.cnpj);
  const sugestoes: Sugestao[] = [];
  const fortes: Sugestao[] = [];
  for (const c of livres) {
    const motivos: string[] = [];
    const citaNumero = !!numero && (
      numeroDaNota(c.numero_documento) === numero
      || textoCitaNota(c.descricao, numero)
      || textoCitaNota(c.numero_documento, numero)
    );
    const valorIgual = mesmoValor(c.valor, nota.valor);
    const mesmoCnpj = cnpj.length >= 11 && chaveLimpa(c.pessoa_documento) === cnpj;
    if (citaNumero) motivos.push(`cita a nota ${numero}`);
    if (valorIgual) motivos.push('mesmo valor');
    if (mesmoCnpj) motivos.push('mesmo CNPJ');
    if (citaNumero && !valorIgual) motivos.push('valor diferente do da nota');
    // CNPJ sozinho não é indício de NADA: a empresa paga o mesmo fornecedor
    // muitas vezes. Só entra acompanhado de número ou de valor.
    if (!citaNumero && !valorIgual) continue;
    const s = { recebimento: c, motivos };
    sugestoes.push(s);
    if (citaNumero && valorIgual) fortes.push(s);
  }

  if (fortes.length === 1) {
    return { veredito: 'certo', recebimento: fortes[0].recebimento, motivos: fortes[0].motivos };
  }
  // Dois fortes e só um com o CNPJ da outra parte: o CNPJ desempata.
  if (fortes.length > 1 && cnpj.length >= 11) {
    const comCnpj = fortes.filter((s) => s.motivos.includes('mesmo CNPJ'));
    if (comCnpj.length === 1) {
      return { veredito: 'certo', recebimento: comCnpj[0].recebimento, motivos: comCnpj[0].motivos };
    }
  }
  if (sugestoes.length === 0) return { veredito: 'nenhum' };
  // Mais de um forte, ou só indícios (número sem valor, valor sem número):
  // quem opera decide, vendo os motivos de cada um.
  return {
    veredito: 'ambiguo',
    sugestoes: sugestoes.sort((a, b) => b.motivos.length - a.motivos.length),
  };
}
