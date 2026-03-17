import { useState } from 'react';
import PraefectusLogo from '@/components/shared/PraefectusLogo';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { hasAccessToRoute } from '@/data/plan-features';
import {
  LayoutDashboard,
  Search,
  Kanban,
  Users,
  Bot,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Crosshair,
  Shield,
  Scale,
  DollarSign,
  Calculator,
  Download,
  LogOut,
  Building2,
  ShieldCheck,
  HeadphonesIcon,
  MessageSquare,
  TrendingUp,
  Target,
  ClipboardCheck,
  BookOpen,
  Bell,
  Archive,
  CalendarDays,
  GraduationCap,
  FileText,
  ListChecks,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Painel',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    ],
  },
  {
    title: 'Monitoramento',
    items: [
      { icon: Download, label: 'Editais', path: '/monitoramento-editais' },
      { icon: Bell, label: 'Boletins Diários', path: '/boletins' },
      { icon: MessageSquare, label: 'Chat e Mural', path: '/monitoramento-chat' },
      { icon: MessageSquare, label: 'WhatsApp CRM', path: '/whatsapp-crm' },
    ],
  },
  {
    title: 'Gestão de Licitações',
    items: [
      { icon: Target, label: 'Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
      { icon: ListChecks, label: 'Meus Compromissos', path: '/meus-compromissos' },
      { icon: Bot, label: 'Workflow IA', path: '/workflow-ia' },
      { icon: Kanban, label: 'Kanban', path: '/kanban' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances' },
      { icon: Archive, label: 'Histórico', path: '/historico-licitacoes' },
      { icon: FileText, label: 'Contratos', path: '/gestao-contratos' },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { icon: TrendingUp, label: 'Análise de Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
      { icon: Search, label: 'Proposta Comercial', path: '/proposta-tecnica' },
    ],
  },
  {
    title: 'Jurídico & Docs',
    items: [
      { icon: Shield, label: 'Documentos', path: '/documentos' },
      { icon: ClipboardCheck, label: 'Assessoria Cadastral', path: '/assessoria-cadastral' },
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: Calculator, label: 'Apoio Contábil', path: '/apoio-contabil' },
      { icon: TrendingUp, label: 'Índices & Repactuação', path: '/indices-repactuacao' },
      
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { icon: Bot, label: 'Assistente IA', path: '/assistente' },
      { icon: GraduationCap, label: 'Tutorial / Guia', path: '/tutorial' },
      { icon: BookOpen, label: 'Blog', path: '/blog' },
      { icon: Download, label: 'E-book', path: '/ebook' },
    ],
  },
  {
    title: 'Configuração',
    items: [
      { icon: Building2, label: 'Empresas', path: '/empresas' },
      { icon: Users, label: 'Equipe', path: '/equipe' },
      { icon: Settings, label: 'Configurações', path: '/configuracoes' },
      { icon: HeadphonesIcon, label: 'Suporte', path: '/suporte' },
    ],
  },
];

const adminItems: NavItem[] = [
  { icon: ShieldCheck, label: 'Templates IA', path: '/admin/templates' },
  { icon: DollarSign, label: 'Financeiro', path: '/admin/financeiro' },
  { icon: Target, label: 'Fontes Fabricantes', path: '/admin/fontes-fabricantes' },
  { icon: TrendingUp, label: 'Marketing', path: '/admin/marketing' },
  { icon: BarChart3, label: 'Relatório Contábil', path: '/relatorio-contabil' },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export default function AppSidebar({ onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    navGroups.forEach((g) => (init[g.title] = true));
    return init;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, subscription } = useAuth();
  const { isAdmin } = useUserRole();

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isInSheet = !!onNavigate;
  const isCollapsed = isInSheet ? false : collapsed;

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const locked = !isAdmin && !hasAccessToRoute(subscription.planSlug, item.path);

    const button = (
      <button
        key={item.path}
        onClick={() => handleNav(item.path)}
        className={cn(
          'sidebar-item w-full',
          isActive ? 'sidebar-item-active' : 'sidebar-item-idle',
          locked && 'opacity-60'
        )}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="truncate flex-1">{item.label}</span>
            {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
          </>
        )}
      </button>
    );

    if (locked && isCollapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">{item.label} 🔒</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full',
        isInSheet ? 'w-full' : 'fixed left-0 top-0 z-40 h-screen border-r transition-all duration-300',
        !isInSheet && (isCollapsed ? 'w-[72px]' : 'w-[250px]')
      )}
      style={{ background: `hsl(var(--sidebar-bg))`, borderColor: `hsl(var(--sidebar-border))` }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b flex-shrink-0" style={{ borderColor: `hsl(var(--sidebar-border))` }}>
        {!isCollapsed ? (
          <PraefectusLogo size="md" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-accent-foreground font-bold text-xs font-brand">P</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto space-y-1">
        {navGroups.map((group) => {
          const isOpen = openGroups[group.title] ?? true;

          return (
            <div key={group.title}>
              {!isCollapsed ? (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground/60 transition-colors"
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform duration-200',
                      !isOpen && '-rotate-90'
                    )}
                  />
                </button>
              ) : (
                <div className="my-2 mx-3 border-t" style={{ borderColor: `hsl(var(--sidebar-border))` }} />
              )}

              {(isCollapsed || isOpen) && (
                <div className="space-y-0.5">
                  {group.items.map(renderNavItem)}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin && (
          <div>
            {!isCollapsed ? (
              <div className="px-3 py-1.5 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Admin</span>
              </div>
            ) : (
              <div className="my-2 mx-3 border-t" style={{ borderColor: `hsl(var(--sidebar-border))` }} />
            )}
            <div className="space-y-0.5">
              {adminItems.map(renderNavItem)}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t space-y-0.5 flex-shrink-0" style={{ borderColor: `hsl(var(--sidebar-border))` }}>
        <button
          onClick={async () => { await signOut(); navigate('/'); onNavigate?.(); }}
          className="sidebar-item sidebar-item-idle w-full text-destructive/80 hover:text-destructive"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </button>
        {!isInSheet && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-item sidebar-item-idle w-full justify-center"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
