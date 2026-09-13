import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

type Props = {
  data: { mes: string; valor: number }[];
};

/* As cores da série e dos eixos são atributos SVG do Recharts e por isso
   ficam como `hsl(var(--token))` — todas apontam para tokens do tema
   (--chart-1, --border, --card, --muted-foreground). */
export default function ValorChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Valor Acumulado (R$)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatCurrency} />
          <Tooltip
            formatter={(v: number) => [formatCurrency(v), 'Valor']}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#colorValor)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
