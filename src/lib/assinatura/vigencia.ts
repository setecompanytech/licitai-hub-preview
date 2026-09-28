/**
 * Assinatura vigente lida direto do banco (28/09/2026) — a rede de segurança
 * de quando a edge `check-subscription` não responde.
 *
 * O que aconteceu: a tela do plano abriu com "Você ainda não possui uma
 * assinatura ativa" para a ETHOS, que tem Enterprise até 2027. A consulta à
 * edge tinha 6 s de prazo; estourado (ou com erro de rede), o estado ficava
 * no valor inicial — "sem assinatura" — e o PlanGuard bloqueava. Falha de
 * rede não é falta de assinatura. Puro: o contexto só chama.
 */
import { planHierarchy, type PlanSlug } from '@/data/plan-features';

export type LinhaDeAssinatura = { status: string; data_fim: string | null; planos: { slug: string | null } | { slug: string | null }[] | null };
export type AssinaturaVigente = { planSlug: PlanSlug; subscriptionEnd: string | null; status: string };

const slugDe = (l: LinhaDeAssinatura): string | null => {
  const p = Array.isArray(l.planos) ? l.planos[0] : l.planos;
  return p?.slug ?? null;
};

/**
 * Entre as assinaturas que a pessoa enxerga (RLS: só das empresas dela), a
 * melhor vigente: status trial/ativa, sem data de fim ou com fim no futuro;
 * empatando, o maior plano. `data_fim` nula = por tempo indeterminado.
 */
export function melhorAssinaturaVigente(linhas: LinhaDeAssinatura[], agora = Date.now()): AssinaturaVigente | null {
  const vigentes = linhas
    .filter((l) => l.status === 'trial' || l.status === 'ativa')
    .filter((l) => !l.data_fim || new Date(l.data_fim).getTime() > agora)
    .map((l) => ({ l, slug: slugDe(l) }))
    .filter((x): x is { l: LinhaDeAssinatura; slug: PlanSlug } => !!x.slug && (planHierarchy as string[]).includes(x.slug));
  if (vigentes.length === 0) return null;
  vigentes.sort((a, b) => planHierarchy.indexOf(b.slug) - planHierarchy.indexOf(a.slug) || (a.l.data_fim ? 1 : 0) - (b.l.data_fim ? 1 : 0));
  const m = vigentes[0];
  return { planSlug: m.slug, subscriptionEnd: m.l.data_fim ?? null, status: m.l.status };
}
