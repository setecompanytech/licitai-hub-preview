import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Props = {
  data: { mes: string; vitorias: number; derrotas: number; propostas: number }[];
};

/* As cores das séries e dos eixos são atributos SVG do Recharts e por isso
   ficam como `hsl(var(--token))` — todas apontam para tokens do tema
   (--success, --destructive, --chart-1, --border, --card, --muted-foreground). */
export default function LicitacoesChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Desempenho Mensal</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '10px',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="vitorias" name="Vitórias" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="derrotas" name="Derrotas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="propostas" name="Propostas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
