import { describe, it, expect } from 'vitest';
import {
  somarDiasCorridos,
  somarDiasUteis,
  limiteDeEntrega,
  diasAte,
  situacaoDoPrazo,
} from '@/lib/contratos/prazo-de-entrega';

describe('somarDiasCorridos', () => {
  it('atravessa o fim do mês', () => {
    expect(somarDiasCorridos('2026-08-29', 5)).toBe('2026-09-03');
  });

  it('não perde um dia por causa de UTC', () => {
    // `new Date('2026-08-29')` é meia-noite UTC e, no fuso do Brasil, volta
    // para 28. Foi esse defeito que produziu 25 datas erradas no Financeiro.
    expect(somarDiasCorridos('2026-08-29', 0)).toBe('2026-08-29');
  });

  it('atravessa a virada do ano', () => {
    expect(somarDiasCorridos('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('somarDiasUteis', () => {
  it('pula o fim de semana', () => {
    // 2026-08-28 é uma sexta. +1 útil = segunda, 31.
    expect(somarDiasUteis('2026-08-28', 1)).toBe('2026-08-31');
  });

  it('dez dias úteis não são dez corridos', () => {
    // O ponto inteiro de guardar a unidade: a diferença é de quatro dias.
    expect(somarDiasUteis('2026-08-31', 10)).toBe('2026-09-14');
    expect(somarDiasCorridos('2026-08-31', 10)).toBe('2026-09-10');
  });

  it('desconta feriado informado', () => {
    // 07/09/2026 é uma segunda-feira (Independência).
    expect(somarDiasUteis('2026-09-04', 1, ['2026-09-07'])).toBe('2026-09-08');
    expect(somarDiasUteis('2026-09-04', 1)).toBe('2026-09-07');
  });
});

describe('limiteDeEntrega', () => {
  it('respeita a unidade gravada', () => {
    expect(limiteDeEntrega('2026-08-31', { dias: 10, unidade: 'corridos' })).toBe('2026-09-10');
    expect(limiteDeEntrega('2026-08-31', { dias: 10, unidade: 'uteis' })).toBe('2026-09-14');
  });

  it('sem prazo no contrato, devolve null em vez de inventar', () => {
    // Inventar "30 dias porque é o usual" produz aviso com cara de obrigação
    // contratual que não é obrigação nenhuma.
    expect(limiteDeEntrega('2026-08-31', { dias: null, unidade: null })).toBeNull();
    expect(limiteDeEntrega('2026-08-31', { dias: 0, unidade: 'corridos' })).toBeNull();
  });

  it('sem data de pedido, não há de onde contar', () => {
    expect(limiteDeEntrega(null, { dias: 10, unidade: 'corridos' })).toBeNull();
  });
});

describe('diasAte', () => {
  it('conta para a frente e para trás', () => {
    expect(diasAte('2026-09-10', '2026-08-31')).toBe(10);
    expect(diasAte('2026-08-25', '2026-08-31')).toBe(-6);
    expect(diasAte('2026-08-31', '2026-08-31')).toBe(0);
  });
});

describe('situacaoDoPrazo', () => {
  const prazo = { dias: 10, unidade: 'corridos' as const };

  it('sem prazo registrado não é "no prazo"', () => {
    const s = situacaoDoPrazo('2026-08-31', { dias: null, unidade: null });
    expect(s.estado).toBe('sem_prazo');
    expect(s.limite).toBeNull();
    expect(s.frase).toMatch(/não registrado/i);
  });

  it('acusa vencido com o número de dias', () => {
    const s = situacaoDoPrazo('2026-08-01', prazo, { hoje: '2026-08-31' });
    expect(s.estado).toBe('vencido');
    expect(s.dias).toBe(-20);
    expect(s.frase).toMatch(/vencido há 20 dia/);
  });

  it('separa o vencimento de hoje', () => {
    const s = situacaoDoPrazo('2026-08-21', prazo, { hoje: '2026-08-31' });
    expect(s.estado).toBe('vence_hoje');
    expect(s.frase).toMatch(/HOJE/);
  });

  it('a janela de "apertado" acompanha o tamanho do prazo', () => {
    // Prazo de 10 → janela de 4 dias (⌈10/3⌉).
    expect(situacaoDoPrazo('2026-08-28', prazo, { hoje: '2026-09-04' }).estado).toBe('apertado');
    expect(situacaoDoPrazo('2026-08-31', prazo, { hoje: '2026-09-04' }).estado).toBe('no_prazo');
  });

  it('num prazo curto a janela não pode ser maior que o prazo', () => {
    // Prazo de 3 dias: piso de 2, senão o aviso nasceria junto com o pedido.
    const s = situacaoDoPrazo('2026-08-31', { dias: 3, unidade: 'corridos' }, { hoje: '2026-08-31' });
    expect(s.estado).toBe('no_prazo');
    expect(s.dias).toBe(3);
  });

  it('num prazo longo a janela não passa de 7 dias', () => {
    // Prazo de 90: ⌈90/3⌉ = 30, mas o teto corta em 7.
    const s = situacaoDoPrazo('2026-08-31', { dias: 90, unidade: 'corridos' }, { hoje: '2026-11-23' });
    expect(s.estado).toBe('apertado');
    expect(s.dias).toBeLessThanOrEqual(7);
  });

  it('entrega feita encerra a contagem e registra o atraso', () => {
    const s = situacaoDoPrazo('2026-08-01', prazo, { entregueEm: '2026-08-15' });
    expect(s.estado).toBe('entregue');
    expect(s.frase).toMatch(/4 dia\(s\) de atraso/);
  });

  it('entrega no prazo diz que foi no prazo', () => {
    const s = situacaoDoPrazo('2026-08-01', prazo, { entregueEm: '2026-08-08' });
    expect(s.estado).toBe('entregue');
    expect(s.frase).toMatch(/dentro do prazo/);
  });
});
