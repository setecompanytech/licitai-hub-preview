import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmpresaId } from "@/hooks/useFinanceiro";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Target } from "lucide-react";

const KPI_VALOR = "mt-1 text-[2rem] leading-10 font-bold tabular-nums truncate";

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
            <Target className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Previsto × Realizado — {new Date().getFullYear()}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Compara o que foi planejado (previsto) com o efetivamente realizado em cada mês do ano corrente.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meses}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitaPrev" name="Receita prevista" fill="hsl(var(--success) / 0.4)" />
                  <Bar dataKey="receitaReal" name="Receita realizada" fill="hsl(var(--success))" />
                  <Bar dataKey="despesaPrev" name="Despesa prevista" fill="hsl(var(--destructive) / 0.4)" />
                  <Bar dataKey="despesaReal" name="Despesa realizada" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Receita prevista</p>
          <p className={KPI_VALOR}>R$ {totalRecPrev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Receita realizada</p>
          <p className={`${KPI_VALOR} text-success`}>R$ {totalRecReal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">{totalRecPrev ? ((totalRecReal/totalRecPrev)*100).toFixed(1) : 0}% da meta</p>
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Despesa prevista</p>
          <p className={KPI_VALOR}>R$ {totalDespPrev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Despesa realizada</p>
          <p className={`${KPI_VALOR} text-destructive`}>R$ {totalDespReal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">{totalDespPrev ? ((totalDespReal/totalDespPrev)*100).toFixed(1) : 0}% do orçado</p>
        </CardContent></Card>
      </div>
    </div>
  );
}
