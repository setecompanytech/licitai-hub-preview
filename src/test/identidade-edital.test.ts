import { describe, it, expect } from 'vitest';
import { identidadeDoEdital, normalizarModalidade } from '@/lib/licitacao/identidade-edital';

// Os três casos que motivaram a lib são reais, da tela de 12/09: portais
// publicando "011/2026", "PE nº 9/2026-0025 PMPD" e "007 SRP" lado a lado.
describe('identidadeDoEdital', () => {
  it('padroniza número com zeros à esquerda ("011/2026")', () => {
    const id = identidadeDoEdital({ numeroCompra: '011/2026', modalidade: 'Pregão - Eletrônico' });
    expect(id.rotulo).toBe('Pregão Eletrônico nº 11/2026');
    expect(id.numeroPadronizado).toBe('nº 11/2026');
    expect(id.reescrito).toBe(true);
    expect(id.bruto).toBe('011/2026');
  });

  it('ignora prefixo e sufixo internos do portal ("PE nº 9/2026-0025 PMPD")', () => {
    const id = identidadeDoEdital({ numeroCompra: 'PE nº 9/2026-0025 PMPD', modalidade: 'Pregão - Eletrônico' });
    expect(id.rotulo).toBe('Pregão Eletrônico nº 9/2026');
  });

  it('completa o ano pelo ano_compra do PNCP quando o texto não traz ("007 SRP")', () => {
    const id = identidadeDoEdital({ numeroCompra: '007 SRP', modalidade: 'Pregão - Eletrônico', anoCompra: '2026' });
    expect(id.rotulo).toBe('Pregão Eletrônico nº 7/2026');
  });

  it('sem ano no texto e sem ano_compra, não inventa: mantém o bruto', () => {
    const id = identidadeDoEdital({ numeroCompra: '007 SRP', modalidade: 'Pregão Eletrônico' });
    expect(id.numeroPadronizado).toBeNull();
    expect(id.rotulo).toBe('Pregão Eletrônico 007 SRP');
    expect(id.reescrito).toBe(false);
  });

  it('aceita ano na frente ("2026/007")', () => {
    const id = identidadeDoEdital({ numeroCompra: '2026/007', modalidade: 'Concorrência' });
    expect(id.rotulo).toBe('Concorrência nº 7/2026');
  });

  it('número longo do Comprasnet ("90008/2025") passa inteiro', () => {
    const id = identidadeDoEdital({ numeroCompra: '90008/2025', modalidade: 'Dispensa de Licitação' });
    expect(id.rotulo).toBe('Dispensa de Licitação nº 90008/2025');
  });

  it('sem modalidade, o rótulo abre com "Edital"', () => {
    const id = identidadeDoEdital({ numeroCompra: '11/2026' });
    expect(id.rotulo).toBe('Edital nº 11/2026');
    // "11/2026" já é a forma padronizada — nada foi reescrito.
    expect(id.reescrito).toBe(false);
  });

  it('sem nada, declara em vez de inventar', () => {
    expect(identidadeDoEdital({}).rotulo).toBe('Edital sem número');
  });
});

describe('normalizarModalidade', () => {
  it('remove o hífen decorativo dos portais', () => {
    expect(normalizarModalidade('Pregão - Eletrônico')).toBe('Pregão Eletrônico');
    expect(normalizarModalidade('  Concorrência   Eletrônica ')).toBe('Concorrência Eletrônica');
    expect(normalizarModalidade(null)).toBe('');
  });
});
