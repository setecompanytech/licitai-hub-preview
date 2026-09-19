import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
  differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLancamentos, type Lancamento } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";
import { cn } from "@/lib/utils";
import LancamentoDialog from "./LancamentoDialog";
import ValorDeCartao from "./ValorDeCartao";

type LancamentoCal = Lancamento & {
  pessoa?: { id: string; nome: string } | null;
  categoria?: { id: string; nome: string; natureza: string } | null;
};

type FiltroTipo = "todos" | "a_pagar" | "a_receber";
type FiltroStatus = "todos" | "previsto" | "atrasado" | "realizado";

const NOMES_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function ehPago(l: LancamentoCal) {
  return l.status === "realizado" || l.status === "conciliado";
}

function estaAtrasado(l: LancamentoCal) {
  const venc = l.data_vencimento ?? l.data_competencia;
  const dias = differenceInDays(parseISO(venc), new Date());
  return !ehPago(l) && dias < 0;
}

/**
 * Cor do chip no calendário — famílias semânticas (tint/ink/line). Entrada é
 * verde, saída é vermelha; liquidado ganha contorno cheio e peso; vencido
 * ganha contorno tracejado.
 */
function corItem(l: LancamentoCal): string {
  if (l.status === "cancelado") return "bg-muted text-muted-foreground border-border line-through";
  const pago = ehPago(l);
  const atrasado = estaAtrasado(l);

  if (l.tipo === "a_receber") {
    // Verde — entradas
    if (pago) return "bg-success-tint text-success-ink border-success-ink font-semibold";
    if (atrasado) return "bg-success-tint text-success-ink border-success-ink border-dashed";
    return "bg-success-tint text-success-ink border-success-line";
  }
  // Vermelho — saídas (a_pagar e demais)
  if (pago) return "bg-destructive-tint text-destructive-ink border-destructive-ink font-semibold";
  if (atrasado) return "bg-destructive-tint text-destructive-ink border-destructive-ink border-dashed";
  return "bg-destructive-tint text-destructive-ink border-destructive-line";
}

function badgeStatus(l: LancamentoCal): "success" | "muted" | "danger" | "info" {
  if (l.status === "cancelado") return "muted";
  if (ehPago(l)) return "success";
  if (estaAtrasado(l)) return "danger";
  return "info";
}

