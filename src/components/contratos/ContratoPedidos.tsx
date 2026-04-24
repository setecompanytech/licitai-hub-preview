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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, ShoppingCart, CheckCircle2, Clock, XCircle,
  Upload, FileText, AlertTriangle, DollarSign, Receipt, Pencil, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import GerarPreNotaDialog from './GerarPreNotaDialog';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { MoneyInput } from '@/components/ui/money-input';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Editor monetário inline: salva ao perder o foco. */
function CustoInlineEditor({ initialValue, onSave }: { initialValue: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState<number>(initialValue);
  return (
    <MoneyInput
      value={val}
      onValueChange={setVal}
      onBlur={() => onSave(val)}
      className="h-7 w-28 text-xs"
    />
  );
}

type ContratoItem = { id: string; descricao: string; unidade: string; valor_unitario: number; origem_aditivo_id: string | null };
type AditivoRef = { id: string; numero_aditivo: string; tipo: string };

const getOrigemLabel = (item: ContratoItem, aditivos: AditivoRef[]): string => {
  if (!item.origem_aditivo_id) return '📄 Contrato Original';
  const ad = aditivos.find(a => a.id === item.origem_aditivo_id);
  return ad ? `📎 ${ad.numero_aditivo}` : '📎 Aditivo';
};
type Pedido = {
  id: string; numero_pedido: string; descricao: string | null;
  contrato_item_id: string | null; quantidade: number; valor_unitario: number;
  valor_total: number; data_pedido: string | null; data_entrega: string | null;
  status: string; nota_fiscal: string | null; observacoes: string | null;
  nf_quitada: boolean; data_quitacao: string | null;
};
type NotaFiscalSync = {
  id: string; numero_nf: string | null; tipo: string; status: string | null;
  valor_total: number | null; data_emissao: string | null; chave_acesso: string | null;
  contrato_pedido_id: string | null; natureza_operacao: string | null;
  destinatario_razao_social: string | null;
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
  const { empresaAtiva } = useEmpresa();
  const { isFinanceiro, isAdmin } = useMembroPermissoes();
  const podeVerCustos = isFinanceiro || isAdmin;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [aditivos, setAditivos] = useState<AditivoRef[]>([]);
  const [nfsSync, setNfsSync] = useState<NotaFiscalSync[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  // Pré-NF dialog
  const [preNfDialogOpen, setPreNfDialogOpen] = useState(false);
  const [preNotas, setPreNotas] = useState<any[]>([]);

  // NF quitada dialog (setor financeiro)
  const [nfDialog, setNfDialog] = useState<Pedido | null>(null);
  const [nfNumero, setNfNumero] = useState('');
  const [nfData, setNfData] = useState('');
  const [nfValorPago, setNfValorPago] = useState('');
  const [solicitandoComissao, setSolicitandoComissao] = useState(false);

  // Edit state
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    numero_pedido: '', descricao: '', contrato_item_id: '',
    quantidade: '', valor_unitario: '', data_pedido: '',
    data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    numero_pedido: '', descricao: '', contrato_item_id: '',
    quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
    data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
    tipo_documento: 'ordem_fornecimento', origem_aditivo_id: '',
  });
  const [origemFilter, setOrigemFilter] = useState<string>('__todos__');

  // Multi-item support
  const [extractedItens, setExtractedItens] = useState<Array<{
    key: string; descricao: string; quantidade: string; valor_unitario: string;
    contrato_item_id: string;
  }>>([]);

  const load = async () => {
    setLoading(true);
    const [pedidosRes, itensRes, nfsRes, preNotasRes, aditivosRes] = await Promise.all([
      supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId).order('data_pedido', { ascending: false }),
      supabase.from('contrato_itens').select('id, descricao, unidade, valor_unitario, origem_aditivo_id').eq('contrato_id', contratoId),
      supabase.from('notas_fiscais').select('id, numero_nf, tipo, status, valor_total, data_emissao, chave_acesso, contrato_pedido_id, natureza_operacao, destinatario_razao_social').eq('contrato_id', contratoId),
      supabase.from('pre_notas_fiscais' as any).select('id, status, natureza_operacao, valor_total, created_at, motivo_rejeicao, motivo_devolucao').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
      supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
    ]);
    setPedidos((pedidosRes.data as any[]) || []);
    setItens((itensRes.data as any[]) || []);
    setNfsSync((nfsRes.data as any[]) || []);
    setPreNotas((preNotasRes.data as any[]) || []);
    setAditivos((aditivosRes.data as any[]) || []);
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
      tipo_documento: 'ordem_fornecimento', origem_aditivo_id: '',
    });
    setExtractedData(null);
    setExtractedItens([]);
  };

  // PDF Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF'); return; }

    setUploading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      if (fullText.trim().length < 30) { toast.error('Não foi possível extrair texto do PDF'); setUploading(false); return; }

      const { data: result, error } = await supabase.functions.invoke('extrair-pedido-pdf', {
        body: { texto_pdf: fullText, tipo_documento: form.tipo_documento },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const extracted = result.data;
      setExtractedData(extracted);
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

      if (extracted.itens?.length > 0) {
        setExtractedItens(extracted.itens.map((ei: any) => {
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
        }));
      }
      setActiveTab('manual');
      toast.success(`Dados extraídos: ${extracted.itens?.length || 0} itens identificados.`);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Erro ao processar documento');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
      origem_aditivo_id: form.origem_aditivo_id || null,
    } as any);
    setSaving(false);
    if (error) { console.error('Erro ao salvar pedido:', error.message, error.details, error.code); toast.error('Erro ao salvar pedido: ' + error.message); return; }
    toast.success('Pedido registrado.');
    setDialogOpen(false);
    resetForm();
    load();
  };

  const handleSaveBatch = async () => {
    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }
    const validItens = extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0);
    if (validItens.length === 0) { toast.error('Nenhum item válido'); return; }

    setSaving(true);
    const inserts = validItens.map(ei => {
      const qty = parseFloat(ei.quantidade) || 0;
      const unit = parseFloat(ei.valor_unitario) || 0;
      return {
        contrato_id: contratoId, user_id: user!.id,
        numero_pedido: form.numero_pedido, descricao: ei.descricao,
        contrato_item_id: ei.contrato_item_id || null,
        quantidade: qty, valor_unitario: unit, valor_total: qty * unit,
        data_pedido: form.data_pedido || null, data_entrega: form.data_entrega || null,
        status: form.status, nota_fiscal: form.nota_fiscal || null,
        observacoes: form.observacoes || null,
      };
    });
    const { error } = await supabase.from('contrato_pedidos').insert(inserts as any);
    setSaving(false);
    if (error) { console.error('Erro ao salvar pedidos:', error.message, error.details, error.code); toast.error('Erro ao salvar pedidos: ' + error.message); return; }
    toast.success(`${inserts.length} itens registrados.`);
    setDialogOpen(false);
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    // Remove/unlink ALL dependent records to avoid FK constraint errors
    await supabase.from('comissoes_lancamentos' as any).delete().eq('contrato_pedido_id', id);
    await supabase.from('contrato_custos').delete().eq('contrato_pedido_id', id);
    await supabase.from('notas_fiscais').update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    await supabase.from('contas_receber' as any).update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    await supabase.from('pre_nota_itens' as any).update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    
    const { error } = await supabase.from('contrato_pedidos').delete().eq('id', id);
    if (error) {
      console.error('Erro ao excluir pedido:', error);
      toast.error('Erro ao excluir pedido: ' + error.message);
      return;
    }
    toast.success('Pedido excluído.');
    load();
  };

  const openEditDialog = (p: Pedido) => {
    setEditingPedido(p);
    setEditForm({
      numero_pedido: p.numero_pedido || '',
      descricao: p.descricao || '',
      contrato_item_id: p.contrato_item_id || '',
      quantidade: String(p.quantidade || ''),
      valor_unitario: String(p.valor_unitario || ''),
      data_pedido: p.data_pedido || '',
      data_entrega: p.data_entrega || '',
      status: p.status || 'pendente',
      nota_fiscal: p.nota_fiscal || '',
      observacoes: p.observacoes || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPedido) return;
    const qty = parseFloat(editForm.quantidade) || 0;
    const unit = parseFloat(editForm.valor_unitario) || 0;
    setSavingEdit(true);
    const { error } = await supabase.from('contrato_pedidos').update({
      numero_pedido: editForm.numero_pedido,
      descricao: editForm.descricao || null,
      contrato_item_id: editForm.contrato_item_id || null,
      quantidade: qty,
      valor_unitario: unit,
      valor_total: qty * unit,
      data_pedido: editForm.data_pedido || null,
      data_entrega: editForm.data_entrega || null,
      status: editForm.status,
      nota_fiscal: editForm.nota_fiscal || null,
      observacoes: editForm.observacoes || null,
    } as any).eq('id', editingPedido.id);
    setSavingEdit(false);
    if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
    toast.success('Pedido atualizado.');
    setEditDialogOpen(false);
    setEditingPedido(null);
    load();
  };

  const removeExtractedItem = (key: string) => setExtractedItens(prev => prev.filter(i => i.key !== key));
  const updateExtractedItem = (key: string, field: string, value: string) =>
    setExtractedItens(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

  // NF Quitada — Fluxo do Financeiro: informa data/valor do pagamento, sistema auto-calcula comissão
  const openNfDialog = (pedido: Pedido) => {
    setNfDialog(pedido);
    setNfNumero(pedido.nota_fiscal || '');
    setNfData(pedido.data_quitacao || new Date().toISOString().split('T')[0]);
    setNfValorPago(String(pedido.valor_total));
  };

  const handleMarcarNfQuitada = async () => {
    if (!nfDialog || !nfNumero.trim()) { toast.error('Informe o número da Nota Fiscal'); return; }
    if (!nfData) { toast.error('Informe a data do pagamento'); return; }
    const valorPago = parseFloat(nfValorPago) || 0;
    if (valorPago <= 0) { toast.error('Informe o valor pago'); return; }
    setSolicitandoComissao(true);

    // 1. Update pedido with NF quitada
    const { error: updateErr } = await supabase.from('contrato_pedidos').update({
      nota_fiscal: nfNumero,
      nf_quitada: true,
      data_quitacao: nfData,
    } as any).eq('id', nfDialog.id);

    if (updateErr) {
      toast.error('Erro ao atualizar NF');
      setSolicitandoComissao(false);
      return;
    }

    // 2. Buscar vendedor responsável pelo contrato
    const { data: contrato } = await supabase
      .from('contratos')
      .select('vendedor_user_id, empresa_id')
      .eq('id', contratoId)
      .single();

    const vendedorId = (contrato as any)?.vendedor_user_id;
    const empresaId = (contrato as any)?.empresa_id || empresaAtiva?.id;

    if (!vendedorId || !empresaId) {
      toast.warning('NF quitada registrada, mas não há vendedor vinculado ao contrato para cálculo de comissão.');
      setSolicitandoComissao(false);
      setNfDialog(null);
      load();
      return;
    }

    // 3. Buscar config de comissão do vendedor
    const { data: comConfig } = await supabase
      .from('comissoes_config' as any)
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .maybeSingle();

    const percentual = (comConfig as any)?.percentual || 0;
    const valorFixo = (comConfig as any)?.valor_fixo || 0;
    const tipoComissao = (comConfig as any)?.tipo_comissao || 'percentual';

    const valorComissao = tipoComissao === 'percentual'
      ? valorPago * (percentual / 100)
      : valorFixo;

    // 4. Criar lançamento de comissão automático
    const { error: comErr } = await supabase.from('comissoes_lancamentos' as any).insert({
      empresa_id: empresaId,
      user_id: vendedorId,
      solicitado_por: user?.id,
      tipo: 'nota_fiscal',
      valor_base: valorPago,
      percentual_comissao: tipoComissao === 'percentual' ? percentual : 0,
      valor_comissao: valorComissao,
      nota_fiscal: nfNumero,
      status: 'pendente',
      contrato_pedido_id: nfDialog.id,
      observacoes: `Comissão auto-calculada pelo financeiro. NF ${nfNumero} quitada em ${nfData}. Valor pago: ${fmt(valorPago)}. Comissão (${tipoComissao === 'percentual' ? percentual + '%' : 'fixo'}): ${fmt(valorComissao)}.`,
    } as any);

    if (comErr) {
      console.error('Erro ao criar comissão:', comErr);
      toast.warning('NF quitada, mas houve erro ao gerar comissão automaticamente.');
    } else {
      toast.success(`NF quitada! Comissão de ${fmt(valorComissao)} gerada para o vendedor responsável.`);
    }

    setSolicitandoComissao(false);
    setNfDialog(null);
    load();
  };

  const totalPedidos = pedidos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + p.valor_total, 0);
  const totalExtracted = extractedItens.reduce((s, ei) => {
    const qty = parseFloat(ei.quantidade) || 0;
    const unit = parseFloat(ei.valor_unitario) || 0;
    return s + qty * unit;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-accent" /> Pedidos / Ordens de Fornecimento
          </h3>
          <p className="text-xs text-muted-foreground">
            {pedidos.length} pedidos | Total: {fmt(totalPedidos)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreNfDialogOpen(true)} disabled={pedidos.filter(p => p.status !== 'cancelado').length === 0}>
            <Receipt className="w-3.5 h-3.5 mr-1" /> Gerar Pré-NF
          </Button>
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
                  <p className="text-xs text-muted-foreground mt-1">OF, Nota de Empenho, PRD ou documento similar</p>
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processando...</> : <><Upload className="w-4 h-4 mr-1" /> Selecionar PDF</>}
                  </Button>
                </div>

                {uploading && (
                  <div className="p-3 rounded-lg bg-muted/50 border text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-primary" />
                    <p className="text-xs text-muted-foreground">Extraindo dados com IA...</p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Documentos suportados:</p>
                  <p>Ordem de Fornecimento (OF), Nota de Empenho (Global, Ordinário, Estimativo), PRD</p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                {extractedData && (
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      Dados extraídos — revise e corrija se necessário
                    </p>
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
                                      <SelectItem key={i.id} value={i.id} className="text-xs">
                                        <span className="text-muted-foreground text-[10px] mr-1">[{getOrigemLabel(i, aditivos)}]</span>
                                        {i.descricao}
                                      </SelectItem>
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
                    <Separator />
                    <div>
                      <Label className="text-xs">Origem do Pedido</Label>
                      <Select value={origemFilter} onValueChange={v => { setOrigemFilter(v); setForm(f => ({ ...f, contrato_item_id: '', origem_aditivo_id: v === '__todos__' || v === '__contrato__' ? '' : v })); }}>
                        <SelectTrigger><SelectValue placeholder="Filtrar por origem" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos os Itens</SelectItem>
                          <SelectItem value="__contrato__">Contrato Original</SelectItem>
                          {aditivos.map((a, idx) => (
                            <SelectItem key={a.id} value={a.id}>{`${idx + 1}º Termo Aditivo`} ({a.tipo})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Item do Contrato</Label>
                      <Select value={form.contrato_item_id} onValueChange={handleItemChange}>
                        <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                        <SelectContent>
                          {itens
                            .filter(i => {
                              if (origemFilter === '__todos__') return true;
                              if (origemFilter === '__contrato__') return !i.origem_aditivo_id;
                              return i.origem_aditivo_id === origemFilter;
                            })
                            .map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      <span className="text-muted-foreground text-[10px] mr-1">[{getOrigemLabel(i, aditivos)}]</span>
                      {i.descricao} ({i.unidade})
                    </SelectItem>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : pedidos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Nenhum pedido registrado</Card>
      ) : (
        <>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}>
                  <div className="flex items-center gap-1">
                    N.º Pedido
                    {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}
                  </div>
                </TableHead>
                <TableHead className="text-xs whitespace-nowrap">Descrição</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Qtd</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Vlr Unit</TableHead>
                <TableHead className="text-xs text-right whitespace-nowrap">Vlr Total</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Data</TableHead>
                <TableHead className="text-xs text-center whitespace-nowrap">Status</TableHead>
                <TableHead className="text-xs whitespace-nowrap">NF-e Financeiro</TableHead>
                {podeVerCustos && <TableHead className="text-xs text-right whitespace-nowrap">Custo Unit</TableHead>}
                {podeVerCustos && <TableHead className="text-xs text-right whitespace-nowrap">Custo Total</TableHead>}
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const sorted = sortOrder
                  ? [...pedidos].sort((a, b) => {
                      const cmp = a.numero_pedido.localeCompare(b.numero_pedido, 'pt-BR', { numeric: true });
                      return sortOrder === 'asc' ? cmp : -cmp;
                    })
                  : pedidos;
                return sorted.map(p => {
                const cfg = statusCfg[p.status] || statusCfg.pendente;
                const linkedNfs = nfsSync.filter(nf => nf.contrato_pedido_id === p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-mono font-medium whitespace-nowrap">{p.numero_pedido}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{p.descricao || '—'}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{p.quantidade}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{fmt(p.valor_unitario)}</TableCell>
                    <TableCell className="text-xs text-right font-medium whitespace-nowrap">{fmt(p.valor_total)}</TableCell>
                    <TableCell className="text-xs text-center whitespace-nowrap">{p.data_pedido ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {linkedNfs.length > 0 ? (
                        <div className="space-y-1">
                          {linkedNfs.map(nf => (
                            <Badge key={nf.id} variant="outline" className={`text-[10px] block w-fit ${
                              nf.status === 'autorizada' ? 'border-success/30 text-success' :
                              nf.status === 'rejeitada' ? 'border-destructive/30 text-destructive' :
                              'border-muted-foreground/30 text-muted-foreground'
                            }`}>
                              <FileText className="w-3 h-3 mr-1" />
                              {nf.numero_nf || 'Rascunho'} • {nf.tipo === 'saida' ? 'Saída' : 'Entrada'} {nf.valor_total ? `• ${fmt(nf.valor_total)}` : ''}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    {podeVerCustos && (
                      <TableCell className="text-xs text-right">
                        <CustoInlineEditor
                          initialValue={(p as any).custo_unitario || 0}
                          onSave={async (custo) => {
                            if (custo !== ((p as any).custo_unitario || 0)) {
                              await supabase.from('contrato_pedidos').update({ custo_unitario: custo } as any).eq('id', p.id);
                              load();
                            }
                          }}
                        />
                      </TableCell>
                    )}
                    {podeVerCustos && (
                      <TableCell className="text-xs text-right font-medium text-destructive">
                        {fmt((p as any).custo_total || 0)}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        {!p.nf_quitada && p.status === 'entregue' && (isFinanceiro || isAdmin) && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 px-2 text-[10px] text-success border-success/30 hover:bg-success/5"
                            onClick={() => openNfDialog(p)}
                            title="Registrar pagamento da NF-e e gerar comissão"
                          >
                            <DollarSign className="w-3 h-3 mr-1" /> NF Quitada
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(p)} title="Editar pedido">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              });
              })()}
            </TableBody>
          </Table>
        </div>

        {nfsSync.length > 0 && (
          <Card className="p-4 mt-4 border-accent/20">
            <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-accent" />
              Notas Fiscais Sincronizadas do Financeiro
              <Badge variant="outline" className="text-[10px]">{nfsSync.length} NFs</Badge>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">NFs Saída</p>
                <p className="text-sm font-bold">{nfsSync.filter(n => n.tipo === 'saida').length}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(nfsSync.filter(n => n.tipo === 'saida').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">NFs Entrada</p>
                <p className="text-sm font-bold">{nfsSync.filter(n => n.tipo === 'entrada').length}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(nfsSync.filter(n => n.tipo === 'entrada').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Autorizadas</p>
                <p className="text-sm font-bold text-success">{nfsSync.filter(n => n.status === 'autorizada').length}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Pendentes</p>
                <p className="text-sm font-bold text-warning">{nfsSync.filter(n => n.status !== 'autorizada' && n.status !== 'cancelada').length}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              As notas fiscais são emitidas e controladas pelo setor Financeiro. Acesse o módulo Financeiro para emitir ou editar NFs.
            </p>
          </Card>
        )}
        </>
      )}

      {/* NF Quitada — Diálogo do Financeiro */}
      <Dialog open={!!nfDialog} onOpenChange={v => { if (!v) setNfDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              Registrar Pagamento de NF-e
            </DialogTitle>
          </DialogHeader>
          {nfDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                <p><strong>Pedido:</strong> {nfDialog.numero_pedido}</p>
                <p><strong>Valor do Pedido:</strong> {fmt(nfDialog.valor_total)}</p>
                {nfDialog.descricao && <p><strong>Descrição:</strong> {nfDialog.descricao}</p>}
              </div>

              <div>
                <Label>Número da Nota Fiscal *</Label>
                <Input value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="NF-e 000.000.001" />
              </div>

              <div>
                <Label>Data do Pagamento *</Label>
                <Input type="date" value={nfData} onChange={e => setNfData(e.target.value)} />
              </div>

              <div>
                <Label>Valor Pago (R$) *</Label>
                <MoneyInput
                  value={Number(nfValorPago) || 0}
                  onValueChange={(v) => setNfValorPago(String(v))}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-xs text-muted-foreground">
                  Ao registrar o pagamento, o sistema calculará automaticamente a comissão do vendedor 
                  responsável pelo contrato com base na configuração de comissão vigente.
                </p>
              </div>

              <Button
                onClick={handleMarcarNfQuitada}
                disabled={solicitandoComissao || !nfNumero.trim() || !nfData || !(parseFloat(nfValorPago) > 0)}
                className="w-full bg-success hover:bg-success/90 text-success-foreground"
              >
                {solicitandoComissao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <DollarSign className="w-4 h-4 mr-1" />}
                Confirmar Pagamento e Gerar Comissão
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pré-Notas Fiscais */}
      {preNotas.length > 0 && (
        <Card className="p-4 border-primary/20">
          <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-primary" />
            Pré-Notas Fiscais Solicitadas
            <Badge variant="outline" className="text-[10px]">{preNotas.length}</Badge>
          </h4>
          <div className="space-y-2">
            {preNotas.map((pn: any) => {
              const statusMap: Record<string, { label: string; color: string }> = {
                pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
                em_revisao: { label: 'Em Revisão', color: 'bg-accent/10 text-accent' },
                aprovada: { label: 'Aprovada', color: 'bg-success/10 text-success' },
                rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
                devolvida: { label: 'Devolvida', color: 'bg-warning/10 text-warning' },
              };
              const st = statusMap[pn.status] || statusMap.pendente;
              return (
                <div key={pn.id} className="flex items-center justify-between p-2 rounded border bg-muted/30 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                    <span>{pn.natureza_operacao}</span>
                    <span className="font-medium">{fmt(pn.valor_total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{new Date(pn.created_at).toLocaleDateString('pt-BR')}</span>
                    {pn.motivo_devolucao && (
                      <Badge variant="outline" className="text-[10px] text-warning" title={pn.motivo_devolucao}>
                        <AlertTriangle className="w-3 h-3 mr-1" /> Devolvida
                      </Badge>
                    )}
                    {pn.motivo_rejeicao && (
                      <Badge variant="outline" className="text-[10px] text-destructive" title={pn.motivo_rejeicao}>
                        <XCircle className="w-3 h-3 mr-1" /> Rejeitada
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Gerar Pré-NF Dialog */}
      <GerarPreNotaDialog
        open={preNfDialogOpen}
        onOpenChange={setPreNfDialogOpen}
        contratoId={contratoId}
        pedidos={pedidos}
        itens={itens}
        onCreated={load}
      />

      {/* Edit Pedido Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingPedido(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> Editar Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N.o Documento</Label>
                <Input value={editForm.numero_pedido} onChange={e => setEditForm(f => ({ ...f, numero_pedido: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusCfg).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            {itens.length > 0 && (
              <div>
                <Label className="text-xs">Item do Contrato</Label>
                <Select value={editForm.contrato_item_id} onValueChange={v => {
                  const item = itens.find(i => i.id === v);
                  setEditForm(f => ({ ...f, contrato_item_id: v, valor_unitario: item ? String(item.valor_unitario) : f.valor_unitario }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {itens.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        <span className="text-muted-foreground text-[10px] mr-1">[{getOrigemLabel(i, aditivos)}]</span>
                        {i.descricao} ({fmt(i.valor_unitario)}/{i.unidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" value={editForm.quantidade} onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valor Unitário</Label>
                <Input type="number" step="0.01" value={editForm.valor_unitario} onChange={e => setEditForm(f => ({ ...f, valor_unitario: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data do Pedido</Label>
                <Input type="date" value={editForm.data_pedido} onChange={e => setEditForm(f => ({ ...f, data_pedido: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Data de Entrega</Label>
                <Input type="date" value={editForm.data_entrega} onChange={e => setEditForm(f => ({ ...f, data_entrega: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nota Fiscal</Label>
              <Input value={editForm.nota_fiscal} onChange={e => setEditForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
