import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle, TrendingUp, Clock, Activity } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { useResumoVisorFinanceiro } from "@/hooks/useFinanceiro";
import { formatBRL } from "@/lib/financeiro/formatters";
import { useQueryClient } from "@tanstack/react-query";

const AUTO_OPEN_KEY = "fin_resumo_auto_open";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDataCurta(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getResumoAutoOpen(): boolean {
  try { return localStorage.getItem(AUTO_OPEN_KEY) === "1"; } catch { return false; }
}

export default function FinResumoVisor() {
  const { data, isLoading, isFetching, refetch } = useResumoVisorFinanceiro();
  const qc = useQueryClient();
  const [autoOpen, setAutoOpen] = useState(getResumoAutoOpen());

  useEffect(() => {
    try { localStorage.setItem(AUTO_OPEN_KEY, autoOpen ? "1" : "0"); } catch { /* noop */ }
  }, [autoOpen]);

  const hoje = new Date();
  const dataExtenso = {
    dia: String(hoje.getDate()).padStart(2, "0"),
    mes: MESES[hoje.getMonth()],
    semana: DIAS_SEMANA[hoje.getDay()],
    ano: hoje.getFullYear(),
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 lg:col-span-1" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const chartData = data.proximos10Dias.map((d) => ({
    label: formatDataCurta(d.data),
    pagar: d.previstoPagar,
    receber: d.previstoReceber,
    saldo: d.saldoProjetado,
  }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { qc.invalidateQueries({ queryKey: ["fin-resumo-visor"] }); refetch(); }}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <span className="text-xs text-muted-foreground">Atualização automática a cada 60s</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="auto-open" checked={autoOpen} onCheckedChange={setAutoOpen} />
          <Label htmlFor="auto-open" className="text-xs cursor-pointer">
            Exibir Resumo automaticamente ao abrir Financeiro
          </Label>
        </div>
      </div>

      {/* Hero + gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero */}
        <Card className="lg:col-span-1 overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-6xl font-bold leading-none tabular-nums">{dataExtenso.dia}</div>
                <div className="text-lg mt-1 capitalize">{dataExtenso.mes}</div>
                <div className="text-sm opacity-80 capitalize">{dataExtenso.semana}-feira</div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-70 uppercase tracking-wide">Hoje</div>
                <div className="text-sm opacity-90">{dataExtenso.ano}</div>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
                <Wallet className="w-4 h-4" />
                Saldo em contas
              </div>
              <div className="text-3xl md:text-4xl font-semibold tabular-nums mt-1">
                {formatBRL(data.saldoTotal)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 10 dias */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Resumo para os próximos 10 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(value: number) => formatBRL(value)}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Bar dataKey="pagar" name="Previsto a Pagar" fill="hsl(var(--destructive))" opacity={0.7} radius={[4, 4, 0, 0]} />
                <Bar dataKey="receber" name="Previsto a Receber" fill="hsl(var(--primary))" opacity={0.7} radius={[4, 4, 0, 0]} />
                <Line dataKey="saldo" name="Saldo Projetado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cards de hoje */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardHoje
          tipo="pagar"
          qtd={data.hojePagar.qtd}
          total={data.hojePagar.total}
          atraso={data.hojePagar.atraso}
        />
        <CardHoje
          tipo="receber"
          qtd={data.hojeReceber.qtd}
          total={data.hojeReceber.total}
          atraso={data.hojeReceber.atraso}
        />
      </div>

      {/* Indicadores extras */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <IndicadorCard
          icon={Activity}
          label="Inadimplência do mês"
          value={`${data.inadimplenciaMesPct.toFixed(1)}%`}
          tone={data.inadimplenciaMesPct > 10 ? "danger" : data.inadimplenciaMesPct > 5 ? "warning" : "success"}
        />
        <IndicadorCard
          icon={Clock}
          label="Runway de caixa"
          value={data.runwayDias !== null ? `${data.runwayDias} dias` : "—"}
          hint={data.runwayDias !== null ? "com despesa média 30d" : "sem despesas registradas"}
          tone={data.runwayDias === null ? "default" : data.runwayDias < 30 ? "danger" : data.runwayDias < 90 ? "warning" : "success"}
        />
        <IndicadorCard
          icon={AlertTriangle}
          label="Total em atraso"
          value={formatBRL(data.hojePagar.atraso + data.hojeReceber.atraso)}
          hint={`${data.topAtrasosPagar.length + data.topAtrasosReceber.length} contas`}
          tone={(data.hojePagar.atraso + data.hojeReceber.atraso) > 0 ? "warning" : "success"}
        />
      </div>

      {/* Top atrasos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopAtrasosCard titulo="Contas a Pagar — Maiores Atrasos" itens={data.topAtrasosPagar} tipo="pagar" />
        <TopAtrasosCard titulo="Contas a Receber — Maiores Atrasos" itens={data.topAtrasosReceber} tipo="receber" />
      </div>
    </div>
  );
}

function CardHoje({ tipo, qtd, total, atraso }: { tipo: "pagar" | "receber"; qtd: number; total: number; atraso: number }) {
  const isPagar = tipo === "pagar";
  const Icon = isPagar ? ArrowUpCircle : ArrowDownCircle;
  const cor = isPagar ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
  const bgAccent = isPagar ? "bg-rose-50 dark:bg-rose-950/30" : "bg-emerald-50 dark:bg-emerald-950/30";

  return (
    <Card className={`overflow-hidden ${bgAccent}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${cor}`} />
              <span className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                {isPagar ? "Pagar Hoje" : "Receber Hoje"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tabular-nums ${cor}`}>{qtd}</span>
              <span className="text-xs text-muted-foreground">contas</span>
            </div>
            <div className={`text-2xl font-semibold tabular-nums mt-1 ${cor}`}>{formatBRL(total)}</div>
            {atraso > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                Em atraso: <span className="font-medium tabular-nums">{formatBRL(atraso)}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IndicadorCard({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone: "default" | "success" | "warning" | "danger" }) {
  const cor = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={`text-xl font-semibold tabular-nums mt-1 ${cor}`}>{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <Icon className={`w-5 h-5 ${cor}`} />
      </CardContent>
    </Card>
  );
}

function TopAtrasosCard({ titulo, itens, tipo }: { titulo: string; itens: Array<{ id: string; descricao: string; pessoa: string; diasAtraso: number; valor: number; vencimento: string }>; tipo: "pagar" | "receber" }) {
  const cor = tipo === "pagar" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";
  const bg = tipo === "pagar" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {itens.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma conta em atraso 🎉
          </div>
        ) : (
          <ul className="divide-y">
            {itens.map((it) => {
              const iniciais = (it.pessoa || "—").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "—";
              return (
                <li key={it.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${bg}`}>
                    {iniciais}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.pessoa}</div>
                    <div className="text-xs text-muted-foreground truncate">{it.descricao}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Venc. {formatDataCurta(it.vencimento)} · <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">{it.diasAtraso}d em atraso</Badge>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold tabular-nums whitespace-nowrap ${cor}`}>
                    {formatBRL(it.valor)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
