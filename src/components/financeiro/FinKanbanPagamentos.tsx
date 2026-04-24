import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { Plus, Loader2, AlertTriangle, Clock, Calendar, CheckCircle2, XCircle, FileCode2, Barcode, GripVertical } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/styles/financeiro';
import { parseNFeXML, type NFeData } from '@/lib/parseNFe';

interface CPRow {
  id: string;
  favorecido_nome: string | null;
  valor_documento: number;
  data_vencimento: string;
  status: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  categoria_id: string | null;
  conta_corrente_id: string | null;
  observacoes: string | null;
  numero_documento: string | null;
  origem: string | null;
}

interface Column {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const columns: Column[] = [
  { id: 'vencidas', label: 'Vencidas', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-t-red-500' },
  { id: 'hoje', label: 'Vence Hoje', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-t-amber-500' },
  { id: 'semana', label: 'Próx. 7 dias', icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/20', borderColor: 'border-t-orange-500' },
  { id: 'aberto', label: 'A Vencer', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20', borderColor: 'border-t-blue-500' },
  { id: 'pago', label: 'Pagas', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20', borderColor: 'border-t-emerald-500' },
];

export default function FinKanbanPagamentos() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [contas, setContas] = useState<CPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pessoas, setPessoas] = useState<{ id: string; razao_social: string }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([]);
  const [contasBanc, setContasBanc] = useState<{ id: string; nome: string }[]>([]);
  const [inputMode, setInputMode] = useState<'manual' | 'xml' | 'barras'>('manual');
  const [dragItem, setDragItem] = useState<string | null>(null);

  const [form, setForm] = useState({
    favorecido_nome: '', valor_documento: '', data_vencimento: '',
    favorecido_id: '', categoria_id: '', conta_corrente_id: '',
    parcela_total: '1', observacoes: '', numero_documento: '', descricao: '',
    codigo_barras: '', xml_content: '',
  });

  const [payItem, setPayItem] = useState<CPRow | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payValue, setPayValue] = useState('');
  const [payContaId, setPayContaId] = useState('');

  useEffect(() => { if (empresaAtiva?.id) loadAll(); }, [empresaAtiva?.id]);

  async function loadAll() {
    setLoading(true);
    const eid = empresaAtiva!.id;
    const [cpRes, pesRes, catRes, ctRes] = await Promise.all([
      supabase.from('fin_contas_pagar').select('id, favorecido_nome, valor_documento, data_vencimento, status, parcela_numero, parcela_total, categoria_id, conta_corrente_id, observacoes, numero_documento, origem').eq('empresa_id', eid).order('data_vencimento'),
      supabase.from('fin_pessoas').select('id, razao_social').eq('empresa_id', eid),
      supabase.from('fin_categorias').select('id, nome').eq('empresa_id', eid).eq('tipo', 'despesa'),
      supabase.from('fin_contas').select('id, nome').eq('empresa_id', eid).eq('ativo', true),
    ]);
    setContas((cpRes.data || []) as CPRow[]);
    setPessoas(pesRes.data || []);
    setCategorias(catRes.data || []);
    setContasBanc(ctRes.data || []);
    setLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];
  const in7days = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })();

  const grouped = useMemo(() => {
    const result: Record<string, CPRow[]> = { vencidas: [], hoje: [], semana: [], aberto: [], pago: [] };
    contas.forEach((c) => {
      if (c.status === 'pago') result.pago.push(c);
      else if (c.status === 'cancelado') return;
      else if (c.data_vencimento < today) result.vencidas.push(c);
      else if (c.data_vencimento === today) result.hoje.push(c);
      else if (c.data_vencimento <= in7days) result.semana.push(c);
      else result.aberto.push(c);
    });
    return result;
  }, [contas, today, in7days]);

  function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const xml = ev.target?.result as string;
        const nfe = parseNFeXML(xml);
        setForm(f => ({
          ...f,
          favorecido_nome: nfe.nome_emitente,
          valor_documento: String(nfe.v_nf),
          data_vencimento: nfe.data_emissao ? nfe.data_emissao.split('T')[0] : '',
          numero_documento: `NF-e ${nfe.numero_nf}/${nfe.serie}`,
          descricao: `NF-e ${nfe.chave_acesso}`,
          xml_content: xml,
        }));
        setInputMode('manual');
        toast.success('XML importado com sucesso');
      } catch { toast.error('XML inválido'); }
    };
    reader.readAsText(file);
  }

  function handleBarcode() {
    const code = form.codigo_barras.replace(/\s/g, '');
    if (code.length < 44) { toast.error('Código de barras inválido'); return; }
    // Extract due date from positions 33-40 (YYYYMMDD factor from 07/10/1997)
    const fator = parseInt(code.substring(33, 37));
    const valorCentavos = parseInt(code.substring(37, 47)) || 0;
    const baseDate = new Date(1997, 9, 7);
    baseDate.setDate(baseDate.getDate() + fator);
    setForm(f => ({
      ...f,
      valor_documento: String(valorCentavos / 100),
      data_vencimento: baseDate.toISOString().split('T')[0],
      numero_documento: code,
    }));
    setInputMode('manual');
    toast.success('Boleto decodificado');
  }

  async function handleCreate() {
    if (!form.favorecido_nome || !form.valor_documento || !form.data_vencimento) {
      toast.error('Preencha nome, valor e vencimento'); return;
    }
    setSaving(true);
    const parcelas = Math.max(1, parseInt(form.parcela_total) || 1);
    const valorTotal = parseFloat(form.valor_documento.replace(',', '.')) || 0;
    const valorParcela = valorTotal / parcelas;

    const rows = Array.from({ length: parcelas }, (_, i) => {
      const venc = new Date(form.data_vencimento + 'T12:00:00');
      venc.setMonth(venc.getMonth() + i);
      return {
        empresa_id: empresaAtiva!.id, user_id: user!.id,
        favorecido_nome: parcelas > 1 ? `${form.favorecido_nome} (${i + 1}/${parcelas})` : form.favorecido_nome,
        valor_documento: valorParcela,
        data_vencimento: venc.toISOString().split('T')[0],
        favorecido_id: form.favorecido_id || null,
        categoria_id: form.categoria_id || null,
        conta_corrente_id: form.conta_corrente_id || null,
        parcela_numero: i + 1, parcela_total: parcelas,
        observacoes: form.observacoes || null,
        numero_documento: form.numero_documento || null,
        descricao: form.descricao || null,
        status: 'aberto',
      };
    });

    const { error } = await supabase.from('fin_contas_pagar').insert(rows);
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`${parcelas} parcela(s) criada(s)`);
    setShowNew(false);
    resetForm();
    loadAll();
  }

  function resetForm() {
    setForm({ favorecido_nome: '', valor_documento: '', data_vencimento: '', favorecido_id: '', categoria_id: '', conta_corrente_id: '', parcela_total: '1', observacoes: '', numero_documento: '', descricao: '', codigo_barras: '', xml_content: '' });
    setInputMode('manual');
  }

  async function handlePay() {
    if (!payItem || !payDate) return;
    setSaving(true);
    const { error } = await supabase.from('fin_contas_pagar')
      .update({ status: 'pago', data_pagamento: payDate, valor_pago: parseFloat(payValue.replace(',', '.')) || payItem.valor_documento, conta_corrente_id: payContaId || payItem.conta_corrente_id })
      .eq('id', payItem.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Baixa realizada');
    setPayItem(null);
    loadAll();
  }

  async function handleDrop(targetCol: string, itemId: string) {
    if (targetCol === 'pago') {
      const item = contas.find(c => c.id === itemId);
      if (item) {
        setPayItem(item);
        setPayDate(today);
        setPayValue(String(item.valor_documento));
        setPayContaId(item.conta_corrente_id || '');
      }
    }
    setDragItem(null);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Kanban de Pagamentos</h1>
          <p className="text-sm text-muted-foreground">Arraste contas entre colunas ou clique para dar baixa</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Conta a Pagar</Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {columns.map(col => {
          const items = grouped[col.id] || [];
          const total = items.reduce((s, c) => s + c.valor_documento, 0);
          return (
            <Card key={col.id} className={`${col.bgColor} border-t-2 ${col.borderColor}`}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <col.icon className={`w-3.5 h-3.5 ${col.color}`} />
                  <span className="text-xs font-medium">{col.label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{fmtMoney(total)}</p>
                  <p className="text-[10px] text-muted-foreground">{items.length} título(s)</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-start">
        {columns.map((col) => {
          const items = grouped[col.id] || [];
          return (
            <div
              key={col.id}
              className={`rounded-lg border p-2.5 ${col.bgColor} min-h-[250px] transition-all ${dragItem ? 'ring-1 ring-primary/20' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragItem && handleDrop(col.id, dragItem)}
            >
              <div className="flex items-center gap-1.5 mb-2.5 px-1">
                <col.icon className={`w-3.5 h-3.5 ${col.color}`} />
                <span className="text-xs font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    draggable
                    onDragStart={() => setDragItem(item.id)}
                    onDragEnd={() => setDragItem(null)}
                    className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragItem === item.id ? 'opacity-50 scale-95' : ''}`}
                    onClick={() => {
                      if (item.status !== 'pago') {
                        setPayItem(item);
                        setPayDate(today);
                        setPayValue(String(item.valor_documento));
                        setPayContaId(item.conta_corrente_id || '');
                      }
                    }}
                  >
                    <CardContent className="p-2.5 space-y-1">
                      <div className="flex items-start gap-1">
                        <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                        <p className="text-xs font-medium line-clamp-2 flex-1">{item.favorecido_nome || item.numero_documento || '—'}</p>
                      </div>
                      <div className="flex items-center justify-between pl-4">
                        <span className="text-xs font-bold">{fmtMoney(item.valor_documento)}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(item.data_vencimento)}</span>
                      </div>
                      {item.parcela_total && item.parcela_total > 1 && (
                        <span className="text-[10px] text-muted-foreground pl-4">Parcela {item.parcela_numero}/{item.parcela_total}</span>
                      )}
                      {item.origem && item.origem !== 'manual' && (
                        <Badge variant="outline" className="text-[9px] ml-4">{item.origem === 'xml_nfe' ? 'XML' : item.origem === 'pedido_contrato' ? 'Pedido' : item.origem}</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {items.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-6">Nenhuma conta</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nova Conta a Pagar - 3 métodos */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="manual">✏️ Manual</TabsTrigger>
              <TabsTrigger value="xml"><FileCode2 className="w-3.5 h-3.5 mr-1" /> XML NF-e</TabsTrigger>
              <TabsTrigger value="barras"><Barcode className="w-3.5 h-3.5 mr-1" /> Boleto</TabsTrigger>
            </TabsList>
            <TabsContent value="xml" className="mt-3">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileCode2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Arraste ou selecione o XML da NF-e</p>
                <Input type="file" accept=".xml" onChange={handleXmlUpload} />
              </div>
            </TabsContent>
            <TabsContent value="barras" className="mt-3 space-y-3">
              <div>
                <Label>Código de Barras / Linha Digitável</Label>
                <Input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} placeholder="Cole aqui o código de barras do boleto" />
              </div>
              <Button variant="outline" className="w-full" onClick={handleBarcode}>Decodificar Boleto</Button>
            </TabsContent>
            <TabsContent value="manual" className="mt-0" />
          </Tabs>

          <div className="grid gap-3 mt-2">
            <div>
              <Label>Favorecido *</Label>
              <Input value={form.favorecido_nome} onChange={(e) => setForm({ ...form, favorecido_nome: e.target.value })} placeholder="Ex: Fornecedor ABC" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Valor (R$) *</Label><MoneyInput value={Number(form.valor_documento) || 0} onValueChange={(v) => setForm({ ...form, valor_documento: String(v) })} /></div>
              <div><Label>Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Parcelas</Label><Input type="number" min={1} value={form.parcela_total} onChange={(e) => setForm({ ...form, parcela_total: e.target.value })} /></div>
              <div><Label>Nº Documento</Label><Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta Bancária</Label>
                <Select value={form.conta_corrente_id} onValueChange={(v) => setForm({ ...form, conta_corrente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contasBanc.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição adicional" /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Baixa */}
      <Dialog open={!!payItem} onOpenChange={() => setPayItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {payItem && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{payItem.favorecido_nome || payItem.numero_documento}</p>
              <p className="text-lg font-bold">{fmtMoney(payItem.valor_documento)}</p>
              <div><Label>Data do Pagamento *</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
              <div><Label>Valor Pago (R$)</Label><MoneyInput value={Number(payValue) || 0} onValueChange={(v) => setPayValue(String(v))} /></div>
              <div>
                <Label>Conta de Saída</Label>
                <Select value={payContaId} onValueChange={setPayContaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{contasBanc.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayItem(null)}>Cancelar</Button>
            <Button onClick={handlePay} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar Baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
