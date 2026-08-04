import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Scale,
  Target,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatBRL, formatDate } from "@/lib/financeiro/formatters";
import { useIndicadoresCFO, useGerarInsightsCFO, type CFOInsights } from "@/hooks/useIndicadoresCFO";

function KpiCard({
  titulo,
  valor,
  sufixo,
  hint,
  status,
  icon: Icon,
}: {
  titulo: string;
  valor: string;
  sufixo?: string;
  hint?: string;
  status?: "good" | "warn" | "bad" | "neutral";
  icon: React.ElementType;
}) {
  const cor =
    status === "good"
      ? "text-success"
      : status === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : status === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{titulo}</p>
            <p className={`text-2xl font-bold mt-1 ${cor}`}>
              {valor}
              {sufixo && <span className="text-base ml-1 text-muted-foreground">{sufixo}</span>}
            </p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className={`w-5 h-5 ${cor} opacity-70`} />
        </div>
      </CardContent>
    </Card>
  );
}

function nivelBadge(nivel: CFOInsights["saude_nivel"]) {
  const map = {
    critico: { label: "Crítico", cls: "bg-destructive text-destructive-foreground" },
    atencao: { label: "Atenção", cls: "bg-amber-500 text-white" },
    saudavel: { label: "Saudável", cls: "bg-success text-success-foreground" },
    excelente: { label: "Excelente", cls: "bg-primary text-primary-foreground" },
  };
  const v = map[nivel] ?? map.atencao;
  return <Badge className={v.cls}>{v.label}</Badge>;
}

