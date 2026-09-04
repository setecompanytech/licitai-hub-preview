import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SkeletonPagina from '@/components/shared/SkeletonPagina';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  /* Espera da sessão — toda página autenticada passa por aqui, então é a
     segunda tela de carregamento mais vista do app, depois do splash. O
     esqueleto tem a forma do que vem; o spinner que estava aqui não tinha. */
  if (loading) {
    return <SkeletonPagina />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
