import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Landmark, ArrowDownCircle, ArrowUpCircle, RefreshCw, BarChart3,
  Barcode, FileText, Settings2
} from 'lucide-react';
import ContasBancarias from '@/components/financeiro/ContasBancarias';
import ContasPagar from '@/components/financeiro/ContasPagar';
import ContasReceber from '@/components/financeiro/ContasReceber';
import ConciliacaoBancaria from '@/components/financeiro/ConciliacaoBancaria';
import FluxoCaixa from '@/components/financeiro/FluxoCaixa';
import Boletos from '@/components/financeiro/Boletos';
import EmissaoNFe from '@/components/financeiro/EmissaoNFe';
import ConciliacaoRegras from '@/components/financeiro/ConciliacaoRegras';

export default function Financeiro() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão financeira completa: fluxo de caixa, DRE, conciliação, boletos e emissão de NF
        </p>
      </div>

      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="contas"><Landmark className="w-3.5 h-3.5 mr-1" /> Contas Bancárias</TabsTrigger>
          <TabsTrigger value="conciliacao"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Conciliação</TabsTrigger>
          <TabsTrigger value="regras"><Settings2 className="w-3.5 h-3.5 mr-1" /> Regras</TabsTrigger>
          <TabsTrigger value="pagar"><ArrowDownCircle className="w-3.5 h-3.5 mr-1" /> A Pagar</TabsTrigger>
          <TabsTrigger value="receber"><ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> A Receber</TabsTrigger>
          <TabsTrigger value="boletos"><Barcode className="w-3.5 h-3.5 mr-1" /> Boletos</TabsTrigger>
          <TabsTrigger value="nfe"><FileText className="w-3.5 h-3.5 mr-1" /> NF-e/NFS-e</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral"><FluxoCaixa /></TabsContent>
        <TabsContent value="contas"><ContasBancarias /></TabsContent>
        <TabsContent value="conciliacao"><ConciliacaoBancaria /></TabsContent>
        <TabsContent value="regras"><ConciliacaoRegras /></TabsContent>
        <TabsContent value="pagar"><ContasPagar /></TabsContent>
        <TabsContent value="receber"><ContasReceber /></TabsContent>
        <TabsContent value="boletos"><Boletos /></TabsContent>
        <TabsContent value="nfe"><EmissaoNFe /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
