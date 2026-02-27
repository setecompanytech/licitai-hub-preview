import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package,
  Building2, MapPin, Search, Download, PieChart, Activity, Landmark
} from 'lucide-react';
import TransparenciaPA from '@/components/analise-mercado/TransparenciaPA';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const segmentoData = [
  { segmento: 'Construção Civil', licitacoes: 1245, valor: 890000000 },
  { segmento: 'TI e Telecom', licitacoes: 987, valor: 560000000 },
  { segmento: 'Saúde', licitacoes: 856, valor: 450000000 },
  { segmento: 'Educação', licitacoes: 634, valor: 320000000 },
  { segmento: 'Transporte', licitacoes: 523, valor: 780000000 },
  { segmento: 'Alimentação', licitacoes: 412, valor: 180000000 },
];

const precosData = [
  { mes: 'Set', medio: 2500000, maximo: 15000000, minimo: 500000 },
  { mes: 'Out', medio: 2800000, maximo: 18000000, minimo: 450000 },
  { mes: 'Nov', medio: 3100000, maximo: 22000000, minimo: 600000 },
  { mes: 'Dez', medio: 2900000, maximo: 20000000, minimo: 480000 },
  { mes: 'Jan', medio: 3400000, maximo: 25000000, minimo: 550000 },
  { mes: 'Fev', medio: 3200000, maximo: 23000000, minimo: 520000 },
];

const modalidadeData = [
  { name: 'Pregão Eletrônico', value: 45 },
  { name: 'Concorrência', value: 20 },
  { name: 'Dispensa', value: 18 },
  { name: 'Tomada de Preço', value: 10 },
  { name: 'Outros', value: 7 },
];

const produtosMaisSolicitados = [
  { item: 'Serviços de engenharia civil', qtd: 342, valorMedio: 'R$ 4.500.000' },
  { item: 'Pavimentação asfáltica', qtd: 256, valorMedio: 'R$ 8.200.000' },
  { item: 'Reforma predial', qtd: 198, valorMedio: 'R$ 1.800.000' },
  { item: 'Sinalização viária', qtd: 167, valorMedio: 'R$ 950.000' },
  { item: 'Construção de pontes', qtd: 89, valorMedio: 'R$ 22.000.000' },
  { item: 'Drenagem urbana', qtd: 78, valorMedio: 'R$ 3.400.000' },
  { item: 'Terraplanagem', qtd: 65, valorMedio: 'R$ 5.600.000' },
  { item: 'Instalações elétricas', qtd: 54, valorMedio: 'R$ 780.000' },
];

const COLORS = ['hsl(var(--accent))', 'hsl(var(--info))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

const formatCurrency = (v: number) => (v / 1000000).toFixed(0) + 'M';

export default function AnaliseMercado() {
  const [busca, setBusca] = useState('');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-accent" />
              Análise de Mercado
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resultados por segmento, preços praticados e produtos mais solicitados
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" /> Exportar Relatório
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Licitações/mês</span>
            </div>
            <p className="text-2xl font-bold">4.657</p>
            <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +12% vs mês anterior</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Volume financeiro</span>
            </div>
            <p className="text-2xl font-bold">R$ 3,2 bi</p>
            <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +8% vs mês anterior</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Órgãos contratando</span>
            </div>
            <p className="text-2xl font-bold">1.234</p>
            <span className="text-xs text-muted-foreground">em todo o Brasil</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Valor médio</span>
            </div>
            <p className="text-2xl font-bold">R$ 687 mil</p>
            <span className="text-xs text-destructive flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> -3% vs mês anterior</span>
          </div>
        </div>

        <Tabs defaultValue="transparencia-pa" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transparencia-pa"><Landmark className="w-4 h-4 mr-1" /> Transparência PA</TabsTrigger>
            <TabsTrigger value="segmentos"><PieChart className="w-4 h-4 mr-1" /> Por Segmento</TabsTrigger>
            <TabsTrigger value="precos"><TrendingUp className="w-4 h-4 mr-1" /> Preços Praticados</TabsTrigger>
            <TabsTrigger value="produtos"><Package className="w-4 h-4 mr-1" /> Mais Solicitados</TabsTrigger>
          </TabsList>

          <TabsContent value="transparencia-pa">
            <TransparenciaPA />
          </TabsContent>



          <TabsContent value="segmentos" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-4">Licitações por Segmento</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={segmentoData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="segmento" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="licitacoes" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-4">Distribuição por Modalidade</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RPieChart>
                    <Pie data={modalidadeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                      {modalidadeData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="precos">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Evolução de Preços – Últimos 6 Meses (em milhões R$)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={precosData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `R$ ${(v / 1000000).toFixed(1)}M`} />
                  <Legend />
                  <Line type="monotone" dataKey="maximo" stroke="hsl(var(--destructive))" name="Máximo" strokeWidth={2} />
                  <Line type="monotone" dataKey="medio" stroke="hsl(var(--accent))" name="Médio" strokeWidth={2} />
                  <Line type="monotone" dataKey="minimo" stroke="hsl(var(--success))" name="Mínimo" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="produtos">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Produtos e Serviços Mais Solicitados</h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10 h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                {produtosMaisSolicitados
                  .filter(p => !busca || p.item.toLowerCase().includes(busca.toLowerCase()))
                  .map((produto, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-accent w-8 text-center">{i + 1}º</span>
                        <div>
                          <p className="text-sm font-medium">{produto.item}</p>
                          <p className="text-xs text-muted-foreground">{produto.qtd} licitações encontradas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{produto.valorMedio}</p>
                        <p className="text-[10px] text-muted-foreground">valor médio</p>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
