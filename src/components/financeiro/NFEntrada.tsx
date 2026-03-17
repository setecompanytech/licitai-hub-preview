import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, FileText, Search, CheckCircle2,
  Upload, Download, Key, AlertTriangle, Clock, Building2
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type NFEntradaType = {
  id: string; numero_nf: string | null; serie: string | null;
  chave_acesso: string | null; data_emissao: string | null;
  valor_total: number; status: string;
  emitente_cnpj: string | null; emitente_razao_social: string | null;
  natureza_operacao: string | null; cfop: string | null;
  contrato_id: string | null; observacoes: string | null;
};

export default function NFEntrada() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [notas, setNotas] = useState<NFEntradaType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chaveExtract, setChaveExtract] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contratos, setContratos] = useState<{id: string; numero_contrato: string}[]>([]);

  // Manual entry form
  const [form, setForm] = useState({
    numero_nf: '', serie: '', chave_acesso: '', data_emissao: '',
    valor_total: '', emitente_cnpj: '', emitente_razao_social: '',
    natureza_operacao: '', cfop: '', contrato_id: '', observacoes: '',
  });

  useEffect(() => { if (user && empresaAtiva) loadAll(); }, [user, empresaAtiva]);

  const loadAll = async () => {
    setLoading(true);
    // NFs de entrada = notas que foram recebidas (emitidas por terceiros)
    // We filter by a custom field or by convention: NFs not emitted by this empresa
    const [notasRes, contratosRes] = await Promise.all([
      supabase.from('notas_fiscais').select('id, numero_nf, serie, chave_acesso, data_emissao, valor_total, status, destinatario_cnpj as emitente_cnpj, destinatario_razao_social as emitente_razao_social, natureza_operacao, cfop, contrato_id, observacoes')
        .eq('user_id', user!.id).eq('empresa_id', empresaAtiva!.id)
        .in('natureza_operacao', ['Compra de mercadoria', 'Entrada por devolução', 'Retorno de conserto', 'Outra entrada', 'Importação direta'])
        .order('created_at', { ascending: false }),
      supabase.from('contratos').select('id, numero_contrato').eq('user_id', user!.id).eq('status', 'vigente'),
    ]);
    setNotas((notasRes.data as any[]) || []);
    setContratos((contratosRes.data as any[]) || []);
    setLoading(false);
  };

  const handleManualSave = async () => {
    if (!form.emitente_cnpj || !form.emitente_razao_social || !form.valor_total) {
      toast.error('Preencha CNPJ, Razão Social e Valor da NF de entrada');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('notas_fiscais').insert({
      user_id: user!.id,
      empresa_id: empresaAtiva!.id,
      contrato_id: form.contrato_id || null,
      tipo: 'nfe',
      numero_nf: form.numero_nf || null,
      serie: form.serie || null,
      chave_acesso: form.chave_acesso || null,
      data_emissao: form.data_emissao || null,
      valor_total: parseFloat(form.valor_total) || 0,
      valor_produtos: parseFloat(form.valor_total) || 0,
      valor_servicos: 0,
      natureza_operacao: form.natureza_operacao || 'Compra de mercadoria',
      cfop: form.cfop || null,
      destinatario_cnpj: form.emitente_cnpj,
      destinatario_razao_social: form.emitente_razao_social,
      status: 'registrada',
      observacoes: form.observacoes || null,
    } as any);

    setSaving(false);
    if (error) { toast.error('Erro ao registrar NF de entrada'); return; }
    toast.success('NF de entrada registrada com sucesso!');
    setManualDialogOpen(false);
    setForm({ numero_nf: '', serie: '', chave_acesso: '', data_emissao: '', valor_total: '', emitente_cnpj: '', emitente_razao_social: '', natureza_operacao: '', cfop: '', contrato_id: '', observacoes: '' });
    loadAll();
  };

  const handleExtractByKey = async () => {
    const chave = chaveExtract.replace(/\s/g, '');
    if (chave.length !== 44) { toast.error('A chave de acesso deve ter 44 dígitos'); return; }
    setExtracting(true);
    const { data, error } = await supabase.functions.invoke('emissao-nf', {
      body: { action: 'consultar_chave', chave_acesso: chave },
    });
    setExtracting(false);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao consultar NF'); return; }
    toast.success('NF importada com sucesso!');
    setExtractDialogOpen(false);
    setChaveExtract('');
    loadAll();
  };

  const handleXMLUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.xml')) { toast.error('Selecione um arquivo XML'); return; }
    setExtracting(true);
    try {
      const xmlText = await file.text();
      const { data, error } = await supabase.functions.invoke('emissao-nf', {
        body: { action: 'importar_xml', xml_content: xmlText },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro ao processar XML');
      toast.success('NF extraída do XML com sucesso!');
      loadAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setExtracting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('notas_fiscais').delete().eq('id', id);
    toast.success('NF excluída');
    loadAll();
  };

  const filtered = notas.filter(n => {
    if (!search) return true;
    const s = search.toLowerCase();
    return n.emitente_razao_social?.toLowerCase().includes(s) || n.numero_nf?.includes(s) || n.emitente_cnpj?.includes(s) || n.chave_acesso?.includes(s);
  });

  const totalRegistrado = notas.reduce((s, n) => s + n.valor_total, 0);

  if (!empresaAtiva) return <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma empresa ativa.</Card>;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Download className="w-3 h-3" /> NFs de Entrada</div><p className="text-lg font-bold">{notas.length}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Total Registrado</div><p className="text-lg font-bold">{fmt(totalRegistrado)}</p></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Fornecedores</div><p className="text-lg font-bold">{new Set(notas.map(n => n.emitente_cnpj).filter(Boolean)).size}</p></Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por emitente, número, chave..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>

        <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Importar NF</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-primary" /> Importar NF de Entrada</DialogTitle></DialogHeader>
            <Tabs defaultValue="chave" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="chave" className="flex-1 text-xs"><Key className="w-3.5 h-3.5 mr-1" /> Chave de Acesso</TabsTrigger>
                <TabsTrigger value="xml" className="flex-1 text-xs"><Upload className="w-3.5 h-3.5 mr-1" /> Upload XML</TabsTrigger>
              </TabsList>
              <TabsContent value="chave" className="space-y-4 mt-3">
                <div>
                  <Label className="text-xs">Chave de Acesso (44 dígitos)</Label>
                  <Input value={chaveExtract} onChange={e => setChaveExtract(e.target.value.replace(/\D/g, '').slice(0, 44))} placeholder="Cole a chave de acesso aqui" className="font-mono text-xs" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{chaveExtract.replace(/\s/g, '').length}/44 dígitos</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setExtractDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleExtractByKey} disabled={extracting || chaveExtract.replace(/\s/g, '').length !== 44}>
                    {extracting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />} Consultar
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="xml" className="space-y-4 mt-3">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload do XML da NF-e</p>
                  <input ref={fileInputRef} type="file" accept=".xml" onChange={handleXMLUpload} className="hidden" />
                  <Button variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
                    {extracting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processando...</> : <><Upload className="w-4 h-4 mr-1" /> Selecionar XML</>}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Registrar Manual</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Registrar NF de Entrada</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">CNPJ Emitente <span className="text-destructive">*</span></Label><Input value={form.emitente_cnpj} onChange={e => setForm(f => ({ ...f, emitente_cnpj: e.target.value }))} placeholder="00.000.000/0001-00" /></div>
                <div><Label className="text-xs">Razão Social <span className="text-destructive">*</span></Label><Input value={form.emitente_razao_social} onChange={e => setForm(f => ({ ...f, emitente_razao_social: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Nº da NF</Label><Input value={form.numero_nf} onChange={e => setForm(f => ({ ...f, numero_nf: e.target.value }))} /></div>
                <div><Label className="text-xs">Série</Label><Input value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))} /></div>
                <div><Label className="text-xs">Valor Total <span className="text-destructive">*</span></Label><Input type="number" step="0.01" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Data de Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} /></div>
                <div>
                  <Label className="text-xs">Natureza da Operação</Label>
                  <Select value={form.natureza_operacao || 'Compra de mercadoria'} onValueChange={v => setForm(f => ({ ...f, natureza_operacao: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Compra de mercadoria">Compra de mercadoria</SelectItem>
                      <SelectItem value="Entrada por devolução">Entrada por devolução</SelectItem>
                      <SelectItem value="Retorno de conserto">Retorno de conserto</SelectItem>
                      <SelectItem value="Importação direta">Importação direta</SelectItem>
                      <SelectItem value="Outra entrada">Outra entrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Chave de Acesso (44 dígitos)</Label>
                <Input value={form.chave_acesso} onChange={e => setForm(f => ({ ...f, chave_acesso: e.target.value.replace(/\D/g, '').slice(0, 44) }))} className="font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Vincular ao Contrato</Label>
                <Select value={form.contrato_id} onValueChange={v => setForm(f => ({ ...f, contrato_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                  <SelectContent>{contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.numero_contrato}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setManualDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleManualSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Registrar NF</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <Download className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          Nenhuma NF de entrada registrada
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Emitente</TableHead>
                <TableHead className="text-xs">Número</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Data</TableHead>
                <TableHead className="text-xs">Natureza</TableHead>
                <TableHead className="text-xs w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(nf => (
                <TableRow key={nf.id}>
                  <TableCell className="text-xs">
                    <p className="font-medium truncate max-w-[180px]">{nf.emitente_razao_social || '—'}</p>
                    {nf.emitente_cnpj && <p className="text-[10px] text-muted-foreground">{nf.emitente_cnpj}</p>}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{nf.numero_nf || '—'}</TableCell>
                  <TableCell className="text-xs text-right font-medium">{fmt(nf.valor_total)}</TableCell>
                  <TableCell className="text-xs text-center">{nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString('pt-BR') : '—'}</TableCell>
                  <TableCell className="text-xs">{nf.natureza_operacao || '—'}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(nf.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
