import { ReactNode, useState, useEffect, forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from './AppHeader';
import CompactSidebar from './CompactSidebar';
import MenuDeFerramentas from './MenuDeFerramentas';
import TrilhaDoTopo, { type DegrauDaTrilha } from './TrilhaDoTopo';
import { ProvedorDeTrilha } from './contexto-trilha';
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
 * Moldura de toda tela interna — um cabeçalho horizontal e o conteúdo.
 *
 * Histórico, porque a alternância confunde quem chega: em 13/09 a navegação foi
 * para o topo pela manhã, voltou para uma coluna navy de 240px à tarde (com o
 * comando de reestruturação do Gestão e suas 22 referências) e voltou ao topo
 * no fim do dia, por comando novo do dono do produto. Este é o estado atual: a
 * coluna saiu, o `AppSidebar` foi removido, e o `AppHeader` responde às três
 * perguntas de uma vez — para onde eu vou (Painel, Ferramentas), o que eu
 * procuro (a busca única) e quem eu sou (empresa, avisos, perfil).
 *
 * ONDE FICA A TRILHA — decisão de 13/09, para não recriar a duplicação que foi
 * corrigida hoje de manhã. Ela NÃO sobe para o cabeçalho: a faixa de 64px
 * agora está ocupada por navegação e identidade, e empilhar uma segunda linha
 * ali custaria ~36px permanentes de altura em todas as 56 telas. A trilha
 * passa a abrir o container do conteúdo, ao lado do botão de voltar, e rola
 * com a página — ela descreve o conteúdo, então pertence a ele. Continua
 * existindo UMA só: `CabecalhoPagina` apenas REGISTRA a trilha pelo contexto,
 * quem desenha é o `TrilhaDoTopo` daqui.
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
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilModalOpen, setPerfilModalOpen] = useState(false);
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

  // Navegar fecha o diretório: sem isso ele continuaria aberto sobre a tela
  // recém-carregada, e a pessoa teria que fechá-lo à mão depois de cada clique.
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname, location.search]);

  const abrirBusca = () => window.dispatchEvent(new CustomEvent('praefectus:abrir-busca'));

  return (
    <ProvedorDeTrilha>
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        naoLidas={unreadCount}
        sininhoChamando={sininhoChamando}
        aoAbrirNotificacoes={() => setNotifOpen((o) => !o)}
        aoAbrirMeuPerfil={() => setPerfilModalOpen(true)}
        aoAbrirFerramentas={() => setMenuAberto(true)}
        ferramentasAberto={menuAberto}
      />

      {/* Sidebar compacta — visível apenas no desktop (md+). No mobile a
          navegação continua via o botão hamburger do cabeçalho. */}
      <div className="hidden md:block">
        <CompactSidebar
          aoAbrirFerramentas={() => setMenuAberto(true)}
          aoAbrirBusca={abrirBusca}
        />
      </div>

      <MenuDeFerramentas aberto={menuAberto} aoFechar={() => setMenuAberto(false)} />

      {/* Conteúdo principal: no desktop recebe ml-[62px] da sidebar fixa +
          padding interno de 22px. No mobile sem sidebar.

          `md:w-[calc(100%-62px)]` é o que faltava: `w-full` sozinho mede
          100% do contêiner-pai e SÓ DEPOIS ganha os 62px de margem — a caixa
          fica 62px mais larga que a viewport, e o excesso vaza à direita,
          cortando (ou movendo pra fora da tela) qualquer coisa ancorada à
          direita nela: botões de ação do cabeçalho, o link "Ver" dos
          alertas, painéis laterais. O bug era sistêmico porque `AppLayout`
          é comum a toda tela — daí "cortar à direita em todas as telas". */}
      <main className="w-full min-w-0 flex-1 px-4 py-4 md:ml-[62px] md:w-[calc(100%-62px)] md:px-[22px] md:py-[18px]">
        {/* Banner de manutenção e aviso de vencimento são da sessão, não do
            documento: no papel viram ruído com data de validade. */}
        <div className="nao-imprime">
          <MaintenanceBanner showModal />
          <AlertaVencimentoBanner />
        </div>

        {/* Voltar e trilha respondem a coisas diferentes e por isso convivem:
            a trilha sobe a hierarquia (Gestão › Contratos), o botão desfaz o
            último passo, que muitas vezes veio de outro ramo — do Kanban para
            o dossiê, do dossiê para a precificação. No Painel o botão não
            aparece: ali é a raiz, e voltar não leva a lugar que faça sentido.
            A linha some inteira quando não há trilha (o TrilhaDoTopo devolve
            nulo) e a pessoa está no Painel — não sobra um espaço vazio. */}
        <div className="nao-imprime mb-3 flex items-center gap-2 empty:hidden">
          {location.pathname !== '/dashboard' && <BotaoVoltar somenteIcone />}
          <TrilhaDoTopo extra={trilhaExtra} className="min-w-0 flex-1" />
        </div>

        {/* O canto dos lembretes: convocação de pregoeiro (urgente, em cima) e
            vencimento de certidão dividem a MESMA pilha — dois `fixed` no mesmo
            ponto se sobrepunham. O contêiner não captura clique quando vazio.
            A distância do topo acompanha o token do cabeçalho: fixá-la em 84px
            faria a pilha invadir a faixa no dia em que a altura mudar. */}
        <div className="pointer-events-none fixed right-5 top-[calc(var(--g-topo)+1.25rem)] z-40 flex w-[min(316px,calc(100vw-2.5rem))] flex-col gap-2.5 [&>*]:pointer-events-auto">
          <LembreteDeConvocacao />
          <LembreteDoRobo />
          <LembreteDeVencimento />
        </div>
        {/* A chamada grande da tela remota, embaixo e no centro — só para a
            equipe Praefectus (ver `ChamadaDaTelaRemota`). */}
        <ChamadaDaTelaRemota />
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
    </ProvedorDeTrilha>
  );
});

export default AppLayout;
