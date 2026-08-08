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
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Command, ChevronRight, Bell, Pin, PinOff,
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
  { id: "pedidos_faturar", label: "Pedidos a Faturar", description: "Pedidos de contratos aguardando faturamento — ao faturar, lança automaticamente em Contas a Receber.", icon: Receipt, group: "operacao", highlight: true, badge: "Novo" },
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
  { id: "lotes_auditoria", label: "Auditoria de Lotes", description: "Rastreabilidade da origem dos dados (seed, importação, OFX, Pluggy, manual).", icon: History, group: "relatorios", badge: "Novo" },
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
  { id: "operacao", label: "Operação Diária", short: "Operação", description: "Lançamentos, contas, fluxo de caixa", icon: Zap, accent: "primary" },
  { id: "bancos", label: "Bancos & Conciliação", short: "Bancos", description: "Contas correntes, OFX, Open Finance", icon: Banknote, accent: "blue" },
  { id: "fiscal", label: "Fiscal & Documentos", short: "Fiscal", description: "NF-e, NFS-e, PIX, OCR", icon: FileText, accent: "amber" },
  { id: "relatorios", label: "Análises & Relatórios", short: "Análises", description: "DRE, dashboards, aprovações", icon: FileBarChart, accent: "emerald" },
  { id: "cadastros", label: "Cadastros & Configuração", short: "Cadastros", description: "Pessoas, categorias, plano de contas", icon: FolderTree, accent: "muted" },
] as const;

const ACCENT_MAP: Record<string, { icon: string; bg: string; ring: string; bar: string }> = {
  primary: { icon: "text-muted-foreground", bg: "bg-muted", ring: "ring-border", bar: "bg-muted-foreground/40" },
  blue: { icon: "text-muted-foreground", bg: "bg-muted", ring: "ring-border", bar: "bg-muted-foreground/40" },
  amber: { icon: "text-muted-foreground", bg: "bg-muted", ring: "ring-border", bar: "bg-muted-foreground/40" },
  emerald: { icon: "text-muted-foreground", bg: "bg-muted", ring: "ring-border", bar: "bg-muted-foreground/40" },
  muted: { icon: "text-muted-foreground", bg: "bg-muted", ring: "ring-border", bar: "bg-muted-foreground/40" },
};

const QUICK_ACTIONS: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }>; primary?: boolean }> = [
  { id: "lancamentos", label: "Novo Lançamento", icon: Plus, primary: true },
  { id: "conciliacao", label: "Conciliar", icon: CheckCheck },
  { id: "importar_ofx", label: "Importar OFX", icon: Upload },
  { id: "emissor_nfe", label: "Emitir NF-e", icon: FileText },
  { id: "pix_cobranca", label: "Cobrança PIX", icon: QrCode },
  { id: "baixa_lote", label: "Baixa em lote", icon: Sparkles },
];

