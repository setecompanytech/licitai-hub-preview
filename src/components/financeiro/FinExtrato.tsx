import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Upload, Plus, CheckCircle2, Search, FileDown, Link2 } from 'lucide-react';
import { fmtMoney, fmtDate, moneyClass } from '@/styles/financeiro';

function parseOFX(text: string) {
  const txns: { fitid: string; data: string; valor: number; descricao: string; tipo: string }[] = [];
  const blocks = text.split('<STMTTRN>').slice(1);
  for (const block of blocks) {
    const end = block.indexOf('</STMTTRN>');
    const content = end > -1 ? block.substring(0, end) : block;
    const get = (tag: string) => { const m = content.match(new RegExp(`<${tag}>([^<\\n]+)`)); return m ? m[1].trim() : ''; };
    const trntype = get('TRNTYPE');
    const valor = parseFloat(get('TRNAMT').replace(',', '.')) || 0;
    const fitid = get('FITID');
    let dateStr = get('DTPOSTED');
    if (dateStr.length >= 8) dateStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
    const memo = get('MEMO') || get('NAME') || trntype;
    txns.push({ fitid, data: dateStr, valor: Math.abs(valor), descricao: memo, tipo: valor >= 0 ? 'credito' : 'debito' });
  }
  return txns;
}

