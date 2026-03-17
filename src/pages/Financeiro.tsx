import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Landmark, ArrowDownCircle, ArrowUpCircle, RefreshCw, BarChart3,
  Barcode, FileText, Settings2, FileOutput, FileInput
} from 'lucide-react';
import ContasBancarias from '@/components/financeiro/ContasBancarias';
import ContasPagar from '@/components/financeiro/ContasPagar';
import ContasReceber from '@/components/financeiro/ContasReceber';
import ConciliacaoBancaria from '@/components/financeiro/ConciliacaoBancaria';
import FluxoCaixa from '@/components/financeiro/FluxoCaixa';
import Boletos from '@/components/financeiro/Boletos';
import EmissaoNFe from '@/components/financeiro/EmissaoNFe';
import ConciliacaoRegras from '@/components/financeiro/ConciliacaoRegras';
import NFSaida from '@/components/financeiro/NFSaida';
import NFEntrada from '@/components/financeiro/NFEntrada';

export default function Financeiro() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão financeira completa: fluxo de caixa, NF-e/NFS-e, conciliação, boletos e contas a pagar/receber
        </p>
      </div>

      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="nf-saida"><FileOutput className="w-3.5 h-3.5 mr-1" /> NF Saída</TabsTrigger>
          <TabsTrigger value="nf-entrada"><FileInput className="w-3.5 h-3.5 mr-1" /> NF Entrada</TabsTrigger>
          <TabsTrigger value="contas"><Landmark className="w-3.5 h-3.5 mr-1" /> Contas Bancárias</TabsTrigger>
          <TabsTrigger value="conciliacao"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Conciliação</TabsTrigger>
          <TabsTrigger value="regras"><Settings2 className="w-3.5 h-3.5 mr-1" /> Regras</TabsTrigger>
          <TabsTrigger value="pagar"><ArrowDownCircle className="w-3.5 h-3.5 mr-1" /> A Pagar</TabsTrigger>
          <TabsTrigger value="receber"><ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> A Receber</TabsTrigger>
          <TabsTrigger value="boletos"><Barcode className="w-3.5 h-3.5 mr-1" /> Boletos</TabsTrigger>
          <TabsTrigger value="config-fiscal"><FileText className="w-3.5 h-3.5 mr-1" /> Config. Fiscal</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral"><FluxoCaixa /></TabsContent>
        <TabsContent value="nf-saida"><NFSaida /></TabsContent>
        <TabsContent value="nf-entrada"><NFEntrada /></TabsContent>
        <TabsContent value="contas"><ContasBancarias /></TabsContent>
        <TabsContent value="conciliacao"><ConciliacaoBancaria /></TabsContent>
        <TabsContent value="regras"><ConciliacaoRegras /></TabsContent>
        <TabsContent value="pagar"><ContasPagar /></TabsContent>
        <TabsContent value="receber"><ContasReceber /></TabsContent>
        <TabsContent value="boletos"><Boletos /></TabsContent>
        <TabsContent value="config-fiscal"><EmissaoNFe /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
