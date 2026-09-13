import { describe, expect, it } from 'vitest';
import { hasAccessToRoute, routeMinPlan } from './plan-features';

/**
 * Duas portas para a mesma sala não podem ter fechaduras diferentes.
 *
 * `/produtos` e a aba Produtos de `/gestao-compras` são, desde 13/09,
 * literalmente o mesmo componente de cadastro. Só que `/gestao-compras` exigia
 * plano e `/produtos` não — quem batia no portão da frente alcançava o mesmo
 * CRUD digitando a outra URL. Passou despercebido porque `/produtos` é rota
 * órfã: não está em `menu.ts`, `paginas.ts` nem `route-permissions.ts`, e só
 * se chega a ela pela barra de endereço.
 *
 * Este caso existe porque a falha não aparece em nenhuma tela: ela está na
 * DIFERENÇA entre dois arquivos de configuração.
 */
describe('portões de plano', () => {
  it('as duas portas do cadastro de produtos pedem o mesmo plano', () => {
    expect(routeMinPlan['/produtos']).toBe(routeMinPlan['/gestao-compras']);
  });

  it('sem plano, nenhuma das duas abre', () => {
    expect(hasAccessToRoute(null, '/gestao-compras')).toBe(false);
    expect(hasAccessToRoute(null, '/produtos')).toBe(false);
  });

  it('com o plano mínimo, as duas abrem', () => {
    expect(hasAccessToRoute('basico', '/gestao-compras')).toBe(true);
    expect(hasAccessToRoute('basico', '/produtos')).toBe(true);
  });

  it('o plano continua sendo hierárquico, não uma lista de iguais', () => {
    // Enterprise alcança o que o básico alcança; o contrário, não.
    expect(hasAccessToRoute('enterprise', '/produtos')).toBe(true);
    expect(hasAccessToRoute('basico', '/gestao-contratos')).toBe(false);
  });
});
