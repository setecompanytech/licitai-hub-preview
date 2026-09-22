import { describe, it, expect } from 'vitest';
import {
  anoDoProcesso, modalidadeLegivel, numeroDoProcessoLegivel, ordenarProcessos, processoValidoParaAnalise, rotuloDoProcesso,
} from '../rotulo-do-processo';

describe('rótulo do processo — a norma da casa', () => {
  it('o número sai limpo, com o ano do processo', () => {
    expect(numeroDoProcessoLegivel('P.E. 044', '2025')).toBe('44/2025');
    expect(numeroDoProcessoLegivel('Pregão Eletrônico SRP Nº 014', '2026')).toBe('14/2026');
    expect(numeroDoProcessoLegivel('011/2026')).toBe('11/2026');
    expect(numeroDoProcessoLegivel('00046', '2025')).toBe('46/2025');
    expect(numeroDoProcessoLegivel('90012/2025', '2024')).toBe('90012/2025');
    expect(numeroDoProcessoLegivel('6')).toBe('6');
    expect(numeroDoProcessoLegivel('sem número')).toBe('sem número');
    expect(numeroDoProcessoLegivel('')).toBe('');
  });

  it('a modalidade perde o hífen do PNCP e ganha a caixa certa', () => {
    expect(modalidadeLegivel('Pregão - Eletrônico')).toBe('Pregão Eletrônico');
    expect(modalidadeLegivel('PREGAO ELETRONICO')).toBe('Pregão Eletrônico');
    expect(modalidadeLegivel('Concorrência - Eletrônica')).toBe('Concorrência Eletrônica');
    expect(modalidadeLegivel('Dispensa de Licitação')).toBe('Dispensa de Licitação');
  });

  it('o rótulo junta modalidade, número com ano e o órgão legível', () => {
    expect(rotuloDoProcesso({ numero: 'P.E. 044', modalidade: 'Pregão - Eletrônico', orgao: 'MUNICIPIO DE RONDON DO PARA', ano_compra: '2025' }))
      .toBe('Pregão Eletrônico nº 44/2025 — Município de Rondon do Pará');
    expect(rotuloDoProcesso({ numero: '6', modalidade: 'Pregão - Eletrônico', orgao: 'COMANDO DO EXERCITO', data_abertura: '2026-03-10' }))
      .toBe('Pregão Eletrônico nº 6/2026 — Comando do Exército');
    expect(rotuloDoProcesso({ numero: '', modalidade: '', orgao: 'MINISTERIO DA SAUDE' })).toBe('Processo — Ministério da Saúde');
    expect(anoDoProcesso({ created_at: '2025-12-01T10:00:00Z' })).toBe('2025');
  });

  it('válido para análise: em andamento ou ganho; fora cancelado, anulado, perdido, arquivado, deserto e o sem identificação', () => {
    expect(processoValidoParaAnalise({ status: 'Em Disputa', numero: '1', orgao: 'X' })).toBe(true);
    expect(processoValidoParaAnalise({ status: 'Homologada', numero: '1', orgao: 'X' })).toBe(true);
    expect(processoValidoParaAnalise({ status: 'Monitorando', numero: '1', orgao: 'X' })).toBe(true);
    expect(processoValidoParaAnalise({ status: 'Perdida', numero: '1', orgao: 'X' })).toBe(false);
    expect(processoValidoParaAnalise({ status: 'cancelado', numero: '1', orgao: 'X' })).toBe(false);
    expect(processoValidoParaAnalise({ status: 'Anulada', numero: '1', orgao: 'X' })).toBe(false);
    expect(processoValidoParaAnalise({ status: 'Suspensa', numero: '1', orgao: 'X' })).toBe(false);
    expect(processoValidoParaAnalise({ status: 'Em Análise', resultado: 'Deserto', numero: '1', orgao: 'X' })).toBe(false);
    expect(processoValidoParaAnalise({ status: 'Em Análise', arquivado_em: '2026-01-01', numero: '1', orgao: 'X' })).toBe(false);
    expect(processoValidoParaAnalise({ status: 'Em Análise', numero: '', orgao: '' })).toBe(false);
  });

  it('a ordem: abertura mais recente primeiro; sem abertura, o cadastro', () => {
    const ordem = ordenarProcessos([
      { numero: 'a', data_abertura: '2026-01-05', created_at: '2026-01-01' },
      { numero: 'b', data_abertura: null, created_at: '2026-02-01' },
      { numero: 'c', data_abertura: '2026-03-01', created_at: '2025-01-01' },
    ]).map((p) => p.numero);
    expect(ordem).toEqual(['c', 'a', 'b']);
  });
});
