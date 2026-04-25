import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFluxoCaixa, useRefreshFinanceiroViews } from "@/hooks/useFinanceiro";
import { formatBRL, formatBRLCompact, formatDate } from "@/lib/financeiro/formatters";
import { RefreshCw, AlertTriangle, Download } from "lucide-react";
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
  ReferenceLine,
} from "recharts";

const PERIODOS = [
  { v: 30, l: "30 dias" },
  { v: 60, l: "60 dias" },
  { v: 90, l: "90 dias" },
  { v: 180, l: "6 meses" },
];

function exportCSV(dias: ReturnType<typeof useFluxoCaixa>["data"]) {
  if (!dias) return;
  const linhas = [
    ["Data", "Entradas Previstas", "Saídas Previstas", "Entradas Realizadas", "Saídas Realizadas", "Saldo Dia", "Saldo Acumulado"],
    ...dias.dias.map((d) => [
      d.data,
      d.entradas_previstas.toFixed(2),
      d.saidas_previstas.toFixed(2),
      d.entradas_realizadas.toFixed(2),
      d.saidas_realizadas.toFixed(2),
      d.saldo_dia.toFixed(2),
      d.saldo_acumulado.toFixed(2),
    ]),
  ];
  const csv = linhas.map((l) => l.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fluxo-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinFluxoCaixa() {
  const [dias, setDias] = useState(90);
  const { data, isLoading } = useFluxoCaixa(dias);
  const refresh = useRefreshFinanceiroViews();

  const saldoFinal = data?.dias[data.dias.length - 1]?.saldo_acumulado ?? data?.saldoInicial ?? 0;
  const menorSaldo = data ? Math.min(data.saldoInicial, ...data.dias.map((d) => d.saldo_acumulado)) : 0;
  const diasNegativos = data?.dias.filter((d) => d.saldo_acumulado < 0) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Saldo atual</p>
            <p className="text-xl font-semibold mt-1">{formatBRL(data?.saldoInicial ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Saldo projetado ({dias}d)</p>
            <p className={`text-xl font-semibold mt-1 ${saldoFinal < 0 ? "text-rose-600" : ""}`}>{formatBRL(saldoFinal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Menor saldo no período</p>
            <p className={`text-xl font-semibold mt-1 ${menorSaldo < 0 ? "text-rose-600" : ""}`}>{formatBRL(menorSaldo)}</p>
          </CardContent>
        </Card>
      </div>

      {diasNegativos.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
          <CardContent className="pt-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-rose-900 dark:text-rose-200">
                Atenção: saldo projetado fica negativo em {diasNegativos.length} dia(s)
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Primeiro dia crítico: {formatDate(diasNegativos[0].data)} — saldo previsto {formatBRL(diasNegativos[0].saldo_acumulado)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Fluxo de caixa projetado</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Baseado em previstos + realizados.</p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
              <TabsList>
                {PERIODOS.map((p) => (
                  <TabsTrigger key={p.v} value={String(p.v)}>
                    {p.l}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refresh.isPending ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV(data)} disabled={!data}>
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-96">
          {isLoading || !data ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.dias}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  className="text-xs"
                />
                <YAxis tickFormatter={formatBRLCompact} className="text-xs" />
                <Tooltip
                  formatter={(v: number) => formatBRL(v)}
                  labelFormatter={(l) => formatDate(String(l))}
                />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Bar
                  dataKey={(d) => d.entradas_previstas + d.entradas_realizadas}
                  name="Entradas"
                  fill="hsl(var(--primary))"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey={(d) => d.saidas_previstas + d.saidas_realizadas}
                  name="Saídas"
                  fill="hsl(var(--destructive))"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="saldo_acumulado"
                  name="Saldo acumulado"
                  stroke="hsl(var(--accent-foreground))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento diário</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="w-full h-48" />
          ) : (
            <div className="overflow-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b">
                  <tr className="text-left">
                    <th className="py-2 px-2">Data</th>
                    <th className="py-2 px-2 text-right">Entradas</th>
                    <th className="py-2 px-2 text-right">Saídas</th>
                    <th className="py-2 px-2 text-right">Saldo do dia</th>
                    <th className="py-2 px-2 text-right">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dias.map((d) => {
                    const entrada = d.entradas_previstas + d.entradas_realizadas;
                    const saida = d.saidas_previstas + d.saidas_realizadas;
                    return (
                      <tr key={d.data} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 px-2">{formatDate(d.data)}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-600">{entrada > 0 ? formatBRL(entrada) : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-rose-600">{saida > 0 ? formatBRL(saida) : "—"}</td>
                        <td className={`py-1.5 px-2 text-right ${d.saldo_dia < 0 ? "text-rose-600" : ""}`}>
                          {formatBRL(d.saldo_dia)}
                        </td>
                        <td className={`py-1.5 px-2 text-right font-medium ${d.saldo_acumulado < 0 ? "text-rose-600" : ""}`}>
                          {formatBRL(d.saldo_acumulado)}
                          {d.saldo_acumulado < 0 && (
                            <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">
                              ⚠
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
