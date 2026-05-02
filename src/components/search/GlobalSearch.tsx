import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut
} from '@/components/ui/command';
import {
  LayoutDashboard, Search, Kanban, Users, Bot, BarChart3, Settings,
  Crosshair, Shield, Scale, DollarSign, Calculator, Download, Building2,
  MessageSquare, TrendingUp, Target, ClipboardCheck, BookOpen, Bell,
  Archive, CalendarDays, GraduationCap, FileText, Zap, Plus, Upload,
  CheckCheck, QrCode, ArrowRightLeft, Wallet, Receipt, Banknote,
  FileSpreadsheet, ScanLine, LineChart, FileBarChart, Sparkles
} from 'lucide-react';
import { HUB_ITEMS } from '@/components/financeiro/FinHomeHub';

type Page = {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
};

const pages: Page[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: 'painel inicio home' },
  { name: 'Analytics', path: '/analytics', icon: BarChart3, keywords: 'graficos relatorios metricas' },
  { name: 'Monitoramento de Editais', path: '/monitoramento-editais', icon: Download, keywords: 'buscar editais licitacoes' },
  { name: 'Boletins Diários', path: '/boletins', icon: Bell, keywords: 'email notificacao diaria' },
  { name: 'Chat e Mural', path: '/monitoramento-chat', icon: MessageSquare, keywords: 'mensagens comunicacao' },
  { name: 'WhatsApp CRM', path: '/whatsapp-crm', icon: MessageSquare, keywords: 'whatsapp grupos crm setores' },
  { name: 'Licitações Estratégicas', path: '/licitacoes-estrategicas', icon: Target, keywords: 'estrategia prioridade' },
  { name: 'Calendário', path: '/calendario', icon: CalendarDays, keywords: 'datas prazos agenda' },
  { name: 'Kanban', path: '/kanban', icon: Kanban, keywords: 'quadro tarefas fluxo processos' },
  { name: 'Robô de Lances', path: '/robo-lances', icon: Crosshair, keywords: 'automacao lances disputa pregao' },
  { name: 'Histórico', path: '/historico-licitacoes', icon: Archive, keywords: 'passadas anteriores arquivo' },
  { name: 'Gestão de Contratos', path: '/gestao-contratos', icon: FileText, keywords: 'contratos saldo aditivos' },
  { name: 'Análise de Mercado', path: '/analise-mercado', icon: TrendingUp, keywords: 'mercado precos concorrencia' },
  { name: 'Concorrentes', path: '/concorrentes', icon: Users, keywords: 'empresas competidores cnpj' },
  { name: 'Precificação', path: '/precificacao', icon: DollarSign, keywords: 'precos custos margem bdi' },
  { name: 'Proposta Comercial', path: '/proposta-tecnica', icon: Search, keywords: 'proposta planilha precos' },
  { name: 'Documentos', path: '/documentos', icon: Shield, keywords: 'certidoes habilitacao' },
  { name: 'Assessoria Cadastral', path: '/assessoria-cadastral', icon: ClipboardCheck, keywords: 'cadastro sicaf' },
  { name: 'Apoio Jurídico', path: '/apoio-juridico', icon: Scale, keywords: 'juridico impugnacao recurso' },
  { name: 'Apoio Contábil', path: '/apoio-contabil', icon: Calculator, keywords: 'contabil balanco' },
  { name: 'Índices e Repactuação', path: '/indices-repactuacao', icon: TrendingUp, keywords: 'ipca igpm reajuste' },
  { name: 'Financeiro', path: '/financeiro', icon: DollarSign, keywords: 'financeiro caixa contas hub' },
  { name: 'Assistente IA', path: '/assistente', icon: Bot, keywords: 'inteligencia artificial chat' },
  { name: 'Tutorial', path: '/tutorial', icon: GraduationCap, keywords: 'guia ajuda como usar' },
  { name: 'Blog', path: '/blog', icon: BookOpen, keywords: 'noticias artigos' },
  { name: 'E-book', path: '/ebook', icon: Download, keywords: 'download manual' },
  { name: 'Empresas', path: '/empresas', icon: Building2, keywords: 'empresa cnpj cadastro' },
  { name: 'Configurações', path: '/configuracoes', icon: Settings, keywords: 'config preferencias' },
  { name: 'Ferramentas', path: '/ferramentas', icon: Zap, keywords: 'utilidades extras' },
];

