import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, ShoppingCart, FileSpreadsheet } from 'lucide-react';
import CotacaoFornecedorUpload from './CotacaoFornecedorUpload';
import CotacoesManager from './CotacoesManager';
import ListasCompras from './ListasCompras';
import ImportacoesManager from './ImportacoesManager';

export default function CotacoesUnificado() {
  const [activeTab, setActiveTab] = useState('cotacoes');

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">Cotações & Listas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie cotações formais, listas de compras, uploads de fornecedores e importações de planilhas em um só lugar.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="cotacoes" className="gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" /> Cotações Formais
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="gap-2">
            <Upload className="w-4 h-4" aria-hidden="true" /> Upload Fornecedores
          </TabsTrigger>
          <TabsTrigger value="listas" className="gap-2">
            <ShoppingCart className="w-4 h-4" aria-hidden="true" /> Listas de Compras
          </TabsTrigger>
          <TabsTrigger value="importacoes" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" /> Importar Planilha
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
      </Tabs>
    </div>
  );
}
