import { describe, it, expect } from 'vitest';
import { contaComoParticipacao, exigeMotivoDePerda } from '@/lib/metas/participacao';

describe('contaComoParticipacao', () => {
  it('não conta antes da proposta ser enviada', () => {
    expect(contaComoParticipacao('Monitorando')).toBe(false);
    expect(contaComoParticipacao('Em Análise')).toBe(false);
  });

  it('conta a partir de "Proposta Enviada"', () => {
    expect(contaComoParticipacao('Proposta Enviada')).toBe(true);
  });

  it('conta nos estágios posteriores, inclusive nos desfechos', () => {
    for (const s of ['Em Disputa', 'Vencida', 'Homologada', 'Perdida']) {
      expect(contaComoParticipacao(s)).toBe(true);
    }
  });

  it('não conta processo arquivado que nunca teve proposta', () => {
    expect(contaComoParticipacao('Arquivada')).toBe(false);
  });

  it('trata vazio, nulo e indefinido como não participação', () => {
    expect(contaComoParticipacao('')).toBe(false);
    expect(contaComoParticipacao(null)).toBe(false);
    expect(contaComoParticipacao(undefined)).toBe(false);
  });
});

describe('exigeMotivoDePerda', () => {
  it('exige ao entrar em "Perdida"', () => {
    expect(exigeMotivoDePerda('Em Disputa', 'Perdida')).toBe(true);
    expect(exigeMotivoDePerda('Monitorando', 'Perdida')).toBe(true);
  });

  it('não exige quando já estava em "Perdida"', () => {
    expect(exigeMotivoDePerda('Perdida', 'Perdida')).toBe(false);
  });

  it('não exige ao sair de "Perdida" nem em outras transições', () => {
    expect(exigeMotivoDePerda('Perdida', 'Em Disputa')).toBe(false);
    expect(exigeMotivoDePerda('Em Análise', 'Proposta Enviada')).toBe(false);
    expect(exigeMotivoDePerda('Em Disputa', 'Vencida')).toBe(false);
    expect(exigeMotivoDePerda('Em Disputa', 'Arquivada')).toBe(false);
  });
});
