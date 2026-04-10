import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ArrowUpRight, ArrowDownRight, Upload, Plus, CheckCircle2, Download } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-BR'); };

function parseOFX(text: string): { fitid: string; data: string; valor: number; descricao: string; tipo: string }[] {
  const txns: any[] = [];
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
  const [loading, setLoading] = useState(true);
  const [contaFilter, setContaFilter] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [importConta, setImportConta] = useState('');
  const [importData, setImportData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ descricao: '', valor: '', tipo_lancamento: 'debito', data_lancamento: '', conta_id: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [mRes, cRes] = await Promise.all([
      supabase.from('fin_movimentacoes').select('*').eq('empresa_id', eid).order('data_lancamento', { ascending: false }).limit(500),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid),
    ]);
    setMovs(mRes.data || []);
    setContas(cRes.data || []);
    setLoading(false);
  }

  const filtered = contaFilter === 'all' ? movs : movs.filter(m => m.conta_id === contaFilter);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const txns = parseOFX(text);
      setImportData(txns);
      if (txns.length === 0) toast.error('Nenhuma transação encontrada no arquivo OFX');
      else toast.info(`${txns.length} transações encontradas`);
    };
    reader.readAsText(file, 'latin1');
  }

  async function handleImport() {
    if (!importConta || importData.length === 0) { toast.error('Selecione uma conta e importe um arquivo'); return; }
    setImporting(true);
    const existingFitids = new Set(movs.filter(m => m.fitid).map(m => m.fitid));
    const newTxns = importData.filter(t => !existingFitids.has(t.fitid));
    if (newTxns.length === 0) { toast.info('Todas as transações já foram importadas'); setImporting(false); return; }

    const rows = newTxns.map(t => ({
      empresa_id: empresaAtiva!.id, user_id: user!.id, conta_id: importConta,
      descricao: t.descricao, valor: t.valor, tipo_lancamento: t.tipo,
      data_lancamento: t.data, fitid: t.fitid, origem: 'ofx',
    }));

    const { error } = await supabase.from('fin_movimentacoes').insert(rows);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newTxns.length} transações importadas`);
    setShowImport(false); setImportData([]); load();
  }

  async function handleConciliar(id: string) {
    const { error } = await supabase.from('fin_movimentacoes')
      .update({ conciliado_em: new Date().toISOString(), conciliado_por: user!.id })
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Conciliado'); load(); }
  }

  async function handleNewMov() {
    if (!newForm.descricao || !newForm.valor || !newForm.conta_id || !newForm.data_lancamento) {
      toast.error('Preencha todos os campos'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('fin_movimentacoes').insert({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      conta_id: newForm.conta_id, descricao: newForm.descricao,
      valor: parseFloat(newForm.valor.replace(',', '.')) || 0,
      tipo_lancamento: newForm.tipo_lancamento, data_lancamento: newForm.data_lancamento,
      origem: 'manual',
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Lançamento criado');
    setShowNew(false); setNewForm({ descricao: '', valor: '', tipo_lancamento: 'debito', data_lancamento: '', conta_id: '' }); load();
  }

  function exportCsv() {
    const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'Conciliado'];
    const rows = filtered.map(m => [m.data_lancamento, m.descricao, m.tipo_lancamento, m.valor, m.conciliado_em ? 'Sim' : 'Não']);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'extrato.csv'; a.click();
    toast.success('CSV exportado');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Extrato / Conciliação</h1>
        <div className="flex gap-2 flex-wrap">
          <Select value={contaFilter} onValueChange={setContaFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-1" /> Importar OFX</Button>
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1" /> Lançamento</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Data</th>
              <th className="text-left p-3 font-medium">Descrição</th>
              <th className="text-center p-3 font-medium">Tipo</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-center p-3 font-medium">Conciliado</th>
              <th className="text-center p-3 font-medium w-16">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const isCredito = m.tipo_lancamento === 'credito';
              return (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">{fmtDate(m.data_lancamento)}</td>
                  <td className="p-3">{m.descricao}</td>
                  <td className="p-3 text-center">
                    {isCredito ? <ArrowUpRight className="w-4 h-4 text-emerald-600 inline" /> : <ArrowDownRight className="w-4 h-4 text-destructive inline" />}
                  </td>
                  <td className={`p-3 text-right font-medium ${isCredito ? 'text-emerald-600' : 'text-destructive'}`}>
                    {isCredito ? '+' : '-'}{fmt(m.valor)}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant={m.conciliado_em ? 'default' : 'outline'}>{m.conciliado_em ? 'Sim' : 'Não'}</Badge>
                  </td>
                  <td className="p-3 text-center">
                    {!m.conciliado_em && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleConciliar(m.id)} title="Conciliar">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma movimentação</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Import OFX Modal */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Extrato OFX</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Conta Bancária *</Label>
              <Select value={importConta} onValueChange={setImportConta}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arquivo OFX</Label>
              <Input ref={fileRef} type="file" accept=".ofx,.OFX" onChange={handleFileChange} />
            </div>
            {importData.length > 0 && (
              <div className="border rounded p-3 bg-muted/30 text-sm">
                <p className="font-medium mb-1">{importData.length} transações encontradas</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importData.slice(0, 10).map((t, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>{t.data} — {t.descricao.substring(0, 40)}</span>
                      <span className={t.tipo === 'credito' ? 'text-emerald-600' : 'text-destructive'}>{t.tipo === 'credito' ? '+' : '-'}{fmt(t.valor)}</span>
                    </div>
                  ))}
                  {importData.length > 10 && <p className="text-xs text-muted-foreground">...e mais {importData.length - 10}</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImport(false); setImportData([]); }}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || importData.length === 0}>
              {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Importar {importData.length} transações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Manual Movement */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição *</Label><Input value={newForm.descricao} onChange={e => setNewForm({ ...newForm, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label><Input value={newForm.valor} onChange={e => setNewForm({ ...newForm, valor: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={newForm.tipo_lancamento} onValueChange={v => setNewForm({ ...newForm, tipo_lancamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="credito">Crédito</SelectItem><SelectItem value="debito">Débito</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Data *</Label><Input type="date" value={newForm.data_lancamento} onChange={e => setNewForm({ ...newForm, data_lancamento: e.target.value })} /></div>
            <div><Label>Conta *</Label>
              <Select value={newForm.conta_id} onValueChange={v => setNewForm({ ...newForm, conta_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleNewMov} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
