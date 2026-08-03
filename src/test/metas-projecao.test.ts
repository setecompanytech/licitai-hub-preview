import { describe, it, expect } from 'vitest';
import {
  calcularTxGanho, calcularTxFaturamento, calcularTicketPonderado,
  calcularIndiceSazonal, projetarMeta, avaliarAlerta,
  type HistoricoMes, type ParametrosMotor, type TicketModalidade,
} from '@/lib/metas/projecao';

/** Atalho: reais → centavos, para o teste ficar legível. */
const R$ = (reais: number) => Math.round(reais * 100);

const PARAMETROS: ParametrosMotor = {
  txGanhoPadrao: 0.2,
  txFaturamentoPadrao: 0.7,
  minAmostraTicket: 3,
  minAnosSazonalidade: 2,
};

const VALORES_ALVO = {
  pregao_eletronico: R$(300_000),
  dispensa: R$(100_000),
};

/**
 * Histórico construído para produzir exatamente as premissas do exemplo do
 * plano aprovado: conversão 25%, faturamento 80% e fevereiro com índice 1,35.
 */
const HISTORICO: HistoricoMes[] = [
  { ano: 2024, mes: 2,  participados: 25, ganhos: 6, valorGanhoCent: R$(125_000), valorFaturadoCent: R$(135_000) },
  { ano: 2025, mes: 2,  participados: 25, ganhos: 6, valorGanhoCent: R$(125_000), valorFaturadoCent: R$(135_000) },
  { ano: 2025, mes: 6,  participados: 25, ganhos: 6, valorGanhoCent: R$(125_000), valorFaturadoCent: R$(65_000) },
  { ano: 2025, mes: 10, participados: 25, ganhos: 7, valorGanhoCent: R$(125_000), valorFaturadoCent: R$(65_000) },
];

const TICKETS: TicketModalidade[] = [
  { modalidade: 'pregao_eletronico', amostra: 10, ticketCent: R$(300_000), mix: 0.7 },
  { modalidade: 'dispensa',          amostra: 5,  ticketCent: R$(100_000), mix: 0.3 },
];

// ─── Premissas isoladas ───────────────────────────────────────────────────────

describe('calcularTxGanho', () => {
  it('usa a conversão real do histórico', () => {
    const r = calcularTxGanho(HISTORICO, PARAMETROS.txGanhoPadrao);
    expect(r.valor).toBeCloseTo(0.25, 10); // 25 ganhos / 100 participados
    expect(r.confianca).toBe('alta');
  });

  it('sem participações, cai no padrão conservador e sinaliza baixa confiança', () => {
    const r = calcularTxGanho([], 0.2);
    expect(r.valor).toBe(0.2);
    expect(r.confianca).toBe('baixa');
  });

  it('histórico só de derrotas não zera a taxa — zero travaria a divisão', () => {
    const semGanhos: HistoricoMes[] = [
      { ano: 2025, mes: 1, participados: 30, ganhos: 0, valorGanhoCent: 0, valorFaturadoCent: 0 },
    ];
    const r = calcularTxGanho(semGanhos, 0.2);
    expect(r.valor).toBe(0.2);
    expect(r.confianca).toBe('baixa');
  });
});

describe('calcularTxFaturamento', () => {
  it('usa a razão faturado / ganho do histórico', () => {
    const r = calcularTxFaturamento(HISTORICO, PARAMETROS.txFaturamentoPadrao);
    expect(r.valor).toBeCloseTo(0.8, 10); // 400k faturado / 500k ganho
    expect(r.confianca).toBe('alta');
  });

  it('sem valor ganho, cai no padrão', () => {
    const r = calcularTxFaturamento([], 0.7);
    expect(r.valor).toBe(0.7);
    expect(r.confianca).toBe('baixa');
  });
});

