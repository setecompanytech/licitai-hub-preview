import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  TrendingUp, DollarSign, Building2, Scale, FileText, Users,
  Landmark, PieChart as PieIcon, BarChart3,
} from 'lucide-react';
import {
  cenarios, cargaEfetiva, mercadoPara, buildDre,
  type CenarioClientes,
} from '@/data/relatorio-contabil-data';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ─── Cores dos gráficos ───
// Recharts recebe cor como string, então as séries vivem aqui como
// `hsl(var(--chart-N))` — a única exceção aprovada à regra "cor só por
// token Tailwind". A cromia dos eixos, grade e tooltip também é a dos tokens.
const COLORS_PIE = [
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-4))',
];

const COR_GRADE = 'hsl(var(--border))';
const TICK = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };
const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  fontSize: 14,
};

// ─── KPI Card ───
// `color` é a cor da série a que o número pertence (fatia do gráfico, linha
// do regime); por isso fica no ícone e vem por style, não por classe.
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground font-medium truncate">{label}</p>
          {/* Mesma régua do LinhaKpis compartilhado: 32/40 no desktop, um
              degrau abaixo (2xl) até md para "R$ 1.118.000/mês" caber em
              coluna de 4. `break-normal`: o valor só quebra no espaço após
              "R$", nunca no meio do número. */}
          <p className="mt-1 max-w-full break-normal text-2xl leading-8 md:text-[2rem] md:leading-10 font-bold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
        </div>
        <div className="p-2 rounded-md bg-muted flex-shrink-0">
          <Icon className="w-4 h-4" style={{ color }} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

