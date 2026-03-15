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
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, ShoppingCart, CheckCircle2, Clock, XCircle,
  Upload, FileText, AlertTriangle
} from 'lucide-react';

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

const tiposDocumento = [
  { value: 'ordem_fornecimento', label: 'Ordem de Fornecimento (OF)' },
  { value: 'empenho_global', label: 'Empenho Global' },
  { value: 'empenho_ordinario', label: 'Empenho Ordinário' },
  { value: 'empenho_estimativo', label: 'Empenho Estimativo' },
  { value: 'prd', label: 'PRD (Pedido de Reposição de Demanda)' },
  { value: 'outro', label: 'Outro' },
];

export default function ContratoPedidos({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for manual or post-extraction editing
  const [form, setForm] = useState({
    numero_pedido: '', descricao: '', contrato_item_id: '',
    quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
    data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
    tipo_documento: 'ordem_fornecimento',
  });

  // Multi-item support for extraction
  const [extractedItens, setExtractedItens] = useState<Array<{
    key: string; descricao: string; quantidade: string; valor_unitario: string;
    contrato_item_id: string;
  }>>([]);

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

  const handleItemChange = (itemId: string) => {
    setForm(f => {
      const item = itens.find(i => i.id === itemId);
      return { ...f, contrato_item_id: itemId, valor_unitario: item ? String(item.valor_unitario) : f.valor_unitario };
    });
  };

  const resetForm = () => {
    setForm({
      numero_pedido: '', descricao: '', contrato_item_id: '',
      quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
      data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
      tipo_documento: 'ordem_fornecimento',
    });
    setExtractedData(null);
    setExtractedItens([]);
  };

  // PDF Upload & Extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    setUploading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 30);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }

      if (fullText.trim().length < 30) {
        toast.error('Não foi possível extrair texto do PDF');
        setUploading(false);
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('extrair-pedido-pdf', {
        body: { texto_pdf: fullText, tipo_documento: form.tipo_documento },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const extracted = result.data;
      setExtractedData(extracted);

      // Fill form with extracted data
      setForm(f => ({
        ...f,
        numero_pedido: extracted.numero_documento || f.numero_pedido,
        descricao: extracted.observacoes || f.descricao,
        data_pedido: extracted.data_documento || f.data_pedido,
        data_entrega: extracted.data_entrega || f.data_entrega,
        nota_fiscal: extracted.nota_fiscal || f.nota_fiscal,
        tipo_documento: extracted.tipo_documento || f.tipo_documento,
        observacoes: extracted.observacoes || '',
      }));

      // Map extracted items
      if (extracted.itens && extracted.itens.length > 0) {
        const mappedItens = extracted.itens.map((ei: any) => {
          // Try to match with contract items by description
          const matchedItem = itens.find(ci =>
            ci.descricao.toLowerCase().includes(ei.descricao?.toLowerCase()?.substring(0, 20) || '') ||
            ei.descricao?.toLowerCase()?.includes(ci.descricao.toLowerCase().substring(0, 20))
          );
          return {
            key: crypto.randomUUID(),
            descricao: ei.descricao || '',
            quantidade: ei.quantidade ? String(ei.quantidade) : '',
            valor_unitario: ei.valor_unitario ? String(ei.valor_unitario) : (matchedItem ? String(matchedItem.valor_unitario) : ''),
            contrato_item_id: matchedItem?.id || '',
          };
        });
        setExtractedItens(mappedItens);
      }

      // Auto-switch to manual tab for review
      setActiveTab('manual');
      toast.success(`Dados extraídos: ${extracted.itens?.length || 0} itens identificados. Revise e salve.`);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Erro ao processar documento');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save single pedido (manual mode without extracted items)
  const handleSaveSingle = async () => {
    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }
    const qty = parseFloat(form.quantidade) || 0;
    const unit = parseFloat(form.valor_unitario) || 0;
    setSaving(true);
    const { error } = await supabase.from('contrato_pedidos').insert({
      contrato_id: contratoId, user_id: user!.id,
      numero_pedido: form.numero_pedido, descricao: form.descricao || null,
      contrato_item_id: form.contrato_item_id || null,
      quantidade: qty, valor_unitario: unit, valor_total: qty * unit,
      data_pedido: form.data_pedido || null, data_entrega: form.data_entrega || null,
      status: form.status, nota_fiscal: form.nota_fiscal || null,
      observacoes: form.observacoes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar pedido'); return; }
    toast.success('Pedido registrado com sucesso.');
    setDialogOpen(false);
    resetForm();
    load();
  };

  // Save multiple items from extraction
  const handleSaveBatch = async () => {
    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }
    const validItens = extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0);
    if (validItens.length === 0) { toast.error('Nenhum item válido para registrar'); return; }

    setSaving(true);
    const inserts = validItens.map(ei => {
      const qty = parseFloat(ei.quantidade) || 0;
      const unit = parseFloat(ei.valor_unitario) || 0;
      return {
        contrato_id: contratoId, user_id: user!.id,
        numero_pedido: form.numero_pedido,
        descricao: ei.descricao,
        contrato_item_id: ei.contrato_item_id || null,
        quantidade: qty, valor_unitario: unit, valor_total: qty * unit,
        data_pedido: form.data_pedido || null,
        data_entrega: form.data_entrega || null,
        status: form.status,
        nota_fiscal: form.nota_fiscal || null,
        observacoes: form.observacoes || null,
      };
    });

    const { error } = await supabase.from('contrato_pedidos').insert(inserts as any);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar pedidos'); return; }
    toast.success(`${inserts.length} itens do pedido registrados com sucesso.`);
    setDialogOpen(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contrato_pedidos').delete().eq('id', id);
    toast.success('Pedido excluído. Saldos recalculados.');
    load();
  };

  const removeExtractedItem = (key: string) => {
    setExtractedItens(prev => prev.filter(i => i.key !== key));
  };

  const updateExtractedItem = (key: string, field: string, value: string) => {
    setExtractedItens(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const totalPedidos = pedidos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + p.valor_total, 0);
  const totalExtracted = extractedItens.reduce((s, ei) => {
    const qty = parseFloat(ei.quantidade) || 0;
    const unit = parseFloat(ei.valor_unitario) || 0;
    return s + qty * unit;
  }, 0);

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
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Registrar Pedido
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1 text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Importar Documento
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Inclusão Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 mt-3">
                <div>
                  <Label className="text-xs">Tipo de Documento</Label>
                  <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposDocumento.map(td => (
                        <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Faça upload do documento PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    OF, Nota de Empenho, PRD ou documento similar
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processando...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-1" /> Selecionar PDF</>
                    )}
                  </Button>
                </div>

                {uploading && (
                  <div className="p-3 rounded-lg bg-muted/50 border text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Extraindo dados com IA, aguarde...</p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Documentos suportados:</p>
                  <p>Ordem de Fornecimento (OF), Nota de Empenho (Global, Ordinário, Estimativo), PRD</p>
                  <p>Os dados serão extraídos automaticamente e disponibilizados para revisão antes do salvamento.</p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                {extractedData && (
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      Dados extraídos do documento — revise e corrija se necessário
                    </p>
                    {extractedData.tipo_documento && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Tipo identificado: {tiposDocumento.find(td => td.value === extractedData.tipo_documento)?.label || extractedData.tipo_documento}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">N.o Documento *</Label>
                    <Input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} placeholder="OF-001, NE-2025/001" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de Documento</Label>
                    <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tiposDocumento.map(td => (
                          <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data do Pedido</Label>
                    <Input type="date" value={form.data_pedido} onChange={e => setForm(f => ({ ...f, data_pedido: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Data de Entrega</Label>
                    <Input type="date" value={form.data_entrega} onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
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
                    <Label className="text-xs">Nota Fiscal</Label>
                    <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
                  </div>
                </div>

                {/* If extracted items exist, show multi-item mode */}
                {extractedItens.length > 0 ? (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold mb-2">Itens Extraídos ({extractedItens.length})</p>
                      <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                        {extractedItens.map((ei, idx) => (
                          <Card key={ei.key} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-muted-foreground">Item {idx + 1}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeExtractedItem(ei.key)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                            <div>
                              <Label className="text-[11px]">Descrição</Label>
                              <Input value={ei.descricao} onChange={e => updateExtractedItem(ei.key, 'descricao', e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[11px]">Item do Contrato</Label>
                                <Select value={ei.contrato_item_id} onValueChange={v => {
                                  const item = itens.find(i => i.id === v);
                                  updateExtractedItem(ei.key, 'contrato_item_id', v);
                                  if (item) updateExtractedItem(ei.key, 'valor_unitario', String(item.valor_unitario));
                                }}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vincular item" /></SelectTrigger>
                                  <SelectContent>
                                    {itens.map(i => (
                                      <SelectItem key={i.id} value={i.id} className="text-xs">{i.descricao}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[11px]">Quantidade</Label>
                                <Input type="number" value={ei.quantidade} onChange={e => updateExtractedItem(ei.key, 'quantidade', e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[11px]">Valor Unit. (R$)</Label>
                                <Input type="number" step="0.01" value={ei.valor_unitario} onChange={e => updateExtractedItem(ei.key, 'valor_unitario', e.target.value)} className="h-8 text-xs" />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border flex justify-between items-center">
                      <span className="text-xs font-medium">{extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} itens válidos</span>
                      <span className="text-sm font-bold text-primary">Total: {fmt(totalExtracted)}</span>
                    </div>

                    <div className="col-span-2">
                      <Label className="text-xs">Observações</Label>
                      <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSaveBatch} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                        Registrar {extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} itens
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Single item mode */}
                    <Separator />
                    <div>
                      <Label className="text-xs">Item do Contrato</Label>
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
                      <Label className="text-xs">Descrição</Label>
                      <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Quantidade</Label>
                        <Input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Valor Unitário (R$)</Label>
                        <Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Observações</Label>
                      <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSaveSingle} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
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
                <TableHead className="text-xs">N.o Pedido</TableHead>
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
