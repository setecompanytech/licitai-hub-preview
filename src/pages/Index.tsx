import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import LicitacoesChart from '@/components/dashboard/LicitacoesChart';
import ValorChart from '@/components/dashboard/ValorChart';
import RecentLicitacoes from '@/components/dashboard/RecentLicitacoes';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Eye, Send, Trophy, TrendingUp, DollarSign, Zap } from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis, chartMensal, chartValor, recentes, loading } = useDashboardData();

  const empresaLabel = todasSelecionadas
    ? 'Todas as Empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Empresa';

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resultados de: <span className="font-medium text-foreground">{empresaLabel}</span>
          </p>
        </div>
        <EmpresaSelector />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Monitoradas"
          value={kpis.licitacoesMonitoradas.toString()}
          icon={Eye}
        />
        <StatCard
          label="Propostas"
          value={kpis.propostasEnviadas.toString()}
          icon={Send}
        />
        <StatCard
          label="Taxa de Vitória"
          value={`${kpis.taxaVitoria}%`}
          icon={Trophy}
          accentColor="hsl(142, 71%, 45%)"
        />
        <StatCard
          label="ROI Médio"
          value={`${kpis.roiMedio}%`}
          icon={TrendingUp}
          accentColor="hsl(38, 92%, 50%)"
        />
        <StatCard
          label="Valor Ganho"
          value={formatCurrency(kpis.valorTotalGanho)}
          icon={DollarSign}
          accentColor="hsl(210, 100%, 40%)"
        />
        <StatCard
          label="Novas Hoje"
          value={kpis.licitacoesHoje.toString()}
          icon={Zap}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <LicitacoesChart data={chartMensal} />
        <ValorChart data={chartValor} />
      </div>

      {/* Recent */}
      <RecentLicitacoes data={recentes} loading={loading} />
    </AppLayout>
  );
}
