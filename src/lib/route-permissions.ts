import type { Setor } from '@/hooks/useMembroPermissoes';

/**
 * Mapeamento de rotas → setores autorizados.
 * Se uma rota não está listada, é considerada PÚBLICA (qualquer membro autenticado pode ver).
 *
 * Regras:
 * - 'geral' aparece quando o item está disponível para qualquer setor (ex.: dashboard, suporte).
 * - Admin global e ADMIN da empresa ignoram todos os bloqueios no hook de permissões.
 * - Operadores e visualizadores seguem o setor configurado.
 * - Rotas de ADMINISTRAÇÃO (abaixo) não dependem de setor: são do administrador
 *   da empresa, qualquer que seja o setor da pessoa.
 */

/**
 * Rotas que administram a EMPRESA, não o trabalho do dia.
 *
 * Estavam liberadas para todos os setores, então um operador via — e abria —
 * cadastro de empresas, gestão de equipe, plano/assinatura e chaves de
 * integração. O banco impedia o estrago (RLS), mas a navegação oferecia o que
 * a pessoa não deve operar: ela entrava, tentava e tomava um erro sem
 * explicação. Mesmo critério já aplicado às abas do Robô de Lances.
 */
export const ROTAS_ADMINISTRATIVAS: string[] = [
  '/empresas',
  '/equipe',
  '/equipe/permissoes',
  '/configuracoes',
  '/configuracoes/alertas',
  '/api-integracao',
];

export const ehRotaAdministrativa = (path: string): boolean =>
  ROTAS_ADMINISTRATIVAS.some((r) => path === r || path.startsWith(`${r}?`) || path.startsWith(`${r}/`));

/**
 * Rota do OPERADOR do Praefectus — quem administra o SaaS, não quem assina.
 *
 * A distinção existe em `useUserRole` desde sempre (`isSystemAdmin` para o
 * operador, `isCompanyAdmin` para o dono da empresa), mas a navegação não a
 * respeitava: `canAccessRoute` liberava TUDO para o administrador da
 * empresa, e o grupo "Admin" — templates de IA, assinaturas dos clientes,
 * marketing, auditoria, métricas do SaaS — aparecia no menu de qualquer
 * assinante. A rota em si sempre esteve protegida pelo AdminGuard, então
 * não houve vazamento de dado; o que vazava era a EXISTÊNCIA do painel, e
 * quem clicasse batia num "Acesso Restrito" sem entender por quê.
 */
export const ehRotaDoOperador = (path: string): boolean =>
  path === '/admin' || path.startsWith('/admin/');
export const ROUTE_SECTOR_MAP: Record<string, Setor[]> = {
  // --- Painel (todos veem)
  '/dashboard': ['geral', 'financeiro', 'comercial', 'logistica', 'juridico', 'contabil', 'licitacoes', 'documentos'],
  '/analytics': ['geral', 'financeiro', 'comercial', 'licitacoes'],

  // --- Monitoramento (comercial/licitações)
  '/monitoramento-editais': ['comercial', 'licitacoes'],
  '/diarios-oficiais': ['comercial', 'licitacoes', 'juridico'],
  '/avisos': ['geral', 'comercial', 'licitacoes'],
  '/boletins': ['comercial', 'licitacoes'],
  '/perfis-alerta': ['comercial', 'licitacoes'],
  '/monitoramento-chat': ['comercial', 'licitacoes'],

  // --- Gestão de Processos
  '/licitacoes-estrategicas': ['comercial', 'licitacoes'],
  '/meus-compromissos': ['geral', 'comercial', 'licitacoes', 'juridico'],
  '/calendario': ['geral', 'comercial', 'licitacoes'],
  '/workflow-ia': ['comercial', 'licitacoes'],
  '/kanban': ['comercial', 'licitacoes'],
  '/robo-lances': ['comercial', 'licitacoes'],
  '/historico-licitacoes': ['comercial', 'licitacoes'],
  '/metas-comercial': ['comercial', 'financeiro'],
  '/gestao-contratos': ['comercial', 'financeiro', 'juridico'],
  '/gestao-compras':   ['comercial', 'financeiro', 'logistica'],

  // --- Inteligência
  '/precificacao': ['comercial', 'licitacoes', 'financeiro'],
  '/proposta-tecnica': ['comercial', 'licitacoes'],
  '/analise-mercado': ['comercial', 'licitacoes'],
  '/concorrentes': ['comercial', 'licitacoes'],

  // --- Jurídico & Contábil
  '/documentos': ['juridico', 'contabil', 'documentos', 'comercial'],
  '/assessoria-cadastral': ['juridico', 'documentos', 'comercial'],
  '/apoio-juridico': ['juridico'],
  '/apoio-contabil': ['contabil', 'financeiro'],
  '/indices-repactuacao': ['financeiro', 'contabil'],

  // --- Financeiro (exclusivo)
  '/financeiro': ['financeiro'],
  '/auditoria-bancos': ['financeiro'],

  // --- Comunicação
  '/whatsapp-crm': ['geral', 'comercial'],

  // --- Ferramentas (geral)
  '/aurelia': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/agente': ['comercial', 'licitacoes'],
  '/assistente': ['geral', 'comercial', 'licitacoes', 'juridico', 'contabil', 'financeiro'],
  '/assistente-especializado': ['geral', 'comercial', 'licitacoes', 'juridico', 'contabil'],
  '/api-integracao': ['geral'],
  '/tutorial': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/blog': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/ebook': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/ferramentas': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],

  // --- Configuração (todos veem; ações sensíveis seguem RLS)
  '/empresas': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/equipe': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/configuracoes': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
  '/configuracoes/alertas': ['geral', 'comercial', 'licitacoes'],
  '/suporte': ['geral', 'comercial', 'financeiro', 'juridico', 'contabil', 'licitacoes', 'logistica', 'documentos'],
};

/**
 * Páginas de DETALHE que herdam o portão da lista de onde saem.
 *
 * Os mapas de acesso (setor, aqui; plano, em `data/plan-features.ts`) procuram
 * a rota EXATA. Uma página nova como `/robo-lances/disputa/<id>` não está em
 * nenhum deles — e rota não listada é rota livre. Seria a segunda porta para a
 * mesma sala sem a fechadura da primeira, o defeito que `/produtos` já teve.
 *
 * A lista é explícita, e não "todo prefixo herda": `/equipe/permissoes`, por
 * exemplo, tem regra própria e não pode mudar de portão sem decisão de alguém.
 */
const ROTAS_DE_DETALHE: ReadonlyArray<readonly [string, string]> = [
  // [prefixo do detalhe, rota da lista]
  ['/robo-lances/disputa/', '/robo-lances'],
];

/** A rota cujas regras de acesso valem para `path`: ela mesma, ou a lista de onde o detalhe sai. */
export function rotaQueDecideOAcesso(path: string): string {
  const semBusca = path.split('?')[0];
  const detalhe = ROTAS_DE_DETALHE.find(([prefixo]) => semBusca.startsWith(prefixo));
  return detalhe ? detalhe[1] : path;
}

export function isSectorAllowedForRoute(setor: Setor, path: string): boolean {
  // Rotas /admin/** são exclusivas de admin global do sistema (validado fora deste util).
  if (path.startsWith('/admin/')) return false;
  const allowed = ROUTE_SECTOR_MAP[rotaQueDecideOAcesso(path)];
  // Rotas não mapeadas: liberar (não há bloqueio explícito).
  if (!allowed) return true;
  return allowed.includes(setor);
}
