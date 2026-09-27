import { describe, it, expect } from 'vitest';
import { prazoDaPeca } from '../prazos-da-peca';

describe('o prazo de cada peça', () => {
  it('recurso e contrarrazões em 3 dias úteis (art. 165); impugnação até 3 dias úteis antes da abertura (art. 164)', () => {
    expect(prazoDaPeca('Recursos', 'Recurso Administrativo')).toMatchObject({ prazo: expect.stringContaining('3 dias úteis'), fundamento: 'Lei 14.133/2021, art. 165, I e § 1º' });
    expect(prazoDaPeca('Recursos', 'Contrarrazões de Recurso').prazo).toContain('recorrente');
    expect(prazoDaPeca('Impugnações', 'Impugnação ao Edital').fundamento).toBe('Lei 14.133/2021, art. 164');
  });
  it('reequilíbrio sem prazo fixo, antes da prorrogação; judicial 120 dias; desconhecido manda conferir', () => {
    expect(prazoDaPeca('Reequilíbrio', 'Reajuste Contratual (Índice)').prazo).toContain('ANTES de assinar');
    expect(prazoDaPeca('Judicial', 'Mandado de Segurança').fundamento).toBe('Lei 12.016/2009, art. 23');
    expect(prazoDaPeca('Declarações', 'Declaração de ME/EPP').fundamento).toBe('');
  });
});
