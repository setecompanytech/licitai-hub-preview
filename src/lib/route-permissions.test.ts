import { describe, expect, it } from 'vitest';
import { ehRotaAdministrativa, ehRotaDoOperador, ROTAS_ADMINISTRATIVAS } from './route-permissions';
import { navGroups } from '@/lib/navegacao/menu';

/**
 * Duas fronteiras que o produto confundia, e que só se distinguem por quem
 * é o dono da porta:
 *
 *  - rota ADMINISTRATIVA: da empresa assinante (empresas, equipe,
 *    configurações). Quem abre é o administrador DAQUELA empresa.
 *  - rota DO OPERADOR (/admin/*): do Praefectus. Quem abre é quem opera o
 *    SaaS — templates de IA, assinaturas dos clientes, métricas do negócio.
 *
 * Até 13/09 a navegação liberava a segunda para a primeira: o grupo "Admin"
 * aparecia no menu de qualquer dono de empresa. A rota resistia (AdminGuard
 * exige isSystemAdmin), mas o menu anunciava um painel que a pessoa não
 * podia abrir.
 */
describe('fronteira entre administração da empresa e painel do operador', () => {
  it('reconhece as rotas do operador', () => {
    expect(ehRotaDoOperador('/admin/templates')).toBe(true);
    expect(ehRotaDoOperador('/admin/metricas-saas')).toBe(true);
    expect(ehRotaDoOperador('/admin')).toBe(true);
  });

  it('não confunde rota de empresa com rota do operador', () => {
    for (const rota of ROTAS_ADMINISTRATIVAS) {
      expect(ehRotaDoOperador(rota)).toBe(false);
    }
    expect(ehRotaDoOperador('/dashboard')).toBe(false);
    // Uma rota que apenas começa com as mesmas letras não é do operador.
    expect(ehRotaDoOperador('/administrativo')).toBe(false);
  });

  it('trata as duas fronteiras como conjuntos separados', () => {
    expect(ehRotaAdministrativa('/admin/templates')).toBe(false);
    expect(ehRotaAdministrativa('/equipe')).toBe(true);
  });

  it('cobre todo item do grupo Admin do menu', () => {
    const grupoAdmin = navGroups.find((g) => g.title === 'Admin');
    expect(grupoAdmin).toBeDefined();
    const foraDaRegra = grupoAdmin!.items.filter((i) => !ehRotaDoOperador(i.path)).map((i) => i.path);
    expect(foraDaRegra).toEqual([]);
  });
});
