import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, ArrowLeftRight, Receipt, Users, FileBarChart,
  Landmark, ArrowDownCircle, ArrowUpCircle, RefreshCw, Barcode, Settings2
} from 'lucide-react';
import FinDashboard from '@/components/financeiro/FinDashboard';
import FinFluxoCaixa from '@/components/financeiro/FinFluxoCaixa';
import FinNotasFiscais from '@/components/financeiro/FinNotasFiscais';
import FinComissoes from '@/components/financeiro/FinComissoes';
import FinRelatorios from '@/components/financeiro/FinRelatorios';
import ContasBancarias from '@/components/financeiro/ContasBancarias';
import ContasPagar from '@/components/financeiro/ContasPagar';
import ContasReceber from '@/components/financeiro/ContasReceber';
import ConciliacaoBancaria from '@/components/financeiro/ConciliacaoBancaria';
import ConciliacaoRegras from '@/components/financeiro/ConciliacaoRegras';
import Boletos from '@/components/financeiro/Boletos';

export default function Financeiro() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão financeira completa: dashboard, fluxo de caixa, NF-e, comissões e relatórios
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="fluxo"><ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="nf"><Receipt className="w-3.5 h-3.5 mr-1" /> Notas Fiscais</TabsTrigger>
          <TabsTrigger value="comissoes"><Users className="w-3.5 h-3.5 mr-1" /> Comissões</TabsTrigger>
          <TabsTrigger value="contas"><Landmark className="w-3.5 h-3.5 mr-1" /> Contas</TabsTrigger>
          <TabsTrigger value="pagar"><ArrowDownCircle className="w-3.5 h-3.5 mr-1" /> A Pagar</TabsTrigger>
          <TabsTrigger value="receber"><ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> A Receber</TabsTrigger>
          <TabsTrigger value="conciliacao"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Conciliação</TabsTrigger>
          <TabsTrigger value="boletos"><Barcode className="w-3.5 h-3.5 mr-1" /> Boletos</TabsTrigger>
          <TabsTrigger value="relatorios"><FileBarChart className="w-3.5 h-3.5 mr-1" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><FinDashboard /></TabsContent>
        <TabsContent value="fluxo"><FinFluxoCaixa /></TabsContent>
        <TabsContent value="nf"><FinNotasFiscais /></TabsContent>
        <TabsContent value="comissoes"><FinComissoes /></TabsContent>
        <TabsContent value="contas"><ContasBancarias /></TabsContent>
        <TabsContent value="pagar"><ContasPagar /></TabsContent>
        <TabsContent value="receber"><ContasReceber /></TabsContent>
        <TabsContent value="conciliacao">
          <div className="space-y-4">
            <ConciliacaoBancaria />
            <ConciliacaoRegras />
          </div>
        </TabsContent>
        <TabsContent value="boletos"><Boletos /></TabsContent>
        <TabsContent value="relatorios"><FinRelatorios /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