// Ações rápidas globais — atalho direto para abrir um fluxo específico
type QuickAction = {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  keywords: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'qa-novo-lancamento', label: 'Novo lançamento', hint: 'Financeiro', icon: Plus, path: '/financeiro?view=lancamentos&new=1', keywords: 'criar adicionar receita despesa pagar receber' },
  { id: 'qa-importar-ofx', label: 'Importar extrato OFX', hint: 'Financeiro', icon: Upload, path: '/financeiro?view=importar_ofx', keywords: 'banco extrato conciliacao upload' },
  { id: 'qa-conciliar', label: 'Conciliação bancária', hint: 'Financeiro', icon: CheckCheck, path: '/financeiro?view=conciliacao', keywords: 'conciliar banco extrato match' },
  { id: 'qa-emitir-nfe', label: 'Emitir NF-e', hint: 'Fiscal', icon: FileText, path: '/financeiro?view=emissor_nfe', keywords: 'nota fiscal emissao sefaz' },
  { id: 'qa-cobranca-pix', label: 'Gerar cobrança PIX', hint: 'Fiscal', icon: QrCode, path: '/financeiro?view=pix_cobranca', keywords: 'pix qr code cobranca brcode' },
  { id: 'qa-transferencia', label: 'Transferência entre contas', hint: 'Bancos', icon: ArrowRightLeft, path: '/financeiro?view=transferencia', keywords: 'mover saldo conta' },
  { id: 'qa-nova-conta', label: 'Nova conta corrente', hint: 'Bancos', icon: Wallet, path: '/financeiro?view=contas&new=1', keywords: 'cadastrar banco conta corrente' },
  { id: 'qa-baixa-lote', label: 'Baixa em lote', hint: 'Financeiro', icon: Sparkles, path: '/financeiro?view=baixa_lote', keywords: 'liquidar pagar receber multiplos' },
  { id: 'qa-buscar-edital', label: 'Buscar novo edital', hint: 'Monitoramento', icon: Search, path: '/monitoramento-editais', keywords: 'pncp licitacao busca instantanea' },
  { id: 'qa-novo-processo', label: 'Cadastrar edital manual', hint: 'Monitoramento', icon: Plus, path: '/monitoramento-editais?manual=1', keywords: 'cadastrar manual edital' },
  { id: 'qa-relatorio-gerencial', label: 'Relatório Gerencial', hint: 'Análises', icon: FileBarChart, path: '/?relatorio=1', keywords: 'pdf relatorio gerencial' },
  { id: 'qa-fluxo-caixa', label: 'Ver Fluxo de Caixa', hint: 'Financeiro', icon: LineChart, path: '/financeiro?view=fluxo_caixa', keywords: 'fluxo caixa entradas saidas' },
  { id: 'qa-dre', label: 'Ver DRE', hint: 'Financeiro', icon: FileBarChart, path: '/financeiro?view=dre', keywords: 'dre demonstrativo resultado' },
];

// Mapeia ícones do hub do Financeiro para o command palette global
type FinEntry = { id: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>; path: string; keywords: string };

const FIN_ENTRIES: FinEntry[] = HUB_ITEMS.map((i) => ({
  id: `fin-${i.id}`,
  label: i.label,
  description: i.description,
  icon: i.icon,
  path: `/financeiro?view=${i.id}`,
  keywords: `financeiro ${i.group} ${i.label} ${i.description}`,
}));

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    // Pequeno delay garante que o dialog feche antes da navegação repintar a árvore
    setTimeout(() => navigate(path), 0);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar módulo, página ou ação rápida... (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Ações rápidas">
          {QUICK_ACTIONS.map((a) => (
            <CommandItem
              key={a.id}
              value={`${a.label} ${a.hint} ${a.keywords}`}
              onSelect={() => handleSelect(a.path)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <a.icon className="w-4 h-4 text-primary" />
              <span className="flex-1">{a.label}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Páginas e Módulos">
          {pages.map((page) => (
            <CommandItem
              key={page.path}
              value={`${page.name} ${page.keywords ?? ''}`}
              onSelect={() => handleSelect(page.path)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <page.icon className="w-4 h-4 text-muted-foreground" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Financeiro — Módulos">
          {FIN_ENTRIES.map((f) => (
            <CommandItem
              key={f.id}
              value={`${f.label} ${f.keywords}`}
              onSelect={() => handleSelect(f.path)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <f.icon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">{f.label}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{f.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
