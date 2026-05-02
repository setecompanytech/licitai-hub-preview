import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, LayoutDashboard, ListOrdered, Wallet, Users, Tags, Banknote, ArrowDownCircle, ArrowUpCircle,
  FolderTree, LineChart, FileBarChart, Briefcase, ScanLine, Plug, FileText, Inbox, BookOpen, Scale, Target,
  FileDown, Calculator, Eye, ArrowRightLeft, Upload, CheckCheck, FileSpreadsheet, ShieldCheck, Receipt,
  Building2, Sparkles, Activity, QrCode, History, Landmark, CalendarDays, Star, Clock4, Plus, Zap,
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumoVisorFinanceiro } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";

export type HubItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "operacao" | "bancos" | "relatorios" | "cadastros" | "fiscal";
  badge?: string;
  highlight?: boolean;
};

export const HUB_ITEMS: HubItem[] = [
  // Operação diária
  { id: "panorama", label: "Painel", description: "Visão geral, KPIs CFO/Executivo/Operacional, projeção e atrasos — tudo em um só lugar.", icon: Eye, group: "operacao", highlight: true, badge: "Unificado" },
  { id: "calendario_financeiro", label: "Calendário Financeiro", description: "Calendário dinâmico de pagamentos e recebimentos com saldo proporcional por dia.", icon: CalendarDays, group: "operacao", badge: "Novo" },
  { id: "quadro_omie", label: "Quadro Financeiro", description: "Visão estilo Omie com 9 cards de operação consolidados.", icon: LayoutDashboard, group: "operacao" },
  { id: "lancamentos", label: "Lançamentos", description: "Todos os lançamentos com filtros avançados.", icon: ListOrdered, group: "operacao" },
  { id: "a_pagar", label: "Contas a Pagar", description: "Pendências, vencimentos e baixa em lote.", icon: ArrowUpCircle, group: "operacao" },
  { id: "a_receber", label: "Contas a Receber", description: "Cobranças, recebimentos e inadimplência.", icon: ArrowDownCircle, group: "operacao" },
  { id: "baixa_lote", label: "Baixa em lote", description: "Liquide múltiplos lançamentos com 1 clique.", icon: Sparkles, group: "operacao", badge: "Novo" },
  { id: "importar_planilha", label: "Importar Planilha", description: "Importação em massa via CSV.", icon: FileSpreadsheet, group: "operacao", badge: "Novo" },
  { id: "fluxo_caixa", label: "Fluxo de Caixa", description: "Entradas, saídas e saldo projetado.", icon: LineChart, group: "operacao" },

  // Bancos
  { id: "contas", label: "Contas Correntes", description: "Saldos consolidados e movimentações.", icon: Wallet, group: "bancos" },
  { id: "conciliacao", label: "Conciliação", description: "Concilie extratos com lançamentos do sistema.", icon: Banknote, group: "bancos" },
  { id: "transferencia", label: "Transferência entre contas", description: "Movimente saldo entre contas correntes.", icon: ArrowRightLeft, group: "bancos", badge: "Novo" },
  { id: "importar_ofx", label: "Importar Extrato OFX", description: "Conciliação sugerida automaticamente.", icon: Upload, group: "bancos", badge: "Novo" },
  { id: "cnab", label: "Remessa & Retorno CNAB", description: "Cobrança 240 + pagamentos em massa.", icon: FileSpreadsheet, group: "bancos", badge: "Novo" },
  { id: "integracoes", label: "Integrações Bancárias", description: "Histórico de transmissões e webhooks.", icon: Plug, group: "bancos" },
  { id: "open_finance", label: "Open Finance", description: "Conexões bancárias automáticas (Pluggy/Belvo) com sincronização programada.", icon: Plug, group: "bancos", badge: "Novo" },
  { id: "auditoria_conciliacao", label: "Auditoria de Conciliação", description: "Histórico reversível de matches automáticos e IA com 1-clique para reverter.", icon: History, group: "bancos", badge: "Fase 3" },

  // Fiscal
  { id: "emissor_nfe", label: "Emissor NF-e", description: "Emissão homologada SEFAZ schema 4.00.", icon: FileText, group: "fiscal" },
  { id: "nfe_entrada", label: "NF-e Entrada", description: "Consulta e download de XML por chave.", icon: Inbox, group: "fiscal" },
  { id: "nfse", label: "NFS-e Municipal", description: "Monitor e emissão multi-prefeitura.", icon: Building2, group: "fiscal", badge: "Novo" },
  { id: "config_nfe", label: "Configuração NF-e", description: "Provedor (FocusNFe / NFe.io / SEFAZ direto), ambiente e credenciais por empresa.", icon: ShieldCheck, group: "fiscal", badge: "Novo" },
  { id: "pix_cobranca", label: "Cobrança PIX", description: "Gera BR Code (Pix Copia e Cola) e QR Code conforme padrão BACEN.", icon: QrCode, group: "fiscal", badge: "Novo" },
  { id: "ocr", label: "OCR de Documentos", description: "Extraia dados de notas e boletos via IA.", icon: ScanLine, group: "fiscal" },
  { id: "integracoes_fiscais", label: "Integrações Fiscais", description: "SEFAZ por CNPJ, SPED, ECF, ECD, DCTFWeb e apuração de impostos consolidada.", icon: Landmark, group: "fiscal", badge: "Fase 5" },

  // Relatórios
  { id: "dre", label: "DRE", description: "Demonstrativo de Resultados completo.", icon: FileBarChart, group: "relatorios" },
  { id: "demonstracoes", label: "Demonstrações Contábeis", description: "Balanço Patrimonial, DFC Indireta e DMPL conforme NBC TG 26/03.", icon: Scale, group: "relatorios", badge: "Novo" },
  { id: "resumo_exec", label: "Resumo Executivo", description: "One-pager imprimível com CP, CR e contas correntes detalhadas.", icon: Sparkles, group: "relatorios", badge: "Novo" },
  { id: "atividade_usuarios", label: "Atividade dos Usuários", description: "Auditoria cronológica por usuário, data e tipo (modelo Omie).", icon: Activity, group: "relatorios", badge: "Novo" },
  { id: "previsto_realizado", label: "Previsto × Realizado", description: "Compare orçamento com execução mensal.", icon: Target, group: "relatorios", badge: "Novo" },
  { id: "relatorios", label: "Relatórios", description: "Exportações personalizadas em PDF/Excel.", icon: FileDown, group: "relatorios" },
  { id: "apuracao", label: "Apuração", description: "Apuração de impostos e tributos.", icon: Calculator, group: "relatorios" },
  { id: "aprovacoes", label: "Aprovação de Pagamentos", description: "Workflow multi-nível com alçada por valor.", icon: ShieldCheck, group: "relatorios", badge: "Novo" },
  { id: "calc_margem", label: "Calculadora de Margem", description: "Sugere margem % ideal a partir dos lançamentos reais e do regime tributário.", icon: Calculator, group: "relatorios", badge: "Novo" },

  // Cadastros
  { id: "pessoas", label: "Clientes & Fornecedores", description: "Cadastro unificado com integração Receita.", icon: Users, group: "cadastros" },
  { id: "categorias", label: "Categorias", description: "Categorias de receita e despesa.", icon: Tags, group: "cadastros" },
  { id: "centros_custo", label: "Centros de Custo", description: "Departamentos, projetos e rateios.", icon: FolderTree, group: "cadastros" },
  { id: "plano_contas", label: "Plano de Contas", description: "Estrutura contábil hierárquica.", icon: BookOpen, group: "cadastros" },
  { id: "plano_contas_padrao", label: "Plano de Contas Padrão", description: "Importe 31 contas pré-configuradas e personalize por empresa.", icon: Sparkles, group: "cadastros", badge: "Fase 4" },
  { id: "saldos_abertura", label: "Saldos de Abertura", description: "Saldos iniciais por conta.", icon: Scale, group: "cadastros" },
  { id: "orcamento", label: "Orçamento", description: "Planejamento orçamentário anual.", icon: Target, group: "cadastros" },
  { id: "folha", label: "Folha de Pagamento", description: "Provisões e lançamentos da folha.", icon: Briefcase, group: "cadastros" },
  { id: "comissoes", label: "Comissões de Vendas", description: "Cálculo e quitação de comissões.", icon: Receipt, group: "cadastros" },
];

