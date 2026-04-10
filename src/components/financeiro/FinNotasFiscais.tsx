import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Plus, Loader2, Search, FileDown, Eye, Download, RefreshCw, AlertTriangle
} from 'lucide-react';

const fmt = (v: number) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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
  { value: 'ciencia', label: 'Ciente' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'desconhecida', label: 'Desconhecida' },
  { value: 'nao_realizada', label: 'Não Realizada' },
];

export default function FinNotasFiscais() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState<NF[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroManifesto, setFiltroManifesto] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero_nf: '', serie: '', tipo_nf: 'nfe',
    cnpj_emitente: '', nome_emitente: '',
    cnpj_destinatario: '', nome_destinatario: '',
    valor_total: '', data_emissao: '', chave_nfe: '',
    status_sefaz: 'autorizada',
  });

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    loadNotas();
  }, [empresaAtiva?.id]);

  async function loadNotas() {
    setLoading(true);
    const { data } = await supabase.from('fin_notas_fiscais')
      .select('*')
      .eq('empresa_id', empresaAtiva!.id)
      .order('data_emissao', { ascending: false })
      .limit(200);
    setNotas(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.numero_nf) { toast.error('Informe o número da NF'); return; }
    setSaving(true);
    const { error } = await supabase.from('fin_notas_fiscais').insert({
      empresa_id: empresaAtiva!.id,
      numero_nf: form.numero_nf,
      serie: form.serie || null,
      tipo_nf: form.tipo_nf,
      chave_nfe: form.chave_nfe || null,
      cnpj_emitente: form.cnpj_emitente || null,
      nome_emitente: form.nome_emitente || null,
      cnpj_destinatario: form.cnpj_destinatario || null,
      nome_destinatario: form.nome_destinatario || null,
      valor_total: parseFloat(form.valor_total) || null,
      data_emissao: form.data_emissao || null,
      status_sefaz: form.status_sefaz,
    });
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('NF registrada.');
    setDialogOpen(false);
    loadNotas();
  }

  async function manifestar(id: string, acao: string) {
    await supabase.from('fin_notas_fiscais').update({
      manifesto: acao,
      manifesto_em: new Date().toISOString(),
    }).eq('id', id);
    toast.success('Manifestação registrada.');
    loadNotas();
  }

  const filtered = notas.filter(n => {
    if (filtroStatus !== 'all' && n.status_sefaz !== filtroStatus) return false;
    if (filtroManifesto === 'pendente' && n.manifesto !== null) return false;
    if (filtroManifesto !== 'all' && filtroManifesto !== 'pendente' && n.manifesto !== filtroManifesto) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return (n.nome_emitente?.toLowerCase().includes(b) || n.numero_nf?.includes(b) || n.chave_nfe?.includes(b));
    }
    return true;
  });

  const totalAutorizado = filtered.filter(n => n.status_sefaz === 'autorizada').reduce((s, n) => s + Number(n.valor_total ?? 0), 0);
  const semManifesto = filtered.filter(n => !n.manifesto).length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {filtered.length} notas | Total autorizado: R$ {fmt(totalAutorizado)} | {semManifesto} sem manifestação
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Nova NF</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Nota Fiscal</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><Label>Número *</Label><Input value={form.numero_nf} onChange={e => setForm(f => ({ ...f, numero_nf: e.target.value }))} /></div>
              <div><Label>Série</Label><Input value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))} /></div>
              <div><Label>Tipo</Label><Select value={form.tipo_nf} onValueChange={v => setForm(f => ({ ...f, tipo_nf: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nfe">NF-e</SelectItem><SelectItem value="nfce">NFC-e</SelectItem><SelectItem value="cte">CT-e</SelectItem><SelectItem value="nfs-e">NFS-e</SelectItem></SelectContent></Select></div>
              <div><Label>Status</Label><Select value={form.status_sefaz} onValueChange={v => setForm(f => ({ ...f, status_sefaz: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="autorizada">Autorizada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent></Select></div>
              <div className="col-span-2"><Label>Chave NF-e (44 dígitos)</Label><Input value={form.chave_nfe} onChange={e => setForm(f => ({ ...f, chave_nfe: e.target.value }))} /></div>
              <div><Label>CNPJ Emitente</Label><Input value={form.cnpj_emitente} onChange={e => setForm(f => ({ ...f, cnpj_emitente: e.target.value }))} /></div>
              <div><Label>Nome Emitente</Label><Input value={form.nome_emitente} onChange={e => setForm(f => ({ ...f, nome_emitente: e.target.value }))} /></div>
              <div><Label>Valor Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} /></div>
              <div><Label>Data Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar emitente, número ou chave..." className="pl-8 text-xs" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos Status</SelectItem><SelectItem value="autorizada">Autorizada</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent></Select>
        <Select value={filtroManifesto} onValueChange={setFiltroManifesto}><SelectTrigger className="w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda Manifestação</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="ciencia">Ciente</SelectItem><SelectItem value="confirmada">Confirmada</SelectItem></SelectContent></Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nº / Série</TableHead>
              <TableHead className="text-xs">Emitente</TableHead>
              <TableHead className="text-xs">Emissão</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-center">Manifesto</TableHead>
              <TableHead className="text-xs text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma nota fiscal encontrada</TableCell></TableRow>
            ) : filtered.map(n => (
              <TableRow key={n.id}>
                <TableCell className="text-xs">
                  <div className="font-mono font-semibold">{n.numero_nf || '—'}</div>
                  {n.serie && <div className="text-[10px] text-muted-foreground">Série {n.serie}</div>}
                </TableCell>
                <TableCell className="text-xs max-w-[180px]">
                  <div className="font-medium truncate">{n.nome_emitente || '—'}</div>
                  {n.cnpj_emitente && <div className="text-[10px] text-muted-foreground font-mono">{n.cnpj_emitente}</div>}
                </TableCell>
                <TableCell className="text-xs">{n.data_emissao ? new Date(n.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                <TableCell className="text-xs text-right font-mono font-semibold">R$ {fmt(n.valor_total ?? 0)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={`text-[10px] ${n.status_sefaz === 'autorizada' ? 'border-success/30 text-success' : n.status_sefaz === 'cancelada' ? 'border-destructive/30 text-destructive' : 'border-warning/30 text-warning'}`}>
                    {n.status_sefaz}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {n.manifesto ? (
                    <Badge variant="outline" className={`text-[10px] ${n.manifesto === 'confirmada' ? 'border-success/30 text-success' : n.manifesto === 'ciencia' ? 'border-accent/30 text-accent' : 'border-warning/30 text-warning'}`}>
                      {n.manifesto}
                    </Badge>
                  ) : (
                    <Select onValueChange={v => manifestar(n.id, v)}>
                      <SelectTrigger className="h-6 text-[10px] w-24 border-warning/30 text-warning"><SelectValue placeholder="Manifestar" /></SelectTrigger>
                      <SelectContent>{MANIFESTO_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {n.xml_url && <a href={n.xml_url} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-muted" title="XML"><FileDown className="w-3 h-3" /></a>}
                    {n.pdf_url && <a href={n.pdf_url} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-muted" title="DANFE"><Eye className="w-3 h-3" /></a>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