describe('calcularTicketPonderado', () => {
  it('pondera pelo mix da carteira', () => {
    const r = calcularTicketPonderado(TICKETS, VALORES_ALVO, 3);
    // 0,7 × 300.000 + 0,3 × 100.000 = 240.000
    expect(r.valorCent).toBe(R$(240_000));
    expect(r.confianca).toBe('alta');
  });

  it('modalidade com amostra insuficiente usa o valor-alvo parametrizado', () => {
    const poucos: TicketModalidade[] = [
      { modalidade: 'pregao_eletronico', amostra: 1, ticketCent: R$(50_000), mix: 1 },
    ];
    const r = calcularTicketPonderado(poucos, VALORES_ALVO, 3);
    expect(r.valorCent).toBe(R$(300_000)); // ignorou os 50k e usou o alvo
    expect(r.confianca).toBe('baixa');
    expect(r.modalidadesSemHistorico).toContain('pregao_eletronico');
  });

  it('sem carteira conhecida, usa a média dos valores-alvo', () => {
    const r = calcularTicketPonderado([], VALORES_ALVO, 3);
    expect(r.valorCent).toBe(R$(200_000)); // (300k + 100k) / 2
    expect(r.confianca).toBe('baixa');
  });
});

describe('calcularIndiceSazonal', () => {
  it('mede o mês contra a média geral', () => {
    const r = calcularIndiceSazonal(HISTORICO, 2, 2);
    expect(r.valor).toBeCloseTo(1.35, 10);
    expect(r.confianca).toBe('alta');
  });

  it('sem anos suficientes, fica neutro em vez de inventar tendência', () => {
    const r = calcularIndiceSazonal(HISTORICO, 6, 2); // junho aparece em 1 ano só
    expect(r.valor).toBe(1);
    expect(r.confianca).toBe('baixa');
  });
});

// ─── Projeção completa ────────────────────────────────────────────────────────

describe('projetarMeta — exemplo do plano aprovado', () => {
  // Meta R$ 900.000, realizado R$ 240.000, 11/02/2026 (8º dia útil de 20)
  const projecao = projetarMeta({
    metaCent: R$(900_000),
    realizadoCent: R$(240_000),
    ano: 2026,
    mes: 2,
    hoje: '2026-02-11',
    historico: HISTORICO,
    tickets: TICKETS,
    valoresAlvoCent: VALORES_ALVO,
    parametros: PARAMETROS,
  });

  it('apura o restante para a meta', () => {
    expect(projecao.restanteCent).toBe(R$(660_000));
  });

  it('exige 4 contratos — ceil(660.000 / 192.000), nunca 3,44', () => {
    expect(projecao.contratosNecessarios).toBe(4);
  });

  it('exige 16 participações — 4 contratos com 25% de conversão', () => {
    expect(projecao.participacoesNecessarias).toBe(16);
  });

  it('mede ritmo de R$ 30.000 por dia útil', () => {
    expect(projecao.ritmoDiarioCent).toBe(R$(30_000));
    expect(projecao.diasUteisDecorridos).toBe(8);
    expect(projecao.diasUteisRestantes).toBe(12);
  });

  it('projeta o fim do mês em R$ 726.000, já com a sazonalidade de 1,35', () => {
    expect(projecao.projecaoFimMesCent).toBe(R$(726_000));
  });

  it('exige R$ 55.000 por dia útil, 83% acima do ritmo atual', () => {
    expect(projecao.runRateNecessarioCent).toBe(R$(55_000));
    expect(projecao.gapRitmo).toBeCloseTo(0.8333, 4);
  });

  it('marca confiança alta porque toda premissa veio de histórico', () => {
    expect(projecao.premissas.confianca).toBe('alta');
    expect(projecao.premissas.motivosBaixaConfianca).toEqual([]);
    expect(projecao.premissas.ticketPonderadoCent).toBe(R$(240_000));
    expect(projecao.premissas.indiceSazonal).toBeCloseTo(1.35, 10);
  });
});