const GROUPS = [
  { id: "operacao", label: "Operação Diária", description: "O que você usa todos os dias", color: "from-primary/10 to-primary/5", iconColor: "text-primary" },
  { id: "bancos", label: "Bancos & Conciliação", description: "Integração com instituições financeiras", color: "from-blue-500/10 to-blue-500/5", iconColor: "text-blue-500" },
  { id: "fiscal", label: "Fiscal & Documentos", description: "Notas, boletos e fiscalização", color: "from-amber-500/10 to-amber-500/5", iconColor: "text-amber-500" },
  { id: "relatorios", label: "Análises & Relatórios", description: "Visão consolidada do negócio", color: "from-emerald-500/10 to-emerald-500/5", iconColor: "text-emerald-500" },
  { id: "cadastros", label: "Cadastros & Configuração", description: "Estrutura base do financeiro", color: "from-muted to-muted/50", iconColor: "text-muted-foreground" },
] as const;

const QUICK_ACTIONS: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "lancamentos", label: "Novo Lançamento", icon: Plus },
  { id: "conciliacao", label: "Conciliar", icon: CheckCheck },
  { id: "importar_ofx", label: "Importar OFX", icon: Upload },
  { id: "emissor_nfe", label: "Emitir NF-e", icon: FileText },
  { id: "pix_cobranca", label: "Cobrança PIX", icon: QrCode },
];

