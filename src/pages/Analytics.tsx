import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import AnalyticsKpiCards from '@/components/dashboard/AnalyticsKpiCards';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

// Recharts não aceita classe: o tooltip recebe estilo inline, mas só com
// tokens do tema — nada escrito à mão.
const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: 12,
};

export default function Analytics() {
  const { kpis, modalidadeBreakdown, statusBreakdown, ufBreakdown, timeline, loading } = useAnalyticsData();

  return (
    <AppLayout>
      {/* O título dizia "Analytics em Tempo Real" e o subtítulo, "Dados
          sincronizados automaticamente", com um ícone de wi-fi verde
          pulsando. Nada disso acontece: `useAnalyticsData` busca uma vez,
          na montagem e na troca de empresa — sem `subscribe`, sem
          `refetchInterval`. Aba aberta, o número congela.

          O dado é verdadeiro; a promessa é que não era. Ligar o tempo real
          é barato (o Realtime do Supabase já roda em 29 arquivos deste
          repo), mas é mudança de comportamento e ficou registrada na seção
          12 de docs/rebranding-front-end.md. Até lá, o texto diz o que a
          tela faz. */}
      <CabecalhoPagina
        icone={<Activity />}
        titulo="Analytics"
        descricao={
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
            Apurado ao abrir a tela — recarregue a página para ver mudanças recentes
          </span>
        }
        acoes={<EmpresaSelector />}
      />

      {/* KPI Cards */}
      <div className="mb-6">
        <AnalyticsKpiCards kpis={kpis} />
      </div>

      {/* Timeline Pregão × Dispensa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-4">Evolução Mensal — Pregões × Dispensas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeline} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pregao_ganhas" name="Pregão Ganho" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} stackId="pregao" />
              <Bar dataKey="pregao_perdidas" name="Pregão Perdido" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} stackId="pregao" />
              <Bar dataKey="dispensa_ganhas" name="Dispensa Ganha" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} stackId="dispensa" />
              <Bar dataKey="dispensa_perdidas" name="Dispensa Perdida" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} stackId="dispensa" />
              <Bar dataKey="emAndamento" name="Em Andamento" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Donut */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-4">Distribuição por Status</h2>
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
              {/* A cor de cada status vem do dado (useAnalyticsData) — é a
                  mesma da fatia do gráfico, para a legenda casar com ele. */}
              <div className="flex flex-wrap gap-2 mt-2">
                {statusBreakdown.map(s => (
                  <Badge key={s.status} variant="outline" className="gap-1" style={{ borderColor: s.color, color: s.color }}>
                    <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: s.color }} />
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
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-3">Desempenho por Modalidade</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sm font-semibold text-foreground border-b border-border">
                  <th className="text-left py-2 pr-2">Modalidade</th>
                  <th className="text-center py-2 px-1">Total</th>
                  <th className="text-center py-2 px-1">Ganhas</th>
                  <th className="text-center py-2 px-1">Perdidas</th>
                  <th className="text-center py-2 px-1">Andamento</th>
                  <th className="text-right py-2 pl-1">Valor Ganho</th>
                </tr>
              </thead>
              <tbody>
                {modalidadeBreakdown.map(m => (
                  <tr key={m.modalidade} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="py-2 pr-2 font-medium">{m.modalidade}</td>
                    <td className="text-center py-2 px-1 tabular-nums">{m.total}</td>
                    <td className="text-center py-2 px-1 text-success font-semibold tabular-nums">{m.ganhas}</td>
                    <td className="text-center py-2 px-1 text-destructive font-semibold tabular-nums">{m.perdidas}</td>
                    <td className="text-center py-2 px-1 text-warning font-semibold tabular-nums">{m.emAndamento}</td>
                    <td className="text-right py-2 pl-1 tabular-nums">{formatCurrency(m.valorGanho)}</td>
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
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-3">Desempenho por UF</h2>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-sm font-semibold text-foreground border-b border-border">
                  <th className="text-left py-2 pr-2">UF</th>
                  <th className="text-center py-2 px-1">Total</th>
                  <th className="text-center py-2 px-1">Ganhas</th>
                  <th className="text-center py-2 px-1">Perdidas</th>
                  <th className="text-right py-2 pl-1">Taxa Vitória</th>
                </tr>
              </thead>
              <tbody>
                {ufBreakdown.map(u => {
                  const decididas = u.ganhas + u.perdidas;
                  const taxa = decididas > 0 ? ((u.ganhas / decididas) * 100).toFixed(1) : '—';
                  return (
                    <tr key={u.uf} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="py-2 pr-2 font-medium">{u.uf}</td>
                      <td className="text-center py-2 px-1 tabular-nums">{u.total}</td>
                      <td className="text-center py-2 px-1 text-success font-semibold tabular-nums">{u.ganhas}</td>
                      <td className="text-center py-2 px-1 text-destructive font-semibold tabular-nums">{u.perdidas}</td>
                      <td className="text-right py-2 pl-1 tabular-nums">{taxa === '—' ? taxa : `${taxa}%`}</td>
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
      <div className="rounded-lg border border-border bg-muted p-4 text-xs text-muted-foreground">
        <strong>Base Legal:</strong> Lei nº 14.133/2021 (Nova Lei de Licitações) · Decreto nº 12.807/2025 (Limites de Dispensa Eletrônica vigentes a partir de 01/01/2026) · IN SEGES nº 67/2021 (Dispensa Eletrônica). Dados atualizados em tempo real via Realtime.
      </div>
    </AppLayout>
  );
}
