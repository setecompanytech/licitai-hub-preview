import AppLayout from '@/components/layout/AppLayout';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { modalidadeDistribuicao, chartDataMensal } from '@/data/mockData';
import LicitacoesChart from '@/components/dashboard/LicitacoesChart';
import ValorChart from '@/components/dashboard/ValorChart';

export default function Analytics() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">KPIs, heatmaps e distribuição por modalidade</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <LicitacoesChart />
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Distribuição por Modalidade</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={modalidadeDistribuicao}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {modalidadeDistribuicao.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
                formatter={(v: number, name: string) => [`${v}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ValorChart />

      {/* Heatmap placeholder */}
      <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm mt-4">
        <h3 className="text-sm font-semibold mb-4">Mapa de Calor — Concorrência por Região</h3>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => {
            const intensity = Math.random();
            return (
              <div
                key={i}
                className="aspect-square rounded-md transition-colors"
                style={{
                  background:
                    intensity > 0.7
                      ? 'hsl(0, 72%, 51%)'
                      : intensity > 0.4
                      ? 'hsl(38, 92%, 50%)'
                      : 'hsl(142, 71%, 45%)',
                  opacity: 0.3 + intensity * 0.7,
                }}
                title={`Intensidade: ${(intensity * 100).toFixed(0)}%`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-success opacity-60" /> Baixa
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-warning opacity-80" /> Média
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-destructive" /> Alta
          </span>
        </div>
      </div>
    </AppLayout>
  );
}
