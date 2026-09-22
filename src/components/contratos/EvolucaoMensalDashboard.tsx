import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Calendar, TrendingUp, TrendingDown, BarChart3, LineChart as LineIcon, Activity, Download } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, AreaChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart
} from 'recharts';

/**
 * Sem centavos — SÓ para eixo de gráfico, onde o rótulo compete com o espaço e
 * a precisão não muda a leitura da curva.
 */
const fmtBRLEixo = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

/**
 * Valor de dinheiro que a pessoa lê como número, e não como tendência: cartão,
 * tabela, tooltip. Arredondar aqui fazia o mesmo contrato aparecer como
 * R$ 65.270,38 num cartão e R$ 65.270 no cartão ao lado — e quem confere
 * faturamento nota a diferença de 38 centavos antes de qualquer outra coisa.
 */
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtBRLFull = fmtBRL;
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

/** O número da variação — ou o traço, quando não há mês anterior para comparar. */
function VariacaoMoM({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <p className="text-2xl font-semibold leading-8 text-muted-foreground" title="Só um mês com pedidos: não há mês anterior para comparar">—</p>;
  }
  return (
    <p className={`flex items-center gap-1 valor-kpi text-2xl font-semibold leading-8 tabular-nums ${valor >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
      {valor >= 0 ? <TrendingUp aria-hidden="true" className="h-4 w-4" /> : <TrendingDown aria-hidden="true" className="h-4 w-4" />}
      {valor.toFixed(1)}%
    </p>
  );
}

export default function EvolucaoMensalDashboard({ pedidos, podeVerCustos, valorGlobal = 0, dataInicio, dataFim }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('12m');
  const [visual, setVisual] = useState<Visual>('composto');
  /** O período foi expandido pelo próprio gráfico? A frase de aviso depende disto. */
  const [expandidoAutomaticamente, setExpandidoAutomaticamente] = useState(false);

  const ativos = useMemo(() => pedidos.filter(p => p.status !== 'cancelado' && p.data_pedido), [pedidos]);

  /**
   * A janela nunca abre vazia quando há dados fora dela.
   *
   * O 149/2024 expôs o caso: cinco pedidos lançados, todos de fev–set/2025 —
   * e a janela padrão de 12 meses começa em out/2025. O painel dizia
   * "5 pedidos, R$ 81 mil" com o gráfico zerado ao lado, sem uma palavra de
   * explicação. O gráfico estava certo e inútil ao mesmo tempo: recorte que
   * esconde todos os dados não é recorte, é apagão.
   *
   * Só age na janela PADRÃO e uma vez — escolha manual de período nunca é
   * desfeita por máquina.
   */
  useEffect(() => {
    if (expandidoAutomaticamente || periodo !== '12m' || ativos.length === 0) return;
    const hoje = new Date();
    const inicioJanela = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
    const chaveInicio = `${inicioJanela.getFullYear()}-${String(inicioJanela.getMonth() + 1).padStart(2, '0')}`;
    const algumNaJanela = ativos.some(p => p.data_pedido!.substring(0, 7) >= chaveInicio);
    if (!algumNaJanela) {
      setPeriodo('all');
      setExpandidoAutomaticamente(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos]);

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
    // Variação último vs penúltimo mês com pedidos. Com UM mês só não há
    // "mês anterior": o 0,0% de antes, verde e com seta para cima, afirmava
    // estabilidade sobre uma comparação que não existe (contrato 17/2025,
    // 18/09). Ausência é `null`, e a tela diz por quê.
    const comPedidos = series.filter(s => s.pedidos > 0);
    const ultimo = comPedidos[comPedidos.length - 1]?.faturamento || 0;
    const penultimo = comPedidos[comPedidos.length - 2]?.faturamento || 0;
    const variacao: number | null = penultimo > 0 ? ((ultimo - penultimo) / penultimo) * 100 : null;
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
      <Card>
        <EstadoVazio
          tamanho="compacto"
          icone={<Calendar />}
          titulo="Nenhum pedido registrado ainda"
          descricao="Cadastre pedidos para visualizar a evolução mensal."
        />
      </Card>
    );
  }

  const tooltipFmt = (value: any, name: string) => {
    if (name === 'Pedidos') return [fmtNum(value), name];
    return [fmtBRLFull(value), name];
  };

  return (
    <Card className="space-y-4 p-5">
      {/* Header com controles */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <BarChart3 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-base font-semibold leading-6 text-foreground">Evolução Mensal</h4>
          <Badge variant="muted">{series.length} {series.length === 1 ? 'mês' : 'meses'}</Badge>
          {expandidoAutomaticamente && (
            <span className="text-xs text-muted-foreground">
              período expandido: os pedidos deste contrato são anteriores aos últimos 12 meses
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v: Periodo) => setPeriodo(v)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6m</SelectItem>
              <SelectItem value="12m">Últimos 12m</SelectItem>
              <SelectItem value="24m">Últimos 24m</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          {/* Controle segmentado sóbrio: o item ativo em superfície rebaixada,
              não em verde — o verde é da ação principal (Design System v3). */}
          <div className="flex items-center overflow-hidden rounded-md border border-input" role="group" aria-label="Tipo de gráfico">
            <Button variant={visual === 'composto' ? 'secondary' : 'ghost'} size="icon-sm" className="rounded-none" onClick={() => setVisual('composto')} title="Combinado" aria-label="Gráfico combinado" aria-pressed={visual === 'composto'}>
              <Activity aria-hidden="true" />
            </Button>
            <Button variant={visual === 'barras' ? 'secondary' : 'ghost'} size="icon-sm" className="rounded-none" onClick={() => setVisual('barras')} title="Barras" aria-label="Gráfico de barras" aria-pressed={visual === 'barras'}>
              <BarChart3 aria-hidden="true" />
            </Button>
            <Button variant={visual === 'area' ? 'secondary' : 'ghost'} size="icon-sm" className="rounded-none" onClick={() => setVisual('area')} title="Acumulado" aria-label="Gráfico acumulado" aria-pressed={visual === 'area'}>
              <LineIcon aria-hidden="true" />
            </Button>
          </div>
          <Button variant="outline" size="icon-sm" onClick={exportarCSV} title="Exportar CSV" aria-label="Exportar CSV">
            <Download aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="bloco-inteiro grade-kpi grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium leading-5 text-muted-foreground">Faturamento</p>
          <p className="valor-kpi text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmtBRL(totais.faturamento)}</p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">Média/mês: {fmtBRL(totais.mediaMensal)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium leading-5 text-muted-foreground">Pedidos</p>
          <p className="valor-kpi text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmtNum(totais.pedidos)}</p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">Ticket: {fmtBRL(totais.ticketMedio)}</p>
        </div>
        {podeVerCustos ? (
          <>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              {/* O custo aqui é o DECLARADO em cada pedido (22/09) — gerencial.
                  Sem declaração, margem de 100% seria afirmar que não houve
                  custo; o cartão diz que falta declarar. */}
              <p className="text-sm font-medium leading-5 text-muted-foreground">Lucro sobre o custo declarado</p>
              <p className={`valor-kpi text-2xl font-semibold leading-8 tabular-nums ${totais.custos > 0 ? (totais.lucro >= 0 ? 'text-success-ink' : 'text-destructive-ink') : 'text-muted-foreground'}`}>
                {totais.custos > 0 ? fmtBRL(totais.lucro) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{totais.custos > 0 ? `Margem: ${totais.margem.toFixed(1)}%` : 'sem custo declarado nos pedidos'}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium leading-5 text-muted-foreground">Variação MoM</p>
              <VariacaoMoM valor={totais.variacao} />
              <p className="text-xs text-muted-foreground">
                {totais.variacao === null ? 'sem mês anterior para comparar' : 'vs mês anterior'}
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-2 flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium leading-5 text-muted-foreground">Variação MoM</p>
            <VariacaoMoM valor={totais.variacao} />
            <p className="text-xs text-muted-foreground">
              {totais.variacao === null ? 'sem mês anterior para comparar' : 'Faturamento vs mês anterior'}
            </p>
          </div>
        )}
      </div>

      {/* Gráfico dinâmico — `bloco-inteiro`: a seção 4 pode continuar na folha
          seguinte, mas o gráfico nunca se parte ao meio. */}
      <div className="bloco-inteiro w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          {visual === 'composto' ? (
            <ComposedChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtBRLEixo(v)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                formatter={tooltipFmt}
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="faturamento" name="Faturamento" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              {podeVerCustos && <Bar yAxisId="left" dataKey="custos" name="Custo declarado" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />}
              {podeVerCustos && <Line yAxisId="left" type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />}
              <Line yAxisId="right" type="monotone" dataKey="pedidos" name="Pedidos" stroke="hsl(var(--chart-8))" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
            </ComposedChart>
          ) : visual === 'barras' ? (
            <BarChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtBRLEixo(v)} />
              <Tooltip
                formatter={tooltipFmt}
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              {podeVerCustos && <Bar dataKey="custos" name="Custo declarado" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />}
              {podeVerCustos && <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />}
            </BarChart>
          ) : (
            <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmtBRLEixo(v)} />
              <Tooltip
                formatter={(v: any) => fmtBRLFull(v)}
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="acumulado" name="Faturamento Acumulado" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="hsl(var(--chart-1))" fillOpacity={0.15} />
              {valorGlobal > 0 && (
                <Line type="monotone" dataKey={() => valorGlobal} name="Valor Global" stroke="hsl(var(--chart-8))" strokeWidth={1.5} strokeDasharray="6 6" dot={false} />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Considera apenas pedidos não cancelados. Custo = custo de compra declarado em cada pedido (gerencial; o comprovado está no Resumo). {!podeVerCustos && 'Custos e lucro disponíveis apenas para o setor Financeiro.'}
      </p>
    </Card>
  );
}
