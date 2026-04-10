import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Loader2, Calendar, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

interface CPRow {
  id: string;
  favorecido_nome: string | null;
  valor_documento: number;
  data_vencimento: string;
  status: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  categoria_id: string | null;
  conta_corrente_id: string | null;
  observacoes: string | null;
  numero_documento: string | null;
}

interface Column {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  { id: 'vencidas', label: 'Vencidas', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/20' },
  { id: 'hoje', label: 'Vence Hoje', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/20' },
  { id: 'aberto', label: 'A Vencer', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  { id: 'pago', label: 'Pagas', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20' },
];

export default function FinKanbanPagamentos() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<CPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pessoas, setPessoas] = useState<{ id: string; razao_social: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [contasBanc, setContasBanc] = useState<{ id: string; nome: string }[]>([]);

  const [form, setForm] = useState({
    favorecido_nome: '', valor_documento: '', data_vencimento: '',
    favorecido_id: '', categoria_id: '', conta_corrente_id: '',
    parcela_total: '1', observacoes: '', numero_documento: '',
  });

  const [payItem, setPayItem] = useState<CPRow | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payValue, setPayValue] = useState('');
  const [payContaId, setPayContaId] = useState('');

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    loadAll();
  }, [empresaAtiva?.id]);

  async function loadAll() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [cpRes, pesRes, catRes, ctRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('id, favorecido_nome, valor_documento, data_vencimento, status, parcela_numero, parcela_total, categoria_id, conta_corrente_id, observacoes, numero_documento').eq('empresa_id', eid).order('data_vencimento'),
      supabase.from('fin_pessoas').select('id, razao_social').eq('empresa_id', eid),
      supabase.from('fin_categorias').select('id, nome').eq('empresa_id', eid).eq('tipo', 'despesa'),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid).eq('ativo', true),
    ]);
    setContas((cpRes.data || []) as CPRow[]);
    setPessoas(pesRes.data || []);
    setCategorias(catRes.data || []);
    setContasBanc(ctRes.data || []);
    setLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];

  const grouped = useMemo(() => {
    const result: Record<string, CPRow[]> = { vencidas: [], hoje: [], aberto: [], pago: [] };
    contas.forEach((c) => {
      if (c.status === 'pago') result.pago.push(c);
      else if (c.data_vencimento < today) result.vencidas.push(c);
      else if (c.data_vencimento === today) result.hoje.push(c);
      else result.aberto.push(c);
    });
    return result;
  }, [contas, today]);

  async function handleCreate() {
    if (!form.favorecido_nome || !form.valor_documento || !form.data_vencimento) {
      toast.error('Preencha nome do favorecido, valor e vencimento');
      return;
    }
    setSaving(true);
    const parcelas = Math.max(1, parseInt(form.parcela_total) || 1);
    const valorTotal = parseFloat(form.valor_documento.replace(',', '.')) || 0;
    const valorParcela = valorTotal / parcelas;

    const rows = Array.from({ length: parcelas }, (_, i) => {
      const venc = new Date(form.data_vencimento + 'T12:00:00');
      venc.setMonth(venc.getMonth() + i);
      return {
        empresa_id: empresaAtiva!.id,
        user_id: user!.id,
        favorecido_nome: parcelas > 1 ? `${form.favorecido_nome} (${i + 1}/${parcelas})` : form.favorecido_nome,
        valor_documento: valorParcela,
        data_vencimento: venc.toISOString().split('T')[0],
        favorecido_id: form.favorecido_id || null,
        categoria_id: form.categoria_id || null,
        conta_corrente_id: form.conta_corrente_id || null,
        parcela_numero: i + 1,
        parcela_total: parcelas,
        observacoes: form.observacoes || null,
        numero_documento: form.numero_documento || null,
        status: 'aberto',
      };
    });

    const { error } = await supabase.from('fin_contas_pagar').insert(rows);
    setSaving(false);
    if (error) { toast.error('Erro ao criar: ' + error.message); return; }
    toast.success(`${parcelas} parcela(s) criada(s)`);
    setShowNew(false);
    setForm({ favorecido_nome: '', valor_documento: '', data_vencimento: '', favorecido_id: '', categoria_id: '', conta_corrente_id: '', parcela_total: '1', observacoes: '', numero_documento: '' });
    loadAll();
  }

  async function handlePay() {
    if (!payItem || !payDate) return;
    setSaving(true);
    const { error } = await supabase.from('fin_contas_pagar')
      .update({ status: 'pago', data_pagamento: payDate, valor_pago: parseFloat(payValue.replace(',', '.')) || payItem.valor_documento, conta_corrente_id: payContaId || payItem.conta_corrente_id })
      .eq('id', payItem.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Baixa realizada');
    setPayItem(null);
    loadAll();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Kanban de Pagamentos</h1>
          <p className="text-sm text-muted-foreground">Visualize suas contas a pagar por status</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Conta a Pagar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const items = grouped[col.id] || [];
          const total = items.reduce((s, c) => s + c.valor_documento, 0);
          return (
            <div key={col.id} className={`rounded-lg border p-3 ${col.bgColor} min-h-[300px]`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <col.icon className={`w-4 h-4 ${col.color}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{fmt(total)}</span>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                    if (item.status !== 'pago') {
                      setPayItem(item);
                      setPayDate(today);
                      setPayValue(String(item.valor_documento));
                      setPayContaId(item.conta_corrente_id || '');
                    }
                  }}>
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-sm font-medium line-clamp-2">{item.favorecido_nome || item.numero_documento || '—'}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{fmt(item.valor_documento)}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(item.data_vencimento)}</span>
                      </div>
                      {item.parcela_total && item.parcela_total > 1 && (
                        <span className="text-xs text-muted-foreground">Parcela {item.parcela_numero}/{item.parcela_total}</span>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conta</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nova Conta a Pagar */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Favorecido *</Label>
              <Input value={form.favorecido_nome} onChange={(e) => setForm({ ...form, favorecido_nome: e.target.value })} placeholder="Ex: Fornecedor ABC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label><Input value={form.valor_documento} onChange={(e) => setForm({ ...form, valor_documento: e.target.value })} placeholder="1500,00" /></div>
              <div><Label>Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Parcelas</Label><Input type="number" min={1} value={form.parcela_total} onChange={(e) => setForm({ ...form, parcela_total: e.target.value })} /></div>
              <div><Label>Nº Documento</Label><Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta Bancária</Label>
                <Select value={form.conta_corrente_id} onValueChange={(v) => setForm({ ...form, conta_corrente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contasBanc.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Baixa */}
      <Dialog open={!!payItem} onOpenChange={() => setPayItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {payItem && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{payItem.favorecido_nome || payItem.numero_documento}</p>
              <p className="text-lg font-bold">{fmt(payItem.valor_documento)}</p>
              <div><Label>Data do Pagamento *</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
              <div><Label>Valor Pago (R$)</Label><Input value={payValue} onChange={(e) => setPayValue(e.target.value)} /></div>
              <div>
                <Label>Conta de Saída</Label>
                <Select value={payContaId} onValueChange={setPayContaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contasBanc.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayItem(null)}>Cancelar</Button>
            <Button onClick={handlePay} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar Baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
