import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProdutosOmie from '@/components/gestao-compras/ProdutosOmie';
import PedidosOmie from '@/components/gestao-compras/PedidosOmie';
import CertificadoDigital from '@/components/gestao-compras/CertificadoDigital';
import PessoaFormDialog from '@/components/financeiro/PessoaFormDialog';
import { usePessoas, useDeletePessoa, type Pessoa } from '@/hooks/useFinanceiro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { parseNFeXML, type NFeData, type NFeItemData } from '@/lib/parseNFe';
import {
  ShoppingCart, Plus, Search, Trash2, ArrowLeft, Loader2,
  Building2, Calendar, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Package, Truck, Users, X, Pencil, FileText,
  Warehouse, TrendingUp, TrendingDown, Upload, RotateCcw, AlertCircle, ShieldCheck,
} from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0;

const today = () => new Date().toISOString().split('T')[0];
const normCnpj = (v: string) => v.replace(/\D/g, '');

// ── Types ─────────────────────────────────────────────────────
type Fornecedor = {
  id: string; empresa_id: string; razao_social: string; cnpj: string | null;
  categoria: string | null; prazo_entrega_dias: number | null; contato_nome: string | null;
  contato_email: string | null; contato_telefone: string | null; observacoes: string | null;
  ativo: boolean; created_at: string; updated_at: string;
  inscricao_estadual: string | null; regime_tributario: string | null;
  uf: string | null; municipio: string | null; cep: string | null;
  logradouro: string | null; numero_endereco: string | null; bairro: string | null;
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

type Produto = {
  id: string; empresa_id: string; codigo: string | null; descricao: string;
  unidade: string; categoria: string | null; saldo_atual: number;
  saldo_minimo: number; preco_custo_medio: number; ativo: boolean;
  created_at: string; updated_at: string;
  ncm: string | null; cfop: string | null; cst_icms: string | null;
  csosn: string | null; cst_pis: string | null; cst_cofins: string | null;
  p_icms: number | null; p_pis: number | null; p_cofins: number | null;
};

type EstoqueMovimento = {
  id: string; empresa_id: string; produto_id: string; pedido_id: string | null;
  nfe_id: string | null; tipo: 'entrada' | 'saida' | 'ajuste'; origem: string;
  quantidade: number; preco_unitario: number | null; observacoes: string | null;
  created_by: string | null; created_at: string;
};

type NfeRecebida = {
  id: string; empresa_id: string; pedido_id: string | null; fornecedor_id: string | null;
  numero: string; serie: string; chave_acesso: string | null; data_emissao: string | null;
  cnpj_emitente: string | null; nome_emitente: string | null;
  valor_total: number; xml_content: string | null; itens: NFeItemData[] | null;
  created_at: string;
};

// ── Config ────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  rascunho:   { label: 'Rascunho',   color: 'bg-muted text-muted-foreground',          icon: Clock },
  aguardando: { label: 'Aguardando', color: 'bg-warning/10 text-warning',              icon: Truck },
  entregue:   { label: 'Entregue',   color: 'bg-success/10 text-success',              icon: CheckCircle2 },
  cancelado:  { label: 'Cancelado',  color: 'bg-destructive/10 text-destructive',      icon: X },
};

const movConfig = {
  entrada: { label: 'Entrada', color: 'text-green-600',  bg: 'bg-green-50  dark:bg-green-950',  icon: TrendingUp,   sign: '+' },
  saida:   { label: 'Saída',   color: 'text-red-600',    bg: 'bg-red-50    dark:bg-red-950',    icon: TrendingDown, sign: '-' },
  ajuste:  { label: 'Ajuste',  color: 'text-blue-600',   bg: 'bg-blue-50   dark:bg-blue-950',   icon: RotateCcw,    sign: '±' },
};

// ── Form defaults ─────────────────────────────────────────────
const defaultPedidoForm  = () => ({ contrato_id: '', fornecedor_id: '', data_pedido: today(), data_entrega_prevista: '', observacoes: '' });
const defaultFornForm    = () => ({ razao_social: '', cnpj: '', categoria: '', prazo_entrega_dias: '', contato_nome: '', contato_email: '', contato_telefone: '', observacoes: '', ativo: true, inscricao_estadual: '', regime_tributario: '', uf: '', municipio: '', cep: '', logradouro: '', numero_endereco: '', bairro: '' });
const defaultProdutoForm = () => ({ codigo: '', descricao: '', unidade: 'UN', categoria: '', saldo_minimo: '0', preco_custo_medio: '0', ativo: true, ncm: '', cfop: '', cst_icms: '', csosn: '', cst_pis: '', cst_cofins: '', p_icms: '', p_pis: '', p_cofins: '' });
const defaultMovForm     = () => ({ produto_id: '', tipo: 'entrada' as const, ajuste_dir: 'mais' as 'mais' | 'menos', quantidade: '', preco_unitario: '', observacoes: '' });
const defaultNfeForm     = () => ({ numero: '', serie: '1', chave_acesso: '', data_emissao: today(), cnpj_emitente: '', nome_emitente: '', valor_total: '', pedido_id: '' });

type FormItem = { descricao: string; unidade: string; quantidade: string; preco_unitario: string };
const blankItem = (): FormItem => ({ descricao: '', unidade: 'UN', quantidade: '1', preco_unitario: '0' });

