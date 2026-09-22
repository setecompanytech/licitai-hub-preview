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
 *
 * Fracionado (22/09/2026, decisão do dono): nota e pagamento nem sempre têm
 * o mesmo valor, e isso não é erro:
 *   · `parte`   — o pagamento é MAIOR que a nota e ainda tem sobra sem nota
 *                 (um pagamento de R$ 400 mil que quita duas notas de R$ 200
 *                 mil): a nota anexa-se a ele como parte;
 *   · `parcial` — o pagamento é MENOR que a nota (R$ 400 mil de nota pagos
 *                 em duas vezes de R$ 200 mil): anexa-se e o restante vira
 *                 parcela em aberto.
 * As duas relações são sempre sugestão (`ambiguo`), nunca `certo`: exigem
 * que o candidato cite o número da nota, ou que seja do mesmo CNPJ dentro de
 * 90 dias da emissão — CNPJ sozinho continua não sendo indício de nada.
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
  /** Emissão da nota (AAAA-MM-DD): abre a janela de 90 dias para o mesmo CNPJ. */
  dataEmissao?: string | null;
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
  /** Soma das notas já anexadas a este lançamento — o que dele já tem nota. */
  coberto_por_notas?: number | null;
};

/** Como o candidato se relaciona com a nota, em valor. */
export type RelacaoComANota = 'igual' | 'parte' | 'parcial';

export type Sugestao = {
  recebimento: RecebimentoCandidato;
  motivos: string[];
  relacao: RelacaoComANota;
  /** `parte`: quanto do pagamento fica sem nota depois desta; `parcial`: quanto da nota fica em aberto. */
  restante: number;
};

export type ResultadoDaBusca =
  | { veredito: 'certo'; recebimento: RecebimentoCandidato; motivos: string[] }
  | { veredito: 'ambiguo'; sugestoes: Sugestao[] }
  | { veredito: 'nenhum' };

export const JANELA_MESMO_CNPJ_DIAS = 90;

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

const CENTAVO = 0.005;
const mesmoValor = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < CENTAVO;
const chaveLimpa = (s: string | null | undefined) => (s ?? '').replace(/\D+/g, '');
const round2 = (n: number) => Math.round(n * 100) / 100;

function diasEntre(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(`${String(a).slice(0, 10)}T12:00:00Z`);
  const tb = Date.parse(`${String(b).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(ta - tb) / 86400000;
}

/** A parte de um pagamento que ainda não tem nota anexada. */
export function sobraSemNota(c: RecebimentoCandidato): number {
  return round2(Math.max(0, Number(c.valor) - (Number(c.coberto_por_notas) || 0)));
}

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
  const valorNota = Number(nota.valor) || 0;
  const sugestoes: Sugestao[] = [];
  const fortes: Sugestao[] = [];
  for (const c of livres) {
    const motivos: string[] = [];
    const citaNumero = !!numero && (
      numeroDaNota(c.numero_documento) === numero
      || textoCitaNota(c.descricao, numero)
      || textoCitaNota(c.numero_documento, numero)
    );
    const valorIgual = mesmoValor(c.valor, valorNota);
    const mesmoCnpj = cnpj.length >= 11 && chaveLimpa(c.pessoa_documento) === cnpj;
    const dias = diasEntre(nota.dataEmissao, c.data_realizado ?? c.data_competencia);
    const naJanela = mesmoCnpj && dias !== null && dias <= JANELA_MESMO_CNPJ_DIAS;
    if (citaNumero) motivos.push(`cita a nota ${numero}`);
    if (valorIgual) motivos.push('mesmo valor');
    if (mesmoCnpj) motivos.push('mesmo CNPJ');
    if (citaNumero && !valorIgual) motivos.push('valor diferente do da nota');

    if (valorIgual || citaNumero) {
      // O caminho de 21/09: igual, ou cita a nota. Quando cita com valor
      // diferente, a relação diz o lado: pagamento maior (parte) ou menor
      // (parcial) — e o restante, em reais.
      let relacao: RelacaoComANota = 'igual';
      let restante = 0;
      if (!valorIgual && valorNota > 0) {
        if (Number(c.valor) > valorNota) {
          relacao = 'parte';
          restante = round2(sobraSemNota(c) - valorNota);
          motivos.push('pagamento maior que a nota — pode cobrir mais de uma');
        } else {
          relacao = 'parcial';
          restante = round2(valorNota - Number(c.valor));
          motivos.push('pagamento menor que a nota — parte dela');
        }
      }
      const s: Sugestao = { recebimento: c, motivos, relacao, restante };
      sugestoes.push(s);
      if (citaNumero && valorIgual) fortes.push(s);
      continue;
    }

    // Sem número e sem valor igual: só o mesmo CNPJ dentro da janela abre a
    // hipótese do fracionado — e só se o valor deixar (pagamento com sobra
    // que cobre a nota, ou pagamento menor que ela).
    if (naJanela && valorNota > 0) {
      if (Number(c.valor) > valorNota && sobraSemNota(c) + CENTAVO >= valorNota) {
        motivos.push(`pagamento ${dias === 0 ? 'no dia' : `a ${Math.round(dias!)} dia(s)`} da emissão, maior que a nota — pode cobrir mais de uma`);
        sugestoes.push({ recebimento: c, motivos, relacao: 'parte', restante: round2(sobraSemNota(c) - valorNota) });
      } else if (Number(c.valor) < valorNota) {
        motivos.push(`pagamento ${dias === 0 ? 'no dia' : `a ${Math.round(dias!)} dia(s)`} da emissão, menor que a nota — parte dela`);
        sugestoes.push({ recebimento: c, motivos, relacao: 'parcial', restante: round2(valorNota - Number(c.valor)) });
      }
    }
    // CNPJ sozinho não é indício de NADA: a empresa paga o mesmo fornecedor
    // muitas vezes. Só entra acompanhado de número, de valor, ou da janela.
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
  // Mais de um forte, ou só indícios (número sem valor, valor sem número,
  // fracionado): quem opera decide, vendo os motivos de cada um. Quem cita a
  // nota vem antes de quem só tem CNPJ e janela.
  const peso = (s: Sugestao) => (s.motivos.some((m) => m.startsWith('cita a nota')) ? 10 : 0) + s.motivos.length;
  return {
    veredito: 'ambiguo',
    sugestoes: sugestoes.sort((a, b) => peso(b) - peso(a)),
  };
}