export default function FinExtrato() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [movs, setMovs] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contaFilter, setContaFilter] = useState('all');
  const [busca, setBusca] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importConta, setImportConta] = useState('');
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedImport, setSelectedImport] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ descricao: '', valor: '', tipo_lancamento: 'debito', data_lancamento: '', conta_id: '', categoria_id: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [mvRes, ctRes, catRes] = await Promise.all([
      supabase.from('fin_movimentacoes').select('*').eq('empresa_id', eid).order('data_lancamento', { ascending: false }).limit(500),
      supabase.from('fin_contas').select('id, nome, tipo, saldo_atual').eq('empresa_id', eid).eq('ativo', true).order('nome'),
      supabase.from('fin_categorias').select('id, nome, tipo').eq('empresa_id', eid).order('nome'),
    ]);
    setMovs(mvRes.data || []);
    setContas(ctRes.data || []);
    setCategorias(catRes.data || []);
    setLoading(false);
  }

  function handleFileOFX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = parseOFX(ev.target?.result as string);
        setImportData(data);
        setSelectedImport(new Set(data.map((_, i) => i)));
        setShowImport(true);
        toast.success(`${data.length} transações encontradas`);
      } catch { toast.error('Erro ao ler arquivo OFX'); }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importConta) { toast.error('Selecione a conta'); return; }
    setImporting(true);
    const rows = importData.filter((_, i) => selectedImport.has(i)).map(t => ({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      conta_id: importConta, descricao: t.descricao,
      valor: t.valor, tipo_lancamento: t.tipo,
      data_lancamento: t.data, origem: 'ofx',
      conciliado: false,
    }));
    const { error } = await supabase.from('fin_movimentacoes').insert(rows);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} lançamentos importados`);
    setShowImport(false); setImportData([]); load();
  }

  async function handleCreate() {
    if (!newForm.descricao || !newForm.valor || !newForm.conta_id) { toast.error('Preencha os campos obrigatórios'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_movimentacoes').insert({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      descricao: newForm.descricao, valor: parseFloat(newForm.valor.replace(',', '.')) || 0,
      tipo_lancamento: newForm.tipo_lancamento, data_lancamento: newForm.data_lancamento || new Date().toISOString().split('T')[0],
      conta_id: newForm.conta_id, categoria_id: newForm.categoria_id || null,
      conciliado: false,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Lançamento criado');
    setShowNew(false);
    setNewForm({ descricao: '', valor: '', tipo_lancamento: 'debito', data_lancamento: '', conta_id: '', categoria_id: '' });
    load();
  }

  async function toggleConciliado(id: string, current: boolean) {
    await supabase.from('fin_movimentacoes').update({ conciliado: !current }).eq('id', id);
    load();
  }

  const filtered = useMemo(() => movs.filter(m => {
    if (contaFilter !== 'all' && m.conta_id !== contaFilter) return false;
    if (busca && !(m.descricao || '').toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [movs, contaFilter, busca]);

  const saldoTotal = contas.reduce((s: number, c: any) => s + (c.saldo_atual || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Extrato e Movimentações</h1>
          <p className="text-sm text-muted-foreground">Conciliação bancária e lançamentos</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={handleFileOFX} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Importar OFX
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Saldos das contas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {contas.slice(0, 3).map((c: any) => (
          <Card key={c.id}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground truncate">{c.nome}</p>
            <p className={`text-lg font-bold ${moneyClass(c.saldo_atual || 0)}`}>{fmtMoney(c.saldo_atual || 0)}</p>
          </CardContent></Card>
        ))}
        <Card className="bg-primary/5"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Saldo Global</p>
          <p className={`text-lg font-bold ${moneyClass(saldoTotal)}`}>{fmtMoney(saldoTotal)}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar lançamento..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={contaFilter} onValueChange={setContaFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Contas</SelectItem>
            {contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]">✓</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((m: any) => {
              const conta = contas.find((c: any) => c.id === m.conta_id);
              return (
                <TableRow key={m.id} className={m.conciliado ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                  <TableCell>
                    <Checkbox checked={m.conciliado} onCheckedChange={() => toggleConciliado(m.id, m.conciliado)} />
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(m.data_lancamento)}</TableCell>
                  <TableCell className="text-sm font-medium">{m.descricao}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{conta?.nome || '—'}</TableCell>
                  <TableCell className={`text-right font-medium text-sm ${m.tipo_lancamento === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.tipo_lancamento === 'credito' ? '+' : '-'} {fmtMoney(m.valor || 0)}
                  </TableCell>
                  <TableCell>
                    {m.tipo_lancamento === 'credito'
                      ? <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                      : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lançamento</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Import OFX Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Importar Extrato OFX ({importData.length} transações)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Conta Bancária *</Label>
              <Select value={importConta} onValueChange={setImportConta}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>{contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox checked={selectedImport.size === importData.length} onCheckedChange={(c) => setSelectedImport(c ? new Set(importData.map((_,i) => i)) : new Set())} />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell><Checkbox checked={selectedImport.has(i)} onCheckedChange={(c) => {
                        const ns = new Set(selectedImport);
                        c ? ns.add(i) : ns.delete(i);
                        setSelectedImport(ns);
                      }} /></TableCell>
                      <TableCell className="text-sm">{fmtDate(t.data)}</TableCell>
                      <TableCell className="text-sm">{t.descricao}</TableCell>
                      <TableCell className={`text-right text-sm font-medium ${t.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(t.valor)}</TableCell>
                      <TableCell><Badge variant={t.tipo === 'credito' ? 'default' : 'destructive'} className="text-[10px]">{t.tipo}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">{selectedImport.size} de {importData.length} selecionadas</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing}>{importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Importar {selectedImport.size}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Movement Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Descrição *</Label><Input value={newForm.descricao} onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Valor (R$) *</Label><Input value={newForm.valor} onChange={(e) => setNewForm({ ...newForm, valor: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={newForm.data_lancamento} onChange={(e) => setNewForm({ ...newForm, data_lancamento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo *</Label>
                <Select value={newForm.tipo_lancamento} onValueChange={(v) => setNewForm({ ...newForm, tipo_lancamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Crédito (Entrada)</SelectItem>
                    <SelectItem value="debito">Débito (Saída)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta *</Label>
                <Select value={newForm.conta_id} onValueChange={(v) => setNewForm({ ...newForm, conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={newForm.categoria_id} onValueChange={(v) => setNewForm({ ...newForm, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
