import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Search, Kanban, Users, Bot, BarChart3, Settings,
  Zap, Crosshair, Shield, Scale, DollarSign, Download, Building2,
  ShieldCheck, HeadphonesIcon, MessageSquare, TrendingUp, Target,
  ClipboardCheck, BookOpen, Bell, Archive, ChevronDown, CalendarDays,
  ListChecks, FileText, Calculator, Workflow, Plug, FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';

interface MegaMenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  isNew?: boolean;
}

interface MegaMenuGroup {
  title: string;
  items: MegaMenuItem[];
}

const megaGroups: MegaMenuGroup[] = [
  {
    title: 'Monitoramento',
    items: [
      { icon: Download, label: 'Editais & Licitações', path: '/monitoramento-editais' },
      { icon: Bell, label: 'Boletins Diários', path: '/boletins' },
      { icon: Target, label: 'Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: MessageSquare, label: 'Chat e Mural', path: '/monitoramento-chat' },
    ],
  },
  {
    title: 'Gestão de Processos',
    items: [
      { icon: ListChecks, label: 'Compromissos', path: '/meus-compromissos' },
      { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
      { icon: Kanban, label: 'Kanban', path: '/kanban' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances' },
      { icon: FileText, label: 'Contratos', path: '/gestao-contratos' },
      { icon: Archive, label: 'Histórico', path: '/historico-licitacoes' },
    ],
  },
  {
    title: 'Inteligência & Preços',
    items: [
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
      { icon: FileBarChart, label: 'Proposta Comercial', path: '/proposta-tecnica' },
      { icon: TrendingUp, label: 'Análise de Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
    ],
  },
  {
    title: 'Jurídico & Contábil',
    items: [
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: Calculator, label: 'Apoio Contábil', path: '/apoio-contabil' },
      { icon: Shield, label: 'Documentos', path: '/documentos' },
      { icon: ClipboardCheck, label: 'Assessoria Cadastral', path: '/assessoria-cadastral' },
    ],
  },
  {
    title: 'Automação',
    items: [
      { icon: Workflow, label: 'Workflow IA', path: '/workflow-ia', isNew: true },
      { icon: Bot, label: 'Assistente IA', path: '/assistente' },
      { icon: MessageSquare, label: 'WhatsApp CRM', path: '/whatsapp-crm' },
    ],
  },
  {
    title: 'Configuração',
    items: [
      { icon: Building2, label: 'Empresas', path: '/empresas' },
      { icon: Users, label: 'Equipe', path: '/equipe' },
      { icon: HeadphonesIcon, label: 'Suporte', path: '/suporte' },
    ],
  },
];

export default function MegaMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessRoute } = useMembroPermissoes();

  const visibleGroups = megaGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => canAccessRoute(it.path)) }))
    .filter((g) => g.items.length > 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleNav = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => navigate('/ferramentas')}
        onMouseEnter={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
          location.pathname === '/ferramentas'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <Zap className="w-4 h-4" />
        Ferramentas
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100vw-2rem)] max-w-[900px] bg-popover border border-border rounded-xl shadow-lg z-50 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 p-4">
            {visibleGroups.map((group) => (
              <div key={group.title} className="space-y-1 px-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent mb-2">
                  {group.title}
                </h4>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 text-left',
                        isActive
                          ? 'bg-accent/10 text-accent'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.label}</span>
                      {item.isNew && (
                        <span className="ml-auto text-[8px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full leading-none">
                          Novo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
