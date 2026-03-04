import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import AlertaVencimentoBanner from './AlertaVencimentoBanner';
import { Bell, Menu } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import FloatingChat from '@/components/chat/FloatingChat';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const initials = user?.user_metadata?.nome_completo
    ? user.user_metadata.nome_completo.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'LI';

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && <AppSidebar />}

      {/* Mobile sidebar via Sheet */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[260px]">
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className={isMobile ? '' : 'ml-[240px] transition-all duration-300'}>
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-background/80 backdrop-blur-lg border-b border-border flex items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
            )}
            {!isMobile && (
              <span className="text-base font-bold tracking-tight">
                Licit<span className="text-accent">IA</span>
              </span>
            )}
            {isMobile && (
              <span className="text-base font-bold tracking-tight">
                Licit<span className="text-accent">IA</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {!isMobile && <EmpresaSelector />}
            <button
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                6
              </span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {initials}
            </div>
          </div>
        </header>
        <main className="p-3 sm:p-6">
          <AlertaVencimentoBanner />
          {children}
        </main>
      </div>

      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigate={(path) => {
          setNotifOpen(false);
          navigate(path);
        }}
      />
      <FloatingChat />
    </div>
  );
}
