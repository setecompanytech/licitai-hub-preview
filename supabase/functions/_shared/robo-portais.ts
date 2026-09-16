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

/** Nome de exibição (e apelido) → id de armazenamento. */
const ID_POR_NOME: Record<string, string> = {
  "compras.gov.br": "compras-gov",
  "compras governamentais": "compras-gov",
  "bll compras": "bll",
  "licitacoes-e (bb)": "licitacoes-e",
  "bolsa nacional de compras": "bnc",
  "portal de compras publicas": "portal-compras",
  "bec/sp": "bec-sp",
  "pncp": "pncp",
  "licitanet": "licitanet",
  "banparanet (pa)": "banparanet",
  "bbmnet": "bbmnet",
  "comprasbr": "comprasbr",
  "licitar digital": "licitar-digital",
  "compras publicas rj": "compras-rj",
  "comprasnet ba": "comprasnet-ba",
  "comprasnet go": "comprasnet-go",
  "compras mg": "compras-mg",
  "pe integrado": "compras-pe",
  "compras pr": "compras-pr",
  "compras rs": "compras-rs",
  "compras sc": "compras-sc",
  "e-compras df": "compras-df",
  "e-compras am": "e-compras-am",
  "portal compras ce": "portal-compras-ce",
};

function semAcento(valor: string): string {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * O id de armazenamento a partir do que estiver gravado na disputa — id ou
 * nome de exibição.
 *
 * POR QUE ISTO EXISTE (16/09/2026): o formulário da disputa grava o **nome**
 * do portal (`<SelectItem value={p.nome}>`), e quem traduz para id no envio
 * manual é o navegador, com `idDoPortal()`. O agendador lê a disputa direto
 * do banco e não tem esse intermediário: mandou "Compras.gov.br" para
 * `portalDoAgente()`, que só conhece ids, e a disputa foi marcada como
 * despachada sem ninguém entrar na sala.
 *
 * Devolve `null` para o que não reconhece — repassar o valor cru só empurraria
 * a falha para o agente, longe de quem pode explicá-la.
 */
export function idDeArmazenamento(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const alvo = valor.trim();
  if (PORTAL_NO_AGENTE[alvo]) return alvo;
  return ID_POR_NOME[semAcento(alvo)] ?? null;
}
