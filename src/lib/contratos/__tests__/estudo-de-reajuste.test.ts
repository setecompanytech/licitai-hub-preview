import { describe, it, expect } from 'vitest';
import {
  htmlDoEstudo, mesesEntre, montarEstudo, nomeDoArquivoDoEstudo, temSerieOficial,
  type EntradaDoEstudo, type SerieOficial,
} from '../estudo-de-reajuste';

/** IPCA entre 11/06/2024 e 11/06/2025 do 772/2024: fator 1,053512 (5,35%). */
const SERIE: SerieOficial = {
  indice: 'IPCA', fonte: 'IBGE · BCB/SGS 433', data_base: '2024-06-11', data_alvo: '2025-06-11',
  meses: [
    { competencia: '07/2024', variacao: 0.38, fator: 1.0038 }, { competencia: '08/2024', variacao: -0.02, fator: 0.9998 },
    { competencia: '09/2024', variacao: 0.44, fator: 1.0044 }, { competencia: '10/2024', variacao: 0.56, fator: 1.0056 },
    { competencia: '11/2024', variacao: 0.39, fator: 1.0039 }, { competencia: '12/2024', variacao: 0.52, fator: 1.0052 },
    { competencia: '01/2025', variacao: 0.16, fator: 1.0016 }, { competencia: '02/2025', variacao: 1.31, fator: 1.0131 },
    { competencia: '03/2025', variacao: 0.56, fator: 1.0056 }, { competencia: '04/2025', variacao: 0.43, fator: 1.0043 },
    { competencia: '05/2025', variacao: 0.26, fator: 1.0026 }, { competencia: '06/2025', variacao: 0.24, fator: 1.0024 },
  ],
  meses_esperados: 12, completo: true, serie_ate: '06/2025', fator: 1.053512, percentual: 5.3512,
};

const entrada = (extra: Partial<EntradaDoEstudo> = {}): EntradaDoEstudo => ({
  valorBase: 1236891.22, indice: 'IPCA', percentualAplicado: 5.35, dataBase: '2024-06-11', dataAlvo: '2025-06-11',
  tipoServico: 'fornecimento', serie: SERIE, hoje: '2026-09-27', ...extra,
});

describe('a conta do reajuste', () => {
  it('meses entre datas, com o dia decidindo o mês cheio', () => {
    expect(mesesEntre('2024-06-11', '2025-06-11')).toBe(12);
    expect(mesesEntre('2024-06-11', '2025-06-10')).toBe(11);
    expect(mesesEntre('2024-01-01', '2025-01-01')).toBe(12);
  });
  it('valor reajustado = base × (1 + p/100), diferença a duas casas', () => {
    const e = montarEstudo(entrada());
    expect(e.regime).toBe('reajuste');
    expect(e.valorReajustado).toBe(1303064.9);
    expect(e.diferenca).toBe(66173.68);
    expect(e.mesesDeInterregno).toBe(12);
    expect(e.percentualOficial).toBe(5.35);
    expect(e.percentualDiverge).toBe(false);
    expect(e.alertas).toEqual([]);
  });
  it('só IPCA, INPC, IGP-M, IGP-DI e INCC-DI têm série no SGS', () => {
    expect(temSerieOficial('IPCA')).toBe(true);
    expect(temSerieOficial('igp-m')).toBe(true);
    expect(temSerieOficial('SINAPI')).toBe(false);
    expect(temSerieOficial('CCT')).toBe(false);
  });
});

describe('os alertas dizem o que a lei diz', () => {
  it('interregno menor que 12 meses é nulo (Lei 10.192/2001, art. 2º, § 1º)', () => {
    const e = montarEstudo(entrada({ dataAlvo: '2025-01-01', serie: null }));
    expect(e.mesesDeInterregno).toBe(6);
    expect(e.alertas.some((a) => a.includes('inferior ao mínimo anual') && a.includes('10.192/2001'))).toBe(true);
  });
  it('percentual editado que foge da série oficial é dito com os dois números', () => {
    const e = montarEstudo(entrada({ percentualAplicado: 4.5 }));
    expect(e.percentualDiverge).toBe(true);
    expect(e.alertas.some((a) => a.includes('4,50%') && a.includes('5,35%'))).toBe(true);
  });
  it('índice sem série (SINAPI) pede a tabela de origem', () => {
    const e = montarEstudo(entrada({ indice: 'SINAPI', serie: null, tipoServico: 'engenharia' }));
    expect(e.alertas.some((a) => a.includes('sem série no SGS'))).toBe(true);
  });
  it('serviço contínuo com mão de obra é repactuação (art. 135), não índice', () => {
    const e = montarEstudo(entrada({ tipoServico: 'continuado' }));
    expect(e.regime).toBe('repactuacao');
    expect(e.alertas.some((a) => a.includes('REPACTUAÇÃO') && a.includes('art. 135'))).toBe(true);
    expect(e.referencias.some((r) => r.norma.includes('art. 135'))).toBe(true);
    expect(e.referencias.some((r) => r.norma.includes('1.563/2004'))).toBe(true);
  });
  it('data futura vira estimativa; série parcial pede refazer', () => {
    const e = montarEstudo(entrada({ dataAlvo: '2027-06-11', serie: { ...SERIE, completo: false, serie_ate: '08/2026', meses_esperados: 24 } }));
    expect(e.alertas.some((a) => a.includes('ESTIMATIVA'))).toBe(true);
    expect(e.alertas.some((a) => a.includes('PARCIAL'))).toBe(true);
  });
  it('nenhuma referência cita o art. 65 (que na Lei 14.133 é habilitação) nem acórdão inventado', () => {
    const e = montarEstudo(entrada());
    const texto = [...e.fundamentacao, ...e.parecer, ...e.referencias.map((r) => `${r.norma} ${r.texto}`)].join(' ');
    expect(texto).not.toMatch(/art\. 65\b/);
    expect(texto).not.toContain('1234/2019');
    expect(texto).toContain('art. 136, I');
    expect(texto).toContain('art. 92, § 3º');
  });
});

describe('o documento', () => {
  it('traz as sete seções, a série e o valor; o Word leva o namespace do Office', () => {
    const e = entrada({ identificacao: [['Contrato', '772/2024'], ['Órgão contratante', 'SEMAS Barcarena']] });
    const html = htmlDoEstudo(e, montarEstudo(e));
    expect(html).toContain('772/2024');
    expect(html).toContain('1. Identificação');
    expect(html).toContain('5. Aspectos contábeis');
    expect(html).toContain('7. Fontes');
    expect(html).toContain('07/2024');
    expect(html).toContain('R$ 1.303.064,90');
    expect(html).not.toContain('window.print');
    expect(htmlDoEstudo(e, montarEstudo(e), { imprimirAoAbrir: true })).toContain('window.print');
    expect(htmlDoEstudo(e, montarEstudo(e), { paraWord: true })).toContain('urn:schemas-microsoft-com:office:word');
    expect(nomeDoArquivoDoEstudo(e, 'doc')).toBe('Estudo-Reajuste-IPCA-2026-09-27.doc');
  });
});
