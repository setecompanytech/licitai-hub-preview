import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  BarChart3,
  Search,
  X,
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
import {
  useLancamentos,
  type Lancamento,
} from "@/hooks/useFinanceiro";
import LancamentoDialog from "./LancamentoDialog";

interface Props {
  tipo: "a_pagar" | "a_receber";
}

type LancamentoCal = Lancamento & {
  pessoa?: { id: string; nome: string } | null;
  categoria?: { id: string; nome: string; natureza: string } | null;
};

const NOMES_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type TomStatus = "success" | "muted" | "danger" | "warning" | "info";

function tomStatus(l: LancamentoCal): TomStatus {
  if (l.status === "realizado" || l.status === "conciliado") return "success";
  if (l.status === "cancelado") return "muted";
  const venc = l.data_vencimento ?? l.data_competencia;
  const dias = differenceInDays(parseISO(venc), new Date());
  if (dias < 0) return "danger";
  if (dias <= 7) return "warning";
  return "info";
}

const CHIP_STATUS: Record<TomStatus, string> = {
  success: "bg-success-tint text-success-ink border-success-line",
  muted: "bg-muted text-muted-foreground border-border",
  danger: "bg-destructive-tint text-destructive-ink border-destructive-line",
  warning: "bg-warning-tint text-warning-ink border-warning-line",
  info: "bg-muted text-foreground border-border",
};

function corStatus(l: LancamentoCal): string {
  return CHIP_STATUS[tomStatus(l)];
}

