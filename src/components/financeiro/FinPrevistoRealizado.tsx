import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ValorDeCartao from "./ValorDeCartao";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Target, TrendingDown, TrendingUp } from "lucide-react";

export default function FinPrevistoRealizado() {
  const empresaId = useEmpresaId();
  const { data, isLoading } = useQuery({
    queryKey: ["previsto-realizado", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const ano = new Date().getFullYear();
      const { data: lancs } = await supabase
        .from("financeiro_lancamentos")
        .select("tipo, status, valor, data_competencia, natureza")
        .eq("empresa_id", empresaId!)
        .gte("data_competencia", `${ano}-01-01`)
        .lte("data_competencia", `${ano}-12-31`)
        .in("tipo", ["a_pagar", "a_receber"]);
      return lancs ?? [];
    },
  });

  const meses = useMemo(() => {
    const map = new Map<string, { mes: string; receitaPrev: number; receitaReal: number; despesaPrev: number; despesaReal: number }>();
    for (let m = 1; m <= 12; m++) {
      const key = String(m).padStart(2, "0");
      map.set(key, { mes: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m-1], receitaPrev: 0, receitaReal: 0, despesaPrev: 0, despesaReal: 0 });
    }
    (data ?? []).forEach((l) => {
      const mes = (l.data_competencia ?? "").slice(5, 7);
      const bucket = map.get(mes);
      if (!bucket) return;
      const v = Number(l.valor);
      // Venda cancelada não é meta: mantê-la no "previsto" achata o % do ano.
      if (l.status === "cancelado") return;
      const realizado = ["realizado", "conciliado"].includes(l.status as string);
      if (l.tipo === "a_receber") {
        bucket.receitaPrev += v;
        if (realizado) bucket.receitaReal += v;
      } else if (l.tipo === "a_pagar") {
        bucket.despesaPrev += v;
        if (realizado) bucket.despesaReal += v;
      }
    });
    return Array.from(map.values());
  }, [data]);

  const totalRecPrev = meses.reduce((a, b) => a + b.receitaPrev, 0);
  const totalRecReal = meses.reduce((a, b) => a + b.receitaReal, 0);
  const totalDespPrev = meses.reduce((a, b) => a + b.despesaPrev, 0);
  const totalDespReal = meses.reduce((a, b) => a + b.despesaReal, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Previsto × Realizado — {new Date().getFullYear()}
          </CardTitle>
          <CardDescription>
            Compara o que foi planejado (previsto) com o efetivamente realizado em cada mês do ano corrente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meses} barGap={2}>
                  {/* Grade e eixos recessivos, nos tokens do tema — `className`
                      no CartesianGrid não pintava nada: as linhas trazem o
                      próprio `stroke` e ignoravam a classe do grupo. */}
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* Quatro séries, quatro cores de token distintas (validadas
                      para daltonismo e contraste nos dois temas): o previsto
                      é informativo (azul) e violeta; o realizado leva a tinta
                      da receita (verde) e da despesa (vermelho). O alfa
                      composto na mão (`/ 0.4`) deixava duas séries com a
                      mesma cor na legenda. */}
                  <Bar dataKey="receitaPrev" name="Receita prevista" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="receitaReal" name="Receita realizada" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesaPrev" name="Despesa prevista" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesaReal" name="Despesa realizada" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Os quatro totais no cartão KPI do Design System v3 (112px): rótulo em
          cima, ícone num ladrilho tingido à direita, valor 28/36 que encolhe em
          vez de quebrar. Previsto em azul informativo; realizado na tinta da
          receita (verde) ou da despesa (vermelho). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Receita prevista</p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info-tint text-info-ink">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <ValorDeCartao valor={`R$ ${totalRecPrev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} className="text-foreground" />
        </Card>
        <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Receita realizada</p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-tint text-success-ink">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <ValorDeCartao valor={`R$ ${totalRecReal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} className="text-success-ink" />
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">{totalRecPrev ? ((totalRecReal/totalRecPrev)*100).toFixed(1) : 0}% da meta</p>
        </Card>
        <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Despesa prevista</p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info-tint text-info-ink">
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <ValorDeCartao valor={`R$ ${totalDespPrev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} className="text-foreground" />
        </Card>
        <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium leading-5 text-muted-foreground">Despesa realizada</p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive-tint text-destructive-ink">
              <TrendingDown className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <ValorDeCartao valor={`R$ ${totalDespReal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} className="text-destructive-ink" />
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">{totalDespPrev ? ((totalDespReal/totalDespPrev)*100).toFixed(1) : 0}% do orçado</p>
        </Card>
      </div>
    </div>
  );
}
