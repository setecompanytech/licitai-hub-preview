import { useState } from 'react';
import { AlertTriangle, LayoutGrid, RefreshCw, Settings2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PendenciasPrioritarias from '@/components/dashboard/PendenciasPrioritarias';
import QuickAccessGrid from '@/components/dashboard/QuickAccessGrid';
import AtalhosPessoais from '@/components/dashboard/AtalhosPessoais';
import ResumoOperacional from '@/components/dashboard/ResumoOperacional';
import AgendaPendencias from '@/components/dashboard/AgendaPendencias';
import OportunidadesPainel from '@/components/dashboard/OportunidadesPainel';
import MapaLicitacoesPorEstado from '@/components/dashboard/MapaLicitacoesPorEstado';
import PainelLicitacoes from '@/components/dashboard/PainelLicitacoes';
import EmpresaSelector from '@/components/empresa/EmpresaSelector';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { ANCORA_LISTAGEM } from '@/lib/licitacao/recortes-do-painel';
import RelatorioGerencialPDF from '@/components/relatorios/RelatorioGerencialPDF';
import OnboardingWizard, { useOnboarding } from '@/components/onboarding/OnboardingWizard';
import MascoteBoasVindas, { useMascoteBoasVindas } from '@/components/onboarding/MascoteBoasVindas';
import NavegadorDeSecoes from '@/components/shared/NavegadorDeSecoes';
import ColaboradorIdentificacaoModal from '@/components/auth/ColaboradorIdentificacaoModal';

/**
 * Painel da empresa — a primeira tela do dia.
 *
 * ── A ORDEM DAS SEÇÕES É O CONTEÚDO ──────────────────────────────────────
 *
 *   A. Identificação          quem é a empresa, e como personalizar a tela
 *   B. Pendências             o que trava a operação AGORA (vencimentos reais)
 *   C. Suas ferramentas       para onde ir
 *   D. Resumo operacional     como a operação vai — cada número leva à lista
 *   E. Agenda e pendências    o que tem data
 *   F. Oportunidades          o que entrou, separando a empresa da base pública
 *
 * Depois delas seguem duas seções que já existiam e não têm outra casa: o mapa
 * por estado e a LISTAGEM de processos. A listagem não é apêndice — ela é o
 * destino dos indicadores clicáveis de D, e é o que faz o número do cartão e
 * as linhas da lista serem a mesma conta (ver `recortes-do-painel`).
 *
 * ── O QUE SAIU ───────────────────────────────────────────────────────────
 *
 * O cartão "Robô de Lances" (BannerDestaque) era TEXTO FIXO no lugar mais
 * visível da tela — não havia dado por trás dele. A reestruturação pede
 * pendências reais nessa posição, e anúncio fixo não é pendência.
 *
 * ── CONSULTAS ────────────────────────────────────────────────────────────
 *
 * `useDashboardData` sem `incluirDesempenho`: o painel usa dele apenas os
 * números de oportunidade (editais do dia, cache do PNCP, carimbo do sync).
 * Tudo o que é processo vem de `useAnalyticsData`, que baixa as linhas UMA vez
 * e serve os indicadores e a agenda. Antes os dois hooks conviviam na mesma
 * tela refazendo a mesma conta — um em SQL, ~35 idas ao banco, outro em
 * memória. Ver o cabeçalho de `useDashboardData`.
 */
export default function Index() {
  const { empresaAtiva, todasSelecionadas } = useEmpresa();
  const { kpis, erro: erroPainel, recarregar: recarregarPainel } = useDashboardData();
  const {
    kpis: analyticsKpis, ufBreakdown, licitacoes, loading: carregandoProcessos,
    erro: erroProcessos, recarregar: recarregarProcessos,
  } = useAnalyticsData();
  const { showOnboarding, dismissOnboarding, onboardingCarregado } = useOnboarding();
  /* O mascote entra na fila DEPOIS do wizard: os dois nascem da mesma condição
     de primeiro acesso, e empilhados um cobriria o outro. Configura a conta,
     depois é apresentado ao guia. */
  const { mascoteAberto, fecharMascote } = useMascoteBoasVindas(
    onboardingCarregado && !showOnboarding,
  );

  /* Modo de personalização: liga as estrelas de favoritar no grid de atalhos.
     Fica desligado por padrão porque a tela é de leitura — quem abre o painel
     de manhã quer ver o dia, não configurar. */
  const [personalizando, setPersonalizando] = useState(false);

  const empresaLabel = todasSelecionadas
    ? 'Todas as empresas'
    : empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || 'Nenhuma empresa selecionada';

  /* "Ver todas as ferramentas" abre o MESMO painel do cabeçalho — não uma
     segunda lista. O menu vive em `components/layout/MenuDeFerramentas`, fora
     do alcance desta tela, e ele escuta este evento de janela (mesmo molde do
     `praefectus:abrir-busca` que a coluna já usa). Evento, e não uma referência
     ao componente, porque assim qualquer ponto do app abre o menu sem que o
     painel precise conhecer a implementação dele. */
  const abrirMenuDeFerramentas = () =>
    window.dispatchEvent(new CustomEvent('praefectus:abrir-ferramentas'));

  return (
    <AppLayout>
      {/* O contêiner central — 1440px de teto, 16px de margem no celular e 32px
          no desktop, que é a medida do comando — já vem do `<main>` do
          AppLayout (`max-w-[var(--g-conteudo)] px-4 md:px-8`, com `--g-conteudo`
          = 1440px em index.css). Repetir `px-4 md:px-8` aqui SOMARIA a margem:
          32px no celular, 64px no desktop. Este div só existe para agrupar as
          seções, e por isso não carrega largura nem respiro próprios. */}
      <div className="w-full min-w-0">
        {/* ── A. Identificação ─────────────────────────────────────────── */}
        <CabecalhoPagina
          rota="/dashboard"
          /* O registro chama a tela de "Painel" (é o rótulo do menu, e ele
             continua curto lá). O título da PÁGINA é o do comando do dono —
             "Painel da empresa" —, e `CabecalhoPagina` existe justamente para
             a prop explícita vencer o registro quando a tela tem nome próprio. */
          titulo="Painel da empresa"
          descricao="O dia da sua empresa: pendências, prazos, resultados e oportunidades."
          acoes={
            <>
              <Button
                type="button"
                variant={personalizando ? 'default' : 'outline'}
                aria-pressed={personalizando}
                onClick={() => setPersonalizando((v) => !v)}
                className="gap-2"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                {personalizando ? 'Concluir personalização' : 'Personalizar atalhos'}
              </Button>
              <RelatorioGerencialPDF />
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm leading-5 text-muted-foreground">
              Empresa atual: <strong className="font-medium text-foreground">{empresaLabel}</strong>
            </p>
            {/* O seletor de verdade, não uma cópia: é o mesmo componente do
                cabeçalho. Ele só aparece aqui abaixo de `lg` porque a partir
                daí a barra do topo já o mostra, e dois seletores para a mesma
                troca é a navegação duplicada que a identidade proíbe. */}
            <div className="lg:hidden">
              <EmpresaSelector />
            </div>
          </div>
        </CabecalhoPagina>

        {/* Falha na carga dos números de oportunidade: mensagem real do banco e
            retentativa, nunca um painel de zeros (princípio 3 do CLAUDE.md). */}
        {erroPainel && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <AlertTitle>Não foi possível carregar os números do painel</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{erroPainel}</p>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void recarregarPainel()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ── B. Pendências prioritárias ───────────────────────────────── */}
        <section data-secao="Pendências" aria-label="Pendências prioritárias" className="mb-8">
          <PendenciasPrioritarias />
        </section>

        {/* ── C. Suas ferramentas ──────────────────────────────────────── */}
        <section data-secao="Suas ferramentas" className="mb-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold leading-7">Suas ferramentas</h2>
            <button
              type="button"
              onClick={abrirMenuDeFerramentas}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium leading-5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {/* Grade de dois grupos por linha no desktop — a composição do
                comando. Quem manda nela é o próprio QuickAccessGrid. */}
            <QuickAccessGrid personalizando={personalizando} />
          </div>
        </section>

        {/* ── D. Resumo operacional ────────────────────────────────────── */}
        <section data-secao="Resumo operacional" className="mb-8">
          <h2 className="mb-4 text-xl font-semibold leading-7">Resumo operacional</h2>
          <ResumoOperacional kpis={analyticsKpis} carregando={carregandoProcessos} />
        </section>

        {/* ── E. Agenda e pendências ───────────────────────────────────── */}
        <section data-secao="Agenda e pendências" className="mb-8">
          <h2 className="mb-4 text-xl font-semibold leading-7">Agenda e pendências</h2>
          <AgendaPendencias
            processos={licitacoes}
            carregandoProcessos={carregandoProcessos}
            erroProcessos={erroProcessos}
            aoRecarregarProcessos={() => void recarregarProcessos()}
          />
        </section>

        {/* ── F. Oportunidades ─────────────────────────────────────────── */}
        <section data-secao="Oportunidades" className="mb-8">
          <h2 className="mb-4 text-xl font-semibold leading-7">Oportunidades</h2>
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

        {/* Onde estão os processos — mesma fonte dos indicadores. */}
        <section data-secao="Licitações por estado" className="mb-8">
          <h2 className="mb-4 text-xl font-semibold leading-7">Licitações por estado</h2>
          <MapaLicitacoesPorEstado dados={ufBreakdown} />
        </section>

        {/* A LISTAGEM — destino dos indicadores clicáveis do resumo. A âncora
            vem da mesma constante que monta os links, para as duas pontas não
            se separarem. */}
        <section id={ANCORA_LISTAGEM} data-secao="Processos da empresa" className="mb-8">
          <h2 className="mb-4 text-xl font-semibold leading-7">Processos da empresa</h2>
          <PainelLicitacoes />
        </section>

        {/* O painel rola por várias telas. O navegador dá o salto entre elas
            nomeando o destino — ver NavegadorDeSecoes. */}
        <NavegadorDeSecoes />
      </div>

      <OnboardingWizard open={showOnboarding} onClose={dismissOnboarding} />
      <MascoteBoasVindas open={mascoteAberto} onClose={fecharMascote} />
      <ColaboradorIdentificacaoModal />
    </AppLayout>
  );
}
