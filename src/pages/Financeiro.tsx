import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CabecalhoPagina from "@/components/shared/CabecalhoPagina";
import EstadoVazio from "@/components/shared/EstadoVazio";
import { Building2, FileSpreadsheet, FileUp, Landmark, Plus } from "lucide-react";
import FinHomeHub, { HUB_ITEMS, type HubItem } from "@/components/financeiro/FinHomeHub";
import FinPainelInicial from "@/components/financeiro/FinPainelInicial";
import FinResumoVisor, { getResumoAutoOpen } from "@/components/financeiro/FinResumoVisor";
import FinPanorama from "@/components/financeiro/FinPanorama";
import FinCalendarioFinanceiro from "@/components/financeiro/FinCalendarioFinanceiro";
import FinApuracao from "@/components/financeiro/FinApuracao";
import FinPlanoContas from "@/components/financeiro/FinPlanoContas";
import FinSaldosAbertura from "@/components/financeiro/FinSaldosAbertura";
import FinOrcamento from "@/components/financeiro/FinOrcamento";

import FinLancamentos from "@/components/financeiro/FinLancamentos";
import FinContas from "@/components/financeiro/FinContas";
import FinPessoas from "@/components/financeiro/FinPessoas";
import FinCategorias from "@/components/financeiro/FinCategorias";
import FinConciliacao from "@/components/financeiro/FinConciliacao";
import FinContasPagar from "@/components/financeiro/FinContasPagar";
import FinContasReceber from "@/components/financeiro/FinContasReceber";
import FinCentrosCusto from "@/components/financeiro/FinCentrosCusto";
import FinFluxoCaixa from "@/components/financeiro/FinFluxoCaixa";
import FinDRE from "@/components/financeiro/FinDRE";
import FinFolha from "@/components/financeiro/FinFolha";
import FinOCRDocumentos from "@/components/financeiro/FinOCRDocumentos";
import FinIntegracoes from "@/components/financeiro/FinIntegracoes";
import FinEmissorNFe from "@/components/financeiro/FinEmissorNFe";
import FinConsultaNFeEntrada from "@/components/financeiro/FinConsultaNFeEntrada";
import FinRelatorios from "@/components/financeiro/FinRelatorios";
import FinTransferencia from "@/components/financeiro/FinTransferencia";
import FinBaixaLote from "@/components/financeiro/FinBaixaLote";
import FinImportarPlanilha from "@/components/financeiro/FinImportarPlanilha";
import FinImportarPlanilhaXlsx from "@/components/financeiro/FinImportarPlanilhaXlsx";
import FinExportarPlanilhaXlsx from "@/components/financeiro/FinExportarPlanilhaXlsx";
import FinImportarOFX from "@/components/financeiro/FinImportarOFX";
import FinCNAB from "@/components/financeiro/FinCNAB";
import FinPrevistoRealizado from "@/components/financeiro/FinPrevistoRealizado";
import FinResumoExecutivo from "@/components/financeiro/FinResumoExecutivo";
import FinAprovacoes from "@/components/financeiro/FinAprovacoes";
import FinNFSe from "@/components/financeiro/FinNFSe";
import FinCalculadoraMargem from "@/components/financeiro/FinCalculadoraMargem";
import FinCommandPalette from "@/components/financeiro/FinCommandPalette";
import FinOpenFinance from "@/components/financeiro/FinOpenFinance";
import FinDemonstracoes from "@/components/financeiro/FinDemonstracoes";
import FinQuadroFinanceiro from "@/components/financeiro/FinQuadroFinanceiro";
import FinAtividadeUsuarios from "@/components/financeiro/FinAtividadeUsuarios";
import FinConfigNFe from "@/components/financeiro/FinConfigNFe";
import FinPixCobranca from "@/components/financeiro/FinPixCobranca";
import FinAuditoriaConciliacao from "@/components/financeiro/FinAuditoriaConciliacao";
import FinPlanoContasPadrao from "@/components/financeiro/FinPlanoContasPadrao";
import FinIntegracoesFiscais from "@/components/financeiro/FinIntegracoesFiscais";
import FinLotesAuditoria from "@/components/financeiro/FinLotesAuditoria";
import FinPedidosAFaturar from "@/components/financeiro/FinPedidosAFaturar";
import FinCustosPorContrato from "@/components/financeiro/FinCustosPorContrato";
import { useEmpresa } from "@/contexts/EmpresaContext";

