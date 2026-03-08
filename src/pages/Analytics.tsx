import AppLayout from '@/components/layout/AppLayout';
import AnalyticsKpiCards from '@/components/dashboard/AnalyticsKpiCards';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

export default function Analytics() {
  const { kpis, modalidadeBreakdown, statusBreakdown, ufBreakdown, timeline, loading } = useAnalyticsData();

  return (
    <AppLayout>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-accent" />
            Analytics em Tempo Real
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-success animate-pulse" />
            Dados sincronizados automaticamente
          </p>
        </div>
        <EmpresaSelector />
      </div>

      {/* KPI Cards */}
      <div className="mb-6">
        <AnalyticsKpiCards kpis={kpis} />
      </div>

      {/* Timeline Pregão × Dispensa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Evolução Mensal — Pregões × Dispensas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeline} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pregao_ganhas" name="Pregão Ganho" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} stackId="pregao" />
              <Bar dataKey="pregao_perdidas" name="Pregão Perdido" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} stackId="pregao" />
              <Bar dataKey="dispensa_ganhas" name="Dispensa Ganha" fill="hsl(174, 72%, 40%)" radius={[3, 3, 0, 0]} stackId="dispensa" />
              <Bar dataKey="dispensa_perdidas" name="Dispensa Perdida" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} stackId="dispensa" />
              <Bar dataKey="emAndamento" name="Em Andamento" fill="hsl(280, 60%, 50%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Donut */}
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Distribuição por Status</h3>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum processo ainda.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {statusBreakdown.map(s => (
                  <Badge key={s.status} variant="outline" className="text-[10px] gap-1" style={{ borderColor: s.color, color: s.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.status} ({s.count})
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* By Modalidade */}
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Desempenho por Modalidade</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-2 font-medium">Modalidade</th>
                  <th className="text-center py-2 px-1 font-medium">Total</th>
                  <th className="text-center py-2 px-1 font-medium">Ganhas</th>
                  <th className="text-center py-2 px-1 font-medium">Perdidas</th>
                  <th className="text-center py-2 px-1 font-medium">Andamento</th>
                  <th className="text-right py-2 pl-1 font-medium">Valor Ganho</th>
                </tr>
              </thead>
              <tbody>
                {modalidadeBreakdown.map(m => (
                  <tr key={m.modalidade} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-2 font-medium">{m.modalidade}</td>
                    <td className="text-center py-2 px-1">{m.total}</td>
                    <td className="text-center py-2 px-1 text-success font-semibold">{m.ganhas}</td>
                    <td className="text-center py-2 px-1 text-destructive font-semibold">{m.perdidas}</td>
                    <td className="text-center py-2 px-1 text-warning font-semibold">{m.emAndamento}</td>
                    <td className="text-right py-2 pl-1 font-mono">{formatCurrency(m.valorGanho)}</td>
                  </tr>
                ))}
                {modalidadeBreakdown.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* By UF */}
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Desempenho por UF</h3>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-2 font-medium">UF</th>
                  <th className="text-center py-2 px-1 font-medium">Total</th>
                  <th className="text-center py-2 px-1 font-medium">Ganhas</th>
                  <th className="text-center py-2 px-1 font-medium">Perdidas</th>
                  <th className="text-right py-2 pl-1 font-medium">Taxa Vitória</th>
                </tr>
              </thead>
              <tbody>
                {ufBreakdown.map(u => {
                  const decididas = u.ganhas + u.perdidas;
                  const taxa = decididas > 0 ? ((u.ganhas / decididas) * 100).toFixed(1) : '—';
                  return (
                    <tr key={u.uf} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-2 font-medium">{u.uf}</td>
                      <td className="text-center py-2 px-1">{u.total}</td>
                      <td className="text-center py-2 px-1 text-success font-semibold">{u.ganhas}</td>
                      <td className="text-center py-2 px-1 text-destructive font-semibold">{u.perdidas}</td>
                      <td className="text-right py-2 pl-1">{taxa === '—' ? taxa : `${taxa}%`}</td>
                    </tr>
                  );
                })}
                {ufBreakdown.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Legal note */}
      <div className="bg-muted/30 rounded-lg border border-border/30 p-3 text-[10px] text-muted-foreground">
        <strong>Base Legal:</strong> Lei nº 14.133/2021 (Nova Lei de Licitações) · Decreto nº 12.807/2025 (Limites de Dispensa Eletrônica vigentes a partir de 01/01/2026) · IN SEGES nº 67/2021 (Dispensa Eletrônica). Dados atualizados em tempo real via Realtime.
      </div>
    </AppLayout>
  );
}
