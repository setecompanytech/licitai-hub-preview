import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import {
  ShoppingCart, Plus, Search, Trash2, ArrowLeft, Loader2,
  Building2, Calendar, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Package, Truck, Users, X, Pencil, BarChart3, FileText,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0;

// ── Types ─────────────────────────────────────────────────────────
type Fornecedor = {
  id: string; empresa_id: string; razao_social: string; cnpj: string | null;
  categoria: string | null; prazo_entrega_dias: number | null; contato_nome: string | null;
  contato_email: string | null; contato_telefone: string | null; observacoes: string | null;
  ativo: boolean; created_at: string; updated_at: string;
};

type PedidoCompra = {
  id: string; empresa_id: string; contrato_id: string | null; fornecedor_id: string | null;
  status: 'rascunho' | 'aguardando' | 'entregue' | 'cancelado';
  data_pedido: string | null; data_entrega_prevista: string | null; data_entrega_real: string | null;
  valor_total: number; observacoes: string | null; created_at: string;
};

type ItemPedido = {
  id: string; pedido_id: string; descricao: string; unidade: string;
  quantidade: number; preco_unitario: number; preco_total: number;
};

type Contrato = { id: string; numero_contrato: string; orgao_contratante: string; objeto: string };

// ── Status config ─────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  rascunho:  { label: 'Rascunho',   color: 'bg-muted text-muted-foreground',          icon: Clock },
  aguardando:{ label: 'Aguardando', color: 'bg-warning/10 text-warning',              icon: Truck },
  entregue:  { label: 'Entregue',   color: 'bg-success/10 text-success',              icon: CheckCircle2 },
  cancelado: { label: 'Cancelado',  color: 'bg-destructive/10 text-destructive',      icon: X },
};

// ── Form defaults ─────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const defaultPedidoForm = () => ({
  contrato_id: '', fornecedor_id: '',
  data_pedido: today(), data_entrega_prevista: '', observacoes: '',
});

type FormItem = { descricao: string; unidade: string; quantidade: string; preco_unitario: string };
const blankItem = (): FormItem => ({ descricao: '', unidade: 'UN', quantidade: '1', preco_unitario: '0' });

const defaultFornForm = () => ({
  razao_social: '', cnpj: '', categoria: '', prazo_entrega_dias: '',
  contato_nome: '', contato_email: '', contato_telefone: '', observacoes: '', ativo: true,
});

