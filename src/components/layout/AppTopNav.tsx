import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  LayoutDashboard, Search, Kanban, Users, Bot, BarChart3, Settings,
  ChevronDown, Zap, Crosshair, Shield, Scale, DollarSign, Calculator,
  Download, LogOut, Building2, ShieldCheck, HeadphonesIcon, MessageSquare,
  TrendingUp, Target, ClipboardCheck, BookOpen, Bell, Archive, CalendarDays,
  GraduationCap, FileText, ListChecks, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AnimatePresence, motion } from 'framer-motion';

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
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
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
    title: 'Gestão',
    items: [
      { icon: Target, label: 'Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
      { icon: ListChecks, label: 'Compromissos', path: '/meus-compromissos' },
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
      { icon: BarChart3, label: 'Relatório Contábil', path: '/relatorio-contabil' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { icon: Bot, label: 'Assistente IA', path: '/assistente' },
      { icon: GraduationCap, label: 'Tutorial', path: '/tutorial' },
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
];

// Top-level nav links shown in the horizontal bar
const topNavLinks = [
  { label: 'Painel', groups: ['Painel'] },
  { label: 'Monitoramento', groups: ['Monitoramento'] },
  { label: 'Gestão', groups: ['Gestão'] },
  { label: 'Inteligência', groups: ['Inteligência'] },
  { label: 'Jurídico', groups: ['Jurídico & Docs'] },
  { label: 'Ferramentas', groups: ['Ferramentas', 'Configuração'] },
];

interface AppTopNavProps {
  onNavigate?: () => void;
}

export default function AppTopNav({ onNavigate }: AppTopNavProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileOpenGroups, setMobileOpenGroups] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const handleNav = (path: string) => {
    navigate(path);
    setOpenDropdown(null);
    setMobileDrawerOpen(false);
    onNavigate?.();
  };

  const getGroupsForLink = (link: typeof topNavLinks[0]) => {
    return navGroups.filter(g => link.groups.includes(g.title));
  };

  const isLinkActive = (link: typeof topNavLinks[0]) => {
    const groups = getGroupsForLink(link);
    return groups.some(g => g.items.some(item => location.pathname === item.path));
  };

  return (
    <>
      {/* Desktop horizontal nav — rendered inside AppLayout header */}
      <nav className="hidden lg:flex items-center gap-0.5" ref={dropdownRef}>
        {topNavLinks.map((link) => {
          const active = isLinkActive(link);
          const isOpen = openDropdown === link.label;
          const groups = getGroupsForLink(link);

          // Simple nav for single-item groups (Painel)
          if (groups.length === 1 && groups[0].items.length <= 2) {
            return (
              <div key={link.label} className="relative">
                <button
                  onClick={() => handleNav(groups[0].items[0].path)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[13px] font-medium transition-all',
                    active ? 'text-accent bg-accent/8' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {link.label}
                </button>
              </div>
            );
          }

          return (
            <div key={link.label} className="relative">
              <button
                onClick={() => setOpenDropdown(isOpen ? null : link.label)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all',
                  active ? 'text-accent bg-accent/8' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {link.label}
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden min-w-[220px]"
                    style={{ boxShadow: 'var(--shadow-xl)' }}
                  >
                    {groups.map((group) => (
                      <div key={group.title} className="py-1.5">
                        {groups.length > 1 && (
                          <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            {group.title}
                          </p>
                        )}
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.path;
                          return (
                            <button
                              key={item.path}
                              onClick={() => handleNav(item.path)}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors',
                                isActive
                                  ? 'text-accent bg-accent/6 font-semibold'
                                  : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                              )}
                            >
                              <item.icon className="w-4 h-4 flex-shrink-0" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {link.label === 'Ferramentas' && isAdmin && (
                      <div className="border-t border-border py-1.5">
                        <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-accent/60">
                          Admin
                        </p>
                        {adminItems.map((item) => (
                          <button
                            key={item.path}
                            onClick={() => handleNav(item.path)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors',
                              location.pathname === item.path
                                ? 'text-accent bg-accent/6 font-semibold'
                                : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                            )}
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Mobile hamburger button */}
      <button
        className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
        onClick={() => setMobileDrawerOpen(true)}
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile drawer */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-card">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-lg font-brand font-bold tracking-widest uppercase">PRAEFECTUS</span>
            </div>
          </div>

          <nav className="flex-1 py-3 px-3 overflow-y-auto max-h-[calc(100vh-120px)]">
            {navGroups.map((group) => {
              const isOpen = mobileOpenGroups[group.title] !== false;
              return (
                <div key={group.title} className="mb-1">
                  <button
                    onClick={() => setMobileOpenGroups(prev => ({ ...prev, [group.title]: !isOpen }))}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>{group.title}</span>
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !isOpen && '-rotate-90')} />
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5 mb-2">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNav(item.path)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                              isActive ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                            )}
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {isAdmin && (
              <div className="mb-1 mt-2 pt-2 border-t border-border">
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-accent/70">Admin</p>
                <div className="space-y-0.5">
                  {adminItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                        location.pathname === item.path ? 'bg-accent/10 text-accent' : 'text-foreground/70 hover:bg-muted/50'
                      )}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="p-3 border-t border-border">
            <button
              onClick={async () => { await signOut(); navigate('/landing'); setMobileDrawerOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-all"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Sair da conta</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
