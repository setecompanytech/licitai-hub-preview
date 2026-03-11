import { ReactNode, useState, useEffect, forwardRef, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppTopNav from './AppTopNav';
import AlertaVencimentoBanner from './AlertaVencimentoBanner';
import { Bell, Settings, Building2, User, Shield, Globe, CreditCard, LogOut, Palette, Zap } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import FloatingChat from '@/components/chat/FloatingChat';
import GlobalSearch from '@/components/search/GlobalSearch';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';

const profileMenuItems = [
  { label: 'Dados da Empresa', icon: Building2, path: '/configuracoes', hash: '#empresa' },
  { label: 'Representante Legal', icon: User, path: '/configuracoes', hash: '#representante' },
  { label: 'Monitoramento', icon: Globe, path: '/configuracoes', hash: '#monitoramento' },
  { label: 'Notificações', icon: Bell, path: '/configuracoes', hash: '#notificacoes' },
  { label: 'Segurança', icon: Shield, path: '/configuracoes', hash: '#seguranca' },
  { label: 'Plano & Assinatura', icon: CreditCard, path: '/configuracoes', hash: '#plano' },
  { label: 'Aparência', icon: Palette, path: '/configuracoes', hash: '#aparencia' },
];

const AppLayout = forwardRef<HTMLDivElement, { children: ReactNode }>(function AppLayout({ children }, _ref) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [unreadCount, setUnreadCount] = useState(0);

  const userName = user?.user_metadata?.nome_completo || empresaAtiva?.razao_social || user?.email || '';
  const userEmail = user?.email || '';
  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : userEmail.slice(0, 2).toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('lida', false)
      .then(({ count }) => setUnreadCount(count || 0));

    const channel = supabase
      .channel('notificacoes-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notificacoes',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        supabase
          .from('notificacoes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('lida', false)
          .then(({ count }) => setUnreadCount(count || 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleProfileNav = (path: string, hash: string) => {
    setProfileOpen(false);
    navigate(path + hash);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top header bar */}
      <header className="sticky top-0 z-40 h-14 bg-card/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-4">
          {/* Logo first */}
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
              <Zap className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="text-base font-brand font-bold tracking-widest uppercase hidden sm:inline">
              PRAEFECTUS
            </span>
          </button>

          {/* Navigation */}
          <AppTopNav />
        </div>

        {/* Right: Tools */}
        <div className="flex items-center gap-1.5">
          <div className="hidden md:block">
            <EmpresaSelector />
          </div>

          <button
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            onClick={() => navigate('/configuracoes')}
            title="Configurações"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          <ThemeToggle />

          <button
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <Bell className="w-[18px] h-[18px] text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Avatar dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer"
              onClick={() => setProfileOpen(o => !o)}
              title="Minha conta"
            >
              {initials}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-11 w-[300px] bg-card border border-border rounded-xl shadow-xl z-50 animate-fade-in overflow-hidden">
                <div className="px-5 pt-5 pb-3 text-center border-b border-border">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold mx-auto mb-3">
                    {initials}
                  </div>
                  <p className="font-semibold text-foreground text-sm truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  {empresaAtiva && (
                    <p className="text-xs text-accent mt-1 truncate">{empresaAtiva.nome_fantasia || empresaAtiva.razao_social}</p>
                  )}
                </div>

                <div className="py-1.5 max-h-[260px] overflow-y-auto">
                  {profileMenuItems.map((item) => (
                    <button
                      key={item.label}
                      className="w-full flex items-center gap-3 px-5 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left"
                      onClick={() => handleProfileNav(item.path, item.hash)}
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border p-2.5 flex justify-center">
                  <button
                    className="flex items-center gap-2 text-[13px] text-destructive hover:bg-destructive/5 px-4 py-2 rounded-lg transition-colors"
                    onClick={() => { setProfileOpen(false); signOut(); }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1440px] mx-auto p-4 sm:p-6">
        <AlertaVencimentoBanner />
        {children}
      </main>

      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigate={(path) => {
          setNotifOpen(false);
          navigate(path);
        }}
      />
      <FloatingChat />
      <GlobalSearch />
    </div>
  );
});

export default AppLayout;
