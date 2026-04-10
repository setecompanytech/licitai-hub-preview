import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Plus, Loader2, Calendar, DollarSign, User, FileText,
  AlertTriangle, Clock, CheckCircle2, Ban,
} from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

interface ContaPagar {
  id: string;
  descricao: string;
  valor_total: number;
  data_vencimento: string;
  status: string;
  pessoa_id: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
  observacoes: string | null;
}

interface Column {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  statuses: string[];
}

const columns: Column[] = [
  { id: 'vencidas', label: 'Vencidas', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/20', statuses: ['vencida'] },
  { id: 'hoje', label: 'Vence Hoje', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/20', statuses: ['hoje'] },
  { id: 'aberto', label: 'A Vencer', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20', statuses: ['aberto', 'parcial'] },
  { id: 'pago', label: 'Pagas', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20', statuses: ['pago'] },
];

export default function FinKanbanPagamentos() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [contasBanc, setContasBanc] = useState<{ id: string; nome: string }[]>([]);

  // form state
  const [form, setForm] = useState({
    descricao: '', valor_total: '', data_vencimento: '', pessoa_id: '',
    categoria_id: '', conta_id: '', total_parcelas: '1', observacoes: '',
  });

  // pay modal
  const [payItem, setPayItem] = useState<ContaPagar | null>(null);
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
      supabase.from('fin_contas_pagar').select('*').eq('empresa_id', eid).order('data_vencimento', { ascending: true }),
      supabase.from('fin_pessoas').select('id, nome').eq('empresa_id', eid),
      supabase.from('fin_categorias').select('id, nome').eq('empresa_id', eid).eq('tipo', 'despesa'),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid).eq('ativa', true),
    ]);
    setContas(cpRes.data || []);
    setPessoas(pesRes.data || []);
    setCategorias(catRes.data || []);
    setContasBanc(ctRes.data || []);
    setLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];

  const grouped = useMemo(() => {
    const result: Record<string, ContaPagar[]> = { vencidas: [], hoje: [], aberto: [], pago: [] };
    contas.forEach((c) => {
      if (c.status === 'pago') {
        result.pago.push(c);
      } else if (c.data_vencimento < today) {
        result.vencidas.push(c);
      } else if (c.data_vencimento === today) {
        result.hoje.push(c);
      } else {
        result.aberto.push(c);
      }
    });
    return result;
  }, [contas, today]);

  async function handleCreate() {
    if (!form.descricao || !form.valor_total || !form.data_vencimento) {
      toast.error('Preencha descrição, valor e vencimento');
      return;
    }
    setSaving(true);
    const parcelas = Math.max(1, parseInt(form.total_parcelas) || 1);
    const valorTotal = parseFloat(form.valor_total.replace(',', '.')) || 0;
    const valorParcela = valorTotal / parcelas;

    const rows = Array.from({ length: parcelas }, (_, i) => {
      const venc = new Date(form.data_vencimento + 'T12:00:00');
      venc.setMonth(venc.getMonth() + i);
      return {
        empresa_id: empresaAtiva!.id,
        user_id: user!.id,
        descricao: parcelas > 1 ? `${form.descricao} (${i + 1}/${parcelas})` : form.descricao,
        valor_total: valorParcela,
        data_vencimento: venc.toISOString().split('T')[0],
        pessoa_id: form.pessoa_id || null,
        categoria_id: form.categoria_id || null,
        conta_id: form.conta_id || null,
        parcela_atual: i + 1,
        total_parcelas: parcelas,
        observacoes: form.observacoes || null,
        status: 'aberto',
      };
    });

    const { error } = await supabase.from('fin_contas_pagar').insert(rows);
    setSaving(false);
    if (error) { toast.error('Erro ao criar: ' + error.message); return; }
    toast.success(`${parcelas} parcela(s) criada(s)`);
    setShowNew(false);
    setForm({ descricao: '', valor_total: '', data_vencimento: '', pessoa_id: '', categoria_id: '', conta_id: '', total_parcelas: '1', observacoes: '' });
    loadAll();
  }

  async function handlePay() {
    if (!payItem || !payDate) return;
    setSaving(true);
    const { error } = await supabase.from('fin_contas_pagar')
      .update({ status: 'pago', data_pagamento: payDate, valor_pago: parseFloat(payValue.replace(',', '.')) || payItem.valor_total, conta_id: payContaId || payItem.conta_id })
      .eq('id', payItem.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Baixa realizada');
    setPayItem(null);
    loadAll();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Kanban de Pagamentos</h1>
          <p className="text-sm text-muted-foreground">Arraste visualmente suas contas a pagar</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Conta a Pagar</Button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const items = grouped[col.id] || [];
          const total = items.reduce((s, c) => s + c.valor_total, 0);
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
                      setPayValue(String(item.valor_total));
                      setPayContaId(item.conta_id || '');
                    }
                  }}>
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-sm font-medium line-clamp-2">{item.descricao}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{fmt(item.valor_total)}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(item.data_vencimento)}</span>
                      </div>
                      {item.total_parcelas && item.total_parcelas > 1 && (
                        <span className="text-xs text-muted-foreground">Parcela {item.parcela_atual}/{item.total_parcelas}</span>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conta</p>
                )}
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
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Aluguel escritório" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total (R$) *</Label>
                <Input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} placeholder="1500,00" />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} value={form.total_parcelas} onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })} />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Select value={form.pessoa_id} onValueChange={(v) => setForm({ ...form, pessoa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta Bancária</Label>
                <Select value={form.conta_id} onValueChange={(v) => setForm({ ...form, conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contasBanc.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Baixa (Pagamento) */}
      <Dialog open={!!payItem} onOpenChange={() => setPayItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {payItem && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{payItem.descricao}</p>
              <p className="text-lg font-bold">{fmt(payItem.valor_total)}</p>
              <div>
                <Label>Data do Pagamento *</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <Label>Valor Pago (R$)</Label>
                <Input value={payValue} onChange={(e) => setPayValue(e.target.value)} />
              </div>
              <div>
                <Label>Conta de Saída</Label>
                <Select value={payContaId} onValueChange={setPayContaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contasBanc.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
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
