import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ShoppingCart, CheckCircle2, Clock, XCircle } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type ContratoItem = { id: string; descricao: string; unidade: string; valor_unitario: number };
type Pedido = {
  id: string; numero_pedido: string; descricao: string | null;
  contrato_item_id: string | null; quantidade: number; valor_unitario: number;
  valor_total: number; data_pedido: string | null; data_entrega: string | null;
  status: string; nota_fiscal: string | null; observacoes: string | null;
};

const statusCfg: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
  entregue: { label: 'Entregue', color: 'bg-success/10 text-success' },
  parcial: { label: 'Parcial', color: 'bg-accent/10 text-accent' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
};

export default function ContratoPedidos({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero_pedido: '', descricao: '', contrato_item_id: '',
    quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
    data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
  });

  const load = async () => {
    setLoading(true);
    const [pedidosRes, itensRes] = await Promise.all([
      supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId).order('data_pedido', { ascending: false }),
      supabase.from('contrato_itens').select('id, descricao, unidade, valor_unitario').eq('contrato_id', contratoId),
    ]);
    setPedidos((pedidosRes.data as any[]) || []);
    setItens((itensRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [contratoId]);

  // When an item is selected, auto-fill unit price
  const handleItemChange = (itemId: string) => {
    setForm(f => {
      const item = itens.find(i => i.id === itemId);
      return { ...f, contrato_item_id: itemId, valor_unitario: item ? String(item.valor_unitario) : f.valor_unitario };
    });
  };

  const handleSave = async () => {
    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }
    const qty = parseFloat(form.quantidade) || 0;
    const unit = parseFloat(form.valor_unitario) || 0;
    setSaving(true);
    const { error } = await supabase.from('contrato_pedidos').insert({
      contrato_id: contratoId,
      user_id: user!.id,
      numero_pedido: form.numero_pedido,
      descricao: form.descricao || null,
      contrato_item_id: form.contrato_item_id || null,
      quantidade: qty,
      valor_unitario: unit,
      valor_total: qty * unit,
      data_pedido: form.data_pedido || null,
      data_entrega: form.data_entrega || null,
      status: form.status,
      nota_fiscal: form.nota_fiscal || null,
      observacoes: form.observacoes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar pedido'); return; }
    toast.success('Pedido registrado! Saldos atualizados automaticamente.');
    setDialogOpen(false);
    setForm({
      numero_pedido: '', descricao: '', contrato_item_id: '',
      quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
      data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
    });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_pedidos').delete().eq('id', id);
    toast.success('Pedido excluído. Saldos recalculados.');
    load();
  };

  const totalPedidos = pedidos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + p.valor_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-accent" /> Pedidos / Ordens de Fornecimento
          </h3>
          <p className="text-xs text-muted-foreground">
            {pedidos.length} pedidos | Total: {fmt(totalPedidos)}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Pedido</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Nº Pedido *</Label>
                <Input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} placeholder="OF-001" />
              </div>
              <div>
                <Label>Item do Contrato</Label>
                <Select value={form.contrato_item_id} onValueChange={handleItemChange}>
                  <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                  <SelectContent>
                    {itens.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.descricao} ({i.unidade})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Unitário (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} />
              </div>
              <div>
                <Label>Data do Pedido</Label>
                <Input type="date" value={form.data_pedido} onChange={e => setForm(f => ({ ...f, data_pedido: e.target.value }))} />
              </div>
              <div>
                <Label>Data de Entrega</Label>
                <Input type="date" value={form.data_entrega} onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nota Fiscal</Label>
                <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : pedidos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum pedido registrado</Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nº Pedido</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Qtd</TableHead>
                <TableHead className="text-xs text-right">Vlr Unit</TableHead>
                <TableHead className="text-xs text-right">Vlr Total</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs">NF</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map(p => {
                const cfg = statusCfg[p.status] || statusCfg.pendente;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-mono font-medium">{p.numero_pedido}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{p.descricao || '—'}</TableCell>
                    <TableCell className="text-xs text-right">{p.quantidade}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(p.valor_unitario)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(p.valor_total)}</TableCell>
                    <TableCell className="text-xs text-center">{p.data_pedido ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.nota_fiscal || '—'}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
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
