import { ReactNode, useState, useEffect, forwardRef, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import TrilhaDoTopo, { type DegrauDaTrilha } from './TrilhaDoTopo';
import { ProvedorDeTrilha } from './contexto-trilha';
import LembreteDeVencimento from '@/components/documentos/LembreteDeVencimento';
import LembreteDeConvocacao from '@/components/monitoramento/LembreteDeConvocacao';
import AlertaVencimentoBanner from './AlertaVencimentoBanner';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Bell, Menu, User, LogOut } from 'lucide-react';
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
import { menuDaConta, type ItemDaConta } from '@/lib/navegacao/menu';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';


/**
 * Moldura de toda tela interna — duas faixas com papéis distintos.
 *
 * COLUNA à esquerda (navy, 240px, recolhível): "para onde eu vou".
 * FAIXA no topo (branca, 64px): "onde eu estou e com qual identidade" —
 * trilha à esquerda; empresa, notificações e perfil à direita.
 *
 * Histórico, porque a alternância confunde quem chega: na manhã de 13/09 a
 * navegação foi para o centro do topo a pedido do dono do produto, e a coluna
 * foi removida. À tarde, o comando de reestruturação do módulo Gestão chegou
 * com 22 referências aprovadas — todas com a coluna — e o requisito escrito
 * de uma sidebar navy de 240px recolhível com topbar branca de 64px. O pedido
 * mais recente vale.
 *
 * O que o movimento anterior tinha resolvido continua resolvido: existe UMA
 * lupa no sistema, e ela mora na coluna, abaixo da marca. É o mesmo diálogo
 * do Ctrl+K, chamado de outro lugar — não um segundo índice.
 */
interface AppLayoutProps {
  children: ReactNode;
  /**
   * Degraus que o registro de rota não conhece — o identificador do registro
   * aberto, e o caminho até ele quando a rota não é item de menu.
   *
   * Existe porque `/processo/:id` e outras telas de detalhe não estão em
   * `paginas.ts`: `trilhaDaRota` devolve vazio para elas, e a faixa ficava sem
   * trilha nenhuma justamente nas telas em que o caminho de volta mais importa.
   * Quem conhece o número do processo é a página, não o roteador.
   */
  trilhaExtra?: DegrauDaTrilha[];
}

const AppLayout = forwardRef<HTMLDivElement, AppLayoutProps>(function AppLayout({ children, trilhaExtra }, _ref) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [perfilModalOpen, setPerfilModalOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [unreadCount, setUnreadCount] = useState(0);
  const avatarUrl = useAvatarUrl();
  const { isAdmin: isEmpresaAdmin } = useMembroPermissoes();

  // O menu da conta vem de menu.ts (mesma fonte da barra) e chega agrupado
  // por seção: "Conta", "Empresa", "Preferências", "Plataforma".
  const secoesDaConta = menuDaConta
    .filter((i) => !i.adminOnly || isEmpresaAdmin)
    .reduce<{ secao: ItemDaConta['secao']; itens: ItemDaConta[] }[]>((acc, item) => {
      const atual = acc[acc.length - 1];
      if (atual && atual.secao === item.secao) atual.itens.push(item);
      else acc.push({ secao: item.secao, itens: [item] });
      return acc;
    }, []);

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
        // A carga do realtime é a linha bruta da tabela, montada pelo servidor
        // e sem tipo em tempo de compilação — o que este bloco lê dela está
        // guardado pelas checagens logo abaixo, não pelo tipo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    <ProvedorDeTrilha>
    <div className="min-h-screen bg-background flex">
      {/* Coluna de navegação — 240px, recolhível, navy nos dois temas.
          Fixa a partir de lg; abaixo disso vira a gaveta logo adiante. */}
      <div className="nao-imprime sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border lg:block">
        <AppSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
      {/* Faixa superior BRANCA de 64px: trilha à esquerda; empresa,
          notificações e perfil à direita. É a divisão de papéis das
          referências de 13/09 — a coluna responde "para onde eu vou", a faixa
          responde "onde eu estou e com qual identidade". */}
      <header className="nao-imprime sticky top-0 z-40 flex h-[var(--g-topo)] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
        {/* Gaveta — a mesma coluna, abaixo de lg. */}
        <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir navegação"
              className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navegação principal</SheetTitle>
            <AppSidebar aoNavegar={() => setGavetaAberta(false)} permiteRecolher={false} />
          </SheetContent>
        </Sheet>

        {/* Voltar e trilha respondem a coisas diferentes e por isso convivem:
            a trilha sobe a hierarquia (Gestão › Contratos), o botão desfaz o
            último passo, que muitas vezes veio de outro ramo — do Kanban para
            o dossiê, do dossiê para a precificação. No Painel ele não aparece:
            ali é a raiz, e voltar não leva a lugar que faça sentido. */}
        {location.pathname !== '/dashboard' && <BotaoVoltar somenteIcone />}

        <TrilhaDoTopo extra={trilhaExtra} className="min-w-0 flex-1" />

        {/* Ações e identidade, à direita. A busca não está aqui: ela é única e
            mora na coluna, abaixo da marca — duas lupas para o mesmo gesto foi
            a duplicidade que o dono do produto mandou remover. */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <div className="hidden lg:block">
            <EmpresaSelector />
          </div>

          <span aria-hidden="true" className="hidden lg:block mx-1.5 h-6 w-px bg-border" />

          <button
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

          {/* Avatar dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted text-foreground ring-1 ring-border flex items-center justify-center text-xs sm:text-sm font-bold hover:ring-2 hover:ring-ring transition-all cursor-pointer overflow-hidden shrink-0"
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

                <div className="py-1.5 max-h-[min(60vh,420px)] overflow-y-auto">
                  {/* Meu Perfil — acima de tudo */}
                  <button
                    className="w-full flex items-center gap-3 px-5 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left font-medium"
                    onClick={() => { setProfileOpen(false); setPerfilModalOpen(true); }}
                  >
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <span>Meu Perfil</span>
                  </button>
                  <div className="mx-4 my-1 border-t border-border" />
                  {secoesDaConta.map(({ secao, itens }) => (
                    <div key={secao}>
                      <p className="px-5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {secao}
                      </p>
                      {itens.map((item) => (
                        <button
                          key={item.label}
                          className="w-full flex items-center gap-3 px-5 py-2 text-[13px] text-foreground hover:bg-muted transition-colors text-left"
                          onClick={() => handleProfileNav(item.path, item.hash ?? '')}
                        >
                          <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
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

      {/* Área principal: fundo #F5F7FA e 24px de respiro, como manda o comando
          de 13/09; 16px no celular. O conteúdo usa a largura disponível — sem
          teto, para tabela de dez colunas e Kanban continuarem inteiros em
          monitor grande. */}
      <main className="min-w-0 flex-1 bg-background p-4 md:p-6">
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
      <AureliaChat />
      <GlobalSearch />
      <MeuPerfilModal open={perfilModalOpen} onOpenChange={setPerfilModalOpen} />
      </div>
    </div>
    </ProvedorDeTrilha>
  );
});

export default AppLayout;
