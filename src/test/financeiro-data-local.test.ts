import { describe, it, expect, afterEach, vi } from 'vitest';
import { dataLocal, hojeLocal, somarDiasLocal, mesLocal } from '@/lib/financeiro/data-local';

/**
 * O defeito que estes testes guardam: `new Date().toISOString().slice(0, 10)`
 * devolve a data em UTC. No Brasil (UTC−3) isso vira um dia inteiro de erro
 * das 21h à meia-noite — a conta a pagar de hoje aparecia como atraso, e
 * "Receber hoje" mostrava os vencimentos de amanhã.
 *
 * A hora é fixada com fake timers em vez de trocar o TZ do processo, porque
 * `process.env.TZ` só tem efeito antes de o runtime cachear o fuso, e falhava
 * de forma diferente entre rodar o arquivo sozinho e rodar a suíte inteira.
 */

afterEach(() => { vi.useRealTimers(); });

/** Fixa o relógio numa hora LOCAL da máquina que roda o teste. */
function congelar(ano: number, mes: number, dia: number, hora: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(ano, mes - 1, dia, hora, 30, 0, 0));
}

describe('data local do Financeiro', () => {
  it('às 22h ainda é hoje — não amanhã', () => {
    congelar(2026, 8, 25, 22);
    expect(hojeLocal()).toBe('2026-08-25');

    // A prova do defeito: em fuso negativo, o UTC já virou.
    const emUtc = new Date().toISOString().slice(0, 10);
    if (new Date().getTimezoneOffset() > 0) {
      expect(emUtc).toBe('2026-08-26');
      expect(hojeLocal()).not.toBe(emUtc);
    }
  });

  it('à 1h da manhã já é o dia novo', () => {
    congelar(2026, 8, 26, 1);
    expect(hojeLocal()).toBe('2026-08-26');
  });

  it('atravessa a virada do mês e do ano', () => {
    congelar(2026, 12, 31, 23);
    expect(hojeLocal()).toBe('2026-12-31');
    expect(somarDiasLocal(1)).toBe('2027-01-01');
    expect(mesLocal()).toBe('2026-12');
  });

  it('somarDiasLocal anda para frente e para trás', () => {
    congelar(2026, 3, 1, 20);
    expect(somarDiasLocal(0)).toBe('2026-03-01');
    expect(somarDiasLocal(10)).toBe('2026-03-11');
    expect(somarDiasLocal(-30)).toBe('2026-01-30');
  });

  it('respeita ano bissexto', () => {
    congelar(2028, 2, 28, 12);
    expect(somarDiasLocal(1)).toBe('2028-02-29');
    expect(somarDiasLocal(2)).toBe('2028-03-01');
  });

  it('dataLocal formata com dois dígitos', () => {
    expect(dataLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dataLocal(new Date(2026, 10, 30))).toBe('2026-11-30');
  });

  it('a janela de 10 dias do painel não repete nem pula data', () => {
    congelar(2026, 8, 25, 23);
    const dias = Array.from({ length: 10 }, (_, i) => somarDiasLocal(i));
    expect(new Set(dias).size).toBe(10);
    expect(dias[0]).toBe('2026-08-25');
    expect(dias[9]).toBe('2026-09-03');
  });
});
