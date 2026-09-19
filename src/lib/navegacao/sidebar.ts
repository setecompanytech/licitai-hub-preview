/**
 * Estado e regras puras da navegação lateral (`AppSidebar`).
 *
 * Moram fora do componente por duas razões: função exportada de arquivo de
 * componente desliga a atualização instantânea da tela naquele arquivo, e a
 * regra de "item ativo" merece teste sem montar a coluna inteira.
 */

export const ROTA_PAINEL = '/dashboard';

export const CHAVE_SIDEBAR_RECOLHIDA = 'praefectus:sidebar:recolhida';

/** Preferência de leitura, no navegador: recolhida ou não. */
export function lerSidebarRecolhida(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_SIDEBAR_RECOLHIDA) === '1';
  } catch {
    return false;
  }
}

export function gravarSidebarRecolhida(recolhida: boolean): void {
  try {
    window.localStorage.setItem(CHAVE_SIDEBAR_RECOLHIDA, recolhida ? '1' : '0');
  } catch {
    /* preferência de leitura não pode derrubar a navegação */
  }
}

export const chaveDosGrupos = (userId?: string) => `praefectus:sidebar:grupos:${userId ?? 'anon'}`;

export function lerGrupos(chave: string): Record<string, boolean> {
  try {
    const bruto = window.localStorage.getItem(chave);
    const lido = bruto ? JSON.parse(bruto) : {};
    return lido && typeof lido === 'object' ? lido : {};
  } catch {
    return {};
  }
}

export function gravarGrupos(chave: string, valor: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* idem */
  }
}

/** O item cobre a rota atual? `?pasta=` distingue as pastas do Financeiro. */
export function itemAtivo(path: string, pathname: string, search: string): boolean {
  const [base, consulta] = path.split('?');
  if (base === ROTA_PAINEL) return pathname === ROTA_PAINEL;
  const naBase = pathname === base || pathname.startsWith(base + '/');
  if (!naBase) return false;
  if (!consulta) return true;
  return new URLSearchParams(search).toString().includes(consulta);
}

/** O grupo contém a rota atual (independente da consulta)? */
export function grupoContem(grupo: { items: { path: string }[] }, pathname: string): boolean {
  return grupo.items.some((item) => {
    const base = item.path.split('?')[0];
    return base !== ROTA_PAINEL && (pathname === base || pathname.startsWith(base + '/'));
  });
}