describe('projetarMeta — casos de borda', () => {
  const base = {
    ano: 2026, mes: 2, hoje: '2026-02-11' as const,
    historico: HISTORICO, tickets: TICKETS,
    valoresAlvoCent: VALORES_ALVO, parametros: PARAMETROS,
  };

  it('meta já batida não pede nem um processo', () => {
    const p = projetarMeta({ ...base, metaCent: R$(100_000), realizadoCent: R$(150_000) });
    expect(p.restanteCent).toBe(0);
    expect(p.contratosNecessarios).toBe(0);
    expect(p.participacoesNecessarias).toBe(0);
  });

  it('sem histórico nenhum, usa padrões conservadores e avisa a baixa confiança', () => {
    const p = projetarMeta({
      ...base,
      metaCent: R$(900_000),
      realizadoCent: 0,
      historico: [],
      tickets: [],
    });
    expect(p.premissas.txGanho).toBe(0.2);
    expect(p.premissas.txFaturamento).toBe(0.7);
    expect(p.premissas.indiceSazonal).toBe(1);
    expect(p.premissas.confianca).toBe('baixa');
    expect(p.premissas.motivosBaixaConfianca.length).toBeGreaterThan(0);
    // ticket médio dos alvos (200k) × 0,7 = 140k por contrato → ceil(900/140)
    expect(p.contratosNecessarios).toBe(Math.ceil(R$(900_000) / R$(140_000)));
  });

  it('início do mês: sem dias decorridos não há ritmo, e o gap fica indefinido', () => {
    const p = projetarMeta({ ...base, metaCent: R$(900_000), realizadoCent: 0, hoje: '2026-01-20' });
    expect(p.diasUteisDecorridos).toBe(0);
    expect(p.ritmoDiarioCent).toBe(0);
    expect(p.gapRitmo).toBeNull();
  });

  it('mês encerrado: sem dias restantes, o run rate vira o restante inteiro', () => {
    const p = projetarMeta({ ...base, metaCent: R$(900_000), realizadoCent: R$(240_000), hoje: '2026-03-15' });
    expect(p.diasUteisRestantes).toBe(0);
    expect(p.runRateNecessarioCent).toBe(R$(660_000));
  });

  it('meta zerada não divide por zero no percentual', () => {
    const p = projetarMeta({ ...base, metaCent: 0, realizadoCent: R$(10_000) });
    expect(p.percentualRealizado).toBe(0);
    expect(p.contratosNecessarios).toBe(0);
  });

  it('feriado no meio do mês reduz os dias úteis restantes', () => {
    const p = projetarMeta({
      ...base, metaCent: R$(900_000), realizadoCent: R$(240_000),
      feriados: ['2026-02-16', '2026-02-17'],
    });
    expect(p.diasUteisRestantes).toBe(10);
    expect(p.runRateNecessarioCent).toBe(R$(66_000));
  });
});

// ─── Alertas ──────────────────────────────────────────────────────────────────

describe('avaliarAlerta', () => {
  const limiares = { diasLimite: 10, percentualMinimo: 70 };

  it('não alerta fora da janela final, mesmo com realizado baixo', () => {
    expect(avaliarAlerta(
      { metaCent: R$(100_000), percentualRealizado: 0.1, diasUteisRestantes: 15 },
      limiares,
    )).toBe('nenhum');
  });

  it('não alerta quando o realizado está no limiar ou acima', () => {
    expect(avaliarAlerta(
      { metaCent: R$(100_000), percentualRealizado: 0.7, diasUteisRestantes: 5 },
      limiares,
    )).toBe('nenhum');
  });

  it('escala a severidade conforme o realizado cai', () => {
    const em = (pct: number) => avaliarAlerta(
      { metaCent: R$(100_000), percentualRealizado: pct, diasUteisRestantes: 5 },
      limiares,
    );
    expect(em(0.60)).toBe('atencao');  // < 70%
    expect(em(0.45)).toBe('risco');    // < 50%
    expect(em(0.20)).toBe('critico');  // < 30%
  });

  it('meta zerada nunca alerta — não há o que arriscar', () => {
    expect(avaliarAlerta(
      { metaCent: 0, percentualRealizado: 0, diasUteisRestantes: 1 },
      limiares,
    )).toBe('nenhum');
  });

  it('respeita limiares diferentes dos padrões', () => {
    expect(avaliarAlerta(
      { metaCent: R$(100_000), percentualRealizado: 0.8, diasUteisRestantes: 3 },
      { diasLimite: 5, percentualMinimo: 90 },
    )).toBe('atencao');
  });
});