const FAVORITES_KEY = "fin_hub_favorites_v1";
const RECENTS_KEY = "fin_hub_recents_v1";
const MAX_RECENTS = 6;

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
function saveList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* noop */ }
}

interface FinHomeHubProps {
  onNavigate: (tabId: string) => void;
}

export default function FinHomeHub({ onNavigate }: FinHomeHubProps) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>(() => loadList(FAVORITES_KEY));
  const [recents, setRecents] = useState<string[]>(() => loadList(RECENTS_KEY));
  const [hoverPos, setHoverPos] = useState<Record<string, { x: number; y: number }>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: resumo, isLoading: loadingResumo } = useResumoVisorFinanceiro();

  // Atalho `/` foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNavigate = useCallback((id: string) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENTS);
      saveList(RECENTS_KEY, next);
      return next;
    });
    onNavigate(id);
  }, [onNavigate]);

  const toggleFavorite = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveList(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return HUB_ITEMS.filter((i) => {
      const matchGroup = activeGroup === "all" || i.group === activeGroup;
      const matchQ = !q || i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
      return matchGroup && matchQ;
    });
  }, [search, activeGroup]);

  const grouped = useMemo(() => {
    const map = new Map<string, HubItem[]>();
    filtered.forEach((item) => {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    });
    return map;
  }, [filtered]);

  const favoriteItems = useMemo(
    () => favorites.map((id) => HUB_ITEMS.find((i) => i.id === id)).filter(Boolean) as HubItem[],
    [favorites],
  );
  const recentItems = useMemo(
    () => recents.map((id) => HUB_ITEMS.find((i) => i.id === id)).filter(Boolean) as HubItem[],
    [recents],
  );

  // KPIs vivos
  const kpis = useMemo(() => {
    if (!resumo) return null;
    return {
      saldo: resumo.saldoTotal,
      pagar: resumo.hojePagar.total,
      pagarQtd: resumo.hojePagar.qtd,
      receber: resumo.hojeReceber.total,
      receberQtd: resumo.hojeReceber.qtd,
      atrasoPagar: resumo.hojePagar.atraso,
      atrasoReceber: resumo.hojeReceber.atraso,
    };
  }, [resumo]);

  const renderCard = (item: HubItem, idx: number) => {
    const Icon = item.icon;
    const isFav = favorites.includes(item.id);
    const groupColor = GROUPS.find((g) => g.id === item.group)?.iconColor ?? "text-primary";
    const pos = hoverPos[item.id];
    return (
      <Card
        key={item.id}
        onClick={() => handleNavigate(item.id)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHoverPos((p) => ({ ...p, [item.id]: { x: e.clientX - r.left, y: e.clientY - r.top } }));
        }}
        onMouseLeave={() => setHoverPos((p) => { const n = { ...p }; delete n[item.id]; return n; })}
        className={cn(
          "group relative cursor-pointer overflow-hidden border-border/60 transition-all duration-300",
          "hover:shadow-lg hover:-translate-y-1 hover:border-primary/50",
          "animate-in fade-in slide-in-from-bottom-2",
          item.highlight && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
        )}
        style={{ animationDelay: `${Math.min(idx * 30, 400)}ms`, animationFillMode: "backwards" }}
      >
        {/* Spotlight no mouse */}
        {pos && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(280px circle at ${pos.x}px ${pos.y}px, hsl(var(--primary) / 0.10), transparent 60%)`,
            }}
          />
        )}
        {/* Estrela favorito */}
        <button
          type="button"
          onClick={(e) => toggleFavorite(e, item.id)}
          className={cn(
            "absolute right-2 top-2 z-10 p-1 rounded-md transition-all",
            "opacity-0 group-hover:opacity-100 hover:bg-primary/10",
            isFav && "opacity-100",
          )}
          aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star className={cn("w-3.5 h-3.5", isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
        </button>

        <CardContent className="p-4 flex items-start gap-3 relative">
          <div
            className={cn(
              "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300",
              "group-hover:scale-110 group-hover:rotate-3",
              item.highlight
                ? "bg-primary/15 text-primary"
                : cn("bg-muted", groupColor, "group-hover:bg-primary/10 group-hover:text-primary"),
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 pr-5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm leading-tight">{item.label}</h3>
              {item.badge && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4 shrink-0",
                    (item.badge === "Novo" || item.badge.startsWith("Fase")) &&
                      "bg-primary/10 text-primary border-primary/20",
                  )}
                >
                  {item.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
            <div className="flex items-center gap-1 mt-2 text-[11px] text-primary opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
              Acessar <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* ============ KPIs vivos ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          loading={loadingResumo}
          icon={Wallet}
          label="Saldo consolidado"
          value={kpis ? formatBRL(kpis.saldo) : "—"}
          tone="neutral"
          onClick={() => handleNavigate("contas")}
        />
        <KpiTile
          loading={loadingResumo}
          icon={ArrowDownCircle}
          label={`Receber hoje${kpis?.receberQtd ? ` (${kpis.receberQtd})` : ""}`}
          value={kpis ? formatBRL(kpis.receber) : "—"}
          sub={kpis && kpis.atrasoReceber > 0 ? `Em atraso: ${formatBRL(kpis.atrasoReceber)}` : undefined}
          tone="positive"
          onClick={() => handleNavigate("a_receber")}
        />
        <KpiTile
          loading={loadingResumo}
          icon={ArrowUpCircle}
          label={`Pagar hoje${kpis?.pagarQtd ? ` (${kpis.pagarQtd})` : ""}`}
          value={kpis ? formatBRL(kpis.pagar) : "—"}
          sub={kpis && kpis.atrasoPagar > 0 ? `Em atraso: ${formatBRL(kpis.atrasoPagar)}` : undefined}
          tone="negative"
          onClick={() => handleNavigate("a_pagar")}
        />
        <KpiTile
          loading={loadingResumo}
          icon={AlertTriangle}
          label="Atrasos totais"
          value={kpis ? formatBRL(kpis.atrasoPagar + kpis.atrasoReceber) : "—"}
          tone={kpis && (kpis.atrasoPagar + kpis.atrasoReceber) > 0 ? "warning" : "neutral"}
          onClick={() => handleNavigate("panorama")}
        />
      </div>

      {/* ============ Atalhos rápidos ============ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
          <Zap className="w-3.5 h-3.5 text-primary" /> Atalhos:
        </div>
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.id}
              size="sm"
              variant="outline"
              onClick={() => handleNavigate(a.id)}
              className="h-8 text-xs hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {a.label}
            </Button>
          );
        })}
      </div>

      {/* ============ Busca + filtros por categoria ============ */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar funcionalidade... (pressione / para focar)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-16 h-11 text-sm"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
            /
          </kbd>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CategoryChip active={activeGroup === "all"} onClick={() => setActiveGroup("all")} count={HUB_ITEMS.length}>
            Todos
          </CategoryChip>
          {GROUPS.map((g) => (
            <CategoryChip
              key={g.id}
              active={activeGroup === g.id}
              onClick={() => setActiveGroup(g.id)}
              count={HUB_ITEMS.filter((i) => i.group === g.id).length}
            >
              {g.label}
            </CategoryChip>
          ))}
        </div>
      </div>

      {/* ============ Favoritos ============ */}
      {favoriteItems.length > 0 && !search && activeGroup === "all" && (
        <section className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <h2 className="text-sm font-semibold">Favoritos</h2>
            <span className="text-xs text-muted-foreground">({favoriteItems.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {favoriteItems.map((item, idx) => renderCard(item, idx))}
          </div>
        </section>
      )}

      {/* ============ Recentes ============ */}
      {recentItems.length > 0 && !search && activeGroup === "all" && (
        <section className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Clock4 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Acessados recentemente</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-card text-xs hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ Grupos ============ */}
      {GROUPS.map((group) => {
        const items = grouped.get(group.id);
        if (!items?.length) return null;
        return (
          <section key={group.id} className="space-y-3">
            <div className={cn("rounded-lg p-4 bg-gradient-to-r border border-border/60", group.color)}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">{group.label}</h2>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                <Badge variant="outline" className="text-[10px] bg-background/60">
                  {items.length} {items.length === 1 ? "módulo" : "módulos"}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map((item, idx) => renderCard(item, idx))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <Search className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p>Nenhuma funcionalidade encontrada para "{search}".</p>
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveGroup("all"); }}>
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

function CategoryChip({
  active, onClick, count, children,
}: { active: boolean; onClick: () => void; count: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
      <span className={cn("px-1.5 py-0 rounded text-[10px]", active ? "bg-primary-foreground/20" : "bg-muted")}>
        {count}
      </span>
    </button>
  );
}

function KpiTile({
  loading, icon: Icon, label, value, sub, tone, onClick,
}: {
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: "neutral" | "positive" | "negative" | "warning";
  onClick?: () => void;
}) {
  const toneClasses = {
    neutral: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    warning: "text-amber-600 dark:text-amber-400",
  };
  const ringClasses = {
    neutral: "hover:border-primary/40",
    positive: "hover:border-emerald-500/40",
    negative: "hover:border-rose-500/40",
    warning: "hover:border-amber-500/40",
  };
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-border/60",
        ringClasses[tone],
      )}
    >
      <CardContent className="p-3.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
          <Icon className={cn("w-4 h-4 shrink-0", toneClasses[tone])} />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-3/4" />
        ) : (
          <div className={cn("text-xl font-semibold tabular-nums tracking-tight", toneClasses[tone])}>
            {value}
          </div>
        )}
        {sub && !loading && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400 truncate">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}
