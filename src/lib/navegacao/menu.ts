/**
 * Autoridade única do menu do app.
 *
 * Mora fora dos componentes de propósito: a barra do topo (`AppTopNav`) e a
 * barra lateral (`AppSidebar`) leem esta MESMA lista, e duplicá-la faria as
 * duas navegações divergirem — o defeito que o CLAUDE.md descreve como já
 * tendo mantido o arquivamento automático quebrado por meses.
 *
 * Segunda razão, prática: constante exportada de dentro de um arquivo de
 * componente desliga a atualização instantânea da tela naquele arquivo.
 */
import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  Crosshair,
  DollarSign,
  Download,
  FileBarChart,
  FileText,
  Gauge,
  GraduationCap,
  HeadphonesIcon,
  Kanban,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Plug,
  Scale,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
  Workflow,
  // Ícones de GRUPO — usados só na barra lateral, um por categoria.
  Brain,
  CircleDollarSign,
  FileSearch,
  Map,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import type { ElementType } from 'react';

export interface NavItem {
  icon: ElementType;
  label: string;
  path: string;
  /** Exclusivo do administrador mesmo com a rota aberta à equipe — caso de
   *  "Definir Metas": todos acompanham o painel, só o admin define o alvo. */
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  /** Ícone da categoria na barra lateral. Sem ele, a barra cai no ícone do
   *  primeiro item — que descreve aquele destino, não a categoria inteira. */
  icone?: ElementType;
  /** Nome curto para a barra lateral, onde a coluna tem 264px e o rótulo vai
   *  em caixa alta — "INTELIGÊNCIA & PREÇOS" não caberia numa linha. O `title`
   *  completo continua valendo no menu do topo e na gaveta do celular, e é ele
   *  que o resto do app usa para se referir ao grupo. */
  curto?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  /* "Painel" saiu, e Dashboard e Analytics vieram para cá.
     "Painel" e "Dashboard" são a mesma palavra em dois idiomas: um grupo
     chamado Painel cujo primeiro item se chama Dashboard fazia a barra abrir
     para repetir o próprio nome. E os dois itens sempre pertenceram aqui —
     Analytics é leitura de desempenho, Dashboard é leitura do dia; ambos
     respondem "como estamos indo", que é a pergunta deste grupo, e não "o que
     preciso fazer agora", que é a dos outros.
     O grupo é o primeiro da barra porque era a posição do Painel: quem abre o
     sistema quer o número antes da tarefa.
     `curto` deixou de existir: com o "& Preços" fora, o título cabe inteiro na
     coluna de 264px em caixa alta. */
  {
    title: 'Inteligência',
    /* `Tag` era etiqueta de preço — herança de quando o grupo se chamava
       "Inteligência & Preços". Com Dashboard e Analytics dentro, o grupo deixou
       de ser sobre preço e o ícone virava promessa errada. `Brain` é o que o
       título já diz, e não colide com nenhum outro grupo (`Sparkles` é a IA,
       `TrendingUp` é item, não grupo). */
    icone: Brain,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
      { icon: FileBarChart, label: 'Proposta Comercial', path: '/proposta-tecnica' },
      { icon: TrendingUp, label: 'Análise de Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
    ],
  },
  {
    title: 'Monitoramento',
    icone: FileSearch,
    items: [
      { icon: Download, label: 'Editais & Licitações', path: '/monitoramento-editais' },
      { icon: Bell, label: 'Central de Avisos', path: '/avisos' },
      { icon: Bell, label: 'Boletins Diários', path: '/boletins' },
      { icon: MessageSquare, label: 'Chat e Mural', path: '/monitoramento-chat' },
    ],
  },
  {
    title: 'Gestão de Processos',
    curto: 'Gestão',
    icone: Map,
    items: [
      { icon: Target, label: 'Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: ListChecks, label: 'Compromissos', path: '/meus-compromissos' },
      { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
      { icon: Workflow, label: 'Workflow IA', path: '/workflow-ia' },
      { icon: Kanban, label: 'Kanban', path: '/kanban' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances' },
      { icon: Archive, label: 'Histórico', path: '/historico-licitacoes' },
      { icon: Gauge, label: 'Metas do Comercial', path: '/metas-comercial' },
      { icon: FileText,     label: 'Contratos', path: '/gestao-contratos' },
      { icon: ShoppingCart, label: 'Compras, Pedidos e Estoque', path: '/gestao-compras' },
    ],
  },
  {
    title: 'Jurídico & Contábil',
    curto: 'Jurídico',
    icone: Scale,
    items: [
      { icon: Shield, label: 'Documentos', path: '/documentos' },
      { icon: ClipboardCheck, label: 'Assessoria Cadastral', path: '/assessoria-cadastral' },
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: Calculator, label: 'Apoio Contábil', path: '/apoio-contabil' },
      { icon: TrendingUp, label: 'Índices & Repactuação', path: '/indices-repactuacao' },
      
    ],
  },
  {
    title: 'Financeiro',
    icone: CircleDollarSign,
    items: [
      { icon: DollarSign, label: 'Financeiro', path: '/financeiro' },
    ],
  },
  {
    title: 'Comunicação',
    icone: MessageCircle,
    items: [
      { icon: MessageSquare, label: 'WhatsApp CRM', path: '/whatsapp-crm' },
    ],
  },
  {
    title: 'Ferramentas',
    icone: Sparkles,
    items: [
      { icon: Bot, label: 'Assistente IA', path: '/assistente' },
      { icon: Plug, label: 'API & Integração', path: '/api-integracao' },
      { icon: GraduationCap, label: 'Tutorial', path: '/tutorial' },
      { icon: BookOpen, label: 'Blog', path: '/blog' },
      { icon: Download, label: 'E-book', path: '/ebook' },
    ],
  },
  {
    title: 'Configuração',
    icone: Settings,
    items: [
      { icon: Building2, label: 'Empresas', path: '/empresas' },
      { icon: Users, label: 'Equipe', path: '/equipe' },
      { icon: Bell, label: 'Preferências de Alertas', path: '/configuracoes/alertas' },
      /* Mesma tela de "Metas do Comercial", entrando direto na aba de
         parametrização. O rótulo e o ícone dizem isso agora: antes eram
         'Definir Metas' com o MESMO ícone Gauge da entrada de Gestão, e duas
         portas idênticas para uma tela só passavam por duas funções — o dono
         do produto descreveu cada uma como se fizesse coisa diferente. */
      { icon: SlidersHorizontal, label: 'Definir Metas', path: '/definir-metas', adminOnly: true },
      { icon: Settings, label: 'Configurações', path: '/configuracoes' },
      { icon: HeadphonesIcon, label: 'Suporte', path: '/suporte' },
    ],
  },
  {
    /* Administração como grupo próprio, como no protótipo. No menu do topo
       estes itens já apareciam, mas dependurados dentro de "Ferramentas" — o
       que escondia que são de outra natureza. Continuam fechados para quem não
       é administrador: `canAccessRoute` nega rota administrativa por conta
       própria, e o grupo some inteiro quando esvazia. */
    title: 'Admin',
    icone: ShieldCheck,
    items: [
      { icon: ShieldCheck, label: 'Templates IA', path: '/admin/templates' },
      { icon: DollarSign, label: 'Financeiro', path: '/admin/financeiro' },
      { icon: Target, label: 'Fontes Fabricantes', path: '/admin/fontes-fabricantes' },
      { icon: TrendingUp, label: 'Marketing', path: '/admin/marketing' },
      { icon: Send, label: 'Distribuição', path: '/admin/distribuicao' },
      { icon: ShieldCheck, label: 'Auditoria', path: '/admin/auditoria' },
      { icon: BarChart3, label: 'Métricas SaaS', path: '/admin/metricas-saas' },
    ],
  },
];
