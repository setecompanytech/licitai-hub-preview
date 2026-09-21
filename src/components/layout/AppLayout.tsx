import { ReactNode, useState, useEffect, forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import { gravarSidebarRecolhida, lerSidebarRecolhida } from '@/lib/navegacao/sidebar';
import MenuDeFerramentas from './MenuDeFerramentas';
import TrilhaDoTopo, { type DegrauDaTrilha } from './TrilhaDoTopo';
import { ProvedorDeTrilha } from './contexto-trilha';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import LembreteDeVencimento from '@/components/documentos/LembreteDeVencimento';
import LembreteDeConvocacao from '@/components/monitoramento/LembreteDeConvocacao';
import LembreteDoRobo from '@/components/robo-lances/LembreteDoRobo';
import ChamadaDaTelaRemota from '@/components/robo-lances/ChamadaDaTelaRemota';
import { ehAvisoDoRobo, gravarSininhoAbertoEm, lerSininhoAbertoEm, sininhoDeveChamar } from '@/lib/robo/avisos-do-robo';
import AlertaVencimentoBanner from './AlertaVencimentoBanner';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import AureliaChat from '@/components/aurelia/AureliaChat';
import GlobalSearch from '@/components/search/GlobalSearch';
import MaintenanceBanner from '@/components/layout/MaintenanceBanner';
import BotaoVoltar from './BotaoVoltar';
import { VERSAO_APP } from '@/lib/versao';
import MeuPerfilModal from '@/components/perfil/MeuPerfilModal';

import { supabase } from '@/integrations/supabase/client';

/**
 * Moldura de toda tela interna — SIDEBAR + TOPBAR + CONTEÚDO (Design System
 * v3, 19/09/2026).
 *
 * A coluna navy de 248px (recolhível a 72px) carrega a marca e a navegação;
 * a topbar branca de 60px carrega o nome do módulo, a busca única, os avisos,
 * o tema, a empresa ativa e a conta; o conteúdo ocupa o resto, com teto de
 * 1520px e respiro de 16/24/32px conforme a largura. No celular a coluna
 * vira uma gaveta aberta pelo botão da topbar.
 *
 * ONDE FICA A TRILHA: abre o container do conteúdo, ao lado do botão de
 * voltar, e rola com a página — ela descreve o conteúdo, então pertence a ele.
 * Continua existindo UMA só: `CabecalhoPagina` apenas REGISTRA a trilha pelo
 * contexto, quem desenha é o `TrilhaDoTopo` daqui.
 */
interface AppLayoutProps {
  children: ReactNode;
  /**
   * Degraus que o registro de rota não conhece — o identificador do registro
   * aberto, e o caminho até ele quando a rota não é item de menu.
   */
  trilhaExtra?: DegrauDaTrilha[];
}

const AppLayout = forwardRef<HTMLDivElement, AppLayoutProps>(function AppLayout({ children, trilhaExtra }, _ref) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuMovelAberto, setMenuMovelAberto] = useState(false);
  const [perfilModalOpen, setPerfilModalOpen] = useState(false);
  const [recolhida, setRecolhida] = useState<boolean>(() => lerSidebarRecolhida());
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  // Aviso novo do robô desde a última abertura do painel: o sininho treme e brilha.
  const [sininhoChamando, setSininhoChamando] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('lida', false)
      .then(({ count }) => setUnreadCount(count || 0));

    // Ao abrir o sistema: há aviso do robô não lido que chegou depois da
    // última vez que a pessoa abriu o painel? A regra está em `sininhoDeveChamar`.
    supabase
      .from('notificacoes')
      .select('link, lida, created_at')
      .eq('user_id', user.id)
      .eq('lida', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setSininhoChamando(sininhoDeveChamar(data ?? [], lerSininhoAbertoEm(user.id))));

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
          if (ehAvisoDoRobo(payload.new)) setSininhoChamando(true);
          const { playNotificationSound, isSoundEnabled } = await import('@/lib/notification-sound');
          const { toast } = await import('sonner');
          const tipo = payload.new.tipo || 'info';
          if (isSoundEnabled()) {
            playNotificationSound(tipo === 'alerta' ? 'alert' : tipo === 'sucesso' ? 'success' : 'message');
          }
          // Aviso do robô vira caixinha no canto (`LembreteDoRobo`), que aparece
          // e some sozinha; o toast simples aqui seria o mesmo aviso duas vezes.
          if (!ehAvisoDoRobo(payload.new)) {
            toast(payload.new.titulo || 'Nova notificação', {
              description: payload.new.mensagem || undefined,
              action: payload.new.link ? { label: 'Ver', onClick: () => navigate(payload.new.link) } : undefined,
            });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Abrir o painel é o "vi": o sininho para de chamar, mesmo sem marcar como lida.
  useEffect(() => {
    if (!notifOpen || !user) return;
    setSininhoChamando(false);
    gravarSininhoAbertoEm(user.id, new Date());
  }, [notifOpen, user]);

  // Navegar fecha o diretório e a gaveta do celular: sem isso continuariam
  // abertos sobre a tela recém-carregada.
  useEffect(() => {
    setMenuAberto(false);
    setMenuMovelAberto(false);
  }, [location.pathname, location.search]);

  const abrirBusca = () => window.dispatchEvent(new CustomEvent('praefectus:abrir-busca'));

  const alternarRecolhida = () =>
    setRecolhida((atual) => {
      gravarSidebarRecolhida(!atual);
      return !atual;
    });

  return (
    <ProvedorDeTrilha>
    <div className="flex min-h-screen bg-background">
      {/* A coluna de navegação — fixa, altura total, só no desktop. */}
      <div
        className={cn(
          'nao-imprime fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 md:block',
          recolhida ? 'w-[var(--g-barra-lateral-fechada)]' : 'w-[var(--g-barra-lateral)]',
        )}
      >
        <AppSidebar
          recolhida={recolhida}
          aoAlternarRecolhida={alternarRecolhida}
          aoAbrirFerramentas={() => setMenuAberto(true)}
          aoAbrirBusca={abrirBusca}
        />
      </div>

      {/* Topbar + conteúdo, deslocados pela largura da coluna. */}
      <div
        className={cn(
          // No papel, bloco simples: flex em coluna fragmenta mal no Chrome.
          'flex min-h-screen w-full min-w-0 flex-1 flex-col transition-[padding] duration-200 print:block print:min-h-0 print:pl-0',
          recolhida ? 'md:pl-[var(--g-barra-lateral-fechada)]' : 'md:pl-[var(--g-barra-lateral)]',
        )}
      >
        <AppHeader
          naoLidas={unreadCount}
          sininhoChamando={sininhoChamando}
          aoAbrirNotificacoes={() => setNotifOpen((o) => !o)}
          aoAbrirMeuPerfil={() => setPerfilModalOpen(true)}
          aoAbrirFerramentas={() => setMenuAberto(true)}
          ferramentasAberto={menuAberto}
          aoAbrirMenuMovel={() => setMenuMovelAberto(true)}
        />

        <main className="mx-auto w-full min-w-0 max-w-[var(--g-conteudo)] flex-1 px-4 py-4 print:block print:max-w-none print:p-0 sm:px-5 md:px-6 md:py-6 lg:px-8">
          {/* Banner de manutenção e aviso de vencimento são da sessão, não do
              documento: no papel viram ruído com data de validade. */}
          <div className="nao-imprime">
            <MaintenanceBanner showModal />
            <AlertaVencimentoBanner />
          </div>

          {/* Voltar e trilha respondem a coisas diferentes e por isso convivem:
              a trilha sobe a hierarquia (Gestão › Contratos), o botão desfaz o
              último passo. No Painel o botão não aparece: ali é a raiz. A linha
              some inteira quando não há trilha e a pessoa está no Painel. */}
          <div className="nao-imprime mb-4 flex items-center gap-2 empty:hidden">
            {location.pathname !== '/dashboard' && <BotaoVoltar somenteIcone />}
            <TrilhaDoTopo extra={trilhaExtra} className="min-w-0 flex-1" />
          </div>

          {/* O canto dos lembretes: convocação de pregoeiro, aviso do robô e
              vencimento de certidão dividem a MESMA pilha. A distância do topo
              acompanha o token da topbar. */}
          <div className="pointer-events-none fixed right-4 top-[calc(var(--g-topo)+0.75rem)] z-40 flex w-[min(316px,calc(100vw-2rem))] flex-col gap-2.5 [&>*]:pointer-events-auto">
            <LembreteDeConvocacao />
            <LembreteDoRobo />
            <LembreteDeVencimento />
          </div>
          {/* A chamada grande da tela remota, embaixo e no centro — só para a
              equipe Praefectus (ver `ChamadaDaTelaRemota`). */}
          <ChamadaDaTelaRemota />
          {/* Carimbo invisível, para conferir o que está publicado. */}
          <span data-versao={VERSAO_APP} className="hidden" />
          {children}
        </main>
      </div>

      {/* A navegação no celular: a mesma coluna, numa gaveta. */}
      <Sheet open={menuMovelAberto} onOpenChange={setMenuMovelAberto}>
        <SheetContent
          side="left"
          className="w-[280px] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-[280px]"
          classNameFechar="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <AppSidebar
            movel
            aoNavegar={() => setMenuMovelAberto(false)}
            aoAbrirFerramentas={() => {
              setMenuMovelAberto(false);
              setMenuAberto(true);
            }}
            aoAbrirBusca={() => {
              setMenuMovelAberto(false);
              abrirBusca();
            }}
          />
        </SheetContent>
      </Sheet>

      <MenuDeFerramentas aberto={menuAberto} aoFechar={() => setMenuAberto(false)} />

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
    </ProvedorDeTrilha>
  );
});

export default AppLayout;
