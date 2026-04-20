import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import PainelLicitacoes from '@/components/dashboard/PainelLicitacoes';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';
import CalendarioLicitacoes from '@/components/calendario/CalendarioLicitacoes';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { Eye, Trophy, DollarSign, XCircle, Clock, Database, CalendarDays } from 'lucide-react';
import RelatorioGerencialPDF from '@/components/relatorios/RelatorioGerencialPDF';
import OnboardingWizard, { useOnboarding } from '@/components/onboarding/OnboardingWizard';

import ColaboradorIdentificacaoModal from '@/components/auth/ColaboradorIdentificacaoModal';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis } = useDashboardData();
  const { kpis: analyticsKpis } = useAnalyticsData();
  const { showOnboarding, dismissOnboarding } = useOnboarding();

  const empresaLabel = todasSelecionadas
    ? 'Todas as Empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Empresa';

  return (
    <AppLayout>
      <div className="mb-3 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Painel de Gestão</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
            Resultados de: <span className="font-medium text-foreground">{empresaLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RelatorioGerencialPDF />
          <div className="hidden sm:block lg:hidden">
            <EmpresaSelector />
          </div>
        </div>
      </div>

      {/* 1. Ferramentas — acesso rápido */}
      <section className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold tracking-tight mb-3 sm:mb-4">Nossas Ferramentas</h2>
        <QuickAccessGrid />
      </section>

      {/* 2. KPIs essenciais — operação do dia */}
      <section className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold tracking-tight mb-3 sm:mb-4">Visão Geral</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          <StatCard label="Monitoradas" value={kpis.licitacoesMonitoradas.toString()} icon={Eye} />
          <StatCard label="Em Andamento" value={analyticsKpis.emAndamento.toString()} icon={Clock} accentColor="hsl(38, 92%, 50%)" />
          <StatCard label="Ganhas" value={analyticsKpis.ganhas.toString()} icon={Trophy} accentColor="hsl(142, 71%, 45%)" />
          <StatCard label="Perdidas" value={analyticsKpis.perdidas.toString()} icon={XCircle} accentColor="hsl(0, 72%, 51%)" />
          <StatCard label="Valor Ganho" value={formatCurrency(kpis.valorTotalGanho)} icon={DollarSign} accentColor="hsl(210, 100%, 40%)" />
          <StatCard
            label="Editais PNCP"
            value={kpis.editaisAbertos.toLocaleString('pt-BR')}
            icon={Database}
            accentColor="hsl(174, 72%, 40%)"
            change={kpis.ultimaSincronizacao ? `Sync: ${new Date(kpis.ultimaSincronizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando sync'}
            changeType="neutral"
          />
        </div>
      </section>

      {/* 3. Calendário dinâmico — datas de processos, certidões e backups */}
      <section className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold tracking-tight mb-3 sm:mb-4 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          Agenda Operacional
        </h2>
        <CalendarioLicitacoes />
      </section>

      {/* 4. Processos Licitatórios — operação */}
      <section className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold tracking-tight mb-3 sm:mb-4">Processos Licitatórios</h2>
        <PainelLicitacoes />
      </section>

      <OnboardingWizard open={showOnboarding} onClose={dismissOnboarding} />
      <ColaboradorIdentificacaoModal />
    </AppLayout>
  );
}
