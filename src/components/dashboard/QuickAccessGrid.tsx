import { useNavigate } from 'react-router-dom';
import {
  Download, Bell, Target, Archive, Bot, Search, Scale, BookOpen,
  Kanban, Shield, Building2, MessageSquare, Crosshair, TrendingUp,
  Users, DollarSign, ClipboardCheck, HeadphonesIcon, FileText,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: 'novo';
}

interface QuickGroup {
  title: string;
  accent?: boolean;
  items: QuickItem[];
}

const groups: QuickGroup[] = [
  {
    title: 'Oportunidades de Negócio',
    items: [
      { icon: Bell, label: 'Boletins', path: '/boletins' },
      { icon: Download, label: 'Encontrar Editais', path: '/monitoramento-editais' },
      { icon: Target, label: 'Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: Archive, label: 'Histórico', path: '/historico-licitacoes' },
    ],
  },
  {
    title: 'Inteligência Artificial',
    accent: true,
    items: [
      { icon: Bot, label: 'Assistente IA', path: '/assistente', badge: 'novo' },
      { icon: Scale, label: 'Consultor Jurídico', path: '/apoio-juridico' },
      { icon: Search, label: 'Proposta Técnica', path: '/proposta-tecnica' },
      { icon: BookOpen, label: 'Blog Jurídico', path: '/blog' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { icon: Kanban, label: 'Kanban', path: '/kanban' },
      { icon: Shield, label: 'Documentos', path: '/documentos' },
      { icon: Building2, label: 'Empresas', path: '/empresas' },
    ],
  },
  {
    title: 'Automação',
    items: [
      { icon: MessageSquare, label: 'Chat e Mural', path: '/monitoramento-chat' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances', badge: 'novo' },
      { icon: MessageSquare, label: 'WhatsApp', path: '/whatsapp-setores' },
    ],
  },
  {
    title: 'Análise Estratégica',
    items: [
      { icon: TrendingUp, label: 'Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    ],
  },
  {
    title: 'Assessoria e Consultoria',
    items: [
      { icon: ClipboardCheck, label: 'Cadastral', path: '/assessoria-cadastral' },
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: FileText, label: 'E-book', path: '/ebook' },
      { icon: HeadphonesIcon, label: 'Suporte', path: '/suporte' },
    ],
  },
];

export default function QuickAccessGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {groups.map((group) => (
        <div
          key={group.title}
          className={cn(
            'rounded-xl border p-3 space-y-2',
            group.accent
              ? 'border-accent/30 bg-accent/5'
              : 'border-border/60 bg-card/50'
          )}
        >
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </h3>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path + item.label}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-colors text-left"
                >
                  <Icon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[8px] font-bold bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full leading-none">
                      Novo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
