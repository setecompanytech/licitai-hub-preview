import { useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Download, Upload, Sparkles, Info, Check } from 'lucide-react';
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
    <div className="space-y-3">
      {/* Sugestão automática banner */}
      {itensComSugestao > 0 && regime && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Sugestão de Preço Disponível — {itensComSugestao} {itensComSugestao === 1 ? 'item' : 'itens'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Com base no regime <strong>{regimeLabel}</strong> e UF <strong>{uf}</strong>, o sistema calculou preços que cobrem tributos, frete, despesas administrativas e margem de lucro (10%).
              Os valores são sugestivos — você pode editá-los livremente.
            </p>
          </div>
          <Button size="sm" variant="default" className="shrink-0" onClick={aplicarTodasSugestoes}>
            <Check className="w-3.5 h-3.5 mr-1" /> Aplicar Todos
          </Button>
        </div>
      )}

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

      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-muted/60 border-b border-border/60">
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-10">#</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Descrição</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-14">Qtd</th>
              <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-14">Und</th>
              <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Marca / Fab. / Mod.</th>
              <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Vlr Unitário</th>
              <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-32">Vlr Total</th>
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {itens.map((item, i) => {
              const temSugestao = sugestoes[i] !== undefined;
              const precoSug = sugestoes[i];
              const valorAtual = parseFloat(item.valorUnitario.replace(',', '.')) || 0;
              const usandoCusto = temSugestao && item.custoAquisicao && Math.abs(valorAtual - item.custoAquisicao) < 0.01;

              return (
                <tr key={i} className={`group transition-colors hover:bg-muted/20 ${usandoCusto ? 'bg-accent/5' : i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  {/* # */}
                  <td className="px-2 py-2 text-center">
                    <Input
                      className="h-7 text-xs text-center w-9 mx-auto px-1 font-mono"
                      value={item.item}
                      onChange={e => updateItem(i, 'item', e.target.value)}
                    />
                  </td>

                  {/* Descrição */}
                  <td className="px-3 py-2">
                    <Input
                      className="h-7 text-xs w-full min-w-[180px]"
                      value={item.descricao}
                      onChange={e => updateItem(i, 'descricao', e.target.value)}
                      placeholder="Descrição do item"
                    />
                  </td>

                  {/* Qtd */}
                  <td className="px-2 py-2">
                    <Input
                      className="h-7 text-xs text-center w-14 mx-auto px-1"
                      value={item.quantidade}
                      onChange={e => updateItem(i, 'quantidade', e.target.value)}
                    />
                  </td>

                  {/* Und */}
                  <td className="px-2 py-2">
                    <Input
                      className="h-7 text-xs text-center w-14 mx-auto px-1"
                      value={item.unidade}
                      onChange={e => updateItem(i, 'unidade', e.target.value)}
                    />
                  </td>

                  {/* Marca / Fab / Modelo — stacked */}
                  <td className="px-2 py-2">
                    <div className="space-y-1">
                      <Input
                        className="h-6 text-[11px] px-2"
                        value={item.marca}
                        onChange={e => updateItem(i, 'marca', e.target.value)}
                        placeholder="Marca"
                      />
                      <Input
                        className="h-6 text-[11px] px-2"
                        value={item.fabricante}
                        onChange={e => updateItem(i, 'fabricante', e.target.value)}
                        placeholder="Fabricante"
                      />
                      <Input
                        className="h-6 text-[11px] px-2"
                        value={item.modelo}
                        onChange={e => updateItem(i, 'modelo', e.target.value)}
                        placeholder="Modelo"
                      />
                    </div>
                  </td>

                  {/* Vlr Unitário + extenso + sugestão */}
                  <td className="px-2 py-2 text-right">
                    <div className="space-y-1">
                      <Input
                        className="h-7 text-xs text-right font-mono ml-auto"
                        value={item.valorUnitario}
                        onChange={e => updateItem(i, 'valorUnitario', e.target.value)}
                        placeholder="0,00"
                      />
                      {item.valorUnitarioExtenso && (
                        <p className="text-[9px] text-muted-foreground italic leading-tight text-right truncate max-w-[128px] ml-auto" title={item.valorUnitarioExtenso}>
                          {item.valorUnitarioExtenso}
                        </p>
                      )}
                      {temSugestao && precoSug && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => aplicarSugestao(i)}
                                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors ml-auto"
                              >
                                <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                <span className="font-medium">R$ {precoSug.toFixed(2).replace('.', ',')}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <div className="text-xs space-y-1">
                                <p className="font-semibold">Composição do Preço Sugerido</p>
                                <p>Custo de aquisição: <strong>R$ {item.custoAquisicao?.toFixed(2).replace('.', ',')}</strong></p>
                                <p>Regime: <strong>{regimeLabel}</strong></p>
                                <p className="text-muted-foreground">
                                  Inclui tributos ({uf}), frete (2%), desp. administrativas (5%) e margem de lucro (10%).
                                </p>
                                <p className="text-muted-foreground italic">BDI: {((precoSug / (item.custoAquisicao || 1) - 1) * 100).toFixed(1)}%</p>
                                <p className="text-accent font-medium mt-1">Clique para aplicar</p>
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
                      <div className="h-7 flex items-center justify-end px-2 rounded-md bg-muted/40 border border-border/40 font-mono text-xs font-semibold text-foreground">
                        {item.valorTotal
                          ? `R$ ${parseFloat(item.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : <span className="text-muted-foreground/50">—</span>
                        }
                      </div>
                      {item.valorTotalExtenso && (
                        <p className="text-[9px] text-muted-foreground italic leading-tight text-right truncate max-w-[128px] ml-auto" title={item.valorTotalExtenso}>
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
                      className="h-7 w-7 text-destructive/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
        {itensComSugestao > 0 && (
          <span className="text-accent not-italic ml-1">
            ✦ Os preços sugeridos foram calculados automaticamente com base no regime tributário da empresa.
          </span>
        )}
      </p>
    </div>
  );
}
