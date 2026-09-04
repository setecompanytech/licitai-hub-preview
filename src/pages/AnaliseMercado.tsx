import { useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Package,
  Building2, Search, Download, PieChart, Activity, Landmark, FileText, Shield
} from 'lucide-react';
import TransparenciaPA from '@/components/analise-mercado/TransparenciaPA';
import TarjaExemplo from '@/components/shared/TarjaExemplo';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import ContratosGov from '@/components/analise-mercado/ContratosGov';
import ContratosTransparencia from '@/components/analise-mercado/ContratosTransparencia';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { transparenciaPortais, estadosPortais, capitaisPortais, type TransparenciaPortal } from '@/data/transparencia-portais';

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

/* `modalidadeData` fixo saiu daqui: a distribuição por modalidade passou a vir
   do `useAnalyticsData`, que o app já carrega. Virou dado real sem custar
   consulta nova — mas mudou de assunto, e o título diz isso: é a carteira DA
   EMPRESA, não o mercado. Confundir as duas seria trocar um número inventado
   por um número verdadeiro respondendo a pergunta errada. */

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
  const [portalSelecionado, setPortalSelecionado] = useState<string>('estado-PA');

  /* A única coisa desta aba que o app sabe de verdade: a carteira da empresa.
     Vem do mesmo hook do painel, então não custa consulta nova. */
  const { modalidadeBreakdown } = useAnalyticsData();
  const modalidadePorCarteira = useMemo(
    () =>
      modalidadeBreakdown
        .map((m) => ({ name: m.modalidade, value: m.total }))
        .sort((a, b) => b.value - a.value),
    [modalidadeBreakdown],
  );

  const portalAtual: TransparenciaPortal = transparenciaPortais.find(p => `${p.tipo}-${p.sigla}-${p.nome}` === portalSelecionado)
    || transparenciaPortais.find(p => p.tipo === 'estado' && p.sigla === 'PA')!;

  const handlePortalChange = (value: string) => {
    setPortalSelecionado(value);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
              Análise de Mercado
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Resultados por segmento, preços praticados e produtos mais solicitados
            </p>
          </div>
          <Button variant="outline" size="sm" className="self-start sm:self-auto flex-shrink-0">
            <Download className="w-4 h-4 mr-1" /> Exportar Relatório
          </Button>
        </div>

        {/* KPIs — os quatro números e as quatro variações são fixos no código.
            A tarja fica ACIMA da grade, não em cada cartão: quatro tarjas
            iguais viram padrão visual e param de ser lidas; uma sobre o
            conjunto cobre o conjunto. */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold">Panorama do mercado</h2>
            <TarjaExemplo detalhe="Exige uma fonte agregada de mercado; o app hoje só conhece a carteira da empresa." />
          </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Licitações/mês</span>
            </div>
            <p className="text-2xl font-bold">4.657</p>
            <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +12% vs mês anterior</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Volume financeiro</span>
            </div>
            <p className="text-2xl font-bold">R$ 3,2 bi</p>
            <span className="text-xs text-success flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +8% vs mês anterior</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Órgãos contratando</span>
            </div>
            <p className="text-2xl font-bold">1.234</p>
            <span className="text-xs text-muted-foreground">em todo o Brasil</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Valor médio</span>
            </div>
            <p className="text-2xl font-bold">R$ 687 mil</p>
            <span className="text-xs text-destructive flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> -3% vs mês anterior</span>
          </div>
        </div>
        </div>

        <Tabs defaultValue="transparencia" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="transparencia"><Landmark className="w-4 h-4 mr-1" /> Transparência</TabsTrigger>
              <TabsTrigger value="contratos-gov"><FileText className="w-4 h-4 mr-1" /> Contratos Gov</TabsTrigger>
              <TabsTrigger value="transparencia-federal"><Shield className="w-4 h-4 mr-1" /> Federal (API)</TabsTrigger>
              <TabsTrigger value="segmentos"><PieChart className="w-4 h-4 mr-1" /> Por Segmento</TabsTrigger>
              <TabsTrigger value="precos"><TrendingUp className="w-4 h-4 mr-1" /> Preços Praticados</TabsTrigger>
              <TabsTrigger value="produtos"><Package className="w-4 h-4 mr-1" /> Mais Solicitados</TabsTrigger>
            </TabsList>

            {/* Portal selector - shown next to tabs */}
            <Select value={portalSelecionado} onValueChange={handlePortalChange}>
              <SelectTrigger className="w-64 h-9 text-sm">
                <Landmark className="w-4 h-4 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecione o portal" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <SelectGroup>
                  <SelectLabel>Estados e Distrito Federal</SelectLabel>
                  {estadosPortais.map(p => (
                    <SelectItem key={`estado-${p.sigla}-${p.nome}`} value={`estado-${p.sigla}-${p.nome}`}>
                      {p.nome} ({p.sigla})
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Capitais</SelectLabel>
                  {capitaisPortais.map(p => (
                    <SelectItem key={`capital-${p.sigla}-${p.nome}`} value={`capital-${p.sigla}-${p.nome}`}>
                      {p.nome} ({p.sigla})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="transparencia">
            <TransparenciaPA key={portalSelecionado} portal={portalAtual} />
          </TabsContent>

          <TabsContent value="contratos-gov">
            <ContratosGov />
          </TabsContent>

          <TabsContent value="transparencia-federal">
            <ContratosTransparencia />
          </TabsContent>

          <TabsContent value="segmentos" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="text-sm font-semibold">Licitações por Segmento</h3>
                  <TarjaExemplo detalhe="Exige uma fonte de mercado por CNAE — não existe no banco hoje." />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={segmentoData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="segmento" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="licitacoes" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Este é REAL: sai do useAnalyticsData, escopado por empresa_id.
                  O título carrega "Sua carteira" porque a resposta mudou de
                  pergunta — é a distribuição dos SEUS processos, não a do
                  mercado. */}
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-sm font-semibold">Distribuição por Modalidade</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success-line bg-success-tint px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-success-ink">
                    Sua carteira
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Os processos desta empresa, por modalidade.
                </p>
                {modalidadePorCarteira.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-20 text-center">
                    Nenhum processo cadastrado ainda — o gráfico aparece assim que houver o primeiro.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={270}>
                    <RPieChart>
                      <Pie
                        data={modalidadePorCarteira}
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                      >
                        {modalidadePorCarteira.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [`${v} processo${v === 1 ? '' : 's'}`, n]} />
                    </RPieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="precos">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold">Evolução de Preços – Últimos 6 Meses (em milhões R$)</h3>
                <TarjaExemplo detalhe="Exige série histórica de preços homologados; o app guarda os processos, não a série do mercado." />
              </div>
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
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold">Produtos e Serviços Mais Solicitados</h3>
                  <TarjaExemplo detalhe="Exige o catálogo de itens dos editais agregado por descrição." />
                </div>
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
                        <span className="text-lg font-bold text-foreground w-8 text-center">{i + 1}º</span>
                        <div>
                          <p className="text-sm font-medium">{produto.item}</p>
                          <p className="text-xs text-muted-foreground">{produto.qtd} licitações encontradas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{produto.valorMedio}</p>
                        <p className="text-xs text-muted-foreground">valor médio</p>
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
