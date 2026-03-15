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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, Calendar, DollarSign, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, Building2, Loader2, Trash2,
  ArrowLeft, Package, ShoppingCart, Receipt, BarChart3
} from 'lucide-react';
import ContratoItens from '@/components/contratos/ContratoItens';
import ContratoPedidos from '@/components/contratos/ContratoPedidos';
import ContratoCustos from '@/components/contratos/ContratoCustos';
import ContratoDashboard from '@/components/contratos/ContratoDashboard';
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
};

export default function GestaoContratos() {
  const { user } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [form, setForm] = useState({
    numero_contrato: '', objeto: '', orgao_contratante: '',
    valor_global: '', valor_consumido: '0', data_assinatura: '',
    data_inicio: '', data_fim: '', vigencia_meses: '',
    status: 'vigente', modalidade: '', uf: '', municipio: '',
    fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '',
  });

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
    // Refresh selected contrato if it exists
    if (selectedContrato) {
      const updated = list.find(c => c.id === selectedContrato.id);
      if (updated) setSelectedContrato(updated);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.numero_contrato || !form.objeto || !form.orgao_contratante) {
      toast.error('Preencha os campos obrigatórios'); return;
    }
    setSaving(true);
    const val = parseFloat(form.valor_global) || 0;
    const consumed = parseFloat(form.valor_consumido) || 0;
    const { error } = await supabase.from('contratos').insert({
      user_id: user!.id, numero_contrato: form.numero_contrato, objeto: form.objeto,
      orgao_contratante: form.orgao_contratante, valor_global: val, valor_consumido: consumed,
      saldo_remanescente: val - consumed,
      data_assinatura: form.data_assinatura || null, data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null, vigencia_meses: parseInt(form.vigencia_meses) || null,
      status: form.status, modalidade: form.modalidade || null, uf: form.uf || null,
      municipio: form.municipio || null, fiscal_nome: form.fiscal_nome || null,
      fiscal_email: form.fiscal_email || null, fiscal_telefone: form.fiscal_telefone || null,
      observacoes: form.observacoes || null,
    } as any);
    setSaving(false);
    if (error) { console.error('Erro ao salvar contrato:', error); toast.error('Erro ao salvar contrato', { description: error.message }); return; }
    toast.success('Contrato cadastrado!');
    setDialogOpen(false);
    setForm({ numero_contrato: '', objeto: '', orgao_contratante: '', valor_global: '', valor_consumido: '0', data_assinatura: '', data_inicio: '', data_fim: '', vigencia_meses: '', status: 'vigente', modalidade: '', uf: '', municipio: '', fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '' });
    loadContratos();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contratos').delete().eq('id', id);
    toast.success('Contrato excluído');
    if (selectedContrato?.id === id) setSelectedContrato(null);
    loadContratos();
  };

  const handleImportExtracted = (data: any) => {
    setForm({
      numero_contrato: data.numero_contrato || '',
      objeto: data.objeto || '',
      orgao_contratante: data.orgao_contratante || '',
      valor_global: data.valor_global?.toString() || '',
      valor_consumido: '0',
      data_assinatura: data.data_assinatura || '',
      data_inicio: data.data_inicio || '',
      data_fim: data.data_fim || '',
      vigencia_meses: data.vigencia_meses?.toString() || '',
      status: 'vigente',
      modalidade: data.modalidade || '',
      uf: data.uf || '',
      municipio: data.municipio || '',
      fiscal_nome: data.fiscal_nome || '',
      fiscal_email: data.fiscal_email || '',
      fiscal_telefone: data.fiscal_telefone || '',
      observacoes: data.observacoes || '',
    });
    setDialogOpen(true);
  };

  // ═══ DETAIL VIEW ═══
  if (selectedContrato) {
    const c = selectedContrato;
    const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
    const cfg = statusConfig[c.status] || statusConfig.vigente;
    return (
      <AppLayout>
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedContrato(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar aos Contratos
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{c.numero_contrato}</h1>
                <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.objeto}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao_contratante}</span>
                {c.uf && <span>{c.uf}{c.municipio ? `/${c.municipio}` : ''}</span>}
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

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="itens"><Package className="w-3.5 h-3.5 mr-1" /> Itens</TabsTrigger>
            <TabsTrigger value="pedidos"><ShoppingCart className="w-3.5 h-3.5 mr-1" /> Pedidos</TabsTrigger>
            <TabsTrigger value="custos"><Receipt className="w-3.5 h-3.5 mr-1" /> Custos & Financeiro</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><ContratoDashboard contratoId={c.id} /></TabsContent>
          <TabsContent value="itens"><ContratoItens contratoId={c.id} /></TabsContent>
          <TabsContent value="pedidos"><ContratoPedidos contratoId={c.id} /></TabsContent>
          <TabsContent value="custos"><ContratoCustos contratoId={c.id} valorFaturado={c.valor_consumido} /></TabsContent>
        </Tabs>
      </AppLayout>
    );
  }

  // ═══ LIST VIEW ═══
  const filtered = contratos.filter(c => {
    const matchSearch = !search || c.objeto.toLowerCase().includes(search.toLowerCase()) || c.numero_contrato.toLowerCase().includes(search.toLowerCase()) || c.orgao_contratante.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const totalValor = contratos.reduce((s, c) => s + c.valor_global, 0);
  const totalSaldo = contratos.reduce((s, c) => s + (c.saldo_remanescente || 0), 0);
  const vencendo = contratos.filter(c => { if (!c.data_fim) return false; const d = (new Date(c.data_fim).getTime() - Date.now()) / 86400000; return d > 0 && d <= 60; }).length;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle itens, pedidos, custos e faturamento dos seus contratos</p>
        </div>
        <div className="flex gap-2">
          <ImportarContratoPDF onExtracted={handleImportExtracted} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Novo Contrato</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar Contrato</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><Label>Nº Contrato *</Label><Input value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))} placeholder="CT-001/2025" /></div>
              <div><Label>Órgão Contratante *</Label><Input value={form.orgao_contratante} onChange={e => setForm(f => ({ ...f, orgao_contratante: e.target.value }))} /></div>
              <div className="md:col-span-2"><Label>Objeto *</Label><Textarea value={form.objeto} onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))} rows={2} /></div>
              <div><Label>Valor Global (R$)</Label><Input type="number" value={form.valor_global} onChange={e => setForm(f => ({ ...f, valor_global: e.target.value }))} /></div>
              <div><Label>Valor Consumido (R$)</Label><Input type="number" value={form.valor_consumido} onChange={e => setForm(f => ({ ...f, valor_consumido: e.target.value }))} /></div>
              <div><Label>Data Assinatura</Label><Input type="date" value={form.data_assinatura} onChange={e => setForm(f => ({ ...f, data_assinatura: e.target.value }))} /></div>
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} /></div>
              <div><Label>Data Fim</Label><Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} /></div>
              <div><Label>Vigência (meses)</Label><Input type="number" value={form.vigencia_meses} onChange={e => setForm(f => ({ ...f, vigencia_meses: e.target.value }))} /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="vencendo">Vencendo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem></SelectContent></Select></div>
              <div><Label>Modalidade</Label><Input value={form.modalidade} onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))} placeholder="Pregão Eletrônico" /></div>
              <div><Label>UF</Label><Input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} maxLength={2} /></div>
              <div><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
              <div><Label>Fiscal - Nome</Label><Input value={form.fiscal_nome} onChange={e => setForm(f => ({ ...f, fiscal_nome: e.target.value }))} /></div>
              <div><Label>Fiscal - E-mail</Label><Input value={form.fiscal_email} onChange={e => setForm(f => ({ ...f, fiscal_email: e.target.value }))} /></div>
              <div><Label>Fiscal - Telefone</Label><Input value={form.fiscal_telefone} onChange={e => setForm(f => ({ ...f, fiscal_telefone: e.target.value }))} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Salvar Contrato</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" /> Total</div><p className="text-2xl font-bold">{contratos.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Valor Total</div><p className="text-2xl font-bold">{formatCurrency(totalValor)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-4 h-4" /> Saldo Total</div><p className="text-2xl font-bold text-success">{formatCurrency(totalSaldo)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="w-4 h-4" /> Vencendo 60d</div><p className="text-2xl font-bold text-warning">{vencendo}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por número, objeto ou órgão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="vencendo">Vencendo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem></SelectContent></Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum contrato encontrado</p></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
            const cfg = statusConfig[c.status] || statusConfig.vigente;
            const Icon = cfg.icon;
            const dias = c.data_fim ? Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / 86400000) : null;
            return (
              <Card key={c.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedContrato(c)}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-accent">{c.numero_contrato}</span>
                      <Badge className={`${cfg.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                      {dias !== null && dias <= 60 && dias > 0 && <Badge variant="outline" className="text-[10px] text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" />{dias}d</Badge>}
                      {pct >= 80 && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Saldo baixo</Badge>}
                    </div>
                    <p className="text-sm font-medium line-clamp-1">{c.objeto}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao_contratante}</span>
                      {c.data_fim && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Até {new Date(c.data_fim).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Consumido: {formatCurrency(c.valor_consumido)}</span>
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
