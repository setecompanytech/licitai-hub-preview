import { describe, it, expect } from 'vitest';
import { ehRotaAdministrativa } from '../lib/route-permissions';

describe('ehRotaAdministrativa — administração é do admin da empresa', () => {
  it('reconhece as rotas de administração', () => {
    for (const r of ['/empresas', '/equipe', '/equipe/permissoes', '/configuracoes',
                     '/configuracoes/alertas', '/api-integracao']) {
      expect(ehRotaAdministrativa(r)).toBe(true);
    }
  });

  it('reconhece com parâmetros e subcaminhos', () => {
    expect(ehRotaAdministrativa('/equipe?lid=abc')).toBe(true);
    expect(ehRotaAdministrativa('/configuracoes/alertas')).toBe(true);
  });

  it('não confunde rotas de trabalho com administração', () => {
    for (const r of ['/painel', '/kanban', '/precificacao', '/proposta-tecnica',
                     '/robo-lances', '/suporte', '/documentos']) {
      expect(ehRotaAdministrativa(r)).toBe(false);
    }
  });
});
