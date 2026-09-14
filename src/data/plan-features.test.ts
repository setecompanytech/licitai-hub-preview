import { describe, expect, it } from 'vitest';
import { getRequiredPlan, hasAccessToRoute, routeMinPlan } from './plan-features';
import { isSectorAllowedForRoute } from '@/lib/route-permissions';

/**
 * A página de uma disputa (`/robo-lances/disputa/<id>`, 14/09/2026) é a mesma
 * sala da lista do robô. Os mapas de acesso procuram a rota exata, e rota não
 * listada é livre — sem herança, a página nova abriria sem plano e para
 * qualquer setor.
 */
describe('portões da página de detalhe do robô', () => {
  it('pede o mesmo plano da lista', () => {
    expect(getRequiredPlan('/robo-lances/disputa/abc-123')).toBe(routeMinPlan['/robo-lances']);
    expect(hasAccessToRoute(null, '/robo-lances/disputa/abc-123')).toBe(false);
    expect(hasAccessToRoute('basico', '/robo-lances/disputa/abc-123')).toBe(false);
    expect(hasAccessToRoute('profissional', '/robo-lances/disputa/abc-123?aba=estrategia')).toBe(true);
  });

  it('pede o mesmo setor da lista', () => {
    expect(isSectorAllowedForRoute('financeiro', '/robo-lances/disputa/abc-123')).toBe(
      isSectorAllowedForRoute('financeiro', '/robo-lances'),
    );
    expect(isSectorAllowedForRoute('financeiro', '/robo-lances/disputa/abc-123')).toBe(false);
    expect(isSectorAllowedForRoute('licitacoes', '/robo-lances/disputa/abc-123')).toBe(true);
  });

  it('não muda o portão de rota que não é detalhe listado', () => {
    // `/equipe/permissoes` tem regra própria; herança por prefixo genérico a mudaria.
    expect(getRequiredPlan('/equipe/permissoes')).toBeNull();
  });
});

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
