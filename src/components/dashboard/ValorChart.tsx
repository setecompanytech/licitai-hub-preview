import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { chartDataValor } from '@/data/mockData';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function ValorChart() {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-4">Valor Acumulado (R$)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartDataValor}>
          <defs>
            <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(174, 72%, 40%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(174, 72%, 40%)" stopOpacity={0} />
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
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="hsl(174, 72%, 40%)"
            strokeWidth={2}
            fill="url(#colorValor)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
