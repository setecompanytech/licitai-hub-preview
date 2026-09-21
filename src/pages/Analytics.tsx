import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import AnalyticsKpiCards from '@/components/dashboard/AnalyticsKpiCards';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SkeletonTabela from '@/components/shared/SkeletonTabela';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Inbox, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

// Recharts não aceita classe: grade, eixos e tooltip recebem estilo inline,
// mas só com tokens do tema — nada escrito à mão.
const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  boxShadow: 'var(--shadow-lg)',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};
const TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const EIXO = { stroke: 'hsl(var(--border))' };

/* Cinco séries, cinco cores de token distintas — a legenda não pode repetir
   cor. Pregão leva a tinta do desfecho (ganho verde, perdido vermelho);
   dispensa leva dois tokens de gráfico (dourado e céu); em andamento segue
   azul informativo. Entre os tokens do tema, este é o conjunto que passa nas
   seis checagens do validador de paleta (tema claro, todos os pares). */
const COR_PREGAO_GANHO = 'hsl(var(--success))';
const COR_PREGAO_PERDIDO = 'hsl(var(--destructive))';
const COR_DISPENSA_GANHA = 'hsl(var(--chart-6))';
const COR_DISPENSA_PERDIDA = 'hsl(var(--chart-7))';
const COR_EM_ANDAMENTO = 'hsl(var(--info))';

/**
 * Espera de um gráfico — um bloco na forma do gráfico, sem `role="status"`:
 * os cartões leem o mesmo `loading` e montariam várias regiões vivas ao
 * mesmo tempo. Quem anuncia a espera é o `aria-busy` do cartão; as tabelas
 * usam `SkeletonTabela`, que se anuncia com o rótulo do que está a caminho.
 */
function CarregandoGrafico({ alturaClasse = 'h-[300px]' }: { alturaClasse?: string }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className={`w-full ${alturaClasse}`} />
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

      {/* KPIs — faixa densa (`KpiStrip`) do componente do painel. */}
      <AnalyticsKpiCards kpis={kpis} />

      {/* Timeline Pregão × Dispensa e status — grade de 12 colunas. */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6 [&>*]:min-w-0">
        <Card aria-busy={loading} className="lg:col-span-8">
          <CardHeader className="pb-3">
            <CardTitle>Evolução mensal — pregões × dispensas</CardTitle>
          </CardHeader>
          <CardContent>
            {/* `timeline` sempre traz os 6 meses (zerados quando não há
                processo), então aqui não cabe estado vazio — só a espera. */}
            {loading ? (
              <CarregandoGrafico />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeline} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={TICK} axisLine={EIXO} tickLine={false} />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* Canto arredondado só no topo de cada pilha — o segmento
                      de baixo termina reto onde o de cima começa. */}
                  <Bar dataKey="pregao_ganhas" name="Pregão Ganho" fill={COR_PREGAO_GANHO} stackId="pregao" />
                  <Bar dataKey="pregao_perdidas" name="Pregão Perdido" fill={COR_PREGAO_PERDIDO} radius={[3, 3, 0, 0]} stackId="pregao" />
                  <Bar dataKey="dispensa_ganhas" name="Dispensa Ganha" fill={COR_DISPENSA_GANHA} stackId="dispensa" />
                  <Bar dataKey="dispensa_perdidas" name="Dispensa Perdida" fill={COR_DISPENSA_PERDIDA} radius={[3, 3, 0, 0]} stackId="dispensa" />
                  <Bar dataKey="emAndamento" name="Em Andamento" fill={COR_EM_ANDAMENTO} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card aria-busy={loading} className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle>Distribuição por status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <CarregandoGrafico alturaClasse="h-[200px]" />
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
                    mesma da fatia do gráfico, para a legenda casar com ele.
                    Ela fica no ponto; o texto veste a tinta de texto. */}
                <ul className="mt-3 flex flex-wrap gap-2">
                  {statusBreakdown.map(s => (
                    <li key={s.status}>
                      <Badge variant="muted" className="gap-1.5">
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        {s.status} ({s.count})
                      </Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quebras por modalidade e por UF */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 [&>*]:min-w-0">
        {/* Por modalidade */}
        <Card aria-busy={loading}>
          <CardHeader className="pb-3">
            <CardTitle>Desempenho por modalidade</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <SkeletonTabela linhas={4} colunas={6} rotulo="Carregando desempenho por modalidade" className="rounded-none border-0" />
            ) : modalidadeBreakdown.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<Inbox />}
                titulo="Sem dados por modalidade"
                descricao="Registre ou importe licitações para comparar pregão, dispensa e as demais modalidades"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Modalidade</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ganhas</TableHead>
                    <TableHead className="text-right">Perdidas</TableHead>
                    <TableHead className="text-right">Andamento</TableHead>
                    <TableHead className="text-right">Valor ganho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalidadeBreakdown.map(m => (
                    <TableRow key={m.modalidade}>
                      <TableCell className="font-semibold">{m.modalidade}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.total}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-success-ink">{m.ganhas}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-destructive-ink">{m.perdidas}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-info-ink">{m.emAndamento}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(m.valorGanho)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Por UF */}
        <Card aria-busy={loading}>
          <CardHeader className="pb-3">
            <CardTitle>Desempenho por UF</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <SkeletonTabela linhas={4} colunas={5} rotulo="Carregando desempenho por UF" className="rounded-none border-0" />
            ) : ufBreakdown.length === 0 ? (
              <EstadoVazio
                tamanho="compacto"
                icone={<Inbox />}
                titulo="Sem dados por UF"
                descricao="A quebra por estado aparece quando as licitações tiverem a UF preenchida"
              />
            ) : (
              /* A rolagem (vertical, 320px) fica presa a este contêiner, com o
                 cabeçalho grudado no topo. A tabela vai crua, sem o invólucro
                 rolável do `Table`: com dois contêineres de rolagem aninhados
                 o `sticky` prenderia no invólucro errado. */
              <div className="max-h-80 overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>UF</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Ganhas</TableHead>
                      <TableHead className="text-right">Perdidas</TableHead>
                      <TableHead className="text-right">Taxa de vitória</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ufBreakdown.map(u => {
                      const decididas = u.ganhas + u.perdidas;
                      const taxa = decididas > 0 ? ((u.ganhas / decididas) * 100).toFixed(1) : '—';
                      return (
                        <TableRow key={u.uf}>
                          <TableCell className="font-semibold">{u.uf}</TableCell>
                          <TableCell className="text-right tabular-nums">{u.total}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-success-ink">{u.ganhas}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-destructive-ink">{u.perdidas}</TableCell>
                          <TableCell className="text-right tabular-nums">{taxa === '—' ? taxa : `${taxa}%`}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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
