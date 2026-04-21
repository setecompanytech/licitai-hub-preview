import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const formatInputBRL = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseBRLInput = (value: string): string => {
  const clean = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? '0' : String(num);
};
import {
  FileText, Plus, Search, Calendar, DollarSign, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, Building2, Loader2, Trash2,
  ArrowLeft, Package, ShoppingCart, BarChart3, FilePlus2, Paperclip, ScrollText
} from 'lucide-react';
import ContratoItens from '@/components/contratos/ContratoItens';
import ContratoPedidos from '@/components/contratos/ContratoPedidos';
import ContratoDashboard from '@/components/contratos/ContratoDashboard';
import ContratoArquivos from '@/components/contratos/ContratoArquivos';

import ImportarContratoPDF from '@/components/contratos/ImportarContratoPDF';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  vigente: { label: 'Vigente', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  vencendo: { label: 'Vencendo', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
  encerrado: { label: 'Encerrado', color: 'bg-muted text-muted-foreground', icon: Clock },
  suspenso: { label: 'Suspenso', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
};

type Contrato = {
  id: string; numero_contrato: string; objeto: string; orgao_contratante: string;
  valor_global: number; valor_consumido: number; saldo_remanescente: number;
  data_assinatura: string | null; data_inicio: string | null; data_fim: string | null;
  vigencia_meses: number | null; status: string; modalidade: string | null;
  uf: string | null; municipio: string | null; fiscal_nome: string | null;
  fiscal_email: string | null; fiscal_telefone: string | null; observacoes: string | null;
  tipo_documento: 'contrato' | 'ata_srp';
  ata_srp_id: string | null;
  numero_ata: string | null;
  validade_ata_meses: number | null;
  permite_carona: boolean | null;
};

export default function GestaoContratos() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'contrato' | 'ata_srp'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [form, setForm] = useState({
    tipo_documento: 'contrato' as 'contrato' | 'ata_srp',
    tipo_estrutura: 'itens' as 'itens' | 'lotes',
    ata_srp_id: '' as string,
    numero_ata: '',
    validade_ata_meses: '',
    permite_carona: true,
    numero_contrato: '', objeto: '', orgao_contratante: '',
    valor_global: '', valor_consumido: '0', data_assinatura: '',
    data_inicio: '', data_fim: '', vigencia_meses: '',
    status: 'vigente', modalidade: '', uf: '', municipio: '',
    fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '',
  });
  const [pendingItens, setPendingItens] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!user) return;
    loadContratos();
    const channel = supabase
      .channel('contratos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos', filter: `user_id=eq.${user.id}` }, () => loadContratos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadContratos = async () => {
    setLoading(true);
    const { data } = await supabase.from('contratos').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    const list = (data as any[]) || [];
    setContratos(list);
    if (selectedContrato) {
      const updated = list.find(c => c.id === selectedContrato.id);
      if (updated) setSelectedContrato(updated);
    }
    setLoading(false);
  };

  const atasDisponiveis = contratos.filter(c => c.tipo_documento === 'ata_srp');

  const resetForm = () => setForm({
    tipo_documento: 'contrato', tipo_estrutura: 'itens', ata_srp_id: '', numero_ata: '', validade_ata_meses: '', permite_carona: true,
    numero_contrato: '', objeto: '', orgao_contratante: '', valor_global: '', valor_consumido: '0',
    data_assinatura: '', data_inicio: '', data_fim: '', vigencia_meses: '',
    status: 'vigente', modalidade: '', uf: '', municipio: '',
    fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '',
  });

  const handleSave = async () => {
    if (!form.numero_contrato || !form.objeto || !form.orgao_contratante) {
      toast.error('Preencha os campos obrigatórios'); return;
    }
    setSaving(true);
    const val = parseFloat(form.valor_global) || 0;
    const consumed = parseFloat(form.valor_consumido) || 0;
    const { data: inserted, error } = await supabase.from('contratos').insert({
      user_id: user!.id,
      tipo_documento: form.tipo_documento,
      tipo_estrutura: form.tipo_estrutura,
      ata_srp_id: form.tipo_documento === 'contrato' && form.ata_srp_id ? form.ata_srp_id : null,
      numero_ata: form.tipo_documento === 'ata_srp' ? (form.numero_ata || form.numero_contrato) : null,
      validade_ata_meses: form.tipo_documento === 'ata_srp' && form.validade_ata_meses ? parseInt(form.validade_ata_meses) : null,
      permite_carona: form.tipo_documento === 'ata_srp' ? form.permite_carona : null,
      numero_contrato: form.numero_contrato, objeto: form.objeto,
      orgao_contratante: form.orgao_contratante, valor_global: val, valor_global_original: val, valor_consumido: consumed,
      data_assinatura: form.data_assinatura || null, data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null, vigencia_meses: parseInt(form.vigencia_meses) || null,
      status: form.status, modalidade: form.modalidade || null, uf: form.uf || null,
      municipio: form.municipio || null, fiscal_nome: form.fiscal_nome || null,
      fiscal_email: form.fiscal_email || null, fiscal_telefone: form.fiscal_telefone || null,
      observacoes: form.observacoes || null,
    } as any).select('id').single();
    setSaving(false);
    if (error) { console.error('Erro ao salvar:', error); toast.error('Erro ao salvar', { description: error.message }); return; }

    if (inserted && pendingItens.length > 0) {
      const itensToInsert = pendingItens.map(item => ({
        contrato_id: inserted.id,
        user_id: user!.id,
        descricao: item.descricao || 'Sem descrição',
        unidade: item.unidade || 'UN',
        quantidade_contratada: item.quantidade || 0,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.valor_total || (item.quantidade || 0) * (item.valor_unitario || 0),
        saldo_quantitativo: item.quantidade || 0,
        saldo_financeiro: item.valor_total || (item.quantidade || 0) * (item.valor_unitario || 0),
        codigo_item: item.codigo_item || null,
        numero_lote: form.tipo_estrutura === 'lotes' ? (item.numero_lote || item.lote || null) : null,
        descricao_lote: form.tipo_estrutura === 'lotes' ? (item.descricao_lote || null) : null,
      }));
      const { error: itensError } = await supabase.from('contrato_itens').insert(itensToInsert as any);
      if (itensError) {
        console.error('Erro ao salvar itens:', itensError);
        toast.error('Documento salvo, mas houve erro ao importar os itens');
      } else {
        toast.success(`${form.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato'} cadastrado com ${pendingItens.length} itens!`);
      }
      setPendingItens([]);
    } else {
      toast.success(`${form.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato'} cadastrado!`);
    }

    setDialogOpen(false);
    resetForm();
    loadContratos();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contratos').delete().eq('id', id);
    toast.success('Excluído');
    if (selectedContrato?.id === id) setSelectedContrato(null);
    loadContratos();
  };

  const handleImportExtracted = (data: any, opts?: { tipo_estrutura?: 'itens' | 'lotes' }) => {
    const tipoEstrutura = opts?.tipo_estrutura || 'itens';
    const itensNormalizados = Array.isArray(data.itens)
      ? data.itens
          .map((item: any, index: number) => {
            const quantidade = Number(item.quantidade);
            const valorUnitario = Number(item.valor_unitario);
            const valorTotalInformado = Number(item.valor_total);
            const valorTotal = Number.isFinite(valorTotalInformado)
              ? valorTotalInformado
              : (Number.isFinite(quantidade) && Number.isFinite(valorUnitario) ? quantidade * valorUnitario : 0);
            return {
              codigo_item: item.codigo_item || String(index + 1),
              descricao: item.descricao || '',
              quantidade: Number.isFinite(quantidade) ? quantidade : 0,
              unidade: item.unidade || 'UN',
              valor_unitario: Number.isFinite(valorUnitario) ? valorUnitario : 0,
              valor_total: valorTotal,
              numero_lote: tipoEstrutura === 'lotes' ? (item.numero_lote || item.lote || null) : null,
              descricao_lote: tipoEstrutura === 'lotes' ? (item.descricao_lote || null) : null,
            };
          })
          .filter((item: any) => item.descricao.trim().length > 0)
      : [];

    setForm(f => ({
      ...f,
      tipo_estrutura: tipoEstrutura,
      numero_contrato: data.numero_contrato || '',
      objeto: data.objeto || '',
      orgao_contratante: data.orgao_contratante || '',
      valor_global: data.valor_global != null ? String(data.valor_global) : '',
      valor_consumido: '0',
      data_assinatura: data.data_assinatura || '',
      data_inicio: data.data_inicio || '',
      data_fim: data.data_fim || '',
      vigencia_meses: data.vigencia_meses != null ? String(data.vigencia_meses) : '',
      status: 'vigente',
      modalidade: data.modalidade || '',
      uf: data.uf || '',
      municipio: data.municipio || '',
      fiscal_nome: data.fiscal_nome || '',
      fiscal_email: data.fiscal_email || '',
      fiscal_telefone: data.fiscal_telefone || '',
      observacoes: data.observacoes || '',
    }));

    setPendingItens(itensNormalizados);
    if (itensNormalizados.length > 0) {
      const sufixo = tipoEstrutura === 'lotes' ? 'lotes' : 'itens';
      toast.info(`${itensNormalizados.length} ${sufixo} extraídos serão importados ao salvar.`);
    }
    setDialogOpen(true);
  };

  // ═══ DETAIL VIEW ═══
  if (selectedContrato) {
    const c = selectedContrato;
    const isAta = c.tipo_documento === 'ata_srp';
    const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
    const cfg = statusConfig[c.status] || statusConfig.vigente;
    const ataOrigem = c.ata_srp_id ? contratos.find(x => x.id === c.ata_srp_id) : null;
    return (
      <AppLayout>
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedContrato(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isAta && <Badge className="bg-accent/15 text-accent border-accent/30 text-[10px]"><ScrollText className="w-3 h-3 mr-1" />ATA SRP</Badge>}
                <h1 className="text-xl font-bold">{c.numero_contrato}</h1>
                <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                {isAta && c.permite_carona && <Badge variant="outline" className="text-[10px]">Permite carona</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.objeto}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao_contratante}</span>
                {c.uf && <span>{c.uf}{c.municipio ? `/${c.municipio}` : ''}</span>}
                {ataOrigem && (
                  <button
                    onClick={() => setSelectedContrato(ataOrigem)}
                    className="flex items-center gap-1 text-accent hover:underline"
                    title="Abrir ATA SRP de origem"
                  >
                    <ScrollText className="w-3 h-3" />
                    Oriundo da ATA {ataOrigem.numero_ata || ataOrigem.numero_contrato}
                  </button>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor Global</p>
              <p className="text-lg font-bold">{formatCurrency(c.valor_global)}</p>
              <Progress value={Math.min(pct, 100)} className="h-1.5 w-40 mt-1" />
              <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% consumido</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4" onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="itens"><Package className="w-3.5 h-3.5 mr-1" /> Itens/Lotes</TabsTrigger>
            {!isAta && <TabsTrigger value="pedidos"><ShoppingCart className="w-3.5 h-3.5 mr-1" /> Pedidos</TabsTrigger>}
            {isAta && (
              <TabsTrigger value="contratos-derivados">
                <FilePlus2 className="w-3.5 h-3.5 mr-1" /> Contratos derivados
              </TabsTrigger>
            )}
            <TabsTrigger value="contratos-aditivos"><FilePlus2 className="w-3.5 h-3.5 mr-1" /> {isAta ? 'Apostilamentos / Arquivos' : 'ATA SRP, Contratos e Aditivos'}</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><ContratoDashboard contratoId={c.id} /></TabsContent>
          <TabsContent value="itens"><ContratoItens contratoId={c.id} key={activeTab === 'itens' ? 'itens-active' : 'itens'} /></TabsContent>
          {!isAta && <TabsContent value="pedidos"><ContratoPedidos contratoId={c.id} /></TabsContent>}
          {isAta && (
            <TabsContent value="contratos-derivados">
              <ContratosDerivadosList ataId={c.id} contratos={contratos} onSelect={setSelectedContrato} />
            </TabsContent>
          )}
          <TabsContent value="contratos-aditivos">
            <ContratoArquivos contratoId={c.id} />
          </TabsContent>
        </Tabs>
      </AppLayout>
    );
  }

  // ═══ LIST VIEW ═══
  const filtered = contratos.filter(c => {
    const matchSearch = !search || c.objeto.toLowerCase().includes(search.toLowerCase()) || c.numero_contrato.toLowerCase().includes(search.toLowerCase()) || c.orgao_contratante.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchTipo = tipoFilter === 'all' || c.tipo_documento === tipoFilter;
    return matchSearch && matchStatus && matchTipo;
  });
  const soContratos = contratos.filter(c => c.tipo_documento !== 'ata_srp');
  const soAtas = contratos.filter(c => c.tipo_documento === 'ata_srp');
  const totalValor = soContratos.reduce((s, c) => s + c.valor_global, 0);
  const totalSaldo = soContratos.reduce((s, c) => s + (c.saldo_remanescente || 0), 0);
  const vencendo = soContratos.filter(c => { if (!c.data_fim) return false; const d = (new Date(c.data_fim).getTime() - Date.now()) / 86400000; return d > 0 && d <= 60; }).length;

  const isAtaForm = form.tipo_documento === 'ata_srp';

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Contratos e ATAs SRP</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle ATAs de Registro de Preços, contratos derivados, aditivos, itens e pedidos</p>
        </div>
        <div className="flex gap-2">
          <ImportarContratoPDF onExtracted={handleImportExtracted} />
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { resetForm(); setPendingItens([]); } }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Novo</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar {isAtaForm ? 'ATA SRP' : 'Contrato Administrativo'}</DialogTitle></DialogHeader>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <div>
                <Label className="text-xs">Tipo de Documento *</Label>
                <Select value={form.tipo_documento} onValueChange={(v: 'contrato' | 'ata_srp') => setForm(f => ({ ...f, tipo_documento: v, ata_srp_id: v === 'ata_srp' ? '' : f.ata_srp_id }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato Administrativo</SelectItem>
                    <SelectItem value="ata_srp">ATA SRP — Sistema de Registro de Preços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estrutura *</Label>
                <Select value={form.tipo_estrutura} onValueChange={(v: 'itens' | 'lotes') => setForm(f => ({ ...f, tipo_estrutura: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="itens">Itens (individuais)</SelectItem>
                    <SelectItem value="lotes">Lotes (grupos de itens)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground md:col-span-2">
                {isAtaForm
                  ? 'A ATA SRP funciona como base de preços/quantidades. Contratos derivados (incluindo carona) consumirão seu saldo automaticamente.'
                  : 'Contrato administrativo. Pode opcionalmente vincular-se a uma ATA SRP cadastrada.'}
                {' '}
                {form.tipo_estrutura === 'lotes'
                  ? 'Modo Lotes: itens serão agrupados por lote, permitindo controle de pedidos por lote.'
                  : 'Modo Itens: cada item é gerenciado individualmente.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><Label>{isAtaForm ? 'Nº ATA *' : 'Nº Contrato *'}</Label><Input value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))} placeholder={isAtaForm ? 'ATA-001/2025' : 'CT-001/2025'} /></div>
              <div><Label>Órgão {isAtaForm ? 'Gerenciador' : 'Contratante'} *</Label><Input value={form.orgao_contratante} onChange={e => setForm(f => ({ ...f, orgao_contratante: e.target.value }))} /></div>
              <div className="md:col-span-2"><Label>Objeto *</Label><Textarea value={form.objeto} onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))} rows={2} /></div>

              {isAtaForm && (
                <>
                  <div><Label>Validade da ATA (meses)</Label><Input type="number" value={form.validade_ata_meses} onChange={e => setForm(f => ({ ...f, validade_ata_meses: e.target.value }))} placeholder="12" /></div>
                  <div className="flex items-center gap-3 mt-6">
                    <Switch id="permite-carona" checked={form.permite_carona} onCheckedChange={v => setForm(f => ({ ...f, permite_carona: v }))} />
                    <Label htmlFor="permite-carona" className="text-sm cursor-pointer">Permite carona / adesão</Label>
                  </div>
                </>
              )}

              {!isAtaForm && atasDisponiveis.length > 0 && (
                <div className="md:col-span-2">
                  <Label>ATA SRP de origem (opcional)</Label>
                  <Select value={form.ata_srp_id || 'none'} onValueChange={v => setForm(f => ({ ...f, ata_srp_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Não vinculado a ATA" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Não vinculado —</SelectItem>
                      {atasDisponiveis.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.numero_ata || a.numero_contrato} — {a.orgao_contratante}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Os itens deste contrato poderão consumir o saldo da ATA selecionada.</p>
                </div>
              )}

              <div><Label>Valor Global (R$)</Label><Input inputMode="decimal" value={form.valor_global ? formatInputBRL(form.valor_global) : ''} onChange={e => setForm(f => ({ ...f, valor_global: parseBRLInput(e.target.value) }))} placeholder="0,00" /></div>
              <div><Label>Valor Consumido (R$)</Label><Input inputMode="decimal" value={form.valor_consumido ? formatInputBRL(form.valor_consumido) : ''} onChange={e => setForm(f => ({ ...f, valor_consumido: parseBRLInput(e.target.value) }))} placeholder="0,00" /></div>
              <div><Label>Data Assinatura</Label><Input type="date" value={form.data_assinatura} onChange={e => {
                const assinatura = e.target.value;
                const updates: any = { data_assinatura: assinatura };
                if (assinatura) {
                  const d = new Date(assinatura + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  updates.data_inicio = d.toISOString().split('T')[0];
                  if (form.vigencia_meses) {
                    const fim = new Date(d);
                    fim.setMonth(fim.getMonth() + parseInt(form.vigencia_meses));
                    updates.data_fim = fim.toISOString().split('T')[0];
                  }
                }
                setForm(f => ({ ...f, ...updates }));
              }} /></div>
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} readOnly className="bg-muted/50" /></div>
              <div><Label>Data Fim</Label><Input type="date" value={form.data_fim} readOnly className="bg-muted/50" /></div>
              <div><Label>Vigência (meses)</Label><Input type="number" value={form.vigencia_meses} onChange={e => {
                const meses = e.target.value;
                const updates: any = { vigencia_meses: meses };
                if (meses && form.data_inicio) {
                  const fim = new Date(form.data_inicio + 'T00:00:00');
                  fim.setMonth(fim.getMonth() + parseInt(meses));
                  updates.data_fim = fim.toISOString().split('T')[0];
                }
                setForm(f => ({ ...f, ...updates }));
              }} /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="vencendo">Vencendo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem></SelectContent></Select></div>
              <div><Label>Modalidade</Label><Input value={form.modalidade} onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))} placeholder="Pregão Eletrônico" /></div>
              <div><Label>UF</Label><Input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} maxLength={2} /></div>
              <div><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
              <div><Label>Fiscal - Nome</Label><Input value={form.fiscal_nome} onChange={e => setForm(f => ({ ...f, fiscal_nome: e.target.value }))} /></div>
              <div><Label>Fiscal - E-mail</Label><Input value={form.fiscal_email} onChange={e => setForm(f => ({ ...f, fiscal_email: e.target.value }))} /></div>
              <div><Label>Fiscal - Telefone</Label><Input value={form.fiscal_telefone} onChange={e => setForm(f => ({ ...f, fiscal_telefone: e.target.value }))} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            </div>
            {pendingItens.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-sm font-medium flex items-center gap-2 text-accent">
                  <Package className="w-4 h-4" /> {pendingItens.length} itens extraídos do PDF
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Serão cadastrados automaticamente na aba "Itens" ao salvar.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setDialogOpen(false); setPendingItens([]); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Salvar {isAtaForm ? 'ATA' : 'Contrato'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" /> Contratos</div><p className="text-2xl font-bold">{soContratos.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ScrollText className="w-4 h-4" /> ATAs SRP</div><p className="text-2xl font-bold">{soAtas.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Valor Total</div><p className="text-2xl font-bold">{formatCurrency(totalValor)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-4 h-4" /> Saldo Total</div><p className="text-2xl font-bold text-success">{formatCurrency(totalSaldo)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="w-4 h-4" /> Vencendo 60d</div><p className="text-2xl font-bold text-warning">{vencendo}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por número, objeto ou órgão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={tipoFilter} onValueChange={(v: any) => setTipoFilter(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="contrato">Contratos Administrativos</SelectItem>
            <SelectItem value="ata_srp">Apenas ATAs SRP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="vencendo">Vencendo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem></SelectContent></Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum registro encontrado</p></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const isAta = c.tipo_documento === 'ata_srp';
            const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
            const cfg = statusConfig[c.status] || statusConfig.vigente;
            const Icon = cfg.icon;
            const dias = c.data_fim ? Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / 86400000) : null;
            return (
              <Card key={c.id} className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${isAta ? 'border-accent/40 bg-accent/[0.03]' : ''}`} onClick={() => setSelectedContrato(c)}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isAta && <Badge className="bg-accent/15 text-accent border-accent/30 text-[10px]"><ScrollText className="w-3 h-3 mr-1" />ATA SRP</Badge>}
                      <span className="text-sm font-bold text-accent">{c.numero_contrato}</span>
                      <Badge className={`${cfg.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                      {dias !== null && dias <= 60 && dias > 0 && <Badge variant="outline" className="text-[10px] text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" />{dias}d</Badge>}
                      {!isAta && pct >= 80 && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Saldo baixo</Badge>}
                      {c.ata_srp_id && <Badge variant="outline" className="text-[10px] text-accent border-accent/30">Origem: ATA</Badge>}
                    </div>
                    <p className="text-sm font-medium line-clamp-1">{c.objeto}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao_contratante}</span>
                      {c.data_fim && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Até {new Date(c.data_fim).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{isAta ? 'Saldo registrado' : 'Consumido'}: {formatCurrency(c.valor_consumido)}</span>
                        <span>Saldo: {formatCurrency(c.saldo_remanescente || 0)}</span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-2" />
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

// ═══ Contratos derivados de uma ATA SRP ═══
function ContratosDerivadosList({ ataId, contratos, onSelect }: { ataId: string; contratos: Contrato[]; onSelect: (c: Contrato) => void }) {
  const derivados = contratos.filter(c => c.ata_srp_id === ataId && c.tipo_documento === 'contrato');
  const totalConsumido = derivados.reduce((s, c) => s + (c.valor_global || 0), 0);

  if (derivados.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FilePlus2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum contrato derivado desta ATA ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Ao criar um Contrato Administrativo, vincule-o a esta ATA para que os saldos sejam debitados automaticamente.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-accent/5 border-accent/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Contratos derivados</p>
            <p className="text-2xl font-bold">{derivados.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Valor total consumido</p>
            <p className="text-2xl font-bold text-accent">{formatCurrency(totalConsumido)}</p>
          </div>
        </div>
      </Card>
      <div className="space-y-2">
        {derivados.map(c => (
          <Card key={c.id} className="p-3 hover:shadow-md cursor-pointer" onClick={() => onSelect(c)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-accent">{c.numero_contrato}</span>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.objeto}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-sm font-semibold">{formatCurrency(c.valor_global)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
