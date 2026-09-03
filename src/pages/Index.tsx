import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import PainelLicitacoes from '@/components/dashboard/PainelLicitacoes';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';
import MapaLicitacoesPorEstado from '@/components/dashboard/MapaLicitacoesPorEstado';
import OportunidadesPainel from '@/components/dashboard/OportunidadesPainel';
import BannerDestaque from '@/components/dashboard/BannerDestaque';
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
  const { kpis: analyticsKpis, ufBreakdown } = useAnalyticsData();
  const { showOnboarding, dismissOnboarding } = useOnboarding();

  const empresaLabel = todasSelecionadas
    ? 'Todas as Empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Empresa';

  return (
    <AppLayout>
      {/* REBRAND — o protótipo não repete o nome da página no corpo: quem diz
          onde você está é o rastro na barra do topo, e os títulos de seção são
          as âncoras visuais. Sobra aqui a linha de contexto da empresa, que é
          funcional (o app é multiempresa) e não existe no protótipo.
          O h1 continua para quem navega por leitor de tela. */}
      <h1 className="sr-only">Painel de Gestão — {empresaLabel}</h1>

      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground truncate min-w-0">
          Resultados de: <span className="font-medium text-foreground">{empresaLabel}</span>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RelatorioGerencialPDF />
          <div className="hidden sm:block lg:hidden">
            <EmpresaSelector />
          </div>
        </div>
      </div>

      {/* 1. Ferramentas — acesso rápido */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Nossas Ferramentas</h2>
        <QuickAccessGrid />
      </section>

      {/* 2. Painel — os números da operação do dia, com a faixa de destaque ao
          lado, como no protótipo. */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Painel</h2>
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-2 grid grid-cols-2 gap-4 [&>*]:min-w-0">
          {/* Regra de cor da auditoria: semântica só onde o ícone comunica estado
              real (andamento/ganho/perda). Azul e teal decorativos viram neutro. */}
          <StatCard label="Monitoradas" value={kpis.licitacoesMonitoradas.toString()} icon={Eye} tone="neutral" />
          <StatCard label="Em Andamento" value={analyticsKpis.emAndamento.toString()} icon={Clock} accentColor="var(--warning)" />
          <StatCard label="Ganhas" value={analyticsKpis.ganhas.toString()} icon={Trophy} accentColor="var(--success)" />
          <StatCard label="Perdidas" value={analyticsKpis.perdidas.toString()} icon={XCircle} accentColor="var(--destructive)" />
          </div>

          <BannerDestaque
            etiqueta="Agenda atualizada"
            titulo="Novidades no Robô de Lances"
            descricao="Automatize disputas com mais precisão e velocidade, direto do Praefectus."
            chamada="Ver detalhes"
            para="/robo-lances"
          />
        </div>

        {/* Os dois números que não couberam na grade de quatro seguem numa
            fileira própria — o protótipo tem quatro ladrilhos, o app apura seis
            e nenhum deles é descartável. */}
        <div className="grid grid-cols-2 gap-4 mt-4 [&>*]:min-w-0">
          <StatCard label="Valor Ganho" value={formatCurrency(kpis.valorTotalGanho)} icon={DollarSign} tone="neutral" />
          <StatCard
            label="Editais PNCP"
            value={kpis.editaisAbertos.toLocaleString('pt-BR')}
            icon={Database}
            tone="neutral"
            change={kpis.ultimaSincronizacao ? `Sync: ${new Date(kpis.ultimaSincronizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando sync'}
            changeType="neutral"
          />
        </div>
      </section>

      {/* 3. Oportunidades — o que entrou e o que está aberto.
          Os quatro números são os que o app já apura. O protótipo mostra ainda
          "iminência de deserta" e "baixa concorrência", que não existem como
          dado aqui — ficaram de fora em vez de virar número inventado. */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Oportunidades</h2>
        <OportunidadesPainel
          itens={[
            {
              rotulo: 'Novas oportunidades do dia',
              valor: kpis.licitacoesHoje.toLocaleString('pt-BR'),
              para: '/monitoramento-editais',
              destaque: true,
            },
            {
              rotulo: 'Editais vigentes',
              valor: kpis.editaisAbertos.toLocaleString('pt-BR'),
              para: '/monitoramento-editais',
            },
            {
              rotulo: 'Monitoradas',
              valor: kpis.licitacoesMonitoradas.toLocaleString('pt-BR'),
              para: '/licitacoes',
              destaque: true,
            },
            {
              rotulo: 'Em disputa agora',
              valor: analyticsKpis.emAndamento.toLocaleString('pt-BR'),
              para: '/kanban',
            },
          ]}
        />
      </section>

      {/* 4. Distribuição geográfica — onde estão as licitações */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Licitações por estado</h2>
        <MapaLicitacoesPorEstado dados={ufBreakdown} />
      </section>

      {/* 5. Calendário dinâmico — datas de processos, certidões e backups */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Agenda Operacional
        </h2>
        <CalendarioLicitacoes />
      </section>

      {/* 6. Processos Licitatórios — operação */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Licitações gerenciadas</h2>
        <PainelLicitacoes />
      </section>

      <OnboardingWizard open={showOnboarding} onClose={dismissOnboarding} />
      <ColaboradorIdentificacaoModal />
    </AppLayout>
  );
}
