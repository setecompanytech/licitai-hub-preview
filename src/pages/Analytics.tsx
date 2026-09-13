import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import AnalyticsKpiCards from '@/components/dashboard/AnalyticsKpiCards';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { Badge } from '@/components/ui/badge';
import { Inbox, RefreshCw } from 'lucide-react';
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

/**
 * Linha de espera dos blocos — evita "nada aqui" enquanto a busca corre.
 *
 * Sem `role="status"`: os quatro blocos leem o mesmo `loading` e montariam
 * quatro regiões vivas ao mesmo tempo (e depois até três `EstadoVazio`, que
 * trazem a sua). Quem anuncia a espera é o `aria-busy` do cartão.
 */
function Carregando() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
}

export default function Analytics() {
  const { kpis, modalidadeBreakdown, statusBreakdown, ufBreakdown, timeline, loading } = useAnalyticsData();

  return (
    <AppLayout>
      {/* Título e descrição vêm de `lib/navegacao/paginas.ts` — /analytics é
          item de menu.

          A tela antes prometia "Analytics em Tempo Real", com um ícone de
          wi-fi verde pulsando e dados "sincronizados automaticamente". O que
          `useAnalyticsData` tem é uma assinatura de Realtime filtrada por
          `user_id=eq.<usuário>`: refaz a busca quando o próprio usuário mexe
          num processo, e fica cega para o que o colega da mesma empresa
          mudou — justo o escopo que a tela apura, que é por `empresa_id`. Com
          a aba aberta, o número pode envelhecer sem nada avisar.

          Alinhar o filtro ao escopo é mudança de comportamento (princípio 2 do
          CLAUDE.md) e fica para a frente própria — a seção 12 de
          docs/rebranding-front-end.md já lista o item, ainda descrevendo o
          hook como "sem subscribe". Até lá, a linha abaixo do título promete
          só o que a tela garante.

          O seletor de empresa vai em `filtros`, não em `acoes`: ele é escopo
          de dados, e /analytics não declara ação principal no registro. */}
      <CabecalhoPagina filtros={<EmpresaSelector />}>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Apurado ao abrir a tela — recarregue a página para ver mudanças recentes
        </p>
      </CabecalhoPagina>

      {/* KPIs */}
      <div className="mb-6">
        <AnalyticsKpiCards kpis={kpis} />
      </div>

      {/* Timeline Pregão × Dispensa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div aria-busy={loading} className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-4">Evolução mensal — pregões × dispensas</h2>
          {/* `timeline` sempre traz os 6 meses (zerados quando não há
              processo), então aqui não cabe estado vazio — só a espera. */}
          {loading ? (
            <Carregando />
          ) : (
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
          )}
        </div>

        {/* Status Donut */}
        <div aria-busy={loading} className="rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-4">Distribuição por status</h2>
          {loading ? (
            <Carregando />
          ) : statusBreakdown.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Inbox />}
              titulo="Nenhum processo ainda"
              descricao="A distribuição por status aparece quando houver licitações na empresa selecionada"
            />
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

      {/* Quebras por modalidade e por UF */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Por modalidade */}
        <div aria-busy={loading} className="rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-3">Desempenho por modalidade</h2>
          {loading ? (
            <Carregando />
          ) : modalidadeBreakdown.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Inbox />}
              titulo="Sem dados por modalidade"
              descricao="Registre ou importe licitações para comparar pregão, dispensa e as demais modalidades"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-sm font-semibold text-foreground border-b border-border">
                    <th className="text-left py-2 pr-2">Modalidade</th>
                    <th className="text-center py-2 px-1">Total</th>
                    <th className="text-center py-2 px-1">Ganhas</th>
                    <th className="text-center py-2 px-1">Perdidas</th>
                    <th className="text-center py-2 px-1">Andamento</th>
                    <th className="text-right py-2 pl-1">Valor ganho</th>
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
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Por UF */}
        <div aria-busy={loading} className="rounded-lg border border-border bg-card p-6 shadow-sm min-w-0">
          <h2 className="text-lg font-semibold mb-3">Desempenho por UF</h2>
          {loading ? (
            <Carregando />
          ) : ufBreakdown.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Inbox />}
              titulo="Sem dados por UF"
              descricao="A quebra por estado aparece quando as licitações tiverem a UF preenchida"
            />
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-sm font-semibold text-foreground border-b border-border">
                    <th className="text-left py-2 pr-2">UF</th>
                    <th className="text-center py-2 px-1">Total</th>
                    <th className="text-center py-2 px-1">Ganhas</th>
                    <th className="text-center py-2 px-1">Perdidas</th>
                    <th className="text-right py-2 pl-1">Taxa de vitória</th>
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
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Base legal. A frase final dizia "Dados atualizados em tempo real via
          Realtime" — saiu pelo mesmo motivo do título: não há assinatura de
          Realtime nesta tela. */}
      <div className="rounded-lg border border-border bg-muted p-4 text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">Base legal:</strong> Lei nº 14.133/2021 (Nova Lei de Licitações) · Decreto nº 12.807/2025 (limites de dispensa eletrônica vigentes a partir de 01/01/2026) · IN SEGES nº 67/2021 (dispensa eletrônica)
      </div>
    </AppLayout>
  );
}
