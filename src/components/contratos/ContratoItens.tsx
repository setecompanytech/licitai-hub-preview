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
import {
  Plus, Trash2, Loader2, Package
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type ContratoItem = {
  id: string; contrato_id: string; descricao: string; unidade: string;
  quantidade_contratada: number; valor_unitario: number; valor_total: number;
  quantidade_consumida: number; saldo_quantitativo: number; saldo_financeiro: number;
  codigo_item: string | null; observacoes: string | null; origem_aditivo_id: string | null;
};

type Aditivo = {
  id: string; numero_aditivo: string; tipo: string;
};

export default function ContratoItens({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [aditivos, setAditivos] = useState<Aditivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: '', unidade: 'UN', quantidade_contratada: '',
    valor_unitario: '', codigo_item: '', observacoes: '', origem_aditivo_id: '',
  });

  const loadData = async () => {
    setLoading(true);
    const [itensRes, aditivosRes] = await Promise.all([
      supabase.from('contrato_itens').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
    ]);
    setItens((itensRes.data as any[]) || []);
    setAditivos((aditivosRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [contratoId]);

  const getOrigemLabel = (aditivoId: string | null) => {
    if (!aditivoId) return 'Contrato Original';
    const ad = aditivos.find(a => a.id === aditivoId);
    return ad ? `Aditivo ${ad.numero_aditivo}` : 'Aditivo';
  };

  const handleSave = async () => {
    if (!form.descricao) { toast.error('Informe a descrição do item'); return; }
    const qty = parseFloat(form.quantidade_contratada) || 0;
    const unit = parseFloat(form.valor_unitario) || 0;
    const total = qty * unit;
    setSaving(true);
    const { error } = await supabase.from('contrato_itens').insert({
      contrato_id: contratoId,
      user_id: user!.id,
      descricao: form.descricao,
      unidade: form.unidade,
      quantidade_contratada: qty,
      valor_unitario: unit,
      valor_total: total,
      saldo_quantitativo: qty,
      saldo_financeiro: total,
      codigo_item: form.codigo_item || null,
      observacoes: form.observacoes || null,
      origem_aditivo_id: form.origem_aditivo_id || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar item'); return; }
    toast.success('Item cadastrado!');
    setDialogOpen(false);
    setForm({ descricao: '', unidade: 'UN', quantidade_contratada: '', valor_unitario: '', codigo_item: '', observacoes: '', origem_aditivo_id: '' });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_itens').delete().eq('id', id);
    toast.success('Item excluído');
    loadData();
  };

  const totalContratado = itens.reduce((s, i) => s + i.valor_total, 0);
  const totalSaldo = itens.reduce((s, i) => s + i.saldo_financeiro, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" /> Itens do Contrato
          </h3>
          <p className="text-xs text-muted-foreground">
            Total contratado: {fmt(totalContratado)} | Saldo: {fmt(totalSaldo)}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Item do Contrato</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2">
                <Label>Origem *</Label>
                <Select value={form.origem_aditivo_id} onValueChange={v => setForm(f => ({ ...f, origem_aditivo_id: v === '__contrato__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__contrato__">Contrato Original</SelectItem>
                    {aditivos.map(a => (
                      <SelectItem key={a.id} value={a.id}>Aditivo {a.numero_aditivo} ({a.tipo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div>
                <Label>Código do Item</Label>
                <Input value={form.codigo_item} onChange={e => setForm(f => ({ ...f, codigo_item: e.target.value }))} placeholder="Ex: ITEM-01" />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['UN', 'CX', 'KG', 'L', 'M', 'M²', 'M³', 'PCT', 'HR', 'DIA', 'MÊS', 'SV'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade Contratada</Label>
                <Input type="number" value={form.quantidade_contratada} onChange={e => setForm(f => ({ ...f, quantidade_contratada: e.target.value }))} />
              </div>
              <div>
                <Label>Valor Unitário (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum item cadastrado</Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap">Origem</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Código</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Descrição</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">UN</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Qtd Contratada</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Vlr Unitário</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Vlr Total</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Consumido</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Saldo Qtd</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Saldo R$</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map(item => {
                const pct = item.quantidade_contratada > 0
                  ? (item.quantidade_consumida / item.quantidade_contratada) * 100 : 0;
                const lowStock = pct >= 80;
                return (
                  <TableRow key={item.id} className={lowStock ? 'bg-warning/5' : ''}>
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {getOrigemLabel(item.origem_aditivo_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{item.codigo_item || '—'}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{item.descricao}</TableCell>
                    <TableCell className="text-xs text-center whitespace-nowrap">{item.unidade}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{item.quantidade_contratada}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{fmt(item.valor_unitario)}</TableCell>
                    <TableCell className="text-xs text-right font-medium whitespace-nowrap">{fmt(item.valor_total)}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {item.quantidade_consumida}
                      <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                    </TableCell>
                    <TableCell className={`text-xs text-right font-medium whitespace-nowrap ${lowStock ? 'text-warning' : 'text-success'}`}>
                      {item.saldo_quantitativo}
                    </TableCell>
                    <TableCell className={`text-xs text-right font-medium whitespace-nowrap ${lowStock ? 'text-warning' : 'text-success'}`}>
                      {fmt(item.saldo_financeiro)}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
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
