import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { uasgDoEspelho } from '@/lib/robo/uasg-do-processo';

/** A UASG da disputa importada do processo, pelo espelho do PNCP (16/09/2026). */
describe('UASG do processo pelo espelho do PNCP', () => {
  it('o link do Compras.gov manda: a UASG são os 6 primeiros dígitos do id da compra', () => {
    expect(uasgDoEspelho({
      link_sistema_origem: 'https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=92531505000072026',
      codigo_unidade: '999999',
    })).toBe('925315');
  });

  it('sem link, o código da UASG; sem ele, o código da unidade do PNCP', () => {
    expect(uasgDoEspelho({ uasg_codigo: '170162', codigo_unidade: '925315' })).toBe('170162');
    expect(uasgDoEspelho({ codigo_unidade: '925315' })).toBe('925315');
  });

  it('código que não tem 6 dígitos não vira UASG', () => {
    expect(uasgDoEspelho({ codigo_unidade: '1' })).toBeNull();
    expect(uasgDoEspelho({ link_sistema_origem: 'https://www.portaldecompraspublicas.com.br/processos/123' })).toBeNull();
    expect(uasgDoEspelho(null)).toBeNull();
  });
});
