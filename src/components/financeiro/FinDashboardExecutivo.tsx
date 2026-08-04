import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  AlertTriangle,
  Clock,
  Target,
  Receipt,
  Users,
  Building2,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
} from "recharts";
import { useDashboardExecutivo } from "@/hooks/useDashboardExecutivo";
import { formatBRL, formatBRLCompact } from "@/lib/financeiro/formatters";
import { cn } from "@/lib/utils";

const monthLabel = (mes: string) => {
  const [y, m] = mes.split("-");
  return `${m}/${y.slice(2)}`;
};

const formatPct = (v: number | null, digits = 1) =>
  v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;

type KpiTone = "default" | "success" | "danger" | "warning" | "info";

const toneClasses: Record<KpiTone, { value: string; icon: string; bg: string }> = {
  default: { value: "text-foreground", icon: "text-muted-foreground", bg: "bg-muted/50" },
  success: { value: "text-success", icon: "text-success", bg: "bg-success/10" },
  danger: { value: "text-destructive", icon: "text-destructive", bg: "bg-destructive/10" },
  warning: { value: "text-warning", icon: "text-warning", bg: "bg-warning/10" },
  info: { value: "text-info", icon: "text-info", bg: "bg-info/10" },
};

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: KpiTone;
  trend?: { value: number | null; positiveIsGood?: boolean };
}) {
  const t = toneClasses[tone];
  const TrendIcon =
    trend?.value === null || trend?.value === undefined
      ? Minus
      : trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus;
  const trendGood =
    trend?.value === null || trend?.value === undefined || trend.value === 0
      ? null
      : (trend.value > 0) === (trend.positiveIsGood ?? true);

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-2xl font-semibold tabular-nums mt-1 truncate", t.value)}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon
                  className={cn(
                    "w-3 h-3",
                    trendGood === null && "text-muted-foreground",
                    trendGood === true && "text-success",
                    trendGood === false && "text-destructive"
                  )}
                />
                <span
                  className={cn(
                    "text-xs tabular-nums font-medium",
                    trendGood === null && "text-muted-foreground",
                    trendGood === true && "text-success",
                    trendGood === false && "text-destructive"
                  )}
                >
                  {formatPct(trend.value)}
                </span>
              </div>
            )}
          </div>
          <div className={cn("p-2 rounded-lg shrink-0", t.bg)}>
            <Icon className={cn("w-4 h-4", t.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinDashboardExecutivo() {
  const { data, isLoading } = useDashboardExecutivo();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  // Tons inteligentes
  const inadimplenciaTone: KpiTone =
    data.inadimplenciaPerc >= 10 ? "danger" : data.inadimplenciaPerc >= 5 ? "warning" : "success";
  const margemTone: KpiTone =
    data.margemLiquidaMes >= 15 ? "success" : data.margemLiquidaMes >= 5 ? "info" : data.margemLiquidaMes >= 0 ? "warning" : "danger";
  const giroTone: KpiTone = data.capitalGiroLiquido >= 0 ? "success" : "danger";
  const resultadoTone: KpiTone = data.resultadoMes >= 0 ? "success" : "danger";

  return (
    <div className="space-y-4">
      {/* Linha 1: Liquidez & Resultado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Saldo em contas" value={formatBRL(data.saldoTotal)} hint={`Disponível ${formatBRL(data.saldoDisponivel)}`} icon={Wallet} tone="info" />
        <KpiCard
          label="Resultado do mês"
          value={formatBRL(data.resultadoMes)}
          hint={`Receita ${formatBRLCompact(data.receitaMes)} · Despesa ${formatBRLCompact(data.despesaMes)}`}
          icon={Target}
          tone={resultadoTone}
          trend={{ value: data.variacaoReceitaMoM, positiveIsGood: true }}
        />
        <KpiCard
          label="Margem líquida"
          value={`${data.margemLiquidaMes.toFixed(1)}%`}
          hint="Resultado / Receita do mês"
          icon={Percent}
          tone={margemTone}
        />
        <KpiCard
          label="Capital de giro"
          value={formatBRL(data.capitalGiroLiquido)}
          hint="A receber − A pagar (em aberto)"
          icon={giroTone === "success" ? ArrowUpRight : ArrowDownRight}
          tone={giroTone}
        />
      </div>

      {/* Linha 2: Recebíveis / Pagáveis / Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="A receber"
          value={formatBRL(data.aReceberTotal)}
          hint={`Vencido ${formatBRL(data.aReceberVencido)}`}
          icon={ArrowUpRight}
          tone="success"
        />
        <KpiCard
          label="A pagar"
          value={formatBRL(data.aPagarTotal)}
          hint={`Vencido ${formatBRL(data.aPagarVencido)}`}
          icon={ArrowDownRight}
          tone="danger"
        />
        <KpiCard
          label="Inadimplência"
          value={`${data.inadimplenciaPerc.toFixed(1)}%`}
          hint={`Atraso médio ${data.diasMedioRecebimento.toFixed(0)} dias`}
          icon={AlertTriangle}
          tone={inadimplenciaTone}
        />
        <KpiCard
          label="Ticket médio (receita)"
          value={formatBRL(data.ticketMedioReceita)}
          hint={`${data.qtdLancamentosMes} lançamentos no mês`}
          icon={Receipt}
          tone="default"
        />
      </div>

      {/* Comparativos MoM/YoY */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Comparativos de receita
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Mês atual</p>
            <p className="text-xl font-semibold tabular-nums mt-1">{formatBRL(data.receitaMes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">vs. Mês anterior (MoM)</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xl font-semibold tabular-nums">{formatBRL(data.receitaMesAnterior)}</p>
              <Badge variant={data.variacaoReceitaMoM === null ? "secondary" : data.variacaoReceitaMoM >= 0 ? "default" : "destructive"}>
                {formatPct(data.variacaoReceitaMoM)}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">vs. Mesmo mês ano anterior (YoY)</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xl font-semibold tabular-nums">{formatBRL(data.receitaAnoAnterior)}</p>
              <Badge variant={data.variacaoReceitaYoY === null ? "secondary" : data.variacaoReceitaYoY >= 0 ? "default" : "destructive"}>
                {formatPct(data.variacaoReceitaYoY)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Série 12 meses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Receita × Despesa × Resultado (12 meses)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.serieReceitaDespesa}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tickFormatter={monthLabel} className="text-xs" />
              <YAxis tickFormatter={formatBRLCompact} className="text-xs" />
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                labelFormatter={(l) => `Competência ${monthLabel(String(l))}`}
              />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Aging + Top concentrações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aging de recebíveis</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.aging} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={formatBRLCompact} className="text-xs" />
                <YAxis dataKey="faixa" type="category" className="text-xs" width={90} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Top 5 clientes (12m)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem receitas no período.</p>
            ) : (
              <ul className="space-y-3">
                {data.topClientes.map((c) => (
                  <li key={c.nome}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{c.nome}</span>
                      <span className="tabular-nums font-medium">{formatBRL(c.total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${Math.min(c.perc, 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{c.perc.toFixed(1)}% do total</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Top 5 fornecedores (12m)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topFornecedores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem despesas no período.</p>
            ) : (
              <ul className="space-y-3">
                {data.topFornecedores.map((f) => (
                  <li key={f.nome}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{f.nome}</span>
                      <span className="tabular-nums font-medium">{formatBRL(f.total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-destructive" style={{ width: `${Math.min(f.perc, 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{f.perc.toFixed(1)}% do total</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
