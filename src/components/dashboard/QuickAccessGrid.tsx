import { useNavigate } from 'react-router-dom';
import {
  Download, Bell, Target, Archive, Bot, Search, Scale, BookOpen,
  Kanban, Shield, Building2, MessageSquare, Crosshair, TrendingUp,
  Users, DollarSign, ClipboardCheck, HeadphonesIcon, FileText,
  BarChart3, CalendarDays, ListChecks, Calculator, Workflow, Plug,
  FileBarChart,
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
    title: 'Monitoramento',
    items: [
      { icon: Download, label: 'Encontrar Editais', path: '/monitoramento-editais' },
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
      { icon: FileText, label: 'Contratos', path: '/gestao-contratos' },
    ],
  },
  {
    title: 'Inteligência & Preços',
    accent: true,
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
      { icon: Workflow, label: 'Workflow IA', path: '/workflow-ia', badge: 'novo' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances' },
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
      { icon: Plug, label: 'API & Integração', path: '/api-integracao' },
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
