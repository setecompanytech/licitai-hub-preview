import { deDataLocal } from '@/lib/financeiro/data-local';

/**
 * A projeção diária do caixa — UMA fórmula, usada pelo hook e pela tela.
 *
 * ── O defeito que este módulo encerra (19/09/2026, ETHOS) ────────────────
 *
 * A tela dizia "saldo projetado fica negativo em 32 dia(s) — primeiro dia
 * crítico 04/08/2026", com 04/08 quarenta e seis dias NO PASSADO. Três erros
 * sobrepostos, todos no `useMemo` do cenário em `FinFluxoCaixa.tsx`:
 *
 *  1. re-somava o PASSADO: os realizados de agosto já estão dentro do saldo
 *     das contas (`saldo_atual`), e o acumulado os somava de novo — a curva
 *     despencava no primeiro ponto. O hook tinha o guarda (correção A8 de
 *     02/09), a tela não; a correção foi anulada em silêncio pela cópia;
 *  2. sem corte em "hoje": o primeiro dia negativo podia ser uma data passada;
 *  3. "N dia(s)" contava LINHAS da view (datas com título), não dias.
 *
 * Regras daqui:
 *  - realizado NUNCA entra no acumulado, em data nenhuma — está no saldo;
 *  - previsto com data ≥ hoje entra no seu dia, com o multiplicador do cenário;
 *  - previsto VENCIDO e não baixado (data < hoje) não some: entra no primeiro
 *    dia projetado, como o que ainda vai sair/entrar da conta — e é devolvido
 *    em separado (`atrasados`) para a tela dizer quanto é;
 *  - o passado fica nas barras (entradas/saídas do dia), com a linha do
 *    acumulado parada no saldo atual;
 *  - "primeiro dia negativo" e "menor saldo" só olham hoje em diante, e a
 *    contagem é em dias-calendário a partir de hoje.
 */

export type LinhaDoFluxo = {
  data: string;
  entradas_previstas: number;
  saidas_previstas: number;
  entradas_realizadas: number;
  saidas_realizadas: number;
};

export type DiaProjetado = LinhaDoFluxo & {
  saldo_dia: number;
  saldo_acumulado: number;
  /** Data anterior a hoje: barras informativas, acumulado parado. */
  passado: boolean;
};

export type Projecao = {
  dias: DiaProjetado[];
  saldoInicial: number;
  saldoFinal: number;
  /** Menor acumulado de hoje em diante (inclui o saldo inicial). */
  menorSaldo: number;
  /** Primeiro dia (≥ hoje) em que o acumulado fica abaixo de zero. */
  primeiroNegativo: { data: string; saldo: number; emDias: number } | null;
  /** Dias-calendário com acumulado negativo, de hoje em diante. */
  diasNegativos: number;
  /** Previstos vencidos e não baixados, considerados em hoje. */
  atrasados: { entradas: number; saidas: number; total: number };
};

export function acumularProjecao(entrada: {
  saldoInicial: number;
  linhas: LinhaDoFluxo[];
  hoje: string;
  entradaMul?: number;
  saidaMul?: number;
}): Projecao {
  const { saldoInicial, linhas, hoje, entradaMul = 1, saidaMul = 1 } = entrada;
  const ordenadas = [...linhas].sort((a, b) => a.data.localeCompare(b.data));

  // Vencidos e não pagos: vão para o primeiro dia projetado.
  const atrasados = ordenadas
    .filter((l) => l.data < hoje)
    .reduce(
      (acc, l) => ({
        entradas: acc.entradas + l.entradas_previstas * entradaMul,
        saidas: acc.saidas + l.saidas_previstas * saidaMul,
      }),
      { entradas: 0, saidas: 0 },
    );
  let atrasadosPendentes = atrasados.entradas - atrasados.saidas;

  let acumulado = saldoInicial;
  let menorSaldo = saldoInicial;
  let primeiroNegativo: Projecao['primeiroNegativo'] = null;
  let ultimaDataNegativa: string | null = null;
  let diasNegativos = 0;

  const dias: DiaProjetado[] = ordenadas.map((l) => {
    const passado = l.data < hoje;
    const previstasEntrada = l.entradas_previstas * entradaMul;
    const previstasSaida = l.saidas_previstas * saidaMul;
    const saldo_dia = previstasEntrada + l.entradas_realizadas - previstasSaida - l.saidas_realizadas;

    if (!passado) {
      acumulado += previstasEntrada - previstasSaida + atrasadosPendentes;
      atrasadosPendentes = 0;
      if (acumulado < menorSaldo) menorSaldo = acumulado;
      if (acumulado < 0) {
        if (!primeiroNegativo) {
          primeiroNegativo = { data: l.data, saldo: acumulado, emDias: diasEntre(hoje, l.data) };
        }
        ultimaDataNegativa = l.data;
      }
    }

    return {
      ...l,
      entradas_previstas: previstasEntrada,
      saidas_previstas: previstasSaida,
      saldo_dia,
      saldo_acumulado: acumulado,
      passado,
    };
  });

  // Sem linha futura nenhuma, os atrasados ainda pesam no saldo de hoje.
  if (atrasadosPendentes !== 0) {
    acumulado += atrasadosPendentes;
    if (acumulado < menorSaldo) menorSaldo = acumulado;
    if (acumulado < 0 && !primeiroNegativo) {
      primeiroNegativo = { data: hoje, saldo: acumulado, emDias: 0 };
      ultimaDataNegativa = hoje;
    }
  }

  if (primeiroNegativo && ultimaDataNegativa) {
    // A curva, uma vez negativa, só volta se houver entrada suficiente; entre o
    // primeiro e o último dia negativo conta-se o calendário inteiro.
    diasNegativos = diasEntre(primeiroNegativo.data, ultimaDataNegativa) + 1;
  }

  return {
    dias,
    saldoInicial,
    saldoFinal: acumulado,
    menorSaldo,
    primeiroNegativo,
    diasNegativos,
    atrasados: { ...atrasados, total: atrasados.entradas - atrasados.saidas },
  };
}

/** Dias-calendário de `de` até `ate` (ambos AAAA-MM-DD), sem fuso. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((deDataLocal(ate).getTime() - deDataLocal(de).getTime()) / 86_400_000);
}
