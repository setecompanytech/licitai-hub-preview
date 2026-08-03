import { describe, it, expect } from 'vitest';
import {
  inicioDaJanela, filtrarHistorico, realizadoDoMes, type LinhaRealizado,
} from '@/lib/metas/painel';
import { paraCentavos, paraReais, parseValorBRL } from '@/lib/metas/dinheiro';

const ANA = '11111111-1111-1111-1111-111111111111';
const BRUNO = '22222222-2222-2222-2222-222222222222';

const mes = (over: Partial<LinhaRealizado> & { ano: number; mes: number }): LinhaRealizado => ({
  user_id: ANA,
  participados: 0,
  ganhos: 0,
  valor_ganho: 0,
  valor_faturado: 0,
  ...over,
});

describe('inicioDaJanela', () => {
  it('volta a janela dentro do mesmo ano', () => {
    expect(inicioDaJanela(2026, 8, 6)).toBe('2026-02-01');
  });

  it('atravessa a virada do ano', () => {
    expect(inicioDaJanela(2026, 3, 6)).toBe('2025-09-01');
  });

  it('janela de 1 mês devolve o mês imediatamente anterior', () => {
    expect(inicioDaJanela(2026, 1, 1)).toBe('2025-12-01');
  });

  it('janela longa não quebra o cálculo de ano', () => {
    expect(inicioDaJanela(2026, 8, 24)).toBe('2024-08-01');
  });
});

describe('filtrarHistorico', () => {
  const linhas = [
    mes({ ano: 2026, mes: 1, participados: 10, ganhos: 2, valor_ganho: 100, valor_faturado: 70 }),
    mes({ ano: 2026, mes: 2, participados: 20, ganhos: 4 }),
    mes({ ano: 2026, mes: 7, participados: 30, ganhos: 6 }),
    mes({ ano: 2026, mes: 8, participados: 40, ganhos: 8 }),
    mes({ ano: 2026, mes: 9, participados: 50, ganhos: 10 }),
  ];

  it('exclui o mês de referência, que ainda está em andamento', () => {
    const h = filtrarHistorico(linhas, { userId: ANA, ano: 2026, mes: 8, janelaMeses: 6 });
    expect(h.map((x) => x.mes)).not.toContain(8);
  });

  it('exclui meses posteriores ao de referência', () => {
    const h = filtrarHistorico(linhas, { userId: ANA, ano: 2026, mes: 8, janelaMeses: 6 });
    expect(h.map((x) => x.mes)).not.toContain(9);
  });

  it('respeita o início da janela', () => {
    // janela de 6 meses a partir de agosto começa em fevereiro; janeiro fica fora
    const h = filtrarHistorico(linhas, { userId: ANA, ano: 2026, mes: 8, janelaMeses: 6 });
    expect(h.map((x) => x.mes)).toEqual([2, 7]);
  });

  it('filtra por colaborador', () => {
    const comBruno = [...linhas, mes({ ano: 2026, mes: 7, user_id: BRUNO, participados: 999 })];
    const h = filtrarHistorico(comBruno, { userId: ANA, ano: 2026, mes: 8, janelaMeses: 6 });
    expect(h.some((x) => x.participados === 999)).toBe(false);
  });

  it('devolve em ordem cronológica', () => {
    const embaralhado = [
      mes({ ano: 2026, mes: 7 }),
      mes({ ano: 2026, mes: 2 }),
      mes({ ano: 2026, mes: 5 }),
    ];
    const h = filtrarHistorico(embaralhado, { userId: ANA, ano: 2026, mes: 8, janelaMeses: 6 });
    expect(h.map((x) => x.mes)).toEqual([2, 5, 7]);
  });

  it('converte os valores para centavos', () => {
    const h = filtrarHistorico(linhas, { userId: ANA, ano: 2026, mes: 2, janelaMeses: 6 });
    expect(h[0].valorGanhoCent).toBe(10_000);
    expect(h[0].valorFaturadoCent).toBe(7_000);
  });

  it('sem histórico do colaborador, devolve vazio', () => {
    const h = filtrarHistorico(linhas, { userId: BRUNO, ano: 2026, mes: 8, janelaMeses: 6 });
    expect(h).toEqual([]);
  });
});

describe('realizadoDoMes', () => {
  const linhas = [
    mes({ ano: 2026, mes: 8, valor_ganho: 500_000, valor_faturado: 320_000 }),
  ];

  it('base faturamento lê o valor faturado', () => {
    const v = realizadoDoMes(linhas, { userId: ANA, ano: 2026, mes: 8, base: 'faturamento' });
    expect(v).toBe(320_000_00);
  });

  it('base contratos_ganhos lê o valor ganho', () => {
    const v = realizadoDoMes(linhas, { userId: ANA, ano: 2026, mes: 8, base: 'contratos_ganhos' });
    expect(v).toBe(500_000_00);
  });

  it('mês sem movimento vale zero, não indefinido', () => {
    const v = realizadoDoMes(linhas, { userId: ANA, ano: 2026, mes: 9, base: 'faturamento' });
    expect(v).toBe(0);
  });

  it('não mistura o realizado de outro colaborador', () => {
    const v = realizadoDoMes(linhas, { userId: BRUNO, ano: 2026, mes: 8, base: 'faturamento' });
    expect(v).toBe(0);
  });
});

describe('dinheiro', () => {
  it('converte reais para centavos inteiros', () => {
    expect(paraCentavos(1234.56)).toBe(123_456);
    expect(Number.isInteger(paraCentavos(0.1 + 0.2))).toBe(true);
  });

  it('aceita numeric vindo como string', () => {
    expect(paraCentavos('1234.56')).toBe(123_456);
  });

  it('trata nulo e texto inválido como zero', () => {
    expect(paraCentavos(null)).toBe(0);
    expect(paraCentavos(undefined)).toBe(0);
    expect(paraCentavos('abc')).toBe(0);
  });

  it('volta de centavos para reais', () => {
    expect(paraReais(123_456)).toBe(1234.56);
  });

  it('lê o formato brasileiro digitado', () => {
    expect(parseValorBRL('300.000,00')).toBe(300000);
    expect(parseValorBRL('300000,50')).toBe(300000.5);
    expect(parseValorBRL('300000')).toBe(300000);
    expect(parseValorBRL('')).toBe(0);
  });
});
