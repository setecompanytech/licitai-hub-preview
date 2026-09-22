import { describe, it, expect } from 'vitest';
import { transparenciaPortais, chaveDoPortal, getPortalByKey, PORTAL_PADRAO } from '../transparencia-portais';

/**
 * O seletor de portal de Análise de mercado abria vazio (22/09): o estado
 * inicial era `estado-PA` e as opções, `estado-PA-Pará`. Uma chave só, e o
 * padrão precisa ser uma das opções.
 */
describe('chave do portal de transparência', () => {
  it('o portal padrão é uma opção real do seletor', () => {
    expect(getPortalByKey(PORTAL_PADRAO)?.nome).toBe('Pará');
    expect(transparenciaPortais.some((p) => chaveDoPortal(p) === PORTAL_PADRAO)).toBe(true);
  });

  it('cada chave resolve para o próprio portal — nenhuma colisão entre estado e capital', () => {
    for (const p of transparenciaPortais) {
      expect(getPortalByKey(chaveDoPortal(p))).toBe(p);
    }
    const chaves = transparenciaPortais.map(chaveDoPortal);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