// ═══════════════════════════════════════════════════════════════
export default function GestaoCompras() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  // ── State: listas ─────────────────────────────────────────────
  const [pedidos,      setPedidos]      = useState<PedidoCompra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contratos,    setContratos]    = useState<Contrato[]>([]);
  const [produtos,     setProdutos]     = useState<Produto[]>([]);
  const [nfes,         setNfes]         = useState<NfeRecebida[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);

  // ── State: navegação ──────────────────────────────────────────
  const [mainTab,         setMainTab]         = useState('pedidos');
  const [selectedPedido,  setSelectedPedido]  = useState<PedidoCompra | null>(null);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [itensPedido,     setItensPedido]     = useState<ItemPedido[]>([]);
  const [movimentos,      setMovimentos]      = useState<EstoqueMovimento[]>([]);

  // ── State: filtros ────────────────────────────────────────────
  const [search,        setSearch]       = useState('');
  const [statusFilter,  setStatusFilter] = useState('all');
  const [fornSearch,    setFornSearch]   = useState('');
  const [estoqSearch,   setEstoqSearch]  = useState('');

  // ── State: dialogs Pedido ────────────────────────────────────
  const [pedidoOpen, setPedidoOpen] = useState(false);
  const [pedidoForm, setPedidoForm] = useState(defaultPedidoForm);
  const [formItens,  setFormItens]  = useState<FormItem[]>([blankItem()]);

  // ── State: dialog Fornecedor (FinPessoas unificado) ───────────
  const [pessoaOpen,    setPessoaOpen]    = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const { data: todasPessoas = [] } = usePessoas();
  const deletePessoa = useDeletePessoa();
  const pessoasFornecedores = todasPessoas.filter(p => p.tipo === 'fornecedor' || p.tipo === 'ambos');

  // mantidos para compatibilidade com selects de pedido e NF-e
  const [fornOpen,      setFornOpen]      = useState(false);
  const [editingForn,   setEditingForn]   = useState<Fornecedor | null>(null);
  const [fornForm,      setFornForm]      = useState(defaultFornForm);
  const [fetchingCnpj,  setFetchingCnpj]  = useState(false);

  // ── State: dialogs Estoque ────────────────────────────────────
  const [produtoOpen,    setProdutoOpen]    = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [produtoForm,    setProdutoForm]    = useState(defaultProdutoForm);

  const [movOpen, setMovOpen] = useState(false);
  const [movForm, setMovForm] = useState(defaultMovForm);

  // dialog pós-entrega: mapear itens do pedido para produtos
  const [entregaOpen,     setEntregaOpen]     = useState(false);
  const [entregaPedido,   setEntregaPedido]   = useState<PedidoCompra | null>(null);
  const [entregaMappings, setEntregaMappings] = useState<{ item: ItemPedido; produtoId: string; novaNome: string }[]>([]);
  const [savingEntrega,   setSavingEntrega]   = useState(false);

  // ── State: NF-e ───────────────────────────────────────────────
  const [nfeOpen,        setNfeOpen]        = useState(false);
  const [nfeMode,        setNfeMode]        = useState<'xml' | 'manual'>('xml');
  const [nfeParsed,      setNfeParsed]      = useState<NFeData | null>(null);
  const [nfeXmlStr,      setNfeXmlStr]      = useState('');
  const [nfeForm,        setNfeForm]        = useState(defaultNfeForm);
  const [nfeRegEstoque,  setNfeRegEstoque]  = useState(false);
  const [nfeItemMaps,    setNfeItemMaps]    = useState<{ item: NFeItemData; produtoId: string; novaNome: string; incluir: boolean }[]>([]);
  const [nfeDragging,    setNfeDragging]    = useState(false);
  const [nfePdfLoading,  setNfePdfLoading]  = useState(false);
  const [nfeStep,        setNfeStep]        = useState<1|2|3>(1);
  const [nfeFornMatch,   setNfeFornMatch]   = useState<Fornecedor | null>(null);
  const [nfeCriarForn,   setNfeCriarForn]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Effects ───────────────────────────────────────────────────
  useEffect(() => {
    if (!empresaAtiva || !user) return;
    loadAll();
    loadContratos();
  }, [empresaAtiva?.id, user?.id]);

  useEffect(() => {
    if (!selectedPedido) { setItensPedido([]); return; }
    supabase.from('itens_pedido_compra').select('*').eq('pedido_id', selectedPedido.id)
      .then(({ data }) => setItensPedido((data as ItemPedido[]) || []));
  }, [selectedPedido?.id]);

  useEffect(() => {
    if (!selectedProduto) { setMovimentos([]); return; }
    supabase.from('estoque_movimentos').select('*').eq('produto_id', selectedProduto.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMovimentos((data as EstoqueMovimento[]) || []));
  }, [selectedProduto?.id]);

  // ── Loaders ───────────────────────────────────────────────────
  const loadAll = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const [{ data: p }, { data: f }, { data: pr }, { data: n }] = await Promise.all([
        supabase.from('pedidos_compra').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false }),
        supabase.from('fornecedores').select('*').eq('empresa_id', empresaAtiva.id).order('razao_social'),
        supabase.from('produtos').select('*').eq('empresa_id', empresaAtiva.id).order('descricao'),
        supabase.from('nfe_recebidas').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false }),
      ]);
      setPedidos((p as PedidoCompra[]) || []);
      setFornecedores((f as Fornecedor[]) || []);
      setProdutos((pr as Produto[]) || []);
      setNfes((n as NfeRecebida[]) || []);
      if (selectedPedido) {
        const upd = ((p as PedidoCompra[]) || []).find(x => x.id === selectedPedido.id);
        if (upd) setSelectedPedido(upd);
      }
      if (selectedProduto) {
        const upd = ((pr as Produto[]) || []).find(x => x.id === selectedProduto.id);
        if (upd) setSelectedProduto(upd);
      }
    } catch {
      toast.error('Erro ao carregar dados. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const loadContratos = async () => {
    if (!user) return;
    const { data } = await supabase.from('contratos').select('id, numero_contrato, orgao_contratante, objeto')
      .eq('user_id', user.id).neq('status', 'encerrado').order('created_at', { ascending: false });
    setContratos((data as Contrato[]) || []);
  };

  const reloadMovimentos = async (prodId: string) => {
    const { data } = await supabase.from('estoque_movimentos').select('*').eq('produto_id', prodId)
      .order('created_at', { ascending: false });
    setMovimentos((data as EstoqueMovimento[]) || []);
  };

  // ── Save pedido ───────────────────────────────────────────────
  const handleSavePedido = async () => {
    if (!empresaAtiva) return;
    if (!pedidoForm.fornecedor_id) { toast.error('Selecione um fornecedor'); return; }
    const valid = formItens.filter(i => i.descricao.trim());
    if (!valid.length) { toast.error('Adicione ao menos um item'); return; }
    setSaving(true);
    const total = valid.reduce((s, i) => s + parseNum(i.quantidade) * parseNum(i.preco_unitario), 0);
    const { data: pedido, error } = await supabase.from('pedidos_compra').insert({
      empresa_id: empresaAtiva.id,
      contrato_id: pedidoForm.contrato_id || null,
      fornecedor_id: pedidoForm.fornecedor_id,
      status: 'rascunho',
      data_pedido: pedidoForm.data_pedido || null,
      data_entrega_prevista: pedidoForm.data_entrega_prevista || null,
      valor_total: total,
      observacoes: pedidoForm.observacoes || null,
    } as any).select('id').single();
    if (error) { toast.error('Erro ao salvar', { description: error.message }); setSaving(false); return; }
    if (pedido) {
      const rows = valid.map(i => ({ pedido_id: pedido.id, descricao: i.descricao.trim(), unidade: i.unidade || 'UN', quantidade: parseNum(i.quantidade), preco_unitario: parseNum(i.preco_unitario), preco_total: parseNum(i.quantidade) * parseNum(i.preco_unitario) }));
      const { error: ie } = await supabase.from('itens_pedido_compra').insert(rows as any);
      if (ie) toast.error('Pedido salvo, erro nos itens', { description: ie.message });
      else toast.success(`Pedido criado com ${rows.length} item(ns)!`);
    }
    setSaving(false); setPedidoOpen(false); resetPedidoForm(); loadAll();
  };

  // ── Save fornecedor ───────────────────────────────────────────
  const handleSaveFornecedor = async () => {
    if (!empresaAtiva) return;
    if (!fornForm.razao_social.trim()) { toast.error('Razão social obrigatória'); return; }
    setSaving(true);
    const payload = { empresa_id: empresaAtiva.id, razao_social: fornForm.razao_social.trim(), cnpj: fornForm.cnpj || null, categoria: fornForm.categoria || null, prazo_entrega_dias: fornForm.prazo_entrega_dias ? parseInt(fornForm.prazo_entrega_dias) : null, contato_nome: fornForm.contato_nome || null, contato_email: fornForm.contato_email || null, contato_telefone: fornForm.contato_telefone || null, observacoes: fornForm.observacoes || null, ativo: fornForm.ativo, inscricao_estadual: fornForm.inscricao_estadual || null, regime_tributario: fornForm.regime_tributario || null, uf: fornForm.uf || null, municipio: fornForm.municipio || null, cep: fornForm.cep || null, logradouro: fornForm.logradouro || null, numero_endereco: fornForm.numero_endereco || null, bairro: fornForm.bairro || null };
    let error: any;
    if (editingForn) {
      ({ error } = await supabase.from('fornecedores').update(payload as any).eq('id', editingForn.id));
      if (!error) toast.success('Fornecedor atualizado!');
    } else {
      ({ error } = await supabase.from('fornecedores').insert(payload as any));
      if (!error) toast.success('Fornecedor cadastrado!');
    }
    if (error) toast.error('Erro', { description: error.message });
    setSaving(false); setFornOpen(false); setEditingForn(null); setFornForm(defaultFornForm()); loadAll();
  };

  // ── Update status + hook entrega ──────────────────────────────
  const handleUpdateStatus = async (status: PedidoCompra['status']) => {
    if (!selectedPedido) return;
    const updates: Record<string, any> = { status };
    if (status === 'entregue') updates.data_entrega_real = today();
    const { error } = await supabase.from('pedidos_compra').update(updates).eq('id', selectedPedido.id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success('Status atualizado');
    const updated = { ...selectedPedido, ...updates };
    setSelectedPedido(updated);
    loadAll();
    if (status === 'entregue' && itensPedido.length > 0) {
      setEntregaPedido(updated);
      setEntregaMappings(itensPedido.map(item => ({ item, produtoId: '', novaNome: item.descricao })));
      setEntregaOpen(true);
    }
  };

  // ── Delete pedido / fornecedor ────────────────────────────────
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
    toast.success('Fornecedor excluído'); loadAll();
  };

  // ── Busca CNPJ (BrasilAPI) ────────────────────────────────────
  const buscarCnpj = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setFetchingCnpj(true);
    try {
      const { data: d, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: digits },
      });
      if (error || !d || d.error) throw new Error(d?.error || 'not_found');

      const regime = d.simples ? '1' : '3';

      setFornForm(f => ({
        ...f,
        razao_social:      d.razaoSocial      || f.razao_social,
        contato_telefone:  d.telefone         || f.contato_telefone,
        cep:               d.cep              || f.cep,
        logradouro:        d.logradouro       || f.logradouro,
        numero_endereco:   d.numero           || f.numero_endereco,
        bairro:            d.bairro           || f.bairro,
        municipio:         d.municipio        || f.municipio,
        uf:                d.uf               || f.uf,
        regime_tributario: regime             || f.regime_tributario,
        inscricao_estadual: d.inscricaoEstadual || f.inscricao_estadual,
      }));
      toast.success('Dados preenchidos automaticamente');
    } catch {
      toast.error('CNPJ não encontrado ou inválido');
    } finally {
      setFetchingCnpj(false);
    }
  };

  // ── Produto CRUD ──────────────────────────────────────────────
  const handleSaveProduto = async () => {
    if (!empresaAtiva) return;
    if (!produtoForm.descricao.trim()) { toast.error('Descrição obrigatória'); return; }
    setSaving(true);
    const payload = { empresa_id: empresaAtiva.id, codigo: produtoForm.codigo || null, descricao: produtoForm.descricao.trim(), unidade: produtoForm.unidade || 'UN', categoria: produtoForm.categoria || null, saldo_minimo: parseNum(produtoForm.saldo_minimo), preco_custo_medio: parseNum(produtoForm.preco_custo_medio), ativo: produtoForm.ativo, ncm: produtoForm.ncm || null, cfop: produtoForm.cfop || null, cst_icms: produtoForm.cst_icms || null, csosn: produtoForm.csosn || null, cst_pis: produtoForm.cst_pis || null, cst_cofins: produtoForm.cst_cofins || null, p_icms: parseNum(produtoForm.p_icms) || null, p_pis: parseNum(produtoForm.p_pis) || null, p_cofins: parseNum(produtoForm.p_cofins) || null };
    let error: any;
    if (editingProduto) {
      ({ error } = await supabase.from('produtos').update(payload as any).eq('id', editingProduto.id));
      if (!error) toast.success('Produto atualizado!');
    } else {
      ({ error } = await supabase.from('produtos').insert(payload as any));
      if (!error) toast.success('Produto cadastrado!');
    }
    if (error) toast.error('Erro', { description: error.message });
    setSaving(false); setProdutoOpen(false); setEditingProduto(null); setProdutoForm(defaultProdutoForm()); loadAll();
  };

  const handleDeleteProduto = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir. Há movimentações?', { description: error.message }); return; }
    toast.success('Produto excluído');
    if (selectedProduto?.id === id) setSelectedProduto(null);
    loadAll();
  };

  // ── Auto-código produto ───────────────────────────────────────
  const generateNextCodigo = async (): Promise<string> => {
    if (!empresaAtiva) return 'PRD00001';
    const { data } = await supabase
      .from('produtos')
      .select('codigo')
      .eq('empresa_id', empresaAtiva.id)
      .like('codigo', 'PRD%')
      .order('codigo', { ascending: false })
      .limit(1);
    const last = data?.[0]?.codigo as string | undefined;
    if (!last) return 'PRD00001';
    const num = parseInt(last.replace('PRD', ''), 10);
    if (isNaN(num)) return 'PRD00001';
    return `PRD${String(num + 1).padStart(5, '0')}`;
  };

  const openNovoProduto = async () => {
    const codigo = await generateNextCodigo();
    setEditingProduto(null);
    setProdutoForm({ ...defaultProdutoForm(), codigo });
    setProdutoOpen(true);
  };

  // ── Movimentação manual ───────────────────────────────────────
  const handleSaveMovimento = async () => {
    if (!empresaAtiva || !user) return;
    if (!movForm.produto_id) { toast.error('Selecione um produto'); return; }
    const qty = parseNum(movForm.quantidade);
    if (qty <= 0) { toast.error('Quantidade deve ser maior que zero'); return; }
    let storedQty = Math.abs(qty);
    if (movForm.tipo === 'ajuste' && movForm.ajuste_dir === 'menos') storedQty = -storedQty;
    setSaving(true);
    const { error } = await supabase.from('estoque_movimentos').insert({
      empresa_id: empresaAtiva.id,
      produto_id: movForm.produto_id,
      tipo: movForm.tipo,
      origem: 'manual',
      quantidade: storedQty,
      preco_unitario: parseNum(movForm.preco_unitario) || null,
      observacoes: movForm.observacoes || null,
      created_by: user.id,
    } as any);
    if (error) toast.error('Erro ao registrar', { description: error.message });
    else toast.success('Movimentação registrada!');
    setSaving(false); setMovOpen(false); setMovForm(defaultMovForm()); loadAll();
    if (selectedProduto?.id === movForm.produto_id) reloadMovimentos(movForm.produto_id);
  };

  // ── Entrega → estoque ─────────────────────────────────────────
  const criarProdutoSeNovo = async (
    produtoId: string, nome: string, unidade: string,
    fiscal?: { ncm?: string; cfop?: string; cst_icms?: string; csosn?: string; cst_pis?: string; cst_cofins?: string; p_icms?: number; p_pis?: number; p_cofins?: number; codigo?: string; }
  ): Promise<string | null> => {
    if (produtoId !== '__new__') return produtoId;
    if (!empresaAtiva || !nome.trim()) return null;
    const { data, error } = await supabase.from('produtos').insert({
      empresa_id: empresaAtiva.id, descricao: nome.trim(), unidade: unidade || 'UN', ativo: true,
      ...(fiscal || {}),
    } as any).select('id').single();
    if (error || !data) { toast.error('Erro ao criar produto', { description: error?.message }); return null; }
    return (data as any).id;
  };

  const handleConfirmarEntrega = async () => {
    if (!entregaPedido || !empresaAtiva || !user) return;
    const validos = entregaMappings.filter(m => m.produtoId && m.produtoId !== '');
    if (!validos.length) { setEntregaOpen(false); return; }
    setSavingEntrega(true);
    const rows: any[] = [];
    for (const m of validos) {
      const pid = await criarProdutoSeNovo(m.produtoId, m.novaNome, m.item.unidade);
      if (!pid) continue;
      rows.push({ empresa_id: empresaAtiva.id, produto_id: pid, pedido_id: entregaPedido.id, tipo: 'entrada', origem: 'pedido_entregue', quantidade: Math.abs(m.item.quantidade), preco_unitario: m.item.preco_unitario || null, created_by: user.id });
    }
    if (rows.length) {
      const { error } = await supabase.from('estoque_movimentos').insert(rows as any);
      if (error) toast.error('Erro nas entradas de estoque', { description: error.message });
      else toast.success(`${rows.length} entrada(s) registrada(s) no estoque!`);
    }
    setSavingEntrega(false); setEntregaOpen(false); loadAll();
    if (selectedProduto) reloadMovimentos(selectedProduto.id);
  };

  // ── NF-e: XML parsing ─────────────────────────────────────────
  const handleNfeFile = (file: File) => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) { handleNfePdf(file); return; }
    if (!lower.endsWith('.xml')) { toast.error('Selecione um arquivo .xml ou .pdf'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      try {
        const testDoc = new DOMParser().parseFromString(text, 'application/xml');
        if (testDoc.querySelector('parsererror')) { toast.error('Arquivo XML inválido ou corrompido.'); return; }
        const parsed = parseNFeXML(text);
        if (!parsed.numero_nf && !parsed.v_nf) { toast.error('O arquivo não parece ser uma NF-e válida (nenhum dado encontrado).'); return; }
        setNfeParsed(parsed);
        setNfeXmlStr(text);
        const dataEmissao = parsed.data_emissao?.split('T')[0] ?? today();
        setNfeForm(f => ({ ...f, numero: String(parsed.numero_nf), serie: String(parsed.serie), chave_acesso: parsed.chave_acesso, data_emissao: dataEmissao, cnpj_emitente: parsed.cnpj_emitente, nome_emitente: parsed.nome_emitente, valor_total: String(parsed.v_nf) }));
        // Detecta fornecedor pelo CNPJ
        const cnpjNorm = normCnpj(parsed.cnpj_emitente || '');
        const fornFound = cnpjNorm ? (fornecedores.find(f => normCnpj(f.cnpj || '') === cnpjNorm) ?? null) : null;
        setNfeFornMatch(fornFound);
        setNfeCriarForn(!fornFound && !!cnpjNorm);
        // Auto-vincula itens da NF-e a produtos pelo código
        setNfeItemMaps(parsed.itens.map(item => {
          const matched = item.c_prod ? produtos.find(p => p.ativo && p.codigo === item.c_prod) : undefined;
          return { item, produtoId: matched?.id ?? '', novaNome: item.x_prod, incluir: true };
        }));
        setNfeStep(2);
      } catch {
        toast.error('Não foi possível ler o XML. Verifique se é uma NF-e válida.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleNfePdf = async (file: File) => {
    setNfePdfLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += 8192) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
      }
      const pdf_base64 = btoa(chunks.join(''));

      const { data: d, error } = await supabase.functions.invoke('extrair-dados-nfe-pdf', {
        body: { pdf_base64 },
      });
      console.log('[handleNfePdf] base64 length:', pdf_base64.length);
      console.log('[handleNfePdf] invoke error:', error);
      console.log('[handleNfePdf] invoke data:', d);
      if (error || !d) throw new Error(error?.message || 'falha na invoke');
      if (d.error) throw new Error(d.error);

      const parsed = d as NFeData;
      if (!parsed.numero_nf && !parsed.v_nf) {
        toast.error('Chave de acesso não encontrada no PDF. Use o arquivo XML para melhores resultados.');
        return;
      }
      setNfeParsed(parsed);
      setNfeXmlStr('');
      const dataEmissao = parsed.data_emissao?.split('T')[0] ?? today();
      setNfeForm(f => ({
        ...f,
        numero:         String(parsed.numero_nf || ''),
        serie:          String(parsed.serie || '1'),
        chave_acesso:   parsed.chave_acesso || '',
        data_emissao:   dataEmissao,
        cnpj_emitente:  parsed.cnpj_emitente || '',
        nome_emitente:  parsed.nome_emitente || '',
        valor_total:    String(parsed.v_nf || ''),
      }));
      const cnpjNorm = normCnpj(parsed.cnpj_emitente || '');
      const fornFound = cnpjNorm ? (fornecedores.find(f => normCnpj(f.cnpj || '') === cnpjNorm) ?? null) : null;
      setNfeFornMatch(fornFound);
      setNfeCriarForn(!fornFound && !!cnpjNorm);
      setNfeItemMaps((parsed.itens || []).map(item => {
        const matched = item.c_prod ? produtos.find(p => p.ativo && p.codigo === item.c_prod) : undefined;
        return { item, produtoId: matched?.id ?? '', novaNome: item.x_prod, incluir: true };
      }));
      setNfeStep(2);
      toast.success('Dados extraídos do DANFE com sucesso');
    } catch (err) {
      console.error('[handleNfePdf] catch:', err);
      toast.error('Não foi possível extrair dados do PDF. Use o arquivo XML para melhores resultados.');
    } finally {
      setNfePdfLoading(false);
    }
  };

  const handleSaveNfe = async () => {
    if (!empresaAtiva || !user) return;
    const num = nfeParsed ? String(nfeParsed.numero_nf) : nfeForm.numero;
    if (!num || num === '0') { toast.error('Número da NF-e obrigatório'); return; }
    setSaving(true);

    // Cria fornecedor automaticamente se solicitado
    let fornecedorId: string | null = nfeFornMatch?.id ?? null;
    if (!nfeFornMatch && nfeCriarForn && nfeParsed?.cnpj_emitente) {
      const { data: fd, error: fe } = await supabase
        .from('fornecedores')
        .insert({
          empresa_id: empresaAtiva.id,
          razao_social: nfeParsed.nome_emitente || nfeParsed.cnpj_emitente,
          cnpj: nfeParsed.cnpj_emitente, ativo: true,
          inscricao_estadual: nfeParsed.ie_emitente || null,
          regime_tributario: nfeParsed.crt_emitente ? String(nfeParsed.crt_emitente) : null,
          uf: nfeParsed.uf_emitente || null,
          municipio: nfeParsed.municipio_emitente || null,
          cep: nfeParsed.cep_emitente || null,
          logradouro: nfeParsed.logradouro_emitente || null,
          numero_endereco: nfeParsed.numero_emitente || null,
          bairro: nfeParsed.bairro_emitente || null,
        } as any)
        .select('id').single();
      if (!fe && fd) fornecedorId = (fd as any).id;
    }

    const payload: any = {
      empresa_id: empresaAtiva.id,
      pedido_id: nfeForm.pedido_id || null,
      fornecedor_id: fornecedorId,
      numero: num,
      serie: nfeParsed ? String(nfeParsed.serie) : (nfeForm.serie || '1'),
      chave_acesso: (nfeParsed?.chave_acesso || nfeForm.chave_acesso) || null,
      data_emissao: (nfeParsed ? nfeParsed.data_emissao?.split('T')[0] : nfeForm.data_emissao) || null,
      cnpj_emitente: (nfeParsed?.cnpj_emitente || nfeForm.cnpj_emitente) || null,
      nome_emitente: (nfeParsed?.nome_emitente || nfeForm.nome_emitente) || null,
      valor_total: nfeParsed ? nfeParsed.v_nf : parseNum(nfeForm.valor_total),
      xml_content: nfeMode === 'xml' ? nfeXmlStr : null,
      itens: nfeParsed ? nfeParsed.itens : null,
    };
    const { data: nfeRow, error } = await supabase.from('nfe_recebidas').insert(payload).select('id').single();
    if (error) { toast.error('Erro ao importar NF-e', { description: error.message }); setSaving(false); return; }

    const fornCriado = !!fornecedorId && !nfeFornMatch;
    if (nfeParsed && nfeRow) {
      const toCreate = nfeItemMaps.filter(m => m.incluir && m.produtoId);
      const rows: any[] = [];
      for (const m of toCreate) {
        const pid = await criarProdutoSeNovo(m.produtoId, m.novaNome, m.item.u_com, {
          ncm: m.item.ncm || undefined,
          cfop: m.item.cfop || undefined,
          cst_icms: m.item.cst_icms || undefined,
          csosn: m.item.csosn || undefined,
          cst_pis: m.item.cst_pis || undefined,
          cst_cofins: m.item.cst_cofins || undefined,
          p_icms: m.item.p_icms || undefined,
          p_pis: m.item.p_pis || undefined,
          p_cofins: m.item.p_cofins || undefined,
          codigo: m.item.c_prod || undefined,
        });
        if (!pid) continue;
        rows.push({ empresa_id: empresaAtiva.id, produto_id: pid, nfe_id: (nfeRow as any).id, pedido_id: nfeForm.pedido_id || null, tipo: 'entrada', origem: 'nfe', quantidade: Math.abs(m.item.q_com), preco_unitario: m.item.v_un_com || null, created_by: user.id });
      }
      if (rows.length) {
        const { error: me } = await supabase.from('estoque_movimentos').insert(rows as any);
        if (me) toast.error('NF-e salva, erro no estoque', { description: me.message });
        else {
          const parts = [fornCriado ? 'Fornecedor cadastrado' : null, `${rows.length} entrada(s) no estoque`].filter(Boolean).join(' · ');
          toast.success(`NF-e importada! · ${parts}`);
        }
      } else {
        toast.success(`NF-e importada!${fornCriado ? ' · Fornecedor cadastrado' : ''}`);
      }
    } else {
      toast.success('NF-e importada!');
    }
    setSaving(false); setNfeOpen(false); resetNfeDialog(); loadAll();
    if (selectedProduto) reloadMovimentos(selectedProduto.id);
  };

  const handleDeleteNfe = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('nfe_recebidas').delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    toast.success('NF-e excluída. Movimentações de estoque vinculadas foram mantidas.'); loadAll();
  };

  const resetNfeDialog = () => { setNfeParsed(null); setNfeXmlStr(''); setNfeForm(defaultNfeForm()); setNfeMode('xml'); setNfeRegEstoque(false); setNfeItemMaps([]); setNfeStep(1); setNfeFornMatch(null); setNfeCriarForn(false); };
  const resetPedidoForm = () => { setPedidoForm(defaultPedidoForm()); setFormItens([blankItem()]); };

  // ── Computed ──────────────────────────────────────────────────
  const todayStr       = today();
  const abertos        = pedidos.filter(p => p.status === 'rascunho' || p.status === 'aguardando');
  const valorComp      = abertos.reduce((s, p) => s + p.valor_total, 0);
  const contrVinc      = new Set(pedidos.map(p => p.contrato_id).filter(Boolean)).size;
  const atrasados      = abertos.filter(p => p.data_entrega_prevista && p.data_entrega_prevista < todayStr).length;
  const filtPedidos    = pedidos.filter(p => { const forn = fornecedores.find(f => f.id === p.fornecedor_id); const cont = contratos.find(c => c.id === p.contrato_id); const txt = `${p.observacoes ?? ''} ${forn?.razao_social ?? ''} ${cont?.numero_contrato ?? ''}`.toLowerCase(); return (!search || txt.includes(search.toLowerCase())) && (statusFilter === 'all' || p.status === statusFilter); });
  const filtForn       = fornecedores.filter(f => !fornSearch || f.razao_social.toLowerCase().includes(fornSearch.toLowerCase()) || (f.categoria ?? '').toLowerCase().includes(fornSearch.toLowerCase()));
  const filtProdutos   = produtos.filter(p => !estoqSearch || p.descricao.toLowerCase().includes(estoqSearch.toLowerCase()) || (p.codigo ?? '').toLowerCase().includes(estoqSearch.toLowerCase()) || (p.categoria ?? '').toLowerCase().includes(estoqSearch.toLowerCase()));
  const prodAlerta     = produtos.filter(p => p.ativo && p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo).length;
  const valorEstoque   = produtos.filter(p => p.ativo).reduce((s, p) => s + p.saldo_atual * p.preco_custo_medio, 0);
  const isOnboarding   = !loading && !pedidos.length && !fornecedores.length && !produtos.length && !nfes.length;

  const produtosAtivosParaSelect = produtos.filter(p => p.ativo);

  // ══ DETAIL: PRODUTO ══════════════════════════════════════════
  if (selectedProduto) {
    const p = selectedProduto;
    const emAlerta = p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo;
    return (
      <AppLayout>
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProduto(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Estoque
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{p.descricao}</h1>
                {p.codigo && <Badge variant="outline" className="text-[10px]">{p.codigo}</Badge>}
                {!p.ativo && <Badge className="text-[10px] bg-muted text-muted-foreground">Inativo</Badge>}
                {emAlerta && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40"><AlertCircle className="w-3 h-3 mr-1" />Estoque baixo</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {p.categoria && <span>{p.categoria}</span>}
                <span>Unidade: {p.unidade}</span>
                <span>Mínimo: {p.saldo_minimo} {p.unidade}</span>
                {p.preco_custo_medio > 0 && <span>Custo médio: {fmtCurrency(p.preco_custo_medio)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <div className={`text-right px-4 py-2 rounded-lg ${emAlerta ? 'bg-destructive/10' : 'bg-success/10'}`}>
                <p className="text-xs text-muted-foreground">Saldo Atual</p>
                <p className={`text-2xl font-bold ${emAlerta ? 'text-destructive' : 'text-success'}`}>
                  {p.saldo_atual.toLocaleString('pt-BR')} <span className="text-sm font-normal">{p.unidade}</span>
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setEditingProduto(p); setProdutoForm({ codigo: p.codigo ?? '', descricao: p.descricao, unidade: p.unidade, categoria: p.categoria ?? '', saldo_minimo: String(p.saldo_minimo), preco_custo_medio: String(p.preco_custo_medio), ativo: p.ativo, ncm: p.ncm ?? '', cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '', cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '', p_icms: p.p_icms != null ? String(p.p_icms) : '', p_pis: p.p_pis != null ? String(p.p_pis) : '', p_cofins: p.p_cofins != null ? String(p.p_cofins) : '' }); setProdutoOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setMovForm(f => ({ ...f, produto_id: p.id })); setMovOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Movimentação
              </Button>
            </div>
          </div>
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Histórico de Movimentações
          </h2>
          {movimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {movimentos.map(m => {
                const cfg = movConfig[m.tipo];
                const Icon = cfg.icon;
                const absQty = Math.abs(m.quantidade);
                const sign = m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : (m.quantidade >= 0 ? '+' : '');
                return (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${cfg.bg} flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${cfg.color}`}>
                          {sign}{absQty.toLocaleString('pt-BR')} {p.unidade}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                        {m.origem && m.origem !== 'manual' && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground capitalize">{m.origem.replace(/_/g, ' ')}</Badge>
                        )}
                      </div>
                      {m.observacoes && <p className="text-xs text-muted-foreground mt-0.5">{m.observacoes}</p>}
                      {m.preco_unitario != null && m.preco_unitario > 0 && (
                        <p className="text-xs text-muted-foreground">{fmtCurrency(m.preco_unitario)}/un · Total: {fmtCurrency(m.preco_unitario * absQty)}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* dialogs disponíveis na tela de detalhe */}
        <ProdutoDialog open={produtoOpen} onOpenChange={setProdutoOpen} editing={editingProduto} form={produtoForm} setForm={setProdutoForm} saving={saving} onSave={handleSaveProduto} onClose={() => { setEditingProduto(null); setProdutoForm(defaultProdutoForm()); }} />
        <MovDialog open={movOpen} onOpenChange={setMovOpen} form={movForm} setForm={setMovForm} saving={saving} onSave={handleSaveMovimento} produtos={produtosAtivosParaSelect} />
      </AppLayout>
    );
  }

  // ══ DETAIL: PEDIDO ═══════════════════════════════════════════
  if (selectedPedido) {
    const p    = selectedPedido;
    const forn = fornecedores.find(f => f.id === p.fornecedor_id);
    const cont = contratos.find(c => c.id === p.contrato_id);
    const cfg  = statusConfig[p.status];
    const Icon = cfg.icon;
    const isAtrasado = p.data_entrega_prevista && p.status !== 'entregue' && p.status !== 'cancelado' && p.data_entrega_prevista < todayStr;
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
                <Badge className={`${cfg.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                {isAtrasado && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Atrasado</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {forn && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{forn.razao_social}</span>}
                {cont && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />Contrato {cont.numero_contrato}</span>}
                {p.data_pedido && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Pedido: {fmtDate(p.data_pedido)}</span>}
                {p.data_entrega_prevista && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />Previsto: {fmtDate(p.data_entrega_prevista)}</span>}
                {p.data_entrega_real && <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" />Entregue: {fmtDate(p.data_entrega_real)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-right mr-1">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">{fmtCurrency(p.valor_total)}</p>
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
              <Button size="sm" variant="ghost" onClick={e => handleDeletePedido(p.id, e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Itens do Pedido</h2>
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
                      <td className="py-2 px-2 text-right">{fmtCurrency(item.preco_unitario)}</td>
                      <td className="py-2 pl-2 text-right font-medium">{fmtCurrency(item.preco_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="py-2 text-right text-xs text-muted-foreground pr-2 font-medium">Total do Pedido</td>
                    <td className="py-2 pl-2 text-right font-bold text-primary">{fmtCurrency(p.valor_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        {/* Dialog: entrega → estoque */}
        <Dialog open={entregaOpen} onOpenChange={o => { if (!o) setEntregaOpen(false); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar recebimento no estoque</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">Vincule cada item do pedido a um produto do catálogo para registrar a entrada no estoque. Itens sem vínculo serão ignorados.</p>
            <div className="space-y-3">
              {entregaMappings.map((m, idx) => (
                <div key={m.item.id} className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">{m.item.descricao}</p>
                  <p className="text-xs text-muted-foreground">{m.item.quantidade} {m.item.unidade} · {fmtCurrency(m.item.preco_unitario)}/un</p>
                  <Select value={m.produtoId} onValueChange={v => setEntregaMappings(arr => arr.map((x, i) => i === idx ? { ...x, produtoId: v } : x))}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="— Não registrar —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Não registrar —</SelectItem>
                      {produtosAtivosParaSelect.map(pr => (
                        <SelectItem key={pr.id} value={pr.id}>{pr.descricao}{pr.codigo ? ` (${pr.codigo})` : ''}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Criar novo produto</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.produtoId === '__new__' && (
                    <Input className="text-xs" placeholder="Nome do novo produto" value={m.novaNome} onChange={e => setEntregaMappings(arr => arr.map((x, i) => i === idx ? { ...x, novaNome: e.target.value } : x))} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEntregaOpen(false)}>Pular</Button>
              <Button onClick={handleConfirmarEntrega} disabled={savingEntrega}>
                {savingEntrega && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Registrar no Estoque
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // ══ LIST VIEW ════════════════════════════════════════════════
  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Compras e Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Pedidos, fornecedores, estoque e notas fiscais</p>
        </div>
        {!isOnboarding && (
          <div className="flex gap-2">
            {mainTab === 'fornecedores' ? (
              <Button onClick={() => { setEditingPessoa(null); setPessoaOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Fornecedor</Button>
            ) : mainTab === 'estoque' ? (
              <Button onClick={openNovoProduto}><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
            ) : mainTab === 'nfe' ? (
              <Button onClick={() => { resetNfeDialog(); setNfeOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Importar NF-e</Button>
            ) : mainTab === 'produtos' ? null : mainTab === 'pedidos' ? null : (
              <Button onClick={() => { resetPedidoForm(); setPedidoOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Novo Pedido</Button>
            )}
          </div>
        )}
      </div>

      {!empresaAtiva ? (
        <Card className="p-12 text-center"><Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Selecione uma empresa ativa para acessar o módulo de compras.</p></Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isOnboarding ? (
        <div className="min-h-[60vh] flex flex-col justify-center">
          <OnboardingCompras
            onCadastrarFornecedor={() => { setEditingPessoa(null); setPessoaOpen(true); }}
            onNovoPedido={() => { resetPedidoForm(); setPedidoOpen(true); }}
            onEstoque={() => { setMainTab('estoque'); openNovoProduto(); }}
            onImportarNfe={() => { resetNfeDialog(); setNfeOpen(true); }}
          />
        </div>
      ) : (
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pedidos"><ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Pedidos</TabsTrigger>
            <TabsTrigger value="produtos"><Package className="w-3.5 h-3.5 mr-1.5" /> Produtos</TabsTrigger>
            <TabsTrigger value="fornecedores"><Users className="w-3.5 h-3.5 mr-1.5" /> Fornecedores</TabsTrigger>
            <TabsTrigger value="estoque"><Warehouse className="w-3.5 h-3.5 mr-1.5" /> Estoque</TabsTrigger>
            <TabsTrigger value="nfe"><FileText className="w-3.5 h-3.5 mr-1.5" /> NF-e</TabsTrigger>
            <TabsTrigger value="certificado"><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Certificado</TabsTrigger>
          </TabsList>

          {/* ══ ABA PRODUTOS ══ */}
          <TabsContent value="produtos">
            <ProdutosOmie />
          </TabsContent>

          {/* ══ ABA PEDIDOS ══ */}
          <TabsContent value="pedidos">
            <PedidosOmie />
          </TabsContent>

          {/* ══ ABA FORNECEDORES ══ */}
          <TabsContent value="fornecedores" className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar fornecedor, CNPJ ou e-mail..." value={fornSearch} onChange={e => setFornSearch(e.target.value)} className="pl-9" /></div>
            {pessoasFornecedores.length === 0 ? (
              <Card className="p-12 text-center"><Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum fornecedor cadastrado</p></Card>
            ) : (
              <div className="space-y-2">
                {pessoasFornecedores
                  .filter(f => !fornSearch || f.nome.toLowerCase().includes(fornSearch.toLowerCase()) || (f.documento ?? '').includes(fornSearch) || (f.email ?? '').toLowerCase().includes(fornSearch.toLowerCase()))
                  .map(f => (
                  <Card key={f.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{f.nome}</span>
                          {f.nome_fantasia && <span className="text-xs text-muted-foreground">({f.nome_fantasia})</span>}
                          {f.tipo === 'ambos' && <Badge variant="outline" className="text-[10px]">Cliente e Fornecedor</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {f.documento && <span>{f.documento}</span>}
                          {f.email && <span>{f.email}</span>}
                          {f.telefone && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{f.telefone}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPessoa(f); setPessoaOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deletePessoa.mutate({ id: f.id })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ══ ABA ESTOQUE ══ */}
          <TabsContent value="estoque" className="space-y-4">
            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="w-4 h-4" /> Produtos Ativos</div><p className="text-2xl font-bold">{produtos.filter(p => p.ativo).length}</p></Card>
              <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertCircle className="w-4 h-4" /> Em Alerta</div><p className={`text-2xl font-bold ${prodAlerta > 0 ? 'text-destructive' : ''}`}>{prodAlerta}</p></Card>
              <Card className="p-4 col-span-2 sm:col-span-1"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Valor em Estoque</div><p className="text-lg font-bold leading-tight">{fmtCurrency(valorEstoque)}</p></Card>
            </div>

            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar produto, código ou categoria..." value={estoqSearch} onChange={e => setEstoqSearch(e.target.value)} className="pl-9" /></div>

            {filtProdutos.length === 0 ? (
              <Card className="p-12 text-center"><Warehouse className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground mb-3">Nenhum produto cadastrado</p><Button onClick={openNovoProduto}><Plus className="w-4 h-4 mr-2" />Novo Produto</Button></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtProdutos.map(p => {
                  const emAlerta = p.ativo && p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo;
                  return (
                    <Card key={p.id} className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${!p.ativo ? 'opacity-60' : ''}`} onClick={() => setSelectedProduto(p)}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.descricao}</p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {p.codigo && <span className="text-[10px] text-muted-foreground">{p.codigo}</span>}
                            {p.categoria && <Badge variant="outline" className="text-[10px]">{p.categoria}</Badge>}
                            {!p.ativo && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingProduto(p); setProdutoForm({ codigo: p.codigo ?? '', descricao: p.descricao, unidade: p.unidade, categoria: p.categoria ?? '', saldo_minimo: String(p.saldo_minimo), preco_custo_medio: String(p.preco_custo_medio), ativo: p.ativo, ncm: p.ncm ?? '', cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '', cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '', p_icms: p.p_icms != null ? String(p.p_icms) : '', p_pis: p.p_pis != null ? String(p.p_pis) : '', p_cofins: p.p_cofins != null ? String(p.p_cofins) : '' }); setProdutoOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => handleDeleteProduto(p.id, e)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                      <div className={`flex items-end justify-between p-3 rounded-lg ${emAlerta ? 'bg-destructive/10' : 'bg-success/10'}`}>
                        <div>
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className={`text-2xl font-bold ${emAlerta ? 'text-destructive' : 'text-success'}`}>{p.saldo_atual.toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">{p.unidade}</p>
                        </div>
                        <div className="text-right">
                          {emAlerta && <div className="flex items-center gap-1 text-destructive text-xs mb-1"><AlertCircle className="w-3 h-3" />Estoque baixo</div>}
                          <p className="text-xs text-muted-foreground">Mín: {p.saldo_minimo} {p.unidade}</p>
                          {p.preco_custo_medio > 0 && <p className="text-xs text-muted-foreground">Custo: {fmtCurrency(p.preco_custo_medio)}/un</p>}
                        </div>
                      </div>
                      {p.saldo_atual > 0 && p.preco_custo_medio > 0 && (
                        <p className="text-xs text-muted-foreground text-right mt-1">Valor: {fmtCurrency(p.saldo_atual * p.preco_custo_medio)}</p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ══ ABA NF-e ══ */}
          <TabsContent value="nfe" className="space-y-4">
            {nfes.length === 0 ? (
              <Card className="p-12 text-center"><FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground mb-3">Nenhuma NF-e importada</p><Button onClick={() => { resetNfeDialog(); setNfeOpen(true); }}><Plus className="w-4 h-4 mr-2" />Importar NF-e</Button></Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Número / Série</th>
                      <th className="text-left py-2 px-2 font-medium">Emitente</th>
                      <th className="text-right py-2 px-2 font-medium">Valor</th>
                      <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Pedido</th>
                      <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Data Emissão</th>
                      <th className="py-2 pl-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {nfes.map(n => {
                      const ped = pedidos.find(p => p.id === n.pedido_id);
                      return (
                        <tr key={n.id} className="hover:bg-muted/30">
                          <td className="py-3 pr-4">
                            <p className="font-medium">Nº {n.numero}</p>
                            <p className="text-xs text-muted-foreground">Série {n.serie}</p>
                          </td>
                          <td className="py-3 px-2">
                            <p className="font-medium truncate max-w-[180px]">{n.nome_emitente || '—'}</p>
                            {n.cnpj_emitente && <p className="text-xs text-muted-foreground">{n.cnpj_emitente}</p>}
                          </td>
                          <td className="py-3 px-2 text-right font-medium">{fmtCurrency(n.valor_total)}</td>
                          <td className="py-3 px-2 hidden sm:table-cell">
                            {ped ? <Badge variant="outline" className="text-[10px]">{ped.observacoes || 'Pedido'}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="py-3 px-2 hidden sm:table-cell text-muted-foreground text-xs">{fmtDate(n.data_emissao)}</td>
                          <td className="py-3 pl-2">
                            <Button size="sm" variant="ghost" onClick={e => handleDeleteNfe(n.id, e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ══ ABA CERTIFICADO ══ */}
          <TabsContent value="certificado" className="space-y-4">
            <CertificadoDigital />
          </TabsContent>
        </Tabs>
      )}

      {/* ══ DIALOGS GLOBAIS ══════════════════════════════════════ */}

      {/* Dialog: Novo Pedido */}
      <Dialog open={pedidoOpen} onOpenChange={o => { setPedidoOpen(o); if (!o) resetPedidoForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Pedido de Compra</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="md:col-span-2">
              <Label>Fornecedor *</Label>
              <Select value={pedidoForm.fornecedor_id} onValueChange={v => setPedidoForm(f => ({ ...f, fornecedor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                <SelectContent>{fornecedores.filter(f => f.ativo).map(f => <SelectItem key={f.id} value={f.id}>{f.razao_social}{f.categoria ? ` — ${f.categoria}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Contrato vinculado (opcional)</Label>
              <Select value={pedidoForm.contrato_id || 'none'} onValueChange={v => setPedidoForm(f => ({ ...f, contrato_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum contrato" /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Sem contrato —</SelectItem>{contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.numero_contrato} — {c.orgao_contratante}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data do Pedido</Label><Input type="date" value={pedidoForm.data_pedido} onChange={e => setPedidoForm(f => ({ ...f, data_pedido: e.target.value }))} /></div>
            <div><Label>Entrega Prevista</Label><Input type="date" value={pedidoForm.data_entrega_prevista} onChange={e => setPedidoForm(f => ({ ...f, data_entrega_prevista: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Descrição / Observações</Label><Textarea value={pedidoForm.observacoes} onChange={e => setPedidoForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Descreva o objeto deste pedido..." /></div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Itens do Pedido *</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setFormItens(i => [...i, blankItem()])}><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item</Button>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-1 text-xs text-muted-foreground px-1">
              <span className="col-span-5">Descrição</span><span className="col-span-2">Unidade</span><span className="col-span-2 text-right">Quantidade</span><span className="col-span-2 text-right">Preço unit.</span><span className="col-span-1" />
            </div>
            <div className="space-y-2">
              {formItens.map((item, idx) => {
                const sub = parseNum(item.quantidade) * parseNum(item.preco_unitario);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-5"><Input placeholder="Descrição do item" value={item.descricao} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))} className="text-xs" /></div>
                      <div className="col-span-4 sm:col-span-2"><Input placeholder="UN" value={item.unidade} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, unidade: e.target.value } : x))} className="text-xs" /></div>
                      <div className="col-span-3 sm:col-span-2"><Input type="number" min="0" step="1" placeholder="Qtd." value={item.quantidade} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))} className="text-xs" /></div>
                      <div className="col-span-4 sm:col-span-2"><Input type="number" min="0" step="0.01" placeholder="R$ unit." value={item.preco_unitario} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, preco_unitario: e.target.value } : x))} className="text-xs" /></div>
                      <div className="col-span-1 flex justify-center"><Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={formItens.length === 1} onClick={() => setFormItens(arr => arr.filter((_, i) => i !== idx))}><X className="w-3.5 h-3.5 text-destructive" /></Button></div>
                    </div>
                    {sub > 0 && <p className="text-right text-xs text-muted-foreground pr-10">= {fmtCurrency(sub)}</p>}
                  </div>
                );
              })}
            </div>
            {formItens.some(i => i.descricao.trim()) && (
              <div className="mt-3 p-2 rounded bg-muted/40 text-sm font-semibold text-right">Total: {fmtCurrency(formItens.reduce((s, i) => s + parseNum(i.quantidade) * parseNum(i.preco_unitario), 0))}</div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setPedidoOpen(false); resetPedidoForm(); }}>Cancelar</Button>
            <Button onClick={handleSavePedido} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar Pedido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Fornecedor — componente unificado com Financeiro */}
      <PessoaFormDialog
        open={pessoaOpen}
        onOpenChange={o => { setPessoaOpen(o); if (!o) setEditingPessoa(null); }}
        editing={editingPessoa}
        defaultTipo="fornecedor"
      />

      {/* Dialog: Produto */}
      <ProdutoDialog open={produtoOpen} onOpenChange={setProdutoOpen} editing={editingProduto} form={produtoForm} setForm={setProdutoForm} saving={saving} onSave={handleSaveProduto} onClose={() => { setEditingProduto(null); setProdutoForm(defaultProdutoForm()); }} />

      {/* Dialog: Movimentação */}
      <MovDialog open={movOpen} onOpenChange={setMovOpen} form={movForm} setForm={setMovForm} saving={saving} onSave={handleSaveMovimento} produtos={produtosAtivosParaSelect} />

      {/* Dialog: NF-e — wizard 3 etapas para XML, form flat para manual */}
      <Dialog open={nfeOpen} onOpenChange={o => { setNfeOpen(o); if (!o) resetNfeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {nfeMode === 'manual' ? 'Importar NF-e Recebida' :
               nfeStep === 1 ? 'Importar NF-e — Arquivo XML' :
               nfeStep === 2 ? 'Importar NF-e — Revisar dados' :
               'Importar NF-e — Vincular produtos ao estoque'}
            </DialogTitle>
          </DialogHeader>

          {/* Barra de progresso para modo XML */}
          {nfeMode === 'xml' && (
            <div className="flex items-center gap-2 mt-1 mb-3">
              <div className="flex gap-1 flex-1">
                {([1, 2, 3] as const).map(s => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${nfeStep >= s ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">Etapa {nfeStep} / 3</span>
            </div>
          )}

          {/* ── ETAPA 1: Upload ── */}
          {(nfeMode === 'manual' || (nfeMode === 'xml' && nfeStep === 1)) && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" variant={nfeMode === 'xml' ? 'default' : 'outline'} onClick={() => { setNfeMode('xml'); setNfeParsed(null); setTimeout(() => fileRef.current?.click(), 0); }}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Importar Arquivo
                </Button>
                <Button size="sm" variant={nfeMode === 'manual' ? 'default' : 'outline'} onClick={() => setNfeMode('manual')}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />Preencher manualmente
                </Button>
              </div>

              {nfeMode === 'xml' && (
                <div
                  className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${nfePdfLoading ? 'border-primary/40 bg-primary/5 cursor-wait' : `cursor-pointer ${nfeDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}`}
                  onClick={() => { if (!nfePdfLoading) fileRef.current?.click(); }}
                  onDragOver={e => { e.preventDefault(); if (!nfePdfLoading) setNfeDragging(true); }}
                  onDragLeave={() => setNfeDragging(false)}
                  onDrop={e => { e.preventDefault(); setNfeDragging(false); if (!nfePdfLoading) { const f = e.dataTransfer.files[0]; if (f) handleNfeFile(f); } }}
                >
                  {nfePdfLoading ? (
                    <>
                      <div className="flex justify-center mb-3">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      </div>
                      <p className="text-sm font-medium">Extraindo dados do DANFE...</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguarde, isso pode levar alguns segundos</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium">Clique ou arraste o arquivo aqui</p>
                      <p className="text-xs text-muted-foreground mt-1">O sistema detecta o fornecedor e os produtos automaticamente</p>
                      <p className="text-xs text-muted-foreground">Formatos aceitos: XML (NF-e 4.0) ou PDF (DANFE)</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept=".xml,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleNfeFile(f); e.target.value = ''; }} />
                </div>
              )}

              {nfeMode === 'manual' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label>Número *</Label><Input value={nfeForm.numero} onChange={e => setNfeForm(f => ({ ...f, numero: e.target.value }))} placeholder="000001" /></div>
                    <div><Label>Série</Label><Input value={nfeForm.serie} onChange={e => setNfeForm(f => ({ ...f, serie: e.target.value }))} /></div>
                    <div className="sm:col-span-2"><Label>Chave de Acesso (44 dígitos)</Label><Input value={nfeForm.chave_acesso} onChange={e => setNfeForm(f => ({ ...f, chave_acesso: e.target.value }))} placeholder="00000000000000000000000000000000000000000000" maxLength={44} /></div>
                    <div><Label>Data de Emissão</Label><Input type="date" value={nfeForm.data_emissao} onChange={e => setNfeForm(f => ({ ...f, data_emissao: e.target.value }))} /></div>
                    <div><Label>Valor Total *</Label><Input type="number" min="0" step="0.01" value={nfeForm.valor_total} onChange={e => setNfeForm(f => ({ ...f, valor_total: e.target.value }))} /></div>
                    <div><Label>CNPJ Emitente</Label><Input value={nfeForm.cnpj_emitente} onChange={e => setNfeForm(f => ({ ...f, cnpj_emitente: e.target.value }))} placeholder="00.000.000/0001-00" /></div>
                    <div><Label>Razão Social Emitente</Label><Input value={nfeForm.nome_emitente} onChange={e => setNfeForm(f => ({ ...f, nome_emitente: e.target.value }))} /></div>
                  </div>
                  <div className="border-t pt-4 space-y-4">
                    <div>
                      <Label>Vincular a pedido (opcional)</Label>
                      <Select value={nfeForm.pedido_id || 'none'} onValueChange={v => setNfeForm(f => ({ ...f, pedido_id: v === 'none' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sem pedido —</SelectItem>
                          {pedidos.filter(p => p.status !== 'cancelado').map(p => {
                            const forn = fornecedores.find(f => f.id === p.fornecedor_id);
                            return <SelectItem key={p.id} value={p.id}>{p.observacoes || 'Pedido'}{forn ? ` — ${forn.razao_social}` : ''} ({fmtCurrency(p.valor_total)})</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setNfeOpen(false); resetNfeDialog(); }}>Cancelar</Button>
                      <Button onClick={handleSaveNfe} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar NF-e
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ETAPA 2: Resumo NF-e + Fornecedor ── */}
          {nfeMode === 'xml' && nfeStep === 2 && nfeParsed && (
            <div className="space-y-4">
              <Card className="p-4 bg-success/5 border-success/30">
                <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />NF-e lida com sucesso
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">Número:</span> {nfeParsed.numero_nf} / Série {nfeParsed.serie}</div>
                  <div><span className="text-muted-foreground">Valor total:</span> <span className="font-semibold">{fmtCurrency(nfeParsed.v_nf)}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Emitente:</span> {nfeParsed.nome_emitente}{nfeParsed.cnpj_emitente ? ` — CNPJ ${nfeParsed.cnpj_emitente}` : ''}</div>
                  <div><span className="text-muted-foreground">Emissão:</span> {nfeParsed.data_emissao ? fmtDate(nfeParsed.data_emissao.split('T')[0]) : '—'}</div>
                  <div><span className="text-muted-foreground">Itens:</span> {nfeParsed.itens.length}</div>
                </div>
              </Card>

              {nfeFornMatch ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-success/30 bg-success/5">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Fornecedor já cadastrado</p>
                    <p className="text-xs text-muted-foreground">{nfeFornMatch.razao_social}{nfeFornMatch.cnpj ? ` — CNPJ ${nfeFornMatch.cnpj}` : ''}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                    <p className="text-sm font-medium">Novo fornecedor detectado</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{nfeParsed.nome_emitente || '—'}{nfeParsed.cnpj_emitente ? ` — CNPJ ${nfeParsed.cnpj_emitente}` : ''}</p>
                  {(nfeParsed.ie_emitente || nfeParsed.uf_emitente) && (
                    <p className="text-xs text-muted-foreground">
                      {[nfeParsed.uf_emitente && `UF: ${nfeParsed.uf_emitente}`, nfeParsed.ie_emitente && `IE: ${nfeParsed.ie_emitente}`, nfeParsed.crt_emitente === 1 ? 'Simples Nacional' : nfeParsed.crt_emitente === 3 ? 'Regime Normal' : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Switch id="criar-forn" checked={nfeCriarForn} onCheckedChange={setNfeCriarForn} />
                    <Label htmlFor="criar-forn" className="text-sm cursor-pointer">Cadastrar automaticamente como fornecedor</Label>
                  </div>
                </div>
              )}

              <div>
                <Label>Vincular a pedido (opcional)</Label>
                <Select value={nfeForm.pedido_id || 'none'} onValueChange={v => setNfeForm(f => ({ ...f, pedido_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem pedido —</SelectItem>
                    {pedidos.filter(p => p.status !== 'cancelado').map(p => {
                      const forn = fornecedores.find(f => f.id === p.fornecedor_id);
                      return <SelectItem key={p.id} value={p.id}>{p.observacoes || 'Pedido'}{forn ? ` — ${forn.razao_social}` : ''} ({fmtCurrency(p.valor_total)})</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => { setNfeParsed(null); setNfeXmlStr(''); setNfeStep(1); setNfeFornMatch(null); setNfeCriarForn(false); setNfeItemMaps([]); }}>
                  ← Trocar arquivo
                </Button>
                {nfeParsed.itens.length > 0 ? (
                  <Button onClick={() => setNfeStep(3)}>Próximo: Produtos →</Button>
                ) : (
                  <Button onClick={handleSaveNfe} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar NF-e
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Mapear itens → produtos ── */}
          {nfeMode === 'xml' && nfeStep === 3 && nfeParsed && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vincule cada item da NF-e a um produto do catálogo. Itens com produto selecionado serão
                registrados como entrada no estoque. Itens sem produto serão ignorados.
              </p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {nfeItemMaps.map((m, idx) => (
                  <div key={idx} className={`border rounded-lg p-3 space-y-2 transition-opacity ${!m.incluir ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-2">
                      <Checkbox checked={m.incluir}
                        onCheckedChange={v => setNfeItemMaps(arr => arr.map((x, i) => i === idx ? { ...x, incluir: !!v } : x))}
                        className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.item.x_prod}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.item.q_com} {m.item.u_com} · {fmtCurrency(m.item.v_un_com)}/un
                          {m.item.c_prod ? ` · Cód: ${m.item.c_prod}` : ''}
                          {m.produtoId && m.produtoId !== '__new__' && <span className="text-success ml-1">· Auto-vinculado</span>}
                        </p>
                        {(m.item.ncm || m.item.cfop || m.item.cst_icms || m.item.csosn) && (
                          <p className="text-[10px] text-muted-foreground/70">
                            {[m.item.ncm && `NCM ${m.item.ncm}`, m.item.cfop && `CFOP ${m.item.cfop}`, (m.item.cst_icms || m.item.csosn) && `CST ${m.item.cst_icms || m.item.csosn}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {m.incluir && (
                      <>
                        <Select value={m.produtoId} onValueChange={v => setNfeItemMaps(arr => arr.map((x, i) => i === idx ? { ...x, produtoId: v } : x))}>
                          <SelectTrigger className="text-xs h-8"><SelectValue placeholder="— Não registrar no estoque —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— Não registrar no estoque —</SelectItem>
                            {produtosAtivosParaSelect.map(pr => (
                              <SelectItem key={pr.id} value={pr.id}>{pr.descricao}{pr.codigo ? ` (${pr.codigo})` : ''}</SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Criar novo produto</SelectItem>
                          </SelectContent>
                        </Select>
                        {m.produtoId === '__new__' && (
                          <Input className="text-xs h-8" placeholder="Nome do novo produto"
                            value={m.novaNome}
                            onChange={e => setNfeItemMaps(arr => arr.map((x, i) => i === idx ? { ...x, novaNome: e.target.value } : x))} />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => setNfeStep(2)}>← Voltar</Button>
                <Button onClick={handleSaveNfe} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar NF-e
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ── Sub-componente: Dialog Produto ────────────────────────────
type ProdutoDialogProps = {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Produto | null;
  form: ReturnType<typeof defaultProdutoForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof defaultProdutoForm>>>;
  saving: boolean; onSave: () => void; onClose: () => void;
};
function ProdutoDialog({ open, onOpenChange, editing, form, setForm, saving, onSave, onClose }: ProdutoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div className="sm:col-span-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
          <div>
            <Label>Código</Label>
            <Input
              value={form.codigo}
              readOnly={!editing}
              onChange={e => { if (editing) setForm(f => ({ ...f, codigo: e.target.value })); }}
              className={!editing ? 'bg-muted/50 cursor-default select-none' : ''}
            />
            {!editing && <p className="text-[11px] text-muted-foreground mt-1">Gerado automaticamente pelo sistema</p>}
          </div>
          <div><Label>Unidade</Label><Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="UN, KG, M², L..." /></div>
          <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="ex: Material, EPI..." /></div>
          <div><Label>Saldo Mínimo</Label><Input type="number" min="0" step="0.01" value={form.saldo_minimo} onChange={e => setForm(f => ({ ...f, saldo_minimo: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Preço de Custo unitário (R$)</Label><Input type="number" min="0" step="0.01" value={form.preco_custo_medio} onChange={e => setForm(f => ({ ...f, preco_custo_medio: e.target.value }))} placeholder="0,00" /></div>
          <div className="flex items-center gap-3 sm:col-span-2 mt-1"><Switch id="prod-ativo" checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label htmlFor="prod-ativo" className="cursor-pointer">Produto ativo</Label></div>
          <div className="sm:col-span-2 border-t pt-3 mt-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Fiscais (preenchidos automaticamente via NF-e)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">NCM</Label><Input className="text-xs h-8" value={form.ncm} onChange={e => setForm(f => ({ ...f, ncm: e.target.value }))} placeholder="00000000" /></div>
              <div><Label className="text-xs">CFOP</Label><Input className="text-xs h-8" value={form.cfop} onChange={e => setForm(f => ({ ...f, cfop: e.target.value }))} placeholder="0000" /></div>
              <div><Label className="text-xs">CST ICMS</Label><Input className="text-xs h-8" value={form.cst_icms} onChange={e => setForm(f => ({ ...f, cst_icms: e.target.value }))} placeholder="00" /></div>
              <div><Label className="text-xs">CSOSN</Label><Input className="text-xs h-8" value={form.csosn} onChange={e => setForm(f => ({ ...f, csosn: e.target.value }))} placeholder="102" /></div>
              <div><Label className="text-xs">Alíq. ICMS %</Label><Input type="number" className="text-xs h-8" value={form.p_icms} onChange={e => setForm(f => ({ ...f, p_icms: e.target.value }))} placeholder="12" /></div>
              <div><Label className="text-xs">Alíq. PIS %</Label><Input type="number" className="text-xs h-8" value={form.p_pis} onChange={e => setForm(f => ({ ...f, p_pis: e.target.value }))} placeholder="0.65" /></div>
              <div><Label className="text-xs">Alíq. COFINS %</Label><Input type="number" className="text-xs h-8" value={form.p_cofins} onChange={e => setForm(f => ({ ...f, p_cofins: e.target.value }))} placeholder="3.00" /></div>
              <div><Label className="text-xs">CST PIS</Label><Input className="text-xs h-8" value={form.cst_pis} onChange={e => setForm(f => ({ ...f, cst_pis: e.target.value }))} placeholder="07" /></div>
              <div><Label className="text-xs">CST COFINS</Label><Input className="text-xs h-8" value={form.cst_cofins} onChange={e => setForm(f => ({ ...f, cst_cofins: e.target.value }))} placeholder="07" /></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-componente: Dialog Movimentação ───────────────────────
type MovDialogProps = {
  open: boolean; onOpenChange: (v: boolean) => void;
  form: ReturnType<typeof defaultMovForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof defaultMovForm>>>;
  saving: boolean; onSave: () => void; produtos: Produto[];
};
function MovDialog({ open, onOpenChange, form, setForm, saving, onSave, produtos }: MovDialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Movimentação de Estoque</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-3">
          <div>
            <Label>Produto *</Label>
            <Select value={form.produto_id} onValueChange={v => setForm(f => ({ ...f, produto_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>{produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.descricao}{p.codigo ? ` (${p.codigo})` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v: any) => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada"><span className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-green-600" />Entrada</span></SelectItem>
                <SelectItem value="saida"><span className="flex items-center gap-2"><TrendingDown className="w-3.5 h-3.5 text-red-600" />Saída</span></SelectItem>
                <SelectItem value="ajuste"><span className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5 text-blue-600" />Ajuste</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipo === 'ajuste' && (
            <div>
              <Label>Tipo de Ajuste</Label>
              <Select value={form.ajuste_dir} onValueChange={(v: any) => setForm(f => ({ ...f, ajuste_dir: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mais">Adicionar ao saldo (+)</SelectItem>
                  <SelectItem value="menos">Reduzir o saldo (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Quantidade *</Label>
            <Input type="number" min="0.001" step="0.001" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" />
          </div>
          {(form.tipo === 'entrada' || form.tipo === 'ajuste') && (
            <div>
              <Label>Preço Unitário (opcional)</Label>
              <Input type="number" min="0" step="0.01" value={form.preco_unitario} onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))} placeholder="R$ 0,00" />
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Motivo, referência, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onboarding — exibido quando não há nenhum dado cadastrado
// ═══════════════════════════════════════════════════════════════
type OnboardingProps = {
  onCadastrarFornecedor: () => void;
  onNovoPedido: () => void;
  onEstoque: () => void;
  onImportarNfe: () => void;
};

function OnboardingCompras({ onCadastrarFornecedor, onNovoPedido, onEstoque, onImportarNfe }: OnboardingProps) {
  const steps: { icon: React.ElementType; title: string; desc: string; btn: string; onClick: () => void }[] = [
    { icon: Building2, title: 'Cadastre Fornecedores', desc: 'Adicione os fornecedores com quem você vai trabalhar.', btn: 'Cadastrar Fornecedor', onClick: onCadastrarFornecedor },
    { icon: Package,   title: 'Monte o Catálogo',      desc: 'Cadastre os produtos e materiais que gerencia.', btn: 'Novo Produto', onClick: onEstoque },
    { icon: ShoppingCart, title: 'Registre uma Compra', desc: 'Crie seu primeiro pedido de compra.', btn: 'Nova Compra', onClick: onNovoPedido },
    { icon: Warehouse, title: 'Movimente o Estoque',   desc: 'Controle entradas e saídas do seu estoque.', btn: 'Ver Estoque', onClick: onEstoque },
    { icon: FileText,  title: 'Importe NF-e Recebida', desc: 'Vincule notas fiscais recebidas às suas compras.', btn: 'Importar NF-e', onClick: onImportarNfe },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4">
      <p className="text-base text-muted-foreground text-center mb-12">Siga as etapas abaixo para configurar seu fluxo de compras.</p>
      <ol>
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isLast   = idx === steps.length - 1;
          return (
            <li key={idx} className="flex gap-5">
              <div className="flex flex-col items-center pt-0.5">
                <div className="flex items-center justify-center w-11 h-11 rounded-full border-2 border-primary/40 bg-primary/10 text-primary text-sm font-bold flex-shrink-0">{idx + 1}</div>
                {!isLast && <div className="w-px flex-1 bg-border mt-2 mb-2 min-h-[32px]" />}
              </div>
              <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 ${isLast ? 'pb-0' : 'pb-10'}`}>
                <div className="flex items-start gap-3 flex-1">
                  <StepIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div><p className="text-base font-semibold leading-tight">{step.title}</p><p className="text-sm text-muted-foreground mt-1">{step.desc}</p></div>
                </div>
                <Button size="sm" variant="outline" onClick={step.onClick} className="shrink-0 self-start sm:self-auto">{step.btn}</Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
