import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileText, Loader2, X, Sparkles, Download, Trash2,
  Plus, CheckCircle, Edit3, Save, Package, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';
import { useEditalExtraction } from '@/hooks/useEditalExtraction';
import { writeExcelFile } from '@/lib/excel-utils';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';

export interface PlanilhaItem {
  item: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  catmat?: string;
  valorUnitarioRef?: number;
  valorTotalRef?: number;
  valorUnitario: number | null;
  valorTotal: number | null;
  marca: string;
}

const formatCurrency = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const parseCurrencyInput = (v: string): number | null => {
  const clean = v.replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
};

interface PlanilhaCustosEditalProps {
  onAddToProposta?: (itens: PlanilhaItem[]) => void;
}

export default function PlanilhaCustosEdital({ onAddToProposta }: PlanilhaCustosEditalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [itens, setItens] = useState<PlanilhaItem[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { extrairItensDoTexto } = useEditalExtraction();
  const { addItem, pendingItems } = usePropostaCart();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 20MB.');
      return;
    }
    setFile(f);
    setItens([]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setItens([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExtract = async () => {
    if (!file || isExtracting) return;
    setIsExtracting(true);
    setItens([]);

    try {
      const text = await extractTextFromFile(file, 150, true);
      if (!text || text.trim().length < 20) {
        toast.error('Não foi possível extrair texto suficiente do documento.');
        return;
      }

      const parsed = await extrairItensDoTexto(text, { skipValidation: true });
      if (parsed.length === 0) {
        toast.warning('Nenhum item identificado no documento.');
        return;
      }

      const planilha: PlanilhaItem[] = parsed.map((p, i) => {
        const qty = Number(p.quantidade ?? 1);
        const vlrUnit = p.valor_unitario ? Number(p.valor_unitario) : null;
        const vlrTotal = p.valor_total ? Number(p.valor_total) : null;
        return {
          item: Number(p.item ?? i + 1),
          descricao: (p.descricao || '').trim(),
          quantidade: Number.isFinite(qty) && qty > 0 ? qty : 1,
          unidade: (p.unidade || 'UN').trim(),
          catmat: '',
          valorUnitarioRef: vlrUnit ?? undefined,
          valorTotalRef: vlrTotal ?? undefined,
          valorUnitario: null,
          valorTotal: null,
          marca: (p.marca || '').trim(),
        };
      }).filter(it => it.descricao.length > 0);

      setItens(planilha);
      toast.success(`${planilha.length} itens extraídos com sucesso!`);
    } catch (e) {
      console.error('Erro extração planilha:', e);
      toast.error(e instanceof Error ? e.message : 'Erro ao processar documento.');
    } finally {
      setIsExtracting(false);
    }
  };

  const updateItem = (idx: number, field: keyof PlanilhaItem, value: any) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      // Auto-calc total when unit price changes
      if (field === 'valorUnitario' && value != null) {
        updated.valorTotal = Math.round((value as number) * updated.quantidade * 100) / 100;
      }
      if (field === 'quantidade' && updated.valorUnitario != null) {
        updated.valorTotal = Math.round(updated.valorUnitario * (value as number) * 100) / 100;
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  const addEmptyItem = () => {
    setItens(prev => [...prev, {
      item: prev.length + 1,
      descricao: '',
      quantidade: 1,
      unidade: 'UN',
      valorUnitario: null,
      valorTotal: null,
      marca: '',
    }]);
    setEditingIdx(itens.length);
  };

  const totalGeral = itens.reduce((sum, it) => sum + (it.valorTotal ?? 0), 0);
  const totalRef = itens.reduce((sum, it) => sum + (it.valorTotalRef ?? 0), 0);

  const handleExportExcel = async () => {
    if (itens.length === 0) return;

    const header = [
      'Item', 'Descrição / Especificação Técnica', 'CATMAT',
      'Unidade', 'Qtd', 'Vlr Unit Referência', 'Vlr Total Referência',
      'Marca / Fabricante', 'Vlr Unit Ofertado', 'Vlr Total Ofertado',
    ];

    const rows = itens.map(it => [
      it.item,
      it.descricao,
      it.catmat || '',
      it.unidade,
      it.quantidade,
      it.valorUnitarioRef ?? '',
      it.valorTotalRef ?? '',
      it.marca || '',
      it.valorUnitario ?? '',
      it.valorTotal ?? '',
    ]);

    const totalRow = [
      '', 'VALOR TOTAL →', '', '', '', '',
      totalRef > 0 ? totalRef : '', '', '', totalGeral > 0 ? totalGeral : '',
    ];

    const data = [
      ['PLANILHA DE PREÇOS — EXTRAÇÃO POR IA'],
      [`Documento: ${file?.name || 'N/A'}`],
      [`Data: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      header,
      ...rows,
      [],
      totalRow,
    ];

    await writeExcelFile(
      `Planilha_Precos_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [{ name: 'Planilha de Preços', data, colWidths: [8, 60, 12, 18, 8, 18, 18, 22, 18, 18] }]
    );
    toast.success('Planilha de preços exportada!');
  };

  const handleAddAllToProposta = () => {
    const validItens = itens.filter(it => it.valorUnitario != null && it.valorUnitario > 0);
    if (validItens.length === 0) {
      toast.error('Preencha os valores unitários antes de adicionar à proposta.');
      return;
    }
    validItens.forEach(it => {
      addItem({
        item: String(pendingItems.length + 1),
        descricao: it.descricao,
        quantidade: String(it.quantidade),
        unidade: it.unidade,
        marca: it.marca || '',
        fabricante: '',
        modelo: '',
        valorUnitario: (it.valorUnitario ?? 0).toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(it.valorUnitario ?? 0),
        valorTotal: (it.valorTotal ?? 0).toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(it.valorTotal ?? 0),
      });
    });
    toast.success(`${validItens.length} itens adicionados à Proposta Comercial!`);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.jpg,.jpeg,.png,.webp,.odt"
        className="hidden"
        onChange={handleFileChange}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-accent/50 hover:bg-muted/30 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-accent" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Envie o Edital, Termo de Referência ou Anexo
          </span>
          <span className="text-xs text-muted-foreground">
            A IA extrairá itens com descrição, quantidade, unidade e valores de referência
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            PDF, Word, Excel, Imagens (JPG/PNG), TXT — Máx. 20MB
          </span>
        </button>
      ) : (
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
                {itens.length > 0 && (
                  <span className="text-accent ml-2">✓ {itens.length} itens extraídos</span>
                )}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {itens.length === 0 && (
                <Button onClick={handleExtract} disabled={isExtracting} size="sm">
                  {isExtracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1" /> Extrair Itens</>
                  )}
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRemoveFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Planilha de Custos Table */}
      {itens.length > 0 && (
        <>
          {/* Actions bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-card border border-border/40 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              <span className="text-sm font-semibold">{itens.length} itens</span>
              {totalRef > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  Ref: {formatCurrency(totalRef)}
                </Badge>
              )}
              {totalGeral > 0 && (
                <Badge className="text-[10px] bg-success/20 text-success border-0">
                  Total: {formatCurrency(totalGeral)}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={addEmptyItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar Excel
              </Button>
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleAddAllToProposta}
              >
                <Package className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-border/40 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/40">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-12">Item</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[200px]">Descrição</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Qtd</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-20">Unidade</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">
                    <span className="text-accent">Vlr Unit Ref</span>
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">
                    <span className="text-accent">Vlr Total Ref</span>
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Marca</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-primary w-28">Vlr Unitário</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-primary w-28">Vlr Total</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {itens.map((it, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-center font-medium text-muted-foreground">{it.item}</td>
                    <td className="px-3 py-2">
                      {editingIdx === idx ? (
                        <Input
                          value={it.descricao}
                          onChange={(e) => updateItem(idx, 'descricao', e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <span
                          className="text-xs cursor-pointer hover:text-primary line-clamp-2"
                          onClick={() => setEditingIdx(idx)}
                          title={it.descricao}
                        >
                          {it.descricao}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        type="number"
                        value={it.quantidade}
                        onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value) || 1)}
                        className="h-7 text-xs text-center w-16 mx-auto"
                        min={1}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        value={it.unidade}
                        onChange={(e) => updateItem(idx, 'unidade', e.target.value)}
                        className="h-7 text-xs text-center w-20 mx-auto"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-accent">
                      {it.valorUnitarioRef != null ? formatCurrency(it.valorUnitarioRef) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-accent">
                      {it.valorTotalRef != null ? formatCurrency(it.valorTotalRef) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={it.marca}
                        onChange={(e) => updateItem(idx, 'marca', e.target.value)}
                        className="h-7 text-xs text-center w-24 mx-auto"
                        placeholder="Marca"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={it.valorUnitario ?? ''}
                        onChange={(e) => {
                          const v = e.target.value ? parseFloat(e.target.value) : null;
                          updateItem(idx, 'valorUnitario', v);
                        }}
                        className="h-7 text-xs text-right w-24 ml-auto bg-primary/5 border-primary/20 font-medium"
                        placeholder="0,00"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold">
                      {it.valorTotal != null ? (
                        <span className="text-primary">{formatCurrency(it.valorTotal)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive/60" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-muted/30 border-t-2 border-border/60 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs text-muted-foreground">
                    TOTAL GERAL →
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-accent">
                    {/* empty */}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-accent font-bold">
                    {totalRef > 0 ? formatCurrency(totalRef) : '—'}
                  </td>
                  <td className="px-3 py-2">{/* marca col */}</td>
                  <td className="px-3 py-2">{/* unit price col */}</td>
                  <td className="px-3 py-2 text-right text-sm text-primary font-bold">
                    {totalGeral > 0 ? formatCurrency(totalGeral) : '—'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Instructions */}
          <div className="bg-muted/20 border border-border/30 rounded-lg p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground text-xs mb-1">📋 Instruções</p>
            <p>• Preencha o <strong className="text-primary">Valor Unitário</strong> para cada item — o Valor Total é calculado automaticamente.</p>
            <p>• Os valores de referência do edital (quando disponíveis) são exibidos em <strong className="text-accent">laranja</strong>.</p>
            <p>• Clique na descrição para editá-la. Use <strong>"Exportar Excel"</strong> para baixar a planilha de preços.</p>
            <p>• Use <strong>"Enviar à Proposta"</strong> para transferir os itens precificados diretamente à Proposta Comercial.</p>
          </div>
        </>
      )}

      {/* Empty state */}
      {!file && itens.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Envie um documento e a IA gerará automaticamente a planilha de custos com todos os itens estruturados</p>
        </div>
      )}
    </div>
  );
}