const VIEW_MAP: Record<string, () => JSX.Element> = {
  panorama: () => <FinPanorama />,
  calendario_financeiro: () => <FinCalendarioFinanceiro />,
  // Aliases retrocompatíveis: rotas antigas redirecionam para o painel unificado
  resumo: () => <FinPanorama />,
  dashboard: () => <FinPanorama />,
  pedidos_faturar: () => <FinPedidosAFaturar />,
  lancamentos: () => <FinLancamentos />,
  a_pagar: () => <FinContasPagar />,
  a_receber: () => <FinContasReceber />,
  conciliacao: () => <FinConciliacao />,
  fluxo_caixa: () => <FinFluxoCaixa />,
  dre: () => <FinDRE />,
  folha: () => <FinFolha />,
  ocr: () => <FinOCRDocumentos />,
  emissor_nfe: () => <FinEmissorNFe />,
  nfe_entrada: () => <FinConsultaNFeEntrada />,
  integracoes: () => <FinIntegracoes />,
  contas: () => <FinContas />,
  centros_custo: () => <FinCentrosCusto />,
  pessoas: () => <FinPessoas />,
  categorias: () => <FinCategorias />,
  plano_contas: () => <FinPlanoContas />,
  saldos_abertura: () => <FinSaldosAbertura />,
  orcamento: () => <FinOrcamento />,
  apuracao: () => <FinApuracao />,
  relatorios: () => <FinRelatorios />,
  transferencia: () => <FinTransferencia />,
  baixa_lote: () => <FinBaixaLote />,
  importar_planilha: () => <FinImportarPlanilhaXlsx />,
  importar_planilha_csv: () => <FinImportarPlanilha />,
  exportar_planilha: () => <FinExportarPlanilhaXlsx />,
  importar_ofx: () => <FinImportarOFX />,
  cnab: () => <FinCNAB />,
  previsto_realizado: () => <FinPrevistoRealizado />,
  custos_contratos: () => <FinCustosPorContrato />,
  resumo_exec: () => <FinResumoExecutivo />,
  aprovacoes: () => <FinAprovacoes />,
  nfse: () => <FinNFSe />,
  calc_margem: () => <FinCalculadoraMargem />,
  open_finance: () => <FinOpenFinance />,
  demonstracoes: () => <FinDemonstracoes />,
  quadro_financeiro: () => <FinQuadroFinanceiro />,
  atividade_usuarios: () => <FinAtividadeUsuarios />,
  config_nfe: () => <FinConfigNFe />,
  pix_cobranca: () => <FinPixCobranca />,
  auditoria_conciliacao: () => <FinAuditoriaConciliacao />,
  plano_contas_padrao: () => <FinPlanoContasPadrao />,
  integracoes_fiscais: () => <FinIntegracoesFiscais />,
  lotes_auditoria: () => <FinLotesAuditoria />,
};

const COMING_SOON: Record<string, { title: string; description: string }> = {
  comissoes: { title: "Bonificações de Vendas", description: "Acesse pela Gestão de Contratos → quitação de NF gera bonificação automaticamente." },
};

/**
 * O cabeçalho das subtelas sai do HUB_ITEMS — mas cinco ids do VIEW_MAP não
 * têm cartão no hub, e nesses o cabeçalho saía sem título próprio: "Financeiro"
 * como h1, sem descrição e com a trilha parando no segundo degrau.
 *
 * Três são alias de rota (abrem a MESMA tela de outro cartão) e herdam o
 * cabeçalho de quem abrem; duas são variantes que o hub resolve por um cartão
 * só e por isso declaram o seu aqui.
 */
const VIEW_ALIAS: Record<string, string> = {
  resumo: "panorama",
  dashboard: "panorama",
};

type CabecalhoSubtela = Pick<HubItem, "label" | "description" | "icon">;

const SUBTELAS_SEM_CARTAO: Record<string, CabecalhoSubtela> = {
  importar_planilha_csv: {
    label: "Importar Planilha CSV",
    description: "Importação em massa de lançamentos a partir de um arquivo CSV.",
    icon: FileSpreadsheet,
  },
  exportar_planilha: {
    label: "Exportar planilha (.xlsx)",
    description: "Gera o arquivo de lançamentos no formato do modelo de importação (.xlsx).",
    icon: FileUp,
  },
};

