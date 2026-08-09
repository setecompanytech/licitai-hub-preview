import { describe, it, expect } from 'vitest';
import { estadoDaBarra } from '@/lib/metas/progresso';
import { avaliarAlerta } from '@/lib/metas/projecao';

describe('estadoDaBarra — os quatro estados de severidade', () => {
  it('sem alerta usa o laranja da marca', () => {
    expect(estadoDaBarra('nenhum', false).cor).toBe('bg-primary');
  });

  it('atenção usa âmbar', () => {
    expect(estadoDaBarra('atencao', false).cor).toBe('bg-warning');
  });

  it('risco e crítico usam vermelho, com pesos diferentes', () => {
    const risco = estadoDaBarra('risco', false);
    const critico = estadoDaBarra('critico', false);
    expect(risco.cor).toContain('destructive');
    expect(critico.cor).toBe('bg-destructive');
    expect(risco.cor).not.toBe(critico.cor);
  });

  it('cada estado tem rótulo próprio — cor sozinha não comunica', () => {
    const rotulos = (['nenhum', 'atencao', 'risco', 'critico'] as const)
      .map((s) => estadoDaBarra(s, false).rotulo);
    expect(new Set(rotulos).size).toBe(4);
    for (const r of rotulos) expect(r.length).toBeGreaterThan(0);
  });
});

describe('estadoDaBarra — meta atingida', () => {
  it('meta batida fica verde', () => {
    expect(estadoDaBarra('nenhum', true).cor).toBe('bg-success');
    expect(estadoDaBarra('nenhum', true).rotulo).toBe('Meta atingida');
  });

  it('meta batida vence a severidade, mesmo com poucos dias restantes', () => {
    for (const s of ['atencao', 'risco', 'critico'] as const) {
      expect(estadoDaBarra(s, true).cor).toBe('bg-success');
    }
  });
});

describe('barra e alerta contam a mesma história', () => {
  const limiares = { diasLimite: 10, percentualMinimo: 70 };

  /** A barra deriva da mesma severidade que o alerta — não podem divergir. */
  const corPara = (percentualRealizado: number, diasUteisRestantes: number) => {
    const severidade = avaliarAlerta(
      { metaCent: 90_000_000, percentualRealizado, diasUteisRestantes },
      limiares,
    );
    return estadoDaBarra(severidade, false).cor;
  };

  it('24% e 98% no fim do mês não podem ter a mesma cor — era o defeito', () => {
    expect(corPara(0.24, 3)).not.toBe(corPara(0.98, 3));
  });

  it('fora da janela de alerta, a barra fica neutra mesmo com realizado baixo', () => {
    expect(corPara(0.1, 15)).toBe('bg-primary');
  });

  it('a severidade piora e a cor acompanha', () => {
    expect(corPara(0.98, 3)).toBe('bg-primary');   // acima do limiar
    expect(corPara(0.60, 3)).toBe('bg-warning');   // atenção
    expect(corPara(0.45, 3)).toContain('destructive'); // risco
    expect(corPara(0.20, 3)).toBe('bg-destructive');   // crítico
  });
});
