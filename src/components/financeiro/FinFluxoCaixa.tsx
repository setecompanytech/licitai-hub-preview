import { useState, useMemo } from "react";
import { hojeLocal } from "@/lib/financeiro/data-local";
import { acumularProjecao, type DiaProjetado } from "@/lib/financeiro/projecao-de-caixa";
import ValorDeCartao from "./ValorDeCartao";
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

/** Exporta o que a tela mostra — com o cenário escolhido, não a série bruta. */
function exportCSV(dias: DiaProjetado[], cenario: string) {
  if (!dias.length) return;
  const linhas = [
    ["Data", "Entradas Previstas", "Saídas Previstas", "Entradas Realizadas", "Saídas Realizadas", "Saldo Dia", "Saldo Acumulado"],
    ...dias.map((d) => [
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
  a.download = `fluxo-caixa-${cenario}-${hojeLocal()}.csv`;
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
  a.download = `dfc-cpc03-${hojeLocal()}.csv`;
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

  // A projeção sai de UMA fórmula (`acumularProjecao`), a mesma do hook: o
  // cenário só troca os multiplicadores dos previstos. A cópia local que
  // existia aqui re-somava o passado (realizados já contidos no saldo) e
  // anulou em silêncio a correção A8 de 02/09 — daí o "negativo em 32 dias,
  // primeiro dia crítico 04/08" de 19/09, com 04/08 no passado.
  const cfg = CENARIOS.find((c) => c.v === cenario)!;
  const projecao = useMemo(
    () => (data
      ? acumularProjecao({ saldoInicial: data.saldoInicial, linhas: data.linhas, hoje: data.hoje, entradaMul: cfg.entradaMul, saidaMul: cfg.saidaMul })
      : null),
    [data, cfg],
  );
  const diasUI: DiaProjetado[] = projecao?.dias ?? [];
  const saldoInicial = data?.saldoInicial ?? 0;
  const saldoFinal = projecao?.saldoFinal ?? saldoInicial;
  const menorSaldo = projecao?.menorSaldo ?? saldoInicial;
  const negativo = projecao?.primeiroNegativo ?? null;
  const atrasados = projecao?.atrasados ?? null;
  const inicioHistorico = diasUI.find((d) => d.passado)?.data ?? null;

  return (
    <Tabs defaultValue="projecao" className="space-y-4">
      <TabsList>
        <TabsTrigger value="projecao">Projeção diária</TabsTrigger>
        <TabsTrigger value="dfc">DFC (CPC 03) · Burn Rate · Runway</TabsTrigger>
      </TabsList>

      {/* ========== TAB: Projeção diária ========== */}
      <TabsContent value="projecao" className="space-y-6 mt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Saldo atual</p>
              <ValorDeCartao valor={formatBRL(saldoInicial)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Saldo projetado ({dias}d · {cfg.l})</p>
              <ValorDeCartao valor={formatBRL(saldoFinal)} className={saldoFinal < 0 ? "text-destructive" : ""} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Menor saldo (de hoje em diante)</p>
              <ValorDeCartao valor={formatBRL(menorSaldo)} className={menorSaldo < 0 ? "text-destructive" : ""} />
            </CardContent>
          </Card>
        </div>

        {/* Seletor de cenário */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-muted-foreground">Cenário de projeção:</p>
              <Tabs value={cenario} onValueChange={(v) => setCenario(v as Cenario)}>
                <TabsList>
                  {CENARIOS.map((c) => (
                    <TabsTrigger key={c.v} value={c.v}>{c.l}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground md:ml-auto">
                Pessimista: −15% receitas, +10% despesas · Otimista: +10% receitas, −5% despesas
              </p>
            </div>
          </CardContent>
        </Card>

        {negativo && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive-line bg-destructive-tint p-4">
            <AlertTriangle className="h-5 w-5 text-destructive-ink shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-destructive-ink">
              <p className="font-medium">
                Atenção: o saldo projetado fica negativo{" "}
                {negativo.emDias === 0 ? "hoje" : `em ${negativo.emDias} dia(s), em ${formatDate(negativo.data)}`}
              </p>
              <p className="text-xs mt-0.5">
                Saldo previsto nesse dia: <span className="tabular-nums">{formatBRL(negativo.saldo)}</span>
                {projecao && projecao.diasNegativos > 1 && <> · permanece negativo por {projecao.diasNegativos} dia(s)</>}
              </p>
            </div>
          </div>
        )}
        {atrasados && (atrasados.saidas > 0 || atrasados.entradas > 0) && (
          <p className="text-xs text-muted-foreground">
            A projeção considera em hoje o que venceu e ainda não foi baixado:
            {atrasados.saidas > 0 && <> <span className="tabular-nums">{formatBRL(atrasados.saidas)}</span> a pagar</>}
            {atrasados.saidas > 0 && atrasados.entradas > 0 && " e"}
            {atrasados.entradas > 0 && <> <span className="tabular-nums">{formatBRL(atrasados.entradas)}</span> a receber</>}.
          </p>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Fluxo de caixa projetado</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {inicioHistorico ? `Barras: histórico desde ${formatDate(inicioHistorico)} e previstos até o fim do período. ` : ""}
                A linha do acumulado parte do saldo atual e só anda com os previstos — o que já foi realizado está no saldo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
                <TabsList>
                  {PERIODOS.map((p) => (
                    <TabsTrigger key={p.v} value={String(p.v)}>
                      {p.l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                <RefreshCw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
                Atualizar
              </Button>
              <Button variant="outline" onClick={() => exportCSV(diasUI, cenario)} disabled={!projecao}>
                <Download className="h-4 w-4" aria-hidden="true" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-96">
            {isLoading || !projecao ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={diasUI}>
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
            <CardTitle>Detalhamento diário</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !projecao ? (
              <Skeleton className="w-full h-48" />
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border text-sm font-semibold">
                    <tr className="text-left">
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3 text-right">Entradas</th>
                      <th className="py-2 px-3 text-right">Saídas</th>
                      <th className="py-2 px-3 text-right">Saldo do dia</th>
                      <th className="py-2 px-3 text-right">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasUI.map((d) => {
                      const entrada = d.entradas_previstas + d.entradas_realizadas;
                      const saida = d.saidas_previstas + d.saidas_realizadas;
                      return (
                        <tr key={d.data} className={`border-b border-border hover:bg-muted/50 ${d.passado ? "text-muted-foreground" : ""}`} title={d.passado ? "Histórico: o acumulado não anda no passado" : undefined}>
                          <td className="py-2 px-3 whitespace-nowrap">{formatDate(d.data)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-success">{entrada > 0 ? formatBRL(entrada) : "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-destructive">{saida > 0 ? formatBRL(saida) : "—"}</td>
                          <td className={`py-2 px-3 text-right tabular-nums ${d.saldo_dia < 0 ? "text-destructive" : ""}`}>
                            {formatBRL(d.saldo_dia)}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums font-medium whitespace-nowrap ${d.saldo_acumulado < 0 ? "text-destructive" : ""}`}>
                            {formatBRL(d.saldo_acumulado)}
                            {d.saldo_acumulado < 0 && (
                              <Badge variant="danger" className="ml-2">
                                Negativo
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
      <TabsContent value="dfc" className="space-y-6 mt-0">
        {/* KPIs principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hourglass className="h-4 w-4" aria-hidden="true" /> Saldo de caixa
              </p>
              <ValorDeCartao valor={formatBRL(dfc?.saldoAtual ?? 0)} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Flame className="h-4 w-4" aria-hidden="true" /> Burn Rate (média 3m)
              </p>
              <ValorDeCartao
                valor={dfc?.burnRateMensal ? formatBRL(dfc.burnRateMensal) : "—"}
                sufixo={dfc?.burnRateMensal ? "/mês" : undefined}
                className={(dfc?.burnRateMensal ?? 0) > 0 ? "text-destructive" : ""}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Runway</p>
              <ValorDeCartao valor={formatRunway(dfc?.runwayMeses ?? null).label} className={formatRunway(dfc?.runwayMeses ?? null).cor} />
              <p className="text-xs text-muted-foreground mt-1">Saldo ÷ Burn Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Caixa líquido ({mesesDFC}m)</p>
              <ValorDeCartao valor={formatBRL(dfc?.totalCaixaLiquido ?? 0)} className={(dfc?.totalCaixaLiquido ?? 0) < 0 ? "text-destructive" : "text-success"} />
            </CardContent>
          </Card>
        </div>

        {/* Gráfico DFC */}
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>DFC pelo método indireto — CPC 03</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Operacional (atividade-fim) · Investimento (imobilizado) · Financiamento (capital próprio/terceiros).
                Classifique cada categoria no Plano de Contas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={String(mesesDFC)} onValueChange={(v) => setMesesDFC(Number(v))}>
                <TabsList>
                  <TabsTrigger value="3">3 meses</TabsTrigger>
                  <TabsTrigger value="6">6 meses</TabsTrigger>
                  <TabsTrigger value="12">12 meses</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" onClick={() => exportDFCcsv(dfc)} disabled={!dfc}>
                <Download className="h-4 w-4" aria-hidden="true" />
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
            <CardTitle>Demonstração mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDFC || !dfc ? (
              <Skeleton className="w-full h-48" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted text-sm font-semibold">
                    <tr className="text-left">
                      <th className="py-2 px-3">Competência</th>
                      <th className="py-2 px-3 text-right">Operacional</th>
                      <th className="py-2 px-3 text-right">Investimento</th>
                      <th className="py-2 px-3 text-right">Financiamento</th>
                      <th className="py-2 px-3 text-right">Caixa Líquido</th>
                      <th className="py-2 px-3 text-center w-12"><span className="sr-only">Tendência</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dfc.meses.map((m) => (
                      <tr key={m.competencia} className="border-b border-border hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{monthLabel(m.competencia)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${m.operacional < 0 ? "text-destructive" : "text-success"}`}>
                          {formatBRL(m.operacional)}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${m.investimento < 0 ? "text-destructive" : "text-success"}`}>
                          {formatBRL(m.investimento)}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${m.financiamento < 0 ? "text-destructive" : "text-success"}`}>
                          {formatBRL(m.financiamento)}
                        </td>
                        <td className={`py-2 px-3 text-right font-semibold tabular-nums ${m.caixaLiquido < 0 ? "text-destructive" : ""}`}>
                          {formatBRL(m.caixaLiquido)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {m.caixaLiquido > 0 ? (
                            <TrendingUp className="h-4 w-4 text-success inline" aria-label="Positivo" />
                          ) : m.caixaLiquido < 0 ? (
                            <TrendingDown className="h-4 w-4 text-destructive inline" aria-label="Negativo" />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted font-semibold">
                      <td className="py-2 px-3">Total {mesesDFC}m</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${dfc.totalOperacional < 0 ? "text-destructive" : "text-success"}`}>
                        {formatBRL(dfc.totalOperacional)}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums ${dfc.totalInvestimento < 0 ? "text-destructive" : "text-success"}`}>
                        {formatBRL(dfc.totalInvestimento)}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums ${dfc.totalFinanciamento < 0 ? "text-destructive" : "text-success"}`}>
                        {formatBRL(dfc.totalFinanciamento)}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums ${dfc.totalCaixaLiquido < 0 ? "text-destructive" : ""}`}>
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
