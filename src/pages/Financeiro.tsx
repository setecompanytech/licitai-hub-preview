import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Home } from "lucide-react";
import FinHomeHub, { HUB_ITEMS } from "@/components/financeiro/FinHomeHub";
import FinResumoVisor, { getResumoAutoOpen } from "@/components/financeiro/FinResumoVisor";
import FinApuracao from "@/components/financeiro/FinApuracao";
import FinPlanoContas from "@/components/financeiro/FinPlanoContas";
import FinSaldosAbertura from "@/components/financeiro/FinSaldosAbertura";
import FinOrcamento from "@/components/financeiro/FinOrcamento";
import FinDashboardTabs from "@/components/financeiro/FinDashboardTabs";
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
import FinImportarOMIE from "@/components/financeiro/FinImportarOMIE";
import FinExportarOMIE from "@/components/financeiro/FinExportarOMIE";
import FinImportarOFX from "@/components/financeiro/FinImportarOFX";
import FinCNAB from "@/components/financeiro/FinCNAB";
import FinPrevistoRealizado from "@/components/financeiro/FinPrevistoRealizado";
import FinResumoExecutivo from "@/components/financeiro/FinResumoExecutivo";
import FinAprovacoes from "@/components/financeiro/FinAprovacoes";
import FinNFSe from "@/components/financeiro/FinNFSe";
import FinCommandPalette from "@/components/financeiro/FinCommandPalette";
import { useEmpresa } from "@/contexts/EmpresaContext";

const VIEW_MAP: Record<string, () => JSX.Element> = {
  resumo: () => <FinResumoVisor />,
  dashboard: () => <FinDashboardTabs />,
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
  importar_planilha: () => <FinImportarOMIE />,
  importar_planilha_csv: () => <FinImportarPlanilha />,
  importar_omie: () => <FinImportarOMIE />,
  importar_ofx: () => <FinImportarOFX />,
  cnab: () => <FinCNAB />,
  previsto_realizado: () => <FinPrevistoRealizado />,
  resumo_exec: () => <FinResumoExecutivo />,
  aprovacoes: () => <FinAprovacoes />,
  nfse: () => <FinNFSe />,
};

const COMING_SOON: Record<string, { title: string; description: string }> = {
  comissoes: { title: "Comissões de Vendas", description: "Acesse pela Gestão de Contratos → quitação de NF gera comissão automaticamente." },
};

export default function Financeiro() {
  const { empresaAtiva, loading } = useEmpresa();
  const initialView = getResumoAutoOpen() ? "resumo" : null;
  const [activeView, setActiveView] = useState<string | null>(initialView);

  // Atalhos rápidos do FinResumoVisor disparam navegação programática
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.length > 0) setActiveView(detail);
    };
    window.addEventListener("fin:navigate", handler);
    return () => window.removeEventListener("fin:navigate", handler);
  }, []);

  const activeItem = activeView ? HUB_ITEMS.find((i) => i.id === activeView) : null;

  const renderActive = () => {
    if (!activeView) return null;
    const View = VIEW_MAP[activeView];
    if (View) return <View />;
    const cs = COMING_SOON[activeView];
    if (cs) {
      return (
        <Card>
          <CardContent className="py-16 text-center space-y-2">
            <h3 className="text-lg font-semibold">{cs.title}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{cs.description}</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <button
                onClick={() => setActiveView(null)}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Home className="w-3 h-3" /> Financeiro
              </button>
              {activeItem && (
                <>
                  <span>/</span>
                  <span className="text-foreground">{activeItem.label}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeItem ? activeItem.label : "Financeiro"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeItem
                ? activeItem.description
                : "Hub central de operações financeiras — escolha um módulo abaixo."}
            </p>
          </div>
          {activeView && (
            <Button variant="outline" size="sm" onClick={() => setActiveView(null)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar ao Hub
            </Button>
          )}
        </header>

        {!loading && !empresaAtiva ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecione uma empresa ativa no menu superior para acessar o módulo financeiro.
            </CardContent>
          </Card>
        ) : activeView ? (
          renderActive()
        ) : (
          <FinHomeHub onNavigate={setActiveView} />
        )}
        <FinCommandPalette onNavigate={setActiveView} />
      </div>
    </AppLayout>
  );
}
