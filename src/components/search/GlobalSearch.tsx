import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  LayoutDashboard, Search, Kanban, Users, Bot, BarChart3, Settings,
  Crosshair, Shield, Scale, DollarSign, Calculator, Download, Building2,
  MessageSquare, TrendingUp, Target, ClipboardCheck, BookOpen, Bell,
  Archive, CalendarDays, GraduationCap, FileText, Zap, Plus, Upload,
  CheckCheck, QrCode, ArrowRightLeft, Wallet, Receipt, Banknote,
  FileSpreadsheet, ScanLine, LineChart, FileBarChart, Sparkles,
  Image as ImageIcon, Palette, Type, BookMarked
} from 'lucide-react';
import { HUB_ITEMS } from '@/components/financeiro/FinHomeHub';
import { supabase } from '@/integrations/supabase/client';

// Identidade visual (tabela identidade_visual, prancha 12/09): a lupa acha a
// marca por palavra-chave e oferece o atalho — logo abre o arquivo, cor copia
// o hex, fonte/regra copiam o valor. Carregada só quando a busca abre.
type ItemMarca = {
  slug: string;
  categoria: 'logo' | 'cor' | 'tipografia' | 'regra';
  nome: string;
  descricao: string | null;
  uso: string | null;
  url: string | null;
  valor: string | null;
  palavras_chave: string[];
};

const ICONE_MARCA: Record<ItemMarca['categoria'], React.ComponentType<{ className?: string }>> = {
  logo: ImageIcon,
  cor: Palette,
  tipografia: Type,
  regra: BookMarked,
};

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
  { id: 'qa-novo-lancamento', label: 'Novo lançamento', hint: 'Financeiro', icon: Plus, path: '/financeiro/lancamentos?new=1', keywords: 'criar adicionar receita despesa pagar receber' },
  { id: 'qa-importar-ofx', label: 'Importar extrato OFX', hint: 'Financeiro', icon: Upload, path: '/financeiro/importar_ofx', keywords: 'banco extrato conciliacao upload' },
  { id: 'qa-conciliar', label: 'Conciliação bancária', hint: 'Financeiro', icon: CheckCheck, path: '/financeiro/conciliacao', keywords: 'conciliar banco extrato match' },
  { id: 'qa-emitir-nfe', label: 'Emitir NF-e', hint: 'Fiscal', icon: FileText, path: '/financeiro/emissor_nfe', keywords: 'nota fiscal emissao sefaz' },
  { id: 'qa-cobranca-pix', label: 'Gerar cobrança PIX', hint: 'Fiscal', icon: QrCode, path: '/financeiro/pix_cobranca', keywords: 'pix qr code cobranca brcode' },
  { id: 'qa-transferencia', label: 'Transferência entre contas', hint: 'Bancos', icon: ArrowRightLeft, path: '/financeiro/transferencia', keywords: 'mover saldo conta' },
  { id: 'qa-nova-conta', label: 'Nova conta corrente', hint: 'Bancos', icon: Wallet, path: '/financeiro/contas?new=1', keywords: 'cadastrar banco conta corrente' },
  { id: 'qa-baixa-lote', label: 'Baixa em lote', hint: 'Financeiro', icon: Sparkles, path: '/financeiro/baixa_lote', keywords: 'liquidar pagar receber multiplos' },
  { id: 'qa-buscar-edital', label: 'Buscar novo edital', hint: 'Monitoramento', icon: Search, path: '/monitoramento-editais', keywords: 'pncp licitacao busca instantanea' },
  { id: 'qa-novo-processo', label: 'Cadastrar edital manual', hint: 'Monitoramento', icon: Plus, path: '/monitoramento-editais?manual=1', keywords: 'cadastrar manual edital' },
  { id: 'qa-relatorio-gerencial', label: 'Relatório Gerencial', hint: 'Análises', icon: FileBarChart, path: '/?relatorio=1', keywords: 'pdf relatorio gerencial' },
  { id: 'qa-fluxo-caixa', label: 'Ver Fluxo de Caixa', hint: 'Financeiro', icon: LineChart, path: '/financeiro/fluxo_caixa', keywords: 'fluxo caixa entradas saidas' },
  { id: 'qa-dre', label: 'Ver DRE', hint: 'Financeiro', icon: FileBarChart, path: '/financeiro/dre', keywords: 'dre demonstrativo resultado' },
];

// Mapeia ícones do hub do Financeiro para o command palette global
type FinEntry = { id: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>; path: string; keywords: string };

