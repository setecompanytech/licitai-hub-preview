import { describe, it, expect } from 'vitest';
import { corpoDoRecibo, qualificacaoDaEmpresa } from '../recibo';

describe('corpo do recibo', () => {
  it('reproduz o modelo do financeiro quando há todos os vínculos', () => {
    const texto = corpoDoRecibo({
      orgao: 'FUNDAÇÃO MUNICIPAL DE ASSISTENCIA AO ESTUDANTE – FMAE',
      valor: 15523,
      notaFiscal: '000.150',
      empenho: '000482/2022',
      remessa: 8,
      numeroContrato: '015/2022',
      origem: 'PE nº 050/2021-FMAE/PMB',
    });
    expect(texto).toContain('Recebemos da FUNDAÇÃO MUNICIPAL');
    expect(texto).toContain('da NOTA FISCAL Nº 000.150 e NOTA DE EMPENHO nº 000482/2022');
    expect(texto).toContain('8ª remessa do contrato nº 015/2022');
    expect(texto).toContain('oriundo do PE nº 050/2021-FMAE/PMB');
    expect(texto.endsWith('.')).toBe(true);
  });

  it('omite o que nao existe em vez de escrever null', () => {
    const texto = corpoDoRecibo({
      orgao: 'PREFEITURA X', valor: 1000, notaFiscal: '12', numeroContrato: null,
    });
    expect(texto).not.toMatch(/null|undefined|NaN/);
    expect(texto).not.toContain('remessa');
    expect(texto).toContain('da NOTA FISCAL Nº 12');
  });

  it('qualificacao nao inventa separador quando falta dado', () => {
    const q = qualificacaoDaEmpresa({ razao_social: 'ACME LTDA', cnpj: '00.000.000/0001-00' });
    expect(q).toBe('ACME LTDA, INSCRITA SOB O CNPJ N° 00.000.000/0001-00');
  });
});
