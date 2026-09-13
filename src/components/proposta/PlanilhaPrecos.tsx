import { useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Download, Upload, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { writeExcelFile, readExcelAsArrays } from '@/lib/excel-utils';
import type { EditalItem } from './EditalUploader';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { calcularPrecoSugerido } from '@/hooks/usePrecoSugerido';

interface PlanilhaPrecosProps {
  itens: EditalItem[];
  setItens: (itens: EditalItem[]) => void;
}

export default function PlanilhaPrecos({ itens, setItens }: PlanilhaPrecosProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { empresaAtiva } = useEmpresa();

  const regime = empresaAtiva?.regime_tributario as 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | undefined;
  const uf = empresaAtiva?.uf || 'SP';
  const cnae = empresaAtiva?.cnae_principal || '';

  // Pre-calculate suggested prices for all items with custoAquisicao
  const sugestoes = useMemo(() => {
    if (!regime) return {};
    const map: Record<number, number> = {};
    itens.forEach((item, i) => {
      if (item.custoAquisicao && item.custoAquisicao > 0) {
        map[i] = calcularPrecoSugerido(item.custoAquisicao, regime, uf, cnae);
      }
    });
    return map;
  }, [itens, regime, uf, cnae]);

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

  const aplicarSugestao = (index: number) => {
    const preco = sugestoes[index];
    if (!preco) return;
    const updated = [...itens];
    const qty = parseFloat(updated[index].quantidade.replace(',', '.')) || 0;
    const total = preco * qty;
    updated[index] = recalcExtenso({
      ...updated[index],
      valorUnitario: preco.toFixed(2),
      valorTotal: total.toFixed(2),
    });
    setItens(updated);
    toast.success('Preço sugerido aplicado! Tributos, frete, despesas e margem inclusos.');
  };

  const aplicarTodasSugestoes = () => {
    const indices = Object.keys(sugestoes).map(Number);
    if (indices.length === 0) return;
    const updated = [...itens];
    indices.forEach(i => {
      const preco = sugestoes[i];
      if (!preco) return;
      const qty = parseFloat(updated[i].quantidade.replace(',', '.')) || 0;
      const total = preco * qty;
      updated[i] = recalcExtenso({
        ...updated[i],
        valorUnitario: preco.toFixed(2),
        valorTotal: total.toFixed(2),
      });
    });
    setItens(updated);
    toast.success(`Preço sugerido aplicado a ${indices.length} itens!`);
  };

  const addItem = () => {
    setItens([...itens, { item: String(itens.length + 1), descricao: '', quantidade: '', unidade: 'UN', marca: '', fabricante: '', modelo: '', valorUnitario: '', valorUnitarioExtenso: '', valorTotal: '', valorTotalExtenso: '' }]);
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorGlobal = itens.reduce((sum, i) => sum + (parseFloat(i.valorTotal.replace(',', '.')) || 0), 0);
  const itensComSugestao = Object.keys(sugestoes).length;

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

  const regimeLabel = regime === 'simples_nacional' ? 'Simples Nacional'
    : regime === 'lucro_presumido' ? 'Lucro Presumido'
    : regime === 'lucro_real' ? 'Lucro Real' : '';

  return (
    <div className="space-y-4">
      {/* Sugestão automática banner */}
      {itensComSugestao > 0 && regime && (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-muted p-4">
          <Sparkles className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Sugestão de preço disponível — {itensComSugestao} {itensComSugestao === 1 ? 'item' : 'itens'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Com base no regime <strong className="font-semibold text-foreground">{regimeLabel}</strong> e UF <strong className="font-semibold text-foreground">{uf}</strong>, o sistema calculou preços que cobrem tributos, frete, despesas administrativas e margem de lucro (10%).
              Os valores são sugestivos — você pode editá-los livremente.
            </p>
          </div>
          <Button size="sm" className="shrink-0" onClick={aplicarTodasSugestoes}>
            <Check className="w-4 h-4" /> Aplicar todos
          </Button>
        </div>
      )}

      {/* Excel actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" /> Baixar modelo Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> Importar planilha Excel
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleUpload}
        />
        {itens.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-destructive-line text-destructive hover:bg-destructive-tint hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" /> Limpar itens
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar a planilha de preços?</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove os {itens.length} item(ns) da planilha desta proposta. Os itens do
                  Catálogo de Precificação não são afetados — dá para importá-los de novo.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => { setItens([]); toast.success('Planilha limpa.'); }}
                >
                  Limpar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th scope="col" className="w-12 px-2 py-3 text-center text-sm font-semibold text-foreground">#</th>
              <th scope="col" className="px-3 py-3 text-left text-sm font-semibold text-foreground">Descrição</th>
              <th scope="col" className="w-16 px-2 py-3 text-center text-sm font-semibold text-foreground">Qtd</th>
              <th scope="col" className="w-16 px-2 py-3 text-center text-sm font-semibold text-foreground">Und</th>
              <th scope="col" className="w-36 px-2 py-3 text-left text-sm font-semibold text-foreground">Marca / fab. / mod.</th>
              <th scope="col" className="w-36 px-2 py-3 text-right text-sm font-semibold text-foreground">Vlr unitário</th>
              <th scope="col" className="w-36 px-2 py-3 text-right text-sm font-semibold text-foreground">Vlr total</th>
              <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Remover</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itens.map((item, i) => {
              const temSugestao = sugestoes[i] !== undefined;
              const precoSug = sugestoes[i];
              const valorAtual = parseFloat(item.valorUnitario.replace(',', '.')) || 0;
              const usandoCusto = temSugestao && item.custoAquisicao && Math.abs(valorAtual - item.custoAquisicao) < 0.01;

              return (
                <tr
                  key={i}
                  className={`group transition-colors ${
                    usandoCusto ? 'bg-warning-tint' : 'hover:bg-muted'
                  }`}
                >
                  {/* # */}
                  <td className="px-2 py-2 text-center">
                    <Input
                      className="mx-auto h-9 w-12 px-1 text-center text-sm tabular-nums"
                      value={item.item}
                      onChange={e => updateItem(i, 'item', e.target.value)}
                      aria-label={`Número do item ${i + 1}`}
                    />
                  </td>

                  {/* Descrição */}
                  <td className="px-3 py-2">
                    <Input
                      className="h-9 w-full min-w-[180px] text-sm"
                      value={item.descricao}
                      onChange={e => updateItem(i, 'descricao', e.target.value)}
                      placeholder="Descrição do item"
                      aria-label={`Descrição do item ${i + 1}`}
                    />
                  </td>

                  {/* Qtd */}
                  <td className="px-2 py-2">
                    <Input
                      className="mx-auto h-9 w-16 px-1 text-center text-sm tabular-nums"
                      value={item.quantidade}
                      onChange={e => updateItem(i, 'quantidade', e.target.value)}
                      aria-label={`Quantidade do item ${i + 1}`}
                    />
                  </td>

                  {/* Und */}
                  <td className="px-2 py-2">
                    <Input
                      className="mx-auto h-9 w-16 px-1 text-center text-sm"
                      value={item.unidade}
                      onChange={e => updateItem(i, 'unidade', e.target.value)}
                      aria-label={`Unidade do item ${i + 1}`}
                    />
                  </td>

                  {/* Marca / Fab / Modelo — stacked */}
                  <td className="px-2 py-2">
                    <div className="space-y-1">
                      <Input
                        className="h-9 px-2 text-sm"
                        value={item.marca}
                        onChange={e => updateItem(i, 'marca', e.target.value)}
                        placeholder="Marca"
                        aria-label={`Marca do item ${i + 1}`}
                      />
                      <Input
                        className="h-9 px-2 text-sm"
                        value={item.fabricante}
                        onChange={e => updateItem(i, 'fabricante', e.target.value)}
                        placeholder="Fabricante"
                        aria-label={`Fabricante do item ${i + 1}`}
                      />
                      <Input
                        className="h-9 px-2 text-sm"
                        value={item.modelo}
                        onChange={e => updateItem(i, 'modelo', e.target.value)}
                        placeholder="Modelo"
                        aria-label={`Modelo do item ${i + 1}`}
                      />
                    </div>
                  </td>

                  {/* Vlr Unitário + extenso + sugestão */}
                  <td className="px-2 py-2 text-right">
                    <div className="space-y-1">
                      <Input
                        className="ml-auto h-9 text-right text-sm tabular-nums"
                        value={item.valorUnitario}
                        onChange={e => updateItem(i, 'valorUnitario', e.target.value)}
                        placeholder="0,00"
                        aria-label={`Valor unitário do item ${i + 1}`}
                      />
                      {item.valorUnitarioExtenso && (
                        <p className="ml-auto max-w-[140px] truncate text-right text-xs text-muted-foreground" title={item.valorUnitarioExtenso}>
                          {item.valorUnitarioExtenso}
                        </p>
                      )}
                      {temSugestao && precoSug && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => aplicarSugestao(i)}
                                className="ml-auto flex items-center gap-1 rounded-md px-1 text-xs text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Aplicar preço sugerido de R$ ${precoSug.toFixed(2).replace('.', ',')} ao item ${i + 1}`}
                              >
                                <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span className="font-semibold tabular-nums">R$ {precoSug.toFixed(2).replace('.', ',')}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                <p className="font-semibold">Composição do preço sugerido</p>
                                <p>Custo de aquisição: <strong>R$ {item.custoAquisicao?.toFixed(2).replace('.', ',')}</strong></p>
                                <p>Regime: <strong>{regimeLabel}</strong></p>
                                <p className="text-muted-foreground">
                                  Inclui tributos ({uf}), frete (2%), desp. administrativas (5%) e margem de lucro (10%).
                                </p>
                                <p className="text-muted-foreground">BDI: {((precoSug / (item.custoAquisicao || 1) - 1) * 100).toFixed(1)}%</p>
                                <p className="mt-1 font-medium text-foreground">Clique para aplicar</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </td>

                  {/* Vlr Total (calc) + extenso */}
                  <td className="px-2 py-2 text-right">
                    <div className="space-y-1">
                      <div className="flex h-9 items-center justify-end rounded-md border border-border bg-muted px-2 text-sm font-semibold text-foreground tabular-nums">
                        {item.valorTotal
                          ? `R$ ${parseFloat(item.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : <span className="text-muted-foreground">—</span>
                        }
                      </div>
                      {item.valorTotalExtenso && (
                        <p className="ml-auto max-w-[140px] truncate text-right text-xs text-muted-foreground" title={item.valorTotalExtenso}>
                          {item.valorTotalExtenso}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Delete */}
                  <td className="px-1 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:bg-destructive-tint hover:text-destructive"
                      onClick={() => removeItem(i)}
                      aria-label={`Remover item ${i + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="w-4 h-4" /> Adicionar item
        </Button>
        <div className="text-sm font-semibold text-foreground sm:text-right">
          Valor global: <span className="tabular-nums">R$ {valorGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          {valorGlobal > 0 && (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              ({valorPorExtenso(valorGlobal)})
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        IMPORTANTE: Nos preços ofertados já estão inclusos frete, taxas, impostos e demais despesas.
        {itensComSugestao > 0 && (
          <span className="ml-1 text-foreground">
            Os preços sugeridos foram calculados automaticamente com base no regime tributário da empresa.
          </span>
        )}
      </p>
    </div>
  );
}