export default function Financeiro() {
  const { empresaAtiva, loading } = useEmpresa();
  const [searchParams] = useSearchParams();
  const { view: viewNaRota } = useParams<{ view?: string }>();
  const navigate = useNavigate();

  // A subtela é PÁGINA, então mora no caminho: /financeiro/demonstracoes.
  // O `?lid=` fica na busca porque é contexto que atravessa módulos — o
  // processo ativo continua vinculado ao sair do financeiro.
  //
  // `?view=` era o único lugar do sistema que punha subtela em parâmetro.
  // Links antigos continuam funcionando: o efeito abaixo os traduz.
  const viewAntigo = searchParams.get("view");
  const activeView = viewNaRota ?? viewAntigo ?? (getResumoAutoOpen() ? "panorama" : null);

  const busca = (() => {
    const p = new URLSearchParams(searchParams);
    p.delete("view");
    const q = p.toString();
    return q ? `?${q}` : "";
  })();

  const navigateToView = (id: string | null) => {
    navigate(id ? `/financeiro/${id}${busca}` : `/financeiro${busca}`);
  };

  // Tradução de link antigo: `?view=x` vira `/financeiro/x`, com replace para
  // não deixar a URL velha no histórico e virar um passo a desfazer.
  useEffect(() => {
    if (viewAntigo) navigate(`/financeiro/${viewAntigo}${busca}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewAntigo]);

  // Atalhos rápidos do FinResumoVisor disparam navegação programática
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.length > 0) navigateToView(detail);
    };
    window.addEventListener("fin:navigate", handler);
    return () => window.removeEventListener("fin:navigate", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeItem: CabecalhoSubtela | null = activeView
    ? HUB_ITEMS.find((i) => i.id === (VIEW_ALIAS[activeView] ?? activeView))
      ?? SUBTELAS_SEM_CARTAO[activeView]
      ?? null
    : null;
  const IconeModulo = activeItem?.icon ?? Landmark;

  const renderActive = () => {
    if (!activeView) return null;
    const View = VIEW_MAP[activeView];
    if (View) return <View />;
    const cs = COMING_SOON[activeView];
    if (cs) {
      return (
        <Card>
          <CardContent className="p-0">
            <EstadoVazio
              icone={<IconeModulo />}
              titulo={cs.title}
              descricao={cs.description}
            />
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* O "Voltar ao Hub" saiu: com o Voltar do layout logo acima, eram
            duas setas fazendo a mesma coisa. O caminho para o hub continua no
            rastro de migalhas — "Financeiro" ali em cima é clicável —, que
            serve inclusive a quem entrou direto pelo link da subtela e não
            tem percurso para desfazer. A trilha carrega a busca (`?lid=`)
            para o processo ativo continuar vinculado. */}
        {activeView ? (
          // Subtela: não é item de menu, então título, descrição e trilha vêm à
          // mão — do HUB_ITEMS, que é o catálogo das 49 subviews.
          <CabecalhoPagina
            titulo={activeItem?.label ?? "Financeiro"}
            descricao={activeItem?.description}
            icone={<IconeModulo />}
            trilha={[
              { rotulo: "Painel", para: "/dashboard" },
              { rotulo: "Financeiro", para: `/financeiro${busca}` },
              ...(activeItem ? [{ rotulo: activeItem.label }] : []),
            ]}
          />
        ) : (
          // Hub: É item de menu. Título, descrição, ícone e trilha saem do
          // registro `lib/navegacao/paginas.ts` pela rota atual.
          <CabecalhoPagina
            rota="/financeiro"
            acoes={
              <>
                <Button variant="outline" onClick={() => navigateToView("panorama")}>
                  Painel completo
                </Button>
                <Button onClick={() => navigateToView("lancamentos")}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Novo lançamento
                </Button>
              </>
            }
          />
        )}

        <div className="space-y-6">
          {!loading && !empresaAtiva ? (
            <Card>
              <CardContent className="p-0">
                <EstadoVazio
                  icone={<Building2 />}
                  titulo="Nenhuma empresa ativa"
                  descricao="Selecione uma empresa ativa no menu superior para acessar o módulo financeiro."
                />
              </CardContent>
            </Card>
          ) : activeView ? (
            renderActive()
          ) : (
            <>
              {/* REBRAND — o painel do protótipo (KPIs, fluxo de caixa, o que
                  vence nos próximos dias, a conferência e as movimentações
                  mais próximas) entra ACIMA do hub, que continua inteiro.
                  Aditivo: o hub tem busca, favoritos e recentes que
                  funcionam, e reescrevê-lo para encaixar um cabeçalho seria
                  trocar risco por estética. */}
              <FinPainelInicial onNavigate={navigateToView} />
              <FinHomeHub onNavigate={navigateToView} />
            </>
          )}
        </div>
        <FinCommandPalette onNavigate={navigateToView} />
      </div>
    </AppLayout>
  );
}
