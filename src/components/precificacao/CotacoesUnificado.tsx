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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cotações & Listas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie cotações formais, listas de compras, uploads de fornecedores e importações de planilhas em um só lugar.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 h-auto flex-wrap">
          <TabsTrigger value="cotacoes" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Cotações Formais
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Upload Fornecedores
          </TabsTrigger>
          <TabsTrigger value="listas" className="gap-1.5 text-xs">
            <ShoppingCart className="w-3.5 h-3.5" /> Listas de Compras
          </TabsTrigger>
          <TabsTrigger value="importacoes" className="gap-1.5 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Importar Planilha
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
