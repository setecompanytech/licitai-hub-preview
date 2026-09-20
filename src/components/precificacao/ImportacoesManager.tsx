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
import LinhaKpis from '@/components/shared/LinhaKpis';
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-lg font-semibold leading-6 text-foreground">Importação de Dados</h3>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-secondary p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium text-foreground">Formato aceito: XLSX ou CSV</p>
            <p className="text-sm text-muted-foreground">
              Colunas esperadas: <code className="rounded-sm border border-border bg-card px-1 py-0.5 text-xs">source_name, supplier_name, product_title, brand, sku, price, freight, total_price, stock, delivery_days, uf, product_url, collected_at</code>
            </p>
            <p className="text-sm text-muted-foreground">Campos obrigatórios: <strong>product_title</strong> e <strong>price</strong> (ou total_price).</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            {importing ? 'Importando...' : 'Upload Planilha'}
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download aria-hidden="true" /> Baixar Template
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Summary — cartões KPI do DS (`LinhaKpis`), os mesmos números. */}
          <LinhaKpis
            itens={[
              { rotulo: 'Total de registros', valor: String(result.total), icone: FileSpreadsheet },
              { rotulo: 'Importados', valor: String(result.importados), icone: CheckCircle, tom: 'ok' },
              { rotulo: 'Erros', valor: String(result.erros.length), icone: AlertTriangle, tom: result.erros.length > 0 ? 'critico' : 'neutro' },
            ]}
          />

          {/* Errors */}
          {result.erros.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-destructive-line bg-destructive-tint p-4" role="alert">
              {result.erros.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive-ink">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {result.items.length > 0 && (
            <div>
              <h4 className="mb-2 text-base font-semibold leading-6 text-foreground">Preview dos dados importados</h4>
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Frete</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>UF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.slice(0, 20).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="max-w-[250px]" truncate>{item.product_title}</TableCell>
                        <TableCell>{item.brand || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums" nowrap>R$ {item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums" nowrap>R$ {item.freight.toFixed(2)}</TableCell>
                        <TableCell>{item.supplier_name || '—'}</TableCell>
                        <TableCell>{item.source_name || '—'}</TableCell>
                        <TableCell>{item.uf || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {result.items.length > 20 && (
                <p className="mt-1 text-xs text-muted-foreground">Mostrando 20 de {result.items.length} registros.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
