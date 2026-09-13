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
  BellRing,
  BookOpen,
  Banknote,
  Bot,
  Building2,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Crosshair,
  DollarSign,
  Download,
  FileBarChart,
  FileText,
  FolderTree,
  Gauge,
  Globe,
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
  User,
  Users,
  Workflow,
  Zap,
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

/**
 * O menu da conta — o que vive atrás do avatar, não na barra (13/09/2026).
 *
 * A barra responde "o que eu faço"; este menu responde "quem eu sou, qual
 * empresa e como o sistema se comporta comigo". Antes as duas perguntas se
 * misturavam: o grupo "Configuração" abria a MESMA tela que o avatar já
 * abria por seção, e "Notificações" (avatar) convivia com "Preferências de
 * Alertas" (barra) — dois nomes quase iguais para telas diferentes.
 *
 * `hash` leva à seção da tela de Configurações; sem ele, é tela própria.
 */
export interface ItemDaConta {
  icon: ElementType;
  label: string;
  path: string;
  hash?: string;
  /** Cabeçalho da seção dentro do menu. */
  secao: 'Conta' | 'Empresa' | 'Preferências' | 'Plataforma';
  adminOnly?: boolean;
}

export const menuDaConta: ItemDaConta[] = [
  { icon: Shield, label: 'Segurança', path: '/configuracoes', hash: '#seguranca', secao: 'Conta' },
  /* "Aparência" saiu em 13/09: apontava para #aparencia, que não existe em
     Configurações — quem troca claro/escuro é o botão de sol/lua da barra,
     ali ao lado. Item que promete tela inexistente é pior que item ausente. */

  { icon: Building2, label: 'Dados da empresa', path: '/configuracoes', hash: '#empresa', secao: 'Empresa' },
  { icon: User, label: 'Representante legal', path: '/configuracoes', hash: '#representante', secao: 'Empresa' },
  { icon: Building2, label: 'Empresas', path: '/empresas', secao: 'Empresa' },
  { icon: Users, label: 'Equipe', path: '/equipe', secao: 'Empresa' },

  { icon: Globe, label: 'Monitoramento', path: '/configuracoes', hash: '#monitoramento', secao: 'Preferências' },
  /* Dois nomes que já se confundiram: este é o aviso DO SISTEMA (sino);
     o de baixo é o que você quer receber sobre editais. */
  { icon: Bell, label: 'Notificações do sistema', path: '/configuracoes', hash: '#notificacoes', secao: 'Preferências' },
  { icon: BellRing, label: 'Alertas de editais', path: '/configuracoes/alertas', secao: 'Preferências' },

  /* Parametrizar a meta é ato de dono, não tarefa do dia: fica com o resto
     do que se configura uma vez, atrás do avatar. O acompanhamento diário
     continua na barra, em Gestão › Metas do Comercial. */
  { icon: SlidersHorizontal, label: 'Definir metas', path: '/definir-metas', secao: 'Plataforma', adminOnly: true },
  { icon: CreditCard, label: 'Plano e assinatura', path: '/configuracoes', hash: '#plano', secao: 'Plataforma' },
  { icon: Settings, label: 'Todas as configurações', path: '/configuracoes', secao: 'Plataforma' },
];

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
    /* As cinco pastas do Financeiro viraram itens de menu em 13/09.
       Antes o grupo tinha um item só — "Financeiro" — que abria a estante de
       pastas fechadas: quem queria conciliar um extrato clicava em Financeiro,
       depois em Bancos & Conciliação, depois no módulo. Três cliques para uma
       tarefa diária, e o menu não dizia que o sistema tinha essas cinco áreas.
       Os rótulos e a ordem são os mesmos de `GROUPS` em `FinHomeHub`, e o
       `?pasta=` é o endereço que a estante passou a entender. Divergir daquela
       lista aqui faria o menu prometer pasta que a tela não abre. */
    title: 'Financeiro',
    icone: CircleDollarSign,
    items: [
      { icon: Zap, label: 'Operação Diária', path: '/financeiro?pasta=operacao' },
      { icon: Banknote, label: 'Bancos & Conciliação', path: '/financeiro?pasta=bancos' },
      { icon: FileText, label: 'Fiscal & Documentos', path: '/financeiro?pasta=fiscal' },
      { icon: FileBarChart, label: 'Análises & Relatórios', path: '/financeiro?pasta=relatorios' },
      { icon: FolderTree, label: 'Cadastros & Configuração', path: '/financeiro?pasta=cadastros' },
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
      /* "Financeiro da plataforma" e não "Financeiro": este é o dos
         assinantes (assinaturas e chamados de cobrança), não o do cliente.
         Dois itens com o mesmo rótulo em menus diferentes fazem quem
         procura um achar o outro. Mesmo título do registro paginas.ts. */
      { icon: DollarSign, label: 'Financeiro da plataforma', path: '/admin/financeiro' },
      { icon: Target, label: 'Fontes Fabricantes', path: '/admin/fontes-fabricantes' },
      { icon: TrendingUp, label: 'Marketing', path: '/admin/marketing' },
      { icon: Send, label: 'Distribuição', path: '/admin/distribuicao' },
      { icon: ShieldCheck, label: 'Auditoria', path: '/admin/auditoria' },
      { icon: BarChart3, label: 'Métricas SaaS', path: '/admin/metricas-saas' },
    ],
  },
];
