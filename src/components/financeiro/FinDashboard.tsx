import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResumoFinanceiro } from "@/hooks/useFinanceiro";
import { formatBRL, formatBRLCompact } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "recharts";
import FinResumoCards from "./FinResumoCards";

const monthLabel = (mes: string) => {
  const [y, m] = mes.split("-");
  return `${m}/${y.slice(2)}`;
};

export default function FinDashboard() {
  const { data, isLoading } = useResumoFinanceiro();

  return (
    <div className="space-y-4">
      <FinResumoCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fluxo de caixa — últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading || !data ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.fluxo}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tickFormatter={monthLabel} className="text-xs" />
                  <YAxis tickFormatter={formatBRLCompact} className="text-xs" />
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    labelFormatter={(l) => `Competência ${monthLabel(String(l))}`}
                  />
                  <Legend />
                  <Bar dataKey="entrada" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saida" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--foreground))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : data.topDespesas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sem despesas registradas no período.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.topDespesas.map((d) => {
                  const max = data.topDespesas[0].total || 1;
                  const pct = (d.total / max) * 100;
                  return (
                    <li key={d.nome}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate pr-2">{d.nome}</span>
                        <span className="tabular-nums font-medium">{formatBRL(d.total)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-muted-foreground" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
