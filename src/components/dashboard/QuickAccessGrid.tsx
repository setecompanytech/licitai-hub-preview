import { useNavigate } from 'react-router-dom';
import {
  Download, Bell, Target, Archive, Bot, Search, Scale, BookOpen,
  Kanban, Shield, MessageSquare, Crosshair, TrendingUp, Building2, Settings, Plug,
  Users, DollarSign, ClipboardCheck, FileText,
  BarChart3, CalendarDays, ListChecks, Calculator, Workflow,   FileBarChart, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    title: 'Gestão de processos',
    items: [
      { icon: ListChecks, label: 'Compromissos', path: '/meus-compromissos' },
      { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
      { icon: Kanban, label: 'Kanban', path: '/kanban' },
      { icon: FileText, label: 'Contratos', path: '/gestao-contratos' },
    ],
  },
  {
    title: 'Inteligência & preços',
    accent: true,
    items: [
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
      { icon: FileBarChart, label: 'Proposta Comercial', path: '/proposta-tecnica' },
      { icon: TrendingUp, label: 'Análise de Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
    ],
  },
  {
    title: 'Jurídico & contábil',
    items: [
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: Calculator, label: 'Apoio Contábil', path: '/apoio-contabil' },
      { icon: Shield, label: 'Documentos', path: '/documentos' },
      { icon: Sparkles, label: 'IA Especializada', path: '/assistente-especializado', badge: 'novo' },
    ],
  },
  {
    title: 'Automação',
    items: [
      { icon: Workflow, label: 'Workflow IA', path: '/workflow-ia', badge: 'novo' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances' },
      { icon: ClipboardCheck, label: 'Assessoria Cadastral', path: '/assessoria-cadastral' },
      { icon: MessageSquare, label: 'WhatsApp CRM', path: '/whatsapp-crm' },
    ],
  },
  {
    // Só administradores veem: todas as rotas aqui são administrativas, e o
    // filtro de permissão as nega para operador/visualizador — o cartão some
    // inteiro em vez de aparecer pela metade. Suporte não entra: é de todos e
    // já vive no menu superior.
    title: 'Administração',
    items: [
      { icon: Building2, label: 'Empresas', path: '/empresas' },
      { icon: Users, label: 'Equipe', path: '/equipe' },
      { icon: Settings, label: 'Configurações', path: '/configuracoes' },
      { icon: Plug, label: 'API & Integração', path: '/api-integracao' },
    ],
  },
];

export default function QuickAccessGrid() {
  const navigate = useNavigate();
  const { canAccessRoute } = useMembroPermissoes();

  // O Painel oferecia TODOS os atalhos a qualquer pessoa, enquanto o menu
  // superior já filtrava por permissão — duas portas para o mesmo lugar com
  // regras diferentes. Aqui passa a valer a mesma regra, e grupo que esvazia
  // some em vez de virar cartão vazio.
  const gruposVisiveis = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => canAccessRoute(it.path)) }))
    .filter((g) => g.items.length > 0);

  // A grade acompanha quantos grupos SOBRARAM depois do filtro. Fixa em 6
  // colunas, cinco cartões deixavam uma coluna vazia à direita e a fileira
  // não alcançava a largura da linha de indicadores logo abaixo. Classes
  // estáticas de propósito: nome de classe montado em tempo de execução não
  // sobrevive à compilação do Tailwind.
  const colunasXl = {
    1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6',
  }[Math.min(Math.max(gruposVisiveis.length, 1), 6)] ?? 'xl:grid-cols-6';

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3', colunasXl)}>
      {gruposVisiveis.map((group) => (
        <div
          key={group.title}
          className={cn(
            'rounded-xl border p-2.5 sm:p-3 space-y-1.5 sm:space-y-2',
            group.accent
              ? 'border-accent/30 bg-accent/5'
              : 'border-border/60 bg-card/50'
          )}
        >
          {/* Rótulo de categoria — opção B da auditoria: 14px, sem caixa alta */}
          <h3 className="text-sm font-semibold text-muted-foreground">
            {group.title}
          </h3>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.path + item.label} delayDuration={400}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.path)}
                      className="group flex items-center gap-1.5 sm:gap-2 w-full px-1.5 sm:px-2 py-1.5 rounded-md text-sm font-medium text-foreground hover:bg-muted hover:text-foreground transition-colors text-left min-h-[32px]"
                    >
                      {/* Regra de ícone da auditoria: neutro por padrão, laranja só no hover */}
                      <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0" />
                      <span className="break-words leading-tight line-clamp-2">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto text-xs font-bold bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                          Novo
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