// ─── Comparativo geral ───
function ComparativoCenarios() {
  const chartData = cenarios.map(c => ({
    name: c.label,
    receita: c.receitaBruta,
    custos: c.totalCustos,
    lucro: c.lucroLiquido,
  }));

  const margemData = cenarios.map(c => ({
    name: c.label,
    margem: c.margemLiquida,
    infraPct: +((c.custoInfra / c.receitaBruta) * 100).toFixed(2),
    equipePct: +((c.custoEquipe / c.receitaBruta) * 100).toFixed(2),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cenarios.map((c, i) => (
          <KpiCard
            key={c.clientes}
            label={c.label}
            value={fmt(c.lucroLiquido) + '/mês'}
            sub={`Margem ${fmtPct(c.margemLiquida)} · ${fmt(c.lucroAnual)}/ano`}
            icon={[Users, Building2, TrendingUp, DollarSign][i]}
            color={COLORS_PIE[i]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Receita vs Custos vs Lucro (R$/mês)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="custos" name="Custos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Margens e Composição de Custos (%)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={margemData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="margem" name="Margem Líquida" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="infraPct" name="Infra %" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="equipePct" name="Equipe %" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tabela consolidada */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Tabela Consolidada — Todos os Cenários</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-sm font-semibold text-muted-foreground">Indicador</th>
                {cenarios.map(c => <th key={c.clientes} className="text-right p-2 text-sm font-semibold">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Receita Bruta/mês', fn: (c: CenarioClientes) => fmt(c.receitaBruta) },
                { label: 'Equipe', fn: (c: CenarioClientes) => `${c.equipe} pessoas` },
                { label: 'Custo Infra/mês', fn: (c: CenarioClientes) => fmt(c.custoInfra) },
                { label: 'Custo Infra % receita', fn: (c: CenarioClientes) => fmtPct((c.custoInfra / c.receitaBruta) * 100) },
                { label: 'Total Custos+Desp', fn: (c: CenarioClientes) => fmt(c.totalCustos) },
                { label: 'EBITDA', fn: (c: CenarioClientes) => fmt(c.ebitda) },
                { label: 'Lucro Líquido/mês', fn: (c: CenarioClientes) => fmt(c.lucroLiquido) },
                { label: 'Margem Líquida', fn: (c: CenarioClientes) => fmtPct(c.margemLiquida) },
                { label: 'Lucro Líquido/ano', fn: (c: CenarioClientes) => fmt(c.lucroAnual) },
                { label: 'Custo por cliente', fn: (c: CenarioClientes) => fmt(c.custoCliente) },
              ].map((row) => (
                <tr key={row.label} className="border-b border-border hover:bg-muted">
                  <td className="p-2 font-medium text-muted-foreground">{row.label}</td>
                  {cenarios.map(c => (
                    <td key={c.clientes} className="p-2 text-right tabular-nums">{row.fn(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── DRE por regime ───
function DREComparativa() {
  const [cenarioIdx, setCenarioIdx] = useState(2); // 500 clientes
  const cenario = cenarios[cenarioIdx];
  const regimes = ['simples', 'presumido', 'real'] as const;
  const regimeLabels = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'];
  const regimeCores = ['hsl(var(--success))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))'];

  const dres = regimes.map(r => buildDre(cenario, r));
  const lucros = dres.map(d => d.find(l => l.item === 'Lucro Líquido')!);
  const tributosTotais = dres.map(d => Math.abs(d.find(l => l.item === 'Total Tributos')!.valor));

  const compData = regimeLabels.map((label, i) => ({
    regime: label,
    tributos: tributosTotais[i],
    lucro: lucros[i].valor,
    cargaPct: tributosTotais[i] / cenario.receitaBruta * 100,
  }));

  // Impossível usar Simples acima de 4.8M/ano
  const simplesDisponivel = cenario.receitaBruta * 12 <= 4800000;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Label htmlFor="dre-cenario">Cenário</Label>
        <Select value={String(cenarioIdx)} onValueChange={v => setCenarioIdx(Number(v))}>
          <SelectTrigger id="dre-cenario" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {cenarios.map((c, i) => <SelectItem key={i} value={String(i)}>{c.label} — {fmt(c.receitaBruta)}/mês</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!simplesDisponivel && (
        <div role="status" className="rounded-md border border-warning-line bg-warning-tint p-3 text-sm text-warning-ink">
          <Scale className="inline w-4 h-4 mr-1" aria-hidden="true" />
          Simples Nacional <strong>indisponível</strong> para faturamento acima de R$ 4.800.000/ano (LC 123/2006, Art. 3º, II).
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {regimeLabels.map((label, i) => {
          const disabled = i === 0 && !simplesDisponivel;
          return (
            <KpiCard
              key={label}
              label={label}
              value={disabled ? 'N/A' : fmt(lucros[i].valor) + '/mês'}
              sub={disabled ? 'Excede limite LC 123' : `Tributos: ${fmt(tributosTotais[i])} (${fmtPct(compData[i].cargaPct)})`}
              icon={Landmark}
              color={disabled ? 'hsl(var(--muted-foreground))' : regimeCores[i]}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Tributos vs Lucro por Regime</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compData.filter((_, i) => i !== 0 || simplesDisponivel)}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis dataKey="regime" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="tributos" name="Tributos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro Líquido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Carga Tributária Efetiva por Escala</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cargaEfetiva}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis dataKey="clientes" tick={TICK} />
              <YAxis tick={TICK} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="simplesNacional" name="Simples" stroke="hsl(var(--success))" strokeWidth={2} />
              <Line type="monotone" dataKey="lucroPresumido" name="Presumido" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              <Line type="monotone" dataKey="lucroReal" name="Real" stroke="hsl(var(--chart-4))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* DRE Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">DRE Comparativa — {cenario.label}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-sm font-semibold text-muted-foreground">Item</th>
                {regimeLabels.map((r, i) => (
                  <th key={r} className="text-right p-2 text-sm font-semibold" style={{ color: regimeCores[i] }}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dres[0].map((line, idx) => {
                const isBold = line.grupo === 'receita' || line.grupo === 'resultado' || line.item === 'Total Tributos';
                return (
                  <tr key={line.item} className={`border-b border-border ${isBold ? 'bg-muted font-semibold' : ''} hover:bg-muted`}>
                    <td className="p-2">{line.item}</td>
                    {dres.map((dre, ri) => {
                      const disabled = ri === 0 && !simplesDisponivel;
                      const val = dre[idx];
                      return (
                        <td key={ri} className={`p-2 text-right tabular-nums ${val.valor < 0 ? 'text-destructive' : ''}`}>
                          {disabled ? '—' : fmt(Math.abs(val.valor))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Composição de Custos ───
function ComposicaoCustos() {
  const pieData = [
    { name: 'Infraestrutura', value: 2349, color: 'hsl(var(--chart-3))' },
    { name: 'Equipe', value: 33000, color: 'hsl(var(--chart-2))' },
    { name: 'Operacional', value: 10800, color: 'hsl(var(--chart-5))' },
    { name: 'Tributos', value: 51991, color: 'hsl(var(--destructive))' },
    { name: 'Inadimplência', value: 13925, color: 'hsl(var(--chart-4))' },
    { name: 'Reserva', value: 8355, color: 'hsl(var(--muted-foreground))' },
  ];

  const escalaInfra = cenarios.map(c => ({
    name: c.label,
    infraAbs: c.custoInfra,
    infraPct: +((c.custoInfra / c.receitaBruta) * 100).toFixed(2),
    receita: c.receitaBruta,
  }));

  const radarData = [
    { metric: 'Margem', c20: 59.4, c50: 52.2, c500: 56.8, c1000: 53.1 },
    { metric: 'Infra %', c20: 100 - 4.31, c50: 100 - 3.14, c500: 100 - 0.84, c1000: 100 - 0.83 },
    { metric: 'Equipe %', c20: 100, c50: 100 - 12, c500: 100 - 11.85, c1000: 100 - 13.82 },
    { metric: 'Escala', c20: 10, c50: 25, c500: 80, c1000: 100 },
    { metric: 'ROI', c20: 40, c50: 55, c500: 85, c1000: 90 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Composição de Custos (500 clientes)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Eficiência de Infraestrutura por Escala</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={escalaInfra}>
              <defs>
                <linearGradient id="gradInfra" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="infraPct" name="Infra % Receita" stroke="hsl(var(--chart-3))" fill="url(#gradInfra)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Radar de Performance por Escala</h2>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={COR_GRADE} />
            <PolarAngleAxis dataKey="metric" tick={TICK} />
            <PolarRadiusAxis tick={false} domain={[0, 100]} />
            <Radar name="20 clientes" dataKey="c20" stroke="hsl(var(--chart-5))" fill="hsl(var(--chart-5))" fillOpacity={0.1} />
            <Radar name="500 clientes" dataKey="c500" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
            <Radar name="1.000 clientes" dataKey="c1000" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.15} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Mercado Regional ───
function MercadoRegional() {
  const concData = mercadoPara.concorrentes.map(c => ({
    name: c.nome,
    penetracao: c.penetracao,
  }));

  const projecaoData = [
    { mes: 'M1', clientes: 5, receita: 1485 },
    { mes: 'M3', clientes: 20, receita: 5940 },
    { mes: 'M6', clientes: 50, receita: 14850 },
    { mes: 'M9', clientes: 100, receita: 34700 },
    { mes: 'M12', clientes: 180, receita: 62460 },
    { mes: 'M18', clientes: 350, receita: 130000 },
    { mes: 'M24', clientes: 500, receita: 211000 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Municípios (PA)" value="144" icon={Building2} color="hsl(var(--chart-2))" />
        <KpiCard label="Volume Anual" value={mercadoPara.volumeAnual} icon={DollarSign} color="hsl(var(--success))" />
        <KpiCard label="Empresas Ativas" value={mercadoPara.empresasAtivas.toLocaleString('pt-BR')} icon={Users} color="hsl(var(--chart-3))" />
        <KpiCard label="Penetração Digital" value={`${mercadoPara.penetracaoDigital}%`} sub="Oportunidade: 82% sem solução" icon={TrendingUp} color="hsl(var(--chart-5))" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Penetração de Mercado — Pará</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={concData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis type="number" unit="%" tick={TICK} />
              <YAxis type="category" dataKey="name" tick={TICK} width={120} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="penetracao" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Projeção de Crescimento — Regional PA</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={projecaoData}>
              <defs>
                <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} />
              <XAxis dataKey="mes" tick={TICK} />
              <YAxis tick={TICK} tickFormatter={v => fmt(v)} />
              <Tooltip formatter={(v: number, name: string) => [name === 'receita' ? fmt(v) : v, name === 'receita' ? 'Receita' : 'Clientes']} contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--success))" fill="url(#gradProj)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Polos */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Polos Econômicos Estratégicos — Pará</h2>
        <div className="flex flex-wrap gap-2">
          {mercadoPara.polos.map(p => (
            <Badge key={p} variant="muted">{p}</Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Fonte: IBGE/RAIS 2024 · SEBRAE-PA · Portal de Compras do Governo Federal
        </p>
      </Card>
    </div>
  );
}

// ─── Parecer Técnico ───
function ParecerTecnico() {
  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Parecer Técnico-Contábil
      </h2>

      <div className="space-y-4 text-base text-foreground">
        <div>
          <h3 className="text-base font-semibold mb-1">1. Objeto</h3>
          <p className="text-muted-foreground">
            Análise de viabilidade econômico-financeira da plataforma Praefectus, SaaS B2B destinado à gestão inteligente de licitações públicas,
            com projeções para 4 cenários de escala (20, 50, 500 e 1.000 clientes), comparação tributária entre Simples Nacional,
            Lucro Presumido e Lucro Real, e análise do mercado regional do Estado do Pará.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold mb-1">2. Fundamentação Legal</h3>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><strong>Lei 14.133/2021</strong> — Nova Lei de Licitações e Contratos Administrativos</li>
            <li><strong>LC 123/2006</strong> — Estatuto da Microempresa e EPP (Simples Nacional)</li>
            <li><strong>NBC TSP / CPC</strong> — Normas Brasileiras de Contabilidade</li>
            <li><strong>RIR/2018 (Dec. 9.580)</strong> — Regulamento do Imposto de Renda</li>
            <li><strong>IN RFB 1.700/2017</strong> — Tributação do Lucro Presumido e Real</li>
            <li><strong>ABNT NBR 14724</strong> — Trabalhos acadêmicos e técnicos</li>
          </ul>
        </div>

        <div>
          <h3 className="text-base font-semibold mb-1">3. Análise Tributária</h3>
          <p className="text-muted-foreground">
            <strong>Simples Nacional:</strong> Viável apenas até 500 clientes (faturamento ≤ R$ 4,8M/ano). Alíquota efetiva de 6% a 21%,
            com vantagem até ~50 clientes pela simplicidade operacional e carga reduzida.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Lucro Presumido:</strong> Regime intermediário com carga de 16,33% a 19,17%. Indicado para faturamento de R$ 100k a R$ 400k/mês,
            onde a presunção de 32% sobre a receita bruta (Art. 15, Lei 9.249/95) ainda é vantajosa frente à margem real.
          </p>
          <p className="text-muted-foreground mt-2">
            <strong>Lucro Real:</strong> Torna-se vantajoso a partir de ~400 clientes quando a dedução de despesas com equipe (R$ 77k/mês no cenário 1.000)
            reduz a base de cálculo do IRPJ/CSLL. Carga efetiva cai para 15,5% no cenário de 1.000 clientes — <strong>economia de R$ 20k/mês vs Presumido</strong>.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold mb-1">4. Viabilidade Operacional</h3>
          <p className="text-muted-foreground">
            O modelo serverless (Cloud) demonstra escalabilidade excepcional: enquanto a receita multiplica por 66x (de 20 para 1.000 clientes),
            a infraestrutura multiplica apenas 12,7x, representando queda de 4,31% para 0,83% da receita. O break-even operacional
            ocorre com aproximadamente 8 clientes, considerando custos mínimos de infraestrutura e Simples Nacional.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold mb-1">5. Mercado Regional — Estado do Pará</h3>
          <p className="text-muted-foreground">
            O Pará apresenta 144 municípios com volume anual de compras públicas estimado entre R$ 15–20 bilhões, porém com penetração digital
            de apenas 18%. Há aproximadamente 3.200 empresas ativas em licitações, sendo que 60% ainda utilizam consultorias manuais
            (R$ 500–2.000/mês). O "Plano Pará" (R$ 147/mês) posiciona a Praefectus como alternativa competitiva, com diferencial
            nos portais regionais (Banparanet, IOEPA) que concorrentes nacionais não cobrem.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold mb-1">6. Recomendações</h3>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Adotar <strong>Simples Nacional</strong> até 50 clientes (bootstrap/validação).</li>
            <li>Migrar para <strong>Lucro Presumido</strong> entre 50–400 clientes (crescimento).</li>
            <li>Avaliar <strong>Lucro Real</strong> a partir de 400 clientes, quando despesas com equipe superam 10% da receita.</li>
            <li>Manter reserva técnica de 3% para contingências trabalhistas e fiscais.</li>
            <li>Contratar seguro de responsabilidade civil profissional (E&O) ao atingir 100 clientes.</li>
            <li>Implementar compliance tributário automatizado com revisão trimestral de regime.</li>
          </ul>
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <p className="text-xs text-muted-foreground italic">
            Este parecer possui caráter técnico-consultivo, não substituindo orientação contábil e jurídica individualizada.
            Valores projetados com base em dados de mercado disponíveis em {new Date().toLocaleDateString('pt-BR')}.
            Conforme NBC PA 01, as projeções consideram premissas razoáveis sujeitas a variações de mercado.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ─── Página Principal ───
export default function RelatorioContabil() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <CabecalhoPagina
          icone={<FileText />}
          titulo="Relatório Contábil e Tributário"
          descricao="Análise de viabilidade da plataforma Praefectus — SaaS B2B para licitações públicas. Elaborado conforme ABNT NBR 14724 · NBC TSP · Lei 14.133/2021 · Lei Complementar 123/2006."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Data: {new Date().toLocaleDateString('pt-BR')}</Badge>
            <Badge variant="info">Classificação: Confidencial</Badge>
            <Badge variant="info">Revisão: 1.0</Badge>
          </div>
        </CabecalhoPagina>

        <Tabs defaultValue="comparativo" className="w-full space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="comparativo">
              <BarChart3 className="w-4 h-4 mr-1" aria-hidden="true" /> Cenários
            </TabsTrigger>
            <TabsTrigger value="dre">
              <Scale className="w-4 h-4 mr-1" aria-hidden="true" /> DRE Tributária
            </TabsTrigger>
            <TabsTrigger value="custos">
              <PieIcon className="w-4 h-4 mr-1" aria-hidden="true" /> Custos
            </TabsTrigger>
            <TabsTrigger value="mercado">
              <Building2 className="w-4 h-4 mr-1" aria-hidden="true" /> Mercado PA
            </TabsTrigger>
            <TabsTrigger value="parecer">
              <FileText className="w-4 h-4 mr-1" aria-hidden="true" /> Parecer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comparativo"><ComparativoCenarios /></TabsContent>
          <TabsContent value="dre"><DREComparativa /></TabsContent>
          <TabsContent value="custos"><ComposicaoCustos /></TabsContent>
          <TabsContent value="mercado"><MercadoRegional /></TabsContent>
          <TabsContent value="parecer"><ParecerTecnico /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
