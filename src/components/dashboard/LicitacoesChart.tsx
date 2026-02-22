import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Props = {
  data: { mes: string; vitorias: number; derrotas: number; propostas: number }[];
};

export default function LicitacoesChart({ data }: Props) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-4">Desempenho Mensal</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="vitorias" name="Vitórias" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="derrotas" name="Derrotas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="propostas" name="Propostas" fill="hsl(210, 100%, 40%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
