import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, LayoutGrid, RefreshCw, Settings2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PendenciasPrioritarias from '@/components/dashboard/PendenciasPrioritarias';
import ContratosAguardandoDecisao from '@/components/dashboard/ContratosAguardandoDecisao';
import RadarJuridicoResumo from '@/components/dashboard/RadarJuridicoResumo';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';
import AtalhosPessoais from '@/components/dashboard/AtalhosPessoais';
import ResumoOperacional from '@/components/dashboard/ResumoOperacional';
import AgendaPendencias from '@/components/dashboard/AgendaPendencias';
import OportunidadesPainel from '@/components/dashboard/OportunidadesPainel';
import MapaLicitacoesPorEstado from '@/components/dashboard/MapaLicitacoesPorEstado';
import PainelLicitacoes from '@/components/dashboard/PainelLicitacoes';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { ANCORA_LISTAGEM } from '@/lib/licitacao/recortes-do-painel';
import RelatorioGerencialPDF from '@/components/relatorios/RelatorioGerencialPDF';
import OnboardingWizard, { useOnboarding } from '@/components/onboarding/OnboardingWizard';
import { useContaDeEngenharia } from '@/hooks/useContaDeEngenharia';
import MascoteBoasVindas, { useMascoteBoasVindas } from '@/components/onboarding/MascoteBoasVindas';
import NavegadorDeSecoes from '@/components/shared/NavegadorDeSecoes';
import ColaboradorIdentificacaoModal from '@/components/auth/ColaboradorIdentificacaoModal';

/**
 * Painel da empresa — a visão executiva da operação, a primeira tela do dia.
 *
 * ── A ORDEM DAS SEÇÕES É O CONTEÚDO ──────────────────────────────────────
 *
 *   A. Identificação          saudação, data, empresa, ações rápidas
 *   B. Pendências             o que trava a operação AGORA (vencimentos reais)
 *   C. Suas ferramentas       para onde ir
 *   D. Resumo operacional     como a operação vai — cada número leva à lista
 *   E. Agenda e pendências    o que tem data            ┐ lado a lado no
 *   F. Oportunidades          o que entrou              ┘ desktop largo
 *
 * Depois delas seguem o mapa por estado e a LISTAGEM de processos, que é o
 * destino dos indicadores clicáveis de D (ver `recortes-do-painel`).
 *
 * ── CONSULTAS ────────────────────────────────────────────────────────────
 *
 * `useDashboardData` sem `incluirDesempenho`: o painel usa dele apenas os
 * números de oportunidade. Tudo o que é processo vem de `useAnalyticsData`,
 * que baixa as linhas UMA vez e serve os indicadores e a agenda. Nenhuma
 * consulta nova entrou com o redesign de 19/09.
 */

