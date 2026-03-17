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
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, FileText, Upload, Download, Search, CheckCircle2,
  XCircle, Clock, Send, Eye, AlertTriangle, Key, DollarSign, FileDown,
  RefreshCw, Building2
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type NotaFiscal = {
  id: string; tipo: string; numero_nf: string | null; serie: string | null;
  chave_acesso: string | null; protocolo_autorizacao: string | null;
  data_emissao: string | null; valor_total: number; valor_produtos: number;
  valor_servicos: number; status: string; destinatario_cnpj: string | null;
  destinatario_razao_social: string | null; natureza_operacao: string | null;
  cfop: string | null; observacoes: string | null; motivo_rejeicao: string | null;
  contrato_pedido_id: string | null; empresa_id: string | null;
  informacoes_complementares: string | null;
};

const statusCfg: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: Clock },
  enviada: { label: 'Enviada', color: 'bg-accent/10 text-accent', icon: Send },
  autorizada: { label: 'Autorizada', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelada: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  inutilizada: { label: 'Inutilizada', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

type Pedido = { id: string; numero_pedido: string; valor_total: number; descricao: string | null };

export default function ContratoNotasFiscais({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('emitir');
  const [statusFilter, setStatusFilter] = useState('all');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [chaveExtract, setChaveExtract] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form for new NF
  const [form, setForm] = useState({
    tipo: 'nfe', numero_nf: '', serie: '1', natureza_operacao: 'Venda de mercadoria',
    cfop: '5102', destinatario_cnpj: '', destinatario_razao_social: '',
    destinatario_endereco: '', destinatario_uf: '', destinatario_municipio: '',
    destinatario_ie: '', contrato_pedido_id: '', observacoes: '',
    informacoes_complementares: '',
  });

  // NF items
  const [nfItens, setNfItens] = useState<Array<{
    key: string; descricao: string; ncm: string; cfop: string;
    unidade: string; quantidade: string; valor_unitario: string;
  }>>([]);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, contratoId]);

  const loadAll = async () => {
    setLoading(true);
    const [notasRes, pedidosRes, configRes] = await Promise.all([
      supabase.from('notas_fiscais').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
      supabase.from('contrato_pedidos').select('id, numero_pedido, valor_total, descricao').eq('contrato_id', contratoId),
      empresaAtiva ? supabase.from('nuvem_fiscal_config').select('ativo').eq('empresa_id', empresaAtiva.id).eq('user_id', user!.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setNotas((notasRes.data as any[]) || []);
    setPedidos((pedidosRes.data as any[]) || []);
    setApiConfigured(!!configRes.data?.ativo);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      tipo: 'nfe', numero_nf: '', serie: '1', natureza_operacao: 'Venda de mercadoria',
      cfop: '5102', destinatario_cnpj: '', destinatario_razao_social: '',
      destinatario_endereco: '', destinatario_uf: '', destinatario_municipio: '',
      destinatario_ie: '', contrato_pedido_id: '', observacoes: '',
      informacoes_complementares: '',
    });
    setNfItens([]);
  };

  const addItem = () => {
    setNfItens(prev => [...prev, {
      key: crypto.randomUUID(), descricao: '', ncm: '', cfop: form.cfop || '5102',
      unidade: 'UN', quantidade: '1', valor_unitario: '0',
    }]);
  };

  const updateItem = (key: string, field: string, value: string) =>
    setNfItens(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

  const removeItem = (key: string) => setNfItens(prev => prev.filter(i => i.key !== key));

  // Import items from linked pedido
  const importFromPedido = async (pedidoId: string) => {
    setForm(f => ({ ...f, contrato_pedido_id: pedidoId }));
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    // Load contrato_pedidos items for this pedido number
    const { data: pedidoItems } = await supabase
      .from('contrato_pedidos')
      .select('descricao, quantidade, valor_unitario, valor_total')
      .eq('contrato_id', contratoId)
      .eq('numero_pedido', pedido.numero_pedido);

    if (pedidoItems && pedidoItems.length > 0) {
      setNfItens(pedidoItems.map((pi: any) => ({
        key: crypto.randomUUID(),
        descricao: pi.descricao || 'Item do pedido',
        ncm: '', cfop: form.cfop || '5102',
        unidade: 'UN',
        quantidade: String(pi.quantidade || 1),
        valor_unitario: String(pi.valor_unitario || 0),
      })));
      toast.info(`${pedidoItems.length} itens importados do pedido.`);
    }
  };

  const handleSaveNF = async () => {
    if (nfItens.length === 0) { toast.error('Adicione pelo menos um item'); return; }

    setSaving(true);
    const valorTotal = nfItens.reduce((s, i) => {
      return s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0);
    }, 0);

    const { data: nf, error } = await supabase.from('notas_fiscais').insert({
      user_id: user!.id,
      empresa_id: empresaAtiva?.id || null,
      contrato_id: contratoId,
      contrato_pedido_id: form.contrato_pedido_id || null,
      tipo: form.tipo,
      numero_nf: form.numero_nf || null,
      serie: form.serie,
      natureza_operacao: form.natureza_operacao,
      cfop: form.cfop,
      destinatario_cnpj: form.destinatario_cnpj || null,
      destinatario_razao_social: form.destinatario_razao_social || null,
      destinatario_endereco: form.destinatario_endereco || null,
      destinatario_uf: form.destinatario_uf || null,
      destinatario_municipio: form.destinatario_municipio || null,
      destinatario_ie: form.destinatario_ie || null,
      valor_total: valorTotal,
      valor_produtos: form.tipo === 'nfe' ? valorTotal : 0,
      valor_servicos: form.tipo === 'nfse' ? valorTotal : 0,
      status: 'rascunho',
      observacoes: form.observacoes || null,
      informacoes_complementares: form.informacoes_complementares || null,
    } as any).select('id').single();

    if (error || !nf) {
      toast.error('Erro ao criar nota fiscal');
      setSaving(false);
      return;
    }

    // Insert items
    const itensInsert = nfItens.map((item, idx) => ({
      nota_fiscal_id: nf.id,
      numero_item: idx + 1,
      descricao: item.descricao,
      ncm: item.ncm || null,
      cfop: item.cfop || null,
      unidade: item.unidade,
      quantidade: parseFloat(item.quantidade) || 0,
      valor_unitario: parseFloat(item.valor_unitario) || 0,
      valor_total: (parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0),
    }));

    await supabase.from('nota_fiscal_itens').insert(itensInsert as any);

    setSaving(false);
    toast.success('Nota fiscal criada como rascunho.');
    setDialogOpen(false);
    resetForm();
    loadAll();
  };

  // Enviar NF para autorização via Nuvem Fiscal
  const handleEnviarNF = async (nfId: string) => {
    if (!apiConfigured) {
      toast.error('Configure a API Nuvem Fiscal nas configurações da empresa antes de enviar.');
      return;
    }
    toast.info('Enviando NF para autorização...');

    const { data, error } = await supabase.functions.invoke('emissao-nf', {
      body: { action: 'emitir', nota_fiscal_id: nfId },
    });

    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao enviar NF');
      return;
    }
    toast.success('NF enviada para autorização!');
    loadAll();
  };

  // Consultar NF por chave de acesso (extração estilo FSIT)
  const handleExtractByKey = async () => {
    const chave = chaveExtract.replace(/\s/g, '');
    if (chave.length !== 44) {
      toast.error('A chave de acesso deve ter 44 dígitos');
      return;
    }
    setExtracting(true);

    const { data, error } = await supabase.functions.invoke('emissao-nf', {
      body: { action: 'consultar_chave', chave_acesso: chave, contrato_id: contratoId },
    });

    setExtracting(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao consultar NF');
      return;
    }
    toast.success('NF importada com sucesso!');
    setExtractDialogOpen(false);
    setChaveExtract('');
    loadAll();
  };

  // Upload XML para extração
  const handleXMLUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xml')) { toast.error('Selecione um arquivo XML'); return; }

    setExtracting(true);
    try {
      const xmlText = await file.text();
      const { data, error } = await supabase.functions.invoke('emissao-nf', {
        body: { action: 'importar_xml', xml_content: xmlText, contrato_id: contratoId },
      });

      if (error || data?.error) throw new Error(data?.error || 'Erro ao processar XML');
      toast.success('NF extraída do XML com sucesso!');
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('notas_fiscais').delete().eq('id', id);
    toast.success('Nota fiscal excluída');
    loadAll();
  };

  const filteredNotas = statusFilter === 'all' ? notas : notas.filter(n => n.status === statusFilter);
  const totalEmitido = notas.filter(n => n.status === 'autorizada').reduce((s, n) => s + n.valor_total, 0);
  const totalPendente = notas.filter(n => ['rascunho', 'enviada'].includes(n.status)).reduce((s, n) => s + n.valor_total, 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><FileText className="w-3 h-3" /> Total NFs</div>
          <p className="text-lg font-bold">{notas.length}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><CheckCircle2 className="w-3 h-3" /> Autorizadas</div>
          <p className="text-lg font-bold text-success">{fmt(totalEmitido)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Clock className="w-3 h-3" /> Pendentes</div>
          <p className="text-lg font-bold text-warning">{fmt(totalPendente)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1"><Key className="w-3 h-3" /> API</div>
          <p className="text-xs font-medium mt-1">
            {apiConfigured ? (
              <Badge className="bg-success/10 text-success text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Configurada</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-warning"><AlertTriangle className="w-3 h-3 mr-1" /> Não configurada</Badge>
            )}
          </p>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Emitir NF</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Nova Nota Fiscal
              </DialogTitle>
            </DialogHeader>
            <EmitirNFForm
              form={form} setForm={setForm}
              nfItens={nfItens} addItem={addItem} updateItem={updateItem} removeItem={removeItem}
              pedidos={pedidos} importFromPedido={importFromPedido}
              saving={saving} onSave={handleSaveNF} onCancel={() => { setDialogOpen(false); resetForm(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Extrair NF</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" /> Extrair / Importar Nota Fiscal
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="chave" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="chave" className="flex-1 text-xs">
                  <Key className="w-3.5 h-3.5 mr-1" /> Por Chave de Acesso
                </TabsTrigger>
                <TabsTrigger value="xml" className="flex-1 text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload XML
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chave" className="space-y-4 mt-3">
                <div>
                  <Label className="text-xs">Chave de Acesso (44 dígitos)</Label>
                  <Input
                    value={chaveExtract}
                    onChange={e => setChaveExtract(e.target.value.replace(/\D/g, '').slice(0, 44))}
                    placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {chaveExtract.replace(/\s/g, '').length}/44 dígitos
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Como funciona:</p>
                  <p>• Consulta a NF-e na SEFAZ usando a chave de acesso</p>
                  <p>• Importa automaticamente os dados, itens e valores</p>
                  <p>• Similar ao sistema FSist e outros extratores de XML</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setExtractDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleExtractByKey} disabled={extracting || chaveExtract.replace(/\s/g, '').length !== 44}>
                    {extracting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                    Consultar NF
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="xml" className="space-y-4 mt-3">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload do XML da NF-e</p>
                  <p className="text-xs text-muted-foreground mt-1">Arquivo XML baixado da SEFAZ ou do emitente</p>
                  <input ref={fileInputRef} type="file" accept=".xml" onChange={handleXMLUpload} className="hidden" />
                  <Button variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
                    {extracting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processando...</> : <><Upload className="w-4 h-4 mr-1" /> Selecionar XML</>}
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Extração de XML:</p>
                  <p>• Suporta NF-e (modelo 55) e NFC-e (modelo 65)</p>
                  <p>• Extrai automaticamente emitente, destinatário, itens e impostos</p>
                  <p>• Os dados são vinculados ao contrato atual</p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* NF List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filteredNotas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          Nenhuma nota fiscal encontrada
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotas.map(nf => {
            const cfg = statusCfg[nf.status] || statusCfg.rascunho;
            const Icon = cfg.icon;
            return (
              <Card key={nf.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-accent">
                        {nf.tipo === 'nfse' ? 'NFS-e' : 'NF-e'} {nf.numero_nf || '(sem número)'}
                      </span>
                      <Badge className={`${cfg.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                      {nf.serie && <Badge variant="outline" className="text-[10px]">Série {nf.serie}</Badge>}
                    </div>
                    {nf.destinatario_razao_social && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {nf.destinatario_razao_social}
                        {nf.destinatario_cnpj && <span className="text-[10px]">({nf.destinatario_cnpj})</span>}
                      </p>
                    )}
                    {nf.chave_acesso && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                        Chave: {nf.chave_acesso}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {nf.data_emissao && <span>{new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</span>}
                      <span className="font-medium text-foreground">{fmt(nf.valor_total)}</span>
                      {nf.natureza_operacao && <span>{nf.natureza_operacao}</span>}
                    </div>
                    {nf.motivo_rejeicao && (
                      <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {nf.motivo_rejeicao}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {nf.status === 'rascunho' && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleEnviarNF(nf.id)}>
                        <Send className="w-3 h-3 mr-1" /> Enviar
                      </Button>
                    )}
                    {['rascunho', 'rejeitada'].includes(nf.status) && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(nf.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Emitir NF Form ──
function EmitirNFForm({
  form, setForm, nfItens, addItem, updateItem, removeItem,
  pedidos, importFromPedido, saving, onSave, onCancel,
}: {
  form: any; setForm: (fn: any) => void;
  nfItens: any[]; addItem: () => void; updateItem: (k: string, f: string, v: string) => void; removeItem: (k: string) => void;
  pedidos: Pedido[]; importFromPedido: (id: string) => void;
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const totalItens = nfItens.reduce((s, i) => s + (parseFloat(i.quantidade) || 0) * (parseFloat(i.valor_unitario) || 0), 0);

  return (
    <div className="space-y-4 mt-2">
      {/* Tipo e Pedido vinculado */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo de NF</Label>
          <Select value={form.tipo} onValueChange={v => setForm((f: any) => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nfe">NF-e (Produtos)</SelectItem>
              <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Vincular ao Pedido</Label>
          <Select value={form.contrato_pedido_id} onValueChange={v => importFromPedido(v)}>
            <SelectTrigger><SelectValue placeholder="Selecionar pedido..." /></SelectTrigger>
            <SelectContent>
              {pedidos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.numero_pedido} — {fmt(p.valor_total)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Destinatário */}
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Destinatário</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">CNPJ/CPF</Label><Input value={form.destinatario_cnpj} onChange={e => setForm((f: any) => ({ ...f, destinatario_cnpj: e.target.value }))} placeholder="00.000.000/0001-00" /></div>
          <div><Label className="text-xs">Razão Social</Label><Input value={form.destinatario_razao_social} onChange={e => setForm((f: any) => ({ ...f, destinatario_razao_social: e.target.value }))} /></div>
          <div><Label className="text-xs">UF</Label><Input value={form.destinatario_uf} onChange={e => setForm((f: any) => ({ ...f, destinatario_uf: e.target.value }))} maxLength={2} /></div>
          <div><Label className="text-xs">Município</Label><Input value={form.destinatario_municipio} onChange={e => setForm((f: any) => ({ ...f, destinatario_municipio: e.target.value }))} /></div>
          <div><Label className="text-xs">IE</Label><Input value={form.destinatario_ie} onChange={e => setForm((f: any) => ({ ...f, destinatario_ie: e.target.value }))} placeholder="Inscrição Estadual" /></div>
          <div><Label className="text-xs">Endereço</Label><Input value={form.destinatario_endereco} onChange={e => setForm((f: any) => ({ ...f, destinatario_endereco: e.target.value }))} /></div>
        </div>
      </div>

      <Separator />

      {/* Operação */}
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Natureza da Operação</Label><Input value={form.natureza_operacao} onChange={e => setForm((f: any) => ({ ...f, natureza_operacao: e.target.value }))} /></div>
        <div><Label className="text-xs">CFOP</Label><Input value={form.cfop} onChange={e => setForm((f: any) => ({ ...f, cfop: e.target.value }))} placeholder="5102" /></div>
        <div><Label className="text-xs">Série</Label><Input value={form.serie} onChange={e => setForm((f: any) => ({ ...f, serie: e.target.value }))} /></div>
      </div>

      <Separator />

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold">Itens da Nota</h4>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar Item
          </Button>
        </div>

        {nfItens.length === 0 ? (
          <Card className="p-4 text-center text-xs text-muted-foreground">
            Nenhum item adicionado. Vincule um pedido ou adicione manualmente.
          </Card>
        ) : (
          <div className="space-y-2">
            {nfItens.map((item, idx) => (
              <Card key={item.key} className="p-3">
                <div className="grid grid-cols-6 gap-2 items-end">
                  <div className="col-span-2">
                    <Label className="text-[10px]">Descrição</Label>
                    <Input className="text-xs h-8" value={item.descricao} onChange={e => updateItem(item.key, 'descricao', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">NCM</Label>
                    <Input className="text-xs h-8" value={item.ncm} onChange={e => updateItem(item.key, 'ncm', e.target.value)} placeholder="0000.00.00" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Qtd</Label>
                    <Input className="text-xs h-8" type="number" value={item.quantidade} onChange={e => updateItem(item.key, 'quantidade', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Valor Unit.</Label>
                    <Input className="text-xs h-8" type="number" step="0.01" value={item.valor_unitario} onChange={e => updateItem(item.key, 'valor_unitario', e.target.value)} />
                  </div>
                  <div className="flex items-end gap-1">
                    <div className="flex-1">
                      <Label className="text-[10px]">Total</Label>
                      <p className="text-xs font-bold h-8 flex items-center">
                        {fmt((parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0))}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(item.key)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            <div className="text-right">
              <p className="text-sm font-bold">Total: {fmt(totalItens)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Observações */}
      <div>
        <Label className="text-xs">Informações Complementares</Label>
        <Textarea value={form.informacoes_complementares} onChange={e => setForm((f: any) => ({ ...f, informacoes_complementares: e.target.value }))} rows={2} placeholder="Informações adicionais que aparecerão na DANFE" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Salvar Rascunho
        </Button>
      </div>
    </div>
  );
}
