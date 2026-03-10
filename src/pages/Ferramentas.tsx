import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Download, Bell, Target, Archive, Bot, Search, Scale, BookOpen,
  Kanban, Shield, Building2, MessageSquare, Crosshair, TrendingUp,
  Users, DollarSign, ClipboardCheck, HeadphonesIcon, FileText,
  Zap, BarChart3, FileDown, Loader2,
} from 'lucide-react';
import { generateOrganogramaPDF } from '@/lib/organograma-pdf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
      { icon: MessageSquare, label: 'WhatsApp CRM', path: '/whatsapp-crm' },
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
  show: { transition: { staggerChildren: 0.06 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
};

function ToolCard({ item, navigate }: { item: ToolItem; navigate: (p: string) => void }) {
  const Icon = item.icon;
  return (
    <motion.button
      variants={cardVariant}
      onClick={() => navigate(item.path)}
      className={cn(
        'group relative flex flex-col items-center gap-3 p-5 rounded-xl border border-border/60 bg-card',
        'hover:border-accent/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-250 cursor-pointer',
        'min-w-[120px] flex-1'
      )}
    >
      {item.badge && (
        <span
          className={cn(
            'absolute -top-2 right-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full leading-none',
            item.badge === 'novo'
              ? 'bg-accent text-accent-foreground'
              : 'bg-primary text-primary-foreground'
          )}
        >
          {item.badge === 'novo' ? 'Novo' : 'Premium'}
        </span>
      )}
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors duration-200">
        <Icon className="w-6 h-6 text-accent" />
      </div>
      <span className="text-sm font-medium text-foreground text-center leading-tight">{item.label}</span>
    </motion.button>
  );
}

export default function Ferramentas() {
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);

  const handleOrganograma = async () => {
    setGerando(true);
    try {
      generateOrganogramaPDF();
      toast.success('Organograma PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar o organograma.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold tracking-tight">Nossas Ferramentas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Acesse todas as funcionalidades da plataforma LicitaIA em um só lugar.
          </p>
        </div>
        <Button
          onClick={handleOrganograma}
          disabled={gerando}
          variant="outline"
          className="gap-2"
        >
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {gerando ? 'Gerando...' : 'Organograma PDF'}
        </Button>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        {toolGroups.map((group) => (
          <motion.div
            key={group.title}
            variants={cardVariant}
            className={cn(
              'rounded-2xl border p-5',
              group.highlight
                ? 'border-accent/30 bg-accent/5'
                : 'border-border/60 bg-card/50'
            )}
          >
            <h2 className="text-base font-bold text-foreground mb-4">{group.title}</h2>
            <div className="flex flex-wrap gap-3">
              {group.items.map((item) => (
                <ToolCard key={item.path + item.label} item={item} navigate={navigate} />
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </AppLayout>
  );
}
