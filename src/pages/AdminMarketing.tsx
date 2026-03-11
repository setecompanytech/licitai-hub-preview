import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Users, TrendingUp, DollarSign, Target, ArrowUpRight, ArrowDownRight, Search, Download, RefreshCw, Megaphone, Eye, MousePointerClick, UserPlus } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

const PLANO_VALORES: Record<string, number> = { basico: 197, profissional: 497, enterprise: 997 };
const COLORS = ['hsl(174 72% 45%)', 'hsl(210 100% 50%)', 'hsl(45 93% 47%)', 'hsl(0 72% 50%)', 'hsl(280 72% 50%)'];

export default function AdminMarketing() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAdmin && !roleLoading) return;
    fetchLeads();
  }, [isAdmin, roleLoading, period]);

  const fetchLeads = async () => {
    setLoading(true);
    const since = subDays(new Date(), parseInt(period)).toISOString();
    const { data } = await supabase
      .from('leads')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    setLeads((data as any[]) || []);
    setLoading(false);
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = leads.length;
    const convertidos = leads.filter(l => l.convertido);
    const taxaConversao = total > 0 ? (convertidos.length / total * 100) : 0;
    const receitaTotal = convertidos.reduce((s, l) => s + (l.valor_convertido || PLANO_VALORES[l.plano_convertido] || 0), 0);
    const custoMkt = 8000; // estimativa mensal
    const cac = total > 0 ? custoMkt / (convertidos.length || 1) : 0;
    const ticketMedio = convertidos.length > 0 ? receitaTotal / convertidos.length : 0;
    const ltv = ticketMedio * 12; // retenção 12 meses estimada

    return { total, convertidos: convertidos.length, taxaConversao, receitaTotal, cac, ltv, ticketMedio };
  }, [leads]);

  // Chart data: leads por dia
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), parseInt(period)), end: new Date() });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLeads = leads.filter(l => l.created_at?.startsWith(dayStr));
      const conv = dayLeads.filter(l => l.convertido);
      return {
        data: format(day, 'dd/MM', { locale: ptBR }),
        leads: dayLeads.length,
        conversoes: conv.length,
      };
    });
  }, [leads, period]);

  // Source breakdown
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.utm_source || l.origem || 'direto';
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [leads]);

  // UF breakdown
  const ufData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { if (l.uf) map[l.uf] = (map[l.uf] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [leads]);

  // Status breakdown
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { map[l.status || 'novo'] = (map[l.status || 'novo'] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  // Campaign breakdown
  const campaignData = useMemo(() => {
    const map: Record<string, { leads: number; conversoes: number }> = {};
    leads.forEach(l => {
      const camp = l.utm_campaign || '(sem campanha)';
      if (!map[camp]) map[camp] = { leads: 0, conversoes: 0 };
      map[camp].leads++;
      if (l.convertido) map[camp].conversoes++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      leads: v.leads,
      conversoes: v.conversoes,
      taxa: v.leads > 0 ? (v.conversoes / v.leads * 100).toFixed(1) : '0',
    })).sort((a, b) => b.leads - a.leads);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.nome?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.empresa?.toLowerCase().includes(q) ||
      l.uf?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  if (roleLoading) return <AppLayout><div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div></AppLayout>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const statusColor = (s: string) => {
    if (s === 'convertido') return 'default';
    if (s === 'qualificado') return 'secondary';
    if (s === 'contatado') return 'outline';
    return 'destructive';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-accent" />
              Painel de Marketing
            </h1>
            <p className="text-sm text-muted-foreground">Métricas de aquisição, leads e conversões</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="180">6 meses</SelectItem>
                <SelectItem value="365">1 ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchLeads}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: kpis.total, icon: UserPlus, color: 'text-accent' },
            { label: 'Conversões', value: kpis.convertidos, icon: Target, color: 'text-green-500', sub: `${kpis.taxaConversao.toFixed(1)}%` },
            { label: 'CAC', value: `R$ ${kpis.cac.toFixed(0)}`, icon: DollarSign, color: 'text-yellow-500' },
            { label: 'LTV Estimado', value: `R$ ${kpis.ltv.toFixed(0)}`, icon: TrendingUp, color: 'text-blue-500', sub: `${kpis.ltv > 0 && kpis.cac > 0 ? (kpis.ltv / kpis.cac).toFixed(1) : '0'}x ROI` },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="evolucao">
          <TabsList>
            <TabsTrigger value="evolucao">Evolução</TabsTrigger>
            <TabsTrigger value="fontes">Fontes</TabsTrigger>
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
            <TabsTrigger value="geografico">Geográfico</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>

          {/* Evolução */}
          <TabsContent value="evolucao" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Leads & Conversões por Dia</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Area type="monotone" dataKey="leads" stroke="hsl(174 72% 45%)" fill="hsl(174 72% 45% / 0.2)" name="Leads" />
                      <Area type="monotone" dataKey="conversoes" stroke="hsl(210 100% 50%)" fill="hsl(210 100% 50% / 0.2)" name="Conversões" />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Status do Funil</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fontes */}
          <TabsContent value="fontes">
            <Card>
              <CardHeader><CardTitle className="text-sm">Origem dos Leads (UTM Source)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={sourceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                    <Bar dataKey="value" fill="hsl(174 72% 45%)" radius={[0, 6, 6, 0]} name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campanhas */}
          <TabsContent value="campanhas">
            <Card>
              <CardHeader><CardTitle className="text-sm">Desempenho por Campanha (UTM Campaign)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Conversões</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignData.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.leads}</TableCell>
                        <TableCell className="text-right">{c.conversoes}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={parseFloat(c.taxa) > 10 ? 'default' : 'secondary'}>{c.taxa}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {campaignData.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma campanha registrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Geográfico */}
          <TabsContent value="geografico">
            <Card>
              <CardHeader><CardTitle className="text-sm">Top 10 Estados</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={ufData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                    <Bar dataKey="value" fill="hsl(210 100% 50%)" radius={[6, 6, 0, 0]} name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lista de Leads */}
          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar lead..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="outline">{filteredLeads.length} resultados</Badge>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>UF</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.slice(0, 100).map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                          <TableCell>{lead.empresa || '—'}</TableCell>
                          <TableCell>{lead.uf || '—'}</TableCell>
                          <TableCell><Badge variant="outline">{lead.utm_source || lead.origem || 'direto'}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.utm_campaign || '—'}</TableCell>
                          <TableCell><Badge variant={statusColor(lead.status)}>{lead.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.created_at ? format(parseISO(lead.created_at), 'dd/MM/yy HH:mm') : '—'}</TableCell>
                        </TableRow>
                      ))}
                      {filteredLeads.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lead encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Pixel Config Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4 text-accent" />
              Configuração de Pixels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Para ativar o rastreamento, adicione seus IDs nos scripts do <code className="bg-muted px-1.5 py-0.5 rounded text-xs">index.html</code>:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium text-foreground mb-1">Meta Pixel (Facebook)</p>
                <p className="text-xs">Substitua <code>YOUR_PIXEL_ID</code> pelo ID do pixel</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium text-foreground mb-1">Google Analytics 4</p>
                <p className="text-xs">Substitua <code>G-XXXXXXXXXX</code> pelo ID de medição</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium text-foreground mb-1">Google Ads Tag</p>
                <p className="text-xs">Substitua <code>AW-CONVERSION_ID</code> pelo ID de conversão</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium text-foreground mb-1">UTM Tracking</p>
                <p className="text-xs">✅ Ativo automaticamente — captura params da URL</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
