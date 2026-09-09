// @ts-nocheck
/**
 * Espelho Deno de `src/lib/robo/portais.ts` — só a parte que o servidor precisa:
 * a tradução do id da tela para o nome do portal no registro do agente.
 *
 * POR QUE ESPELHO E NÃO CAMPO NO PAYLOAD: quem manda a sessão é o navegador. Se
 * o nome do módulo do agente viesse do cliente, bastaria um front desatualizado
 * — ou uma aba aberta desde ontem — para despachar sessão apontando para um
 * módulo que não existe. A tradução é decisão do servidor.
 *
 * POR QUE DOIS ARQUIVOS: edge function roda em Deno e não importa de `src/`.
 * É o mesmo arranjo de `_shared/licitacao-status.ts`, e a mesma proteção:
 * `src/test/agente-template.test.ts` falha se este mapa divergir da lista do app
 * ou do registro real do agente.
 *
 * O que este mapa conserta, concretamente: a tela chama `compras-gov` e o agente
 * chama `comprasgov`. Sem a tradução, a sessão era criada com status "enviando"
 * e só morria no agente, com `Portal "compras-gov" não suportado` — depois de a
 * linha já existir no banco.
 */

/** id de armazenamento (`credenciais_portais.portal_id`) → módulo do agente. */
export const PORTAL_NO_AGENTE: Record<string, string> = {
  "compras-gov": "comprasgov",
  "bll": "bll",
  "licitacoes-e": "licitacoes-e",
  "bnc": "bnc",
  "portal-compras": "portal-compras",
  "bec-sp": "bec-sp",
  "pncp": "pncp",
  "licitanet": "licitanet",
  "banparanet": "banparanet",
  "bbmnet": "bbmnet",
  "comprasbr": "comprasbr",
  "licitar-digital": "licitar-digital",
  "compras-rj": "compras-rj",
  "comprasnet-ba": "comprasnet-ba",
  "comprasnet-go": "comprasnet-go",
  "compras-mg": "compras-mg",
  "compras-pe": "compras-pe",
  "compras-pr": "compras-pr",
  "compras-rs": "compras-rs",
  "compras-sc": "compras-sc",
  "compras-df": "compras-df",
  "e-compras-am": "e-compras-am",
  "portal-compras-ce": "portal-compras-ce",
};

/**
 * O módulo do agente para este portal, ou `null` quando o robô não o opera.
 *
 * Devolver `null` em vez de repassar o id cru é o ponto: deixa quem chama
 * recusar com uma frase que a pessoa entende, antes de gravar qualquer coisa.
 */
export function portalDoAgente(portalId: string | null | undefined): string | null {
  if (!portalId) return null;
  return PORTAL_NO_AGENTE[portalId.trim()] ?? null;
}
