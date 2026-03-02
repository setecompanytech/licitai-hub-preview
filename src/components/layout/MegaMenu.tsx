import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Search, Kanban, Users, Bot, BarChart3, Settings,
  Zap, Crosshair, Shield, Scale, DollarSign, Download, Building2,
  ShieldCheck, HeadphonesIcon, MessageSquare, TrendingUp, Target,
  ClipboardCheck, BookOpen, Bell, Archive, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    title: 'Oportunidades',
    items: [
      { icon: Download, label: 'Monitorar Editais', path: '/monitoramento-editais' },
      { icon: Bell, label: 'Boletins Diários', path: '/boletins' },
      { icon: Target, label: 'Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: Archive, label: 'Histórico', path: '/historico-licitacoes' },
    ],
  },
  {
    title: 'Inteligência Artificial',
    items: [
      { icon: Bot, label: 'Assistente IA', path: '/assistente', isNew: true },
      { icon: Search, label: 'Proposta Técnica', path: '/proposta-tecnica' },
      { icon: Scale, label: 'Consultor Jurídico', path: '/apoio-juridico' },
      { icon: BookOpen, label: 'Blog IA', path: '/blog' },
    ],
  },
  {
    title: 'Ferramentas de Gestão',
    items: [
      { icon: Kanban, label: 'Kanban', path: '/kanban' },
      { icon: Shield, label: 'Gerenciar Documentos', path: '/documentos' },
      { icon: Building2, label: 'Gerenciar Empresas', path: '/empresas' },
    ],
  },
  {
    title: 'Automação',
    items: [
      { icon: MessageSquare, label: 'Chat e Mural', path: '/monitoramento-chat' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances', isNew: true },
      { icon: MessageSquare, label: 'WhatsApp Setores', path: '/whatsapp-setores' },
    ],
  },
  {
    title: 'Análise Estratégica',
    items: [
      { icon: TrendingUp, label: 'Análise de Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
    ],
  },
  {
    title: 'Assessoria',
    items: [
      { icon: ClipboardCheck, label: 'Assessoria Cadastral', path: '/assessoria-cadastral' },
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: HeadphonesIcon, label: 'Suporte', path: '/suporte' },
    ],
  },
];

export default function MegaMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
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
            {megaGroups.map((group) => (
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
