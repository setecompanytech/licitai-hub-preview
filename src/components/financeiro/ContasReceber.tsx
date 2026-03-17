import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, ArrowUpCircle, CheckCircle2, Clock,
  AlertTriangle, Search, DollarSign
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type ContaReceber = {
  id: string; descricao: string; cliente: string | null; valor: number;
  valor_recebido: number; data_vencimento: string; data_recebimento: string | null;
  status: string; categoria: string | null; numero_nf: string | null;
  observacoes: string | null; contrato_id: string | null;
};

const statusCfg: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
  recebido: { label: 'Recebido', color: 'bg-success/10 text-success' },
  atrasado: { label: 'Atrasado', color: 'bg-destructive/10 text-destructive' },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground' },
};

export default function ContasReceber() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [form, setForm] = useState({
    descricao: '', cliente: '', valor: '', data_vencimento: '',
    categoria: '', numero_nf: '', observacoes: '',
  });

  useEffect(() => { if (user && empresaAtiva) load(); }, [user, empresaAtiva]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('contas_receber')
      .select('*').eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
      .order('data_vencimento', { ascending: true });
    const today = new Date().toISOString().split('T')[0];
    const list = ((data as any[]) || []).map(c => ({
      ...c,
      status: c.status === 'pendente' && c.data_vencimento < today ? 'atrasado' : c.status,
    }));
    setContas(list);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor || !form.data_vencimento) {
      toast.error('Preencha descrição, valor e vencimento'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('contas_receber').insert({
      user_id: user!.id, empresa_id: empresaAtiva!.id,
      descricao: form.descricao, cliente: form.cliente || null,
      valor: parseFloat(form.valor) || 0, data_vencimento: form.data_vencimento,
      categoria: form.categoria || null, numero_nf: form.numero_nf || null,
      observacoes: form.observacoes || null, status: 'pendente',
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Conta a receber registrada!');
    setDialogOpen(false);
    setForm({ descricao: '', cliente: '', valor: '', data_vencimento: '', categoria: '', numero_nf: '', observacoes: '' });
    load();
  };

  const handleReceber = async (id: string) => {
    const conta = contas.find(c => c.id === id);
    await supabase.from('contas_receber').update({
      status: 'recebido', data_recebimento: new Date().toISOString().split('T')[0],
      valor_recebido: conta?.valor || 0,
    } as any).eq('id', id);
    toast.success('Marcado como recebido');
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contas_receber').delete().eq('id', id);
    toast.success('Excluído');
    load();
  };

  const filtered = contas.filter(c => {
    const matchSearch = !search || c.descricao.toLowerCase().includes(search.toLowerCase()) || c.cliente?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'all' || c.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const totalPendente = contas.filter(c => c.status === 'pendente').reduce((s, c) => s + c.valor, 0);
  const totalAtrasado = contas.filter(c => c.status === 'atrasado').reduce((s, c) => s + c.valor, 0);
  const totalRecebido = contas.filter(c => c.status === 'recebido').reduce((s, c) => s + c.valor_recebido, 0);

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> A Receber</div><p className="text-lg font-bold text-warning">{fmt(totalPendente)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Atrasado</div><p className="text-lg font-bold text-destructive">{fmt(totalAtrasado)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Recebido</div><p className="text-lg font-bold text-success">{fmt(totalRecebido)}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Conta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Conta a Receber</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label className="text-xs">Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Cliente / Órgão</Label><Input value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} /></div>
                <div><Label className="text-xs">Valor (R$) *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} /></div>
                <div><Label className="text-xs">Nº NF</Label><Input value={form.numero_nf} onChange={e => setForm(f => ({ ...f, numero_nf: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhuma conta a receber</Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Vencimento</TableHead>
                <TableHead className="text-xs">NF</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const cfg = statusCfg[c.status] || statusCfg.pendente;
                return (
                  <TableRow key={c.id}>
                    <TableCell><Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{c.descricao}</TableCell>
                    <TableCell className="text-xs">{c.cliente || '—'}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(c.valor)}</TableCell>
                    <TableCell className="text-xs text-center">{new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-xs">{c.numero_nf || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.status !== 'recebido' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleReceber(c.id)} title="Marcar como recebido">
                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
