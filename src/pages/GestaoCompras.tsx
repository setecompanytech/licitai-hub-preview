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
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import LinhaKpis from '@/components/shared/LinhaKpis';
import { Skeleton } from '@/components/ui/skeleton';
import { analisarParaMargem, precificarEntrada, situacaoDoPrecoContratado, type AnaliseMargemEmpresa } from '@/lib/financeiro/margem-sugerida';
import {
  ShoppingCart, Plus, Search, Trash2, ArrowLeft, Loader2,
  Building2, Calendar, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Package, Truck, Users, X, Pencil, FileText,
  Warehouse, TrendingUp, TrendingDown, Upload, RotateCcw, AlertCircle, ShieldCheck, PackagePlus,
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
  codigo_ean?: string | null;
};

type EstoqueMovimento = {
  id: string; empresa_id: string; produto_id: string; pedido_id: string | null;
  nfe_id: string | null; tipo: 'entrada' | 'saida' | 'ajuste'; origem: string;
  quantidade: number; preco_unitario: number | null; observacoes: string | null;
  created_by: string | null; created_at: string;
};

// Espelho da tabela CANÔNICA nfe_entradas — a legada nfe_recebidas não tinha
// empresa_id e todo o fluxo de NF-e do Compras falhava em produção (09/09).
// Unificada, a NF-e que chega pelo webhook do Financeiro também aparece aqui,
// pronta para a entrada no estoque.
type NfeRecebida = {
  id: string; empresa_id: string; pedido_id: string | null; fornecedor_id: string | null;
  numero: string; serie: string; chave: string | null; data_emissao: string | null;
  emitente_cnpj: string | null; emitente_nome: string | null;
  valor_total: number; xml: string | null; itens: NFeItemData[] | null;
  recebida_em: string; origem?: string | null;
};

// ── Config ────────────────────────────────────────────────────
// Status sempre com texto — a cor é reforço (famílias tint/ink do Badge).
const statusConfig: Record<string, { label: string; variant: 'muted' | 'warning' | 'success' | 'danger'; icon: typeof CheckCircle2 }> = {
  rascunho:   { label: 'Rascunho',   variant: 'muted',   icon: Clock },
  aguardando: { label: 'Aguardando', variant: 'warning', icon: Truck },
  entregue:   { label: 'Entregue',   variant: 'success', icon: CheckCircle2 },
  cancelado:  { label: 'Cancelado',  variant: 'danger',  icon: X },
};

const movConfig = {
  entrada: { label: 'Entrada', color: 'text-success-ink',     bg: 'bg-success-tint',     icon: TrendingUp,   sign: '+' },
  saida:   { label: 'Saída',   color: 'text-destructive-ink', bg: 'bg-destructive-tint', icon: TrendingDown, sign: '-' },
  ajuste:  { label: 'Ajuste',  color: 'text-foreground',      bg: 'bg-muted',            icon: RotateCcw,    sign: '±' },
};

