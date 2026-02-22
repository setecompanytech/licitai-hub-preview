import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import LicitacoesChart from '@/components/dashboard/LicitacoesChart';
import ValorChart from '@/components/dashboard/ValorChart';
import RecentLicitacoes from '@/components/dashboard/RecentLicitacoes';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { kpiData } from '@/data/mockData';
import { Eye, Send, Trophy, TrendingUp, DollarSign, Zap } from 'lucide-react';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();

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
          value={kpiData.licitacoesMonitoradas.toString()}
          change="+12 hoje"
          changeType="positive"
          icon={Eye}
        />
        <StatCard
          label="Propostas"
          value={kpiData.propostasEnviadas.toString()}
          change="+3 esta semana"
          changeType="positive"
          icon={Send}
        />
        <StatCard
          label="Taxa de Vitória"
          value={`${kpiData.taxaVitoria}%`}
          change="+2.1% vs mês anterior"
          changeType="positive"
          icon={Trophy}
          accentColor="hsl(142, 71%, 45%)"
        />
        <StatCard
          label="ROI Médio"
          value={`${kpiData.roiMedio}%`}
          change="+0.8%"
          changeType="positive"
          icon={TrendingUp}
          accentColor="hsl(38, 92%, 50%)"
        />
        <StatCard
          label="Valor Ganho"
          value={formatCurrency(kpiData.valorTotalGanho)}
          change="6 meses"
          changeType="neutral"
          icon={DollarSign}
          accentColor="hsl(210, 100%, 40%)"
        />
        <StatCard
          label="Novas Hoje"
          value={kpiData.licitacoesHoje.toString()}
          icon={Zap}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <LicitacoesChart />
        <ValorChart />
      </div>

      {/* Recent */}
      <RecentLicitacoes />
    </AppLayout>
  );
}
