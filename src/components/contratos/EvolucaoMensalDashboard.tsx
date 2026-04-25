import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, TrendingDown, BarChart3, LineChart as LineIcon, Activity, Download } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, AreaChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart
} from 'recharts';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtBRLFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);

type Pedido = {
  id: string;
  data_pedido?: string | null;
  valor_total?: number | null;
  custo_total?: number | null;
  status?: string | null;
};

type Props = {
  pedidos: Pedido[];
  podeVerCustos: boolean;
  valorGlobal?: number;
  dataInicio?: string | null;
  dataFim?: string | null;
};

type Periodo = '6m' | '12m' | '24m' | 'all';
type Visual = 'composto' | 'barras' | 'area';

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function EvolucaoMensalDashboard({ pedidos, podeVerCustos, valorGlobal = 0, dataInicio, dataFim }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('12m');
  const [visual, setVisual] = useState<Visual>('composto');

  const ativos = useMemo(() => pedidos.filter(p => p.status !== 'cancelado' && p.data_pedido), [pedidos]);

  const series = useMemo(() => {
    if (ativos.length === 0) return [];
    // Agrupa por YYYY-MM
    const grupo: Record<string, { faturamento: number; custos: number; pedidos: number }> = {};
    ativos.forEach(p => {
      const k = p.data_pedido!.substring(0, 7);
      if (!grupo[k]) grupo[k] = { faturamento: 0, custos: 0, pedidos: 0 };
      grupo[k].faturamento += p.valor_total || 0;
      grupo[k].custos += p.custo_total || 0;
      grupo[k].pedidos += 1;
    });

    // Define janela de meses
    const chaves = Object.keys(grupo).sort();
    if (chaves.length === 0) return [];

    let inicio = new Date(`${chaves[0]}-01T00:00:00`);
    let fim = new Date(`${chaves[chaves.length - 1]}-01T00:00:00`);

    if (periodo !== 'all') {
      const meses = periodo === '6m' ? 6 : periodo === '12m' ? 12 : 24;
      const hoje = new Date();
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      inicio = new Date(fim.getFullYear(), fim.getMonth() - (meses - 1), 1);
    }

    // Garante continuidade (preenche meses sem pedidos com zero)
    const out: any[] = [];
    let acumulado = 0;
    const cursor = new Date(inicio);
    while (cursor <= fim) {
      const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const g = grupo[k] || { faturamento: 0, custos: 0, pedidos: 0 };
      const lucro = g.faturamento - g.custos;
      acumulado += g.faturamento;
      out.push({
        mes: k,
        label: `${MES_LABEL[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`,
        faturamento: Math.round(g.faturamento * 100) / 100,
        custos: Math.round(g.custos * 100) / 100,
        lucro: Math.round(lucro * 100) / 100,
        pedidos: g.pedidos,
        acumulado: Math.round(acumulado * 100) / 100,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [ativos, periodo]);

  const totais = useMemo(() => {
    const t = series.reduce(
      (acc, s) => {
        acc.faturamento += s.faturamento;
        acc.custos += s.custos;
        acc.pedidos += s.pedidos;
        return acc;
      },
      { faturamento: 0, custos: 0, pedidos: 0 }
    );
    const lucro = t.faturamento - t.custos;
    const margem = t.faturamento > 0 ? (lucro / t.faturamento) * 100 : 0;
    const ticketMedio = t.pedidos > 0 ? t.faturamento / t.pedidos : 0;
    const mesesAtivos = series.filter(s => s.pedidos > 0).length;
    const mediaMensal = mesesAtivos > 0 ? t.faturamento / mesesAtivos : 0;
    // Variação último vs penúltimo mês com pedidos
    const comPedidos = series.filter(s => s.pedidos > 0);
    const ultimo = comPedidos[comPedidos.length - 1]?.faturamento || 0;
    const penultimo = comPedidos[comPedidos.length - 2]?.faturamento || 0;
    const variacao = penultimo > 0 ? ((ultimo - penultimo) / penultimo) * 100 : 0;
    return { ...t, lucro, margem, ticketMedio, mediaMensal, variacao, mesesAtivos };
  }, [series]);

  const exportarCSV = () => {
    const headers = ['Mês', 'Faturamento', 'Custos', 'Lucro', 'Pedidos', 'Acumulado'];
    const rows = series.map(s => [s.label, s.faturamento, s.custos, s.lucro, s.pedidos, s.acumulado].join(';'));
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evolucao-mensal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (series.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground text-xs">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhum pedido registrado ainda. Cadastre pedidos para visualizar a evolução mensal.
      </Card>
    );
  }

  const tooltipFmt = (value: any, name: string) => {
    if (name === 'Pedidos') return [fmtNum(value), name];
    return [fmtBRLFull(value), name];
  };

  return (
    <Card className="p-4 space-y-4">
      {/* Header com controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h4 className="text-xs sm:text-sm font-semibold">Evolução Mensal</h4>
          <Badge variant="outline" className="text-[10px]">{series.length} {series.length === 1 ? 'mês' : 'meses'}</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select value={periodo} onValueChange={(v: Periodo) => setPeriodo(v)}>
            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6m</SelectItem>
              <SelectItem value="12m">Últimos 12m</SelectItem>
              <SelectItem value="24m">Últimos 24m</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Button variant={visual === 'composto' ? 'default' : 'ghost'} size="sm" className="h-7 px-2 rounded-none" onClick={() => setVisual('composto')} title="Combinado">
              <Activity className="w-3.5 h-3.5" />
            </Button>
            <Button variant={visual === 'barras' ? 'default' : 'ghost'} size="sm" className="h-7 px-2 rounded-none" onClick={() => setVisual('barras')} title="Barras">
              <BarChart3 className="w-3.5 h-3.5" />
            </Button>
            <Button variant={visual === 'area' ? 'default' : 'ghost'} size="sm" className="h-7 px-2 rounded-none" onClick={() => setVisual('area')} title="Acumulado">
              <LineIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={exportarCSV} title="Exportar CSV">
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border p-2.5 bg-muted/30">
          <p className="text-[10px] text-muted-foreground">Faturamento</p>
          <p className="text-sm font-bold">{fmtBRL(totais.faturamento)}</p>
          <p className="text-[9px] text-muted-foreground">Média/mês: {fmtBRL(totais.mediaMensal)}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5 bg-muted/30">
          <p className="text-[10px] text-muted-foreground">Pedidos</p>
          <p className="text-sm font-bold">{fmtNum(totais.pedidos)}</p>
          <p className="text-[9px] text-muted-foreground">Ticket: {fmtBRL(totais.ticketMedio)}</p>
        </div>
        {podeVerCustos ? (
          <>
            <div className="rounded-lg border border-border p-2.5 bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Lucro Bruto</p>
              <p className={`text-sm font-bold ${totais.lucro >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtBRL(totais.lucro)}</p>
              <p className="text-[9px] text-muted-foreground">Margem: {totais.margem.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-border p-2.5 bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Variação MoM</p>
              <p className={`text-sm font-bold flex items-center gap-1 ${totais.variacao >= 0 ? 'text-success' : 'text-destructive'}`}>
                {totais.variacao >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {totais.variacao.toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted-foreground">vs mês anterior</p>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border p-2.5 bg-muted/30 col-span-2">
            <p className="text-[10px] text-muted-foreground">Variação MoM</p>
            <p className={`text-sm font-bold flex items-center gap-1 ${totais.variacao >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totais.variacao >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {totais.variacao.toFixed(1)}%
            </p>
            <p className="text-[9px] text-muted-foreground">Faturamento vs mês anterior</p>
          </div>
        )}
      </div>

      {/* Gráfico dinâmico */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          {visual === 'composto' ? (
            <ComposedChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtBRL(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                formatter={tooltipFmt}
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar yAxisId="left" dataKey="faturamento" name="Faturamento" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              {podeVerCustos && <Bar yAxisId="left" dataKey="custos" name="Custos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />}
              {podeVerCustos && <Line yAxisId="left" type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />}
              <Line yAxisId="right" type="monotone" dataKey="pedidos" name="Pedidos" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
            </ComposedChart>
          ) : visual === 'barras' ? (
            <BarChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtBRL(v)} />
              <Tooltip
                formatter={tooltipFmt}
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              {podeVerCustos && <Bar dataKey="custos" name="Custos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />}
              {podeVerCustos && <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />}
            </BarChart>
          ) : (
            <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-acum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtBRL(v)} />
              <Tooltip
                formatter={(v: any) => fmtBRLFull(v)}
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="acumulado" name="Faturamento Acumulado" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#grad-acum)" />
              {valorGlobal > 0 && (
                <Line type="monotone" dataKey={() => valorGlobal} name="Valor Global" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="6 6" dot={false} />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground italic">
        Considera apenas pedidos não cancelados. {!podeVerCustos && 'Custos e lucro disponíveis apenas para o setor Financeiro.'}
      </p>
    </Card>
  );
}
