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
function Carregando({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-[6px] p-3">
      <div className="skeleton h-7 w-3/4 rounded-[3px]" />
      {Array.from({ length: linhas - 1 }).map((_, i) => (
        <div key={i} className="skeleton h-9 w-full rounded-[3px]" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
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
      <CabecalhoPagina
        filtros={
          <>
            <EmpresaSelector />
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              Apurado ao abrir a tela
            </p>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-4">
        <AnalyticsKpiCards kpis={kpis} />
      </div>

      {/* Timeline Pregão × Dispensa */}
      <div className="ds-grid-12 mb-3">
        <div aria-busy={loading} className="ds-span-8 card" style={{background:'#fff',border:'1px solid #ccd6df',borderRadius:4,boxShadow:'0 1px 2px rgba(16,40,62,.07)'}}>
          <div className="ds-card-head"><h2>Evolução mensal — pregões × dispensas</h2></div>
          <div className="card-body" style={{padding:'12px'}}>
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
          </div>{/* /card-body */}
        </div>{/* /ds-span-8 */}

        {/* Status Donut */}
        <div aria-busy={loading} className="ds-span-4" style={{background:'#fff',border:'1px solid #ccd6df',borderRadius:4,boxShadow:'0 1px 2px rgba(16,40,62,.07)'}}>
          <div className="ds-card-head"><h2>Distribuição por status</h2></div>
          <div style={{padding:'12px'}}>
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
        </div>{/* /padding */}
        </div>{/* /ds-span-4 */}
      </div>{/* /ds-grid-12 */}

      {/* Quebras por modalidade e por UF */}
      <div className="ds-grid-12 mb-3">
        {/* Por modalidade */}
        <div aria-busy={loading} className="ds-span-6" style={{background:'#fff',border:'1px solid #ccd6df',borderRadius:4,boxShadow:'0 1px 2px rgba(16,40,62,.07)'}}>
          <div className="ds-card-head"><h2>Desempenho por modalidade</h2></div>
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
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Modalidade</th>
                    <th style={{textAlign:'center'}}>Total</th>
                    <th style={{textAlign:'center'}}>Ganhas</th>
                    <th style={{textAlign:'center'}}>Perdidas</th>
                    <th style={{textAlign:'center'}}>Andamento</th>
                    <th style={{textAlign:'right'}}>Valor ganho</th>
                  </tr>
                </thead>
                <tbody>
                  {modalidadeBreakdown.map(m => (
                    <tr key={m.modalidade}>
                      <td className="ds-cell-main">{m.modalidade}</td>
                      <td style={{textAlign:'center'}}>{m.total}</td>
                      <td style={{textAlign:'center',color:'#087b62',fontWeight:600}}>{m.ganhas}</td>
                      <td style={{textAlign:'center',color:'#a52b22',fontWeight:600}}>{m.perdidas}</td>
                      <td style={{textAlign:'center',color:'#916018',fontWeight:600}}>{m.emAndamento}</td>
                      <td className="ds-align-right">{formatCurrency(m.valorGanho)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Por UF */}
        <div aria-busy={loading} className="ds-span-6" style={{background:'#fff',border:'1px solid #ccd6df',borderRadius:4,boxShadow:'0 1px 2px rgba(16,40,62,.07)'}}>
          <div className="ds-card-head"><h2>Desempenho por UF</h2></div>
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
            <div className="ds-table-wrap" style={{maxHeight:320,overflowY:'auto'}}>
              <table className="ds-table">
                <thead style={{position:'sticky',top:0,zIndex:1}}>
                  <tr>
                    <th>UF</th>
                    <th style={{textAlign:'center'}}>Total</th>
                    <th style={{textAlign:'center'}}>Ganhas</th>
                    <th style={{textAlign:'center'}}>Perdidas</th>
                    <th style={{textAlign:'right'}}>Taxa de vitória</th>
                  </tr>
                </thead>
                <tbody>
                  {ufBreakdown.map(u => {
                    const decididas = u.ganhas + u.perdidas;
                    const taxa = decididas > 0 ? ((u.ganhas / decididas) * 100).toFixed(1) : '—';
                    return (
                      <tr key={u.uf}>
                        <td className="ds-cell-main">{u.uf}</td>
                        <td style={{textAlign:'center'}}>{u.total}</td>
                        <td style={{textAlign:'center',color:'#087b62',fontWeight:600}}>{u.ganhas}</td>
                        <td style={{textAlign:'center',color:'#a52b22',fontWeight:600}}>{u.perdidas}</td>
                        <td className="ds-align-right">{taxa === '—' ? taxa : `${taxa}%`}</td>
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
