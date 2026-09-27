import { describe, it, expect } from 'vitest';
import { montarDossieDoContrato, type ContratoDoDossie } from '../dossie-do-contrato';

const contrato: ContratoDoDossie = {
  numero_contrato: '772/2024', orgao_contratante: 'SEMAS Barcarena', objeto: 'Gêneros alimentícios', modalidade: 'Pregão Eletrônico',
  tipo_documento: 'contrato', status: 'vigente', data_assinatura: '2024-06-11', data_inicio: '2024-06-12', data_fim: '2027-06-11',
  valor_global: 1236891.22, valor_global_original: 416693.13, saldo_remanescente: 1236891.22, valor_consumido: 0,
  indice_reajuste: 'IPCA', data_base_reajuste: '2024-06-11', reajuste_clausula: '5.1.2. reajuste após 1 ano pelo INPC', fiscal_nome: 'Shirley',
  prazo_pagamento_dias: 30, prazo_entrega_dias: 15, forma_fornecimento: 'parcelado',
};

describe('o dossiê do contrato', () => {
  it('traz identificação, valores, termos, cláusula de reajuste, marco, aniversário e a série quando há', () => {
    const d = montarDossieDoContrato({
      contrato,
      aditivos: [
        { numero_aditivo: '1º Termo Aditivo', tipo: 'reajuste', data_assinatura: '2025-05-06', valor_aditivo: 162236.19, nova_data_fim: null },
        { numero_aditivo: '2º Termo Aditivo', tipo: 'prorrogacao', data_assinatura: '2025-06-11', valor_aditivo: 578929.32, nova_data_fim: '2026-06-11' },
      ],
      itens: { quantidade: 18, valorTotal: 578929.32 },
      serie: { indice: 'IPCA', fonte: 'IBGE · BCB/SGS 433', data_base: '2025-05-06', data_alvo: '2026-05-06', meses: new Array(12).fill({ competencia: 'x', variacao: 0.3, fator: 1.003 }), meses_esperados: 12, completo: true, serie_ate: '05/2026', fator: 1.0366, percentual: 3.66 },
      hoje: '2026-09-27',
    });
    expect(d.numero).toBe('772/2024');
    expect(d.orgao).toBe('SEMAS Barcarena');
    expect(d.texto).toContain('Contrato: 772/2024');
    expect(d.texto).toContain('R$ 1.236.891,22');
    expect(d.texto).toContain('1º Termo Aditivo (reajuste)');
    expect(d.texto).toContain('Marco (último reajuste registrado): 06/05/2025');
    expect(d.texto).toContain('Aniversário: 06/05/2026');
    expect(d.reajuste?.devido).toBe(true);
    expect(d.texto).toContain('3,66%');
    expect(d.texto).toContain('não invente');
  });
  it('sem data-base não fala de reajuste; sem termos não lista termos', () => {
    const d = montarDossieDoContrato({ contrato: { ...contrato, data_base_reajuste: null }, aditivos: [], itens: { quantidade: 0, valorTotal: 0 }, hoje: '2026-09-27' });
    expect(d.reajuste).toBeNull();
    expect(d.texto).not.toContain('Cláusula de reajuste');
    expect(d.texto).not.toContain('Termos aditivos');
  });
});
