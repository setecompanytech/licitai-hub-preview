import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, ListOrdered, Wallet, Users, Tags, Banknote, ArrowDownCircle, ArrowUpCircle, FolderTree, LineChart, FileBarChart, Briefcase, ScanLine, Plug, FileText, Inbox, BookOpen, Scale, Target, FileDown, Calculator, Eye } from "lucide-react";
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
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent } from "@/components/ui/card";

export default function Financeiro() {
  const { empresaAtiva, loading } = useEmpresa();
  const defaultTab = getResumoAutoOpen() ? "resumo" : "dashboard";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Gestão completa de contas a pagar, receber, conciliação bancária, fluxo de caixa e DRE.
          </p>
        </header>

        {!loading && !empresaAtiva ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecione uma empresa ativa no menu superior para acessar o módulo financeiro.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto w-full">
              <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" />Dashboard</TabsTrigger>
              <TabsTrigger value="lancamentos"><ListOrdered className="w-4 h-4 mr-1.5" />Lançamentos</TabsTrigger>
              <TabsTrigger value="a_pagar"><ArrowUpCircle className="w-4 h-4 mr-1.5" />Contas a Pagar</TabsTrigger>
              <TabsTrigger value="a_receber"><ArrowDownCircle className="w-4 h-4 mr-1.5" />Contas a Receber</TabsTrigger>
              <TabsTrigger value="conciliacao"><Banknote className="w-4 h-4 mr-1.5" />Conciliação</TabsTrigger>
              <TabsTrigger value="fluxo_caixa"><LineChart className="w-4 h-4 mr-1.5" />Fluxo de Caixa</TabsTrigger>
              <TabsTrigger value="dre"><FileBarChart className="w-4 h-4 mr-1.5" />DRE</TabsTrigger>
              <TabsTrigger value="folha"><Briefcase className="w-4 h-4 mr-1.5" />Folha</TabsTrigger>
              <TabsTrigger value="ocr"><ScanLine className="w-4 h-4 mr-1.5" />OCR Docs</TabsTrigger>
              <TabsTrigger value="emissor_nfe"><FileText className="w-4 h-4 mr-1.5" />Emissor NF-e</TabsTrigger>
              <TabsTrigger value="nfe_entrada"><Inbox className="w-4 h-4 mr-1.5" />NF-e Entrada</TabsTrigger>
              <TabsTrigger value="integracoes"><Plug className="w-4 h-4 mr-1.5" />Integrações</TabsTrigger>
              <TabsTrigger value="contas"><Wallet className="w-4 h-4 mr-1.5" />Contas</TabsTrigger>
              <TabsTrigger value="centros_custo"><FolderTree className="w-4 h-4 mr-1.5" />Centros de Custo</TabsTrigger>
              <TabsTrigger value="pessoas"><Users className="w-4 h-4 mr-1.5" />Pessoas</TabsTrigger>
              <TabsTrigger value="categorias"><Tags className="w-4 h-4 mr-1.5" />Categorias</TabsTrigger>
              <TabsTrigger value="plano_contas"><BookOpen className="w-4 h-4 mr-1.5" />Plano de Contas</TabsTrigger>
              <TabsTrigger value="saldos_abertura"><Scale className="w-4 h-4 mr-1.5" />Saldos de Abertura</TabsTrigger>
              <TabsTrigger value="orcamento"><Target className="w-4 h-4 mr-1.5" />Orçamento</TabsTrigger>
              <TabsTrigger value="apuracao"><Calculator className="w-4 h-4 mr-1.5" />Apuração</TabsTrigger>
              <TabsTrigger value="relatorios"><FileDown className="w-4 h-4 mr-1.5" />Relatórios</TabsTrigger>
            </TabsList>
            <TabsContent value="dashboard"><FinDashboardTabs /></TabsContent>
            <TabsContent value="lancamentos"><FinLancamentos /></TabsContent>
            <TabsContent value="a_pagar"><FinContasPagar /></TabsContent>
            <TabsContent value="a_receber"><FinContasReceber /></TabsContent>
            <TabsContent value="conciliacao"><FinConciliacao /></TabsContent>
            <TabsContent value="fluxo_caixa"><FinFluxoCaixa /></TabsContent>
            <TabsContent value="dre"><FinDRE /></TabsContent>
            <TabsContent value="folha"><FinFolha /></TabsContent>
            <TabsContent value="ocr"><FinOCRDocumentos /></TabsContent>
            <TabsContent value="emissor_nfe"><FinEmissorNFe /></TabsContent>
            <TabsContent value="nfe_entrada"><FinConsultaNFeEntrada /></TabsContent>
            <TabsContent value="integracoes"><FinIntegracoes /></TabsContent>
            <TabsContent value="contas"><FinContas /></TabsContent>
            <TabsContent value="centros_custo"><FinCentrosCusto /></TabsContent>
            <TabsContent value="pessoas"><FinPessoas /></TabsContent>
            <TabsContent value="categorias"><FinCategorias /></TabsContent>
            <TabsContent value="plano_contas"><FinPlanoContas /></TabsContent>
            <TabsContent value="saldos_abertura"><FinSaldosAbertura /></TabsContent>
            <TabsContent value="orcamento"><FinOrcamento /></TabsContent>
            <TabsContent value="apuracao"><FinApuracao /></TabsContent>
            <TabsContent value="relatorios"><FinRelatorios /></TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