export default function FinCalendarioLancamentos({ tipo }: Props) {
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Lancamento> | null>(null);

  const inicioMes = startOfMonth(refDate);
  const fimMes = endOfMonth(refDate);
  const inicioGrid = startOfWeek(inicioMes, { weekStartsOn: 0 });
  const fimGrid = endOfWeek(fimMes, { weekStartsOn: 0 });

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "previsto" | "realizado" | "atrasado" | "pago">("todos");

  const { data = [], isLoading } = useLancamentos({
    tipo,
    dataInicio: format(inicioGrid, "yyyy-MM-dd"),
    dataFim: format(fimGrid, "yyyy-MM-dd"),
    campoData: "ambos",
  });
  const todos = data as LancamentoCal[];

  const lancamentos = useMemo(() => {
    const buscaLow = busca.trim().toLowerCase();
    return todos.filter((l) => {
      // Filtro de status
      if (filtroStatus !== "todos") {
        const venc = l.data_vencimento ?? l.data_competencia;
        const dias = differenceInDays(parseISO(venc), new Date());
        const ehPago = l.status === "realizado" || l.status === "conciliado";
        if (filtroStatus === "pago" && !ehPago) return false;
        if (filtroStatus === "realizado" && !ehPago) return false;
        if (filtroStatus === "previsto" && (ehPago || l.status === "cancelado" || dias < 0)) return false;
        if (filtroStatus === "atrasado" && (ehPago || l.status === "cancelado" || dias >= 0)) return false;
      }
      // Filtro de busca
      if (buscaLow) {
        const alvo = `${l.descricao ?? ""} ${l.pessoa?.nome ?? ""} ${l.categoria?.nome ?? ""}`.toLowerCase();
        if (!alvo.includes(buscaLow)) return false;
      }
      return true;
    });
  }, [todos, busca, filtroStatus]);

  // Indexa por dia (yyyy-MM-dd)
  const porDia = useMemo(() => {
    const m = new Map<string, LancamentoCal[]>();
    for (const l of lancamentos) {
      const key = (l.data_vencimento ?? l.data_competencia).slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return m;
  }, [lancamentos]);

  // Geração de células
  const dias: Date[] = useMemo(() => {
    const arr: Date[] = [];
    let cur = inicioGrid;
    while (cur <= fimGrid) {
      arr.push(cur);
      cur = addDays(cur, 1);
    }
    return arr;
  }, [inicioGrid, fimGrid]);

  // Totais do mês
  const totalAberto = lancamentos.reduce(
    (s, l) => (["realizado", "conciliado", "cancelado"].includes(l.status) ? s : s + Number(l.valor)),
    0,
  );
  const totalRealizado = lancamentos.reduce(
    (s, l) => (["realizado", "conciliado"].includes(l.status) ? s + Number(l.valor) : s),
    0,
  );

  const novoNoDia = (d: Date) => {
    setEditing({
      tipo,
      data_vencimento: format(d, "yyyy-MM-dd"),
      data_competencia: format(d, "yyyy-MM-dd"),
    } as Partial<Lancamento>);
    setDialogOpen(true);
  };

  const irRelatorio = (view: "fluxo_caixa" | "dre") => {
    window.dispatchEvent(new CustomEvent("fin:navigate", { detail: view }));
  };

  const idBase = `cal-${tipo}`;

  return (
    <div className="space-y-4">
      {/* Cabeçalho de navegação */}
      <Card>
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => setRefDate(subMonths(refDate, 1))}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <div className="min-w-[180px] text-center">
              <p className="text-sm text-muted-foreground">
                {tipo === "a_pagar" ? "Contas a pagar" : "Contas a receber"}
              </p>
              <p className="text-lg font-semibold capitalize">
                {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => setRefDate(addMonths(refDate, 1))}>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" onClick={() => setRefDate(new Date())}>
              <CalendarDays className="w-4 h-4" aria-hidden="true" />Hoje
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Em aberto no mês</p>
              <p className="text-lg font-bold tabular-nums">
                {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{tipo === "a_pagar" ? "Pago" : "Recebido"}</p>
              <p className="text-lg font-bold tabular-nums text-success">
                {totalRealizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => irRelatorio("fluxo_caixa")}>
                <BarChart3 className="w-4 h-4" aria-hidden="true" />Fluxo
              </Button>
              <Button variant="outline" onClick={() => irRelatorio("dre")}>
                <FileText className="w-4 h-4" aria-hidden="true" />DRE
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor={`${idBase}-busca`}>Buscar por descrição, pessoa ou categoria</Label>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id={`${idBase}-busca`}
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
            <Label htmlFor={`${idBase}-status`}>Status</Label>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
              <SelectTrigger id={`${idBase}-status`} className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="previsto">Em aberto (no prazo)</SelectItem>
                <SelectItem value="atrasado">Atrasados</SelectItem>
                <SelectItem value="pago">{tipo === "a_pagar" ? "Pagos" : "Recebidos"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground pb-3">
            <span className="font-semibold text-foreground tabular-nums">{lancamentos.length}</span> de {todos.length} lançamentos
          </p>
        </CardContent>
      </Card>

      {/* Grade do calendário */}
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
                    <div key={d} className="text-xs uppercase tracking-wide text-muted-foreground text-center font-medium py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {dias.map((d) => {
                    const key = format(d, "yyyy-MM-dd");
                    const items = porDia.get(key) ?? [];
                    const foraMes = !isSameMonth(d, refDate);
                    const hoje = isToday(d);
                    const totalDia = items.reduce((s, l) => s + Number(l.valor), 0);
                    return (
                      <div
                        key={key}
                        className={`group relative min-h-[110px] rounded-md border border-border p-2 flex flex-col gap-1 transition-colors ${
                          foraMes ? "bg-muted/40 text-muted-foreground" : "bg-card"
                        } ${hoje ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${hoje ? "text-primary font-bold" : ""}`}>
                            {format(d, "d")}
                          </span>
                          {!foraMes && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                              onClick={() => novoNoDia(d)}
                              title="Novo lançamento neste dia"
                              aria-label={`Novo lançamento em ${format(d, "dd/MM")}`}
                            >
                              <Plus className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>

                        <div className="flex-1 space-y-0.5">
                          {items.slice(0, 3).map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => { setEditing(l); setDialogOpen(true); }}
                              className={`w-full text-left rounded px-1 py-0.5 text-xs border truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${corStatus(l)}`}
                              title={`${l.descricao} — ${Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                            >
                              <span className="font-medium tabular-nums">
                                {Number(l.valor).toLocaleString("pt-BR", { notation: "compact", style: "currency", currency: "BRL" })}
                              </span>{" "}
                              <span className="opacity-80">{l.descricao}</span>
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
                                className="w-72 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-hidden p-2"
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
                                          <span className="text-xs font-medium truncate">{l.descricao}</span>
                                          <span className="text-xs text-right tabular-nums font-semibold whitespace-nowrap">
                                            {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                          </span>
                                        </div>
                                        {l.pessoa?.nome && (
                                          <p className="text-xs text-muted-foreground truncate">{l.pessoa.nome}</p>
                                        )}
                                        <Badge variant={tomStatus(l)} className="mt-1">
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

                        {totalDia > 0 && !foraMes && (
                          <div className="text-xs text-muted-foreground tabular-nums text-right border-t border-border pt-0.5">
                            {totalDia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap items-center gap-3 mt-3 px-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded-sm border ${CHIP_STATUS.info}`} aria-hidden="true" />Em aberto</span>
                <span className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded-sm border ${CHIP_STATUS.warning}`} aria-hidden="true" />Vence ≤ 7 dias</span>
                <span className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded-sm border ${CHIP_STATUS.danger}`} aria-hidden="true" />Vencido</span>
                <span className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded-sm border ${CHIP_STATUS.success}`} aria-hidden="true" />{tipo === "a_pagar" ? "Pago" : "Recebido"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LancamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        defaultTipo={tipo}
      />
    </div>
  );
}
