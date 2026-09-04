import SkeletonPagina from '@/components/shared/SkeletonPagina';
import { useAuthorization } from '@/hooks/useAuthorization';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Restringe rotas /admin/** ao ADMIN GLOBAL do sistema.
 * Admins de empresa NÃO entram aqui (continuam restritos a operações da empresa).
 */
export default function AdminGuard({ children }: AdminGuardProps) {
  const { isSystemAdmin, loading } = useAuthorization();
  const navigate = useNavigate();

  /* Esta guarda roda FORA do AppLayout — quem desenha a barra é a página que
     vem depois dela. Com um spinner solto aqui, a sequência era: esqueleto do
     ProtectedRoute (com moldura) → tela branca → página. O esqueleto com
     moldura elimina o pisca. */
  if (loading) {
    return <SkeletonPagina />;
  }

  if (!isSystemAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Acesso Restrito</h1>
            <p className="text-muted-foreground text-sm">
              Este módulo é exclusivo para administradores do sistema.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
