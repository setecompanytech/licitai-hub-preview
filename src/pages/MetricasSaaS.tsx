import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DollarSign, Users, TrendingUp, TrendingDown, BarChart3, RefreshCw,
  ArrowUpRight, ArrowDownRight, Loader2, AlertTriangle, Building2, UserCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const COLORS = ['hsl(210,100%,50%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(280,60%,50%)', 'hsl(0,72%,51%)'];

interface SaaSMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  churnRate: number;
  ltv: number;
  arpu: number;
  revenue30d: number;
  totalCustomers: number;
  totalUsers: number;
  totalEmpresas: number;
  recentCancellations: number;
  planBreakdown: { name: string; count: number; mrr: number }[];
  monthlyTrend: { month: string; mrr: number; customers: number }[];
}

export default function MetricasSaaS() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SaaSMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error: fnError } = await supabase.functions.invoke('saas-metrics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar métricas');
      toast.error('Erro ao carregar métricas SaaS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetrics(); }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !metrics) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <p className="text-muted-foreground">{error || 'Sem dados disponíveis'}</p>
          <Button onClick={fetchMetrics} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      </AppLayout>
    );
  }

  const kpiCards = [
    { label: 'MRR', value: formatBRL(metrics.mrr), icon: DollarSign, color: 'text-blue-500', desc: 'Receita Mensal Recorrente' },
    { label: 'ARR', value: formatBRL(metrics.arr), icon: TrendingUp, color: 'text-emerald-500', desc: 'Receita Anual Recorrente' },
    { label: 'Assinaturas Ativas', value: metrics.activeSubscriptions.toString(), icon: UserCheck, color: 'text-violet-500', desc: 'Planos ativos no Stripe' },
    { label: 'Churn Rate', value: `${metrics.churnRate}%`, icon: TrendingDown, color: metrics.churnRate > 5 ? 'text-destructive' : 'text-emerald-500', desc: 'Cancelamentos nos últimos 30 dias' },
    { label: 'LTV', value: formatBRL(metrics.ltv), icon: BarChart3, color: 'text-amber-500', desc: 'Lifetime Value médio' },
    { label: 'ARPU', value: formatBRL(metrics.arpu), icon: DollarSign, color: 'text-cyan-500', desc: 'Receita média por assinante' },
    { label: 'Receita 30d', value: formatBRL(metrics.revenue30d), icon: ArrowUpRight, color: 'text-emerald-500', desc: 'Faturamento últimos 30 dias' },
    { label: 'Usuários', value: metrics.totalUsers.toString(), icon: Users, color: 'text-blue-500', desc: 'Usuários cadastrados' },
    { label: 'Empresas', value: metrics.totalEmpresas.toString(), icon: Building2, color: 'text-violet-500', desc: 'Empresas ativas' },
    { label: 'Cancelamentos', value: metrics.recentCancellations.toString(), icon: ArrowDownRight, color: 'text-destructive', desc: 'Nos últimos 30 dias' },
  ];

  return (
    <AppLayout>
      <Helmet><title>Métricas SaaS | PRAEFECTUS Admin</title></Helmet>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas SaaS</h1>
          <p className="text-sm text-muted-foreground">Visão executiva em tempo real — dados do Stripe + banco</p>
        </div>
        <Button onClick={fetchMetrics} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                <Badge variant="outline" className="text-xs">{kpi.label}</Badge>
              </div>
              <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* MRR Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Area type="monotone" dataKey="mrr" stroke="hsl(210,100%,50%)" fill="hsl(210,100%,50%)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customers Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Assinantes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="customers" fill="hsl(142,71%,45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.planBreakdown.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={metrics.planBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={2}>
                      {metrics.planBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {metrics.planBreakdown.map((plan, i) => (
                    <div key={plan.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-medium">{plan.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{plan.count}</span>
                        <span className="text-muted-foreground text-xs ml-2">{formatBRL(plan.mrr)}/mês</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura ativa</p>
            )}
          </CardContent>
        </Card>

        {/* Unit Economics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Unit Economics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'LTV / CAC Ratio', value: '—', desc: 'Configure o CAC para calcular' },
              { label: 'Payback Period', value: '—', desc: 'Meses para recuperar CAC' },
              { label: 'Net Revenue Retention', value: `${metrics.churnRate < 1 ? '> 100%' : `${Math.round(100 - metrics.churnRate)}%`}`, desc: 'Retenção líquida de receita' },
              { label: 'Avg. Revenue per Account', value: formatBRL(metrics.arpu), desc: 'ARPA mensal' },
              { label: 'Quick Ratio', value: metrics.recentCancellations > 0 ? `${(metrics.activeSubscriptions / metrics.recentCancellations).toFixed(1)}x` : '∞', desc: 'Crescimento / Churn' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <p className="text-sm font-bold">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
