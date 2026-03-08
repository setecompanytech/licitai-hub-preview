import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import LicitacoesChart from '@/components/dashboard/LicitacoesChart';
import ValorChart from '@/components/dashboard/ValorChart';
import PainelLicitacoes from '@/components/dashboard/PainelLicitacoes';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { Eye, Send, Trophy, TrendingUp, DollarSign, Zap, XCircle, Clock, Gavel, FileCheck2 } from 'lucide-react';
import RelatorioGerencialPDF from '@/components/relatorios/RelatorioGerencialPDF';
import OnboardingWizard, { useOnboarding } from '@/components/onboarding/OnboardingWizard';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis, chartMensal, chartValor, loading } = useDashboardData();
  const { kpis: analyticsKpis } = useAnalyticsData();
  const { showOnboarding, dismissOnboarding } = useOnboarding();
  const navigate = useNavigate();

  const empresaLabel = todasSelecionadas
    ? 'Todas as Empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Empresa';

  return (
    <AppLayout>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Painel de Gestão</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resultados de: <span className="font-medium text-foreground">{empresaLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RelatorioGerencialPDF />
          <EmpresaSelector />
        </div>
      </div>

      {/* KPI Grid — Principal */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4">
        <StatCard label="Monitoradas" value={kpis.licitacoesMonitoradas.toString()} icon={Eye} />
        <StatCard label="Propostas" value={kpis.propostasEnviadas.toString()} icon={Send} />
        <StatCard label="Taxa de Vitória" value={`${kpis.taxaVitoria}%`} icon={Trophy} accentColor="hsl(142, 71%, 45%)" />
        <StatCard label="ROI Médio" value={`${kpis.roiMedio}%`} icon={TrendingUp} accentColor="hsl(38, 92%, 50%)" />
        <StatCard label="Valor Ganho" value={formatCurrency(kpis.valorTotalGanho)} icon={DollarSign} accentColor="hsl(210, 100%, 40%)" />
        <StatCard label="Novas Hoje" value={kpis.licitacoesHoje.toString()} icon={Zap} />
      </div>

      {/* KPI Grid — Detalhamento Processos (Realtime) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Ganhas" value={analyticsKpis.ganhas.toString()} icon={Trophy} accentColor="hsl(142, 71%, 45%)" change={`Pregões: ${analyticsKpis.pregoesGanhos} · Dispensas: ${analyticsKpis.dispensasGanhas}`} changeType="positive" />
        <StatCard label="Perdidas" value={analyticsKpis.perdidas.toString()} icon={XCircle} accentColor="hsl(0, 72%, 51%)" />
        <StatCard label="Em Andamento" value={analyticsKpis.emAndamento.toString()} icon={Clock} accentColor="hsl(38, 92%, 50%)" change={`${formatCurrency(analyticsKpis.valorEmDisputa)} em disputa`} changeType="neutral" />
        <button onClick={() => navigate('/analytics')} className="text-left">
          <StatCard label="Pregões / Dispensas" value={`${analyticsKpis.pregoes} / ${analyticsKpis.dispensas}`} icon={Gavel} accentColor="hsl(280, 60%, 50%)" change="Ver analytics completo →" changeType="neutral" />
        </button>
      </div>

      {/* Acesso Rápido — Módulos */}
      <div className="mb-6">
        <QuickAccessGrid />
      </div>

      {/* Painel de Processos Licitatórios */}
      <div className="mb-6">
        <h2 className="text-lg font-bold tracking-tight mb-4">Processos Licitatórios</h2>
        <PainelLicitacoes />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <LicitacoesChart data={chartMensal} />
        <ValorChart data={chartValor} />
      </div>
      <OnboardingWizard open={showOnboarding} onClose={dismissOnboarding} />
    </AppLayout>
  );
}
