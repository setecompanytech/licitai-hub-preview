import { describe, it, expect } from 'vitest';
import { nomeExibido, iniciaisDe } from '../../src/lib/equipe/nomeExibido';

describe('nomeExibido — identidade do membro', () => {
  it('convite de setor: mostra a pessoa e o login, não o rótulo do setor', () => {
    expect(nomeExibido({
      nome: 'Setor Comercial', email: 'comercial@x.com.br',
      nome_individual: 'Maria Souza', login_individual: 'COMERCIAL-01',
    })).toBe('Maria Souza (COMERCIAL-01)');
  });

  it('só o login identifica quando não há nome individual', () => {
    expect(nomeExibido({ nome: 'Setor Comercial', nome_individual: null, login_individual: 'COMERCIAL-01' }))
      .toBe('COMERCIAL-01');
  });

  it('não repete quando o nome digitado é o próprio login', () => {
    expect(nomeExibido({
      nome: 'Setor Comercial', nome_individual: 'COMERCIAL01', login_individual: 'COMERCIAL01',
    })).toBe('COMERCIAL01');
    // e a comparação ignora caixa
    expect(nomeExibido({ nome_individual: 'comercial02', login_individual: 'COMERCIAL02' }))
      .toBe('COMERCIAL02');
  });

  it('convite direto: o nome da pessoa continua valendo', () => {
    expect(nomeExibido({ nome: 'Rubens Teste', email: 'r@x.com' })).toBe('Rubens Teste');
  });

  it('cai no e-mail e depois no genérico', () => {
    expect(nomeExibido({ nome: null, email: 'sem.nome@x.com' })).toBe('sem.nome@x.com');
    expect(nomeExibido({})).toBe('Colaborador');
    expect(nomeExibido(null)).toBe('Colaborador');
  });

  it('iniciais saem do mesmo nome que a tela mostra', () => {
    expect(iniciaisDe({ nome: 'Setor Comercial', nome_individual: 'Maria Souza' })).toBe('MA');
  });
});
