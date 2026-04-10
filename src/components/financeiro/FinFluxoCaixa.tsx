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
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Loader2, TrendingUp, TrendingDown, CheckCircle2, Clock, XCircle
} from 'lucide-react';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Lancamento = {
  id: string; tipo: string; descricao: string; valor: number;
  data_competencia: string; data_pagamento: string | null;
  status: string; contrato_ref: string | null; observacoes: string | null;
  categoria_nome?: string; conta_nome?: string;
};

export default function FinFluxoCaixa() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState({
    tipo: 'all', status: 'all',
    de: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    ate: new Date().toISOString().split('T')[0],
  });
  const [form, setForm] = useState({
    tipo: 'entrada', descricao: '', valor: '', data_competencia: new Date().toISOString().split('T')[0],
    data_pagamento: '', status: 'pendente', conta_id: '', categoria_id: '', contrato_ref: '', observacoes: '',
  });

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    loadAll();
  }, [empresaAtiva?.id]);

  async function loadAll() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [lancRes, contRes, catRes] = await Promise.all([
      loadLancamentos(eid),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid).eq('ativo', true),
      supabase.from('fin_categorias').select('id, nome, tipo').or(`empresa_id.eq.${eid},empresa_id.is.null`).eq('ativo', true),
    ]);
    setContas(contRes.data ?? []);
    setCategorias(catRes.data ?? []);
    setLoading(false);
  }

  async function loadLancamentos(eid?: string) {
    const id = eid || empresaAtiva?.id;
    if (!id) return;
    let q = supabase.from('fin_lancamentos')
      .select('*')
      .eq('empresa_id', id)
      .gte('data_competencia', filtro.de)
      .lte('data_competencia', filtro.ate)
      .order('data_competencia', { ascending: false })
      .limit(200);

    if (filtro.tipo !== 'all') q = q.eq('tipo', filtro.tipo);
    if (filtro.status !== 'all') q = q.eq('status', filtro.status);

    const { data } = await q;
    setLancamentos(data ?? []);
  }

  async function handleSave() {
    if (!form.descricao || !form.valor) { toast.error('Preencha descrição e valor'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_lancamentos').insert({
      empresa_id: empresaAtiva!.id,
      tipo: form.tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor) || 0,
      data_competencia: form.data_competencia,
      data_pagamento: form.data_pagamento || null,
      status: form.status,
      conta_id: form.conta_id || null,
      categoria_id: form.categoria_id || null,
      contrato_ref: form.contrato_ref || null,
      observacoes: form.observacoes || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Lançamento registrado.');
    setDialogOpen(false);
    setForm({ tipo: 'entrada', descricao: '', valor: '', data_competencia: new Date().toISOString().split('T')[0], data_pagamento: '', status: 'pendente', conta_id: '', categoria_id: '', contrato_ref: '', observacoes: '' });
    loadLancamentos();
  }

  async function marcarPago(id: string) {
    await supabase.from('fin_lancamentos').update({
      status: 'pago',
      data_pagamento: new Date().toISOString().split('T')[0],
    }).eq('id', id);
    toast.success('Marcado como pago.');
    loadLancamentos();
  }

  const totalEntradas = lancamentos.filter(l => l.tipo === 'entrada' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0);
  const totalSaidas = lancamentos.filter(l => l.tipo === 'saida' && l.status !== 'cancelado').reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-success text-[10px] font-semibold uppercase tracking-wide mb-1"><TrendingUp className="w-3 h-3" /> Entradas</div>
          <p className="text-xl font-bold font-mono text-success">{fmt(totalEntradas)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-destructive text-[10px] font-semibold uppercase tracking-wide mb-1"><TrendingDown className="w-3 h-3" /> Saídas</div>
          <p className="text-xl font-bold font-mono text-destructive">{fmt(totalSaidas)}</p>
        </Card>
        <Card className="p-4">
          <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${saldo >= 0 ? 'text-success' : 'text-destructive'}`}>Saldo</div>
          <p className={`text-xl font-bold font-mono ${saldo >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(saldo)}</p>
        </Card>
      </div>

      {/* Filtros + Botão */}
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label className="text-xs">De</Label><Input type="date" value={filtro.de} onChange={e => setFiltro(f => ({ ...f, de: e.target.value }))} className="w-36 text-xs" /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={filtro.ate} onChange={e => setFiltro(f => ({ ...f, ate: e.target.value }))} className="w-36 text-xs" /></div>
        <Select value={filtro.tipo} onValueChange={v => setFiltro(f => ({ ...f, tipo: v }))}><SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="entrada">Entradas</SelectItem><SelectItem value="saida">Saídas</SelectItem></SelectContent></Select>
        <Select value={filtro.status} onValueChange={v => setFiltro(f => ({ ...f, status: v }))}><SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="conciliado">Conciliado</SelectItem></SelectContent></Select>
        <Button size="sm" variant="outline" onClick={() => loadLancamentos()}>Filtrar</Button>
        <div className="flex-1" />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Lançamento</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem><SelectItem value="transferencia">Transferência</SelectItem></SelectContent></Select></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem></SelectContent></Select></div>
              <div className="col-span-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
              <div><Label>Data Competência</Label><Input type="date" value={form.data_competencia} onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} /></div>
              <div><Label>Data Pagamento</Label><Input type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} /></div>
              <div><Label>Conta</Label><Select value={form.conta_id} onValueChange={v => setForm(f => ({ ...f, conta_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Categoria</Label><Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Ref. Contrato</Label><Input value={form.contrato_ref} onChange={e => setForm(f => ({ ...f, contrato_ref: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lancamentos.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado</TableCell></TableRow>
            ) : lancamentos.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-mono">{new Date(l.data_competencia + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{l.descricao}</div>
                  {l.contrato_ref && <div className="text-[10px] text-muted-foreground">Contrato: {l.contrato_ref}</div>}
                </TableCell>
                <TableCell><Badge variant="outline" className={`text-[10px] ${l.tipo === 'entrada' ? 'border-success/30 text-success' : l.tipo === 'saida' ? 'border-destructive/30 text-destructive' : ''}`}>{l.tipo}</Badge></TableCell>
                <TableCell className={`text-xs text-right font-mono font-bold ${l.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>{l.tipo === 'entrada' ? '+' : '-'}{fmt(Number(l.valor))}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={`text-[10px] ${l.status === 'pago' || l.status === 'conciliado' ? 'border-success/30 text-success' : l.status === 'pendente' ? 'border-warning/30 text-warning' : 'border-muted text-muted-foreground'}`}>
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {l.status === 'pendente' && (
                    <Button size="sm" variant="ghost" className="text-xs text-success" onClick={() => marcarPago(l.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Pagar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
