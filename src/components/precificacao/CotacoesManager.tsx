import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, Plus, Trash2, Download, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { writeExcelFromJson } from '@/lib/excel-utils';

type Quotation = {
  id: string;
  nome: string;
  orgao: string | null;
  processo: string | null;
  status: string;
  valor_total: number;
  created_at: string;
};

type QuotationItem = {
  id: string;
  descricao: string;
  marca: string | null;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  frete: number;
  total: number;
  fonte: string | null;
  fornecedor: string | null;
  url: string | null;
  uf: string | null;
  data_coleta: string | null;
  observacoes: string | null;
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CotacoesManager() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuot, setSelectedQuot] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newQuot, setNewQuot] = useState({ nome: '', orgao: '', processo: '' });
  const [creating, setCreating] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    descricao: '', marca: '', unidade: 'UN', quantidade: '1',
    preco_unitario: '', frete: '0', fonte: '', fornecedor: '', url: '', uf: '', observacoes: '',
  });

  useEffect(() => { loadQuotations(); }, []);

  const loadQuotations = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('quotations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setQuotations((data || []) as Quotation[]);
    setLoading(false);
  };

  const createQuotation = async () => {
    if (!user || !newQuot.nome.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('quotations').insert({
      nome: newQuot.nome, orgao: newQuot.orgao || null, processo: newQuot.processo || null, user_id: user.id,
    });
    if (error) toast.error('Erro ao criar cotação.');
    else { toast.success('Cotação criada!'); setNewQuot({ nome: '', orgao: '', processo: '' }); setShowCreate(false); loadQuotations(); }
    setCreating(false);
  };

  const deleteQuotation = async (id: string) => {
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir.');
    else { toast.success('Cotação excluída.'); setQuotations(prev => prev.filter(q => q.id !== id)); if (selectedQuot?.id === id) setSelectedQuot(null); }
  };

  const openQuotation = async (quot: Quotation) => {
    setSelectedQuot(quot);
    setLoadingItems(true);
    const { data } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', quot.id)
      .order('created_at', { ascending: true });
    setItems((data || []) as QuotationItem[]);
    setLoadingItems(false);
  };

  const addItem = async () => {
    if (!selectedQuot || !newItem.descricao.trim() || !newItem.preco_unitario) return;
    const { error } = await supabase.from('quotation_items').insert({
      quotation_id: selectedQuot.id,
      descricao: newItem.descricao,
      marca: newItem.marca || null,
      unidade: newItem.unidade,
      quantidade: parseFloat(newItem.quantidade) || 1,
      preco_unitario: parseFloat(newItem.preco_unitario) || 0,
      frete: parseFloat(newItem.frete) || 0,
      fonte: newItem.fonte || null,
      fornecedor: newItem.fornecedor || null,
      url: newItem.url || null,
      uf: newItem.uf || null,
      observacoes: newItem.observacoes || null,
    });
    if (error) toast.error('Erro ao adicionar item.');
    else {
      toast.success('Item adicionado!');
      setNewItem({ descricao: '', marca: '', unidade: 'UN', quantidade: '1', preco_unitario: '', frete: '0', fonte: '', fornecedor: '', url: '', uf: '', observacoes: '' });
      setShowAddItem(false);
      openQuotation(selectedQuot);
      // Update total
      const total = items.reduce((s, i) => s + (i.total || 0), 0) + ((parseFloat(newItem.preco_unitario) || 0) * (parseFloat(newItem.quantidade) || 1) + (parseFloat(newItem.frete) || 0));
      await supabase.from('quotations').update({ valor_total: total }).eq('id', selectedQuot.id);
    }
  };

  const deleteItem = async (id: string) => {
    await supabase.from('quotation_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const exportXLSX = async () => {
    if (!selectedQuot || items.length === 0) return;
    await writeExcelFromJson(
      `cotacao-${selectedQuot.nome.replace(/\s+/g, '-')}.xlsx`,
      'Cotação',
      items.map((i, idx) => ({
        'Item': idx + 1,
        'Descrição': i.descricao,
        'Marca': i.marca || '',
        'Unid.': i.unidade,
        'Qtd.': i.quantidade,
        'Preço Unitário': i.preco_unitario,
        'Frete': i.frete,
        'Total': i.total,
        'Fonte': i.fonte || '',
        'Fornecedor': i.fornecedor || '',
        'UF': i.uf || '',
        'Data Coleta': i.data_coleta ? new Date(i.data_coleta).toLocaleDateString('pt-BR') : '',
        'Link': i.url || '',
        'Obs.': i.observacoes || '',
      }))
    );
    toast.success('XLSX exportado!');
  };

  const exportPDF = () => {
    if (!selectedQuot || items.length === 0) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text(`Cotação: ${selectedQuot.nome}`, 14, 18);
    doc.setFontSize(9);
    if (selectedQuot.orgao) doc.text(`Órgão: ${selectedQuot.orgao}`, 14, 25);
    if (selectedQuot.processo) doc.text(`Processo: ${selectedQuot.processo}`, 14, 30);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Descrição', 'Marca', 'Unid.', 'Qtd.', 'Preço Un.', 'Frete', 'Total', 'Fonte', 'Fornecedor', 'UF']],
      body: items.map((i, idx) => [
        idx + 1, i.descricao, i.marca || '', i.unidade, i.quantidade,
        formatCurrency(i.preco_unitario), formatCurrency(i.frete), formatCurrency(i.total),
        i.fonte || '', i.fornecedor || '', i.uf || '',
      ]),
      styles: { fontSize: 7 },
      // Cor do cabeçalho do PDF exportado (documento, não interface): navy da marca.
      headStyles: { fillColor: [16, 42, 67] },
    });

    const total = items.reduce((s, i) => s + (i.total || 0), 0);
    const finalY = (doc as any).lastAutoTable?.finalY || 50;
    doc.setFontSize(10);
    doc.text(`TOTAL GERAL: ${formatCurrency(total)}`, 14, finalY + 10);
    doc.save(`cotacao-${selectedQuot.nome.replace(/\s+/g, '-')}.pdf`);
    toast.success('PDF exportado!');
  };

  const totalQuot = items.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Cotações</h3>
          <Badge variant="info">{quotations.length} {quotations.length === 1 ? 'cotação' : 'cotações'}</Badge>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Nova Cotação
        </Button>
      </div>

      {showCreate && (
        <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
          <div>
            <Label htmlFor="cotacao-nome" className="text-sm">Nome da cotação *</Label>
            <Input id="cotacao-nome" placeholder="Ex.: Cotação PE 12/2026" value={newQuot.nome} onChange={e => setNewQuot(p => ({ ...p, nome: e.target.value }))} className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cotacao-orgao" className="text-sm">Órgão</Label>
              <Input id="cotacao-orgao" placeholder="Opcional" value={newQuot.orgao} onChange={e => setNewQuot(p => ({ ...p, orgao: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cotacao-processo" className="text-sm">Nº Processo</Label>
              <Input id="cotacao-processo" placeholder="Opcional" value={newQuot.processo} onChange={e => setNewQuot(p => ({ ...p, processo: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createQuotation} disabled={creating || !newQuot.nome.trim()}>
              <Plus className="w-4 h-4" aria-hidden="true" /> {creating ? 'Criando...' : 'Criar'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Carregando cotações">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cotação criada.</p>
          ) : (
            quotations.map(q => {
              const ativa = selectedQuot?.id === q.id;
              return (
                <div
                  key={q.id}
                  className={cn(
                    'relative rounded-lg border transition-colors',
                    ativa ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openQuotation(q)}
                    aria-pressed={ativa}
                    className="w-full rounded-lg p-3 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <p className="text-sm font-medium truncate">{q.nome}</p>
                    {q.orgao && <p className="text-xs text-muted-foreground mt-1">{q.orgao}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                      <Badge variant="muted">{q.status}</Badge>
                      <span className="text-xs font-medium tabular-nums">{formatCurrency(q.valor_total)}</span>
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive-tint"
                    aria-label={`Excluir cotação ${q.nome}`}
                    onClick={() => deleteQuotation(q.id)}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {selectedQuot ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-semibold">{selectedQuot.nome}</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowAddItem(true)}>
                    <Plus className="w-4 h-4" aria-hidden="true" /> Item
                  </Button>
                  <Button variant="outline" onClick={exportXLSX} disabled={items.length === 0}>
                    <Download className="w-4 h-4" aria-hidden="true" /> XLSX
                  </Button>
                  <Button variant="outline" onClick={exportPDF} disabled={items.length === 0}>
                    <FileText className="w-4 h-4" aria-hidden="true" /> PDF
                  </Button>
                </div>
              </div>

              {showAddItem && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-border bg-muted p-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="qi-descricao" className="text-sm">Descrição *</Label>
                    <Input id="qi-descricao" placeholder="Descrição do item" value={newItem.descricao} onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-marca" className="text-sm">Marca</Label>
                    <Input id="qi-marca" placeholder="Opcional" value={newItem.marca} onChange={e => setNewItem(p => ({ ...p, marca: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-unidade" className="text-sm">Unidade</Label>
                    <Input id="qi-unidade" placeholder="UN" value={newItem.unidade} onChange={e => setNewItem(p => ({ ...p, unidade: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-quantidade" className="text-sm">Qtd</Label>
                    <Input id="qi-quantidade" type="number" placeholder="1" value={newItem.quantidade} onChange={e => setNewItem(p => ({ ...p, quantidade: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-preco" className="text-sm">Preço unitário *</Label>
                    <MoneyInput id="qi-preco" placeholder="0,00" value={Number(newItem.preco_unitario) || 0} onValueChange={v => setNewItem(p => ({ ...p, preco_unitario: String(v) }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-frete" className="text-sm">Frete</Label>
                    <MoneyInput id="qi-frete" placeholder="0,00" value={Number(newItem.frete) || 0} onValueChange={v => setNewItem(p => ({ ...p, frete: String(v) }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-fonte" className="text-sm">Fonte</Label>
                    <Input id="qi-fonte" placeholder="Opcional" value={newItem.fonte} onChange={e => setNewItem(p => ({ ...p, fonte: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-fornecedor" className="text-sm">Fornecedor</Label>
                    <Input id="qi-fornecedor" placeholder="Opcional" value={newItem.fornecedor} onChange={e => setNewItem(p => ({ ...p, fornecedor: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-uf" className="text-sm">UF</Label>
                    <Input id="qi-uf" placeholder="UF" value={newItem.uf} onChange={e => setNewItem(p => ({ ...p, uf: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="qi-url" className="text-sm">URL</Label>
                    <Input id="qi-url" placeholder="https://" value={newItem.url} onChange={e => setNewItem(p => ({ ...p, url: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="qi-obs" className="text-sm">Observações</Label>
                    <Input id="qi-obs" placeholder="Opcional" value={newItem.observacoes} onChange={e => setNewItem(p => ({ ...p, observacoes: e.target.value }))} className="mt-1" />
                  </div>
                  <div className="sm:col-span-3 flex flex-wrap gap-2">
                    <Button onClick={addItem} disabled={!newItem.descricao.trim() || !newItem.preco_unitario}>Adicionar</Button>
                    <Button variant="ghost" onClick={() => setShowAddItem(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {loadingItems ? (
                <div className="space-y-2" role="status" aria-label="Carregando itens da cotação">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Cotação vazia.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm font-semibold">#</TableHead>
                          <TableHead className="text-sm font-semibold">Descrição</TableHead>
                          <TableHead className="text-sm font-semibold text-center">Qtd</TableHead>
                          <TableHead className="text-sm font-semibold text-right">Preço Un.</TableHead>
                          <TableHead className="text-sm font-semibold text-right">Frete</TableHead>
                          <TableHead className="text-sm font-semibold text-right">Total</TableHead>
                          <TableHead className="text-sm font-semibold">Fonte</TableHead>
                          <TableHead className="text-sm font-semibold">Fornecedor</TableHead>
                          <TableHead className="w-10 text-sm font-semibold"><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm tabular-nums">{idx + 1}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{item.descricao}</TableCell>
                            <TableCell className="text-center text-sm tabular-nums">{item.quantidade}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatCurrency(item.preco_unitario)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatCurrency(item.frete)}</TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.fonte || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.fornecedor || '—'}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive-tint" aria-label={`Remover ${item.descricao}`} onClick={() => deleteItem(item.id)}>
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-border">
                    <p className="text-sm font-bold tabular-nums">Total: {formatCurrency(totalQuot)}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
                <ClipboardList className="w-6 h-6" aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-semibold">Nenhuma cotação selecionada</p>
              <p className="mt-1 text-sm text-muted-foreground">Selecione uma cotação para visualizar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
