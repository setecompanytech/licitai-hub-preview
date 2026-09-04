import { useNavigate } from 'react-router-dom';
import {
  Download, Bell, Target, Archive, Bot, Search, Scale, BookOpen,
  Kanban, Shield, MessageSquare, Crosshair, TrendingUp, Building2, Settings, Plug, Gauge,
  Users, DollarSign, ClipboardCheck, FileText,
  BarChart3, CalendarDays, ListChecks, Calculator, Workflow,   FileBarChart, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickItem {
  /** Exclusivo do administrador mesmo quando a ROTA é aberta à equipe —
   *  caso das Metas: todos acompanham, só o admin define. */
  adminOnly?: boolean;
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
      { icon: Gauge, label: 'Definir Metas', path: '/metas-comercial?tab=parametros', adminOnly: true },
      { icon: Plug, label: 'API & Integração', path: '/api-integracao' },
    ],
  },
];

export default function QuickAccessGrid() {
  const navigate = useNavigate();
  const { canAccessRoute, isAdmin } = useMembroPermissoes();

  // O Painel oferecia TODOS os atalhos a qualquer pessoa, enquanto o menu
  // superior já filtrava por permissão — duas portas para o mesmo lugar com
  // regras diferentes. Aqui passa a valer a mesma regra, e grupo que esvazia
  // some em vez de virar cartão vazio.
  const gruposVisiveis = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.adminOnly && !isAdmin) return false;
        // Rota com parâmetro (?tab=) é avaliada pelo caminho base.
        return canAccessRoute(it.path.split('?')[0]);
      }),
    }))
    .filter((g) => g.items.length > 0);

  // REBRAND — a grade segue o protótipo: os GRUPOS em duas colunas largas, e
  // os itens de cada grupo em ladrilhos de três por fileira, com o ícone em
  // cima do nome. Antes eram seis colunas estreitas com lista vertical, e o
  // nome de cada item quebrava em duas linhas.
  // Duas colunas dispensam o cálculo de coluna que existia aqui: qualquer
  // número de grupos preenche as fileiras sem deixar buraco à direita.
  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      {gruposVisiveis.map((group) => (
        <div
          key={group.title}
          className={cn(
            // Borda além da sombra: o painel tem fundo cinza-claro, e só a
            // sombra não separava o cartão do fundo em tela de baixo contraste.
            'rounded-2xl p-5 shadow-md border',
            group.accent
              ? 'bg-primary-tint/50 border-primary/15'
              : 'bg-card border-border/70'
          )}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <h3 className="text-lg font-semibold">{group.title}</h3>
            {group.accent && (
              <span className="text-xs font-bold uppercase tracking-wider bg-success text-success-foreground px-2 py-0.5 rounded-full leading-none">
                Destaque
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 [&>*]:min-w-0">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.path + item.label} delayDuration={400}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.path)}
                      className="eleva eleva--ladrilho group relative flex flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-2 py-5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {item.badge && (
                        // O selo fica ACIMA do ladrilho, montado na borda, como
                        // no protótipo — dentro, ele empurraria o ícone e
                        // desalinharia a fileira inteira.
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold bg-success text-success-foreground px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
                          Novidade
                        </span>
                      )}
                      {/* O ícone cresce junto, um pouco mais que o ladrilho —
                          é o que faz o gesto parecer que o cartão se aproxima,
                          e não que foi só esticado. */}
                      <Icon
                        className="w-5 h-5 text-accent transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium leading-tight line-clamp-2">
                        {item.label}
                      </span>
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
