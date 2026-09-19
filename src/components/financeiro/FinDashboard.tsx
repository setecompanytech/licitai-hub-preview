import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useResumoFinanceiro } from "@/hooks/useFinanceiro";
import { formatBRL, formatBRLCompact } from "@/lib/financeiro/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Tags } from "lucide-react";
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
import EstadoVazio from "@/components/shared/EstadoVazio";
import FinResumoCards from "./FinResumoCards";

const monthLabel = (mes: string) => {
  const [y, m] = mes.split("-");
  return `${m}/${y.slice(2)}`;
};

export default function FinDashboard() {
  const { data, isLoading } = useResumoFinanceiro();

  return (
    <div className="space-y-6">
      <FinResumoCards />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de caixa — últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading || !data ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.fluxo}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tickFormatter={monthLabel} className="text-xs" />
                  <YAxis tickFormatter={formatBRLCompact} className="text-xs" />
                  {/* Balão do gráfico na superfície do cartão (tokens do DS),
                      como nos outros gráficos do módulo. */}
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    labelFormatter={(l) => `Competência ${monthLabel(String(l))}`}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "hsl(var(--foreground))",
                    }}
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
            <CardTitle>Top 5 despesas por categoria</CardTitle>
            {/* O período e o recorte, ditos: a lista abria com "Transferências
                Recebidas Entre Contas" (R$ 7,26 mi) porque somava por categoria
                sem olhar a natureza dela (19/09). */}
            <CardDescription>
              Realizadas nos últimos 6 meses · sem transferências, aplicações e imobilizado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : data.topDespesas.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<Tags />}
                titulo="Sem despesas no período"
                descricao="Assim que houver despesas classificadas por categoria, as cinco maiores aparecem aqui."
              />
            ) : (
              <ul className="space-y-3">
                {data.topDespesas.map((d) => {
                  const max = data.topDespesas[0].total || 1;
                  const pct = (d.total / max) * 100;
                  return (
                    <li key={d.nome}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-foreground">{d.nome}</span>
                        <span className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">{formatBRL(d.total)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
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
