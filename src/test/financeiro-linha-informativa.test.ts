import { describe, it, expect } from 'vitest';
import { ehLinhaInformativa, motivoDoDescarte } from '@/lib/financeiro/linha-informativa';

/**
 * O caso real que originou este guarda: dezoito linhas "SALDO TOTAL DISPONÍVEL
 * DIA" do extrato do Itaú viraram contas a receber somando R$ 7,8 milhões,
 * porque o filtro só descartava valor zero.
 *
 * A segunda metade dos testes é a que importa mais: transação verdadeira NÃO
 * pode ser descartada. Linha informativa que escapa vira ruído que alguém
 * apaga; transação engolida é dinheiro que some sem deixar rastro.
 */

describe('linha informativa de extrato', () => {
  it('reconhece as linhas de saldo que criaram o problema', () => {
    for (const d of [
      'SALDO TOTAL DISPONÍVEL DIA',
      'SALDO TOTAL DISPONIVEL DIA',
      'SALDO ANTERIOR',
      'SALDO DO DIA',
      'SALDO FINAL',
      'SALDO INICIAL',
      'SALDO EM CONTA',
      'saldo total disponível dia',
      '  SALDO   ANTERIOR  ',
    ]) {
      expect(ehLinhaInformativa(d), d).toBe(true);
    }
  });

  it('reconhece totais, resumos e limites', () => {
    for (const d of [
      'TOTAL DO PERIODO',
      'TOTAL DE CREDITOS',
      'SUBTOTAL',
      'RESUMO DA CONTA',
      'EXTRATO DE CONTA CORRENTE',
      'POSICAO CONSOLIDADA',
      'LIMITE DISPONIVEL',
      'VALOR BLOQUEADO',
      'SALDO BLOQUEADO',
    ]) {
      expect(ehLinhaInformativa(d), d).toBe(true);
    }
  });

  // ── A metade que protege o dinheiro de verdade ────────────────────────────

  it('NÃO descarta transação real, mesmo citando a palavra saldo', () => {
    for (const d of [
      'PIX RECEBIDO ETHOS E07/04 ETHOS ESTRATEGIA E M 33.734.346/0001-72',
      'RESGATE CDB DI',
      'INT RESGATE  MAPFRERFDI',
      'APLICACAO MAPFRERFDI INT',
      'TED RECEBIDA SECRETARIA DE ESTADO DE EDUCACAO',
      'PAGAMENTO FORNECEDOR SALDO REMANESCENTE CONTRATO 12/2025',
      'DEPOSITO EM DINHEIRO',
      'TARIFA MANUTENCAO CONTA',
      'LIQUIDACAO BOLETO 34191790010104351004791020150008',
      'DEVOLUCAO SALDO CLIENTE',
    ]) {
      expect(ehLinhaInformativa(d), d).toBe(false);
    }
  });

  it('descrição vazia ou nula passa — sem texto não se afirma nada', () => {
    expect(ehLinhaInformativa('')).toBe(false);
    expect(ehLinhaInformativa(null)).toBe(false);
    expect(ehLinhaInformativa(undefined)).toBe(false);
    expect(ehLinhaInformativa('   ')).toBe(false);
  });

  it('o motivo do descarte é dizível — descartar calado é o mesmo defeito', () => {
    expect(motivoDoDescarte('SALDO TOTAL DISPONÍVEL DIA', 828692.47)).toBe('linha de saldo do extrato');
    expect(motivoDoDescarte('QUALQUER COISA', 0)).toBe('valor zero');
    expect(motivoDoDescarte('PIX RECEBIDO CLIENTE', 1200)).toBeNull();
  });

  it('valor zero tem precedência sobre o texto', () => {
    // Uma linha zerada é descartada de qualquer jeito; o motivo mais simples
    // é o que a tela deve mostrar.
    expect(motivoDoDescarte('SALDO ANTERIOR', 0)).toBe('valor zero');
  });
});