export default function FinCFODashboard() {
  const { data: ind, isLoading } = useIndicadoresCFO();
  const gerarInsights = useGerarInsightsCFO();
  const [insights, setInsights] = useState<CFOInsights | null>(null);

  if (isLoading || !ind) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const semBP = !ind.tem_balanco;

  function statusLiquidez(v: number): "good" | "warn" | "bad" {
    if (v >= 1.5) return "good";
    if (v >= 1) return "warn";
    return "bad";
  }
  function statusEndividamento(pct: number): "good" | "warn" | "bad" {
    if (pct < 50) return "good";
    if (pct < 70) return "warn";
    return "bad";
  }
  function statusMargem(pct: number): "good" | "warn" | "bad" {
    if (pct >= 15) return "good";
    if (pct >= 5) return "warn";
    return "bad";
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho + IA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Painel CFO — Visão Executiva
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indicadores contábeis e projeção de caixa 90 dias
            {ind.competenciaBp && (
              <> · BP de referência: <strong>{formatDate(ind.competenciaBp)}</strong></>
            )}
          </p>
        </div>
        <Button
          onClick={() =>
            gerarInsights.mutate(ind, {
              onSuccess: (data) => setInsights(data),
            })
          }
          disabled={gerarInsights.isPending}
        >
          {gerarInsights.isPending ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1.5" />
          )}
          Gerar análise IA
        </Button>
      </div>

      {semBP && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sem Balanço Patrimonial publicado</AlertTitle>
          <AlertDescription>
            Indicadores de liquidez, endividamento e ROI/ROE estão usando estimativas. Publique um BP no
            módulo <strong>Demonstrações</strong> para análise precisa.
          </AlertDescription>
        </Alert>
      )}

      {/* Linha 1: Rentabilidade */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Rentabilidade</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            titulo="EBITDA"
            valor={formatBRL(ind.ebitda)}
            status={ind.ebitda > 0 ? "good" : "bad"}
            icon={TrendingUp}
            hint="Receita − Custos − Despesas Op."
          />
          <KpiCard
            titulo="Margem EBITDA"
            valor={ind.margemEbitda.toFixed(1)}
            sufixo="%"
            status={statusMargem(ind.margemEbitda)}
            icon={Target}
          />
          <KpiCard
            titulo="Lucro Líquido"
            valor={formatBRL(ind.lucroLiquido)}
            status={ind.lucroLiquido > 0 ? "good" : "bad"}
            icon={ind.lucroLiquido > 0 ? TrendingUp : TrendingDown}
          />
          <KpiCard
            titulo="Margem Líquida"
            valor={ind.margemLiquida.toFixed(1)}
            sufixo="%"
            status={statusMargem(ind.margemLiquida)}
            icon={Target}
          />
        </div>
      </div>

      {/* Linha 2: Liquidez & Endividamento */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
          Liquidez & Endividamento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            titulo="Liquidez Corrente"
            valor={ind.liquidezCorrente.toFixed(2)}
            status={statusLiquidez(ind.liquidezCorrente)}
            icon={Scale}
            hint="AC / PC — ideal ≥ 1,5"
          />
          <KpiCard
            titulo="Liquidez Seca"
            valor={ind.liquidezSeca.toFixed(2)}
            status={statusLiquidez(ind.liquidezSeca)}
            icon={Scale}
            hint="(AC − Estoques) / PC"
          />
          <KpiCard
            titulo="Endividamento Geral"
            valor={ind.endividamentoGeral.toFixed(1)}
            sufixo="%"
            status={statusEndividamento(ind.endividamentoGeral)}
            icon={AlertTriangle}
            hint="Passivo / Ativo Total"
          />
          <KpiCard
            titulo="Composição Endiv."
            valor={ind.composicaoEndividamento.toFixed(1)}
            sufixo="%"
            status={ind.composicaoEndividamento < 60 ? "good" : "warn"}
            icon={AlertTriangle}
            hint="PC / Passivo Total"
          />
        </div>
      </div>

      {/* Linha 3: Retorno & Caixa */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
          Retorno & Caixa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            titulo="ROI (Ativo)"
            valor={ind.roi.toFixed(2)}
            sufixo="%"
            status={ind.roi > 5 ? "good" : ind.roi > 0 ? "warn" : "bad"}
            icon={Target}
          />
          <KpiCard
            titulo="ROE (Patrimônio)"
            valor={ind.roe.toFixed(2)}
            sufixo="%"
            status={ind.roe > 10 ? "good" : ind.roe > 0 ? "warn" : "bad"}
            icon={Target}
          />
          <KpiCard
            titulo="Caixa Disponível"
            valor={formatBRL(ind.saldoCaixaAtual)}
            status={ind.saldoCaixaAtual > 0 ? "good" : "bad"}
            icon={Wallet}
          />
          <KpiCard
            titulo="Runway"
            valor={ind.runwayMeses ? `${ind.runwayMeses.toFixed(1)}` : "∞"}
            sufixo={ind.runwayMeses ? "meses" : undefined}
            status={
              ind.runwayMeses === null
                ? "good"
                : ind.runwayMeses > 6
                  ? "good"
                  : ind.runwayMeses > 3
                    ? "warn"
                    : "bad"
            }
            icon={Activity}
            hint={ind.burnMensal > 0 ? `Burn ${formatBRL(ind.burnMensal)}/mês` : "Operação positiva"}
          />
        </div>
      </div>

      {/* Projeção 90d */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Projeção de Caixa — Próximos 90 dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ind.projecao90d}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="dia"
                tickFormatter={(d) => formatDate(d).slice(0, 5)}
                fontSize={11}
              />
              <YAxis
                tickFormatter={(v) => formatBRL(v).replace("R$", "").trim()}
                fontSize={11}
              />
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                labelFormatter={(l) => formatDate(l as string)}
              />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="saldo_projetado"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Saldo projetado"
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Considera saldo atual + recebíveis e pagáveis previstos por vencimento, descontado o burn médio dos
            últimos 3 meses.
          </p>
        </CardContent>
      </Card>

      {/* Insights IA */}
      {insights && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Análise Executiva IA
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Saúde financeira:</span>
                <span className="text-2xl font-bold text-primary">{insights.saude_score}</span>
                {nivelBadge(insights.saude_nivel)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{insights.resumo}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-success uppercase mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Pontos Fortes
                </h4>
                <ul className="space-y-1.5">
                  {insights.pontos_fortes.map((p, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-success mt-0.5">✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Pontos de Atenção
                </h4>
                <ul className="space-y-1.5">
                  {insights.pontos_atencao.map((p, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-amber-600 dark:text-amber-400 mt-0.5">!</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {insights.acoes_prioritarias?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-primary uppercase mb-2 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Ações Prioritárias (30 dias)
                </h4>
                <div className="space-y-2">
                  {insights.acoes_prioritarias.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2.5 rounded-md border bg-muted/30"
                    >
                      <div className="text-xl font-bold text-primary leading-none">{i + 1}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.titulo}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            Impacto: {a.impacto}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Prazo: {a.prazo}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
