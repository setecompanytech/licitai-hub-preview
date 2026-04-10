import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Loader2, Search, FileDown, Eye, RefreshCw, AlertTriangle, FileCode2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/styles/financeiro';
import { parseNFeXML } from '@/lib/parseNFe';

type NF = {
  id: string; chave_nfe: string | null; numero_nf: string | null; serie: string | null;
  tipo_nf: string; cnpj_emitente: string | null; nome_emitente: string | null;
  cnpj_destinatario: string | null; nome_destinatario: string | null;
  valor_total: number | null; data_emissao: string | null;
  status_sefaz: string; manifesto: string | null;
  xml_baixado: boolean; pdf_gerado: boolean;
  xml_url: string | null; pdf_url: string | null;
};

const MANIFESTO_OPTS = [
  { value: 'ciencia', label: '👁 Ciente', color: 'bg-blue-100 text-blue-800' },
  { value: 'confirmada', label: '✅ Confirmada', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'desconhecida', label: '❓ Desconhecida', color: 'bg-amber-100 text-amber-800' },
  { value: 'nao_realizada', label: '❌ Não Realizada', color: 'bg-red-100 text-red-800' },
];

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  autorizada: { icon: CheckCircle2, color: 'text-emerald-600' },
  cancelada: { icon: XCircle, color: 'text-red-600' },
  pendente: { icon: Clock, color: 'text-amber-600' },
};

