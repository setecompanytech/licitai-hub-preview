import { describe, it, expect } from 'vitest';
import {
  digitoVerificadorDaChave, chaveDeAcessoValida, acharChaveNoTexto, dadosDaChave,
} from '@/lib/financeiro/danfe';

/**
 * A chave do 000.000.125, montada peça por peça em vez de copiada:
 *   15  PA · 2604 abr/2026 · CNPJ · 55 NF-e · 001 série · 000000125 nº
 * O DV é calculado, não chutado — assim o teste também prova o cálculo.
 */
const PREFIXO_43 = '15' + '2604' + '12345678000199' + '55' + '001' + '000000125' + '1' + '12345678';
const CHAVE = PREFIXO_43 + String(digitoVerificadorDaChave(PREFIXO_43));

describe('digitoVerificadorDaChave', () => {
  it('calcula o DV de 43 dígitos', () => {
    const dv = digitoVerificadorDaChave(PREFIXO_43);
    expect(dv).not.toBeNull();
    expect(dv).toBeGreaterThanOrEqual(0);
    expect(dv).toBeLessThanOrEqual(9);
  });

  it('resto 0 ou 1 produz DV zero — regra do manual', () => {
    // 43 zeros: soma zero, resto zero.
    expect(digitoVerificadorDaChave('0'.repeat(43))).toBe(0);
  });

  it('quantidade errada de dígitos não tem DV', () => {
    expect(digitoVerificadorDaChave('123')).toBeNull();
    expect(digitoVerificadorDaChave('0'.repeat(44))).toBeNull();
  });
});

describe('chaveDeAcessoValida', () => {
  it('aceita a chave montada, com o DV que ela mesma pede', () => {
    expect(chaveDeAcessoValida(CHAVE)).toBe(CHAVE);
  });

  it('recusa DV errado — é o que separa chave de número comprido', () => {
    const dvErrado = String((Number(CHAVE[43]) + 1) % 10);
    expect(chaveDeAcessoValida(PREFIXO_43 + dvErrado)).toBeNull();
  });

  it('aceita a chave escrita em grupos, como o papel imprime', () => {
    const emGrupos = CHAVE.replace(/(\d{4})(?=\d)/g, '$1 ');
    expect(chaveDeAcessoValida(emGrupos)).toBe(CHAVE);
  });

  it('44 zeros não é chave, ainda que o DV feche', () => {
    expect(chaveDeAcessoValida('0'.repeat(44))).toBeNull();
  });

  it('comprimento errado é recusado', () => {
    expect(chaveDeAcessoValida(CHAVE.slice(0, 43))).toBeNull();
    expect(chaveDeAcessoValida(null)).toBeNull();
  });
});

describe('acharChaveNoTexto', () => {
  it('acha a chave no meio do texto do DANFE', () => {
    const texto = `DANFE\nDOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA\n`
      + `CHAVE DE ACESSO\n${CHAVE.replace(/(\d{4})(?=\d)/g, '$1 ')}\n`
      + `Consulta de autenticidade no portal nacional da NF-e`;
    expect(acharChaveNoTexto(texto)).toBe(CHAVE);
  });

  it('separa a chave dos outros números da página pelo DV', () => {
    // CNPJ, protocolo e data em volta — só a janela certa fecha o dígito.
    const texto = `CNPJ 12.345.678/0001-99 PROTOCOLO 315260001234567 `
      + `DATA 30/04/2026 CHAVE ${CHAVE} VALOR 30.960,00`;
    expect(acharChaveNoTexto(texto)).toBe(CHAVE);
  });

  it('texto sem chave devolve null, e não um palpite', () => {
    expect(acharChaveNoTexto('NOTA FISCAL 125 SERIE 1 VALOR 30960,00')).toBeNull();
    expect(acharChaveNoTexto('')).toBeNull();
  });

  it('número comprido que não é chave não passa', () => {
    expect(acharChaveNoTexto('9'.repeat(80))).toBeNull();
  });
});

describe('dadosDaChave', () => {
  it('a chave contém número, série e competência', () => {
    expect(dadosDaChave(CHAVE)).toEqual({
      uf: '15',
      competencia: '2026-04',
      cnpj_emitente: '12345678000199',
      modelo: '55',
      serie: '1',
      numero: '125',
    });
  });

  it('série e número saem sem zeros à esquerda — é como o papel os mostra', () => {
    const d = dadosDaChave(CHAVE)!;
    expect(d.serie).toBe('1');
    expect(d.numero).toBe('125');
  });

  it('chave inválida não produz dados', () => {
    expect(dadosDaChave('0'.repeat(44))).toBeNull();
    expect(dadosDaChave('nao e chave')).toBeNull();
  });
});
