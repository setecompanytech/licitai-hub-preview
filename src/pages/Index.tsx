import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import LicitacoesChart from '@/components/dashboard/LicitacoesChart';
import ValorChart from '@/components/dashboard/ValorChart';
import RecentLicitacoes from '@/components/dashboard/RecentLicitacoes';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useNavigate } from 'react-router-dom';
import { Eye, Send, Trophy, TrendingUp, DollarSign, Zap, Bell, Download, Target, Archive, Bot, Scale, Search, BookOpen, Kanban, Shield, Building2, MessageSquare, Crosshair, Users, ClipboardCheck, FileText, HeadphonesIcon, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

interface ToolItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: 'novo' | 'premium';
}

interface ToolGroup {
  title: string;
  highlight?: boolean;
  items: ToolItem[];
}

const toolGroups: ToolGroup[] = [
  {
    title: 'Oportunidades de Negócio',
    items: [
      { icon: Bell, label: 'Boletins de Licitações', path: '/boletins' },
      { icon: Download, label: 'Encontrar Editais', path: '/monitoramento-editais' },
      { icon: Target, label: 'Licitações Estratégicas', path: '/licitacoes-estrategicas' },
      { icon: Archive, label: 'Histórico de Licitações', path: '/historico-licitacoes' },
    ],
  },
  {
    title: 'Inteligência Artificial',
    highlight: true,
    items: [
      { icon: Bot, label: 'Assistente IA', path: '/assistente', badge: 'novo' },
      { icon: Scale, label: 'Consultor Jurídico', path: '/apoio-juridico' },
      { icon: Search, label: 'Proposta Técnica', path: '/proposta-tecnica' },
      { icon: BookOpen, label: 'Blog Jurídico IA', path: '/blog' },
    ],
  },
  {
    title: 'Ferramentas de Gestão',
    items: [
      { icon: Kanban, label: 'Kanban de Processos', path: '/kanban' },
      { icon: Shield, label: 'Gerenciar Documentos', path: '/documentos' },
      { icon: Building2, label: 'Gerenciar Empresas', path: '/empresas', badge: 'novo' },
    ],
  },
  {
    title: 'Ferramentas de Automação',
    items: [
      { icon: MessageSquare, label: 'Chat e Mural', path: '/monitoramento-chat' },
      { icon: Crosshair, label: 'Robô de Lances', path: '/robo-lances', badge: 'novo' },
      { icon: MessageSquare, label: 'WhatsApp Setores', path: '/whatsapp-setores' },
    ],
  },
  {
    title: 'Análise Estratégica',
    items: [
      { icon: TrendingUp, label: 'Análise de Mercado', path: '/analise-mercado' },
      { icon: Users, label: 'Concorrentes', path: '/concorrentes' },
      { icon: DollarSign, label: 'Precificação', path: '/precificacao' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    ],
  },
  {
    title: 'Assessoria e Consultoria',
    items: [
      { icon: ClipboardCheck, label: 'Assessoria Cadastral', path: '/assessoria-cadastral' },
      { icon: Scale, label: 'Apoio Jurídico', path: '/apoio-juridico' },
      { icon: FileText, label: 'E-book ABNT', path: '/ebook' },
      { icon: HeadphonesIcon, label: 'Suporte', path: '/suporte' },
    ],
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } },
};

function ToolCard({ item, navigate }: { item: ToolItem; navigate: (p: string) => void }) {
  const Icon = item.icon;
  return (
    <motion.button
      variants={cardVariant}
      onClick={() => navigate(item.path)}
      className={cn(
        'group relative flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border/60 bg-card',
        'hover:border-accent/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-250 cursor-pointer',
        'min-w-[100px] flex-1'
      )}
    >
      {item.badge && (
        <span
          className={cn(
            'absolute -top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full leading-none',
            item.badge === 'novo'
              ? 'bg-accent text-accent-foreground'
              : 'bg-primary text-primary-foreground'
          )}
        >
          {item.badge === 'novo' ? 'Novo' : 'Premium'}
        </span>
      )}
      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-200">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <span className="text-xs font-medium text-foreground text-center leading-tight">{item.label}</span>
    </motion.button>
  );
}

export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis, chartMensal, chartValor, recentes, loading } = useDashboardData();
  const navigate = useNavigate();

  const empresaLabel = todasSelecionadas
    ? 'Todas as Empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Empresa';

  return (
    <AppLayout>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resultados de: <span className="font-medium text-foreground">{empresaLabel}</span>
          </p>
        </div>
        <EmpresaSelector />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <StatCard label="Monitoradas" value={kpis.licitacoesMonitoradas.toString()} icon={Eye} />
        <StatCard label="Propostas" value={kpis.propostasEnviadas.toString()} icon={Send} />
        <StatCard label="Taxa de Vitória" value={`${kpis.taxaVitoria}%`} icon={Trophy} accentColor="hsl(142, 71%, 45%)" />
        <StatCard label="ROI Médio" value={`${kpis.roiMedio}%`} icon={TrendingUp} accentColor="hsl(38, 92%, 50%)" />
        <StatCard label="Valor Ganho" value={formatCurrency(kpis.valorTotalGanho)} icon={DollarSign} accentColor="hsl(210, 100%, 40%)" />
        <StatCard label="Novas Hoje" value={kpis.licitacoesHoje.toString()} icon={Zap} />
      </div>

      {/* Tools Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight mb-4">Ferramentas</h2>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {toolGroups.map((group) => (
            <motion.div
              key={group.title}
              variants={cardVariant}
              className={cn(
                'rounded-2xl border p-4',
                group.highlight
                  ? 'border-accent/30 bg-accent/5'
                  : 'border-border/60 bg-card/50'
              )}
            >
              <h3 className="text-sm font-bold text-foreground mb-3">{group.title}</h3>
              <div className="flex flex-wrap gap-2.5">
                {group.items.map((item) => (
                  <ToolCard key={item.path + item.label} item={item} navigate={navigate} />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <LicitacoesChart data={chartMensal} />
        <ValorChart data={chartValor} />
      </div>

      {/* Recent */}
      <RecentLicitacoes data={recentes} loading={loading} />
    </AppLayout>
  );
}
