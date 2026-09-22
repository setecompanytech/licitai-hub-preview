import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, ShoppingCart, FileSpreadsheet, BarChart3 } from 'lucide-react';
import CotacaoFornecedorUpload from './CotacaoFornecedorUpload';
import CotacoesManager from './CotacoesManager';
import ListasCompras from './ListasCompras';
import ImportacoesManager from './ImportacoesManager';
import ComparativoDashboard from './ComparativoDashboard';

/**
 * Cotações & Listas — o lado da compra. O "Comparativo de fontes" (cotações
 * de fornecedor × pesquisas de preço) vivia na aba "Inteligência", que saiu
 * em 22/09: ele compara cotações, então mora com elas.
 */
export default function CotacoesUnificado() {
  const [activeTab, setActiveTab] = useState('cotacoes');

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-6 text-foreground">Cotações & Listas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie cotações formais, listas de compras, uploads de fornecedores e importações de planilhas em um só lugar.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Fila sublinhada da ui, rolável no celular. */}
        <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:thin]">
          <TabsTrigger value="cotacoes" className="shrink-0">
            <FileText className="h-4 w-4" aria-hidden="true" /> Cotações Formais
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="shrink-0">
            <Upload className="h-4 w-4" aria-hidden="true" /> Upload Fornecedores
          </TabsTrigger>
          <TabsTrigger value="listas" className="shrink-0">
            <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Listas de Compras
          </TabsTrigger>
          <TabsTrigger value="importacoes" className="shrink-0">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Importar Planilha
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="shrink-0">
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Comparativo de Fontes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cotacoes">
          <CotacoesManager />
        </TabsContent>

        <TabsContent value="fornecedores">
          <CotacaoFornecedorUpload />
        </TabsContent>

        <TabsContent value="listas">
          <ListasCompras />
        </TabsContent>

        <TabsContent value="importacoes">
          <ImportacoesManager />
        </TabsContent>

        <TabsContent value="comparativo">
          <ComparativoDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