const FAVORITES_KEY = "fin_hub_favorites_v2";
const RECENTS_KEY = "fin_hub_recents_v2";
const MAX_RECENTS = 8;

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
      atrasoTotal: resumo.hojePagar.atraso + resumo.hojeReceber.atraso,
      saldoProjetado: resumo.saldoTotal + resumo.hojeReceber.total - resumo.hojePagar.total,
    };
  }, [resumo]);

  return (
    <div className="space-y-5">
      {/* ============ HERO COMMAND CENTER ============ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.08] via-card to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-muted blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-muted/50 blur-3xl"
        />
        <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-6 p-5 md:p-6">
          {/* Saldo destaque */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                Saldo consolidado em tempo real
              </div>
            </div>
            <div className="space-y-1">
              {loadingResumo ? (
                <Skeleton className="h-12 w-72" />
              ) : (
                <h2 className="text-4xl md:text-5xl font-semibold tabular-nums tracking-tight">
                  {kpis ? formatBRL(kpis.saldo) : "—"}
                </h2>
              )}
              {kpis && !loadingResumo && (
                <p className="text-xs text-muted-foreground">
                  Projetado para hoje:{" "}
                  <span className={cn(
                    "font-medium tabular-nums",
                    kpis.saldoProjetado >= kpis.saldo ? "text-success" : "text-destructive",
                  )}>
                    {formatBRL(kpis.saldoProjetado)}
                  </span>
                  {kpis.saldoProjetado >= kpis.saldo
                    ? <TrendingUp className="inline w-3 h-3 ml-1 text-success" />
                    : <TrendingDown className="inline w-3 h-3 ml-1 text-destructive" />}
                </p>
              )}
            </div>

            {/* Linha de ações primárias */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Button
                    key={a.id}
                    size="sm"
                    variant={a.primary ? "default" : "outline"}
                    onClick={() => handleNavigate(a.id)}
                    className={cn(
                      "h-8 text-xs gap-1.5 transition-all hover:-translate-y-0.5",
                      a.primary && "shadow-sm shadow-primary/20",
                      !a.primary && "bg-card/60 backdrop-blur hover:border-primary/40 hover:text-primary hover:bg-primary/5",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {a.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Mini KPIs lateral */}
          <div className="grid grid-cols-2 gap-3 self-center">
            <MiniMetric
              loading={loadingResumo}
              icon={ArrowDownCircle}
              label={`Receber hoje${kpis?.receberQtd ? ` (${kpis.receberQtd})` : ""}`}
              value={kpis ? formatBRL(kpis.receber) : "—"}
              tone="positive"
              onClick={() => handleNavigate("a_receber")}
            />
            <MiniMetric
              loading={loadingResumo}
              icon={ArrowUpCircle}
              label={`Pagar hoje${kpis?.pagarQtd ? ` (${kpis.pagarQtd})` : ""}`}
              value={kpis ? formatBRL(kpis.pagar) : "—"}
              tone="negative"
              onClick={() => handleNavigate("a_pagar")}
            />
            <MiniMetric
              loading={loadingResumo}
              icon={AlertTriangle}
              label="Atrasos totais"
              value={kpis ? formatBRL(kpis.atrasoTotal) : "—"}
              tone={kpis && kpis.atrasoTotal > 0 ? "warning" : "neutral"}
              onClick={() => handleNavigate("panorama")}
            />
            <MiniMetric
              loading={loadingResumo}
              icon={Activity}
              label="Painel completo"
              value="Abrir"
              tone="neutral"
              isAction
              onClick={() => handleNavigate("panorama")}
            />
          </div>
        </div>
      </div>

      {/* ============ Alerta de atrasos (contextual) ============ */}
      {kpis && kpis.atrasoTotal > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 w-7 h-7 rounded-full bg-warning/15 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-warning" />
            </div>
            <div className="text-xs min-w-0">
              <span className="font-medium text-warning">Há lançamentos em atraso.</span>{" "}
              <span className="text-muted-foreground">
                {formatBRL(kpis.atrasoPagar)} a pagar e {formatBRL(kpis.atrasoReceber)} a receber.
              </span>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => handleNavigate("panorama")}>
            Resolver <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* ============ Busca + Command palette hint ============ */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Buscar funcionalidade... (ex: conciliação, NF-e, comissão)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 pr-28 h-12 text-sm bg-card border-border/60 shadow-sm focus-visible:ring-primary/30"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5">
          <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
          <span className="text-xs text-muted-foreground">ou</span>
          <kbd className="inline-flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
            /
          </kbd>
        </div>
      </div>

      {/* ============ Layout 2 colunas: Sidebar categorias + conteúdo ============ */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        {/* Sidebar de categorias */}
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
            Categorias
          </div>
          <NavChip
            label="Todos os módulos"
            icon={LayoutDashboard}
            count={HUB_ITEMS.length}
            active={activeGroup === "all"}
            onClick={() => setActiveGroup("all")}
            accent="primary"
          />
          {GROUPS.map((g) => (
            <NavChip
              key={g.id}
              label={g.label}
              icon={g.icon}
              count={HUB_ITEMS.filter((i) => i.group === g.id).length}
              active={activeGroup === g.id}
              onClick={() => setActiveGroup(g.id)}
              accent={g.accent}
            />
          ))}

          {/* Stats lateral */}
          <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              Resumo
            </div>
            <div className="px-2 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Favoritos</span>
                <span className="font-medium tabular-nums">{favorites.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Acessos recentes</span>
                <span className="font-medium tabular-nums">{recents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total de módulos</span>
                <span className="font-medium tabular-nums">{HUB_ITEMS.length}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="space-y-6 min-w-0">
          {/* Favoritos */}
          {favoriteItems.length > 0 && !search && activeGroup === "all" && (
            <SectionBlock
              title="Favoritos"
              subtitle="Pinados por você"
              icon={Star}
              iconClass="fill-muted-foreground text-muted-foreground"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {favoriteItems.map((item, idx) => (
                  <ModuleRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    isFav
                    onNavigate={handleNavigate}
                    onToggleFav={toggleFavorite}
                  />
                ))}
              </div>
            </SectionBlock>
          )}

          {/* Recentes (chips horizontais) */}
          {recentItems.length > 0 && !search && activeGroup === "all" && (
            <SectionBlock
              title="Acessados recentemente"
              icon={Clock4}
              iconClass="text-muted-foreground"
            >
              <div className="flex flex-wrap gap-1.5">
                {recentItems.map((item) => {
                  const Icon = item.icon;
                  const accent = ACCENT_MAP[GROUPS.find((g) => g.id === item.group)?.accent ?? "primary"];
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className="group inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-xs"
                    >
                      <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-full", accent.bg)}>
                        <Icon className={cn("w-3 h-3", accent.icon)} />
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </SectionBlock>
          )}

          {/* Grupos */}
          {GROUPS.map((group) => {
            const items = grouped.get(group.id);
            if (!items?.length) return null;
            const accent = ACCENT_MAP[group.accent];
            const GroupIcon = group.icon;
            return (
              <SectionBlock
                key={group.id}
                title={group.label}
                subtitle={group.description}
                icon={GroupIcon}
                iconClass={accent.icon}
                accentBar={accent.bar}
                count={items.length}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {items.map((item, idx) => (
                    <ModuleRow
                      key={item.id}
                      item={item}
                      idx={idx}
                      isFav={favorites.includes(item.id)}
                      onNavigate={handleNavigate}
                      onToggleFav={toggleFavorite}
                    />
                  ))}
                </div>
              </SectionBlock>
            );
          })}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
                <Search className="w-8 h-8 mx-auto text-muted-foreground" />
                <p>Nenhuma funcionalidade encontrada para "{search}".</p>
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveGroup("all"); }}>
                  Limpar filtros
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

function NavChip({
  label, icon: Icon, count, active, onClick, accent,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all group relative",
        active
          ? "bg-primary/10 text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r", a.bar)} />}
      <span className={cn(
        "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md transition-all",
        active ? a.bg : "bg-transparent group-hover:bg-muted-foreground/10",
      )}>
        <Icon className={cn("w-3.5 h-3.5", active ? a.icon : "")} />
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      <span className={cn(
        "shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded",
        active ? "bg-background text-foreground" : "bg-muted text-muted-foreground",
      )}>
        {count}
      </span>
    </button>
  );
}

function SectionBlock({
  title, subtitle, icon: Icon, iconClass, accentBar, count, children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  accentBar?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 animate-in fade-in slide-in-from-bottom-1">
      <div className="flex items-center gap-2.5">
        {accentBar && <span className={cn("w-1 h-5 rounded-full", accentBar)} />}
        <Icon className={cn("w-4 h-4", iconClass)} />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground hidden sm:inline">— {subtitle}</span>}
        {typeof count === "number" && (
          <Badge variant="outline" className="ml-auto text-xs h-5 px-1.5 bg-card">
            {count}
          </Badge>
        )}
      </div>
      {children}
    </section>
  );
}

function ModuleRow({
  item, idx, isFav, onNavigate, onToggleFav,
}: {
  item: HubItem;
  idx: number;
  isFav: boolean;
  onNavigate: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}) {
  const Icon = item.icon;
  const accent = ACCENT_MAP[GROUPS.find((g) => g.id === item.group)?.accent ?? "primary"];
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group relative w-full text-left flex items-center gap-3 p-2.5 pr-2 rounded-xl border bg-card transition-all duration-200",
        "hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5 hover:bg-card",
        "animate-in fade-in",
        item.highlight ? "border-primary/40 ring-1 ring-primary/15" : "border-border/60",
      )}
      style={{ animationDelay: `${Math.min(idx * 20, 240)}ms`, animationFillMode: "backwards" }}
    >
      {/* Accent bar à esquerda */}
      <span className={cn(
        "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity",
        accent.bar,
      )} />

      <div className={cn(
        "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200",
        "group-hover:scale-105",
        item.highlight ? "bg-muted text-foreground" : cn(accent.bg, accent.icon),
      )}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm leading-tight truncate">{item.label}</span>
          {item.badge && (
            <Badge
              variant="secondary"
              className={cn(
                "text-xs px-1.5 py-0 h-4 shrink-0 font-medium",
                (item.badge === "Novo" || item.badge.startsWith("Fase")) &&
                  "bg-foreground text-background border-transparent hover:bg-foreground/90",
              )}
            >
              {item.badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
      </div>

      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onToggleFav(e as any, item.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onToggleFav(e as any, item.id); }}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label={isFav ? "Remover dos favoritos" : "Fixar nos favoritos"}
        >
          {isFav
            ? <Pin className="w-3.5 h-3.5 fill-accent text-accent" />
            : <Pin className="w-3.5 h-3.5 text-muted-foreground" />}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Pin sempre visível se favorito */}
      {isFav && (
        <span className="absolute top-1.5 right-1.5 group-hover:opacity-0 transition-opacity">
          <Pin className="w-3 h-3 fill-accent text-accent" />
        </span>
      )}
    </button>
  );
}

function MiniMetric({
  loading, icon: Icon, label, value, tone, onClick, isAction,
}: {
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "neutral" | "positive" | "negative" | "warning";
  onClick?: () => void;
  isAction?: boolean;
}) {
  const toneText = {
    neutral: "text-foreground",
    positive: "text-success",
    negative: "text-destructive",
    warning: "text-warning",
  }[tone];
  const toneBg = {
    neutral: "bg-muted",
    positive: "bg-success/10",
    negative: "bg-destructive/10",
    warning: "bg-warning/10",
  }[tone];
  const toneBorder = {
    neutral: "hover:border-primary/40",
    positive: "hover:border-success/40",
    negative: "hover:border-destructive/40",
    warning: "border-warning/40 hover:border-warning/60",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border bg-card/80 backdrop-blur-sm p-3 transition-all duration-200",
        "hover:shadow-sm hover:-translate-y-0.5",
        toneBorder,
        tone === "warning" ? "border-warning/40" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </span>
        <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md", toneBg)}>
          <Icon className={cn("w-3.5 h-3.5", toneText)} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-3/4" />
      ) : (
        <div className={cn(
          "font-semibold tabular-nums tracking-tight",
          isAction ? "text-sm text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1" : "text-lg",
          !isAction && toneText,
        )}>
          {value}
          {isAction && <ArrowRight className="w-3.5 h-3.5" />}
        </div>
      )}
    </button>
  );
}