/** Saudação pela hora local — apresentação, não dado. */
function saudacaoDaHora(hora: number): string {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

const TITULO_SECAO = 'mb-3 text-lg font-semibold leading-6 text-foreground';

export default function Index() {
  const { user } = useAuth();
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis, erro: erroPainel, recarregar: recarregarPainel } = useDashboardData();
  const {
    kpis: analyticsKpis, ufBreakdown, licitacoes, loading: carregandoProcessos,
    erro: erroProcessos, recarregar: recarregarProcessos,
  } = useAnalyticsData();
  const { showOnboarding, dismissOnboarding, onboardingCarregado } = useOnboarding();
  /* A conta de engenharia não passa pelas boas-vindas de cliente: o assistente
     cadastra empresa, e ela não entra em empresa (lib/conta-de-engenharia.ts).
     Espera o papel carregar para o assistente não piscar antes de sumir. */
  const { ehContaDeEngenharia, carregando: carregandoConta } = useContaDeEngenharia();
  const mostrarOnboarding = showOnboarding && !carregandoConta && !ehContaDeEngenharia;
  /* O mascote entra na fila DEPOIS do wizard: os dois nascem da mesma condição
     de primeiro acesso, e empilhados um cobriria o outro. */
  const { mascoteAberto, fecharMascote } = useMascoteBoasVindas(
    onboardingCarregado && !showOnboarding && !ehContaDeEngenharia,
  );

  /* Modo de personalização: liga as estrelas de favoritar no grid de atalhos.
     Desligado por padrão porque a tela é de leitura. */
  const [personalizando, setPersonalizando] = useState(false);

  const empresaLabel = todasSelecionadas
    ? 'Todas as empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Nenhuma empresa selecionada';

  const agora = new Date();
  const primeiroNome = (user?.user_metadata?.nome_completo as string | undefined)?.trim().split(' ')[0];
  const saudacao = `${saudacaoDaHora(agora.getHours())}${primeiroNome ? `, ${primeiroNome}` : ''}`;
  const dataDeHoje = format(agora, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  /* "Ver todas as ferramentas" abre o MESMO painel do cabeçalho — não uma
     segunda lista. O menu escuta este evento de janela. */
  const abrirMenuDeFerramentas = () =>
    window.dispatchEvent(new CustomEvent('praefectus:abrir-ferramentas'));

  return (
    <AppLayout>
      <div className="w-full min-w-0">
        {/* ── A. Identificação ─────────────────────────────────────────── */}
        <CabecalhoPagina
          rota="/dashboard"
          titulo="Painel da empresa"
          descricao={`${saudacao} · ${dataDeHoje}`}
          acoes={
            <>
              <Button
                type="button"
                variant="outline"
                aria-pressed={personalizando}
                onClick={() => setPersonalizando((v) => !v)}
              >
                <Settings2 aria-hidden="true" />
                {personalizando ? 'Concluir personalização' : 'Personalizar atalhos'}
              </Button>
              <RelatorioGerencialPDF />
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm leading-5 text-muted-foreground">
              Empresa atual: <strong className="font-semibold text-foreground">{empresaLabel}</strong>
            </p>
            {/* O seletor de verdade, não uma cópia: é o mesmo componente da
                topbar. Só aparece aqui abaixo de `md`, onde a barra o esconde. */}
            <div className="md:hidden">
              <EmpresaSelector />
            </div>
          </div>
        </CabecalhoPagina>

        {/* Falha na carga dos números de oportunidade: mensagem real do banco e
            retentativa, nunca um painel de zeros (princípio 3 do CLAUDE.md). */}
        {erroPainel && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Não foi possível carregar os números do painel</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{erroPainel}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void recarregarPainel()}>
                <RefreshCw aria-hidden="true" />
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ── B. Pendências prioritárias ───────────────────────────────── */}
        <section data-secao="Pendências" aria-label="Pendências prioritárias" className="mb-6">
          <PendenciasPrioritarias />
          {/* Contratos esperando a decisão de fim (decisão 4 do dono, 21/09):
              a pergunta continua no Resumo de cada contrato; aqui só a cobrança. */}
          <ContratosAguardandoDecisao />
          {/* O Radar Jurídico (F2, 27/09): o que os dados apontam como peça a
              redigir; a lista inteira mora no Apoio Jurídico. */}
          <RadarJuridicoResumo />
        </section>

        {/* ── C. Suas ferramentas ──────────────────────────────────────── */}
        <section data-secao="Suas ferramentas" className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold leading-6 text-foreground">Suas ferramentas</h2>
            <button
              type="button"
              onClick={abrirMenuDeFerramentas}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium leading-5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Ver todas as ferramentas
            </button>
          </div>

          <div className="space-y-4">
            <AtalhosPessoais personalizando={personalizando} />
            {personalizando && (
              <p className="text-sm leading-5 text-muted-foreground">
                Clique na estrela de um atalho para fixá-lo em Favoritos. A escolha vale para
                você nesta empresa.
              </p>
            )}
            <QuickAccessGrid personalizando={personalizando} />
          </div>
        </section>

        {/* ── D. Resumo operacional ────────────────────────────────────── */}
        <section data-secao="Resumo operacional" className="mb-8">
          <h2 className={TITULO_SECAO}>Resumo operacional</h2>
          <ResumoOperacional kpis={analyticsKpis} carregando={carregandoProcessos} />
        </section>

        {/* ── E + F. Agenda e oportunidades, lado a lado no desktop largo ── */}
        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12 [&>*]:min-w-0">
          <section data-secao="Agenda e pendências" className="xl:col-span-7">
            <h2 className={TITULO_SECAO}>Agenda e pendências</h2>
            <AgendaPendencias
              processos={licitacoes}
              carregandoProcessos={carregandoProcessos}
              erroProcessos={erroProcessos}
              aoRecarregarProcessos={() => void recarregarProcessos()}
            />
          </section>

          <section data-secao="Oportunidades" className="xl:col-span-5">
            <h2 className={TITULO_SECAO}>Oportunidades</h2>
            <OportunidadesPainel
              blocos={[
                {
                  titulo: 'Do seu monitoramento',
                  origem: 'Editais que os seus alertas capturaram',
                  natureza: 'empresa',
                  itens: [
                    {
                      rotulo: 'Entraram hoje',
                      valor: kpis.licitacoesHoje.toLocaleString('pt-BR'),
                      para: '/monitoramento-editais',
                      destaque: true,
                    },
                  ],
                },
                {
                  titulo: 'Base pública do PNCP',
                  origem: 'Portal Nacional de Contratações Públicas — país inteiro, não só a sua empresa',
                  natureza: 'externa',
                  atualizadoEm: kpis.ultimaSincronizacao,
                  semAtualizacao: 'Nenhuma sincronização concluída registrada',
                  itens: [
                    {
                      rotulo: 'Editais vigentes',
                      // `null` quando a leitura do cache falhou: "0 editais
                      // vigentes" afirmaria que o país não tem licitação aberta.
                      valor: kpis.editaisAbertos === null ? null : kpis.editaisAbertos.toLocaleString('pt-BR'),
                      razaoIndisponivel: 'Não foi possível ler o cache do PNCP',
                      para: '/monitoramento-editais',
                    },
                  ],
                },
              ]}
            />
          </section>
        </div>

        {/* Onde estão os processos — mesma fonte dos indicadores. */}
        <section data-secao="Licitações por estado" className="mb-8">
          <h2 className={TITULO_SECAO}>Licitações por estado</h2>
          <MapaLicitacoesPorEstado dados={ufBreakdown} />
        </section>

        {/* A LISTAGEM — destino dos indicadores clicáveis do resumo. A âncora
            vem da mesma constante que monta os links. */}
        <section id={ANCORA_LISTAGEM} data-secao="Processos da empresa" className="mb-8">
          <h2 className={TITULO_SECAO}>Processos da empresa</h2>
          <PainelLicitacoes />
        </section>

        {/* O painel rola por várias telas. O navegador dá o salto entre elas
            nomeando o destino — ver NavegadorDeSecoes. */}
        <NavegadorDeSecoes />
      </div>

      <OnboardingWizard open={mostrarOnboarding} onClose={dismissOnboarding} />
      <MascoteBoasVindas open={mascoteAberto} onClose={fecharMascote} />
      <ColaboradorIdentificacaoModal />
    </AppLayout>
  );
}
