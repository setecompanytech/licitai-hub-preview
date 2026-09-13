import { ReactNode, useState, useEffect, forwardRef, useRef } from 'react';
import BrandLogo from '@/components/shared/BrandLogo';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppTopNav from './AppTopNav';
import AppSidebar from './AppSidebar';
import LembreteDeVencimento from '@/components/documentos/LembreteDeVencimento';
import LembreteDeConvocacao from '@/components/monitoramento/LembreteDeConvocacao';
import AlertaVencimentoBanner from './AlertaVencimentoBanner';
import { Bell, Search, Settings, Building2, User, Shield, Globe, CreditCard, LogOut, Palette } from 'lucide-react';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import AureliaChat from '@/components/aurelia/AureliaChat';
import GlobalSearch from '@/components/search/GlobalSearch';
import ThemeToggle from '@/components/theme/ThemeToggle';
import MaintenanceBanner from '@/components/layout/MaintenanceBanner';
import BotaoVoltar from './BotaoVoltar';
import { VERSAO_APP } from '@/lib/versao';
import ExportarDados from '@/components/export/ExportarDados';
import MeuPerfilModal from '@/components/perfil/MeuPerfilModal';

import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAvatarUrl } from '@/hooks/useAvatarPerfil';
import { useTemMouse } from '@/hooks/useTemMouse';

const profileMenuItems = [
  { label: 'Dados da Empresa', icon: Building2, path: '/configuracoes', hash: '#empresa' },
  { label: 'Representante Legal', icon: User, path: '/configuracoes', hash: '#representante' },
  { label: 'Monitoramento', icon: Globe, path: '/configuracoes', hash: '#monitoramento' },
  { label: 'Notificações', icon: Bell, path: '/configuracoes', hash: '#notificacoes' },
  { label: 'Segurança', icon: Shield, path: '/configuracoes', hash: '#seguranca' },
  { label: 'Plano & Assinatura', icon: CreditCard, path: '/configuracoes', hash: '#plano' },
  { label: 'Aparência', icon: Palette, path: '/configuracoes', hash: '#aparencia' },
];

/**
 * Moldura de toda tela interna (identidade 12/09): sidebar navy de altura
 * total à esquerda (248px; trilho de 72px), barra branca de 72px SÓ sobre o
 * conteúdo, e o conteúdo em #F5F7FA com 32px de respiro — sem teto de
 * largura, para tabela e Kanban usarem a tela toda (o antigo `amplo` saiu:
 * era a exceção que virou regra).
 */
