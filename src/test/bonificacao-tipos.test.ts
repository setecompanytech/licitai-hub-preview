import { describe, it, expect } from 'vitest';
import { ehPercentual, rotuloDoValor, TIPOS_BONIFICACAO } from '../lib/equipe/bonificacao';

const brl = (v: number) => `R$ ${v.toFixed(2)}`;

describe('tipos de bonificação — percentual x valor fixo', () => {
  it('reconhece todos os tipos percentuais', () => {
    for (const t of ['percentual_contrato', 'percentual_lucro',
                     'percentual_faturamento', 'percentual_nf_quitada']) {
      expect(ehPercentual(t)).toBe(true);
    }
  });

  it('reconhece os tipos de valor fixo — inclusive "por nota fiscal"', () => {
    expect(ehPercentual('valor_fixo')).toBe(false);
    expect(ehPercentual('nota_fiscal')).toBe(false);
  });

  it('não trata a string inexistente "percentual" como se fosse tipo salvo', () => {
    // Era o que a conta automática comparava; nenhum registro guarda esse valor.
    expect(Object.keys(TIPOS_BONIFICACAO)).not.toContain('percentual');
  });

  it('rótulo mostra percentual ou valor conforme o tipo', () => {
    expect(rotuloDoValor('percentual_nf_quitada', 3, 500, brl)).toBe('3%');
    expect(rotuloDoValor('nota_fiscal', 3, 500, brl)).toBe('R$ 500.00');
  });

  it('os dois tipos novos estão no vocabulário', () => {
    expect(TIPOS_BONIFICACAO.percentual_faturamento.label).toBe('% sobre Faturamento');
    expect(TIPOS_BONIFICACAO.percentual_nf_quitada.label).toBe('% sobre NF-e quitada');
  });
});
