import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle, Download, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { writeExcelFromJson, readExcelFile } from '@/lib/excel-utils';

type ImportResult = {
  total: number;
  importados: number;
  erros: string[];
  items: Array<{
    product_title: string;
    brand: string;
    price: number;
    freight: number;
    supplier_name: string;
    source_name: string;
    uf: string;
    product_url: string;
  }>;
};

const EXPECTED_COLUMNS = [
  'source_name', 'supplier_name', 'product_title', 'brand', 'sku',
  'price', 'freight', 'total_price', 'stock', 'delivery_days',
  'uf', 'product_url', 'collected_at',
];

export default function ImportacoesManager() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadTemplate = async () => {
    await writeExcelFromJson('template-importacao-precos.xlsx', 'Template', [{
      source_name: 'Mercado Livre',
      supplier_name: 'Loja Exemplo',
      product_title: 'Notebook Dell Inspiron 15',
      brand: 'Dell',
      sku: 'DELL-I15-001',
      price: 3499.90,
      freight: 0,
      total_price: 3499.90,
      stock: 10,
      delivery_days: 5,
      uf: 'SP',
      product_url: 'https://www.mercadolivre.com.br/exemplo',
      collected_at: new Date().toISOString().split('T')[0],
    }]);
    toast.success('Template baixado!');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    setResult(null);

    try {
      const rows: any[] = await readExcelFile(file);

      if (rows.length === 0) {
        toast.error('Planilha vazia.');
        setImporting(false);
        return;
      }

      const erros: string[] = [];
      const validItems: any[] = [];

      rows.forEach((row, idx) => {
        const lineNum = idx + 2;
        if (!row.product_title) {
          erros.push(`Linha ${lineNum}: product_title obrigatório`);
          return;
        }
        if (!row.price && !row.total_price) {
          erros.push(`Linha ${lineNum}: price ou total_price obrigatório`);
          return;
        }
        const price = parseFloat(row.price) || 0;
        const freight = parseFloat(row.freight) || 0;
        if (price < 0) {
          erros.push(`Linha ${lineNum}: preço negativo`);
          return;
        }
        validItems.push({
          product_title: String(row.product_title).trim(),
          brand: row.brand ? String(row.brand).trim() : '',
          price,
          freight,
          total_price: row.total_price ? parseFloat(row.total_price) : price + freight,
          supplier_name: row.supplier_name ? String(row.supplier_name).trim() : '',
          source_name: row.source_name ? String(row.source_name).trim() : '',
          uf: row.uf ? String(row.uf).trim().toUpperCase() : '',
          product_url: row.product_url ? String(row.product_url).trim() : '',
          delivery_days: row.delivery_days ? parseInt(row.delivery_days) : null,
          stock: row.stock ? parseInt(row.stock) : null,
        });
      });

      // Log the import job
      await supabase.from('import_jobs').insert({
        tipo: 'upload_xlsx',
        arquivo_nome: file.name,
        status: erros.length > 0 && validItems.length === 0 ? 'erro' : 'concluido',
        registros_total: rows.length,
        registros_importados: validItems.length,
        erros: erros as any,
        user_id: user.id,
      });

      setResult({
        total: rows.length,
        importados: validItems.length,
        erros,
        items: validItems,
      });

      if (validItems.length > 0) {
        toast.success(`${validItems.length} registros importados com sucesso!`);
      }
      if (erros.length > 0) {
        toast.warning(`${erros.length} erros encontrados.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar arquivo.');
    }

    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Upload className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Importação de Dados</h3>
      </div>

      <div className="bg-muted/30 border border-border/40 rounded-lg p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Formato aceito: XLSX ou CSV</p>
            <p className="text-muted-foreground text-xs">
              Colunas esperadas: <code className="bg-muted px-1 py-0.5 rounded text-xs">source_name, supplier_name, product_title, brand, sku, price, freight, total_price, stock, delivery_days, uf, product_url, collected_at</code>
            </p>
            <p className="text-muted-foreground text-xs">Campos obrigatórios: <strong>product_title</strong> e <strong>price</strong> (ou total_price).</p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}
            {importing ? 'Importando...' : 'Upload Planilha'}
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-1" /> Baixar Template
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border/40 rounded-lg p-3 text-center">
              <p className="text-lg font-bold">{result.total}</p>
              <p className="text-xs text-muted-foreground">Total de registros</p>
            </div>
            <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-success">{result.importados}</p>
              <p className="text-xs text-muted-foreground">Importados</p>
            </div>
            <div className={`${result.erros.length > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30 border-border/40'} border rounded-lg p-3 text-center`}>
              <p className={`text-lg font-bold ${result.erros.length > 0 ? 'text-destructive' : ''}`}>{result.erros.length}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>

          {/* Errors */}
          {result.erros.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
              {result.erros.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {result.items.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Preview dos dados importados</h4>
              <div className="overflow-x-auto border border-border/40 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs">Marca</TableHead>
                      <TableHead className="text-xs text-right">Preço</TableHead>
                      <TableHead className="text-xs text-right">Frete</TableHead>
                      <TableHead className="text-xs">Fornecedor</TableHead>
                      <TableHead className="text-xs">Fonte</TableHead>
                      <TableHead className="text-xs">UF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.slice(0, 20).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm max-w-[250px] truncate">{item.product_title}</TableCell>
                        <TableCell className="text-xs">{item.brand || '—'}</TableCell>
                        <TableCell className="text-right text-sm">R$ {item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm">R$ {item.freight.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{item.supplier_name || '—'}</TableCell>
                        <TableCell className="text-xs">{item.source_name || '—'}</TableCell>
                        <TableCell className="text-xs">{item.uf || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {result.items.length > 20 && (
                <p className="text-xs text-muted-foreground mt-1">Mostrando 20 de {result.items.length} registros.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
