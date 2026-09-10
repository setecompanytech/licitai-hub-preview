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
 *
 * ─── O SEGUNDO NOME, DESCOBERTO EM 09/09/2026 ───────────────────────────────
 *
 * Havia uma TERCEIRA lista: o `CredenciaisPortalForm` nunca foi migrado e
 * mantinha 23 portais próprios. Comparar as três com o registro do agente
 * (`/opt/agente-lances/src/portals/index.js`) mostrou que o id da tela e o id do
 * agente **não são o mesmo vocabulário**:
 *
 *   tela: `compras-gov`   ·   agente: `comprasgov`
 *
 * Uma disputa em Compras.gov passava por toda a validação, gravava a linha em
 * `sessoes_lance_real` com status "enviando" e só então o agente respondia
 * `Portal "compras-gov" não suportado`. E `banparanet` e `compras-rj` apareciam
 * no seletor de disputa sem existir no agente de forma alguma.
 *
 * Por isso cada portal declara aqui, explicitamente, **como o agente o chama**.
 *
 * O QUE ESTA LISTA NÃO DIZ: se o agente que está no ar naquele momento tem o
 * módulo instalado. Ela descreve o vocabulário, não o estado do servidor — a VPS
 * pode estar rodando um build antigo (em 09/09/2026 estava: 8 dos 23 módulos).
 * Fixar aqui "o robô opera X" seria uma verdade com prazo de validade, que
 * envelhece sem avisar. Quem sabe disso é o próprio agente, no
 * `portais_suportados` do `/health`, e é lá que o envio consulta.
 *
 * O `id` é imutável: é o que está gravado em `credenciais_portais.portal_id`.
 * Renomear um id órfã a credencial já cadastrada, em silêncio.
 */

export type AutenticacaoPortal = 'login' | 'login-bb' | 'login+cert' | 'certificado';

export type PortalRobo = {
  /** Chave de armazenamento. É o que está em `credenciais_portais.portal_id`. */
  id: string;
  nome: string;
  /** O que o portal exige para entrar — vira selo no formulário de credencial. */
  auth: AutenticacaoPortal;
  /**
   * Como o agente chama este portal no registro de `src/portals/index.js`.
   * Igual ao `id` em 22 dos 23 casos — e é justamente a exceção que quebrava.
   */
  agente: string;
  /** Nomes de exibição antigos, para resolver disputas gravadas antes. */
  apelidos?: readonly string[];
};

/**
 * Todos os portais que a interface oferece — para credencial e para disputa.
 *
 * A ordem é a de prioridade comercial, e é a ordem em que aparecem nos
 * seletores.
 */
