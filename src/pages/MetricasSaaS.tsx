import SkeletonPagina from '@/components/shared/SkeletonPagina';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
        {/* Sem moldura: o AppLayout já desenhou a barra e a coluna. */}
        <SkeletonPagina moldura={false} />
      </AppLayout>
    );
  }

  if (error || !metrics) {
    return (
      <AppLayout>
        <CabecalhoPagina rota="/admin/metricas-saas" />
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EstadoVazio
            icone={<AlertTriangle />}
            titulo="Não foi possível carregar as métricas"
            descricao={error || 'Sem dados disponíveis'}
            acao={
              <Button onClick={fetchMetrics} variant="outline" size="sm">
                <RefreshCw aria-hidden="true" /> Tentar novamente
              </Button>
            }
          />
        </div>
      </AppLayout>
    );
  }

  /* Tom do ícone — semântico só onde há estado real (receita, churn, cancelamento). */
  const kpiCards = [
    { label: 'MRR', value: formatBRL(metrics.mrr), icon: DollarSign, tom: 'bg-muted text-muted-foreground', desc: 'Receita Mensal Recorrente' },
    { label: 'ARR', value: formatBRL(metrics.arr), icon: TrendingUp, tom: 'bg-success-tint text-success-ink', desc: 'Receita Anual Recorrente' },
    { label: 'Assinaturas Ativas', value: metrics.activeSubscriptions.toString(), icon: UserCheck, tom: 'bg-muted text-muted-foreground', desc: 'Planos ativos no Stripe' },
    { label: 'Churn Rate', value: `${metrics.churnRate}%`, icon: TrendingDown, tom: metrics.churnRate > 5 ? 'bg-destructive-tint text-destructive-ink' : 'bg-success-tint text-success-ink', desc: 'Cancelamentos nos últimos 30 dias' },
    { label: 'LTV', value: formatBRL(metrics.ltv), icon: BarChart3, tom: 'bg-muted text-muted-foreground', desc: 'Lifetime Value médio' },
    { label: 'ARPU', value: formatBRL(metrics.arpu), icon: DollarSign, tom: 'bg-muted text-muted-foreground', desc: 'Receita média por assinante' },
    { label: 'Receita 30d', value: formatBRL(metrics.revenue30d), icon: ArrowUpRight, tom: 'bg-success-tint text-success-ink', desc: 'Faturamento últimos 30 dias' },
    { label: 'Usuários', value: metrics.totalUsers.toString(), icon: Users, tom: 'bg-muted text-muted-foreground', desc: 'Usuários cadastrados' },
    { label: 'Empresas', value: metrics.totalEmpresas.toString(), icon: Building2, tom: 'bg-muted text-muted-foreground', desc: 'Empresas ativas' },
    { label: 'Cancelamentos', value: metrics.recentCancellations.toString(), icon: ArrowDownRight, tom: 'bg-destructive-tint text-destructive-ink', desc: 'Nos últimos 30 dias' },
  ];

  return (
    <AppLayout>
      <Helmet><title>Métricas SaaS | PRAEFECTUS Admin</title></Helmet>

      <CabecalhoPagina
        rota="/admin/metricas-saas"
        descricao="Visão executiva em tempo real — dados do Stripe + banco"
        acoes={
          <Button onClick={fetchMetrics} variant="outline">
            <RefreshCw aria-hidden="true" /> Atualizar
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 [&>*]:min-w-0">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="flex min-h-[112px] flex-col justify-between gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${kpi.tom}`}>
                <kpi.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold leading-8 tabular-nums text-foreground" title={kpi.value}>{kpi.value}</p>
              <p className="truncate text-xs text-muted-foreground">{kpi.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* MRR Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customers Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Assinantes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="customers" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Distribuição por Plano</CardTitle>
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
            <CardTitle>Unit Economics</CardTitle>
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
                <p className="text-sm font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