export default function FinNotasFiscais() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState<NF[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroManifesto, setFiltroManifesto] = useState('all');
  const [tab, setTab] = useState('todas');
  const [detailNF, setDetailNF] = useState<NF | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    numero_nf: '', serie: '', tipo_nf: 'nfe',
    chave_nfe: '', cnpj_emitente: '', nome_emitente: '',
    valor_total: '', data_emissao: '',
  });

  useEffect(() => { if (empresaAtiva?.id) load(); }, [empresaAtiva?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('fin_notas_fiscais')
      .select('*').eq('empresa_id', empresaAtiva!.id).order('data_emissao', { ascending: false });
    setNotas((data || []) as NF[]);
    setLoading(false);
  }

  async function handleManifesto(nfId: string, manifesto: string) {
    const { error } = await supabase.from('fin_notas_fiscais')
      .update({ manifesto }).eq('id', nfId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Manifesto: ${manifesto}`);
    load();
  }

  async function handleXmlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const xml = ev.target?.result as string;
        const nfe = parseNFeXML(xml);
        setForm({
          numero_nf: String(nfe.numero_nf),
          serie: String(nfe.serie),
          tipo_nf: 'nfe',
          chave_nfe: nfe.chave_acesso,
          cnpj_emitente: nfe.cnpj_emitente,
          nome_emitente: nfe.nome_emitente,
          valor_total: String(nfe.v_nf),
          data_emissao: nfe.data_emissao?.split('T')[0] || '',
        });
        setDialogOpen(true);
        toast.success('XML lido com sucesso');
      } catch { toast.error('Erro ao ler XML'); }
    };
    reader.readAsText(file);
  }

  async function handleCreate() {
    if (!form.numero_nf || !form.valor_total) { toast.error('Preencha número e valor'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_notas_fiscais').insert({
      empresa_id: empresaAtiva!.id, user_id: user!.id,
      numero_nf: form.numero_nf, serie: form.serie || '1',
      tipo_nf: form.tipo_nf, chave_nfe: form.chave_nfe || null,
      cnpj_emitente: form.cnpj_emitente || null,
      nome_emitente: form.nome_emitente || null,
      valor_total: parseFloat(form.valor_total.replace(',', '.')) || 0,
      data_emissao: form.data_emissao || null,
      status_sefaz: 'autorizada',
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('NF-e registrada');
    setDialogOpen(false);
    load();
  }

  const filtered = notas.filter(nf => {
    if (busca && !((nf.nome_emitente || '').toLowerCase().includes(busca.toLowerCase()) || (nf.chave_nfe || '').includes(busca) || (nf.numero_nf || '').includes(busca))) return false;
    if (filtroStatus !== 'all' && nf.status_sefaz !== filtroStatus) return false;
    if (filtroManifesto !== 'all' && nf.manifesto !== filtroManifesto) return false;
    if (tab === 'pendentes' && nf.manifesto) return false;
    if (tab === 'manifestadas' && !nf.manifesto) return false;
    return true;
  });

  const pendentes = notas.filter(nf => !nf.manifesto).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Monitor NF-e</h1>
          <p className="text-sm text-muted-foreground">Gerencie notas fiscais e manifestação</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXmlImport} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <FileCode2 className="w-4 h-4 mr-1" /> Importar XML
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Registrar NF-e
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{notas.length}</p>
          <p className="text-xs text-muted-foreground">Total NF-e</p>
        </CardContent></Card>
        <Card className={pendentes > 0 ? 'border-amber-300 dark:border-amber-700' : ''}><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendentes}</p>
          <p className="text-xs text-muted-foreground">Pendentes Manifesto</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{fmtMoney(notas.filter(n => n.tipo_nf === 'nfe' || n.tipo_nf === 'saida').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
          <p className="text-xs text-muted-foreground">Total Saída</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{fmtMoney(notas.filter(n => n.tipo_nf === 'entrada').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
          <p className="text-xs text-muted-foreground">Total Entrada</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por emitente, chave ou nº..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroManifesto} onValueChange={setFiltroManifesto}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Manifestos</SelectItem>
            {MANIFESTO_OPTS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({notas.length})</TabsTrigger>
          <TabsTrigger value="pendentes">
            Pendentes Manifesto
            {pendentes > 0 && <Badge variant="destructive" className="ml-1 text-[10px]">{pendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="manifestadas">Manifestadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Emitente</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Manifesto</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(nf => {
              const si = STATUS_ICONS[nf.status_sefaz] || STATUS_ICONS.pendente;
              return (
                <TableRow key={nf.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailNF(nf)}>
                  <TableCell><si.icon className={`w-4 h-4 ${si.color}`} /></TableCell>
                  <TableCell className="font-medium text-sm">{nf.nome_emitente || '—'}</TableCell>
                  <TableCell className="text-sm">{nf.numero_nf}/{nf.serie}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">{nf.chave_nfe || '—'}</TableCell>
                  <TableCell className="text-right font-medium text-sm">{fmtMoney(nf.valor_total || 0)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(nf.data_emissao)}</TableCell>
                  <TableCell>
                    <Select value={nf.manifesto || ''} onValueChange={(v) => { handleManifesto(nf.id, v); }}>
                      <SelectTrigger className="h-7 text-xs w-[130px]" onClick={(e) => e.stopPropagation()}>
                        <SelectValue placeholder="Manifestar" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANIFESTO_OPTS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetailNF(nf); }}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma NF-e encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!detailNF} onOpenChange={() => setDetailNF(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhes NF-e</DialogTitle></DialogHeader>
          {detailNF && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Número:</span> <strong>{detailNF.numero_nf}/{detailNF.serie}</strong></div>
                <div><span className="text-muted-foreground">Tipo:</span> <strong>{detailNF.tipo_nf}</strong></div>
                <div><span className="text-muted-foreground">Emitente:</span> <strong>{detailNF.nome_emitente}</strong></div>
                <div><span className="text-muted-foreground">CNPJ:</span> <strong>{detailNF.cnpj_emitente}</strong></div>
                <div><span className="text-muted-foreground">Valor:</span> <strong>{fmtMoney(detailNF.valor_total || 0)}</strong></div>
                <div><span className="text-muted-foreground">Emissão:</span> <strong>{fmtDate(detailNF.data_emissao)}</strong></div>
                <div><span className="text-muted-foreground">Status SEFAZ:</span> <Badge variant="outline">{detailNF.status_sefaz}</Badge></div>
                <div><span className="text-muted-foreground">Manifesto:</span> <Badge variant={detailNF.manifesto ? 'default' : 'secondary'}>{detailNF.manifesto || 'Pendente'}</Badge></div>
              </div>
              {detailNF.chave_nfe && (
                <div>
                  <Label className="text-muted-foreground">Chave de Acesso</Label>
                  <p className="font-mono text-xs break-all bg-muted p-2 rounded">{detailNF.chave_nfe}</p>
                </div>
              )}
              <div className="flex gap-2">
                {MANIFESTO_OPTS.map(m => (
                  <Button key={m.value} variant="outline" size="sm"
                    className={detailNF.manifesto === m.value ? m.color : ''}
                    onClick={() => handleManifesto(detailNF.id, m.value)}
                  >{m.label}</Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New NF Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar NF-e</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Número *</Label><Input value={form.numero_nf} onChange={(e) => setForm({ ...form, numero_nf: e.target.value })} /></div>
              <div><Label>Série</Label><Input value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} /></div>
            </div>
            <div><Label>Chave de Acesso</Label><Input value={form.chave_nfe} onChange={(e) => setForm({ ...form, chave_nfe: e.target.value })} className="font-mono text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>CNPJ Emitente</Label><Input value={form.cnpj_emitente} onChange={(e) => setForm({ ...form, cnpj_emitente: e.target.value })} /></div>
              <div><Label>Nome Emitente</Label><Input value={form.nome_emitente} onChange={(e) => setForm({ ...form, nome_emitente: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Valor Total *</Label><Input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
              <div><Label>Data Emissão</Label><Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