const FIN_ENTRIES: FinEntry[] = HUB_ITEMS.map((i) => ({
  id: `fin-${i.id}`,
  label: i.label,
  description: i.description,
  icon: i.icon,
  path: `/financeiro/${i.id}`,
  keywords: `financeiro ${i.group} ${i.label} ${i.description}`,
}));

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [marca, setMarca] = useState<ItemMarca[] | null>(null);

  // Busca o catálogo da marca uma vez, na primeira abertura da lupa.
  useEffect(() => {
    if (!open || marca !== null) return;
    let vivo = true;
    supabase
      .from('identidade_visual' as never)
      .select('slug, categoria, nome, descricao, uso, url, valor, palavras_chave')
      .order('categoria')
      .then(({ data }) => {
        if (vivo) setMarca((data ?? []) as unknown as ItemMarca[]);
      });
    return () => {
      vivo = false;
    };
  }, [open, marca]);

  const usarItemMarca = useCallback((item: ItemMarca) => {
    setOpen(false);
    if (item.categoria === 'logo' && item.url) {
      window.open(item.url, '_blank', 'noopener');
      return;
    }
    const texto = item.valor ?? item.descricao ?? item.nome;
    navigator.clipboard?.writeText(texto).then(
      () => toast.success(`${item.nome} — copiado`, { description: texto }),
      () => toast(item.nome, { description: texto }),
    );
  }, []);

  // A lupa da barra superior abre a mesma busca do Ctrl+K: o atalho era o
  // ÚNICO gatilho e ninguém descobre atalho sem placa (pedido de 12/09).
  useEffect(() => {
    const abrir = () => setOpen(true);
    window.addEventListener('praefectus:abrir-busca', abrir);
    return () => window.removeEventListener('praefectus:abrir-busca', abrir);
  }, []);
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

  /** Linha da paleta: 40px, ícone de 16px, rótulo em 13px e a dica à direita em 12px. */
  const classeDoItem = 'min-h-10 cursor-pointer gap-3 px-2.5';

  return (
    /* A paleta é montada com os primitivos (`Dialog` + `Command`) em vez do
       `CommandDialog`, que fixa `max-w-xl`: o Design System v3 quer a busca
       colada ao topo, na largura toda do celular e em 672px no desktop. O
       título existe só para o leitor de tela — visualmente a paleta é o campo. */
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[8%] translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12%] sm:max-w-2xl data-[state=open]:slide-in-from-top-2"
      >
        <DialogTitle className="sr-only">Buscar no sistema</DialogTitle>
        <Command className="[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0">
          <CommandInput
            placeholder="Buscar módulo, página ou ação rápida... (Ctrl+K)"
            className="h-12 pr-10"
          />
          <CommandList className="max-h-[min(60vh,440px)]">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            <CommandGroup heading="Ações rápidas">
              {QUICK_ACTIONS.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.hint} ${a.keywords}`}
                  onSelect={() => handleSelect(a.path)}
                  className={classeDoItem}
                >
                  <a.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.hint}</span>
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
                  className={classeDoItem}
                >
                  <page.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{page.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {marca && marca.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Identidade visual">
                  {marca.map((item) => {
                    const Icone = ICONE_MARCA[item.categoria] ?? ImageIcon;
                    return (
                      <CommandItem
                        key={item.slug}
                        value={`${item.nome} ${item.categoria} ${item.palavras_chave.join(' ')} ${item.valor ?? ''}`}
                        onSelect={() => usarItemMarca(item)}
                        className={classeDoItem}
                      >
                        {item.categoria === 'cor' && item.valor ? (
                          /* A amostra é a cor cadastrada no catálogo da marca —
                             dado do banco, não cor escrita à mão. */
                          <span
                            className="h-4 w-4 shrink-0 rounded-sm border border-border"
                            style={{ backgroundColor: item.valor }}
                            aria-hidden="true"
                          />
                        ) : (
                          <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{item.nome}</span>
                        <span className="max-w-[200px] shrink-0 truncate text-xs text-muted-foreground">
                          {item.categoria === 'logo' ? 'abrir arquivo' : `copiar ${item.valor ?? ''}`}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />

            <CommandGroup heading="Financeiro — Módulos">
              {FIN_ENTRIES.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.label} ${f.keywords}`}
                  onSelect={() => handleSelect(f.path)}
                  className={classeDoItem}
                >
                  <f.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  <span className="max-w-[180px] shrink-0 truncate text-xs text-muted-foreground">{f.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