const AppLayout = forwardRef<HTMLDivElement, { children: ReactNode }>(function AppLayout({ children }, _ref) {
  const [notifOpen, setNotifOpen] = useState(false);
  const temMouse = useTemMouse();
  const [profileOpen, setProfileOpen] = useState(false);
  /* A escolha entre trilho e coluna fica gravada no navegador: quem trabalha
     com o trilho não quer reabrir a coluna a cada tela. `try` porque navegador
     em janela privada pode recusar o armazenamento.
     A chave é a mesma de quando "oculto" era largura zero — quem tinha o menu
     escondido acorda com o trilho, que é o mínimo que a barra tem agora. */
  const [menuAberto, setMenuAberto] = useState(() => {
    try { return localStorage.getItem('praefectus:menu-lateral') !== 'oculto'; }
    catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem('praefectus:menu-lateral', menuAberto ? 'visivel' : 'oculto'); }
    catch { /* sem armazenamento: a preferência vale só nesta sessão */ }
  }, [menuAberto]);
  const [perfilModalOpen, setPerfilModalOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [unreadCount, setUnreadCount] = useState(0);
  const avatarUrl = useAvatarUrl();

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
      }, async (payload: any) => {
        const { count } = await supabase
          .from('notificacoes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('lida', false);
        setUnreadCount(count || 0);

        if (payload.eventType === 'INSERT' && payload.new) {
          const { playNotificationSound, isSoundEnabled } = await import('@/lib/notification-sound');
          const { toast } = await import('sonner');
          const tipo = payload.new.tipo || 'info';
          if (isSoundEnabled()) {
            playNotificationSound(tipo === 'alerta' ? 'alert' : tipo === 'sucesso' ? 'success' : 'message');
          }
          toast(payload.new.titulo || 'Nova notificação', {
            description: payload.new.mensagem || undefined,
            action: payload.new.link ? { label: 'Ver', onClick: () => navigate(payload.new.link) } : undefined,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleProfileNav = (path: string, hash: string) => {
    setProfileOpen(false);
    navigate(path + hash);
  };

  return (
    <div className="min-h-screen bg-background flex items-start">
      <AppSidebar aberta={menuAberto} onAlternar={() => setMenuAberto((o) => !o)} />

      {/* Coluna do conteúdo: barra do topo + main. O `min-w-0` é obrigatório —
          sem ele uma tabela com overflow-x empurra a largura da página. */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
      {/* Barra do topo CLARA, só sobre o conteúdo (a sidebar navy é irmã, de
          altura total, e carrega a marca no desktop). z-30 fica ABAIXO do
          trilho auto-escondido (z-40), que precisa passar por cima dela. */}
      <header className="nao-imprime sticky top-0 z-30 h-16 md:h-[72px] bg-card border-b border-border flex items-center px-4 md:px-8 gap-2 sm:gap-3">
        {/* O hambúrguer que ficava aqui saiu em 10/09/2026: quem alterna a
            barra lateral é o botão no topo da própria barra (ver AppSidebar).
            Abaixo de 768px a gaveta do AppTopNav continua com o seu botão. */}

        {/* Marca: no celular vive aqui (a sidebar some); no desktop vive na
            sidebar — e quando o trilho se esconde (mouse + menu recolhido), o
            símbolo fica aqui para a marca não sumir da tela. */}
        <Link to="/dashboard" aria-label="Praefectus — página inicial" className="flex items-center flex-shrink-0 md:hidden">
          <BrandLogo className="w-[150px]" />
        </Link>
        {!menuAberto && temMouse && (
          <Link to="/dashboard" aria-label="Praefectus — página inicial" className="hidden md:flex items-center flex-shrink-0">
            <BrandLogo mode="symbol" width={36} />
          </Link>
        )}

        {/* REBRAND — a partir de `lg` quem navega é a barra lateral, como no
            protótipo. O menu horizontal continua vivo abaixo desse ponto: ele
            é quem carrega a gaveta do mobile. As duas leem a MESMA lista de
            navegação, então não divergem. */}
        <div className="flex-1 flex items-center min-w-0 md:hidden">
          <AppTopNav />
        </div>
        <div className="hidden md:block flex-1" />

        {/* Right: Tools
            A ordem é do EFÊMERO para o PERMANENTE, da esquerda para a direita:

              sino → sol → engrenagem │ empresa │ avatar

            O sino muda sozinho, várias vezes por dia — é o que se olha com mais
            frequência e o que precisa de menos mira. O sol muda quando a luz da
            sala muda. A engrenagem, raramente. Depois de uma divisória vêm os
            dois campos de IDENTIDADE — em qual empresa estou e quem sou eu —,
            que não são ações: são contexto, e ficam junto do avatar porque
            respondem à mesma pergunta.

            A divisória não é enfeite: sem ela, o seletor de empresa vira o
            quarto de uma fileira de cinco botões, e a pessoa procura ação onde
            só há informação. */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
          <button
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent('praefectus:abrir-busca'))}
            title="Pesquisa geral (Ctrl+K)"
            aria-label="Pesquisa geral"
          >
            <Search className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </button>

          <button
            className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setNotifOpen(!notifOpen)}
            title="Notificações"
          >
            <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-destructive text-destructive-foreground text-xs sm:text-xs font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <button
            className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => navigate('/configuracoes')}
            title="Configurações"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          <span
            aria-hidden="true"
            className="hidden lg:block w-px h-6 bg-border mx-1.5"
          />

          <div className="hidden lg:block">
            <EmpresaSelector />
          </div>

          {/* Avatar dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-navy text-white ring-1 ring-border flex items-center justify-center text-xs sm:text-sm font-bold hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer overflow-hidden shrink-0"
              onClick={() => setProfileOpen(o => !o)}
              title="Minha conta"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : initials}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-11 w-[300px] bg-card border border-border rounded-xl shadow-xl z-50 animate-fade-in overflow-hidden">
                <div className="px-5 pt-5 pb-3 text-center border-b border-border">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-foreground text-xl font-bold mx-auto mb-3 overflow-hidden">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <p className="font-semibold text-foreground text-sm truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  {empresaAtiva && (
                    <p className="text-xs text-accent mt-1 truncate">{empresaAtiva.nome_fantasia || empresaAtiva.razao_social}</p>
                  )}
                </div>

                <div className="py-1.5 max-h-[260px] overflow-y-auto">
                  {/* Meu Perfil — acima de tudo */}
                  <button
                    className="w-full flex items-center gap-3 px-5 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left font-medium"
                    onClick={() => { setProfileOpen(false); setPerfilModalOpen(true); }}
                  >
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <span>Meu Perfil</span>
                  </button>
                  <div className="mx-4 my-1 border-t border-border" />
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
                  <ExportarDados variant="menu-item" />
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

        {/* Conteúdo: 16px no celular, 32px no desktop; sem teto de largura. */}
        <main className="flex-1 min-w-0 p-4 md:p-8">
        {/* Banner de manutenção e aviso de vencimento são da sessão, não do
            documento: no papel viram ruído com data de validade. */}
        <div className="nao-imprime">
          <MaintenanceBanner showModal />
          <AlertaVencimentoBanner />
        </div>
        {/* O canto dos lembretes: convocação de pregoeiro (urgente, em cima) e
            vencimento de certidão dividem a MESMA pilha — dois `fixed` no mesmo
            ponto se sobrepunham. O contêiner não captura clique quando vazio. */}
        <div className="pointer-events-none fixed right-5 top-[84px] z-40 flex w-[min(316px,calc(100vw-2.5rem))] flex-col gap-2.5 [&>*]:pointer-events-auto">
          <LembreteDeConvocacao />
          <LembreteDeVencimento />
        </div>
        {/* Uma vez aqui, vale para as 56 telas que usam este layout. */}
        {/* Carimbo invisível, para conferir o que está publicado. */}
        <span data-versao={VERSAO_APP} className="hidden" />
        {/* O Painel é a RAIZ da navegação: voltar a partir dele não leva a
            lugar que faça sentido — o botão ali era um convite sem destino.
            Nas demais telas, continua sendo o caminho de volta. */}
        {location.pathname !== '/dashboard' && <BotaoVoltar />}
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
      <AureliaChat />
      <GlobalSearch />
      <MeuPerfilModal open={perfilModalOpen} onOpenChange={setPerfilModalOpen} />
    </div>
  );
});

export default AppLayout;
