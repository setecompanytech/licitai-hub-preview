import { describe, it, expect } from 'vitest';
import {
  ehPercentual, rotuloDoValor, TIPOS_BONIFICACAO,
  EVENTOS_PAGAMENTO, eventoDaConfig, eventoPadraoDoTipo,
} from '../lib/equipe/bonificacao';

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

describe('evento de pagamento — política da empresa', () => {
  it('configuração sem evento herda o marco que o tipo pressupõe', () => {
    expect(eventoPadraoDoTipo('percentual_nf_quitada')).toBe('nf_quitada');
    expect(eventoPadraoDoTipo('nota_fiscal')).toBe('nf_quitada');
    expect(eventoPadraoDoTipo('percentual_faturamento')).toBe('nota_emitida');
    expect(eventoPadraoDoTipo('percentual_contrato')).toBe('contrato_assinado');
    expect(eventoPadraoDoTipo(null)).toBe('contrato_assinado');
  });

  it('evento declarado manda, mesmo divergindo da base de cálculo', () => {
    // Calcula sobre o contrato, mas só libera no recebimento — combinação
    // legítima que o mapeamento por tipo sozinho não expressaria.
    expect(eventoDaConfig({ tipo_comissao: 'percentual_contrato', evento_pagamento: 'nf_quitada' }))
      .toBe('nf_quitada');
  });

  it('os três marcos existem e nenhum é privilegiado', () => {
    expect(Object.keys(EVENTOS_PAGAMENTO)).toEqual(
      ['contrato_assinado', 'nota_emitida', 'nf_quitada'],
    );
  });
});
