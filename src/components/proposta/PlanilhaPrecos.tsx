import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { EditalItem } from './EditalUploader';

interface PlanilhaPrecosProps {
  itens: EditalItem[];
  setItens: (itens: EditalItem[]) => void;
}

export default function PlanilhaPrecos({ itens, setItens }: PlanilhaPrecosProps) {
  const updateItem = (index: number, field: keyof EditalItem, value: string) => {
    const updated = [...itens];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate total
    if (field === 'quantidade' || field === 'valorUnitario') {
      const qty = parseFloat(updated[index].quantidade.replace(',', '.')) || 0;
      const unit = parseFloat(updated[index].valorUnitario.replace(',', '.')) || 0;
      updated[index].valorTotal = (qty * unit).toFixed(2);
    }

    setItens(updated);
  };

  const addItem = () => {
    setItens([...itens, { item: String(itens.length + 1), descricao: '', quantidade: '', unidade: 'UN', valorUnitario: '', valorTotal: '' }]);
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorGlobal = itens.reduce((sum, i) => sum + (parseFloat(i.valorTotal.replace(',', '.')) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-2 py-2 text-left w-12">Item</th>
              <th className="px-2 py-2 text-left">Descrição</th>
              <th className="px-2 py-2 text-left w-20">Qtd</th>
              <th className="px-2 py-2 text-left w-16">Und</th>
              <th className="px-2 py-2 text-left w-28">Vlr Unit. (R$)</th>
              <th className="px-2 py-2 text-left w-28">Vlr Total (R$)</th>
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
                  <Input className="h-8 text-xs" value={item.valorUnitario} onChange={e => updateItem(i, 'valorUnitario', e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <Input className="h-8 text-xs bg-muted/30" value={item.valorTotal} readOnly />
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        IMPORTANTE: Nos preços ofertados já estão inclusos frete, taxas, impostos e demais despesas.
      </p>
    </div>
  );
}
