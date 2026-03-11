import { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { writeExcelFile, readExcelAsArrays } from '@/lib/excel-utils';
import type { EditalItem } from './EditalUploader';
import { valorPorExtenso } from '@/lib/numero-extenso';

interface PlanilhaPrecosProps {
  itens: EditalItem[];
  setItens: (itens: EditalItem[]) => void;
}

export default function PlanilhaPrecos({ itens, setItens }: PlanilhaPrecosProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const recalcExtenso = (item: EditalItem): EditalItem => {
    const unitVal = parseFloat(item.valorUnitario.replace(',', '.')) || 0;
    const totalVal = parseFloat(item.valorTotal.replace(',', '.')) || 0;
    return {
      ...item,
      valorUnitarioExtenso: unitVal > 0 ? valorPorExtenso(unitVal) : '',
      valorTotalExtenso: totalVal > 0 ? valorPorExtenso(totalVal) : '',
    };
  };

  const updateItem = (index: number, field: keyof EditalItem, value: string) => {
    const updated = [...itens];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantidade' || field === 'valorUnitario') {
      const qty = parseFloat(updated[index].quantidade.replace(',', '.')) || 0;
      const unit = parseFloat(updated[index].valorUnitario.replace(',', '.')) || 0;
      updated[index].valorTotal = (qty * unit).toFixed(2);
    }

    updated[index] = recalcExtenso(updated[index]);
    setItens(updated);
  };

  const addItem = () => {
    setItens([...itens, { item: String(itens.length + 1), descricao: '', quantidade: '', unidade: 'UN', marca: '', fabricante: '', modelo: '', valorUnitario: '', valorUnitarioExtenso: '', valorTotal: '', valorTotalExtenso: '' }]);
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorGlobal = itens.reduce((sum, i) => sum + (parseFloat(i.valorTotal.replace(',', '.')) || 0), 0);

  // ── Excel Download ──
  const handleDownloadTemplate = async () => {
    const headers = ['Item', 'Descrição', 'Quantidade', 'Unidade', 'Marca', 'Fabricante', 'Modelo', 'Valor Unitário (R$)', 'Valor Total (R$)'];
    const sampleRows = [
      ['1', 'Exemplo de produto/serviço', '10', 'UN', 'Marca X', 'Fabricante Y', 'Modelo Z', '150.00', '1500.00'],
      ['2', '', '', 'UN', '', '', '', '', ''],
    ];
    await writeExcelFile('modelo_planilha_precos.xlsx', [{
      name: 'Planilha de Preços',
      data: [headers, ...sampleRows],
      colWidths: [6, 40, 12, 10, 16, 16, 16, 18, 18],
    }]);
    toast.success('Modelo Excel baixado com sucesso!');
  };

  // ── Excel Upload ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const allRows = await readExcelAsArrays(file);

      // Skip header row
      const dataRows = allRows.slice(1).filter(r => r.some(cell => cell?.toString().trim()));
      if (dataRows.length === 0) {
        toast.error('Planilha vazia ou sem dados válidos.');
        return;
      }

      const parsed: EditalItem[] = dataRows.map((r, i) => {
        const qty = parseFloat(String(r[2] || '0').replace(',', '.')) || 0;
        const unit = parseFloat(String(r[7] || r[4] || '0').replace(',', '.')) || 0;
        const total = parseFloat(String(r[8] || r[5] || '0').replace(',', '.')) || (qty * unit);
        return recalcExtenso({
          item: String(r[0] || i + 1),
          descricao: String(r[1] || ''),
          quantidade: String(r[2] || ''),
          unidade: String(r[3] || 'UN'),
          marca: String(r[4] || ''),
          fabricante: String(r[5] || ''),
          modelo: String(r[6] || ''),
          valorUnitario: unit ? unit.toFixed(2) : '',
          valorUnitarioExtenso: '',
          valorTotal: total ? total.toFixed(2) : '',
          valorTotalExtenso: '',
        });
      });

      setItens(parsed);
      toast.success(`${parsed.length} itens importados da planilha!`);
    } catch {
      toast.error('Erro ao ler a planilha. Verifique o formato.');
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Excel actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4 mr-1" /> Baixar Modelo Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" /> Importar Planilha Excel
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-2 py-2 text-left w-12">Item</th>
              <th className="px-2 py-2 text-left">Descrição</th>
              <th className="px-2 py-2 text-left w-16">Qtd</th>
              <th className="px-2 py-2 text-left w-14">Und</th>
              <th className="px-2 py-2 text-left w-24">Marca</th>
              <th className="px-2 py-2 text-left w-24">Fabricante</th>
              <th className="px-2 py-2 text-left w-24">Modelo</th>
              <th className="px-2 py-2 text-left w-24">Vlr Unit. (R$)</th>
              <th className="px-2 py-2 text-left w-36">Vlr Unit. Extenso</th>
              <th className="px-2 py-2 text-left w-24">Vlr Total (R$)</th>
              <th className="px-2 py-2 text-left w-36">Vlr Total Extenso</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.item} onChange={e => updateItem(i, 'item', e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.quantidade} onChange={e => updateItem(i, 'quantidade', e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.unidade} onChange={e => updateItem(i, 'unidade', e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.marca} onChange={e => updateItem(i, 'marca', e.target.value)} placeholder="Marca" />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.fabricante} onChange={e => updateItem(i, 'fabricante', e.target.value)} placeholder="Fabricante" />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.modelo} onChange={e => updateItem(i, 'modelo', e.target.value)} placeholder="Modelo" />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs" value={item.valorUnitario} onChange={e => updateItem(i, 'valorUnitario', e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <span className="text-xs text-muted-foreground italic leading-tight block truncate max-w-[140px]" title={item.valorUnitarioExtenso}>
                    {item.valorUnitarioExtenso || '—'}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs bg-muted/30" value={item.valorTotal} readOnly />
                </td>
                <td className="px-2 py-1">
                  <span className="text-xs text-muted-foreground italic leading-tight block truncate max-w-[140px]" title={item.valorTotalExtenso}>
                    {item.valorTotalExtenso || '—'}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Item
        </Button>
        <div className="text-sm font-semibold text-foreground">
          Valor Global: <span className="text-accent">R$ {valorGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          {valorGlobal > 0 && (
            <span className="block text-xs font-normal text-muted-foreground italic mt-0.5">
              ({valorPorExtenso(valorGlobal)})
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        IMPORTANTE: Nos preços ofertados já estão inclusos frete, taxas, impostos e demais despesas.
      </p>
    </div>
  );
}
