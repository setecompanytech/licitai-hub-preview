import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { hasAccessToRoute, getRequiredPlan, planDisplayNames } from '@/data/plan-features';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanGuardProps {
  children: React.ReactNode;
}

export default function PlanGuard({ children }: PlanGuardProps) {
  const { subscription } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();

  // Still loading role or subscription — show spinner
  if (roleLoading || subscription.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Admins bypass plan restrictions
  if (isAdmin) return <>{children}</>;

  const hasAccess = hasAccessToRoute(subscription.planSlug, location.pathname);

  if (hasAccess) return <>{children}</>;

  const requiredPlan = getRequiredPlan(location.pathname);
  const requiredPlanName = requiredPlan ? planDisplayNames[requiredPlan] : '';
  const currentPlanName = subscription.planSlug
    ? planDisplayNames[subscription.planSlug]
    : 'Nenhum';

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-accent" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Recurso do Plano {requiredPlanName}</h1>
          <p className="text-muted-foreground text-sm">
            Esta funcionalidade requer o plano <strong>{requiredPlanName}</strong> ou superior.
            {subscription.planSlug && (
              <> Seu plano atual é <strong>{currentPlanName}</strong>.</>
            )}
            {!subscription.planSlug && (
              <> Você ainda não possui uma assinatura ativa.</>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate('/configuracoes?scroll=planos')}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
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
