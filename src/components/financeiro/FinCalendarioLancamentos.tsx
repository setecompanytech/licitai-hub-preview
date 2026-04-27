import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Loader2,
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
  isSameDay,
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

function corStatus(l: LancamentoCal): string {
  if (l.status === "realizado" || l.status === "conciliado") return "bg-success/15 text-success border-success/30";
  if (l.status === "cancelado") return "bg-muted text-muted-foreground border-border";
  const venc = l.data_vencimento ?? l.data_competencia;
  const dias = differenceInDays(parseISO(venc), new Date());
  if (dias < 0) return "bg-destructive/15 text-destructive border-destructive/30";
  if (dias <= 7) return "bg-warning/15 text-warning border-warning/30";
  return "bg-info/15 text-info border-info/30";
}

export default function FinCalendarioLancamentos({ tipo }: Props) {
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Lancamento> | null>(null);

  const inicioMes = startOfMonth(refDate);
  const fimMes = endOfMonth(refDate);
  const inicioGrid = startOfWeek(inicioMes, { weekStartsOn: 0 });
  const fimGrid = endOfWeek(fimMes, { weekStartsOn: 0 });

  const { data = [], isLoading } = useLancamentos({
    tipo,
    dataInicio: format(inicioGrid, "yyyy-MM-dd"),
    dataFim: format(fimGrid, "yyyy-MM-dd"),
  });
  const lancamentos = data as LancamentoCal[];

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

  return (
    <div className="space-y-4">
      {/* Cabeçalho de navegação */}
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRefDate(subMonths(refDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[180px] text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {tipo === "a_pagar" ? "Contas a pagar" : "Contas a receber"}
              </p>
              <p className="text-lg font-semibold capitalize">
                {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRefDate(addMonths(refDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRefDate(new Date())}>
              <CalendarDays className="w-3.5 h-3.5 mr-1" />Hoje
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Em aberto no mês</p>
              <p className="text-base font-bold tabular-nums">
                {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">{tipo === "a_pagar" ? "Pago" : "Recebido"}</p>
              <p className="text-base font-bold tabular-nums text-success">
                {totalRealizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => irRelatorio("fluxo_caixa")}>
                <BarChart3 className="w-3.5 h-3.5 mr-1" />Fluxo
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => irRelatorio("dre")}>
                <FileText className="w-3.5 h-3.5 mr-1" />DRE
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade do calendário */}
      <Card>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {NOMES_DIAS.map((d) => (
                  <div key={d} className="text-[11px] uppercase tracking-wide text-muted-foreground text-center font-medium py-1">
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
                      className={`relative min-h-[110px] rounded-md border p-1.5 flex flex-col gap-1 transition-colors ${
                        foraMes ? "bg-muted/20 opacity-60" : "bg-card"
                      } ${hoje ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${hoje ? "text-primary" : ""}`}>
                          {format(d, "d")}
                        </span>
                        {!foraMes && (
                          <button
                            onClick={() => novoNoDia(d)}
                            className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                            title="Novo lançamento neste dia"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 space-y-0.5">
                        {items.slice(0, 3).map((l) => (
                          <button
                            key={l.id}
                            onClick={() => { setEditing(l); setDialogOpen(true); }}
                            className={`w-full text-left rounded px-1 py-0.5 text-[10px] border truncate ${corStatus(l)}`}
                            title={`${l.descricao} — ${Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                          >
                            <span className="font-medium">
                              {Number(l.valor).toLocaleString("pt-BR", { notation: "compact", style: "currency", currency: "BRL" })}
                            </span>{" "}
                            <span className="opacity-80">{l.descricao}</span>
                          </button>
                        ))}
                        {items.length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="w-full text-left text-[10px] text-muted-foreground hover:text-foreground px-1">
                                +{items.length - 3} mais…
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-2" align="start">
                              <p className="text-xs font-semibold mb-2">
                                {format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
                              </p>
                              <ScrollArea className="max-h-72">
                                <div className="space-y-1">
                                  {items.map((l) => (
                                    <button
                                      key={l.id}
                                      onClick={() => { setEditing(l); setDialogOpen(true); }}
                                      className={`w-full text-left rounded border px-2 py-1.5 hover:bg-muted/50 transition-colors`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium truncate">{l.descricao}</span>
                                        <span className="text-xs tabular-nums font-semibold whitespace-nowrap">
                                          {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </span>
                                      </div>
                                      {l.pessoa?.nome && (
                                        <p className="text-[10px] text-muted-foreground truncate">{l.pessoa.nome}</p>
                                      )}
                                      <Badge variant="outline" className={`text-[9px] mt-0.5 ${corStatus(l)}`}>
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
                        <div className="text-[10px] text-muted-foreground tabular-nums text-right border-t pt-0.5">
                          {totalDia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap items-center gap-3 mt-3 px-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-info/40 border border-info/40" />Em aberto</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-warning/40 border border-warning/40" />Vence ≤ 7 dias</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-destructive/40 border border-destructive/40" />Vencido</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-success/40 border border-success/40" />{tipo === "a_pagar" ? "Pago" : "Recebido"}</span>
              </div>
            </>
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
