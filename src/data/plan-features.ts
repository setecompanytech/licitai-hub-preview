/**
 * Mapeamento de rotas por plano.
 * Rotas não listadas aqui são acessíveis a todos os planos (incluindo sem assinatura).
 */

export type PlanSlug = 'basico' | 'profissional' | 'enterprise';

/** Hierarquia dos planos (índice = nível de acesso) */
export const planHierarchy: PlanSlug[] = ['basico', 'profissional', 'enterprise'];

export const planDisplayNames: Record<PlanSlug, string> = {
  basico: 'Básico',
  profissional: 'Profissional',
  enterprise: 'Enterprise',
};

/**
 * Plano mínimo requerido para cada rota protegida.
 * Se a rota não está aqui, qualquer plano (ou sem plano) pode acessar.
 */
export const routeMinPlan: Record<string, PlanSlug> = {
  // Profissional+
  '/robo-lances': 'profissional',
  '/concorrentes': 'profissional',
  '/assistente': 'profissional',
  '/apoio-juridico': 'profissional',
  '/apoio-contabil': 'profissional',
  '/whatsapp-crm': 'profissional',
  '/workflow-ia': 'profissional',
  '/proposta-tecnica': 'profissional',
  '/indices-repactuacao': 'profissional',
  '/analytics': 'profissional',

  // Básico+
  '/gestao-compras': 'basico',

  // Enterprise only
  '/precificacao': 'enterprise',
  '/api-integracao': 'enterprise',
  '/gestao-contratos': 'enterprise',
  '/relatorio-contabil': 'enterprise',
  '/analise-mercado': 'enterprise',
  '/equipe': 'enterprise',
};

/**
 * Verifica se o plano do usuário tem acesso a uma rota.
 */
export function hasAccessToRoute(userPlan: PlanSlug | null, route: string): boolean {
  const requiredPlan = routeMinPlan[route];
  if (!requiredPlan) return true; // rota livre
  if (!userPlan) return false; // sem plano, rota requer plano

  const userLevel = planHierarchy.indexOf(userPlan);
  const requiredLevel = planHierarchy.indexOf(requiredPlan);
  return userLevel >= requiredLevel;
}

/**
 * Retorna o plano mínimo exigido para uma rota, ou null se livre.
 */
export function getRequiredPlan(route: string): PlanSlug | null {
  return routeMinPlan[route] || null;
}
