/**
 * Ler o boleto pela linha digitável.
 *
 * É o equivalente da chave de acesso para o mundo do que se paga: uma
 * sequência com dígito verificador, que carrega **valor e vencimento**. Não
 * depende de layout, de emissor, nem de OCR acertar coluna — ou os dígitos
 * fecham, ou não é linha digitável.
 *
 * Cobre o grosso de Contas a Pagar: energia, internet, INSS, Simples Nacional,
 * tarifas bancárias, parcelamentos. Era o lado sem leitura nenhuma.
 *
 * ── Dois formatos, dois algoritmos ──────────────────────────────────────────
 *
 *   BANCÁRIO      47 dígitos. Três campos com DV por módulo 10, um DV geral
 *                 por módulo 11, fator de vencimento e valor.
 *
 *   ARRECADAÇÃO   48 dígitos, começa com 8. Tributos e concessionárias.
 *                 Quatro blocos de 11 + DV cada. Traz valor; vencimento, não.
 */

// ── Dígitos verificadores ────────────────────────────────────────────────────

/** Módulo 10: pesos 2 e 1 alternados da direita, somando os dígitos do produto. */
export function moduloDez(campo: string): number | null {
  const d = String(campo ?? '').replace(/\D/g, '');
  if (!d) return null;
  let soma = 0;
  let peso = 2;
  for (let i = d.length - 1; i >= 0; i--) {
    const p = Number(d[i]) * peso;
    // 14 vira 1+4. Somar 14 direto é o erro clássico deste algoritmo.
    soma += p > 9 ? Math.floor(p / 10) + (p % 10) : p;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/**
 * Módulo 11 do código de barras bancário: pesos 2..9 da direita.
 *
 * Resto que produziria 0, 10 ou 11 vira 1 — é a regra da FEBRABAN, e ignorá-la
 * recusa boletos válidos.
 */
export function moduloOnzeBarras(barras43: string): number | null {
  const d = String(barras43 ?? '').replace(/\D/g, '');
  if (d.length !== 43) return null;
  let soma = 0;
  let peso = 2;
  for (let i = d.length - 1; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv > 9 ? 1 : dv;
}

/** Módulo 11 da arrecadação: pesos 2..9, mas resto 0 ou 1 produz zero. */
export function moduloOnzeArrecadacao(bloco: string): number | null {
  const d = String(bloco ?? '').replace(/\D/g, '');
  if (!d) return null;
  let soma = 0;
  let peso = 2;
  for (let i = d.length - 1; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  if (resto === 0) return 0;
  if (resto === 1) return 0;
  return 11 - resto;
}

// ── Fator de vencimento ──────────────────────────────────────────────────────

/**
 * 07/10/1997 é o DIA ZERO do primeiro ciclo — não o fator 1000.
 *
 * Errei isso na primeira versão e as âncoras conhecidas denunciaram: fator
 * 1000 é 03/07/2000 e fator 9999 é 21/02/2025, que é o dia em que o contador
 * estourou. Tratando 1997 como fator 1000, os dois caíam anos fora.
 */
const BASE_CICLO_1 = Date.UTC(1997, 9, 7);
/** 22/02/2025 é o fator 1000 do segundo — o contador estourou em 9999. */
const BASE_CICLO_2 = Date.UTC(2025, 1, 22);
const DIA = 86_400_000;

/**
 * A data que o fator representa.
 *
 * ── Por que isso não é um cálculo só ────────────────────────────────────────
 *
 * O fator conta dias desde 07/10/1997 e vai até 9999 — que caiu em 21/02/2025.
 * No dia seguinte ele voltou a 1000. Desde então, o MESMO fator descreve duas
 * datas separadas por 27 anos, e o número sozinho não diz qual.
 *
 * Muito sistema em produção ignora o estouro e devolve datas de 1998 para
 * boletos de hoje. Aqui os dois ciclos são calculados e vence o que cai mais
 * perto da referência — que é a leitura certa em ambos os casos: fator baixo
 * lido em 2026 é do ciclo novo; fator alto (9000+) é boleto antigo, do ciclo
 * velho, e a proximidade escolhe sozinha.
 */
export function dataDoFator(fator: number | string, referenciaISO: string): string | null {
  const f = Number(String(fator ?? '').replace(/\D/g, ''));
  // Fator 0 significa "sem vencimento" — boleto de valor a combinar.
  if (!Number.isFinite(f) || f < 1000 || f > 9999) return null;

  const ref = Date.parse(`${referenciaISO}T12:00:00Z`);
  if (!Number.isFinite(ref)) return null;

  const candidatas = [
    // Ciclo 1: dias corridos desde o dia zero.
    BASE_CICLO_1 + f * DIA,
    // Ciclo 2: o contador reiniciou em 1000, então 22/02/2025 é o fator 1000.
    BASE_CICLO_2 + (f - 1000) * DIA,
  ];
  const escolhida = candidatas.reduce((a, b) =>
    Math.abs(b - ref) < Math.abs(a - ref) ? b : a);
  return new Date(escolhida).toISOString().slice(0, 10);
}

// ── A leitura ────────────────────────────────────────────────────────────────

export type DadosDoBoleto = {
  formato: 'bancario' | 'arrecadacao';
  linha: string;
  valor: number | null;
  /** Só o bancário carrega vencimento. */
  vencimento: string | null;
  /** Código do banco, no bancário. */
  banco: string | null;
};

/** Recompõe o código de barras de 44 dígitos a partir da linha digitável. */
function barrasDoBancario(ld: string): string {
  //  banco+moeda        DV geral   fator+valor      campo livre
  return ld.slice(0, 4) + ld[32] + ld.slice(33, 47)
    + ld.slice(4, 9) + ld.slice(10, 20) + ld.slice(21, 31);
}

/**
 * Confere e interpreta uma linha digitável.
 *
 * Devolve `null` quando algum dígito verificador não fecha. Isso é o ponto: um
 * número comprido qualquer não vira boleto, e valor e vencimento só chegam ao
 * lançamento quando a própria linha os confirma.
 */
export function lerLinhaDigitavel(valor: unknown, referenciaISO: string): DadosDoBoleto | null {
  const d = String(valor ?? '').replace(/\D/g, '');

  if (d.length === 47) {
    // Os três campos, cada um com seu módulo 10.
    if (moduloDez(d.slice(0, 9)) !== Number(d[9])) return null;
    if (moduloDez(d.slice(10, 20)) !== Number(d[20])) return null;
    if (moduloDez(d.slice(21, 31)) !== Number(d[31])) return null;

    const barras = barrasDoBancario(d);
    // O DV geral está na posição 5 do código de barras; o cálculo é sobre os
    // outros 43 dígitos.
    const semDv = barras.slice(0, 4) + barras.slice(5);
    if (moduloOnzeBarras(semDv) !== Number(barras[4])) return null;

    const centavos = Number(d.slice(37, 47));
    return {
      formato: 'bancario',
      linha: d,
      // Valor zerado é "a combinar" — comum em boleto de cobrança aberta. Não
      // é o mesmo que R$ 0,00, e preencher zero apagaria o valor do lançamento.
      valor: centavos > 0 ? centavos / 100 : null,
      vencimento: dataDoFator(d.slice(33, 37), referenciaISO),
      banco: d.slice(0, 3),
    };
  }

  if (d.length === 48) {
    // Arrecadação: quatro blocos de 11 dígitos, cada um seguido do seu DV.
    if (d[0] !== '8') return null;
    // A posição 3 do código de barras diz qual módulo usa — 6 e 7 são módulo
    // 10; 8 e 9, módulo 11. Usar o errado recusa metade das guias.
    const porDez = d[2] === '6' || d[2] === '7';
    const calc = porDez ? moduloDez : moduloOnzeArrecadacao;
    let barras = '';
    for (let b = 0; b < 4; b++) {
      const bloco = d.slice(b * 12, b * 12 + 11);
      if (calc(bloco) !== Number(d[b * 12 + 11])) return null;
      barras += bloco;
    }
    const centavos = Number(barras.slice(4, 15));
    return {
      formato: 'arrecadacao',
      linha: d,
      valor: centavos > 0 ? centavos / 100 : null,
      // O código da arrecadação não carrega vencimento. Inventar um a partir
      // do campo livre seria adivinhar: cada convênio o usa de um jeito.
      vencimento: null,
      banco: null,
    };
  }

  return null;
}

/**
 * Acha a linha digitável no texto do boleto.
 *
 * Por TRECHOS, como a chave de acesso — dígitos separados só por espaço,
 * ponto, hífen ou barra, sem letra no meio. É como o papel a imprime
 * ("34191.79001 01043.510047 91020.150008 8 91230000103500"), e é o que a
 * separa do CNPJ e do código do cliente na mesma página.
 */
export function acharLinhaDigitavel(texto: string, referenciaISO: string): DadosDoBoleto | null {
  const trechos = String(texto ?? '').split(/[^\d .\-/]+/);
  for (const trecho of trechos) {
    const d = trecho.replace(/\D/g, '');
    if (d.length !== 47 && d.length !== 48) continue;
    const lido = lerLinhaDigitavel(d, referenciaISO);
    if (lido) return lido;
  }
  // Trecho maior: a linha pode vir emendada com outro número. Desliza as duas
  // janelas — e o DV é que separa a linha do resto.
  for (const trecho of trechos) {
    const d = trecho.replace(/\D/g, '');
    if (d.length <= 48) continue;
    for (const tam of [47, 48]) {
      for (let i = 0; i + tam <= d.length; i++) {
        const lido = lerLinhaDigitavel(d.slice(i, i + tam), referenciaISO);
        if (lido) return lido;
      }
    }
  }
  return null;
}
