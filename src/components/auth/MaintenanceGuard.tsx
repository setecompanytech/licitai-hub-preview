import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench } from 'lucide-react';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import SkeletonPagina from '@/components/shared/SkeletonPagina';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export default function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  const { isMaintenanceMode, loading: maintLoading } = useMaintenanceMode();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user, loading: authLoading } = useAuth();

  // authLoading só importa quando o modo manutenção está ativo (para decidir se o admin bypass)
  const loading = maintLoading || (isMaintenanceMode && (authLoading || (user && roleLoading)));

  /* REBRAND — esta era a tela branca do app.
     A guarda embrulha TODAS as rotas e consulta o modo manutenção a cada
     carregamento, então todo mundo passava por aqui: o splash saía, e no lugar
     dele vinha uma página vazia com um ponto girando no meio — antes ainda do
     esqueleto do `ProtectedRoute`. Agora a espera já mostra o app montado:
     barra navy com a logo, coluna lateral e o conteúdo em esqueleto. */
  if (loading) {
    return <SkeletonPagina />;
  }

  // If not in maintenance mode, render normally
  if (!isMaintenanceMode) {
    return <>{children}</>;
  }

  // Admin bypass
  if (user && isAdmin) {
    return <>{children}</>;
  }

  // Show maintenance page
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="flex justify-center">
          <PraefectusLogo size="lg" />
        </div>

        <div className="mx-auto w-20 h-20 rounded-2xl bg-warning/10 flex items-center justify-center">
          <Wrench className="w-10 h-10 text-warning" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">
            Em Manutenção
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Estamos realizando ajustes internos para melhorar sua experiência.
            O sistema estará disponível em breve.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            📧 Em caso de urgência, entre em contato pelo e-mail{' '}
            <a href="mailto:suporte@praefectus.com.br" className="text-accent hover:underline font-medium">
              suporte@praefectus.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
