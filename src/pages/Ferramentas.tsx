import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
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
      type="button"
      variants={cardVariant}
      onClick={() => navigate(item.path)}
      className={cn(
        'group relative flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-4 text-center shadow-sm',
        'transition-colors hover:border-primary/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      {item.badge && (
        <span
          className={cn(
            'absolute -top-2 right-2 rounded-full border px-2 py-0.5 text-xs font-semibold leading-none',
            item.badge === 'novo'
              ? 'border-success-line bg-success-tint text-success-ink'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {item.badge === 'novo' ? 'Novo' : 'Premium'}
        </span>
      )}
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary-tint group-hover:text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-foreground">{item.label}</span>
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
      {/* `/ferramentas` não é item de menu — não está em `paginas.ts` —, então o
          título e a descrição vêm à mão, e a trilha também. */}
      <CabecalhoPagina
        titulo="Nossas ferramentas"
        descricao="Todas as funcionalidades da plataforma reunidas num só lugar"
        icone={<Zap />}
        trilha={[{ rotulo: 'Painel', para: '/dashboard' }, { rotulo: 'Nossas ferramentas' }]}
        acoes={
          <Button onClick={handleOrganograma} disabled={gerando} variant="outline">
            {gerando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
            {gerando ? 'Gerando...' : 'Organograma PDF'}
          </Button>
        }
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {toolGroups.map((group) => (
          <motion.section
            key={group.title}
            variants={cardVariant}
            className={cn(
              'rounded-lg border p-6 shadow-sm',
              group.highlight ? 'border-primary/30 bg-primary-tint' : 'border-border bg-card',
            )}
          >
            <h2 className="mb-4 text-lg font-semibold text-foreground">{group.title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.items.map((item) => (
                <ToolCard key={item.path + item.label} item={item} navigate={navigate} />
              ))}
            </div>
          </motion.section>
        ))}
      </motion.div>
    </AppLayout>
  );
}
