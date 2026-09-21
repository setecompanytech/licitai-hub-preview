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
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        {/* Estado de bloqueio no padrão do DS v3: ladrilho `rounded-lg` no trio
            destructive (tint/ink), título 20/600, descrição 13 — era um
            `rounded-2xl` com `bg-destructive/10`, fora do manual. */}
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-destructive-line bg-destructive-tint text-destructive-ink">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Acesso Restrito</h1>
            <p className="text-sm text-muted-foreground">
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
