import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFluxoCaixa, useRefreshFinanceiroViews } from "@/hooks/useFinanceiro";
import { useDFC } from "@/hooks/useDFC";
import { formatBRL, formatBRLCompact, formatDate } from "@/lib/financeiro/formatters";
import { RefreshCw, AlertTriangle, Download, TrendingDown, TrendingUp, Flame, Hourglass } from "lucide-react";
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

function exportDFCcsv(dfc: ReturnType<typeof useDFC>["data"]) {
  if (!dfc) return;
  const linhas = [
    ["Competência", "Operacional", "Investimento", "Financiamento", "Caixa Líquido"],
    ...dfc.meses.map((m) => [
      m.competencia,
      m.operacional.toFixed(2),
      m.investimento.toFixed(2),
      m.financiamento.toFixed(2),
      m.caixaLiquido.toFixed(2),
    ]),
    ["TOTAL", dfc.totalOperacional.toFixed(2), dfc.totalInvestimento.toFixed(2), dfc.totalFinanciamento.toFixed(2), dfc.totalCaixaLiquido.toFixed(2)],
  ];
  const csv = linhas.map((l) => l.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dfc-cpc03-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const monthLabel = (mes: string) => {
  const [y, m] = mes.split("-");
  return `${m}/${y.slice(2)}`;
};

function formatRunway(meses: number | null): { label: string; cor: string } {
  if (meses === null) return { label: "—", cor: "text-muted-foreground" };
  if (!isFinite(meses)) return { label: "∞", cor: "text-success" };
  const cor = meses < 3 ? "text-destructive" : meses < 6 ? "text-warning" : "text-success";
  if (meses < 1) {
    const dias = Math.max(0, Math.round(meses * 30));
    return { label: `${dias} dia${dias === 1 ? "" : "s"}`, cor };
  }
  return { label: `${meses.toFixed(1)} meses`, cor };
}

type Cenario = "pessimista" | "realista" | "otimista";
const CENARIOS: { v: Cenario; l: string; entradaMul: number; saidaMul: number; cor: string }[] = [
  { v: "pessimista", l: "Pessimista", entradaMul: 0.85, saidaMul: 1.10, cor: "hsl(var(--destructive))" },
  { v: "realista", l: "Realista", entradaMul: 1.00, saidaMul: 1.00, cor: "hsl(var(--foreground))" },
  { v: "otimista", l: "Otimista", entradaMul: 1.10, saidaMul: 0.95, cor: "hsl(var(--primary))" },
];

export default function FinFluxoCaixa() {
  const [dias, setDias] = useState(90);
  const [mesesDFC, setMesesDFC] = useState(6);
  const [cenario, setCenario] = useState<Cenario>("realista");
  const { data, isLoading } = useFluxoCaixa(dias);
  const { data: dfc, isLoading: loadingDFC } = useDFC(mesesDFC);
  const refresh = useRefreshFinanceiroViews();

  // Aplica multiplicadores do cenário sobre os PREVISTOS (realizados são fato consumado).
  const dadosCenario = useMemo(() => {
    if (!data) return null;
    const cfg = CENARIOS.find((c) => c.v === cenario)!;
    let acum = data.saldoInicial;
    const dias2 = data.dias.map((d) => {
      const entradas_previstas = d.entradas_previstas * cfg.entradaMul;
      const saidas_previstas = d.saidas_previstas * cfg.saidaMul;
      const saldo_dia =
        entradas_previstas + d.entradas_realizadas - saidas_previstas - d.saidas_realizadas;
      acum += saldo_dia;
      return { ...d, entradas_previstas, saidas_previstas, saldo_dia, saldo_acumulado: acum };
    });
    return { ...data, dias: dias2 };
  }, [data, cenario]);

  const dadosUI = dadosCenario ?? data;
  const saldoFinal = dadosUI?.dias[dadosUI.dias.length - 1]?.saldo_acumulado ?? dadosUI?.saldoInicial ?? 0;
  const menorSaldo = dadosUI ? Math.min(dadosUI.saldoInicial, ...dadosUI.dias.map((d) => d.saldo_acumulado)) : 0;
  const diasNegativos = dadosUI?.dias.filter((d) => d.saldo_acumulado < 0) ?? [];

  return (
    <Tabs defaultValue="projecao" className="space-y-4">
      <TabsList>
        <TabsTrigger value="projecao">Projeção diária</TabsTrigger>
        <TabsTrigger value="dfc">DFC (CPC 03) · Burn Rate · Runway</TabsTrigger>
      </TabsList>

      {/* ========== TAB: Projeção diária ========== */}
      <TabsContent value="projecao" className="space-y-4 mt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Saldo atual</p>
              <p className="text-xl font-semibold mt-1">{formatBRL(dadosUI?.saldoInicial ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Saldo projetado ({dias}d · {CENARIOS.find(c => c.v === cenario)?.l})</p>
              <p className={`text-xl font-semibold mt-1 ${saldoFinal < 0 ? "text-destructive" : ""}`}>{formatBRL(saldoFinal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Menor saldo no período</p>
              <p className={`text-xl font-semibold mt-1 ${menorSaldo < 0 ? "text-destructive" : ""}`}>{formatBRL(menorSaldo)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Seletor de cenário */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">Cenário de projeção:</p>
              <Tabs value={cenario} onValueChange={(v) => setCenario(v as Cenario)}>
                <TabsList>
                  {CENARIOS.map((c) => (
                    <TabsTrigger key={c.v} value={c.v}>{c.l}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground ml-auto">
                Pessimista: −15% receitas, +10% despesas · Otimista: +10% receitas, −5% despesas
              </p>
            </div>
          </CardContent>
        </Card>

        {diasNegativos.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  Atenção: saldo projetado fica negativo em {diasNegativos.length} dia(s)
                </p>
                <p className="text-xs text-destructive/80 mt-0.5">
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
            {isLoading || !dadosUI ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosUI.dias}>
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
                    stroke="hsl(var(--chart-2))"
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
            {isLoading || !dadosUI ? (
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
                    {dadosUI.dias.map((d) => {
                      const entrada = d.entradas_previstas + d.entradas_realizadas;
                      const saida = d.saidas_previstas + d.saidas_realizadas;
                      return (
                        <tr key={d.data} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-1.5 px-2">{formatDate(d.data)}</td>
                          <td className="py-1.5 px-2 text-right text-success">{entrada > 0 ? formatBRL(entrada) : "—"}</td>
                          <td className="py-1.5 px-2 text-right text-destructive">{saida > 0 ? formatBRL(saida) : "—"}</td>
                          <td className={`py-1.5 px-2 text-right ${d.saldo_dia < 0 ? "text-destructive" : ""}`}>
                            {formatBRL(d.saldo_dia)}
                          </td>
                          <td className={`py-1.5 px-2 text-right font-medium ${d.saldo_acumulado < 0 ? "text-destructive" : ""}`}>
                            {formatBRL(d.saldo_acumulado)}
                            {d.saldo_acumulado < 0 && (
                              <Badge variant="destructive" className="ml-1.5 text-xs px-1 py-0">
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
      </TabsContent>

      {/* ========== TAB: DFC CPC 03 ========== */}
      <TabsContent value="dfc" className="space-y-4 mt-0">
        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Hourglass className="h-3.5 w-3.5" /> Saldo de caixa
              </p>
              <p className="text-xl font-semibold mt-1">{formatBRL(dfc?.saldoAtual ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" /> Burn Rate (média 3m)
              </p>
              <p className={`text-xl font-semibold mt-1 ${(dfc?.burnRateMensal ?? 0) > 0 ? "text-destructive" : ""}`}>
                {dfc?.burnRateMensal ? formatBRL(dfc.burnRateMensal) + "/mês" : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Runway</p>
              <p className={`text-xl font-semibold mt-1 ${formatRunway(dfc?.runwayMeses ?? null).cor}`}>
                {formatRunway(dfc?.runwayMeses ?? null).label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Saldo ÷ Burn Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Caixa líquido ({mesesDFC}m)</p>
              <p className={`text-xl font-semibold mt-1 ${(dfc?.totalCaixaLiquido ?? 0) < 0 ? "text-destructive" : "text-success"}`}>
                {formatBRL(dfc?.totalCaixaLiquido ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico DFC */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">DFC pelo método indireto — CPC 03</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Operacional (atividade-fim) · Investimento (imobilizado) · Financiamento (capital próprio/terceiros).
                Classifique cada categoria no Plano de Contas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={String(mesesDFC)} onValueChange={(v) => setMesesDFC(Number(v))}>
                <TabsList>
                  <TabsTrigger value="3">3 meses</TabsTrigger>
                  <TabsTrigger value="6">6 meses</TabsTrigger>
                  <TabsTrigger value="12">12 meses</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" onClick={() => exportDFCcsv(dfc)} disabled={!dfc}>
                <Download className="h-4 w-4 mr-1.5" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            {loadingDFC || !dfc ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dfc.meses}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="competencia" tickFormatter={monthLabel} className="text-xs" />
                  <YAxis tickFormatter={formatBRLCompact} className="text-xs" />
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    labelFormatter={(l) => `Competência ${monthLabel(String(l))}`}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="operacional" name="Operacional" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="investimento" name="Investimento" fill="hsl(var(--warning))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="financiamento" name="Financiamento" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="caixaLiquido" name="Caixa líquido" stroke="hsl(var(--foreground))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela DFC */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demonstração mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDFC || !dfc ? (
              <Skeleton className="w-full h-48" />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/30">
                    <tr className="text-left">
                      <th className="py-2 px-2">Competência</th>
                      <th className="py-2 px-2 text-right">Operacional</th>
                      <th className="py-2 px-2 text-right">Investimento</th>
                      <th className="py-2 px-2 text-right">Financiamento</th>
                      <th className="py-2 px-2 text-right">Caixa Líquido</th>
                      <th className="py-2 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dfc.meses.map((m) => (
                      <tr key={m.competencia} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 px-2 font-medium">{monthLabel(m.competencia)}</td>
                        <td className={`py-1.5 px-2 text-right tabular-nums ${m.operacional < 0 ? "text-destructive" : "text-success"}`}>
                          {formatBRL(m.operacional)}
                        </td>
                        <td className={`py-1.5 px-2 text-right tabular-nums ${m.investimento < 0 ? "text-destructive" : "text-success"}`}>
                          {formatBRL(m.investimento)}
                        </td>
                        <td className={`py-1.5 px-2 text-right tabular-nums ${m.financiamento < 0 ? "text-destructive" : "text-success"}`}>
                          {formatBRL(m.financiamento)}
                        </td>
                        <td className={`py-1.5 px-2 text-right font-semibold tabular-nums ${m.caixaLiquido < 0 ? "text-destructive" : ""}`}>
                          {formatBRL(m.caixaLiquido)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {m.caixaLiquido > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-success inline" />
                          ) : m.caixaLiquido < 0 ? (
                            <TrendingDown className="h-3.5 w-3.5 text-destructive inline" />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <td className="py-2 px-2">Total {mesesDFC}m</td>
                      <td className={`py-2 px-2 text-right tabular-nums ${dfc.totalOperacional < 0 ? "text-destructive" : "text-success"}`}>
                        {formatBRL(dfc.totalOperacional)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${dfc.totalInvestimento < 0 ? "text-destructive" : "text-success"}`}>
                        {formatBRL(dfc.totalInvestimento)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${dfc.totalFinanciamento < 0 ? "text-destructive" : "text-success"}`}>
                        {formatBRL(dfc.totalFinanciamento)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${dfc.totalCaixaLiquido < 0 ? "text-destructive" : ""}`}>
                        {formatBRL(dfc.totalCaixaLiquido)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Burn Rate = média do caixa operacional dos últimos 3 meses (somente quando negativo).
              Runway = Saldo de caixa ÷ Burn Rate. Caixa &lt; 3 meses indica risco crítico.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