export const PORTAIS_ROBO: readonly PortalRobo[] = [
  // ─── Operados pelo agente ────────────────────────────────────────────────
  {
    id: 'compras-gov',
    nome: 'Compras.gov.br',
    auth: 'certificado',
    agente: 'comprasgov',
    // O seletor de disputa exibiu este nome até 08/09/2026.
    apelidos: ['Compras Governamentais'],
  },
  { id: 'bll', nome: 'BLL Compras', auth: 'login', agente: 'bll' },
  { id: 'licitacoes-e', nome: 'Licitações-e (BB)', auth: 'login-bb', agente: 'licitacoes-e' },
  { id: 'bnc', nome: 'Bolsa Nacional de Compras', auth: 'login', agente: 'bnc' },
  { id: 'portal-compras', nome: 'Portal de Compras Públicas', auth: 'login', agente: 'portal-compras' },
  { id: 'bec-sp', nome: 'BEC/SP', auth: 'login+cert', agente: 'bec-sp' },
  { id: 'pncp', nome: 'PNCP', auth: 'certificado', agente: 'pncp' },
  { id: 'licitanet', nome: 'Licitanet', auth: 'login', agente: 'licitanet' },

  // ─── Estaduais e regionais ───────────────────────────────────────────────
  // Os módulos existem em `src/lib/agent-template/portals-estaduais.ts`. Que a
  // VPS os tenha ou não é pergunta para o `/health`, não para esta lista.
  { id: 'banparanet', nome: 'Banparanet (PA)', auth: 'login+cert', agente: 'banparanet' },
  { id: 'bbmnet', nome: 'BBMNet', auth: 'login+cert', agente: 'bbmnet' },
  { id: 'comprasbr', nome: 'ComprasBR', auth: 'login', agente: 'comprasbr' },
  { id: 'licitar-digital', nome: 'Licitar Digital', auth: 'login', agente: 'licitar-digital' },
  { id: 'compras-rj', nome: 'Compras Públicas RJ', auth: 'login', agente: 'compras-rj' },
  { id: 'comprasnet-ba', nome: 'ComprasNet BA', auth: 'login', agente: 'comprasnet-ba' },
  { id: 'comprasnet-go', nome: 'ComprasNet GO', auth: 'login', agente: 'comprasnet-go' },
  { id: 'compras-mg', nome: 'Compras MG', auth: 'login', agente: 'compras-mg' },
  { id: 'compras-pe', nome: 'PE Integrado', auth: 'login', agente: 'compras-pe' },
  { id: 'compras-pr', nome: 'Compras PR', auth: 'login', agente: 'compras-pr' },
  { id: 'compras-rs', nome: 'Compras RS', auth: 'login', agente: 'compras-rs' },
  { id: 'compras-sc', nome: 'Compras SC', auth: 'login', agente: 'compras-sc' },
  { id: 'compras-df', nome: 'e-Compras DF', auth: 'login', agente: 'compras-df' },
  { id: 'e-compras-am', nome: 'e-Compras AM', auth: 'login', agente: 'e-compras-am' },
  { id: 'portal-compras-ce', nome: 'Portal Compras CE', auth: 'login', agente: 'portal-compras-ce' },
] as const;

// O intervalo vai escapado de propósito: escrever os diacríticos literais deixa
// o arquivo à mercê de qualquer normalização de editor, e o regex passa a não
// casar com nada — em silêncio, porque `replace` que não acha não reclama.
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** A entrada completa, a partir de id, nome atual ou nome antigo. */
export function acharPortal(valor: string | null | undefined): PortalRobo | null {
  if (!valor) return null;
  const alvo = valor.trim();

  const porId = PORTAIS_ROBO.find((p) => p.id === alvo);
  if (porId) return porId;

  const alvoNorm = norm(alvo);
  return (
    PORTAIS_ROBO.find(
      (p) =>
        norm(p.nome) === alvoNorm ||
        (p.apelidos || []).some((a) => norm(a) === alvoNorm),
    ) || null
  );
}

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
  return acharPortal(valor)?.id ?? null;
}

/** O nome de exibição, para mensagem de erro que a pessoa reconheça. */
export function nomeDoPortal(valor: string | null | undefined): string {
  return acharPortal(valor)?.nome ?? (valor || '—');
}

/**
 * O nome do portal no registro do agente — `null` quando o portal é desconhecido.
 *
 * É o valor que vai no `portal_id` do payload de `/sessao/iniciar`, e é
 * diferente do id de armazenamento em exatamente um caso (`compras-gov` →
 * `comprasgov`).
 */
export function portalDoAgente(valor: string | null | undefined): string | null {
  return acharPortal(valor)?.agente ?? null;
}

/**
 * O agente que está no ar tem módulo para este portal?
 *
 * `suportados` é o `portais_suportados` do `/health`. Quando vier `null` — o
 * agente não respondeu —, devolve `true`: recusar por falta de resposta seria
 * bloquear um envio que talvez funcionasse, e o erro real aparece adiante com o
 * nome certo. A dúvida não vira acusação.
 */
export function agenteOpera(
  valor: string | null | undefined,
  suportados: readonly string[] | null | undefined,
): boolean {
  const doAgente = portalDoAgente(valor);
  if (!doAgente) return false;
  if (!suportados || suportados.length === 0) return true;
  return suportados.includes(doAgente);
}
