import type { Setor } from '@/hooks/useMembroPermissoes';

/**
 * Mapeamento de rotas → setores autorizados.
 * Se uma rota não está listada, é considerada PÚBLICA (qualquer membro autenticado pode ver).
 *
 * Regras:
 * - 'geral' aparece quando o item está disponível para qualquer setor (ex.: dashboard, suporte).
 * - Admin global do sistema (user_roles.role='admin') ignora todos os bloqueios.
 * - Admin de empresa NÃO ignora — ele só vê o que é do(s) seu(s) setor(es).
 */
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
  '/gestao-contratos': ['comercial', 'financeiro', 'juridico'],

  // --- Inteligência & Preços
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

export function isSectorAllowedForRoute(setor: Setor, path: string): boolean {
  // Rotas /admin/** são exclusivas de admin global do sistema (validado fora deste util).
  if (path.startsWith('/admin/')) return false;
  const allowed = ROUTE_SECTOR_MAP[path];
  // Rotas não mapeadas: liberar (não há bloqueio explícito).
  if (!allowed) return true;
  return allowed.includes(setor);
}
