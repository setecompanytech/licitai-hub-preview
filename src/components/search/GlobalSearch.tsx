import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator
} from '@/components/ui/command';
import {
  LayoutDashboard, Search, Kanban, Users, Bot, BarChart3, Settings,
  Crosshair, Shield, Scale, DollarSign, Calculator, Download, Building2,
  MessageSquare, TrendingUp, Target, ClipboardCheck, BookOpen, Bell,
  Archive, CalendarDays, GraduationCap, FileText, Zap
} from 'lucide-react';

const pages = [
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
  { name: 'Assistente IA', path: '/assistente', icon: Bot, keywords: 'inteligencia artificial chat' },
  { name: 'Tutorial', path: '/tutorial', icon: GraduationCap, keywords: 'guia ajuda como usar' },
  { name: 'Blog', path: '/blog', icon: BookOpen, keywords: 'noticias artigos' },
  { name: 'E-book', path: '/ebook', icon: Download, keywords: 'download manual' },
  { name: 'Empresas', path: '/empresas', icon: Building2, keywords: 'empresa cnpj cadastro' },
  { name: 'Configurações', path: '/configuracoes', icon: Settings, keywords: 'config preferencias' },
  { name: 'Ferramentas', path: '/ferramentas', icon: Zap, keywords: 'utilidades extras' },
];

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
    navigate(path);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar módulo, página ou funcionalidade..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Páginas e Módulos">
          {pages.map((page) => (
            <CommandItem
              key={page.path}
              value={`${page.name} ${page.keywords}`}
              onSelect={() => handleSelect(page.path)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <page.icon className="w-4 h-4 text-muted-foreground" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
