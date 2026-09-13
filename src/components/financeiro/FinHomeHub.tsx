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
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Command, ChevronRight, Bell, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumoVisorFinanceiro } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";
import EstadoVazio from "@/components/shared/EstadoVazio";
import FinConferencia from "./FinConferencia";

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
  { id: "nfe_entrada", label: "NF-e Recebidas", description: "Notas emitidas contra o CNPJ da empresa: acervo automático, XML, manifestação e Conta a Pagar em 1 clique.", icon: Inbox, group: "fiscal" },
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
  { id: "custos_contratos", label: "Custos por Contrato", description: "O que cada contrato vigente custa: despesas vinculadas, custos digitados e rateio opcional. Acesso: admin e Financeiro.", icon: Briefcase, group: "relatorios", badge: "Novo" },
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
  { id: "comissoes", label: "Bonificações de Vendas", description: "Cálculo e quitação de bonificações.", icon: Receipt, group: "cadastros" },
];

const GROUPS = [
  { id: "operacao", label: "Operação Diária", short: "Operação", description: "Lançamentos, contas, fluxo de caixa", icon: Zap },
  { id: "bancos", label: "Bancos & Conciliação", short: "Bancos", description: "Contas correntes, OFX, Open Finance", icon: Banknote },
  { id: "fiscal", label: "Fiscal & Documentos", short: "Fiscal", description: "NF-e, NFS-e, PIX, OCR", icon: FileText },
  { id: "relatorios", label: "Análises & Relatórios", short: "Análises", description: "DRE, dashboards, aprovações", icon: FileBarChart },
  { id: "cadastros", label: "Cadastros & Configuração", short: "Cadastros", description: "Pessoas, categorias, plano de contas", icon: FolderTree },
] as const;

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
    <div className="space-y-6">
      {/* A conferência vem ANTES do saldo, de propósito: saber se o número
          fecha é condição para lê-lo, não um detalhe a conferir depois. */}
      <FinConferencia />

      {/* ============ SALDO + AÇÕES RÁPIDAS ============ */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Saldo destaque */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Saldo consolidado
            </div>
            <div className="space-y-1">
              {loadingResumo ? (
                <Skeleton className="h-10 w-72" />
              ) : (
                <p className="text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                  {kpis ? formatBRL(kpis.saldo) : "—"}
                </p>
              )}
              {kpis && !loadingResumo && (
                <p className="text-sm text-muted-foreground">
                  Projetado para hoje:{" "}
                  <span className={cn(
                    "font-medium tabular-nums",
                    kpis.saldoProjetado >= kpis.saldo ? "text-success" : "text-destructive",
                  )}>
                    {formatBRL(kpis.saldoProjetado)}
                  </span>
                  {kpis.saldoProjetado >= kpis.saldo
                    ? <TrendingUp className="inline w-4 h-4 ml-1 text-success" aria-hidden="true" />
                    : <TrendingDown className="inline w-4 h-4 ml-1 text-destructive" aria-hidden="true" />}
                </p>
              )}
              {/* Número apurado sobre amostra não pode ter a cara de número
                  exato. O hook marca quais recortes bateram no teto. */}
              {resumo && resumo.truncado.length > 0 && (
                <p className="text-xs text-warning flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  Volume acima do teto de consulta em {resumo.truncado.join(", ")} —
                  inadimplência e runway saem incompletos.
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
                    variant={a.primary ? "default" : "outline"}
                    onClick={() => handleNavigate(a.id)}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {a.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Mini KPIs lateral */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 self-center">
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
              // "Atrasos totais" soma o que se deve com o que se tem a receber
              // — duas coisas de sinal oposto num número só. Como volume de
              // pendência faz sentido; como valor, não. O rótulo diz qual é.
              label="Em atraso (pagar + receber)"
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
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-line bg-warning-tint px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 shrink-0 text-warning-ink" aria-hidden="true" />
            <p className="text-sm min-w-0 text-warning-ink">
              <span className="font-medium">Há lançamentos em atraso.</span>{" "}
              <span>
                {formatBRL(kpis.atrasoPagar)} a pagar e {formatBRL(kpis.atrasoReceber)} a receber.
              </span>
            </p>
          </div>
          <Button variant="outline" onClick={() => handleNavigate("panorama")}>
            Resolver <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* ============ Busca + Command palette hint ============ */}
      <div className="relative">
        <label htmlFor="fin-hub-busca" className="sr-only">Buscar funcionalidade</label>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id="fin-hub-busca"
          ref={inputRef}
          placeholder="Buscar funcionalidade... (ex: conciliação, NF-e, bonificação)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 pr-28"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2" aria-hidden="true">
          <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
            <Command className="w-3 h-3" />K
          </kbd>
          <span className="text-xs text-muted-foreground">ou</span>
          <kbd className="inline-flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
            /
          </kbd>
        </div>
      </div>

      {/* ============ Layout 2 colunas: Sidebar categorias + conteúdo ============ */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar de categorias */}
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-2">
            Categorias
          </p>
          <NavChip
            label="Todos os módulos"
            icon={LayoutDashboard}
            count={HUB_ITEMS.length}
            active={activeGroup === "all"}
            onClick={() => setActiveGroup("all")}
          />
          {GROUPS.map((g) => (
            <NavChip
              key={g.id}
              label={g.label}
              icon={g.icon}
              count={HUB_ITEMS.filter((i) => i.group === g.id).length}
              active={activeGroup === g.id}
              onClick={() => setActiveGroup(g.id)}
            />
          ))}

          {/* Stats lateral */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              Resumo
            </p>
            <div className="px-2 space-y-2 text-sm">
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
        <div className="space-y-8 min-w-0">
          {/* Favoritos */}
          {favoriteItems.length > 0 && !search && activeGroup === "all" && (
            <SectionBlock
              title="Favoritos"
              subtitle="Pinados por você"
              icon={Star}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
            >
              <div className="flex flex-wrap gap-2">
                {recentItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-border bg-card text-sm transition-colors hover:border-primary/40 hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-tint text-primary">
                        <Icon className="w-3 h-3" />
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
            const GroupIcon = group.icon;
            return (
              <SectionBlock
                key={group.id}
                title={group.label}
                subtitle={group.description}
                icon={GroupIcon}
                accentBar
                count={items.length}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
              <CardContent className="p-0">
                <EstadoVazio
                  icone={<Search />}
                  titulo="Nenhuma funcionalidade encontrada"
                  descricao={search ? `Nada corresponde a "${search}" nesta categoria.` : "Nada nesta categoria."}
                  acao={
                    <Button variant="outline" onClick={() => { setSearch(""); setActiveGroup("all"); }}>
                      Limpar filtros
                    </Button>
                  }
                />
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
  label, icon: Icon, count, active, onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "bg-primary-tint text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-primary" aria-hidden="true" />}
      <span className={cn(
        "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors",
        active ? "bg-card text-primary" : "bg-transparent group-hover:bg-muted",
      )}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      <span className={cn(
        "shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded",
        active ? "bg-card text-foreground" : "bg-muted text-muted-foreground",
      )}>
        {count}
      </span>
    </button>
  );
}

function SectionBlock({
  title, subtitle, icon: Icon, accentBar, count, children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBar?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {accentBar && <span className="w-1 h-5 rounded-full bg-primary" aria-hidden="true" />}
        <Icon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <span className="text-sm text-muted-foreground hidden sm:inline">— {subtitle}</span>}
        {typeof count === "number" && (
          <Badge variant="muted" className="ml-auto">
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
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group relative w-full text-left flex items-center gap-3 p-3 pr-2 rounded-lg border bg-card shadow-sm transition-colors duration-200",
        "hover:border-primary/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "animate-in fade-in",
        item.highlight ? "border-primary/40" : "border-border",
      )}
      style={{ animationDelay: `${Math.min(idx * 20, 240)}ms`, animationFillMode: "backwards" }}
    >
      {/* Barra de destaque à esquerda */}
      <span
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />

      <div className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center bg-primary-tint text-primary">
        <Icon className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm leading-tight truncate">{item.label}</span>
          {item.badge && (
            <Badge variant={item.badge === "Novo" ? "success" : "info"} className="shrink-0">
              {item.badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
      </div>

      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onToggleFav(e as any, item.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onToggleFav(e as any, item.id); }}
          className="p-1.5 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isFav ? "Remover dos favoritos" : "Fixar nos favoritos"}
        >
          {isFav
            ? <Pin className="w-4 h-4 fill-primary text-primary" />
            : <Pin className="w-4 h-4 text-muted-foreground" />}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Pin sempre visível se favorito */}
      {isFav && (
        <span className="absolute top-1.5 right-1.5 group-hover:opacity-0 transition-opacity" aria-hidden="true">
          <Pin className="w-3 h-3 fill-primary text-primary" />
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
  const toneIcon = {
    neutral: "bg-muted text-foreground",
    positive: "bg-success-tint text-success-ink",
    negative: "bg-destructive-tint text-destructive-ink",
    warning: "bg-warning-tint text-warning-ink",
  }[tone];
  const toneBorder = {
    neutral: "border-border hover:border-primary/40",
    positive: "border-border hover:border-success-line",
    negative: "border-border hover:border-destructive-line",
    warning: "border-warning-line hover:border-warning-ink",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-lg border bg-card p-4 transition-colors duration-200",
        "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        toneBorder,
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground truncate">
          {label}
        </span>
        <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0", toneIcon)}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-3/4" />
      ) : (
        <div className={cn(
          "font-semibold tabular-nums",
          isAction ? "text-sm text-primary inline-flex items-center gap-1" : "text-lg",
          !isAction && toneText,
        )}>
          {value}
          {isAction && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </div>
      )}
    </button>
  );
}
