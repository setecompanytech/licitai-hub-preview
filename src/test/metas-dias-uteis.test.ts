import { describe, it, expect } from 'vitest';
import {
  ehFimDeSemana, ehDiaUtil, contarDiasUteis, repartirMes,
  primeiroDiaDoMes, ultimoDiaDoMes,
} from '@/lib/metas/dias-uteis';

describe('ehFimDeSemana', () => {
  it('identifica sábado e domingo', () => {
    expect(ehFimDeSemana('2026-08-01')).toBe(true); // sábado
    expect(ehFimDeSemana('2026-08-02')).toBe(true); // domingo
  });

  it('não marca dias de semana', () => {
    expect(ehFimDeSemana('2026-08-03')).toBe(false); // segunda
    expect(ehFimDeSemana('2026-08-07')).toBe(false); // sexta
  });

  it('não desloca a data por causa de fuso', () => {
    // new Date('2026-08-03') seria UTC e viraria domingo 02/08 em Brasília
    expect(ehFimDeSemana('2026-08-03')).toBe(false);
  });
});

describe('ehDiaUtil', () => {
  it('desconta feriado cadastrado', () => {
    expect(ehDiaUtil('2026-09-07')).toBe(true);
    expect(ehDiaUtil('2026-09-07', ['2026-09-07'])).toBe(false);
  });

  it('feriado que cai no fim de semana não muda nada', () => {
    expect(ehDiaUtil('2026-08-01', ['2026-08-01'])).toBe(false);
  });
});

describe('contarDiasUteis', () => {
  it('conta as duas pontas do intervalo', () => {
    // seg 03 a sex 07 de agosto/2026
    expect(contarDiasUteis('2026-08-03', '2026-08-07')).toBe(5);
  });

  it('ignora o fim de semana no meio', () => {
    expect(contarDiasUteis('2026-08-03', '2026-08-10')).toBe(6);
  });

  it('desconta feriados do intervalo', () => {
    expect(contarDiasUteis('2026-08-03', '2026-08-07', ['2026-08-05'])).toBe(4);
  });

  it('intervalo de um único dia útil vale 1', () => {
    expect(contarDiasUteis('2026-08-03', '2026-08-03')).toBe(1);
  });

  it('intervalo invertido vale 0', () => {
    expect(contarDiasUteis('2026-08-07', '2026-08-03')).toBe(0);
  });
});

describe('limites do mês', () => {
  it('acha o primeiro e o último dia', () => {
    expect(primeiroDiaDoMes(2026, 2)).toBe('2026-02-01');
    expect(ultimoDiaDoMes(2026, 2)).toBe('2026-02-28');
    expect(ultimoDiaDoMes(2024, 2)).toBe('2024-02-29'); // bissexto
    expect(ultimoDiaDoMes(2026, 8)).toBe('2026-08-31');
  });
});

describe('repartirMes', () => {
  it('fevereiro/2026 tem 20 dias úteis', () => {
    expect(repartirMes(2026, 2, '2026-02-28').totais).toBe(20);
  });

  it('conta o próprio dia de referência como decorrido', () => {
    // 11/02/2026 é o 8º dia útil do mês
    const r = repartirMes(2026, 2, '2026-02-11');
    expect(r.decorridos).toBe(8);
    expect(r.restantes).toBe(12);
    expect(r.decorridos + r.restantes).toBe(r.totais);
  });

  it('desconta feriado dos dias úteis totais', () => {
    const r = repartirMes(2026, 2, '2026-02-11', ['2026-02-16']);
    expect(r.totais).toBe(19);
    expect(r.decorridos).toBe(8);
    expect(r.restantes).toBe(11);
  });

  it('referência antes do mês: nada decorrido', () => {
    const r = repartirMes(2026, 2, '2026-01-15');
    expect(r.decorridos).toBe(0);
    expect(r.restantes).toBe(20);
  });

  it('referência depois do mês: nada restante', () => {
    const r = repartirMes(2026, 2, '2026-03-10');
    expect(r.decorridos).toBe(20);
    expect(r.restantes).toBe(0);
  });
});
