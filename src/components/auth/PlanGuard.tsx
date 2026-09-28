import SkeletonPagina from '@/components/shared/SkeletonPagina';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthorization } from '@/hooks/useAuthorization';
import { getRequiredPlan, planDisplayNames } from '@/data/plan-features';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanGuardProps {
  children: React.ReactNode;
}

/**
 * Guard de plano. Toda a lógica de bypass (admin global / admin empresa)
 * vive em `useAuthorization`. Aqui só renderizamos UI.
 */
export default function PlanGuard({ children }: PlanGuardProps) {
  const { subscription, refreshSubscription } = useAuth();
  const { loading, isSystemAdmin, canAccessByPlan } = useAuthorization();
  const location = useLocation();
  const navigate = useNavigate();

  // Mesma razão do AdminGuard: fora do AppLayout, spinner solto vira branco.
  if (loading) {
    return <SkeletonPagina />;
  }

  // Bypass total só para o administrador do sistema — ver canAccessByPlan.
  if (isSystemAdmin) return <>{children}</>;

  if (subscription.loading) {
    return <SkeletonPagina />;
  }

  if (canAccessByPlan(location.pathname)) return <>{children}</>;

  // Não se sabe ≠ não tem (28/09/2026): a verificação falhou na edge e no
  // banco. Oferecer upgrade a quem já paga é o erro que a ETHOS viu.
  if (subscription.erro && !subscription.planSlug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center shadow-sm" data-testid="assinatura-nao-confirmada">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-warning-tint">
            <RefreshCw className="h-7 w-7 text-warning-ink" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Não conseguimos confirmar sua assinatura</h1>
            <p className="text-sm text-muted-foreground">A verificação do plano não respondeu. Isso é falha de conexão, não falta de assinatura. Tente de novo em instantes.</p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => void refreshSubscription()}><RefreshCw aria-hidden="true" /> Tentar de novo</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
          </div>
        </div>
      </div>
    );
  }

  const requiredPlan = getRequiredPlan(location.pathname);
  const requiredPlanName = requiredPlan ? planDisplayNames[requiredPlan] : '';
  const currentPlanName = subscription.planSlug
    ? planDisplayNames[subscription.planSlug]
    : 'Nenhum';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-tint">
          <Lock className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Recurso do Plano {requiredPlanName}</h1>
          <p className="text-sm text-muted-foreground">
            Esta funcionalidade requer o plano <strong>{requiredPlanName}</strong> ou superior.
            {subscription.planSlug && (
              <> Seu plano atual é <strong>{currentPlanName}</strong>.</>
            )}
            {!subscription.planSlug && (
              <> Você ainda não possui uma assinatura ativa.</>
            )}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/configuracoes?scroll=planos')}>
            <ArrowRight aria-hidden="true" />
            Ver Planos & Fazer Upgrade
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
