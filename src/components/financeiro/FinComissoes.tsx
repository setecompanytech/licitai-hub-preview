import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Plus, Loader2, CheckCircle2, Users, DollarSign } from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Comissao = {
  id: string; nome_comissionado: string; tipo_origem: string | null;
  contrato_ref: string | null; valor_base: number | null;
  percentual: number | null; valor_comissao: number;
  status: string; data_competencia: string; data_pagamento: string | null;
  observacoes: string | null;
};

export default function FinComissoes() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [form, setForm] = useState({
    nome_comissionado: '', tipo_origem: 'manual', contrato_ref: '',
    valor_base: '', percentual: '', valor_comissao: '',
    data_competencia: new Date().toISOString().split('T')[0], observacoes: '',
  });

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    loadComissoes();
  }, [empresaAtiva?.id]);

  async function loadComissoes() {
    setLoading(true);
    let q = supabase.from('fin_comissoes').select('*')
      .eq('empresa_id', empresaAtiva!.id)
      .order('data_competencia', { ascending: false });

    // Vendedor vê apenas as próprias
    if (!isAdmin) {
      q = q.eq('usuario_id', user!.id);
    }

    const { data } = await q;
    setComissoes(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.nome_comissionado || !form.valor_comissao) {
      toast.error('Preencha nome e valor da comissão');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('fin_comissoes').insert({
      empresa_id: empresaAtiva!.id,
      usuario_id: user?.id,
      nome_comissionado: form.nome_comissionado,
      tipo_origem: form.tipo_origem,
      contrato_ref: form.contrato_ref || null,
      valor_base: parseFloat(form.valor_base) || null,
      percentual: parseFloat(form.percentual) || null,
      valor_comissao: parseFloat(form.valor_comissao) || 0,
      data_competencia: form.data_competencia,
      observacoes: form.observacoes || null,
      status: 'a_pagar',
    });
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Comissão registrada.');
    setDialogOpen(false);
    loadComissoes();
  }

  async function marcarPago(id: string) {
    await supabase.from('fin_comissoes').update({
      status: 'pago',
      data_pagamento: new Date().toISOString().split('T')[0],
    }).eq('id', id);
    toast.success('Comissão marcada como paga.');
    loadComissoes();
  }

  // Auto-calcular
  useEffect(() => {
    const base = parseFloat(form.valor_base) || 0;
    const pct = parseFloat(form.percentual) || 0;
    if (base > 0 && pct > 0) {
      setForm(f => ({ ...f, valor_comissao: String((base * pct / 100).toFixed(2)) }));
    }
  }, [form.valor_base, form.percentual]);

  const filtered = comissoes.filter(c => filtroStatus === 'all' || c.status === filtroStatus);
  const totalAPagar = filtered.filter(c => c.status === 'a_pagar').reduce((s, c) => s + c.valor_comissao, 0);
  const totalPago = filtered.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor_comissao, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total a Pagar</div>
          <p className="text-xl font-bold font-mono text-warning">{fmt(totalAPagar)}</p>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Pago</div>
          <p className="text-xl font-bold font-mono text-success">{fmt(totalPago)}</p>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Registros</div>
          <p className="text-xl font-bold">{filtered.length}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="a_pagar">A Pagar</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="retido">Retido</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Nova Comissão</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Comissão</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="col-span-2"><Label>Nome do Comissionado *</Label><Input value={form.nome_comissionado} onChange={e => setForm(f => ({ ...f, nome_comissionado: e.target.value }))} /></div>
                <div><Label>Tipo Origem</Label><Select value={form.tipo_origem} onValueChange={v => setForm(f => ({ ...f, tipo_origem: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contrato_licitacao">Contrato/Licitação</SelectItem><SelectItem value="servico">Serviço</SelectItem><SelectItem value="indicacao">Indicação</SelectItem><SelectItem value="meta">Meta</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></div>
                <div><Label>Ref. Contrato</Label><Input value={form.contrato_ref} onChange={e => setForm(f => ({ ...f, contrato_ref: e.target.value }))} /></div>
                <div><Label>Valor Base (R$)</Label><Input type="number" step="0.01" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} /></div>
                <div><Label>Percentual (%)</Label><Input type="number" step="0.01" value={form.percentual} onChange={e => setForm(f => ({ ...f, percentual: e.target.value }))} /></div>
                <div><Label>Valor Comissão (R$) *</Label><Input type="number" step="0.01" value={form.valor_comissao} onChange={e => setForm(f => ({ ...f, valor_comissao: e.target.value }))} /></div>
                <div><Label>Data Competência</Label><Input type="date" value={form.data_competencia} onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} /></div>
                <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Comissionado</TableHead>
              <TableHead className="text-xs">Origem</TableHead>
              <TableHead className="text-xs">Contrato</TableHead>
              <TableHead className="text-xs text-right">Base</TableHead>
              <TableHead className="text-xs text-center">%</TableHead>
              <TableHead className="text-xs text-right">Comissão</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-center">Competência</TableHead>
              {isAdmin && <TableHead className="text-xs text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma comissão encontrada</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-xs font-medium">{c.nome_comissionado}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.tipo_origem || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{c.contrato_ref || '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono">{c.valor_base ? fmt(c.valor_base) : '—'}</TableCell>
                <TableCell className="text-xs text-center">{c.percentual ? `${c.percentual}%` : '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono font-bold text-accent">{fmt(c.valor_comissao)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={`text-[10px] ${c.status === 'pago' ? 'border-success/30 text-success' : c.status === 'a_pagar' ? 'border-warning/30 text-warning' : 'border-muted text-muted-foreground'}`}>
                    {c.status === 'a_pagar' ? 'A Pagar' : c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-center">{new Date(c.data_competencia + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                {isAdmin && (
                  <TableCell className="text-center">
                    {c.status === 'a_pagar' && (
                      <Button size="sm" variant="ghost" className="text-xs text-success" onClick={() => marcarPago(c.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Pagar
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
