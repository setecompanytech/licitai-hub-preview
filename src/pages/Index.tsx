import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
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
import { Badge } from '@/components/ui/badge';
import { Eye, Trophy, DollarSign, XCircle, Clock, Database, CalendarDays } from 'lucide-react';
import RelatorioGerencialPDF from '@/components/relatorios/RelatorioGerencialPDF';
import OnboardingWizard, { useOnboarding } from '@/components/onboarding/OnboardingWizard';
import MascoteBoasVindas, { useMascoteBoasVindas } from '@/components/onboarding/MascoteBoasVindas';
import NavegadorDeSecoes from '@/components/shared/NavegadorDeSecoes';

import ColaboradorIdentificacaoModal from '@/components/auth/ColaboradorIdentificacaoModal';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis } = useDashboardData();
  const { kpis: analyticsKpis, ufBreakdown } = useAnalyticsData();
  const { showOnboarding, dismissOnboarding, onboardingCarregado } = useOnboarding();
  /* O mascote entra na fila DEPOIS do wizard: os dois nascem da mesma condição
     de primeiro acesso, e empilhados um cobriria o outro. Configura a conta,
     depois é apresentado ao guia. */
  const { mascoteAberto, fecharMascote } = useMascoteBoasVindas(
    onboardingCarregado && !showOnboarding,
  );

  const empresaLabel = todasSelecionadas
    ? 'Todas as Empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Empresa';

  return (
    <AppLayout>
      {/* Identidade 12/09: o h1 visível vem do CabecalhoPagina — é o único da
          página — e título, descrição, ícone e trilha vêm do registro
          (lib/navegacao/paginas.ts) pela rota, sem a tela reescrever o que já
          está padronizado. A linha de contexto da empresa é funcional (o app é
          multiempresa) e segue como chip abaixo da descrição. */}
      <CabecalhoPagina
        rota="/dashboard"
        acoes={
          <>
            <RelatorioGerencialPDF />
            <div className="hidden sm:block lg:hidden">
              <EmpresaSelector />
            </div>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted" truncate>{`Resultados de ${empresaLabel}`}</Badge>
        </div>
      </CabecalhoPagina>

      {/* 1. Os números da operação do dia, com a faixa de destaque ao lado,
          como no protótipo. O padrão declarado para /dashboard é "painel":
          KPIs em linha LOGO ABAIXO do cabeçalho, e só então os blocos de
          leitura — por isso esta seção não tem h2. O título dela é o h1 da
          página ("Painel", do registro), e repeti-lo aqui como h2 dava dois
          "Painel" empilhados a 24px de distância. O nome da seção segue no
          `data-secao`, que é o que o NavegadorDeSecoes lê. */}
      <section data-secao="Resumo do dia" aria-label="Resumo do dia" className="mb-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 [&>*]:min-w-0">
          {/* Regra de cor da auditoria: semântica só onde o ícone comunica estado
              real (andamento/ganho/perda). Azul e teal decorativos viram neutro. */}
          <StatCard label="Monitoradas" value={kpis.licitacoesMonitoradas.toString()} icon={Eye} tone="neutral" />
          <StatCard label="Em andamento" value={analyticsKpis.emAndamento.toString()} icon={Clock} tone="warning" />
          <StatCard label="Ganhas" value={analyticsKpis.ganhas.toString()} icon={Trophy} tone="success" />
          <StatCard label="Perdidas" value={analyticsKpis.perdidas.toString()} icon={XCircle} tone="destructive" />
          </div>

          {/* TEXTO FIXO, de propósito — não há dado por trás deste cartão.
              Por isso ele APONTA para uma funcionalidade em vez de anunciar
              novidade: "Agenda atualizada" e "Novidades no Robô de Lances"
              seriam mentira já no segundo mês, para todo cliente, no lugar mais
              visível do painel.
              Quando alguém for alimentá-lo com dado de verdade, o candidato
              natural é a próxima sessão da empresa — o `useAnalyticsData` desta
              mesma página já traz `data_abertura`, `orgao`, `numero` e `objeto`.
              Filtrar por STATUS_ANDAMENTO de @/lib/licitacao/status, nunca por
              lista de status reescrita aqui. Sem sessão futura, o cartão some e
              a grade de KPIs ocupa as três colunas: cartão vazio dizendo
              "nada agendado" gasta o melhor espaço da tela para não dizer nada. */}
          <BannerDestaque
            etiqueta="Automação"
            titulo="Robô de Lances"
            descricao="Acompanhe disputas e envie lances sem ficar preso à tela do portal."
            chamada="Conhecer"
            para="/robo-lances"
          />
        </div>

        {/* Os dois números que não couberam na grade de quatro seguem numa
            fileira própria — o protótipo tem quatro ladrilhos, o app apura seis
            e nenhum deles é descartável. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 [&>*]:min-w-0">
          <StatCard label="Valor ganho" value={formatCurrency(kpis.valorTotalGanho)} icon={DollarSign} tone="neutral" />
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

      {/* 2. Atalhos para os módulos, agrupados como no menu. Era "Nossas
          Ferramentas" — voz do produto, e em caixa de título. A régua da
          identidade escreve em caixa de frase e nomeia o que a seção FAZ. */}
      <section data-secao="Acesso rápido" className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Acesso rápido</h2>
        <QuickAccessGrid />
      </section>

      {/* 3. Oportunidades — o que entrou e o que está aberto.
          Os quatro números são os que o app já apura. O protótipo mostra ainda
          "iminência de deserta" e "baixa concorrência", que não existem como
          dado aqui — ficaram de fora em vez de virar número inventado. */}
      <section data-secao="Oportunidades" className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Oportunidades</h2>
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
      <section data-secao="Licitações por estado" className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Licitações por estado</h2>
        <MapaLicitacoesPorEstado dados={ufBreakdown} />
      </section>

      {/* 5. Calendário dinâmico — datas de processos, certidões e backups */}
      <section data-secao="Agenda operacional" className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Agenda operacional
        </h2>
        <CalendarioLicitacoes />
      </section>

      {/* 6. Processos Licitatórios — operação */}
      <section data-secao="Licitações gerenciadas" className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Licitações gerenciadas</h2>
        <PainelLicitacoes />
      </section>

      {/* O painel tem seis seções e rola por várias telas. O navegador dá o
          salto entre elas nomeando o destino — ver NavegadorDeSecoes. */}
      <NavegadorDeSecoes />

      <OnboardingWizard open={showOnboarding} onClose={dismissOnboarding} />
      <MascoteBoasVindas open={mascoteAberto} onClose={fecharMascote} />
      <ColaboradorIdentificacaoModal />
    </AppLayout>
  );
}