// ── Form defaults ─────────────────────────────────────────────
const defaultPedidoForm  = () => ({ contrato_id: '', fornecedor_id: '', data_pedido: today(), data_entrega_prevista: '', observacoes: '' });
const defaultFornForm    = () => ({ razao_social: '', cnpj: '', categoria: '', prazo_entrega_dias: '', contato_nome: '', contato_email: '', contato_telefone: '', observacoes: '', ativo: true, inscricao_estadual: '', regime_tributario: '', uf: '', municipio: '', cep: '', logradouro: '', numero_endereco: '', bairro: '' });
const defaultProdutoForm = () => ({ codigo: '', descricao: '', unidade: 'UN', categoria: '', saldo_minimo: '0', preco_custo_medio: '0', ativo: true, ncm: '', cfop: '', cst_icms: '', csosn: '', cst_pis: '', cst_cofins: '', p_icms: '', p_pis: '', p_cofins: '' });
const defaultMovForm     = () => ({ produto_id: '', tipo: 'entrada' as EstoqueMovimento['tipo'], ajuste_dir: 'mais' as 'mais' | 'menos', quantidade: '', preco_unitario: '', observacoes: '' });
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
  const [nfesComEstoque, setNfesComEstoque] = useState<Set<string>>(new Set());
  // NF-e que JÁ está no acervo (chegou pelo webhook/importação do Financeiro)
  // e vai só lançar estoque: o salvar pula o insert e usa este id.
  const [nfeExistenteId, setNfeExistenteId] = useState<string | null>(null);
  // Fase B: régua de precificação na entrada — carga tributária e despesas
  // da DRE real + margem alvo da empresa; preço de contrato vigente por
  // produto para o confronto sugerido × contratado.
  const [margemInfo, setMargemInfo] = useState<{ analise: AnaliseMargemEmpresa; alvo: number } | null>(null);
  const [precosContrato, setPrecosContrato] = useState<Map<string, { preco: number; numero: string }>>(new Map());

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
  useEffect(() => {
    if (!nfeOpen || nfeStep !== 3 || !empresaAtiva?.id || margemInfo) return;
    (async () => {
      try {
        const inicio = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
        const [lancRes, empRes, cfgTribRes, cfgCustosRes, ciRes] = await Promise.all([
          (supabase as any).from('financeiro_lancamentos')
            .select('natureza, valor, categoria:financeiro_categorias!financeiro_lancamentos_categoria_id_fkey(grupo_dre, natureza)')
            .eq('empresa_id', empresaAtiva.id)
            .in('tipo', ['a_receber', 'a_pagar'])
            .in('status', ['realizado', 'conciliado'])
            .gte('data_competencia', inicio),
          supabase.from('empresas').select('regime_tributario').eq('id', empresaAtiva.id).maybeSingle(),
          supabase.from('financeiro_config_tributaria').select('*').eq('empresa_id', empresaAtiva.id).maybeSingle(),
          (supabase.from('financeiro_config_custos' as never) as any).select('margem_alvo').eq('empresa_id', empresaAtiva.id).maybeSingle(),
          (supabase.from('contrato_itens') as any)
            .select('produto_id, valor_unitario, contratos!inner(numero_contrato, data_fim, tipo_documento, excluido_em, empresa_id)')
            .not('produto_id', 'is', null),
        ]);
        const analise = analisarParaMargem(
          (lancRes.data as any[]) || [],
          (empRes.data as { regime_tributario?: string | null } | null)?.regime_tributario,
          (cfgTribRes.data as any) ?? null,
        );
        const alvoCfg = Number((cfgCustosRes.data as { margem_alvo?: number } | null)?.margem_alvo);
        const hoje = today();
        const mapa = new Map<string, { preco: number; numero: string }>();
        for (const ci of (ciRes.data as any[]) || []) {
          const c = ci.contratos;
          if (!c || c.empresa_id !== empresaAtiva.id || c.excluido_em || c.tipo_documento !== 'contrato') continue;
          if (c.data_fim && c.data_fim < hoje) continue;
          if (ci.produto_id && Number(ci.valor_unitario) > 0) {
            mapa.set(ci.produto_id, { preco: Number(ci.valor_unitario), numero: c.numero_contrato || '' });
          }
        }
        setPrecosContrato(mapa);
        setMargemInfo({ analise, alvo: Number.isFinite(alvoCfg) ? alvoCfg : 10 });
      } catch { /* régua é apoio: sem ela o lançamento segue */ }
    })();
  }, [nfeOpen, nfeStep, empresaAtiva?.id, margemInfo]);

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
      const [{ data: p }, { data: f }, { data: pr }, { data: n }, { data: mov }] = await Promise.all([
        supabase.from('pedidos_compra').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false }),
        supabase.from('fornecedores').select('*').eq('empresa_id', empresaAtiva.id).order('razao_social'),
        supabase.from('produtos').select('*').eq('empresa_id', empresaAtiva.id).order('descricao'),
        (supabase.from('nfe_entradas' as never) as any).select('*').eq('empresa_id', empresaAtiva.id).order('recebida_em', { ascending: false }),
        // Quais NF-e já viraram estoque: decide o botão "Lançar estoque" e o selo.
        supabase.from('estoque_movimentos').select('nfe_id').eq('empresa_id', empresaAtiva.id).not('nfe_id', 'is', null),
      ]);
      setNfesComEstoque(new Set(((mov as Array<{ nfe_id: string }> | null) || []).map(m => m.nfe_id)));
      setPedidos((p as PedidoCompra[]) || []);
      setFornecedores((f as Fornecedor[]) || []);
      setProdutos((pr as Produto[]) || []);
      // itens é Json no banco, mas o app sempre grava NFeItemData[] (via parseNFeXML) — conversão Json -> domínio
      setNfes((n as unknown as NfeRecebida[]) || []);
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

    let nfeRow: { id: string } | null = null;
    if (nfeExistenteId) {
      // A NF já mora no acervo (webhook/importação) — só complementa o que o
      // fluxo de compra conhece: fornecedor, pedido e o cache de itens.
      const { error } = await (supabase.from('nfe_entradas' as never) as any).update({
        pedido_id: nfeForm.pedido_id || null,
        fornecedor_id: fornecedorId,
        itens: nfeParsed ? nfeParsed.itens : null,
      }).eq('id', nfeExistenteId);
      if (error) { toast.error('Erro ao atualizar NF-e', { description: error.message }); setSaving(false); return; }
      nfeRow = { id: nfeExistenteId };
    } else {
      const payload: any = {
        empresa_id: empresaAtiva.id,
        pedido_id: nfeForm.pedido_id || null,
        fornecedor_id: fornecedorId,
        numero: num,
        serie: nfeParsed ? String(nfeParsed.serie) : (nfeForm.serie || '1'),
        chave: (nfeParsed?.chave_acesso || nfeForm.chave_acesso) || null,
        data_emissao: (nfeParsed ? nfeParsed.data_emissao?.split('T')[0] : nfeForm.data_emissao) || null,
        emitente_cnpj: (nfeParsed?.cnpj_emitente || nfeForm.cnpj_emitente) || null,
        emitente_nome: (nfeParsed?.nome_emitente || nfeForm.nome_emitente) || null,
        destinatario_cnpj: (empresaAtiva as { cnpj?: string | null }).cnpj ?? null,
        valor_total: nfeParsed ? nfeParsed.v_nf : parseNum(nfeForm.valor_total),
        xml: nfeMode === 'xml' ? nfeXmlStr : null,
        itens: nfeParsed ? nfeParsed.itens : null,
        origem: 'importacao_compras',
        situacao: 'recebida',
      };
      // Upsert pela chave: a mesma NF pode já ter chegado pelo webhook — não
      // vira linha duplicada, os dados do compras complementam a existente.
      const { data, error } = await (supabase.from('nfe_entradas' as never) as any)
        .upsert(payload, { onConflict: 'empresa_id,chave' })
        .select('id').single();
      if (error) { toast.error('Erro ao importar NF-e', { description: error.message }); setSaving(false); return; }
      nfeRow = data as { id: string };
    }

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
          // Custo médio ponderado: (saldo antigo × custo antigo + entrada ×
          // custo da NF) ÷ novo saldo. O saldo_atual do estado é o de ANTES
          // da entrada (o trigger recalcula no banco depois do insert).
          for (const r of rows) {
            const custoNf = Number(r.preco_unitario) || 0;
            const qtd = Number(r.quantidade) || 0;
            if (custoNf <= 0 || qtd <= 0) continue;
            const p = produtos.find(x => x.id === r.produto_id);
            const saldoAntes = Math.max(Number(p?.saldo_atual) || 0, 0);
            const custoAntes = Number(p?.preco_custo_medio) || 0;
            const novoCusto = saldoAntes > 0 && custoAntes > 0
              ? (saldoAntes * custoAntes + qtd * custoNf) / (saldoAntes + qtd)
              : custoNf;
            await supabase.from('produtos')
              .update({ preco_custo_medio: Math.round(novoCusto * 100) / 100 } as never)
              .eq('id', r.produto_id);
          }
          const parts = [fornCriado ? 'Fornecedor cadastrado' : null, `${rows.length} entrada(s) no estoque`, 'custo médio atualizado'].filter(Boolean).join(' · ');
          toast.success(`NF-e ${nfeExistenteId ? 'lançada no estoque' : 'importada'}! · ${parts}`);
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
    const { error } = await (supabase.from('nfe_entradas' as never) as any).delete().eq('id', id);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    toast.success('NF-e excluída. Movimentações de estoque vinculadas foram mantidas.'); loadAll();
  };

  const resetNfeDialog = () => { setNfeParsed(null); setNfeXmlStr(''); setNfeForm(defaultNfeForm()); setNfeMode('xml'); setNfeRegEstoque(false); setNfeItemMaps([]); setNfeStep(1); setNfeFornMatch(null); setNfeCriarForn(false); setNfeExistenteId(null); };

  // NF-e que chegou pronta ao acervo (webhook do Financeiro, importação) e
  // ainda não virou estoque: reabre o MESMO diálogo de importação direto no
  // passo de casar itens com o catálogo, pulando o insert no salvar.
  const abrirLancamentoEstoque = (n: NfeRecebida) => {
    if (!n.xml) { toast.error('Esta NF-e não tem XML armazenado — importe o arquivo XML para lançar o estoque.'); return; }
    try {
      const parsed = parseNFeXML(n.xml);
      if (!parsed.itens?.length) { toast.error('Nenhum item encontrado no XML desta NF-e.'); return; }
      resetNfeDialog();
      setNfeParsed(parsed);
      setNfeXmlStr(n.xml);
      const dataEmissao = parsed.data_emissao?.split('T')[0] ?? today();
      setNfeForm(f => ({ ...f, numero: String(parsed.numero_nf), serie: String(parsed.serie), chave_acesso: parsed.chave_acesso, data_emissao: dataEmissao, cnpj_emitente: parsed.cnpj_emitente, nome_emitente: parsed.nome_emitente, valor_total: String(parsed.v_nf) }));
      const cnpjNorm = normCnpj(parsed.cnpj_emitente || '');
      const fornFound = cnpjNorm ? (fornecedores.find(f => normCnpj(f.cnpj || '') === cnpjNorm) ?? null) : null;
      setNfeFornMatch(fornFound);
      setNfeCriarForn(!fornFound && !!cnpjNorm);
      setNfeItemMaps(parsed.itens.map(item => {
        const matched = (item.c_prod ? produtos.find(p => p.ativo && p.codigo === item.c_prod) : undefined)
          ?? (item.c_ean ? produtos.find(p => p.ativo && p.codigo_ean && p.codigo_ean === item.c_ean) : undefined);
        return { item, produtoId: matched?.id ?? '', novaNome: item.x_prod, incluir: true };
      }));
      setNfeExistenteId(n.id);
      setNfeStep(2);
      setNfeOpen(true);
    } catch {
      toast.error('Não foi possível ler o XML desta NF-e.');
    }
  };
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
        <Button variant="ghost" size="sm" onClick={() => setSelectedProduto(null)} className="mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Estoque
        </Button>
        <CabecalhoPagina
          titulo={p.descricao}
          icone={<Package />}
          descricao={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {p.categoria && <span>{p.categoria}</span>}
              <span>Unidade: {p.unidade}</span>
              <span>Mínimo: {p.saldo_minimo} {p.unidade}</span>
              {p.preco_custo_medio > 0 && <span>Custo médio: {fmtCurrency(p.preco_custo_medio)}</span>}
            </span>
          }
          acoes={
            <>
              <Button variant="outline" aria-label="Editar produto" onClick={() => { setEditingProduto(p); setProdutoForm({ codigo: p.codigo ?? '', descricao: p.descricao, unidade: p.unidade, categoria: p.categoria ?? '', saldo_minimo: String(p.saldo_minimo), preco_custo_medio: String(p.preco_custo_medio), ativo: p.ativo, ncm: p.ncm ?? '', cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '', cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '', p_icms: p.p_icms != null ? String(p.p_icms) : '', p_pis: p.p_pis != null ? String(p.p_pis) : '', p_cofins: p.p_cofins != null ? String(p.p_cofins) : '' }); setProdutoOpen(true); }}>
                <Pencil className="w-4 h-4" /> Editar
              </Button>
              <Button onClick={() => { setMovForm(f => ({ ...f, produto_id: p.id })); setMovOpen(true); }}>
                <Plus className="w-4 h-4" /> Movimentação
              </Button>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            {p.codigo && <Badge variant="info">{p.codigo}</Badge>}
            {!p.ativo && <Badge variant="muted">Inativo</Badge>}
            {emAlerta && <Badge variant="danger"><AlertCircle className="w-3 h-3 mr-1" />Estoque baixo</Badge>}
            <div className={`ml-auto rounded-lg border px-4 py-2 text-right ${emAlerta ? 'border-destructive-line bg-destructive-tint' : 'border-success-line bg-success-tint'}`}>
              <p className="text-xs text-muted-foreground">Saldo atual</p>
              <p className={`text-[2rem] leading-10 font-bold tabular-nums ${emAlerta ? 'text-destructive-ink' : 'text-success-ink'}`}>
                {p.saldo_atual.toLocaleString('pt-BR')} <span className="text-sm font-normal">{p.unidade}</span>
              </p>
            </div>
          </div>
        </CabecalhoPagina>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-muted-foreground" /> Histórico de Movimentações
          </h2>
          {movimentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><RotateCcw className="w-6 h-6" aria-hidden="true" /></span>
              <p className="mt-3 text-lg font-semibold">Nenhuma movimentação</p>
              <p className="mt-1 text-sm text-muted-foreground">Entradas, saídas e ajustes deste produto aparecem aqui.</p>
            </div>
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
                      <Icon className={`w-4 h-4 ${cfg.color}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold tabular-nums ${cfg.color}`}>
                          {sign}{absQty.toLocaleString('pt-BR')} {p.unidade}
                        </span>
                        <Badge variant="info">{cfg.label}</Badge>
                        {m.origem && m.origem !== 'manual' && (
                          <Badge variant="muted" className="capitalize">{m.origem.replace(/_/g, ' ')}</Badge>
                        )}
                      </div>
                      {m.observacoes && <p className="text-xs text-muted-foreground mt-1">{m.observacoes}</p>}
                      {m.preco_unitario != null && m.preco_unitario > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">{fmtCurrency(m.preco_unitario)}/un · Total: {fmtCurrency(m.preco_unitario * absQty)}</p>
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
        {/* Ver comentário equivalente em GestaoContratos: este devolve à
            lista, o Voltar do layout sai da tela. */}
        <Button variant="ghost" size="sm" onClick={() => setSelectedPedido(null)} className="mb-4">
          <ArrowLeft className="w-4 h-4" /> Todos os pedidos
        </Button>
        <CabecalhoPagina
          titulo={p.observacoes || 'Pedido de Compra'}
          icone={<ShoppingCart />}
          descricao={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {forn && <span className="flex items-center gap-1"><Truck className="w-4 h-4" aria-hidden="true" />{forn.razao_social}</span>}
              {cont && <span className="flex items-center gap-1"><Building2 className="w-4 h-4" aria-hidden="true" />Contrato {cont.numero_contrato}</span>}
              {p.data_pedido && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" aria-hidden="true" />Pedido: {fmtDate(p.data_pedido)}</span>}
              {p.data_entrega_prevista && <span className="flex items-center gap-1"><Truck className="w-4 h-4" aria-hidden="true" />Previsto: {fmtDate(p.data_entrega_prevista)}</span>}
              {p.data_entrega_real && <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Entregue: {fmtDate(p.data_entrega_real)}</span>}
            </span>
          }
          acoes={
            <>
              <Select value={p.status} onValueChange={(v: any) => handleUpdateStatus(v)}>
                <SelectTrigger className="w-44" aria-label="Status do pedido"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" aria-label="Excluir pedido" onClick={e => handleDeletePedido(p.id, e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={cfg.variant}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
            {isAtrasado && <Badge variant="danger"><AlertTriangle className="w-3 h-3 mr-1" />Atrasado</Badge>}
            <div className="ml-auto rounded-lg border border-border bg-card px-4 py-2 text-right">
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="text-[2rem] leading-10 font-bold tabular-nums">{fmtCurrency(p.valor_total)}</p>
            </div>
          </div>
        </CabecalhoPagina>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-muted-foreground" /> Itens do Pedido</h2>
          {itensPedido.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><Package className="w-6 h-6" aria-hidden="true" /></span>
              <p className="mt-3 text-lg font-semibold">Nenhum item cadastrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Este pedido foi salvo sem itens.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-sm font-semibold">
                    <th className="text-left py-2 pr-4">Descrição</th>
                    <th className="text-center py-2 px-2 w-16">Un.</th>
                    <th className="text-right py-2 px-2 w-20">Qtd.</th>
                    <th className="text-right py-2 px-2 w-32">Preço unit.</th>
                    <th className="text-right py-2 pl-2 w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itensPedido.map(item => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4">{item.descricao}</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">{item.unidade}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{item.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{fmtCurrency(item.preco_unitario)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums font-medium">{fmtCurrency(item.preco_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td colSpan={4} className="py-2 text-right text-sm text-muted-foreground pr-2 font-medium">Total do pedido</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-bold text-foreground">{fmtCurrency(p.valor_total)}</td>
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
                <div key={m.item.id} className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-sm font-medium">{m.item.descricao}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{m.item.quantidade} {m.item.unidade} · {fmtCurrency(m.item.preco_unitario)}/un</p>
                  <Label htmlFor={`entrega-prod-${idx}`}>Produto do catálogo</Label>
                  <Select value={m.produtoId} onValueChange={v => setEntregaMappings(arr => arr.map((x, i) => i === idx ? { ...x, produtoId: v } : x))}>
                    <SelectTrigger id={`entrega-prod-${idx}`}><SelectValue placeholder="— Não registrar —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Não registrar —</SelectItem>
                      {produtosAtivosParaSelect.map(pr => (
                        <SelectItem key={pr.id} value={pr.id}>{pr.descricao}{pr.codigo ? ` (${pr.codigo})` : ''}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Criar novo produto</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.produtoId === '__new__' && (
                    <Input aria-label="Nome do novo produto" placeholder="Nome do novo produto" value={m.novaNome} onChange={e => setEntregaMappings(arr => arr.map((x, i) => i === idx ? { ...x, novaNome: e.target.value } : x))} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-4">
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
      {/* Cabeçalho padrão da identidade 12/09 — substitui a faixa herói navy
          com foto. A ação principal muda com a aba ativa (mesma regra de
          antes: Produtos e Pedidos têm barra própria dentro da aba). */}
      <CabecalhoPagina
        titulo="Gestão de Compras e Pedidos"
        descricao="Pedidos, fornecedores, estoque e notas fiscais"
        icone={<Warehouse />}
        acoes={!isOnboarding && (
          mainTab === 'fornecedores' ? (
            <Button onClick={() => { setEditingPessoa(null); setPessoaOpen(true); }}><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
          ) : mainTab === 'estoque' ? (
            <Button onClick={openNovoProduto}><Plus className="w-4 h-4" /> Novo Produto</Button>
          ) : mainTab === 'nfe' ? (
            <Button onClick={() => { resetNfeDialog(); setNfeOpen(true); }}><Plus className="w-4 h-4" /> Importar NF-e</Button>
          ) : mainTab === 'produtos' ? null : mainTab === 'pedidos' ? null : (
            <Button onClick={() => { resetPedidoForm(); setPedidoOpen(true); }}><Plus className="w-4 h-4" /> Novo Pedido</Button>
          )
        )}
      />

      {!empresaAtiva ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><Building2 className="w-6 h-6" aria-hidden="true" /></span>
          <p className="mt-3 text-lg font-semibold">Nenhuma empresa ativa</p>
          <p className="mt-1 text-sm text-muted-foreground">Selecione uma empresa ativa para acessar o módulo de compras.</p>
        </Card>
      ) : loading ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Carregando</span>
          <Skeleton className="h-11 w-full max-w-xl rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
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
        <Tabs
          value={mainTab}
          onValueChange={(v) => {
            setMainTab(v);
            // Rede de segurança: mesmo que alguma alteração escape do aviso,
            // entrar na aba de Estoque busca os produtos de novo.
            if (v === 'estoque' || v === 'produtos') void loadAll();
          }}
        >
          <TabsList className="mb-4 h-auto flex-wrap justify-start">
            <TabsTrigger value="pedidos"><ShoppingCart className="w-4 h-4 mr-2" aria-hidden="true" /> Pedidos</TabsTrigger>
            <TabsTrigger value="produtos"><Package className="w-4 h-4 mr-2" aria-hidden="true" /> Produtos</TabsTrigger>
            <TabsTrigger value="fornecedores"><Users className="w-4 h-4 mr-2" aria-hidden="true" /> Fornecedores</TabsTrigger>
            <TabsTrigger value="estoque"><Warehouse className="w-4 h-4 mr-2" aria-hidden="true" /> Estoque</TabsTrigger>
            <TabsTrigger value="nfe"><FileText className="w-4 h-4 mr-2" aria-hidden="true" /> NF-e</TabsTrigger>
            <TabsTrigger value="certificado"><ShieldCheck className="w-4 h-4 mr-2" aria-hidden="true" /> Certificado</TabsTrigger>
          </TabsList>

          {/* ══ ABA PRODUTOS ══ */}
          <TabsContent value="produtos">
            <ProdutosOmie aoMudar={loadAll} />
          </TabsContent>

          {/* ══ ABA PEDIDOS ══ */}
          <TabsContent value="pedidos">
            <PedidosOmie />
          </TabsContent>

          {/* ══ ABA FORNECEDORES ══ */}
          <TabsContent value="fornecedores" className="space-y-4">
            <div className="relative">
              <Label htmlFor="busca-fornecedor" className="sr-only">Buscar fornecedor</Label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="busca-fornecedor" placeholder="Buscar fornecedor, CNPJ ou e-mail..." value={fornSearch} onChange={e => setFornSearch(e.target.value)} className="pl-9" />
            </div>
            {pessoasFornecedores.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><Users className="w-6 h-6" aria-hidden="true" /></span>
                <p className="mt-3 text-lg font-semibold">Nenhum fornecedor cadastrado</p>
                <p className="mt-1 text-sm text-muted-foreground">Cadastre os fornecedores com quem a empresa compra.</p>
                <Button className="mt-4" onClick={() => { setEditingPessoa(null); setPessoaOpen(true); }}><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
              </Card>
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
                          {f.tipo === 'ambos' && <Badge variant="info">Cliente e Fornecedor</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {f.documento && <span>{f.documento}</span>}
                          {f.email && <span>{f.email}</span>}
                          {f.telefone && <span className="flex items-center gap-1"><Users className="w-3 h-3" aria-hidden="true" />{f.telefone}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" aria-label={`Editar ${f.nome}`} onClick={() => { setEditingPessoa(f); setPessoaOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" aria-label={`Excluir ${f.nome}`} onClick={() => deletePessoa.mutate({ id: f.id })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
            <LinhaKpis
              itens={[
                { rotulo: 'Produtos ativos', valor: String(produtos.filter(p => p.ativo).length), icone: Package },
                { rotulo: 'Em alerta', valor: String(prodAlerta), icone: AlertCircle, tom: prodAlerta > 0 ? 'aviso' : 'neutro' },
                { rotulo: 'Valor em estoque', valor: fmtCurrency(valorEstoque), icone: DollarSign, tom: 'ok' },
              ]}
            />

            <div className="relative">
              <Label htmlFor="busca-estoque" className="sr-only">Buscar produto</Label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="busca-estoque" placeholder="Buscar produto, código ou categoria..." value={estoqSearch} onChange={e => setEstoqSearch(e.target.value)} className="pl-9" />
            </div>

            {filtProdutos.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><Warehouse className="w-6 h-6" aria-hidden="true" /></span>
                <p className="mt-3 text-lg font-semibold">Nenhum produto cadastrado</p>
                <p className="mt-1 text-sm text-muted-foreground">Cadastre os produtos e materiais que a empresa controla em estoque.</p>
                <Button className="mt-4" onClick={openNovoProduto}><Plus className="w-4 h-4" /> Novo Produto</Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtProdutos.map(p => {
                  const emAlerta = p.ativo && p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo;
                  return (
                    <Card key={p.id} className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${!p.ativo ? 'opacity-60' : ''}`} onClick={() => setSelectedProduto(p)}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.descricao}</p>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {p.codigo && <span className="text-xs text-muted-foreground">{p.codigo}</span>}
                            {p.categoria && <Badge variant="info">{p.categoria}</Badge>}
                            {!p.ativo && <Badge variant="muted">Inativo</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" className="w-9 px-0" aria-label={`Editar ${p.descricao}`} onClick={() => { setEditingProduto(p); setProdutoForm({ codigo: p.codigo ?? '', descricao: p.descricao, unidade: p.unidade, categoria: p.categoria ?? '', saldo_minimo: String(p.saldo_minimo), preco_custo_medio: String(p.preco_custo_medio), ativo: p.ativo, ncm: p.ncm ?? '', cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '', cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '', p_icms: p.p_icms != null ? String(p.p_icms) : '', p_pis: p.p_pis != null ? String(p.p_pis) : '', p_cofins: p.p_cofins != null ? String(p.p_cofins) : '' }); setProdutoOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="w-9 px-0" aria-label={`Excluir ${p.descricao}`} onClick={e => handleDeleteProduto(p.id, e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </div>
                      <div className={`flex items-end justify-between gap-2 p-3 rounded-lg border ${emAlerta ? 'border-destructive-line bg-destructive-tint' : 'border-success-line bg-success-tint'}`}>
                        <div>
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className={`text-[2rem] leading-10 font-bold tabular-nums ${emAlerta ? 'text-destructive-ink' : 'text-success-ink'}`}>{p.saldo_atual.toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">{p.unidade}</p>
                        </div>
                        <div className="text-right">
                          {emAlerta && <div className="flex items-center justify-end gap-1 text-destructive-ink text-xs mb-1"><AlertCircle className="w-3 h-3" aria-hidden="true" />Estoque baixo</div>}
                          <p className="text-xs text-muted-foreground">Mín: {p.saldo_minimo} {p.unidade}</p>
                          {p.preco_custo_medio > 0 && <p className="text-xs text-muted-foreground tabular-nums">Custo: {fmtCurrency(p.preco_custo_medio)}/un</p>}
                        </div>
                      </div>
                      {p.saldo_atual > 0 && p.preco_custo_medio > 0 && (
                        <p className="text-xs text-muted-foreground text-right tabular-nums mt-1">Valor: {fmtCurrency(p.saldo_atual * p.preco_custo_medio)}</p>
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
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><FileText className="w-6 h-6" aria-hidden="true" /></span>
                <p className="mt-3 text-lg font-semibold">Nenhuma NF-e importada</p>
                <p className="mt-1 text-sm text-muted-foreground">Importe o XML ou o DANFE das notas recebidas para lançar o estoque.</p>
                <Button className="mt-4" onClick={() => { resetNfeDialog(); setNfeOpen(true); }}><Plus className="w-4 h-4" /> Importar NF-e</Button>
              </Card>
            ) : (
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-sm font-semibold">
                      <th className="text-left py-3 px-4">Número / Série</th>
                      <th className="text-left py-3 px-2">Emitente</th>
                      <th className="text-right py-3 px-2">Valor</th>
                      <th className="text-left py-3 px-2 hidden sm:table-cell">Pedido</th>
                      <th className="text-left py-3 px-2 hidden sm:table-cell">Emissão</th>
                      <th className="py-3 pl-2 pr-4 w-10"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {nfes.map(n => {
                      const ped = pedidos.find(p => p.id === n.pedido_id);
                      return (
                        <tr key={n.id} className="hover:bg-muted">
                          <td className="py-3 px-4">
                            <p className="font-medium">Nº {n.numero}</p>
                            <p className="text-xs text-muted-foreground">Série {n.serie}</p>
                          </td>
                          <td className="py-3 px-2">
                            <p className="font-medium truncate max-w-[180px]">{n.emitente_nome || '—'}</p>
                            {n.emitente_cnpj && <p className="text-xs text-muted-foreground">{n.emitente_cnpj}</p>}
                          </td>
                          <td className="py-3 px-2 text-right tabular-nums font-medium">{fmtCurrency(n.valor_total)}</td>
                          <td className="py-3 px-2 hidden sm:table-cell">
                            {ped ? <Badge variant="info" truncate className="max-w-[180px]">{ped.observacoes || 'Pedido'}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="py-3 px-2 hidden sm:table-cell text-muted-foreground text-xs">{fmtDate(n.data_emissao)}</td>
                          <td className="py-3 pl-2 pr-4">
                            <div className="flex items-center justify-end gap-1">
                              {nfesComEstoque.has(n.id) ? (
                                <Badge variant="success">Estoque lançado</Badge>
                              ) : n.xml ? (
                                <Button size="sm" variant="outline" className="whitespace-nowrap"
                                  onClick={e => { e.stopPropagation(); abrirLancamentoEstoque(n); }}>
                                  <PackagePlus className="w-4 h-4" /> Lançar estoque
                                </Button>
                              ) : null}
                              <Button size="sm" variant="ghost" aria-label={`Excluir NF-e ${n.numero}`} onClick={e => handleDeleteNfe(n.id, e)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <Label className="text-sm font-semibold">Itens do Pedido *</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setFormItens(i => [...i, blankItem()])}><Plus className="w-4 h-4" /> Adicionar Item</Button>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-1 text-sm text-muted-foreground px-1">
              <span className="col-span-5">Descrição</span><span className="col-span-2">Unidade</span><span className="col-span-2 text-right">Quantidade</span><span className="col-span-2 text-right">Preço unit.</span><span className="col-span-1" />
            </div>
            <div className="space-y-2">
              {formItens.map((item, idx) => {
                const sub = parseNum(item.quantidade) * parseNum(item.preco_unitario);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-5"><Input aria-label={`Descrição do item ${idx + 1}`} placeholder="Descrição do item" value={item.descricao} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))} /></div>
                      <div className="col-span-4 sm:col-span-2"><Input aria-label={`Unidade do item ${idx + 1}`} placeholder="UN" value={item.unidade} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, unidade: e.target.value } : x))} /></div>
                      <div className="col-span-3 sm:col-span-2"><Input aria-label={`Quantidade do item ${idx + 1}`} type="number" min="0" step="1" placeholder="Qtd." value={item.quantidade} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))} className="text-right tabular-nums" /></div>
                      <div className="col-span-4 sm:col-span-2"><Input aria-label={`Preço unitário do item ${idx + 1}`} type="number" min="0" step="0.01" placeholder="R$ unit." value={item.preco_unitario} onChange={e => setFormItens(arr => arr.map((x, i) => i === idx ? { ...x, preco_unitario: e.target.value } : x))} className="text-right tabular-nums" /></div>
                      <div className="col-span-1 flex justify-center"><Button type="button" size="sm" variant="ghost" className="w-9 px-0" aria-label={`Remover item ${idx + 1}`} disabled={formItens.length === 1} onClick={() => setFormItens(arr => arr.filter((_, i) => i !== idx))}><X className="w-4 h-4 text-destructive" /></Button></div>
                    </div>
                    {sub > 0 && <p className="text-right text-xs text-muted-foreground tabular-nums pr-10">= {fmtCurrency(sub)}</p>}
                  </div>
                );
              })}
            </div>
            {formItens.some(i => i.descricao.trim()) && (
              <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm font-semibold text-right tabular-nums">Total: {fmtCurrency(formItens.reduce((s, i) => s + parseNum(i.quantidade) * parseNum(i.preco_unitario), 0))}</div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 mt-4">
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
              <div className="flex flex-wrap gap-2">
                <Button variant={nfeMode === 'xml' ? 'default' : 'outline'} aria-pressed={nfeMode === 'xml'} onClick={() => { setNfeMode('xml'); setNfeParsed(null); setTimeout(() => fileRef.current?.click(), 0); }}>
                  <Upload className="w-4 h-4" /> Importar Arquivo
                </Button>
                <Button variant={nfeMode === 'manual' ? 'default' : 'outline'} aria-pressed={nfeMode === 'manual'} onClick={() => setNfeMode('manual')}>
                  <Pencil className="w-4 h-4" /> Preencher manualmente
                </Button>
              </div>

              {nfeMode === 'xml' && (
                <div
                  className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${nfePdfLoading ? 'border-border bg-muted cursor-wait' : `cursor-pointer ${nfeDragging ? 'border-primary bg-primary-tint' : 'border-border hover:border-primary hover:bg-primary-tint'}`}`}
                  onClick={() => { if (!nfePdfLoading) fileRef.current?.click(); }}
                  onDragOver={e => { e.preventDefault(); if (!nfePdfLoading) setNfeDragging(true); }}
                  onDragLeave={() => setNfeDragging(false)}
                  onDrop={e => { e.preventDefault(); setNfeDragging(false); if (!nfePdfLoading) { const f = e.dataTransfer.files[0]; if (f) handleNfeFile(f); } }}
                >
                  {nfePdfLoading ? (
                    <>
                      <div className="flex justify-center mb-3">
                        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Extraindo dados do DANFE...</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguarde, isso pode levar alguns segundos</p>
                    </>
                  ) : (
                    <>
                      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary"><Upload className="w-6 h-6" aria-hidden="true" /></span>
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
                  <div className="border-t border-border pt-4 space-y-4">
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
                    <div className="flex flex-wrap justify-end gap-2">
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
              <div className="rounded-lg border border-success-line bg-success-tint p-4">
                <p className="text-sm font-semibold text-success-ink mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />NF-e lida com sucesso
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">Número:</span> {nfeParsed.numero_nf} / Série {nfeParsed.serie}</div>
                  <div><span className="text-muted-foreground">Valor total:</span> <span className="font-semibold tabular-nums">{fmtCurrency(nfeParsed.v_nf)}</span></div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Emitente:</span> {nfeParsed.nome_emitente}{nfeParsed.cnpj_emitente ? ` — CNPJ ${nfeParsed.cnpj_emitente}` : ''}</div>
                  <div><span className="text-muted-foreground">Emissão:</span> {nfeParsed.data_emissao ? fmtDate(nfeParsed.data_emissao.split('T')[0]) : '—'}</div>
                  <div><span className="text-muted-foreground">Itens:</span> {nfeParsed.itens.length}</div>
                </div>
              </div>

              {nfeFornMatch ? (
                <div className="flex items-center gap-3 rounded-lg border border-success-line bg-success-tint p-4">
                  <CheckCircle2 className="w-5 h-5 text-success-ink shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Fornecedor já cadastrado</p>
                    <p className="text-xs text-muted-foreground">{nfeFornMatch.razao_social}{nfeFornMatch.cnpj ? ` — CNPJ ${nfeFornMatch.cnpj}` : ''}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-warning-line bg-warning-tint p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-ink shrink-0" aria-hidden="true" />
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

              <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-border">
                <Button variant="ghost" onClick={() => { setNfeParsed(null); setNfeXmlStr(''); setNfeStep(1); setNfeFornMatch(null); setNfeCriarForn(false); setNfeItemMaps([]); }}>
                  <ArrowLeft className="w-4 h-4" /> Trocar arquivo
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
                  <div key={idx} className={`rounded-lg border border-border p-4 space-y-2 transition-opacity ${!m.incluir ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-2">
                      <Checkbox checked={m.incluir}
                        aria-label={`Incluir ${m.item.x_prod}`}
                        onCheckedChange={v => setNfeItemMaps(arr => arr.map((x, i) => i === idx ? { ...x, incluir: !!v } : x))}
                        className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.item.x_prod}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {m.item.q_com} {m.item.u_com} · {fmtCurrency(m.item.v_un_com)}/un
                          {m.item.c_prod ? ` · Cód: ${m.item.c_prod}` : ''}
                          {m.produtoId && m.produtoId !== '__new__' && <span className="text-success-ink ml-1">· Auto-vinculado</span>}
                        </p>
                        {(m.item.ncm || m.item.cfop || m.item.cst_icms || m.item.csosn) && (
                          <p className="text-xs text-muted-foreground">
                            {[m.item.ncm && `NCM ${m.item.ncm}`, m.item.cfop && `CFOP ${m.item.cfop}`, (m.item.cst_icms || m.item.csosn) && `CST ${m.item.cst_icms || m.item.csosn}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {m.incluir && (
                      <>
                        {/* value="" derruba o Radix (pitfall conhecido) — o
                            "não registrar" vive num sentinel e volta a '' no
                            estado, que é o que o salvar entende. */}
                        <Label htmlFor={`nfe-prod-${idx}`} className="sr-only">Produto do catálogo para {m.item.x_prod}</Label>
                        <Select value={m.produtoId || '__skip__'} onValueChange={v => setNfeItemMaps(arr => arr.map((x, i) => i === idx ? { ...x, produtoId: v === '__skip__' ? '' : v } : x))}>
                          <SelectTrigger id={`nfe-prod-${idx}`}><SelectValue placeholder="— Não registrar no estoque —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">— Não registrar no estoque —</SelectItem>
                            {produtosAtivosParaSelect.map(pr => (
                              <SelectItem key={pr.id} value={pr.id}>{pr.descricao}{pr.codigo ? ` (${pr.codigo})` : ''}</SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Criar novo produto</SelectItem>
                          </SelectContent>
                        </Select>
                        {m.produtoId === '__new__' && (
                          <Input aria-label="Nome do novo produto" placeholder="Nome do novo produto"
                            value={m.novaNome}
                            onChange={e => setNfeItemMaps(arr => arr.map((x, i) => i === idx ? { ...x, novaNome: e.target.value } : x))} />
                        )}
                        {margemInfo && m.item.v_un_com > 0 && (() => {
                          // A régua da Fase B, item a item: do custo da NF ao
                          // preço que sustenta a operação — e o confronto com
                          // o que o contrato vigente paga por este produto.
                          const s = precificarEntrada(m.item.v_un_com, {
                            cargaTributariaPerc: margemInfo.analise.cargaTributariaPerc,
                            despesaOperacionalPerc: margemInfo.analise.despesaOperacionalPerc,
                            margemAlvoPerc: margemInfo.alvo,
                          });
                          if (s.precoMinimo == null && !s.inviavel) return null;
                          const ref = m.produtoId && m.produtoId !== '__new__' ? precosContrato.get(m.produtoId) : undefined;
                          const sit = ref ? situacaoDoPrecoContratado(ref.preco, s) : 'sem_referencia';
                          return (
                            <div className="text-xs rounded-md bg-muted px-3 py-2 space-y-1">
                              <p>
                                Venda sugerida: <b className="tabular-nums">{s.precoSugerido != null ? fmtCurrency(s.precoSugerido) : '—'}</b>
                                <span className="text-muted-foreground">
                                  {s.precoMinimo != null ? ` (mínimo ${fmtCurrency(s.precoMinimo)})` : ''} · tributos {margemInfo.analise.cargaTributariaPerc.toFixed(1).replace('.', ',')}% + despesas {margemInfo.analise.despesaOperacionalPerc.toFixed(1).replace('.', ',')}% + alvo {margemInfo.alvo}% — {margemInfo.analise.regimeRotulo}
                                </span>
                              </p>
                              {s.inviavel && (
                                <p className="text-destructive">Tributos + despesas + margem alvo somam 100% ou mais — nenhum preço fecha; revise a margem alvo em Custos por Contrato.</p>
                              )}
                              {ref && sit === 'abaixo_minimo' && (
                                <p className="text-destructive">⚠ O contrato {ref.numero} paga {fmtCurrency(ref.preco)} — ABAIXO do mínimo: entregar é prejuízo. Caminho jurídico: reequilíbrio (art. 124, II, “d”).</p>
                              )}
                              {ref && sit === 'entre_minimo_e_sugerido' && (
                                <p className="text-warning">O contrato {ref.numero} paga {fmtCurrency(ref.preco)} — cobre custos e tributos, mas fica abaixo da margem alvo.</p>
                              )}
                              {ref && sit === 'acima_sugerido' && (
                                <p className="text-success">O contrato {ref.numero} paga {fmtCurrency(ref.preco)} ✓ acima da venda sugerida.</p>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-border">
                <Button variant="ghost" onClick={() => setNfeStep(2)}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
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
              className={!editing ? 'bg-muted cursor-default select-none' : ''}
            />
            {!editing && <p className="text-xs text-muted-foreground mt-1">Gerado automaticamente pelo sistema</p>}
          </div>
          <div><Label>Unidade</Label><Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="UN, KG, M², L..." /></div>
          <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="ex: Material, EPI..." /></div>
          <div><Label>Saldo Mínimo</Label><Input type="number" min="0" step="0.01" value={form.saldo_minimo} onChange={e => setForm(f => ({ ...f, saldo_minimo: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Preço de Custo unitário (R$)</Label><Input type="number" min="0" step="0.01" value={form.preco_custo_medio} onChange={e => setForm(f => ({ ...f, preco_custo_medio: e.target.value }))} placeholder="0,00" /></div>
          <div className="flex items-center gap-3 sm:col-span-2 mt-1"><Switch id="prod-ativo" checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /><Label htmlFor="prod-ativo" className="cursor-pointer">Produto ativo</Label></div>
          <div className="sm:col-span-2 border-t border-border pt-4 mt-1">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Dados Fiscais (preenchidos automaticamente via NF-e)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><Label>NCM</Label><Input value={form.ncm} onChange={e => setForm(f => ({ ...f, ncm: e.target.value }))} placeholder="00000000" /></div>
              <div><Label>CFOP</Label><Input value={form.cfop} onChange={e => setForm(f => ({ ...f, cfop: e.target.value }))} placeholder="0000" /></div>
              <div><Label>CST ICMS</Label><Input value={form.cst_icms} onChange={e => setForm(f => ({ ...f, cst_icms: e.target.value }))} placeholder="00" /></div>
              <div><Label>CSOSN</Label><Input value={form.csosn} onChange={e => setForm(f => ({ ...f, csosn: e.target.value }))} placeholder="102" /></div>
              <div><Label>Alíq. ICMS %</Label><Input type="number" value={form.p_icms} onChange={e => setForm(f => ({ ...f, p_icms: e.target.value }))} placeholder="12" /></div>
              <div><Label>Alíq. PIS %</Label><Input type="number" value={form.p_pis} onChange={e => setForm(f => ({ ...f, p_pis: e.target.value }))} placeholder="0.65" /></div>
              <div><Label>Alíq. COFINS %</Label><Input type="number" value={form.p_cofins} onChange={e => setForm(f => ({ ...f, p_cofins: e.target.value }))} placeholder="3.00" /></div>
              <div><Label>CST PIS</Label><Input value={form.cst_pis} onChange={e => setForm(f => ({ ...f, cst_pis: e.target.value }))} placeholder="07" /></div>
              <div><Label>CST COFINS</Label><Input value={form.cst_cofins} onChange={e => setForm(f => ({ ...f, cst_cofins: e.target.value }))} placeholder="07" /></div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 mt-4">
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
                <SelectItem value="entrada"><span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-success" aria-hidden="true" />Entrada</span></SelectItem>
                <SelectItem value="saida"><span className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" aria-hidden="true" />Saída</span></SelectItem>
                <SelectItem value="ajuste"><span className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-muted-foreground" aria-hidden="true" />Ajuste</span></SelectItem>
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
        <div className="flex flex-wrap justify-end gap-2 mt-4">
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
            <li key={idx} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary-tint text-primary text-sm font-bold flex-shrink-0">{idx + 1}</div>
                {!isLast && <div className="w-px flex-1 bg-border my-2 min-h-8" />}
              </div>
              <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 ${isLast ? 'pb-0' : 'pb-8'}`}>
                <div className="flex items-start gap-3 flex-1">
                  <StepIcon className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" aria-hidden="true" />
                  <div><p className="text-base font-semibold leading-tight">{step.title}</p><p className="text-sm text-muted-foreground mt-1">{step.desc}</p></div>
                </div>
                <Button variant="outline" onClick={step.onClick} className="shrink-0 self-start sm:self-auto">{step.btn}</Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
