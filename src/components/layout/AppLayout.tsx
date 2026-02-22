import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import NotificationCenter from '@/components/notifications/NotificationCenter';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = user?.user_metadata?.nome_completo
    ? user.user_metadata.nome_completo.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'LI';

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-[240px] transition-all duration-300">
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-lg border-b border-border flex items-center justify-between px-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar licitações, órgãos, editais..."
              className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-accent"
            />
          </div>
          <div className="flex items-center gap-4">
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
        <main className="p-6">{children}</main>
      </div>

      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigate={(path) => {
          setNotifOpen(false);
          navigate(path);
        }}
      />
    </div>
  );
}
