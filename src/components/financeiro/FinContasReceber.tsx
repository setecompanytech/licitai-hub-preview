import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Loader2, Search, ArrowUpCircle, Plus, MoreHorizontal,
  Pencil, Trash2, CheckCircle2, Filter, Download,
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

const statusMap: Record<string, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  parcial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  recebido: { label: 'Recebido', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};

export default function FinContasReceber() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categorias, setCategorias] = useState<any[]>([]);
  const [contasBanc, setContasBanc] = useState<any[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emptyForm = { cliente_nome: '', valor_documento: '', data_vencimento: '', numero_documento: '', categoria_id: '', conta_corrente_id: '', parcela_total: '1', observacoes: '' };
  const [form, setForm] = useState(emptyForm);

  const [recItem, setRecItem] = useState<any>(null);
  const [recDate, setRecDate] = useState('');
  const [recValue, setRecValue] = useState('');
  const [recContaId, setRecContaId] = useState('');

  const [detail, setDetail] = useState<any>(null);

  useEffect(() => { if (empresaAtiva?.id) loadAll(); }, [empresaAtiva?.id]);

  async function loadAll() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [crRes, catRes, ctRes] = await Promise.all([
      supabase.from('fin_contas_receber').select('*').eq('empresa_id', eid).order('data_vencimento'),
      supabase.from('fin_categorias').select('id, nome').eq('empresa_id', eid).eq('tipo', 'receita'),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid).eq('ativo', true),
    ]);
    setItems(crRes.data || []);
    setCategorias(catRes.data || []);
    setContasBanc(ctRes.data || []);
    setLoading(false);
  }

  const filtered = items.filter(i => {
    if (statusFilter !== 'todos' && i.status !== statusFilter) return false;
    if (search) { const s = search.toLowerCase(); return i.cliente_nome?.toLowerCase().includes(s) || i.numero_documento?.toLowerCase().includes(s); }
    return true;
  });

  const totais = {
    aberto: filtered.filter(i => i.status === 'aberto' || i.status === 'parcial').reduce((s, i) => s + (i.valor_documento || 0), 0),
    recebido: filtered.filter(i => i.status === 'recebido').reduce((s, i) => s + (i.valor_recebido || i.valor_documento || 0), 0),
  };

  function openNew() { setEditId(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(item: any) {
    setEditId(item.id);
    setForm({ cliente_nome: item.cliente_nome || '', valor_documento: String(item.valor_documento || ''), data_vencimento: item.data_vencimento || '', numero_documento: item.numero_documento || '', categoria_id: item.categoria_id || '', conta_corrente_id: item.conta_corrente_id || '', parcela_total: String(item.parcela_total || 1), observacoes: item.observacoes || '' });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.cliente_nome || !form.valor_documento || !form.data_vencimento) { toast.error('Preencha cliente, valor e vencimento'); return; }
    setSaving(true);
    const payload = {
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      cliente_nome: form.cliente_nome, valor_documento: parseFloat(form.valor_documento.replace(',', '.')) || 0,
      data_vencimento: form.data_vencimento, numero_documento: form.numero_documento || null,
      categoria_id: form.categoria_id || null, conta_corrente_id: form.conta_corrente_id || null,
      parcela_total: parseInt(form.parcela_total) || 1, observacoes: form.observacoes || null,
    };
    if (editId) {
      const { error } = await supabase.from('fin_contas_receber').update(payload).eq('id', editId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Atualizada');
    } else {
      const parcelas = Math.max(1, payload.parcela_total);
      const vp = payload.valor_documento / parcelas;
      const rows = Array.from({ length: parcelas }, (_, i) => {
        const venc = new Date(form.data_vencimento + 'T12:00:00'); venc.setMonth(venc.getMonth() + i);
        return { ...payload, cliente_nome: parcelas > 1 ? `${payload.cliente_nome} (${i+1}/${parcelas})` : payload.cliente_nome, valor_documento: vp, data_vencimento: venc.toISOString().split('T')[0], parcela_numero: i+1, parcela_total: parcelas, status: 'aberto' };
      });
      const { error } = await supabase.from('fin_contas_receber').insert(rows);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(`${parcelas} parcela(s) criada(s)`);
    }
    setSaving(false); setShowForm(false); loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir?')) return;
    const { error } = await supabase.from('fin_contas_receber').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Excluída'); loadAll(); }
  }

  async function handleReceive() {
    if (!recItem || !recDate) return;
    setSaving(true);
    const { error } = await supabase.from('fin_contas_receber')
      .update({ status: 'recebido', data_recebimento: recDate, valor_recebido: parseFloat(recValue.replace(',', '.')) || recItem.valor_documento, conta_corrente_id: recContaId || recItem.conta_corrente_id })
      .eq('id', recItem.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Recebimento registrado'); setRecItem(null); loadAll();
  }

  function exportCsv() {
    const headers = ['Cliente', 'Documento', 'Valor', 'Vencimento', 'Recebimento', 'Status'];
    const rows = filtered.map(i => [i.cliente_nome, i.numero_documento || '', i.valor_documento, i.data_vencimento, i.data_recebimento || '', i.status]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contas_receber.csv'; a.click();
    toast.success('CSV exportado');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-primary" /> Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} registro(s) · Em aberto: {fmt(totais.aberto)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium">Documento</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-center p-3 font-medium">Vencimento</th>
              <th className="text-center p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium w-16">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const st = statusMap[item.status] || statusMap.aberto;
              return (
                <tr key={item.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(item)}>
                  <td className="p-3 font-medium">{item.cliente_nome || '—'}</td>
                  <td className="p-3 text-muted-foreground">{item.numero_documento || '—'}</td>
                  <td className="p-3 text-right font-medium">{fmt(item.valor_documento)}</td>
                  <td className="p-3 text-center">{fmtDate(item.data_vencimento)}</td>
                  <td className="p-3 text-center"><Badge className={st.cls}>{st.label}</Badge></td>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {item.status !== 'recebido' && (
                          <DropdownMenuItem onClick={() => { setRecItem(item); setRecDate(new Date().toISOString().split('T')[0]); setRecValue(String(item.valor_documento)); setRecContaId(item.conta_corrente_id || ''); }}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Receber
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openEdit(item)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma conta a receber</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detalhes da Conta a Receber</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{detail.cliente_nome || '—'}</p></div>
                <div><span className="text-muted-foreground">Valor:</span><p className="font-bold text-lg">{fmt(detail.valor_documento)}</p></div>
                <div><span className="text-muted-foreground">Vencimento:</span><p>{fmtDate(detail.data_vencimento)}</p></div>
                <div><span className="text-muted-foreground">Status:</span><p><Badge className={statusMap[detail.status]?.cls}>{statusMap[detail.status]?.label}</Badge></p></div>
              </div>
              {detail.observacoes && <div><span className="text-muted-foreground">Observações:</span><p>{detail.observacoes}</p></div>}
            </div>
          )}
          <DialogFooter>
            {detail?.status !== 'recebido' && (
              <Button size="sm" onClick={() => { setRecItem(detail); setRecDate(new Date().toISOString().split('T')[0]); setRecValue(String(detail.valor_documento)); setRecContaId(detail.conta_corrente_id || ''); setDetail(null); }}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Receber
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { openEdit(detail); setDetail(null); }}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New/Edit */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Cliente *</Label><Input value={form.cliente_nome} onChange={e => setForm({ ...form, cliente_nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label><Input value={form.valor_documento} onChange={e => setForm({ ...form, valor_documento: e.target.value })} /></div>
              <div><Label>Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nº Documento</Label><Input value={form.numero_documento} onChange={e => setForm({ ...form, numero_documento: e.target.value })} /></div>
              {!editId && <div><Label>Parcelas</Label><Input type="number" min={1} value={form.parcela_total} onChange={e => setForm({ ...form, parcela_total: e.target.value })} /></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Select value={form.categoria_id} onValueChange={v => setForm({ ...form, categoria_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Conta</Label><Select value={form.conta_corrente_id} onValueChange={v => setForm({ ...form, conta_corrente_id: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{contasBanc.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{editId ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive */}
      <Dialog open={!!recItem} onOpenChange={() => setRecItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Recebimento</DialogTitle></DialogHeader>
          {recItem && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{recItem.cliente_nome}</p>
              <p className="text-lg font-bold">{fmt(recItem.valor_documento)}</p>
              <div><Label>Data *</Label><Input type="date" value={recDate} onChange={e => setRecDate(e.target.value)} /></div>
              <div><Label>Valor Recebido</Label><Input value={recValue} onChange={e => setRecValue(e.target.value)} /></div>
              <div><Label>Conta de Entrada</Label><Select value={recContaId} onValueChange={setRecContaId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{contasBanc.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecItem(null)}>Cancelar</Button>
            <Button onClick={handleReceive} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
