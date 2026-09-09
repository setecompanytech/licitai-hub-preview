/**
 * Autoridade única dos portais do Robô de Lances.
 *
 * Mora fora dos componentes pela mesma razão que `src/lib/navegacao/menu.ts`:
 * constante exportada de dentro de um arquivo de componente desliga a
 * atualização instantânea da tela naquele arquivo.
 *
 * A razão principal, porém, é outra. A lista existia em duas cópias — uma no
 * `ConfigurarLanceDialog` (10 portais) e outra no `CredenciaisPortalForm` (20) —
 * e o defeito que isso escondia era pior que a duplicação em si: o seletor de
 * disputa gravava o **nome** do portal (`value={p.nome}`), enquanto a tabela de
 * credenciais e o registro de portais do agente são indexados pelo **id**.
 *
 * O resultado: a disputa dizia "Portal de Compras Públicas" e a busca da
 * credencial procurava por esse texto num campo que guarda `portal-compras`.
 * Nunca achava, e ninguém via — porque nada na interface chegava a disparar a
 * sessão.
 */

export type PortalRobo = { id: string; nome: string };

/** Os portais que o agente sabe operar — espelha o registry de `src/portals/`. */
export const PORTAIS_ROBO: readonly PortalRobo[] = [
  { id: 'pncp', nome: 'PNCP' },
  { id: 'compras-gov', nome: 'Compras Governamentais' },
  { id: 'bll', nome: 'BLL Compras' },
  { id: 'licitanet', nome: 'Licitanet' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras' },
  { id: 'banparanet', nome: 'Banparanet (PA)' },
  { id: 'bec-sp', nome: 'BEC/SP' },
  { id: 'compras-rj', nome: 'Compras Públicas RJ' },
] as const;

/**
 * Resolve o id do portal a partir do que estiver gravado na disputa.
 *
 * Aceita id ou nome porque as duas formas existem no banco: as disputas
 * gravadas até 08/09/2026 guardaram o nome de exibição. Traduzir na leitura
 * evita uma migration de dados para consertar o que é, na origem, um defeito de
 * formulário — e mantém funcionando o que já está gravado.
 *
 * Devolve `null` quando não reconhece, para quem chama poder dizer isso em vez
 * de mandar o robô a um portal que o agente não conhece.
 */
export function idDoPortal(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const alvo = valor.trim();
  const porId = PORTAIS_ROBO.find((p) => p.id === alvo);
  if (porId) return porId.id;
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const porNome = PORTAIS_ROBO.find((p) => norm(p.nome) === norm(alvo));
  return porNome ? porNome.id : null;
}

/** O nome de exibição, para mensagem de erro que a pessoa reconheça. */
export function nomeDoPortal(valor: string | null | undefined): string {
  const id = idDoPortal(valor);
  const achado = PORTAIS_ROBO.find((p) => p.id === id);
  return achado ? achado.nome : (valor || '—');
}
