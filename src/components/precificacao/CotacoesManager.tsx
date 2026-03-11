import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, Plus, Trash2, Loader2, Download, Eye, ClipboardList,
} from 'lucide-react';
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
      headStyles: { fillColor: [59, 130, 246] },
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Cotações</h3>
          <Badge variant="outline">{quotations.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova Cotação
        </Button>
      </div>

      {showCreate && (
        <div className="bg-muted/30 border border-border/40 rounded-lg p-4 space-y-3">
          <Input placeholder="Nome da cotação *" value={newQuot.nome} onChange={e => setNewQuot(p => ({ ...p, nome: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Órgão" value={newQuot.orgao} onChange={e => setNewQuot(p => ({ ...p, orgao: e.target.value }))} />
            <Input placeholder="Nº Processo" value={newQuot.processo} onChange={e => setNewQuot(p => ({ ...p, processo: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createQuotation} disabled={creating || !newQuot.nome.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Criar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cotação criada.</p>
          ) : (
            quotations.map(q => (
              <button
                key={q.id}
                onClick={() => openQuotation(q)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedQuot?.id === q.id ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/30'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{q.nome}</p>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); deleteQuotation(q.id); }}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
                {q.orgao && <p className="text-[11px] text-muted-foreground mt-0.5">{q.orgao}</p>}
                <div className="flex items-center justify-between mt-1">
                  <Badge variant="secondary" className="text-[10px]">{q.status}</Badge>
                  <span className="text-xs font-medium">{formatCurrency(q.valor_total)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {selectedQuot ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-semibold">{selectedQuot.nome}</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Item
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportXLSX} disabled={items.length === 0}>
                    <Download className="w-3.5 h-3.5 mr-1" /> XLSX
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPDF} disabled={items.length === 0}>
                    <FileText className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                </div>
              </div>

              {showAddItem && (
                <div className="bg-muted/30 border border-border/40 rounded-lg p-3 grid grid-cols-3 gap-2">
                  <Input placeholder="Descrição *" value={newItem.descricao} onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))} className="col-span-2" />
                  <Input placeholder="Marca" value={newItem.marca} onChange={e => setNewItem(p => ({ ...p, marca: e.target.value }))} />
                  <Input placeholder="Unidade" value={newItem.unidade} onChange={e => setNewItem(p => ({ ...p, unidade: e.target.value }))} />
                  <Input type="number" placeholder="Qtd" value={newItem.quantidade} onChange={e => setNewItem(p => ({ ...p, quantidade: e.target.value }))} />
                  <Input type="number" placeholder="Preço unitário *" value={newItem.preco_unitario} onChange={e => setNewItem(p => ({ ...p, preco_unitario: e.target.value }))} />
                  <Input type="number" placeholder="Frete" value={newItem.frete} onChange={e => setNewItem(p => ({ ...p, frete: e.target.value }))} />
                  <Input placeholder="Fonte" value={newItem.fonte} onChange={e => setNewItem(p => ({ ...p, fonte: e.target.value }))} />
                  <Input placeholder="Fornecedor" value={newItem.fornecedor} onChange={e => setNewItem(p => ({ ...p, fornecedor: e.target.value }))} />
                  <Input placeholder="UF" value={newItem.uf} onChange={e => setNewItem(p => ({ ...p, uf: e.target.value }))} />
                  <Input placeholder="URL" value={newItem.url} onChange={e => setNewItem(p => ({ ...p, url: e.target.value }))} className="col-span-2" />
                  <Input placeholder="Observações" value={newItem.observacoes} onChange={e => setNewItem(p => ({ ...p, observacoes: e.target.value }))} />
                  <div className="col-span-3 flex gap-2">
                    <Button size="sm" onClick={addItem} disabled={!newItem.descricao.trim() || !newItem.preco_unitario}>Adicionar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {loadingItems ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Cotação vazia.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-center">Qtd</TableHead>
                          <TableHead className="text-xs text-right">Preço Un.</TableHead>
                          <TableHead className="text-xs text-right">Frete</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs">Fonte</TableHead>
                          <TableHead className="text-xs">Fornecedor</TableHead>
                          <TableHead className="text-xs w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">{idx + 1}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{item.descricao}</TableCell>
                            <TableCell className="text-center text-sm">{item.quantidade}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(item.preco_unitario)}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(item.frete)}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.fonte || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.fornecedor || '—'}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteItem(item.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-border/30">
                    <p className="text-sm font-bold">Total: {formatCurrency(totalQuot)}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Selecione uma cotação para visualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