export default function FinCalendarioFinanceiro() {
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Lancamento> | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");

  const inicioMes = startOfMonth(refDate);
  const fimMes = endOfMonth(refDate);
  const inicioGrid = startOfWeek(inicioMes, { weekStartsOn: 0 });
  const fimGrid = endOfWeek(fimMes, { weekStartsOn: 0 });

  const { data = [], isLoading } = useLancamentos({
    tipo: filtroTipo === "todos" ? undefined : filtroTipo,
    dataInicio: format(inicioGrid, "yyyy-MM-dd"),
    dataFim: format(fimGrid, "yyyy-MM-dd"),
    campoData: "ambos",
  });
  const todos = data as LancamentoCal[];

  const lancamentos = useMemo(() => {
    const buscaLow = busca.trim().toLowerCase();
    return todos.filter((l) => {
      // Filtro por status (interpretado dinamicamente)
      if (filtroStatus !== "todos") {
        const venc = l.data_vencimento ?? l.data_competencia;
        const dias = differenceInDays(parseISO(venc), new Date());
        const pago = ehPago(l);
        if (filtroStatus === "realizado" && !pago) return false;
        if (filtroStatus === "previsto" && (pago || l.status === "cancelado" || dias < 0)) return false;
        if (filtroStatus === "atrasado" && (pago || l.status === "cancelado" || dias >= 0)) return false;
      }
      if (buscaLow) {
        const alvo = `${l.descricao ?? ""} ${l.pessoa?.nome ?? ""} ${l.categoria?.nome ?? ""}`.toLowerCase();
        if (!alvo.includes(buscaLow)) return false;
      }
      return true;
    });
  }, [todos, busca, filtroStatus]);

  // Indexa por dia (yyyy-MM-dd) usando vencimento (ou competência como fallback)
  const porDia = useMemo(() => {
    const m = new Map<string, LancamentoCal[]>();
    for (const l of lancamentos) {
      const key = (l.data_vencimento ?? l.data_competencia).slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return m;
  }, [lancamentos]);

  const dias: Date[] = useMemo(() => {
    const arr: Date[] = [];
    let cur = inicioGrid;
    while (cur <= fimGrid) {
      arr.push(cur);
      cur = addDays(cur, 1);
    }
    return arr;
  }, [inicioGrid, fimGrid]);

  // Totais do mês visível (apenas dentro do mês de referência, não da grade completa)
  const totaisMes = useMemo(() => {
    let pagar = 0;
    let receber = 0;
    let pago = 0;
    let recebido = 0;
    for (const l of lancamentos) {
      const venc = l.data_vencimento ?? l.data_competencia;
      const dataVenc = parseISO(venc);
      if (!isSameMonth(dataVenc, refDate)) continue;
      const v = Number(l.valor);
      const pago_ = ehPago(l);
      if (l.tipo === "a_pagar") {
        if (pago_) pago += v;
        else if (l.status !== "cancelado") pagar += v;
      } else if (l.tipo === "a_receber") {
        if (pago_) recebido += v;
        else if (l.status !== "cancelado") receber += v;
      }
    }
    return { pagar, receber, pago, recebido, saldo: receber - pagar };
  }, [lancamentos, refDate]);

  const novoNoDia = (d: Date, tipo: "a_pagar" | "a_receber" = "a_pagar") => {
    setEditing({
      tipo,
      data_vencimento: format(d, "yyyy-MM-dd"),
      data_competencia: format(d, "yyyy-MM-dd"),
    } as Partial<Lancamento>);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho de navegação + KPIs proporcionais */}
      <Card>
        <CardContent className="space-y-5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => setRefDate(subMonths(refDate, 1))}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <div className="min-w-[200px] text-center">
                <p className="text-sm leading-5 text-muted-foreground">Calendário Financeiro</p>
                <p className="text-lg font-semibold capitalize leading-6 text-foreground">
                  {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => setRefDate(addMonths(refDate, 1))}>
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button variant="ghost" onClick={() => setRefDate(new Date())}>
                <CalendarDays aria-hidden="true" />Hoje
              </Button>
            </div>

            {/* Duas ações de criação com o mesmo peso: nenhuma é "a" principal
                da tela, então nenhuma leva o verde sólido. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => novoNoDia(new Date(), "a_pagar")}>
                <Plus aria-hidden="true" />A pagar
              </Button>
              <Button variant="outline" onClick={() => novoNoDia(new Date(), "a_receber")}>
                <Plus aria-hidden="true" />A receber
              </Button>
            </div>
          </div>

          {/* KPIs compactos do mês */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiMini icon={ArrowUpCircle} label="A pagar" value={formatBRL(totaisMes.pagar)} tone="danger" />
            <KpiMini icon={ArrowDownCircle} label="A receber" value={formatBRL(totaisMes.receber)} tone="success" />
            <KpiMini icon={TrendingDown} label="Pago" value={formatBRL(totaisMes.pago)} tone="muted" />
            <KpiMini icon={TrendingUp} label="Recebido" value={formatBRL(totaisMes.recebido)} tone="muted" />
            <KpiMini
              icon={Wallet}
              label="Saldo previsto"
              value={formatBRL(totaisMes.saldo)}
              tone={totaisMes.saldo >= 0 ? "success" : "danger"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1 basis-64">
            <Label htmlFor="cal-fin-busca">Buscar por descrição, pessoa ou categoria</Label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="cal-fin-busca"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex.: aluguel, fornecedor X, energia…"
                className="pl-9 pr-10"
              />
              {busca && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setBusca("")}
                  title="Limpar"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
          <div className="min-w-[160px]">
            <Label htmlFor="cal-fin-tipo">Tipo</Label>
            <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as FiltroTipo)}>
              <SelectTrigger id="cal-fin-tipo" className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Pagar + Receber</SelectItem>
                <SelectItem value="a_pagar">Apenas a pagar</SelectItem>
                <SelectItem value="a_receber">Apenas a receber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label htmlFor="cal-fin-status">Status</Label>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as FiltroStatus)}>
              <SelectTrigger id="cal-fin-status" className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="previsto">Em aberto (no prazo)</SelectItem>
                <SelectItem value="atrasado">Atrasados</SelectItem>
                <SelectItem value="realizado">Liquidados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="whitespace-nowrap pb-2.5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{lancamentos.length}</span> de {todos.length} lançamentos
          </p>
        </CardContent>
      </Card>

      {/* Grade do calendário — proporcional, com altura adaptativa */}
      <Card>
        <CardContent className="p-2 md:p-3">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1" role="status" aria-label="Carregando calendário">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {NOMES_DIAS.map((d) => (
                    <div key={d} className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 auto-rows-fr">
                  {dias.map((d) => {
                    const key = format(d, "yyyy-MM-dd");
                    const items = porDia.get(key) ?? [];
                    const foraMes = !isSameMonth(d, refDate);
                    const hoje = isToday(d);
                    // Total proporcional do dia: receber positivo, pagar negativo
                    let saldoDia = 0;
                    let totalPagar = 0;
                    let totalReceber = 0;
                    for (const it of items) {
                      const v = Number(it.valor);
                      if (it.tipo === "a_pagar") { totalPagar += v; saldoDia -= v; }
                      if (it.tipo === "a_receber") { totalReceber += v; saldoDia += v; }
                    }
                    return (
                      <div
                        key={key}
                        className={`group relative flex min-h-[120px] flex-col gap-1 rounded-md border p-2 transition-colors ${
                          foraMes ? "border-border bg-secondary text-muted-foreground" : "border-border bg-card"
                        } ${hoje ? "border-primary ring-1 ring-primary/30" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-medium tabular-nums ${hoje ? "font-semibold text-primary" : ""}`}>
                            {format(d, "d")}
                          </span>
                          {!foraMes && (
                            <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                                onClick={() => novoNoDia(d, "a_pagar")}
                                title="Novo a pagar"
                                aria-label={`Novo a pagar em ${format(d, "dd/MM")}`}
                              >
                                <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success-ink hover:bg-success-tint hover:text-success-ink"
                                onClick={() => novoNoDia(d, "a_receber")}
                                title="Novo a receber"
                                aria-label={`Novo a receber em ${format(d, "dd/MM")}`}
                              >
                                <ArrowDownCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Barra proporcional pagar vs receber */}
                        {!foraMes && (totalPagar > 0 || totalReceber > 0) && (
                          <div className="flex h-1 rounded-full overflow-hidden bg-muted">
                            {totalReceber > 0 && (
                              <div
                                className="bg-success"
                                style={{ width: `${(totalReceber / (totalPagar + totalReceber)) * 100}%` }}
                                title={`Receber: ${formatBRL(totalReceber)}`}
                              />
                            )}
                            {totalPagar > 0 && (
                              <div
                                className="bg-destructive"
                                style={{ width: `${(totalPagar / (totalPagar + totalReceber)) * 100}%` }}
                                title={`Pagar: ${formatBRL(totalPagar)}`}
                              />
                            )}
                          </div>
                        )}

                        <div className="flex-1 space-y-0.5 overflow-hidden">
                          {items.slice(0, 3).map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => { setEditing(l); setDialogOpen(true); }}
                              className={`w-full text-left rounded px-1 py-0.5 text-xs border truncate flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${corItem(l)}`}
                              title={`${l.descricao} — ${formatBRL(Number(l.valor))}`}
                            >
                              {l.tipo === "a_pagar" ? (
                                <ArrowUpCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                              ) : (
                                <ArrowDownCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                              )}
                              <span className="font-medium tabular-nums">
                                {Number(l.valor).toLocaleString("pt-BR", { notation: "compact", style: "currency", currency: "BRL" })}
                              </span>
                              <span className="opacity-80 truncate">{l.descricao}</span>
                            </button>
                          ))}
                          {items.length > 3 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="link" className="h-auto w-full justify-start px-1 py-0 text-xs text-muted-foreground hover:text-foreground">
                                  +{items.length - 3} mais…
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-hidden p-2"
                                align="start"
                                sideOffset={6}
                                collisionPadding={12}
                              >
                                <p className="text-sm font-semibold mb-2 shrink-0 capitalize">
                                  {format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
                                </p>
                                <ScrollArea
                                  className="h-[min(60vh,420px)] pr-3"
                                  onWheel={(e) => e.stopPropagation()}
                                >
                                  <div className="space-y-1 pb-1">
                                    {items.map((l) => (
                                      <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => { setEditing(l); setDialogOpen(true); }}
                                        className="w-full text-left rounded-md border border-border px-2 py-2 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex items-center gap-1 truncate text-xs font-medium">
                                            {l.tipo === "a_pagar" ? (
                                              <ArrowUpCircle className="h-3 w-3 text-destructive-ink" aria-hidden="true" />
                                            ) : (
                                              <ArrowDownCircle className="h-3 w-3 text-success-ink" aria-hidden="true" />
                                            )}
                                            {l.descricao}
                                          </span>
                                          <span className="text-xs text-right tabular-nums font-semibold whitespace-nowrap">
                                            {formatBRL(Number(l.valor))}
                                          </span>
                                        </div>
                                        {l.pessoa?.nome && (
                                          <p className="text-xs text-muted-foreground truncate">{l.pessoa.nome}</p>
                                        )}
                                        <Badge variant={badgeStatus(l)} className="mt-1">
                                          {l.status}
                                        </Badge>
                                      </button>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>

                        {/* Saldo do dia */}
                        {!foraMes && (totalPagar > 0 || totalReceber > 0) && (
                          <div className={`border-t border-border pt-0.5 text-right text-xs font-medium tabular-nums ${
                            saldoDia >= 0 ? "text-success-ink" : "text-destructive-ink"
                          }`}>
                            {saldoDia >= 0 ? "+" : ""}{formatBRL(saldoDia)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legenda */}
              <div className="mt-3 flex flex-wrap items-center gap-3 px-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm border border-success-line bg-success-tint" aria-hidden="true" />
                  <ArrowDownCircle className="h-3 w-3 text-success-ink" aria-hidden="true" />A receber (entrada)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm border border-destructive-line bg-destructive-tint" aria-hidden="true" />
                  <ArrowUpCircle className="h-3 w-3 text-destructive-ink" aria-hidden="true" />A pagar (saída)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-success-tint border border-success-ink" aria-hidden="true" />Recebido
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-destructive-tint border border-destructive-ink" aria-hidden="true" />Pago
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-dashed border-destructive-ink" aria-hidden="true" />Vencido
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        defaultTipo={editing?.tipo === "a_receber" ? "a_receber" : "a_pagar"}
      />
    </div>
  );
}

function KpiMini({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "success" | "danger" | "muted";
}) {
  // Cartão KPI do Design System v3, na versão compacta (96px): rótulo em
  // cima, ícone num ladrilho tingido à direita, valor que encolhe com o
  // comprimento em vez de cortar. Texto colorido só na tinta `*-ink`.
  const cor = {
    success: "text-success-ink",
    danger: "text-destructive-ink",
    muted: "text-foreground",
  }[tone];
  const ladrilho = {
    success: "bg-success-tint text-success-ink",
    danger: "bg-destructive-tint text-destructive-ink",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="flex min-h-[96px] flex-col justify-between gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${ladrilho}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <ValorDeCartao valor={value} compacto className={cn("mt-0", cor)} />
    </div>
  );
}
