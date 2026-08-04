// v2
import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePessoas } from '@/hooks/useFinanceiro';
import { toast } from 'sonner';
import {
  Plus, Search, MoreVertical, ShoppingCart, ShoppingBag, Pencil, Trash2,
  Loader2, X, Save, Printer, Copy, Check, Zap, Paperclip, Download,
  History, RefreshCw, User, LayoutGrid, List,
  ChevronsUpDown, Filter, FileText, Link2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type Pedido = {
  id: string; empresa_id: string; numero: number;
  tipo: 'venda' | 'compra';
  status: 'pedido' | 'separar_estoque' | 'faturar' | 'faturado' | 'entrega' | 'cancelado';
  pessoa_id: string | null;
  previsao_faturamento: string | null;
  total_mercadorias: number; valor_desconto: number;
  total_ipi: number; total_icms_st: number; valor_total: number;
  vendedor: string | null; numero_parcelas: string | null; cenario_fiscal: string | null;
  categoria: string | null; conta_corrente: string | null; etapa: string | null;
  num_pedido_cliente: string | null; num_contrato_venda: string | null;
  contato: string | null; projeto: string | null; origem_pedido: string | null;
  dados_adicionais_nfe: string | null; nf_consumo_final: boolean;
  email_destinatario: string | null; enviar_boleto: boolean;
  observacoes: string | null;
  contrato_id: string | null;
  created_at: string; updated_at: string;
};

type PedidoItem = {
  id: string; pedido_id: string; empresa_id: string;
  produto_id: string | null; codigo_produto: string | null;
  descricao: string; unidade: string; quantidade: number;
  preco_unitario: number; valor_total: number; local_estoque: string | null;
};

type ProdutoCat = {
  id: string; codigo: string | null; descricao: string;
  unidade: string; preco_venda: number | null;
};

type PessoaOpt = { id: string; nome: string; documento: string | null; tipo: string };

type ContratoOpt = { id: string; numero_contrato: string; orgao_contratante: string | null };

type PedidoForm = {
  tipo: 'venda' | 'compra'; pessoa_id: string;
  previsao_faturamento: string; vendedor: string;
  numero_parcelas: string; cenario_fiscal: string;
  categoria: string; conta_corrente: string; etapa: string;
  num_pedido_cliente: string; num_contrato_venda: string;
  contato: string; projeto: string; origem_pedido: string;
  dados_adicionais_nfe: string; nf_consumo_final: boolean;
  email_destinatario: string; enviar_boleto: boolean;
  observacoes: string; valor_desconto: string;
  contrato_id: string;
};

type ItemForm = {
  _key: string; id?: string;
  produto_id: string; codigo_produto: string; descricao: string;
  unidade: string; quantidade: string; preco_unitario: string;
  local_estoque: string;
};

// ── Constants ──────────────────────────────────────────────────────────────
const KANBAN_STATUS: { key: Pedido['status']; label: string }[] = [
  { key: 'pedido',          label: 'Pedidos'         },
  { key: 'separar_estoque', label: 'Separar Estoque' },
  { key: 'faturar',         label: 'Faturar'         },
  { key: 'faturado',        label: 'Faturado'        },
  { key: 'entrega',         label: 'Entrega'         },
];

const STATUS_MSG: Record<string, string> = {
  pedido:          'Aguardando faturamento',
  separar_estoque: 'Separar estoque',
  faturar:         'Faturar',
  faturado:        'Faturado',
  entrega:         'Em entrega',
  cancelado:       'Cancelado',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtM(v: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function parseM(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}
function inputM(v: string): string {
  const d = v.replace(/\D/g, '');
  if (!d) return '0,00';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseInt(d) / 100);
}
function fmtDateBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm(tipo: 'venda' | 'compra' = 'venda'): PedidoForm {
  return {
    tipo, pessoa_id: '', previsao_faturamento: todayISO(),
    vendedor: '', numero_parcelas: 'A Vista', cenario_fiscal: '',
    categoria: tipo === 'venda' ? 'Clientes - Revenda de Mercadoria' : '',
    conta_corrente: '',
    etapa: tipo === 'venda' ? 'Pedido de Venda' : 'Pedido de Compra',
    num_pedido_cliente: '', num_contrato_venda: '',
    contato: '', projeto: '', origem_pedido: 'sistema',
    dados_adicionais_nfe: '', nf_consumo_final: false,
    email_destinatario: '', enviar_boleto: false,
    observacoes: '', valor_desconto: '0,00',
    contrato_id: '',
  };
}

function blankItem(): ItemForm {
  return {
    _key: crypto.randomUUID(),
    produto_id: '', codigo_produto: '', descricao: '',
    unidade: 'PC', quantidade: '1', preco_unitario: '0,00',
    local_estoque: 'PADRAO - Local de Estoque Padrão',
  };
}

// ── DatePickerBtn ──────────────────────────────────────────────────────────
function DatePickerBtn({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + 'T12:00:00') : undefined;
  const label = value ? fmtDateBR(value) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs transition-colors hover:bg-muted/50 ${value ? 'text-foreground border-accent/60' : 'text-muted-foreground'}`}>
          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-accent" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={d => {
            onChange(d ? d.toISOString().slice(0, 10) : '');
            setOpen(false);
          }}
          locale={{ localize: { day: n => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][n], month: n => ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][n] } } as any}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── PessoaCombobox ─────────────────────────────────────────────────────────
function PessoaCombobox({ pessoas, value, onChange }: {
  pessoas: PessoaOpt[]; value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selectedNome = pessoas.find(p => p.id === value)?.nome ?? '';
  const [inputVal, setInputVal] = useState(selectedNome);

  useEffect(() => { setInputVal(selectedNome); }, [selectedNome]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = pessoas.filter(p =>
    p.nome.toLowerCase().includes(q.toLowerCase()) ||
    (p.documento ?? '').includes(q)
  ).slice(0, 25);

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Input
          value={inputVal}
          placeholder="Digite para buscar..."
          onChange={e => { setInputVal(e.target.value); setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pr-8 text-sm"
        />
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto text-sm">
          {filtered.map(p => (
            <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
              onClick={() => { onChange(p.id); setInputVal(p.nome); setQ(''); setOpen(false); }}>
              <div className="font-medium text-xs">{p.nome}</div>
              {p.documento && <div className="text-xs text-muted-foreground">{p.documento}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ItemDialog ─────────────────────────────────────────────────────────────
function ItemDialog({ open, onOpenChange, produtos, initial, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  produtos: ProdutoCat[]; initial?: ItemForm;
  onConfirm: (item: ItemForm) => void;
}) {
  const [item, setItem] = useState<ItemForm>(blankItem());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) { setItem(initial ?? blankItem()); setSearch(''); }
  }, [open, initial]);

  const filtered = produtos.filter(p =>
    !search ||
    p.descricao.toLowerCase().includes(search.toLowerCase()) ||
    (p.codigo ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 60);

  function selectProd(p: ProdutoCat) {
    setItem(prev => ({
      ...prev,
      produto_id: p.id,
      codigo_produto: p.codigo ?? '',
      descricao: p.descricao,
      unidade: p.unidade,
      preco_unitario: fmtM(p.preco_venda ?? 0),
    }));
  }

  const valorTotal = parseM(item.quantidade) * parseM(item.preco_unitario);

  function handleConfirm() {
    if (!item.descricao.trim()) { toast.error('Informe a descrição do item'); return; }
    onConfirm({ ...item, _key: item._key || crypto.randomUUID() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-semibold">
            {initial?.id ? 'Editar Item' : 'Incluir Item'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto por código ou descrição..." className="pl-8 text-sm" />
            </div>
            <div className="max-h-36 overflow-y-auto border rounded-md bg-background">
              {filtered.length === 0
                ? <p className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum produto encontrado</p>
                : filtered.map(p => (
                  <button key={p.id}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent/10 border-b last:border-0 transition-colors ${item.produto_id === p.id ? 'bg-accent/20' : ''}`}
                    onClick={() => selectProd(p)}
                  >
                    <span className="font-medium text-accent mr-2">{p.codigo ?? '—'}</span>
                    <span>{p.descricao}</span>
                    <span className="ml-2 text-muted-foreground">({p.unidade})</span>
                    {p.preco_venda != null && p.preco_venda > 0 && (
                      <span className="ml-2 text-success font-medium">R$ {fmtM(p.preco_venda)}</span>
                    )}
                  </button>
                ))
              }
            </div>
          </div>

          <div className="px-4 py-3 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Código</Label>
                <Input value={item.codigo_produto} onChange={e => setItem(i => ({ ...i, codigo_produto: e.target.value }))} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unidade</Label>
                <Input value={item.unidade} onChange={e => setItem(i => ({ ...i, unidade: e.target.value }))} className="text-sm mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descrição do Produto *</Label>
              <Input value={item.descricao} onChange={e => setItem(i => ({ ...i, descricao: e.target.value }))} className="text-sm mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Quantidade</Label>
                <Input value={item.quantidade} onChange={e => setItem(i => ({ ...i, quantidade: e.target.value }))}
                  className="text-sm mt-1 text-right" type="number" min="0" step="0.001" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Preço Unitário</Label>
                <Input value={item.preco_unitario} onChange={e => setItem(i => ({ ...i, preco_unitario: inputM(e.target.value) }))}
                  className="text-sm mt-1 text-right" inputMode="numeric" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor Total</Label>
                <Input value={fmtM(valorTotal)} readOnly className="text-sm mt-1 text-right bg-muted/30 text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Local de Estoque</Label>
              <Input value={item.local_estoque} onChange={e => setItem(i => ({ ...i, local_estoque: e.target.value }))} className="text-sm mt-1" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleConfirm}>
            {initial?.id ? 'Salvar' : 'Incluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PedidosOmie() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { data: todasPessoas = [] } = usePessoas();

  const [pedidos, setPedidos]   = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCat[]>([]);
  const [contratos, setContratos] = useState<ContratoOpt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [view, setView]               = useState<'kanban' | 'form'>('kanban');
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingNum, setEditingNum]   = useState<number | null>(null);
  const [form, setForm]               = useState<PedidoForm>(defaultForm());
  const [itens, setItens]             = useState<ItemForm[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [tipoOpen, setTipoOpen]         = useState(false);
  const [viewMode, setViewMode]         = useState<'kanban' | 'list'>('kanban');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem]   = useState<ItemForm | undefined>(undefined);

  const [search, setSearch]         = useState('');
  const [tipoFilter, setTipoFilter] = useState<'' | 'compra' | 'venda'>('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [kanbanMenu, setKanbanMenu] = useState<string | null>(null);
  const draggingIdRef               = useRef<string | null>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghostPos, setGhostPos]     = useState<{ x: number; y: number } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Pedido['status'] | null>(null);
  const [nfeAlertOpen, setNfeAlertOpen]       = useState(false);
  const [pendingFaturarId, setPendingFaturarId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus]     = useState<Pedido['status']>('pedido');
  const [duplicating, setDuplicating]         = useState(false);

  // Modal de exclusão com motivo
  const [deleteConfirmId, setDeleteConfirmId]     = useState<string | null>(null);
  const [deleteMotivo, setDeleteMotivo]           = useState('');
  const [deletingPedido, setDeletingPedido]       = useState(false);
  const [anexosOpen, setAnexosOpen]           = useState(false);
  const [anexosLoading, setAnexosLoading]     = useState(false);
  const [uploadingAnexo, setUploadingAnexo]   = useState(false);
  const [anexosList, setAnexosList]           = useState<{ name: string; size: number; url: string }[]>([]);
  const [historicoOpen, setHistoricoOpen]     = useState(false);
  const [historicoData, setHistoricoData]     = useState<Pedido | null>(null);

  // Faturado → Conta a Receber
  const [faturadoContaOpen, setFaturadoContaOpen]     = useState(false);
  const [faturadoContas, setFaturadoContas]           = useState<Array<{ id: string; nome: string; tipo: string }>>([]);
  const [faturadoContaId, setFaturadoContaId]         = useState('');
  const [faturadoParcelas, setFaturadoParcelas]       = useState('1');
  const [savingFaturado, setSavingFaturado]           = useState(false);

  // Filtered by tipo
  const clientes = useMemo(() =>
    todasPessoas.filter(p => p.tipo === 'cliente' || p.tipo === 'ambos'), [todasPessoas]);
  const fornecedores = useMemo(() =>
    todasPessoas.filter(p => p.tipo === 'fornecedor' || p.tipo === 'ambos'), [todasPessoas]);
  const pessoasParaTipo = form.tipo === 'venda' ? clientes : fornecedores;

  const getPessoaNome = (id: string | null) =>
    todasPessoas.find(p => p.id === id)?.nome ?? null;

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!empresaAtiva) { setLoading(false); return; }
    loadPedidos();
    loadProdutos();
    loadContratos();
  }, [empresaAtiva]);

  // Abre pedido direto quando vem de outra página via ?pedido=<id>
  useEffect(() => {
    const paramId = searchParams.get('pedido');
    if (!paramId || pedidos.length === 0) return;
    const found = pedidos.find(p => p.id === paramId);
    if (found) {
      openEdit(found);
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('pedido'); return n; });
    }
  }, [searchParams.get('pedido'), pedidos]);

  // Abre o formulário de novo pedido vindo da Gestão de Contratos via ?novo_contrato=<id>
  useEffect(() => {
    const paramContrato = searchParams.get('novo_contrato');
    if (!paramContrato || !empresaAtiva) return;
    setForm(f => ({ ...defaultForm('venda'), contrato_id: paramContrato }));
    setItens([]);
    setEditingId(null);
    setEditingNum(null);
    setEditingStatus('pedido');
    setView('form');
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('novo_contrato'); return n; });
  }, [searchParams.get('novo_contrato'), empresaAtiva]);

  async function loadPedidos() {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos' as never)
      .select('*')
      .eq('empresa_id', empresaAtiva!.id)
      .order('numero', { ascending: false });
    if (error) toast.error('Erro ao carregar pedidos');
    else setPedidos((data ?? []) as Pedido[]);
    setLoading(false);
  }

  async function loadContratos() {
    const { data } = await supabase
      .from('contratos' as never)
      .select('id, numero_contrato, orgao_contratante')
      .eq('empresa_id', empresaAtiva!.id)
      .order('numero_contrato' as never);
    setContratos((data ?? []) as ContratoOpt[]);
  }

  async function loadProdutos() {
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, descricao, unidade, preco_venda')
      .eq('empresa_id', empresaAtiva!.id)
      .eq('ativo', true)
      .order('descricao');
    setProdutos((data ?? []) as ProdutoCat[]);
  }

  async function getNextNumero(): Promise<number> {
    const { data } = await supabase
      .from('pedidos' as never)
      .select('numero')
      .eq('empresa_id', empresaAtiva!.id)
      .order('numero', { ascending: false })
      .limit(1);
    return (((data as any[])?.[0]?.numero) ?? 0) + 1;
  }

  function openNovo(tipo: 'venda' | 'compra') {
    setTipoOpen(false);
    setEditingId(null); setEditingNum(null);
    setForm(defaultForm(tipo));
    setItens([]); setSelectedItem(null);
    setEditingStatus('pedido');
    setView('form');
  }

  async function openEdit(p: Pedido) {
    setEditingId(p.id); setEditingNum(p.numero);
    setEditingStatus(p.status);
    setForm({
      tipo: p.tipo, pessoa_id: p.pessoa_id ?? '',
      previsao_faturamento: p.previsao_faturamento ?? todayISO(),
      vendedor: p.vendedor ?? '', numero_parcelas: p.numero_parcelas ?? 'A Vista',
      cenario_fiscal: p.cenario_fiscal ?? '',
      categoria: p.categoria ?? '', conta_corrente: p.conta_corrente ?? '',
      etapa: p.etapa ?? '', num_pedido_cliente: p.num_pedido_cliente ?? '',
      num_contrato_venda: p.num_contrato_venda ?? '', contato: p.contato ?? '',
      projeto: p.projeto ?? '', origem_pedido: p.origem_pedido ?? 'sistema',
      dados_adicionais_nfe: p.dados_adicionais_nfe ?? '',
      nf_consumo_final: p.nf_consumo_final,
      email_destinatario: p.email_destinatario ?? '',
      enviar_boleto: p.enviar_boleto,
      observacoes: p.observacoes ?? '', valor_desconto: fmtM(p.valor_desconto),
      contrato_id: p.contrato_id ?? '',
    });
    const { data } = await supabase
      .from('pedido_itens' as never)
      .select('*')
      .eq('pedido_id', p.id);
    setItens(((data ?? []) as PedidoItem[]).map(i => ({
      _key: i.id, id: i.id,
      produto_id: i.produto_id ?? '', codigo_produto: i.codigo_produto ?? '',
      descricao: i.descricao, unidade: i.unidade,
      quantidade: String(i.quantidade), preco_unitario: fmtM(i.preco_unitario),
      local_estoque: i.local_estoque ?? 'PADRAO - Local de Estoque Padrão',
    })));
    setSelectedItem(null);
    setView('form');
  }

  async function updatePedidoStatus(id: string, status: Pedido['status']) {
    const { error } = await supabase
      .from('pedidos' as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    await loadPedidos();
  }

  function startDrag(e: React.PointerEvent, pedidoId: string) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    draggingIdRef.current = pedidoId;
    setDraggingId(pedidoId);
    setGhostPos({ x: e.clientX, y: e.clientY });
  }

  function cancelDrag() {
    draggingIdRef.current = null;
    setDraggingId(null);
    setGhostPos(null);
    setDragOverCol(null);
  }

  useEffect(() => {
    if (!draggingId) return;

    const onMove = (e: PointerEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest('[data-col]');
      const key = (colEl?.getAttribute('data-col') ?? null) as Pedido['status'] | null;
      setDragOverCol(key);
    };

    const onUp = async (e: PointerEvent) => {
      const id = draggingIdRef.current;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest('[data-col]');
      const colKey = (colEl?.getAttribute('data-col') ?? null) as Pedido['status'] | null;
      cancelDrag();
      if (!id || !colKey) return;
      const current = pedidos.find(p => p.id === id)?.status;
      if (current === colKey) return;
      if (colKey === 'faturado') { setPendingFaturarId(id); setNfeAlertOpen(true); }
      else await updatePedidoStatus(id, colKey);
    };

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelDrag(); };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('keydown', onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId, pedidos]);

  async function handleSave() {
    setSaving(true);
    const totalMerc = itens.reduce((s, i) => s + parseM(i.quantidade) * parseM(i.preco_unitario), 0);
    const desconto  = parseM(form.valor_desconto);
    const valorTotal = Math.max(0, totalMerc - desconto);
    const numero = editingId ? editingNum! : await getNextNumero();

    const payload: Record<string, unknown> = {
      empresa_id: empresaAtiva!.id, numero, tipo: form.tipo,
      pessoa_id: form.pessoa_id || null,
      previsao_faturamento: form.previsao_faturamento || null,
      total_mercadorias: totalMerc, valor_desconto: desconto,
      total_ipi: 0, total_icms_st: 0, valor_total: valorTotal,
      vendedor: form.vendedor || null, numero_parcelas: form.numero_parcelas || 'A Vista',
      cenario_fiscal: form.cenario_fiscal || null,
      categoria: form.categoria || null, conta_corrente: form.conta_corrente || null,
      etapa: form.etapa || null, num_pedido_cliente: form.num_pedido_cliente || null,
      num_contrato_venda: form.num_contrato_venda || null,
      contato: form.contato || null, projeto: form.projeto || null,
      origem_pedido: form.origem_pedido || 'sistema',
      dados_adicionais_nfe: form.dados_adicionais_nfe || null,
      nf_consumo_final: form.nf_consumo_final,
      email_destinatario: form.email_destinatario || null,
      enviar_boleto: form.enviar_boleto,
      observacoes: form.observacoes || null,
      contrato_id: form.contrato_id || null,
      updated_at: new Date().toISOString(),
    };

    let pedidoId = editingId;
    let error: unknown;

    if (editingId) {
      ({ error } = await supabase.from('pedidos' as never).update(payload as never).eq('id', editingId));
    } else {
      const res = await supabase
        .from('pedidos' as never)
        .insert({ ...payload, status: 'pedido' } as never)
        .select('id').single();
      error = res.error;
      if (!error) pedidoId = (res.data as { id: string }).id;
    }

    if (error) {
      setSaving(false);
      console.error('Erro ao salvar pedido:', error);
      toast.error(`Erro ao salvar pedido: ${(error as any)?.message ?? 'verifique o console'}`);
      return;
    }

    if (pedidoId) {
      await supabase.from('pedido_itens' as never).delete().eq('pedido_id', pedidoId);
      if (itens.length > 0) {
        await supabase.from('pedido_itens' as never).insert(
          itens.map(i => ({
            empresa_id: empresaAtiva!.id, pedido_id: pedidoId,
            produto_id: i.produto_id || null, codigo_produto: i.codigo_produto || null,
            descricao: i.descricao, unidade: i.unidade,
            quantidade: parseM(i.quantidade) || 1, preco_unitario: parseM(i.preco_unitario),
            valor_total: parseM(i.quantidade) * parseM(i.preco_unitario),
            local_estoque: i.local_estoque || null,
          })) as never
        );
      }
    }

    // Sincroniza vínculo com contrato
    if (pedidoId) {
      if (form.contrato_id) {
        const cpDescricao = itens.map(i => i.descricao).join('; ').slice(0, 255) || `Pedido Nº ${numero}`;
        const cpQtd = itens.reduce((s, i) => s + (parseM(i.quantidade) || 1), 0) || 1;
        const { data: existing } = await supabase
          .from('contrato_pedidos')
          .select('id')
          .eq('pedido_id', pedidoId)
          .maybeSingle();
        if (existing) {
          await supabase.from('contrato_pedidos').update({
            contrato_id: form.contrato_id,
            descricao: cpDescricao,
            valor_total: valorTotal,
            valor_unitario: valorTotal,
          }).eq('id', (existing as any).id);
        } else {
          await supabase.from('contrato_pedidos').insert({
            contrato_id: form.contrato_id,
            pedido_id: pedidoId,
            user_id: user?.id ?? null,
            numero_pedido: String(numero),
            descricao: cpDescricao,
            quantidade: cpQtd,
            valor_unitario: valorTotal,
            valor_total: valorTotal,
            status: 'pendente',
          } as any);
        }
      } else if (editingId) {
        // Vínculo removido manualmente: limpa o registro em contrato_pedidos
        await supabase.from('contrato_pedidos').delete().eq('pedido_id', pedidoId);
      }
    }

    setSaving(false);
    toast.success(editingId ? 'Pedido atualizado' : 'Pedido criado');
    await loadPedidos();
    closeForm();
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id);
    setDeleteMotivo('');
    setKanbanMenu(null);
  }

  async function confirmarDelete() {
    if (!deleteConfirmId) return;
    if (!deleteMotivo.trim()) { toast.error('Informe o motivo da exclusão'); return; }
    setDeletingPedido(true);
    // Sincroniza: remove o registro em contrato_pedidos vinculado a este pedido
    await supabase.from('contrato_pedidos').delete().eq('pedido_id', deleteConfirmId);
    const { error } = await supabase.from('pedidos' as never).delete().eq('id', deleteConfirmId);
    setDeletingPedido(false);
    if (error) { toast.error('Erro ao excluir pedido'); return; }
    toast.success('Pedido excluído e vínculo com contrato removido.');
    if (editingId === deleteConfirmId) closeForm();
    setDeleteConfirmId(null);
    setDeleteMotivo('');
    await loadPedidos();
  }

  function closeForm() {
    setView('kanban'); setEditingId(null); setEditingNum(null);
    setForm(defaultForm()); setItens([]); setSelectedItem(null);
  }

  function handleImprimir() {
    const pessoaNome = getPessoaNome(form.pessoa_id) ?? '—';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Habilite pop-ups para imprimir'); return; }
    const itemRows = itens.map(i => {
      const qt = parseM(i.quantidade);
      const pu = parseM(i.preco_unitario);
      return `<tr>
        <td>${i.codigo_produto || '—'}</td>
        <td>${i.descricao}</td>
        <td>${i.unidade}</td>
        <td style="text-align:right">${fmtM(qt)}</td>
        <td style="text-align:right">R$ ${fmtM(pu)}</td>
        <td style="text-align:right">R$ ${fmtM(qt * pu)}</td>
      </tr>`;
    }).join('');
    const isV = form.tipo === 'venda';
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="utf-8"/>
      <title>Pedido Nº ${editingNum ?? 'Novo'}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:900px;margin:0 auto}
        h2{margin:0 0 4px;font-size:18px}h3{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
        .row{display:flex;gap:24px;margin-bottom:8px}.field{flex:1}.label{font-size:11px;color:#666;margin-bottom:2px}
        table{width:100%;border-collapse:collapse;margin-top:4px}
        th{background:#f5f5f5;text-align:left;padding:6px 8px;font-size:11px;border:1px solid #ddd}
        td{padding:6px 8px;font-size:12px;border:1px solid #ddd}
        .totals{text-align:right;margin-top:12px}.totals p{margin:2px 0}
        @media print{.no-print{display:none}}
      </style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <h2>Pedido de ${isV ? 'Venda' : 'Compra'} Nº ${editingNum ?? '—'}</h2>
          <p style="color:#666;font-size:12px;margin:2px 0">${STATUS_MSG[editingStatus] ?? editingStatus}</p>
        </div>
        <button class="no-print" onclick="window.print()" style="padding:6px 16px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer">Imprimir</button>
      </div>
      <h3>${isV ? 'Cliente' : 'Fornecedor'}</h3>
      <div class="row">
        <div class="field"><div class="label">Nome</div><div>${pessoaNome}</div></div>
        <div class="field"><div class="label">Previsão de Faturamento</div><div>${fmtDateBR(form.previsao_faturamento)}</div></div>
        <div class="field"><div class="label">Pagamento</div><div>${form.numero_parcelas || 'A Vista'}</div></div>
      </div>
      ${form.vendedor ? `<div class="row"><div class="field"><div class="label">Vendedor</div><div>${form.vendedor}</div></div></div>` : ''}
      <h3>Itens</h3>
      <table>
        <thead><tr>
          <th>Código</th><th>Descrição</th><th>Unid.</th>
          <th style="text-align:right">Qtd</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${itemRows || '<tr><td colspan="6" style="text-align:center;color:#999">Nenhum item</td></tr>'}</tbody>
      </table>
      <div class="totals">
        <p>Total de Mercadorias: <strong>R$ ${fmtM(totalMerc)}</strong></p>
        ${desconto > 0 ? `<p>Desconto: <strong>− R$ ${fmtM(desconto)}</strong></p>` : ''}
        <p style="font-size:16px;margin-top:6px">Valor Total: <strong>R$ ${fmtM(valorTotal)}</strong></p>
      </div>
      ${form.observacoes ? `<h3>Observações</h3><p style="white-space:pre-wrap">${form.observacoes}</p>` : ''}
    </body></html>`);
    win.document.close();
  }

  async function handleDuplicar() {
    if (!editingId || !empresaAtiva) return;
    setDuplicating(true);
    try {
      const nextNum = await getNextNumero();
      const { data: saved, error: e1 } = await supabase
        .from('pedidos' as never)
        .insert({
          empresa_id: empresaAtiva.id, numero: nextNum, tipo: form.tipo, status: 'pedido',
          pessoa_id: form.pessoa_id || null, previsao_faturamento: form.previsao_faturamento || null,
          total_mercadorias: totalMerc, valor_desconto: desconto,
          total_ipi: 0, total_icms_st: 0, valor_total: valorTotal,
          vendedor: form.vendedor || null, numero_parcelas: form.numero_parcelas || 'A Vista',
          cenario_fiscal: form.cenario_fiscal || null, categoria: form.categoria || null,
          conta_corrente: form.conta_corrente || null, etapa: form.etapa || null,
          num_pedido_cliente: form.num_pedido_cliente || null, num_contrato_venda: form.num_contrato_venda || null,
          contato: form.contato || null, projeto: form.projeto || null,
          origem_pedido: form.origem_pedido || 'sistema',
          dados_adicionais_nfe: form.dados_adicionais_nfe || null,
          nf_consumo_final: form.nf_consumo_final, email_destinatario: form.email_destinatario || null,
          enviar_boleto: form.enviar_boleto, observacoes: form.observacoes || null,
        } as never)
        .select().single();
      if (e1 || !saved) throw e1 ?? new Error('Falha ao duplicar');
      const newId = (saved as { id: string }).id;
      if (itens.length > 0) {
        await supabase.from('pedido_itens' as never).insert(
          itens.map(i => ({
            pedido_id: newId, empresa_id: empresaAtiva.id,
            produto_id: i.produto_id || null, codigo_produto: i.codigo_produto || null,
            descricao: i.descricao, unidade: i.unidade,
            quantidade: parseM(i.quantidade) || 1, preco_unitario: parseM(i.preco_unitario),
            valor_total: parseM(i.quantidade) * parseM(i.preco_unitario),
            local_estoque: i.local_estoque || null,
          })) as never
        );
      }
      await loadPedidos();
      toast.success(`Pedido Nº ${nextNum} criado como cópia do Nº ${editingNum}.`);
    } catch {
      toast.error('Erro ao duplicar pedido.');
    } finally {
      setDuplicating(false);
    }
  }

  async function handleConferir() {
    if (!editingId) return;
    const PROX: Partial<Record<Pedido['status'], Pedido['status']>> = {
      pedido: 'separar_estoque',
      separar_estoque: 'faturar',
    };
    const prox = PROX[editingStatus];
    if (!prox) { toast.info('Pedido já está na etapa final de conferência.'); return; }
    await updatePedidoStatus(editingId, prox);
    setEditingStatus(prox);
    toast.success(`Pedido movido para: ${STATUS_MSG[prox]}`);
  }

  function handleFaturarAgora() {
    if (!editingId) return;
    setPendingFaturarId(editingId);
    setNfeAlertOpen(true);
  }

  async function loadAnexos() {
    if (!editingId || !empresaAtiva) return;
    setAnexosLoading(true);
    const path = `${empresaAtiva.id}/${editingId}`;
    const { data, error } = await supabase.storage.from('pedidos-anexos').list(path);
    if (error) { toast.error('Erro ao listar anexos. Verifique se o bucket "pedidos-anexos" existe.'); setAnexosLoading(false); return; }
    const items = (data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder');
    const urls = items.map(f => {
      const { data: urlData } = supabase.storage.from('pedidos-anexos').getPublicUrl(`${path}/${f.name}`);
      return { name: f.name, size: (f as any).metadata?.size ?? 0, url: urlData.publicUrl };
    });
    setAnexosList(urls);
    setAnexosLoading(false);
  }

  async function uploadAnexo(file: File) {
    if (!editingId || !empresaAtiva) return;
    setUploadingAnexo(true);
    const path = `${empresaAtiva.id}/${editingId}/${file.name}`;
    const { error } = await supabase.storage.from('pedidos-anexos').upload(path, file, { upsert: true });
    if (error) {
      toast.error(`Erro ao enviar arquivo: ${error.message}`);
    } else {
      toast.success('Arquivo enviado.');
      await loadAnexos();
    }
    setUploadingAnexo(false);
  }

  async function openAnexos() {
    setAnexosOpen(true);
    await loadAnexos();
  }

  async function openHistorico() {
    if (!editingId) return;
    setHistoricoData(null);
    setHistoricoOpen(true);
    const { data } = await supabase.from('pedidos' as never).select('*').eq('id', editingId).single();
    setHistoricoData((data as Pedido) ?? null);
  }

  function addOrUpdateItem(item: ItemForm) {
    setItens(prev => {
      const idx = prev.findIndex(i => i._key === item._key);
      if (idx >= 0) return prev.map(i => i._key === item._key ? item : i);
      return [...prev, item];
    });
    setEditingItem(undefined);
  }

  function removeItem(key: string) {
    setItens(prev => prev.filter(i => i._key !== key));
    if (selectedItem === key) setSelectedItem(null);
  }

  // Computed totals
  const totalMerc  = itens.reduce((s, i) => s + parseM(i.quantidade) * parseM(i.preco_unitario), 0);
  const desconto   = parseM(form.valor_desconto);
  const valorTotal = Math.max(0, totalMerc - desconto);

  // Kanban data
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = String(p.numero).includes(q) || (getPessoaNome(p.pessoa_id) ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (tipoFilter && p.tipo !== tipoFilter) return false;
      if (dateFrom && p.previsao_faturamento && p.previsao_faturamento < dateFrom) return false;
      if (dateTo   && p.previsao_faturamento && p.previsao_faturamento > dateTo)   return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, search, tipoFilter, dateFrom, dateTo, todasPessoas]);

  const totalCompras = useMemo(() => pedidos.filter(p => p.tipo === 'compra').reduce((s, p) => s + p.valor_total, 0), [pedidos]);
  const totalVendas  = useMemo(() => pedidos.filter(p => p.tipo === 'venda').reduce((s, p) => s + p.valor_total, 0), [pedidos]);

  const kanbanCols = useMemo(() =>
    KANBAN_STATUS.map(col => ({
      ...col,
      items: filteredPedidos.filter(p => p.status === col.key),
    })), [filteredPedidos]
  );

  const selectedItemObj = itens.find(i => i._key === selectedItem);

  // ── Status badge colors ────────────────────────────────────────────────
  const STATUS_BADGE: Record<string, string> = {
    pedido:          'border-border text-muted-foreground',
    separar_estoque: 'border-border text-muted-foreground',
    faturar:         'border-border text-muted-foreground',
    faturado:        'border-success/30 text-success',
    entrega:         'border-border text-muted-foreground',
    cancelado:       'border-destructive/30 text-destructive',
  };

  // ── Delete Confirm Dialog ──────────────────────────────────────────────
  const DeleteConfirmDialog = (
    <Dialog open={!!deleteConfirmId} onOpenChange={v => { if (!v) { setDeleteConfirmId(null); setDeleteMotivo(''); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" /> Excluir Pedido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Esta ação também removerá o vínculo deste pedido dentro da <strong>Gestão de Contratos</strong>, caso exista.
          </p>
          <div>
            <Label className="text-xs">Motivo da exclusão <span className="text-destructive">*</span></Label>
            <Textarea
              className="mt-1 text-sm resize-none"
              rows={3}
              placeholder="Descreva o motivo para excluir este pedido..."
              value={deleteMotivo}
              onChange={e => setDeleteMotivo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => { setDeleteConfirmId(null); setDeleteMotivo(''); }}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={confirmarDelete} disabled={deletingPedido || !deleteMotivo.trim()}>
            {deletingPedido ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── NF-e Alert Dialog ──────────────────────────────────────────────────
  const NfeAlertDialog = (
    <Dialog open={nfeAlertOpen} onOpenChange={setNfeAlertOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Faturar Pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Ao mover para <strong>Faturado</strong>, o sistema pode emitir a NF-e automaticamente
            se houver um certificado A3 vinculado à conta.
          </p>
          <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-xs text-warning flex items-start gap-2">
            <Zap className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
            <span>Nenhum certificado A3 vinculado. A NF-e <strong>não será emitida</strong> automaticamente.</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => { setNfeAlertOpen(false); setPendingFaturarId(null); }}>
            Cancelar
          </Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={async () => {
              if (pendingFaturarId) {
                await updatePedidoStatus(pendingFaturarId, 'faturado');
                if (pendingFaturarId === editingId) setEditingStatus('faturado');
                // Open conta a receber dialog
                if (empresaAtiva?.id) {
                  const { data: contas } = await supabase
                    .from('financeiro_contas' as never)
                    .select('id, nome, tipo')
                    .eq('empresa_id', empresaAtiva.id)
                    .order('nome');
                  setFaturadoContas((contas ?? []) as any[]);
                }
                setFaturadoContaId('');
                setFaturadoParcelas('1');
                setNfeAlertOpen(false);
                setFaturadoContaOpen(true);
              } else {
                setNfeAlertOpen(false);
                setPendingFaturarId(null);
              }
            }}>
            <Zap className="w-3.5 h-3.5 mr-1" /> Faturar mesmo assim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Faturado → Conta a Receber dialog ─────────────────────────────────
  const faturadoPedido = pendingFaturarId ? pedidos.find(x => x.id === pendingFaturarId) : null;
  const FaturadoContaDialog = (
    <Dialog open={faturadoContaOpen} onOpenChange={(open) => {
      if (!open) { setFaturadoContaOpen(false); setPendingFaturarId(null); }
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Lançar Conta a Receber</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Pedido faturado com sucesso. Deseja registrar uma conta a receber no Financeiro?
          </p>
          {faturadoPedido && (
            <div className="bg-muted/40 border rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedido</span>
                <span className="font-medium">#{faturadoPedido.numero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-semibold text-primary">
                  {faturadoPedido.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Conta destino</Label>
            <Select value={faturadoContaId} onValueChange={setFaturadoContaId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione a conta bancária..." />
              </SelectTrigger>
              <SelectContent>
                {faturadoContas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número de parcelas</Label>
            <Input
              type="number" min="1" max="60"
              className="h-8 text-sm"
              value={faturadoParcelas}
              onChange={e => setFaturadoParcelas(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => { setFaturadoContaOpen(false); setPendingFaturarId(null); }}>
            Pular
          </Button>
          <Button size="sm" disabled={!faturadoContaId || savingFaturado}
            onClick={async () => {
              if (!faturadoPedido || !faturadoContaId) return;
              setSavingFaturado(true);
              try {
                const parcelas = Math.max(1, parseInt(faturadoParcelas) || 1);
                const valorParcela = faturadoPedido.valor_total / parcelas;
                const hoje = new Date();
                const inserts = Array.from({ length: parcelas }, (_, i) => {
                  const venc = new Date(hoje);
                  venc.setMonth(venc.getMonth() + i + 1);
                  return {
                    empresa_id: faturadoPedido.empresa_id,
                    tipo: 'a_receber' as const,
                    natureza: 'receita' as const,
                    status: 'previsto' as const,
                    descricao: `Pedido #${faturadoPedido.numero}${parcelas > 1 ? ` — Parcela ${i + 1}/${parcelas}` : ''}`,
                    valor: parseFloat(valorParcela.toFixed(2)),
                    data_competencia: venc.toISOString().slice(0, 10),
                    conta_id: faturadoContaId,
                    origem: 'manual' as const,
                    origem_tipo: 'manual' as const,
                    origem_job: 'PedidosOmie.faturado',
                    origem_usuario_id: user?.id ?? null,
                    origem_timestamp: new Date().toISOString(),
                    created_by: user?.id ?? null,
                  };
                });
                const { error } = await supabase.from('financeiro_lancamentos' as never).insert(inserts as any);
                if (error) {
                  toast.error('Erro ao gerar conta a receber: ' + error.message);
                } else {
                  toast.success(`${parcelas} conta(s) a receber criada(s) no Financeiro.`);
                  setFaturadoContaOpen(false);
                  setPendingFaturarId(null);
                }
              } catch {
                toast.error('Erro ao gerar conta a receber.');
              } finally {
                setSavingFaturado(false);
              }
            }}>
            {savingFaturado
              ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              : <Check className="w-3.5 h-3.5 mr-1" />}
            Gerar {parseInt(faturadoParcelas) > 1 ? `${faturadoParcelas} parcelas` : 'conta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Type selection dialog ───────────────────────────────────────────────
  const TypeDialog = (
    <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Novo Pedido</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Selecione o tipo de pedido:</p>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => openNovo('compra')}
            className="flex flex-col items-center gap-3 p-5 border-2 rounded-xl hover:border-accent hover:bg-accent/10 transition-all"
          >
            <ShoppingBag className="w-9 h-9 text-accent" />
            <div className="text-center">
              <p className="font-semibold text-sm">Pedido de Compra</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vincular fornecedor</p>
            </div>
          </button>
          <button
            onClick={() => openNovo('venda')}
            className="flex flex-col items-center gap-3 p-5 border-2 rounded-xl hover:border-accent hover:bg-accent/10 transition-all"
          >
            <ShoppingCart className="w-9 h-9 text-accent" />
            <div className="text-center">
              <p className="font-semibold text-sm">Pedido de Venda</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vincular cliente</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Anexos Dialog ──────────────────────────────────────────────────────
  const AnexosDialog = (
    <Dialog open={anexosOpen} onOpenChange={setAnexosOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-accent" />
            Anexos — Pedido Nº {editingNum}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{anexosList.length} arquivo(s)</span>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingAnexo}>
              {uploadingAnexo
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : <Plus className="w-4 h-4 mr-1" />}
              Adicionar arquivo
            </Button>
          </div>
          {anexosLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : anexosList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-md border-dashed">
              Nenhum arquivo anexado.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {anexosList.map(f => (
                <div key={f.name} className="flex items-center gap-2 p-2.5 rounded-md border text-sm">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate font-medium">{f.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {f.size > 1024 * 1024
                      ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
                      : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                  </span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={async () => {
                      const path = `${empresaAtiva!.id}/${editingId}/${f.name}`;
                      await supabase.storage.from('pedidos-anexos').remove([path]);
                      toast.success('Arquivo removido.');
                      await loadAnexos();
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Bucket: <code>pedidos-anexos</code> (crie o bucket privado no Supabase Storage se necessário)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Histórico Dialog ────────────────────────────────────────────────────
  const HistoricoDialog = (
    <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            Histórico — Pedido Nº {editingNum}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!historicoData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            </div>
          ) : (
            <>
              <div className="space-y-2.5 border rounded-md p-3 bg-muted/20">
                {[
                  { label: 'Criado em',       value: new Date(historicoData.created_at).toLocaleString('pt-BR') },
                  { label: 'Última alteração', value: new Date(historicoData.updated_at).toLocaleString('pt-BR') },
                  { label: 'Status atual',     value: STATUS_MSG[historicoData.status] ?? historicoData.status },
                  { label: 'Tipo',             value: historicoData.tipo === 'venda' ? 'Pedido de Venda' : 'Pedido de Compra' },
                  { label: 'Origem',           value: historicoData.origem_pedido ?? 'sistema' },
                  { label: 'Etapa',            value: historicoData.etapa ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground w-36 shrink-0">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2.5">
                Registro detalhado de alterações requer configuração de auditoria no banco de dados.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── KANBAN VIEW ─────────────────────────────────────────────────────────
  if (view === 'kanban') {
    return (
      <div className="flex flex-col gap-3">
        {TypeDialog}
        {NfeAlertDialog}
        {FaturadoContaDialog}
        {AnexosDialog}
        {HistoricoDialog}
        {DeleteConfirmDialog}

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Digite o que deseja pesquisar"
              className="text-sm pr-8"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={() => setSearch('')}
            className="text-xs text-accent hover:underline whitespace-nowrap">
            Exibindo tudo
          </button>

          {/* View mode toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              title="Visualizar como lista"
              className={`px-2.5 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Visualizar como kanban"
              className={`px-2.5 py-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="ml-auto">
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setTipoOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo Pedido
            </Button>
          </div>
        </div>

        {/* Filtros + Somatório */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/20 border rounded-lg px-3 py-2">
          {/* Filtro tipo */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Tipo:</span>
            <div className="flex items-center rounded-md border overflow-hidden text-xs">
              {([['', 'Todos'], ['compra', 'Compra'], ['venda', 'Venda']] as const).map(([val, lbl]) => (
                <button key={val}
                  onClick={() => setTipoFilter(val)}
                  className={`px-2.5 py-1 transition-colors ${tipoFilter === val ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro data */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Previsão:</span>
            <DatePickerBtn value={dateFrom} onChange={setDateFrom} placeholder="Data inicial" />
            <span className="text-xs text-muted-foreground">até</span>
            <DatePickerBtn value={dateTo} onChange={setDateTo} placeholder="Data final" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Somatórios */}
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs text-muted-foreground">Compras:</span>
              <span className="text-xs font-semibold text-accent">R$ {fmtM(totalCompras)}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-info shrink-0" />
              <span className="text-xs text-muted-foreground">Vendas:</span>
              <span className="text-xs font-semibold text-info">R$ {fmtM(totalVendas)}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === 'list' ? (
          /* ── LIST VIEW ── */
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b z-10">
                <tr>
                  {['Nº', 'Tipo', 'Cliente / Fornecedor', 'Status', 'Previsão', 'Valor Total', ''].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {h} {h && h !== '' && <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                      </div>
                      {h && <div className="h-px bg-border mt-1" />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPedidos.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">Nenhum pedido encontrado</td></tr>
                ) : filteredPedidos.map(p => {
                  const pessoaNome = getPessoaNome(p.pessoa_id);
                  const isHoje = p.previsao_faturamento === todayISO();
                  return (
                    <tr key={p.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onDoubleClick={() => openEdit(p)}
                    >
                      <td className="py-2 px-3 font-medium text-xs">#{p.numero}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${p.tipo === 'venda' ? 'border-info/30 text-info' : 'border-accent/30 text-accent'}`}>
                            {p.tipo === 'venda' ? 'Venda' : 'Compra'}
                          </Badge>
                          {p.contrato_id && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 border-border text-muted-foreground">
                              Contrato
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs font-medium">{pessoaNome ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">
                          {STATUS_MSG[p.status]}
                        </Badge>
                      </td>
                      <td className={`py-2 px-3 text-xs ${isHoje ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                        {p.previsao_faturamento ? fmtDateBR(p.previsao_faturamento) : '—'}
                        {isHoje && <span className="ml-1 text-xs">• hoje</span>}
                      </td>
                      <td className="py-2 px-3 text-xs text-right font-semibold">R$ {fmtM(p.valor_total)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-accent" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t px-4 py-2 bg-muted/10 text-xs text-muted-foreground">
              {filteredPedidos.length === 0 ? 'Nenhum registro' : `${filteredPedidos.length} pedido${filteredPedidos.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        ) : (
          /* ── KANBAN VIEW ── */
          <div className="flex gap-3 overflow-x-auto pb-2 relative" style={{ minHeight: 'calc(100vh - 300px)' }}>
            {/* Ghost card shown while dragging */}
            {draggingId && ghostPos && (() => {
              const dp = pedidos.find(x => x.id === draggingId);
              return dp ? (
                <div
                  style={{ position: 'fixed', left: ghostPos.x + 12, top: ghostPos.y + 8, zIndex: 9999, pointerEvents: 'none', width: 210 }}
                  className="bg-background border-2 border-accent rounded-lg p-2.5 shadow-2xl opacity-90 rotate-1"
                >
                  <p className="text-xs font-semibold text-muted-foreground">Pedido Nº {dp.numero}</p>
                  {getPessoaNome(dp.pessoa_id) && <p className="text-xs font-medium mt-0.5 truncate">{getPessoaNome(dp.pessoa_id)}</p>}
                  <p className="text-xs font-bold mt-1">R$ {fmtM(dp.valor_total)}</p>
                </div>
              ) : null;
            })()}

            {kanbanCols.map((col, colIdx) => (
              <div key={col.key}
                data-col={col.key}
                className={`flex flex-col min-w-[230px] max-w-[230px] rounded-lg border transition-colors ${draggingId && dragOverCol === col.key ? 'bg-accent/10 border-accent/60 shadow-inner' : 'bg-muted/20 border-muted/40'}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-muted/40">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {col.items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {col.items.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">Nenhum registro</p>
                  ) : col.items.map(p => {
                    const pessoaNome = getPessoaNome(p.pessoa_id);
                    const isHoje = p.previsao_faturamento === todayISO();
                    const statusMsg = isHoje ? 'Previsto para hoje' : STATUS_MSG[p.status];
                    const menuOpen = kanbanMenu === p.id;

                    return (
                      <div key={p.id}
                        onPointerDown={e => { if (!(e.target as HTMLElement).closest('button')) startDrag(e, p.id); }}
                        onDoubleClick={() => { if (!draggingId) openEdit(p); }}
                        className={`bg-background border rounded-lg p-2.5 hover:shadow-sm transition-all select-none touch-none ${draggingId === p.id ? 'opacity-40 scale-95 cursor-grabbing' : 'cursor-grab'}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-muted-foreground">
                                Pedido Nº {p.numero}
                              </span>
                              <Badge variant="outline" className={`text-xs px-1 py-0 ${p.tipo === 'venda' ? 'border-info/30 text-info' : 'border-accent/30 text-accent'}`}>
                                {p.tipo === 'venda' ? 'Venda' : 'Compra'}
                              </Badge>
                              {p.contrato_id && (
                                <Badge variant="outline" className="text-xs px-1 py-0 border-border text-muted-foreground">
                                  Contrato
                                </Badge>
                              )}
                            </div>
                            {pessoaNome && (
                              <p className="text-xs font-medium mt-0.5 leading-tight truncate">{pessoaNome}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{statusMsg}</p>
                            <p className="text-xs font-semibold mt-1 text-foreground">
                              $ {fmtM(p.valor_total)}
                              {p.numero_parcelas && p.numero_parcelas !== 'A Vista' && (
                                <span className="text-muted-foreground font-normal"> em {p.numero_parcelas}x</span>
                              )}
                            </p>
                          </div>
                          <button
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0 mt-0.5"
                            onClick={e => {
                              e.stopPropagation();
                              setKanbanMenu(menuOpen ? null : p.id);
                            }}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {menuOpen && (
                          <div className="mt-2 border-t pt-2 space-y-0.5">
                            <button
                              className="w-full text-left text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/50"
                              onClick={() => { setKanbanMenu(null); openEdit(p); }}
                            >
                              <Pencil className="w-3 h-3 text-accent" /> Editar
                            </button>
                            {KANBAN_STATUS.filter(s => s.key !== p.status).map(s => (
                              <button key={s.key}
                                className="w-full text-left text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 py-1 rounded hover:bg-muted/50"
                                onClick={async () => {
                                  setKanbanMenu(null);
                                  if (s.key === 'faturado') { setPendingFaturarId(p.id); setNfeAlertOpen(true); }
                                  else await updatePedidoStatus(p.id, s.key);
                                }}
                              >
                                <ChevronsUpDown className="w-3 h-3 text-muted-foreground" /> Mover → {s.label}
                              </button>
                            ))}
                            <button
                              className="w-full text-left text-xs text-destructive flex items-center gap-1.5 px-1 py-1 rounded hover:bg-destructive/10"
                              onClick={() => handleDelete(p.id)}
                            >
                              <Trash2 className="w-3 h-3" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Column footer */}
                <div className="p-2 border-t border-muted/40">
                  {colIdx === 0 && (
                    <button
                      onClick={() => setTipoOpen(true)}
                      className="w-full text-center text-xs font-medium py-1.5 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Novo Pedido
                    </button>
                  )}
                  {colIdx === 2 && (
                    <button className="w-full text-center text-xs py-1.5 rounded-md border text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3 text-accent" /> Faturar Todos
                    </button>
                  )}
                  {colIdx === 3 && (
                    <button className="w-full text-center text-xs py-1.5 rounded-md border text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Comunicar com a SEFAZ
                    </button>
                  )}
                  {colIdx !== 0 && colIdx !== 2 && colIdx !== 3 && (
                    <div className="h-[30px]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ───────────────────────────────────────────────────────────
  const isVenda = form.tipo === 'venda';
  const formTitle = editingId
    ? `Pedido de ${isVenda ? 'Venda' : 'Compra'} Nº ${editingNum}`
    : `Inclusão de Pedido de ${isVenda ? 'Venda' : 'Compra'}`;

  const canConferir = !!editingId && (editingStatus === 'pedido' || editingStatus === 'separar_estoque');

  const rightActions = [
    { label: 'Salvar',        icon: Save,      action: handleSave,      disabled: false,               loading: saving },
    { label: 'Imprimir',      icon: Printer,   action: handleImprimir,  disabled: !editingId,          loading: false },
    { label: 'Duplicar',      icon: Copy,      action: handleDuplicar,  disabled: !editingId,          loading: duplicating },
    { label: 'Conferir',      icon: Check,     action: handleConferir,  disabled: !canConferir,        loading: false },
    { label: 'Faturar Agora', icon: Zap,       action: handleFaturarAgora, disabled: !editingId,      loading: false },
    { label: 'Anexos',        icon: Paperclip, action: openAnexos,      disabled: !editingId,          loading: false },
    { label: 'Histórico',     icon: History,   action: openHistorico,   disabled: !editingId,          loading: false },
  ];

  return (
    <div className="border rounded-lg overflow-hidden bg-background flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {TypeDialog}
      {NfeAlertDialog}
      {FaturadoContaDialog}
      {AnexosDialog}
      {HistoricoDialog}
      {DeleteConfirmDialog}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await uploadAnexo(f);
          e.target.value = '';
        }}
      />
      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={v => { setItemDialogOpen(v); if (!v) setEditingItem(undefined); }}
        produtos={produtos}
        initial={editingItem}
        onConfirm={addOrUpdateItem}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 shrink-0 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm truncate">{formTitle}</span>
        </div>

        {/* Status changer — só exibe ao editar um pedido existente */}
        {editingId && (
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">Coluna atual:</span>
            <Badge variant="outline" className={`text-xs px-1.5 py-0 whitespace-nowrap ${STATUS_BADGE[editingStatus]}`}>
              {STATUS_MSG[editingStatus]}
            </Badge>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground whitespace-nowrap">Mover para:</span>
            <div className="flex items-center gap-1">
              {KANBAN_STATUS.filter(s => s.key !== editingStatus).map(s => (
                <button
                  key={s.key}
                  onClick={async () => {
                    if (s.key === 'faturado') {
                      setPendingFaturarId(editingId);
                      setNfeAlertOpen(true);
                    } else {
                      await updatePedidoStatus(editingId, s.key);
                      setEditingStatus(s.key);
                    }
                  }}
                  className={`px-2 py-0.5 rounded border text-xs transition-colors hover:bg-muted/60 whitespace-nowrap ${STATUS_BADGE[s.key]}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={closeForm} className="text-muted-foreground hover:text-foreground text-sm font-medium shrink-0">
          Fechar ✕
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: form */}
        <div className="flex-1 overflow-y-auto">
          {/* Top section */}
          <div className="p-4 border-b space-y-3">
            {/* Pessoa + date */}
            <div className="flex items-end gap-3">
              <div className="shrink-0">
                <User className="w-9 h-9 text-muted-foreground/40 border rounded-md p-1.5" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <Label className="text-xs text-muted-foreground">{isVenda ? 'Cliente' : 'Fornecedor'}</Label>
                <div className="flex items-center gap-2">
                  <PessoaCombobox
                    pessoas={pessoasParaTipo}
                    value={form.pessoa_id}
                    onChange={id => setForm(f => ({ ...f, pessoa_id: id }))}
                  />
                  {isVenda && (
                    <span className="text-xs text-accent whitespace-nowrap cursor-pointer hover:underline">
                      @ Consulta de Crédito
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <Label className="text-xs text-muted-foreground">Previsão de Faturamento</Label>
                <Input
                  type="date"
                  value={form.previsao_faturamento}
                  onChange={e => setForm(f => ({ ...f, previsao_faturamento: e.target.value }))}
                  className="text-sm mt-1 w-40"
                />
              </div>
            </div>

            {/* Vínculo com Contrato (opcional) */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 border border-border">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Contrato vinculado:</span>
              {form.contrato_id ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {contratos.find(c => c.id === form.contrato_id)?.numero_contrato ?? '—'}
                    {contratos.find(c => c.id === form.contrato_id)?.orgao_contratante
                      ? ` · ${contratos.find(c => c.id === form.contrato_id)!.orgao_contratante}`
                      : ''}
                  </span>
                  <button
                    onClick={() => setForm(f => ({ ...f, contrato_id: '' }))}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Remover vínculo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Select value="" onValueChange={v => setForm(f => ({ ...f, contrato_id: v }))}>
                  <SelectTrigger className="h-7 text-xs flex-1 max-w-sm border-border bg-background">
                    <SelectValue placeholder="Nenhum — selecione para vincular (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratos.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum contrato cadastrado</div>
                    ) : contratos.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.numero_contrato}{c.orgao_contratante ? ` — ${c.orgao_contratante}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-5 gap-2">
              {([
                { label: 'Total de Mercadorias',   val: fmtM(totalMerc),   editable: false },
                { label: 'Valor do Desconto',       val: null,              editable: true  },
                { label: 'Total de IPI',            val: '0,00',            editable: false },
                { label: 'Total de ICMS ST',        val: '0,00',            editable: false },
                { label: 'Valor Total do Pedido',   val: fmtM(valorTotal),  editable: false },
              ] as const).map(t => (
                <div key={t.label}>
                  <Label className="text-xs text-muted-foreground leading-tight">{t.label}</Label>
                  {t.editable ? (
                    <Input
                      value={form.valor_desconto}
                      onChange={e => setForm(f => ({ ...f, valor_desconto: inputM(e.target.value) }))}
                      className="text-sm mt-1 text-right" inputMode="numeric"
                    />
                  ) : (
                    <Input value={t.val!} readOnly className="text-sm mt-1 text-right bg-muted/30 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>

            {/* Vendedor / Parcelas / Cenário */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">{isVenda ? 'Vendedor' : 'Comprador'} +</Label>
                <div className="relative mt-1">
                  <Input value={form.vendedor} onChange={e => setForm(f => ({ ...f, vendedor: e.target.value }))} className="text-sm pr-8" />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Número de Parcelas ✏ +</Label>
                <div className="relative mt-1">
                  <Input value={form.numero_parcelas} onChange={e => setForm(f => ({ ...f, numero_parcelas: e.target.value }))} className="text-sm pr-8" />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cenário Fiscal</Label>
                <Input
                  value={form.cenario_fiscal}
                  onChange={e => setForm(f => ({ ...f, cenario_fiscal: e.target.value }))}
                  className="text-sm mt-1" placeholder="Selecione o cenário na lista..."
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="itens">
            <TabsList className="px-4 w-full justify-start rounded-none border-b bg-transparent h-auto pb-0 gap-0 shrink-0">
              {[
                { value: 'itens',        label: `Itens da ${isVenda ? 'Venda' : 'Compra'}` },
                { value: 'departamentos', label: 'Departamentos'          },
                { value: 'frete',        label: 'Frete e Outras Despesas' },
                { value: 'adicional',    label: 'Informações Adicionais'  },
                { value: 'parcelas',     label: 'Parcelas'                },
                { value: 'obs',          label: 'Observações'             },
                { value: 'email',        label: `E-mail para o ${isVenda ? 'Cliente' : 'Fornecedor'}` },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-accent text-xs px-3 pb-2 bg-transparent shadow-none">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Itens */}
            <TabsContent value="itens" className="p-4 m-0">
              <div className="flex items-center gap-2 mb-3">
                <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground h-7 text-xs"
                  onClick={() => { setEditingItem(undefined); setItemDialogOpen(true); }}>
                  <Plus className="w-3 h-3 mr-1" /> Novo Item
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!selectedItem}
                  onClick={() => { setEditingItem(selectedItemObj); setItemDialogOpen(true); }}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar Item
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                  disabled={!selectedItem}
                  onClick={() => selectedItem && removeItem(selectedItem)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Excluir Item
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground w-24">Produto</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Descrição do Produto</th>
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground w-24">Quantidade</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Local de Estoque</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground w-28">Preço Unitário</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground w-24">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {itens.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
                    ) : itens.map(item => {
                      const vt = parseM(item.quantidade) * parseM(item.preco_unitario);
                      const isSel = selectedItem === item._key;
                      return (
                        <tr key={item._key}
                          className={`cursor-pointer transition-colors ${isSel ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-muted/30'}`}
                          onClick={() => setSelectedItem(isSel ? null : item._key)}
                          onDoubleClick={() => { setEditingItem(item); setItemDialogOpen(true); }}
                        >
                          <td className="py-1.5 px-2 text-accent font-medium">{item.codigo_produto || '—'}</td>
                          <td className="py-1.5 px-2">{item.descricao}</td>
                          <td className="py-1.5 px-2 text-center">{item.quantidade} {item.unidade}</td>
                          <td className="py-1.5 px-2 text-muted-foreground text-xs">{item.local_estoque}</td>
                          <td className="py-1.5 px-2 text-right">{item.preco_unitario}</td>
                          <td className="py-1.5 px-2 text-right font-medium">{fmtM(vt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t px-3 py-1.5 bg-muted/10 text-xs text-muted-foreground">
                  {itens.length === 0
                    ? 'Nenhum registro encontrado'
                    : `1 - ${itens.length} de ${itens.length} registro${itens.length !== 1 ? 's' : ''}`}
                </div>
              </div>
            </TabsContent>

            {/* Departamentos */}
            <TabsContent value="departamentos" className="p-4 m-0">
              <p className="text-sm text-muted-foreground">Em breve — rateio por departamentos.</p>
            </TabsContent>

            {/* Frete */}
            <TabsContent value="frete" className="p-4 m-0">
              <p className="text-sm text-muted-foreground">Em breve — frete e outras despesas.</p>
            </TabsContent>

            {/* Informações Adicionais */}
            <TabsContent value="adicional" className="p-4 m-0 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Conta Corrente</Label>
                  <Input value={form.conta_corrente} onChange={e => setForm(f => ({ ...f, conta_corrente: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Etapa</Label>
                  <Input value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))} className="text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nº do Pedido do Cliente</Label>
                  <Input value={form.num_pedido_cliente} onChange={e => setForm(f => ({ ...f, num_pedido_cliente: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nº do Contrato de Venda</Label>
                  <Input value={form.num_contrato_venda} onChange={e => setForm(f => ({ ...f, num_contrato_venda: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contato</Label>
                  <Input value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Projeto +</Label>
                  <Input value={form.projeto} onChange={e => setForm(f => ({ ...f, projeto: e.target.value }))} className="text-sm mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Origem do Pedido</Label>
                <Select value={form.origem_pedido} onValueChange={v => setForm(f => ({ ...f, origem_pedido: v }))}>
                  <SelectTrigger className="text-sm mt-1 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sistema">Sistema</SelectItem>
                    <SelectItem value="omie">Omie</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dados Adicionais para a Nota Fiscal</Label>
                <Textarea
                  value={form.dados_adicionais_nfe}
                  onChange={e => setForm(f => ({ ...f, dados_adicionais_nfe: e.target.value }))}
                  className="text-sm mt-1 min-h-[80px] resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="nf_consumo" checked={form.nf_consumo_final}
                  onCheckedChange={v => setForm(f => ({ ...f, nf_consumo_final: !!v }))} />
                <Label htmlFor="nf_consumo" className="text-sm cursor-pointer">
                  Nota Fiscal para Consumo Final
                </Label>
              </div>
            </TabsContent>

            {/* Parcelas */}
            <TabsContent value="parcelas" className="p-4 m-0">
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Parcela</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Forma de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valorTotal > 0 ? (
                      <tr className="border-b">
                        <td className="py-2 px-3">1/1</td>
                        <td className="py-2 px-3">{fmtDateBR(form.previsao_faturamento)}</td>
                        <td className="py-2 px-3 text-right font-medium">R$ {fmtM(valorTotal)}</td>
                        <td className="py-2 px-3 text-muted-foreground">{form.numero_parcelas}</td>
                      </tr>
                    ) : (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum dado de parcelas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Observações */}
            <TabsContent value="obs" className="p-4 m-0">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                className="text-sm mt-1 min-h-[160px] resize-none"
                placeholder="Observações gerais do pedido..."
              />
            </TabsContent>

            {/* E-mail */}
            <TabsContent value="email" className="p-4 m-0 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Utilizar os seguintes endereços de e-mail</Label>
                <Textarea
                  value={form.email_destinatario}
                  onChange={e => setForm(f => ({ ...f, email_destinatario: e.target.value }))}
                  className="text-sm mt-1 min-h-[80px] resize-none"
                  placeholder="seuemail@empresa.com.br"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="enviar_boleto" checked={form.enviar_boleto}
                  onCheckedChange={v => setForm(f => ({ ...f, enviar_boleto: !!v }))} />
                <Label htmlFor="enviar_boleto" className="text-sm cursor-pointer">
                  Enviar e-mail com o boleto de cobrança (juntamente com o DANFE e o XML da NF-e)
                </Label>
              </div>
              <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-xs text-warning">
                Apenas o DANFE e o XML da NF-e serão enviados por meio do Portal para o cliente
              </div>
            </TabsContent>
          </Tabs>

          {/* Bottom status bar */}
          <div className="border-t px-4 py-2 bg-accent/10 border-accent/30 shrink-0">
            <p className="text-xs text-accent flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              {form.previsao_faturamento
                ? `Previsão de faturamento: ${fmtDateBR(form.previsao_faturamento)}`
                : 'Sem previsão definida'}
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-44 border-l bg-background shrink-0 overflow-y-auto">
          <div className="p-2 space-y-0.5">
            {rightActions.map(({ label, icon: Icon, action, disabled, loading }) => (
              <button key={label} onClick={action} disabled={disabled || loading}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors
                  ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted/50'}`}
              >
                <Icon className="w-4 h-4 text-accent shrink-0" />
                <span className="text-xs">{label}</span>
                {loading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
              </button>
            ))}
            {editingId && (
              <>
                <div className="border-t my-1" />
                <button
                  onClick={() => handleDelete(editingId)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded text-left hover:bg-destructive/10 transition-colors text-destructive"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Excluir</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