// ═══════════════════════════════════════════════════════════════════
export default function GestaoCompras() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const [pedidos,      setPedidos]      = useState<PedidoCompra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contratos,    setContratos]    = useState<Contrato[]>([]);
  const [itensPedido,  setItensPedido]  = useState<ItemPedido[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [selectedPedido, setSelectedPedido] = useState<PedidoCompra | null>(null);
  const [mainTab,        setMainTab]        = useState('pedidos');
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [fornSearch,     setFornSearch]     = useState('');

  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false);
  const [pedidoForm,       setPedidoForm]       = useState(defaultPedidoForm);
  const [formItens,        setFormItens]        = useState<FormItem[]>([blankItem()]);

  const [fornDialogOpen, setFornDialogOpen] = useState(false);
  const [editingForn,    setEditingForn]    = useState<Fornecedor | null>(null);
  const [fornForm,       setFornForm]       = useState(defaultFornForm);

  // ── Efeito principal ─────────────────────────────────────────
  useEffect(() => {
    if (!empresaAtiva || !user) return;
    loadAll();
    loadContratos();
  }, [empresaAtiva?.id, user?.id]);

  // ── Itens do pedido selecionado ──────────────────────────────
  useEffect(() => {
    if (!selectedPedido) { setItensPedido([]); return; }
    supabase
      .from('itens_pedido_compra')
      .select('*')
      .eq('pedido_id', selectedPedido.id)
      .then(({ data }) => setItensPedido((data as ItemPedido[]) || []));
  }, [selectedPedido?.id]);

  // ── Loaders ──────────────────────────────────────────────────
  const loadAll = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const [{ data: p }, { data: f }] = await Promise.all([
      supabase.from('pedidos_compra').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false }),
      supabase.from('fornecedores').select('*').eq('empresa_id', empresaAtiva.id).order('razao_social'),
    ]);
    setPedidos((p as PedidoCompra[]) || []);
    setFornecedores((f as Fornecedor[]) || []);
    if (selectedPedido) {
      const updated = ((p as PedidoCompra[]) || []).find(x => x.id === selectedPedido.id);
      if (updated) setSelectedPedido(updated);
    }
    setLoading(false);
  };

  const loadContratos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('contratos')
      .select('id, numero_contrato, orgao_contratante, objeto')
      .eq('user_id', user.id)
      .neq('status', 'encerrado')
      .order('created_at', { ascending: false });
    setContratos((data as Contrato[]) || []);
  };

  // ── Save pedido ───────────────────────────────────────────────
  const handleSavePedido = async () => {
    if (!empresaAtiva) return;
    if (!pedidoForm.fornecedor_id) { toast.error('Selecione um fornecedor'); return; }
    const validItens = formItens.filter(i => i.descricao.trim());
    if (validItens.length === 0) { toast.error('Adicione ao menos um item'); return; }

    setSaving(true);
    const valorTotal = validItens.reduce(
      (s, i) => s + parseNum(i.quantidade) * parseNum(i.preco_unitario), 0
    );

    const { data: pedido, error } = await supabase
      .from('pedidos_compra')
      .insert({
        empresa_id:            empresaAtiva.id,
        contrato_id:           pedidoForm.contrato_id || null,
        fornecedor_id:         pedidoForm.fornecedor_id,
        status:                'rascunho',
        data_pedido:           pedidoForm.data_pedido || null,
        data_entrega_prevista: pedidoForm.data_entrega_prevista || null,
        valor_total:           valorTotal,
        observacoes:           pedidoForm.observacoes || null,
      } as any)
      .select('id')
      .single();

    if (error) {
      toast.error('Erro ao salvar pedido', { description: error.message });
      setSaving(false);
      return;
    }

    if (pedido) {
      const rows = validItens.map(i => {
        const qty  = parseNum(i.quantidade);
        const unit = parseNum(i.preco_unitario);
        return {
          pedido_id: pedido.id,
          descricao: i.descricao.trim(),
          unidade:   i.unidade || 'UN',
          quantidade:     qty,
          preco_unitario: unit,
          preco_total:    qty * unit,
        };
      });
      const { error: itErr } = await supabase.from('itens_pedido_compra').insert(rows as any);
      if (itErr) toast.error('Pedido salvo, mas erro nos itens', { description: itErr.message });
      else        toast.success(`Pedido cadastrado com ${rows.length} ${rows.length === 1 ? 'item' : 'itens'}!`);
    }

    setSaving(false);
    setPedidoDialogOpen(false);
    resetPedidoForm();
    loadAll();
  };

  // ── Save fornecedor ───────────────────────────────────────────
  const handleSaveFornecedor = async () => {
    if (!empresaAtiva) return;
    if (!fornForm.razao_social.trim()) { toast.error('Razão social obrigatória'); return; }

    setSaving(true);
    const payload = {
      empresa_id:         empresaAtiva.id,
      razao_social:       fornForm.razao_social.trim(),
      cnpj:               fornForm.cnpj         || null,
      categoria:          fornForm.categoria    || null,
      prazo_entrega_dias: fornForm.prazo_entrega_dias ? parseInt(fornForm.prazo_entrega_dias) : null,
      contato_nome:       fornForm.contato_nome    || null,
      contato_email:      fornForm.contato_email   || null,
      contato_telefone:   fornForm.contato_telefone || null,
      observacoes:        fornForm.observacoes      || null,
      ativo:              fornForm.ativo,
    };

    let error;
    if (editingForn) {
      ({ error } = await supabase.from('fornecedores').update(payload as any).eq('id', editingForn.id));
      if (!error) toast.success('Fornecedor atualizado!');
    } else {
      ({ error } = await supabase.from('fornecedores').insert(payload as any));
      if (!error) toast.success('Fornecedor cadastrado!');
    }

    if (error) toast.error('Erro ao salvar', { description: error.message });
    setSaving(false);
    setFornDialogOpen(false);
    setEditingForn(null);
    setFornForm(defaultFornForm);
    loadAll();
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDeletePedido = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('pedidos_compra').delete().eq('id', id);
    toast.success('Pedido excluído');
    if (selectedPedido?.id === id) setSelectedPedido(null);
    loadAll();
  };

  const handleDeleteFornecedor = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('fornecedores').delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    toast.success('Fornecedor excluído');
    loadAll();
  };

  // ── Update status (detalhe) ───────────────────────────────────
  const handleUpdateStatus = async (status: PedidoCompra['status']) => {
    if (!selectedPedido) return;
    const updates: Record<string, any> = { status };
    if (status === 'entregue') updates.data_entrega_real = today();

    const { error } = await supabase.from('pedidos_compra').update(updates).eq('id', selectedPedido.id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success('Status atualizado');
    setSelectedPedido(p => p ? { ...p, ...updates } : null);
    loadAll();
  };

  const resetPedidoForm = () => {
    setPedidoForm(defaultPedidoForm);
    setFormItens([blankItem()]);
  };

  // ── Métricas ──────────────────────────────────────────────────
  const abertos           = pedidos.filter(p => p.status === 'rascunho' || p.status === 'aguardando');
  const valorComprometido = abertos.reduce((s, p) => s + p.valor_total, 0);
  const contratosVinculados = new Set(pedidos.map(p => p.contrato_id).filter(Boolean)).size;
  const todayStr = today();
  const atrasados = abertos.filter(
    p => p.data_entrega_prevista && p.data_entrega_prevista < todayStr
  ).length;

  // ── Filtros ───────────────────────────────────────────────────
  const filteredPedidos = pedidos.filter(p => {
    const forn = fornecedores.find(f => f.id === p.fornecedor_id);
    const cont = contratos.find(c => c.id === p.contrato_id);
    const txt  = `${p.observacoes ?? ''} ${forn?.razao_social ?? ''} ${cont?.numero_contrato ?? ''}`.toLowerCase();
    return (
      (!search || txt.includes(search.toLowerCase())) &&
      (statusFilter === 'all' || p.status === statusFilter)
    );
  });

  const isOnboarding = !loading && pedidos.length === 0 && fornecedores.length === 0;

  const filteredForn = fornecedores.filter(f =>
    !fornSearch ||
    f.razao_social.toLowerCase().includes(fornSearch.toLowerCase()) ||
    (f.categoria ?? '').toLowerCase().includes(fornSearch.toLowerCase())
  );

  // ══ DETAIL VIEW ══════════════════════════════════════════════
  if (selectedPedido) {
    const p    = selectedPedido;
    const forn = fornecedores.find(f => f.id === p.fornecedor_id);
    const cont = contratos.find(c => c.id === p.contrato_id);
    const cfg  = statusConfig[p.status];
    const Icon = cfg.icon;
    const isAtrasado =
      p.data_entrega_prevista &&
      p.status !== 'entregue' &&
      p.status !== 'cancelado' &&
      p.data_entrega_prevista < todayStr;

    return (
      <AppLayout>
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPedido(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{p.observacoes || 'Pedido de Compra'}</h1>
                <Badge className={`${cfg.color} text-[10px]`}>
                  <Icon className="w-3 h-3 mr-1" />{cfg.label}
                </Badge>
                {isAtrasado && (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />Atrasado
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {forn && (
                  <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{forn.razao_social}</span>
                )}
                {cont && (
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />Contrato {cont.numero_contrato}</span>
                )}
                {p.data_pedido && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Pedido: {formatDate(p.data_pedido)}</span>
                )}
                {p.data_entrega_prevista && (
                  <span className="flex items-center gap-1"><Truck className="w-3 h-3" />Previsto: {formatDate(p.data_entrega_prevista)}</span>
                )}
                {p.data_entrega_real && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="w-3 h-3" />Entregue: {formatDate(p.data_entrega_real)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-right mr-1">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">{formatCurrency(p.valor_total)}</p>
              </div>
              <Select value={p.status} onValueChange={(v: any) => handleUpdateStatus(v)}>
                <SelectTrigger className="w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={e => handleDeletePedido(p.id, e)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Itens do Pedido
          </h2>
          {itensPedido.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum item cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Descrição</th>
                    <th className="text-center py-2 px-2 font-medium w-16">Un.</th>
                    <th className="text-right py-2 px-2 font-medium w-20">Qtd.</th>
                    <th className="text-right py-2 px-2 font-medium w-32">Preço Unit.</th>
                    <th className="text-right py-2 pl-2 font-medium w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itensPedido.map(item => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4">{item.descricao}</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">{item.unidade}</td>
                      <td className="py-2 px-2 text-right">{item.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(item.preco_unitario)}</td>
                      <td className="py-2 pl-2 text-right font-medium">{formatCurrency(item.preco_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="py-2 text-right text-xs text-muted-foreground pr-2 font-medium">
                      Total do Pedido
                    </td>
                    <td className="py-2 pl-2 text-right font-bold text-primary">
                      {formatCurrency(p.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </AppLayout>
    );
  }

  // ══ LIST VIEW ════════════════════════════════════════════════
  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Compras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pedidos de compra, fornecedores e vínculos com contratos administrativos
          </p>
        </div>
        {!isOnboarding && (
          <div className="flex gap-2">
            {mainTab === 'fornecedores' ? (
              <Button onClick={() => { setEditingForn(null); setFornForm(defaultFornForm); setFornDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
              </Button>
            ) : (
              <Button onClick={() => { resetPedidoForm(); setPedidoDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Novo Pedido
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Guard sem empresa */}
      {!empresaAtiva ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Selecione uma empresa ativa para acessar o módulo de compras.
          </p>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : isOnboarding ? (
        <div className="min-h-[60vh] flex flex-col justify-center">
          <OnboardingCompras
            onCadastrarFornecedor={() => {
              setEditingForn(null);
              setFornForm(defaultFornForm);
              setFornDialogOpen(true);
            }}
            onNovoPedido={() => {
              resetPedidoForm();
              setPedidoDialogOpen(true);
            }}
            onProdutos={() => {
              setMainTab('fornecedores');
              toast.info('Em breve: catálogo de produtos');
            }}
          />
        </div>
      ) : (
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pedidos">
              <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Pedidos
            </TabsTrigger>
            <TabsTrigger value="fornecedores">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Fornecedores
            </TabsTrigger>
          </TabsList>

          {/* ══ ABA PEDIDOS ══ */}
          <TabsContent value="pedidos" className="space-y-4">
            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <ShoppingCart className="w-4 h-4" /> Em Aberto
                </div>
                <p className="text-2xl font-bold">{abertos.length}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="w-4 h-4" /> Comprometido
                </div>
                <p className="text-lg font-bold leading-tight">{formatCurrency(valorComprometido)}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Building2 className="w-4 h-4" /> Contratos
                </div>
                <p className="text-2xl font-bold">{contratosVinculados}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <AlertTriangle className="w-4 h-4" /> Atrasados
                </div>
                <p className="text-2xl font-bold text-destructive">{atrasados}</p>
              </Card>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, fornecedor ou contrato..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de pedidos */}
            {filteredPedidos.length === 0 ? (
              <Card className="p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredPedidos.map(p => {
                  const forn      = fornecedores.find(f => f.id === p.fornecedor_id);
                  const cont      = contratos.find(c => c.id === p.contrato_id);
                  const cfg       = statusConfig[p.status];
                  const Icon      = cfg.icon;
                  const isAtrasado =
                    p.data_entrega_prevista &&
                    p.status !== 'entregue' &&
                    p.status !== 'cancelado' &&
                    p.data_entrega_prevista < todayStr;

                  return (
                    <Card
                      key={p.id}
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedPedido(p)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold truncate">
                              {p.observacoes || 'Pedido de Compra'}
                            </span>
                            <Badge className={`${cfg.color} text-[10px]`}>
                              <Icon className="w-3 h-3 mr-1" />{cfg.label}
                            </Badge>
                            {isAtrasado && (
                              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                                Atrasado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {forn && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3" />{forn.razao_social}
                              </span>
                            )}
                            {cont && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />Ct. {cont.numero_contrato}
                              </span>
                            )}
                            {p.data_pedido && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />Pedido: {formatDate(p.data_pedido)}
                              </span>
                            )}
                            {p.data_entrega_prevista && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3" />Prev: {formatDate(p.data_entrega_prevista)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Valor Total</p>
                            <p className="text-sm font-bold">{formatCurrency(p.valor_total)}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => handleDeletePedido(p.id, e)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ══ ABA FORNECEDORES ══ */}
          <TabsContent value="fornecedores" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fornecedor ou categoria..."
                value={fornSearch}
                onChange={e => setFornSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredForn.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum fornecedor cadastrado</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredForn.map(f => (
                  <Card key={f.id} className={`p-4 ${!f.ativo ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{f.razao_social}</span>
                          {f.categoria && (
                            <Badge variant="outline" className="text-[10px]">{f.categoria}</Badge>
                          )}
                          {!f.ativo && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {f.cnpj && <span>{f.cnpj}</span>}
                          {f.contato_nome && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />{f.contato_nome}
                            </span>
                          )}
                          {f.contato_email && <span>{f.contato_email}</span>}
                          {f.prazo_entrega_dias != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{f.prazo_entrega_dias}d prazo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingForn(f);
                            setFornForm({
                              razao_social:       f.razao_social,
                              cnpj:               f.cnpj               ?? '',
                              categoria:          f.categoria          ?? '',
                              prazo_entrega_dias: f.prazo_entrega_dias != null ? String(f.prazo_entrega_dias) : '',
                              contato_nome:       f.contato_nome       ?? '',
                              contato_email:      f.contato_email      ?? '',
                              contato_telefone:   f.contato_telefone   ?? '',
                              observacoes:        f.observacoes        ?? '',
                              ativo:              f.ativo,
                            });
                            setFornDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => handleDeleteFornecedor(f.id, e)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ══ DIALOG NOVO PEDIDO ══ */}
      <Dialog
        open={pedidoDialogOpen}
        onOpenChange={o => { setPedidoDialogOpen(o); if (!o) resetPedidoForm(); }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Pedido de Compra</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="md:col-span-2">
              <Label>Fornecedor *</Label>
              <Select
                value={pedidoForm.fornecedor_id}
                onValueChange={v => setPedidoForm(f => ({ ...f, fornecedor_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.filter(f => f.ativo).map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.razao_social}{f.categoria ? ` — ${f.categoria}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Contrato vinculado (opcional)</Label>
              <Select
                value={pedidoForm.contrato_id || 'none'}
                onValueChange={v => setPedidoForm(f => ({ ...f, contrato_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum contrato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem contrato —</SelectItem>
                  {contratos.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero_contrato} — {c.orgao_contratante}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data do Pedido</Label>
              <Input
                type="date"
                value={pedidoForm.data_pedido}
                onChange={e => setPedidoForm(f => ({ ...f, data_pedido: e.target.value }))}
              />
            </div>
            <div>
              <Label>Entrega Prevista</Label>
              <Input
                type="date"
                value={pedidoForm.data_entrega_prevista}
                onChange={e => setPedidoForm(f => ({ ...f, data_entrega_prevista: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Descrição / Observações</Label>
              <Textarea
                value={pedidoForm.observacoes}
                onChange={e => setPedidoForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                placeholder="Descreva o objeto deste pedido..."
              />
            </div>
          </div>

          {/* Itens dinâmicos */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Itens do Pedido *</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFormItens(i => [...i, blankItem()])}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
              </Button>
            </div>

            {/* Cabeçalho da grid */}
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-1 text-xs text-muted-foreground px-1">
              <span className="col-span-5">Descrição</span>
              <span className="col-span-2">Unidade</span>
              <span className="col-span-2 text-right">Quantidade</span>
              <span className="col-span-2 text-right">Preço unit.</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-2">
              {formItens.map((item, idx) => {
                const subtotal = parseNum(item.quantidade) * parseNum(item.preco_unitario);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-5">
                        <Input
                          placeholder="Descrição do item"
                          value={item.descricao}
                          onChange={e =>
                            setFormItens(arr =>
                              arr.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x)
                            )
                          }
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          placeholder="UN"
                          value={item.unidade}
                          onChange={e =>
                            setFormItens(arr =>
                              arr.map((x, i) => i === idx ? { ...x, unidade: e.target.value } : x)
                            )
                          }
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Qtd."
                          value={item.quantidade}
                          onChange={e =>
                            setFormItens(arr =>
                              arr.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x)
                            )
                          }
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="R$ unit."
                          value={item.preco_unitario}
                          onChange={e =>
                            setFormItens(arr =>
                              arr.map((x, i) => i === idx ? { ...x, preco_unitario: e.target.value } : x)
                            )
                          }
                          className="text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={formItens.length === 1}
                          onClick={() => setFormItens(arr => arr.filter((_, i) => i !== idx))}
                        >
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {subtotal > 0 && (
                      <p className="text-right text-xs text-muted-foreground pr-10">
                        = {formatCurrency(subtotal)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {formItens.some(i => i.descricao.trim()) && (
              <div className="mt-3 p-2 rounded bg-muted/40 text-sm font-semibold text-right">
                Total: {formatCurrency(
                  formItens.reduce((s, i) => s + parseNum(i.quantidade) * parseNum(i.preco_unitario), 0)
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => { setPedidoDialogOpen(false); resetPedidoForm(); }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePedido} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar Pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ DIALOG FORNECEDOR ══ */}
      <Dialog
        open={fornDialogOpen}
        onOpenChange={o => {
          setFornDialogOpen(o);
          if (!o) { setEditingForn(null); setFornForm(defaultFornForm); }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingForn ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="md:col-span-2">
              <Label>Razão Social *</Label>
              <Input
                value={fornForm.razao_social}
                onChange={e => setFornForm(f => ({ ...f, razao_social: e.target.value }))}
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={fornForm.cnpj}
                onChange={e => setFornForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                value={fornForm.categoria}
                onChange={e => setFornForm(f => ({ ...f, categoria: e.target.value }))}
                placeholder="ex: Materiais, TI, Serviços"
              />
            </div>
            <div>
              <Label>Prazo de Entrega (dias)</Label>
              <Input
                type="number"
                min="0"
                value={fornForm.prazo_entrega_dias}
                onChange={e => setFornForm(f => ({ ...f, prazo_entrega_dias: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 mt-5">
              <Switch
                id="forn-ativo"
                checked={fornForm.ativo}
                onCheckedChange={v => setFornForm(f => ({ ...f, ativo: v }))}
              />
              <Label htmlFor="forn-ativo" className="cursor-pointer">Fornecedor ativo</Label>
            </div>
            <div>
              <Label>Contato — Nome</Label>
              <Input
                value={fornForm.contato_nome}
                onChange={e => setFornForm(f => ({ ...f, contato_nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Contato — E-mail</Label>
              <Input
                type="email"
                value={fornForm.contato_email}
                onChange={e => setFornForm(f => ({ ...f, contato_email: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Contato — Telefone</Label>
              <Input
                value={fornForm.contato_telefone}
                onChange={e => setFornForm(f => ({ ...f, contato_telefone: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={fornForm.observacoes}
                onChange={e => setFornForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => { setFornDialogOpen(false); setEditingForn(null); setFornForm(defaultFornForm); }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveFornecedor} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Onboarding — exibido quando não há nenhum pedido nem fornecedor
// ═══════════════════════════════════════════════════════════════════
type OnboardingProps = {
  onCadastrarFornecedor: () => void;
  onNovoPedido:          () => void;
  onProdutos:            () => void;
};

function OnboardingCompras({ onCadastrarFornecedor, onNovoPedido, onProdutos }: OnboardingProps) {
  const steps: {
    icon: React.ElementType;
    title: string;
    desc: string;
    btn: string;
    onClick: () => void;
  }[] = [
    {
      icon:    Building2,
      title:   'Cadastre Fornecedores',
      desc:    'Adicione os fornecedores com quem você vai trabalhar.',
      btn:     'Cadastrar Fornecedor',
      onClick: onCadastrarFornecedor,
    },
    {
      icon:    Package,
      title:   'Cadastre Produtos',
      desc:    'Monte seu catálogo de produtos e serviços.',
      btn:     'Cadastrar Produto',
      onClick: onProdutos,
    },
    {
      icon:    ShoppingCart,
      title:   'Registre uma Compra',
      desc:    'Crie seu primeiro pedido de compra.',
      btn:     'Nova Compra',
      onClick: onNovoPedido,
    },
    {
      icon:    BarChart3,
      title:   'Movimente o Estoque',
      desc:    'Controle entradas e saídas do seu estoque.',
      btn:     'Ver Estoque',
      onClick: () => toast.info('Em breve: módulo de estoque'),
    },
    {
      icon:    FileText,
      title:   'Importe NF-e Recebida',
      desc:    'Vincule notas fiscais recebidas às suas compras.',
      btn:     'Importar NF-e',
      onClick: () => toast.info('Em breve: importação de NF-e'),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4">
      <p className="text-base text-muted-foreground text-center mb-12">
        Siga as etapas abaixo para configurar seu fluxo de compras.
      </p>

      <ol>
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isLast   = idx === steps.length - 1;
          return (
            <li key={idx} className="flex gap-5">
              {/* Trilha vertical */}
              <div className="flex flex-col items-center pt-0.5">
                <div className="flex items-center justify-center w-11 h-11 rounded-full border-2 border-primary/40 bg-primary/10 text-primary text-sm font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                {!isLast && <div className="w-px flex-1 bg-border mt-2 mb-2 min-h-[32px]" />}
              </div>

              {/* Conteúdo */}
              <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 ${isLast ? 'pb-0' : 'pb-10'}`}>
                <div className="flex items-start gap-3 flex-1">
                  <StepIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-base font-semibold leading-tight">{step.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={step.onClick}
                  className="shrink-0 self-start sm:self-auto"
                >
                  {step.btn}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
