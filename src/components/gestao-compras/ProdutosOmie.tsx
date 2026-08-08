import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePessoas } from '@/hooks/useFinanceiro';
import PessoaFormDialog from '@/components/financeiro/PessoaFormDialog';
import NcmDialog from '@/components/shared/NcmDialog';
import CestDialog from '@/components/shared/CestDialog';
import { NCM_CODES } from '@/data/ncm-codes';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Pencil, Copy, UserMinus, Paperclip, History,
  ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Upload, Package, Search, Filter, ChevronsUpDown, Link, X,
} from 'lucide-react';

// ── Unidades ───────────────────────────────────────────────────────────────
const UNIDADES_TOP = [
  { value: 'PC', label: 'Peça (PC)' },
  { value: 'UN', label: 'Unidade (UN)' },
  { value: 'CX', label: 'Caixa (CX)' },
  { value: 'KG', label: 'Quilograma (KG)' },
  { value: 'L', label: 'Litro (L)' },
];
const UNIDADES_TODAS = [
  { value: 'AM', label: 'Ampola (AM)' },
  { value: 'BD', label: 'Balde (BD)' },
  { value: 'BJ', label: 'Bandeja (BJ)' },
  { value: 'BAR', label: 'Barril (BAR)' },
  { value: 'BIS', label: 'Bisnaga (BIS)' },
  { value: 'BL', label: 'Bloco (BL)' },
  { value: 'BO', label: 'Bobina (BO)' },
  { value: 'BSA', label: 'Bolsa (BSA)' },
  { value: 'BOMB', label: 'Bombona (BOMB)' },
  { value: 'CPS', label: 'Cápsula (CPS)' },
  { value: 'CRT', label: 'Cartela (CRT)' },
  { value: 'CJ', label: 'Conjunto (CJ)' },
  { value: 'CT', label: 'Cento (CT)' },
  { value: 'CX', label: 'Caixa (CX)' },
  { value: 'CXE', label: 'Caixa com embalagem (CXE)' },
  { value: 'DZ', label: 'Dúzia (DZ)' },
  { value: 'EMB', label: 'Embalagem (EMB)' },
  { value: 'EN', label: 'Envelope (EN)' },
  { value: 'FARDO', label: 'Fardo (FARDO)' },
  { value: 'FR', label: 'Frasco (FR)' },
  { value: 'GL', label: 'Galão (GL)' },
  { value: 'GF', label: 'Garrafa (GF)' },
  { value: 'G', label: 'Grama (G)' },
  { value: 'GR', label: 'Grosa (GR)' },
  { value: 'KG', label: 'Quilograma (KG)' },
  { value: 'KIT', label: 'Kit (KIT)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'LT', label: 'Lata (LT)' },
  { value: 'M', label: 'Metro (M)' },
  { value: 'M2', label: 'Metro quadrado (M²)' },
  { value: 'M3', label: 'Metro cúbico (M³)' },
  { value: 'MG', label: 'Miligrama (MG)' },
  { value: 'ML', label: 'Mililitro (ML)' },
  { value: 'MM', label: 'Milímetro (MM)' },
  { value: 'PAR', label: 'Par (PAR)' },
  { value: 'PC', label: 'Peça (PC)' },
  { value: 'PCT', label: 'Pacote (PCT)' },
  { value: 'POTE', label: 'Pote (POTE)' },
  { value: 'RL', label: 'Rolo (RL)' },
  { value: 'SC', label: 'Saco (SC)' },
  { value: 'SERV', label: 'Serviço (SERV)' },
  { value: 'TB', label: 'Tubo (TB)' },
  { value: 'TON', label: 'Tonelada (TON)' },
  { value: 'UN', label: 'Unidade (UN)' },
  { value: 'VIDRO', label: 'Vidro (VIDRO)' },
];

// ── Types ──────────────────────────────────────────────────────────────────
type Produto = {
  id: string; empresa_id: string; codigo: string | null; descricao: string;
  unidade: string; categoria: string | null; saldo_atual: number; saldo_minimo: number;
  preco_custo_medio: number; preco_venda: number | null;
  ativo: boolean; created_at: string; updated_at: string;
  ncm: string | null; cfop: string | null; cst_icms: string | null; csosn: string | null;
  cst_pis: string | null; cst_cofins: string | null; p_icms: number | null;
  p_pis: number | null; p_cofins: number | null;
  codigo_ean: string | null; cest: string | null; tipo_produto: string | null;
  origem_mercadoria: string | null; numero_fci: string | null;
  peso_liquido: number | null; peso_bruto: number | null;
  altura: number | null; largura: number | null; profundidade: number | null;
  dias_crossdocking: number | null; lead_time_ressuprimento: number | null;
  marca: string | null; modelo: string | null; dias_garantia: number | null;
  unidade_tributavel: string | null; quantidade_tributavel: number | null;
  fator_conversao: number | null; codigo_ean_tributavel: string | null;
  indicador_producao_escala: string | null; observacoes: string | null;
};

type FornecedorVinculado = { id: string; nome: string; documento: string | null };

type ProdutoForm = {
  descricao: string; codigo_ean: string; unidade: string; preco_venda: string;
  ncm: string; familia_produto: string; tipo_simples: boolean;
  peso_liquido: string; peso_bruto: string; altura: string; largura: string;
  profundidade: string; dias_crossdocking: string; lead_time_ressuprimento: string;
  marca: string; modelo: string; dias_garantia: string;
  vender_marketplace: boolean; vender_cupom_fiscal: boolean;
  origem_mercadoria: string; tipo_produto: string; preco_tabelado_pauta: string;
  numero_fci: string; cest: string; indicador_producao_escala: string;
  unidade_tributavel: string; quantidade_tributavel: string; fator_conversao: string;
  codigo_ean_tributavel: string; cfop: string; cst_icms: string; csosn: string;
  cst_pis: string; cst_cofins: string; p_icms: string; p_pis: string; p_cofins: string;
  ativo: boolean;
  ncm_descricao: string;
  cest_descricao: string;
  fornecedoresVinculados: FornecedorVinculado[];
};

const defaultForm = (): ProdutoForm => ({
  descricao: '', codigo_ean: '', unidade: 'PC', preco_venda: '', ncm: '',
  familia_produto: '', tipo_simples: true,
  peso_liquido: '0,000', peso_bruto: '0,000', altura: '0,000', largura: '0,000',
  profundidade: '0,000', dias_crossdocking: '0', lead_time_ressuprimento: '0',
  marca: '', modelo: '', dias_garantia: '0', vender_marketplace: false, vender_cupom_fiscal: false,
  origem_mercadoria: '', tipo_produto: '00', preco_tabelado_pauta: '', numero_fci: '',
  cest: '', indicador_producao_escala: '', unidade_tributavel: '',
  quantidade_tributavel: '0,00000000000000', fator_conversao: '0,0000000000',
  codigo_ean_tributavel: '', cfop: '', cst_icms: '', csosn: '', cst_pis: '', cst_cofins: '',
  p_icms: '', p_pis: '', p_cofins: '', ativo: true,
  ncm_descricao: '', cest_descricao: '', fornecedoresVinculados: [],
});

const PAGE_SIZE = 10;

const fmtPreco = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(v);

function parseMoeda(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatMoeda(v: string): string {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ColHeader({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={`py-2 px-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap ${className}`}>
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <button className="opacity-50 hover:opacity-100"><ChevronsUpDown className="w-3 h-3" /></button>
        <button className="opacity-50 hover:opacity-100"><Filter className="w-3 h-3" /></button>
      </div>
      <div className="h-px bg-muted mt-1" />
      <button className="mt-0.5 opacity-30 hover:opacity-60"><Filter className="w-3 h-3" /></button>
    </th>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute -top-2 left-2 text-xs text-muted-foreground bg-background px-1 z-10">{label}</span>
      {children}
    </div>
  );
}

function UnidadeCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const topFiltered = UNIDADES_TOP.filter(u => u.label.toLowerCase().includes(search.toLowerCase()) || u.value.toLowerCase().includes(search.toLowerCase()));
  const todasFiltered = UNIDADES_TODAS.filter(u =>
    (u.label.toLowerCase().includes(search.toLowerCase()) || u.value.toLowerCase().includes(search.toLowerCase())) &&
    !UNIDADES_TOP.find(t => t.value === u.value)
  );

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Input
          value={search}
          onFocus={() => setOpen(true)}
          onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }}
          className="pt-1 pr-7"
          placeholder="PC"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setSearch(''); onChange(''); setOpen(true); }}>
          {search ? <X className="w-3 h-3" /> : <ChevronsUpDown className="w-3 h-3" />}
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto text-sm">
          {topFiltered.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mais Utilizadas</div>
              {topFiltered.map(u => (
                <button key={u.value} className={`w-full text-left px-3 py-1.5 hover:bg-muted/60 transition-colors ${value === u.value ? 'bg-primary/10 text-primary font-medium' : ''}`}
                  onClick={() => { onChange(u.value); setSearch(u.value); setOpen(false); }}>
                  {u.label}
                </button>
              ))}
              {todasFiltered.length > 0 && <div className="border-t mx-2 my-1" />}
            </>
          )}
          {todasFiltered.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Todas as Unidades</div>
              {todasFiltered.map(u => (
                <button key={u.value} className={`w-full text-left px-3 py-1.5 hover:bg-muted/60 transition-colors ${value === u.value ? 'bg-primary/10 text-primary font-medium' : ''}`}
                  onClick={() => { onChange(u.value); setSearch(u.value); setOpen(false); }}>
                  {u.label}
                </button>
              ))}
            </>
          )}
          {topFiltered.length === 0 && todasFiltered.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhuma unidade encontrada</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ProdutosOmie() {
  const { empresaAtiva } = useEmpresa();
  const { data: todasPessoas = [] } = usePessoas();
  const fornecedoresDisp = todasPessoas.filter(p => p.tipo === 'fornecedor' || p.tipo === 'ambos');

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigoNovo, setCodigoNovo] = useState('');
  const [form, setForm] = useState<ProdutoForm>(defaultForm());

  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(true);

  // Dialog states
  const [vincularOpen, setVincularOpen] = useState(false);
  const [novoFornOpen, setNovoFornOpen] = useState(false);
  const [fornBusca, setFornBusca] = useState('');
  const [ncmOpen, setNcmOpen] = useState(false);
  const [cestOpen, setCestOpen] = useState(false);

  useEffect(() => {
    if (!empresaAtiva) { setLoading(false); return; }
    loadProdutos();
  }, [empresaAtiva]);

  async function loadProdutos() {
    setLoading(true);
    const { data, error } = await supabase.from('produtos').select('*').eq('empresa_id', empresaAtiva!.id).order('descricao');
    if (error) toast.error('Erro ao carregar produtos');
    else setProdutos(data ?? []);
    setLoading(false);
  }

  async function generateNextCodigo(): Promise<string> {
    if (!empresaAtiva) return 'PRD00001';
    const { data } = await supabase.from('produtos').select('codigo').eq('empresa_id', empresaAtiva.id).like('codigo', 'PRD%').order('codigo', { ascending: false }).limit(1);
    const last = data?.[0]?.codigo as string | undefined;
    if (!last) return 'PRD00001';
    const num = parseInt(last.replace('PRD', ''), 10);
    return isNaN(num) ? 'PRD00001' : `PRD${String(num + 1).padStart(5, '0')}`;
  }

  async function handleSave() {
    if (!form.descricao.trim()) { toast.error('Descrição é obrigatória'); return; }
    setSaving(true);

    const numOr0 = (v: string) => parseMoeda(v) || 0;
    const intOr0 = (v: string) => parseInt(v, 10) || 0;

    const payload: Record<string, unknown> = {
      empresa_id: empresaAtiva!.id,
      descricao: form.descricao,
      unidade: form.unidade || 'PC',
      categoria: form.familia_produto || null,
      preco_venda: numOr0(form.preco_venda),
      codigo_ean: form.codigo_ean || null,
      ncm: form.ncm || null,
      cfop: form.cfop || null,
      cst_icms: form.cst_icms || null,
      csosn: form.csosn || null,
      cst_pis: form.cst_pis || null,
      cst_cofins: form.cst_cofins || null,
      p_icms: form.p_icms ? parseFloat(form.p_icms) : null,
      p_pis: form.p_pis ? parseFloat(form.p_pis) : null,
      p_cofins: form.p_cofins ? parseFloat(form.p_cofins) : null,
      cest: form.cest || null,
      tipo_produto: form.tipo_produto || '00',
      origem_mercadoria: form.origem_mercadoria || null,
      numero_fci: form.numero_fci || null,
      peso_liquido: numOr0(form.peso_liquido),
      peso_bruto: numOr0(form.peso_bruto),
      altura: numOr0(form.altura),
      largura: numOr0(form.largura),
      profundidade: numOr0(form.profundidade),
      dias_crossdocking: intOr0(form.dias_crossdocking),
      lead_time_ressuprimento: intOr0(form.lead_time_ressuprimento),
      marca: form.marca || null,
      modelo: form.modelo || null,
      dias_garantia: intOr0(form.dias_garantia),
      unidade_tributavel: form.unidade_tributavel || null,
      quantidade_tributavel: numOr0(form.quantidade_tributavel),
      fator_conversao: numOr0(form.fator_conversao),
      codigo_ean_tributavel: form.codigo_ean_tributavel || null,
      indicador_producao_escala: form.indicador_producao_escala || null,
      ativo: form.ativo,
    };

    let produtoId = editingId;
    let error: unknown;

    if (editingId) {
      ({ error } = await supabase.from('produtos').update(payload as never).eq('id', editingId));
    } else {
      const res = await supabase.from('produtos').insert({ ...payload, codigo: codigoNovo, saldo_atual: 0, saldo_minimo: 0 } as never).select('id').single();
      error = res.error;
      if (!error) produtoId = (res.data as { id: string }).id;
    }

    if (error) { setSaving(false); toast.error('Erro ao salvar produto'); return; }

    // Sincroniza fornecedores vinculados
    if (produtoId) {
      await supabase.from('produto_fornecedores').delete().eq('produto_id', produtoId);
      if (form.fornecedoresVinculados.length > 0) {
        await supabase.from('produto_fornecedores').insert(
          form.fornecedoresVinculados.map(f => ({
            empresa_id: empresaAtiva!.id,
            produto_id: produtoId,
            pessoa_id: f.id,
          }))
        );
      }
    }

    setSaving(false);
    toast.success(editingId ? 'Produto atualizado' : 'Produto cadastrado');
    await loadProdutos();
    closeForm();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Produto excluído');
    if (selected === id) setSelected(null);
    await loadProdutos();
  }

  async function handleInativar(id: string) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    const { error } = await supabase.from('produtos').update({ ativo: !p.ativo } as never).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success(p.ativo ? 'Produto inativado' : 'Produto reativado');
    await loadProdutos();
  }

  async function openEdit(p: Produto) {
    setEditingId(p.id);
    const fmtNum = (v: number | null) =>
      v != null && v > 0
        ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
        : '';
    const fmtDec = (v: number | null) =>
      v != null ? String(v).replace('.', ',') : '0,000';

    const ncmCode = p.ncm ?? '';
    const ncmDescricao = NCM_CODES.find(n => n.codigo === ncmCode)?.descricao ?? '';

    // Carrega fornecedores vinculados do banco
    const { data: pfData } = await supabase
      .from('produto_fornecedores')
      .select('pessoa_id, financeiro_pessoas(id, nome, documento)')
      .eq('produto_id', p.id);

    const fornVinc: FornecedorVinculado[] = ((pfData ?? []) as any[]).map((r: any) => ({
      id: r.financeiro_pessoas?.id ?? r.pessoa_id,
      nome: r.financeiro_pessoas?.nome ?? '',
      documento: r.financeiro_pessoas?.documento ?? null,
    }));

    setForm({
      ...defaultForm(),
      descricao: p.descricao,
      codigo_ean: p.codigo_ean ?? '',
      unidade: p.unidade,
      preco_venda: fmtNum(p.preco_venda),
      ncm: ncmCode, ncm_descricao: ncmDescricao,
      familia_produto: p.categoria ?? '',
      cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '',
      cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '',
      p_icms: p.p_icms != null ? String(p.p_icms) : '',
      p_pis: p.p_pis != null ? String(p.p_pis) : '',
      p_cofins: p.p_cofins != null ? String(p.p_cofins) : '',
      cest: p.cest ?? '', cest_descricao: '',
      tipo_produto: p.tipo_produto ?? '00',
      origem_mercadoria: p.origem_mercadoria ?? '',
      numero_fci: p.numero_fci ?? '',
      peso_liquido: fmtDec(p.peso_liquido),
      peso_bruto: fmtDec(p.peso_bruto),
      altura: fmtDec(p.altura),
      largura: fmtDec(p.largura),
      profundidade: fmtDec(p.profundidade),
      dias_crossdocking: String(p.dias_crossdocking ?? 0),
      lead_time_ressuprimento: String(p.lead_time_ressuprimento ?? 0),
      marca: p.marca ?? '',
      modelo: p.modelo ?? '',
      dias_garantia: String(p.dias_garantia ?? 0),
      unidade_tributavel: p.unidade_tributavel ?? '',
      quantidade_tributavel: fmtDec(p.quantidade_tributavel),
      fator_conversao: fmtDec(p.fator_conversao),
      codigo_ean_tributavel: p.codigo_ean_tributavel ?? '',
      indicador_producao_escala: p.indicador_producao_escala ?? '',
      ativo: p.ativo,
      fornecedoresVinculados: fornVinc,
    });
    setView('form');
  }

  async function openNovo() {
    setEditingId(null);
    const codigo = await generateNextCodigo();
    setCodigoNovo(codigo);
    setForm(defaultForm());
    setView('form');
  }

  async function openDuplicate(p: Produto) {
    setEditingId(null);
    const codigo = await generateNextCodigo();
    setCodigoNovo(codigo);

    const fmtNum = (v: number | null) =>
      v != null && v > 0
        ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
        : '';
    const fmtDec = (v: number | null) =>
      v != null ? String(v).replace('.', ',') : '0,000';

    const ncmCode = p.ncm ?? '';
    const ncmDescricao = NCM_CODES.find(n => n.codigo === ncmCode)?.descricao ?? '';

    const { data: pfData } = await supabase
      .from('produto_fornecedores')
      .select('pessoa_id, financeiro_pessoas(id, nome, documento)')
      .eq('produto_id', p.id);

    const fornVinc: FornecedorVinculado[] = ((pfData ?? []) as any[]).map((r: any) => ({
      id: r.financeiro_pessoas?.id ?? r.pessoa_id,
      nome: r.financeiro_pessoas?.nome ?? '',
      documento: r.financeiro_pessoas?.documento ?? null,
    }));

    setForm({
      ...defaultForm(),
      descricao: `${p.descricao} (cópia)`,
      codigo_ean: p.codigo_ean ?? '',
      unidade: p.unidade,
      preco_venda: fmtNum(p.preco_venda),
      ncm: ncmCode, ncm_descricao: ncmDescricao,
      familia_produto: p.categoria ?? '',
      cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '',
      cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '',
      p_icms: p.p_icms != null ? String(p.p_icms) : '',
      p_pis: p.p_pis != null ? String(p.p_pis) : '',
      p_cofins: p.p_cofins != null ? String(p.p_cofins) : '',
      cest: p.cest ?? '', cest_descricao: '',
      tipo_produto: p.tipo_produto ?? '00',
      origem_mercadoria: p.origem_mercadoria ?? '',
      numero_fci: p.numero_fci ?? '',
      peso_liquido: fmtDec(p.peso_liquido),
      peso_bruto: fmtDec(p.peso_bruto),
      altura: fmtDec(p.altura),
      largura: fmtDec(p.largura),
      profundidade: fmtDec(p.profundidade),
      dias_crossdocking: String(p.dias_crossdocking ?? 0),
      lead_time_ressuprimento: String(p.lead_time_ressuprimento ?? 0),
      marca: p.marca ?? '',
      modelo: p.modelo ?? '',
      dias_garantia: String(p.dias_garantia ?? 0),
      unidade_tributavel: p.unidade_tributavel ?? '',
      quantidade_tributavel: fmtDec(p.quantidade_tributavel),
      fator_conversao: fmtDec(p.fator_conversao),
      codigo_ean_tributavel: p.codigo_ean_tributavel ?? '',
      indicador_producao_escala: p.indicador_producao_escala ?? '',
      ativo: true,
      fornecedoresVinculados: fornVinc,
    });
    setView('form');
  }

  function closeForm() {
    setView('list'); setEditingId(null); setCodigoNovo(''); setForm(defaultForm());
  }

  const filtered = produtos.filter(p =>
    p.descricao.toLowerCase().includes(search.toLowerCase()) ||
    (p.codigo ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.ncm ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const selectedProduto = produtos.find(p => p.id === selected) ?? null;
  const allChecked = pageItems.length > 0 && pageItems.every(p => checked.has(p.id));
  function toggleAll() {
    if (allChecked) setChecked(prev => { const n = new Set(prev); pageItems.forEach(p => n.delete(p.id)); return n; });
    else setChecked(prev => { const n = new Set(prev); pageItems.forEach(p => n.add(p.id)); return n; });
  }

  const fornFiltrados = fornecedoresDisp.filter(f =>
    !fornBusca || f.nome.toLowerCase().includes(fornBusca.toLowerCase()) || (f.documento ?? '').includes(fornBusca)
  ).filter(f => !form.fornecedoresVinculados.find(v => v.id === f.id));

  function vincularFornecedor(f: { id: string; nome: string; documento: string | null }) {
    setForm(prev => ({ ...prev, fornecedoresVinculados: [...prev.fornecedoresVinculados, { id: f.id, nome: f.nome, documento: f.documento }] }));
    setVincularOpen(false);
    setFornBusca('');
  }

  function desvincularFornecedor(id: string) {
    setForm(prev => ({ ...prev, fornecedoresVinculados: prev.fornecedoresVinculados.filter(v => v.id !== id) }));
  }

  // ══ FORM VIEW ══════════════════════════════════════════════════
  if (view === 'form') {
    const codigoDisplay = editingId ? (produtos.find(p => p.id === editingId)?.codigo ?? '—') : codigoNovo;

    return (
      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <span className="font-semibold text-sm">{editingId ? 'Editar Produto' : 'Incluir Produto'}</span>
          <button onClick={closeForm} className="text-muted-foreground hover:text-foreground text-sm font-medium">Fechar ✕</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {/* Top: image + fields + definição */}
          <div className="flex gap-4">
            {/* Image */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-24 h-24 rounded bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs text-center p-1 leading-tight">
                {codigoDisplay || 'Novo'}
              </div>
              <button className="flex items-center gap-1 text-xs text-accent hover:text-accent/80">
                <Pencil className="w-3 h-3" /> Alterar
              </button>
              <span className="text-xs text-muted-foreground">1 imagem</span>
            </div>

            {/* Main fields */}
            <div className="flex-1 space-y-3">
              <Field label="Descrição do Produto">
                <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="pt-1" />
              </Field>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Código do Produto">
                  <Input value={codigoDisplay} readOnly className="pt-1 bg-muted/30 text-muted-foreground" />
                </Field>
                <Field label="Código EAN (GTIN)">
                  <div className="relative">
                    <Input value={form.codigo_ean} onChange={e => setForm(f => ({ ...f, codigo_ean: e.target.value }))} className="pt-1 pr-8" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">🌐</span>
                  </div>
                </Field>
                <Field label="Unidade">
                  <UnidadeCombobox value={form.unidade} onChange={v => setForm(f => ({ ...f, unidade: v }))} />
                </Field>
                <Field label="Preço Unitário de Venda">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs select-none">R$</span>
                    <Input
                      value={form.preco_venda}
                      onChange={e => {
                        const fmt = formatMoeda(e.target.value);
                        setForm(f => ({ ...f, preco_venda: fmt }));
                      }}
                      className="pt-1 pl-8 text-right"
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Código NCM">
                  <div className="relative cursor-pointer" onClick={() => setNcmOpen(true)}>
                    <Input
                      value={form.ncm ? `${form.ncm}${form.ncm_descricao ? ' ' + form.ncm_descricao : ''}` : ''}
                      readOnly
                      className="pt-1 pl-7 cursor-pointer truncate"
                      placeholder="Selecionar NCM..."
                    />
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Field>
                <Field label="Família de Produto">
                  <div className="relative">
                    <Input value={form.familia_produto} onChange={e => setForm(f => ({ ...f, familia_produto: e.target.value }))} className="pt-1 pr-7" placeholder="Opcional" />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-accent"><Pencil className="w-3 h-3" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Opcional (mas importante para os seus relatórios de estoque e de faturamento)</p>
                </Field>
              </div>
            </div>

            {/* Definição do Produto */}
            <div className="shrink-0 w-44 border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold">Definição do Produto</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1">Simples <span className="text-muted-foreground cursor-help" title="Produto simples, sem variações">ⓘ</span></Label>
                <Switch checked={form.tipo_simples} onCheckedChange={v => setForm(f => ({ ...f, tipo_simples: v }))} />
              </div>
              <div className="flex items-center justify-between opacity-50">
                <Label className="text-sm flex items-center gap-1 cursor-not-allowed">Kit <span className="text-muted-foreground cursor-help" title="Em breve">ⓘ</span></Label>
                <Switch checked={false} disabled />
              </div>
              <div className="flex items-center justify-between opacity-50">
                <Label className="text-sm flex items-center gap-1 cursor-not-allowed">Com Variações <span className="text-muted-foreground cursor-help" title="Em breve">ⓘ</span></Label>
                <Switch checked={false} disabled />
              </div>
            </div>
          </div>

          {/* Tabs — sem "Custo do Estoque" */}
          <Tabs defaultValue="estoque" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted/30 p-1">
              {[
                { value: 'estoque', label: 'Estoque' },
                { value: 'fornecedores', label: 'Fornecedores' },
                { value: 'historico', label: 'Histórico de Compras' },
                { value: 'info', label: 'Informações Adicionais' },
                { value: 'caracteristicas', label: 'Características' },
                { value: 'fiscal', label: 'Recomendações Fiscais' },
                { value: 'observacoes', label: 'Observações' },
              ].map(t => <TabsTrigger key={t.value} value={t.value} className="text-xs px-3 py-1.5">{t.label}</TabsTrigger>)}
            </TabsList>

            {/* Estoque */}
            <TabsContent value="estoque" className="border rounded-lg p-4 mt-2 space-y-3">
              <div>
                <h3 className="text-sm font-semibold mb-1">Estoque Mínimo</h3>
                <p className="text-xs text-muted-foreground">Clique diretamente em qualquer célula desta coluna para atualizar o estoque mínimo de cada local de estoque</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="ctrl-lote" />
                <Label htmlFor="ctrl-lote" className="text-sm flex items-center gap-1">Este produto possui controle de lote <span className="text-muted-foreground cursor-help">ⓘ</span></Label>
              </div>
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Local de Estoque','Estoque Disponível','CMC Unitário','CMC Total','Estoque Mínimo','Previsão de Entrada','Previsão de Saída'].map(col => (
                        <th key={col} className="py-2 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">{col}<ChevronsUpDown className="w-3 h-3 opacity-40" /><Filter className="w-3 h-3 opacity-40" /></div>
                          <div className="h-px bg-border mt-1" /><Filter className="w-3 h-3 opacity-20 mt-0.5" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-muted/30 border-t">
                      <td className="py-2 px-3 font-medium">PADRAO - Local de Estoque Padrão</td>
                      <td className="py-2 px-3 text-center">0 {form.unidade}</td>
                      <td className="py-2 px-3 text-center">0,00</td>
                      <td className="py-2 px-3 text-center">0,00</td>
                      <td className="py-2 px-3 text-center"><Input className="h-6 w-16 text-xs text-center p-1" defaultValue="0" /></td>
                      <td className="py-2 px-3 text-center">0.000000 {form.unidade}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Fornecedores */}
            <TabsContent value="fornecedores" className="border rounded-lg p-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Fornecedores vinculados</p>
                <Button size="sm" variant="outline" className="text-accent border-accent/30 hover:bg-accent/10 hover:text-accent" onClick={() => { setFornBusca(''); setVincularOpen(true); }}>
                  <Link className="w-3.5 h-3.5 mr-1.5" /> Vincular Fornecedor
                </Button>
              </div>
              {form.fornecedoresVinculados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Package className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Nenhum fornecedor vinculado a este produto.</p>
                  <Button size="sm" variant="ghost" className="text-accent" onClick={() => { setFornBusca(''); setVincularOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar fornecedor
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.fornecedoresVinculados.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{f.nome}</p>
                        {f.documento && <p className="text-xs text-muted-foreground">{f.documento}</p>}
                      </div>
                      <button onClick={() => desvincularFornecedor(f.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Histórico */}
            <TabsContent value="historico" className="border rounded-lg p-4 mt-2">
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <History className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhum histórico de compras disponível.</p>
              </div>
            </TabsContent>

            {/* Informações Adicionais */}
            <TabsContent value="info" className="border rounded-lg p-4 mt-2 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Peso Líquido (Kg)"><Input value={form.peso_liquido} onChange={e => setForm(f => ({ ...f, peso_liquido: e.target.value }))} className="pt-1" /></Field>
                <Field label="Peso Bruto (Kg)"><Input value={form.peso_bruto} onChange={e => setForm(f => ({ ...f, peso_bruto: e.target.value }))} className="pt-1" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Altura (cm)"><Input value={form.altura} onChange={e => setForm(f => ({ ...f, altura: e.target.value }))} className="pt-1" /></Field>
                <Field label="Largura (cm)"><Input value={form.largura} onChange={e => setForm(f => ({ ...f, largura: e.target.value }))} className="pt-1" /></Field>
                <Field label="Profundidade (cm)"><Input value={form.profundidade} onChange={e => setForm(f => ({ ...f, profundidade: e.target.value }))} className="pt-1" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Dias de Crossdocking"><Input value={form.dias_crossdocking} onChange={e => setForm(f => ({ ...f, dias_crossdocking: e.target.value }))} className="pt-1" /></Field>
                <Field label="Lead Time de Ressuprimento"><Input value={form.lead_time_ressuprimento} onChange={e => setForm(f => ({ ...f, lead_time_ressuprimento: e.target.value }))} className="pt-1" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Marca"><Input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} className="pt-1" placeholder="Opcional" /></Field>
                <Field label="Modelo"><Input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} className="pt-1" placeholder="Opcional" /></Field>
                <Field label="Dias de Garantia"><Input value={form.dias_garantia} onChange={e => setForm(f => ({ ...f, dias_garantia: e.target.value }))} className="pt-1" /></Field>
              </div>
            </TabsContent>

            {/* Características */}
            <TabsContent value="caracteristicas" className="border rounded-lg p-4 mt-2">
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <ClipboardList className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhuma característica cadastrada.</p>
              </div>
            </TabsContent>

            {/* Recomendações Fiscais */}
            <TabsContent value="fiscal" className="border rounded-lg p-4 mt-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Origem da Mercadoria">
                  <Select value={form.origem_mercadoria} onValueChange={v => setForm(f => ({ ...f, origem_mercadoria: v }))}>
                    <SelectTrigger className="pt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Nacional</SelectItem>
                      <SelectItem value="1">1 — Estrangeira (importação direta)</SelectItem>
                      <SelectItem value="2">2 — Estrangeira (mercado interno)</SelectItem>
                      <SelectItem value="3">3 — Nacional +40% estrangeiro</SelectItem>
                      <SelectItem value="4">4 — Nacional produção básica</SelectItem>
                      <SelectItem value="5">5 — Nacional até 40% estrangeiro</SelectItem>
                      <SelectItem value="6">6 — Estrangeira direta sem similar</SelectItem>
                      <SelectItem value="7">7 — Estrangeira interna sem similar</SelectItem>
                      <SelectItem value="8">8 — Nacional +70% importação</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipo do Produto">
                  <Select value={form.tipo_produto} onValueChange={v => setForm(f => ({ ...f, tipo_produto: v }))}>
                    <SelectTrigger className="pt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="00">00 — Mercadoria para Revenda</SelectItem>
                      <SelectItem value="01">01 — Matéria-Prima</SelectItem>
                      <SelectItem value="02">02 — Embalagem</SelectItem>
                      <SelectItem value="03">03 — Produto em Processo</SelectItem>
                      <SelectItem value="04">04 — Produto Acabado</SelectItem>
                      <SelectItem value="05">05 — Subproduto</SelectItem>
                      <SelectItem value="06">06 — Produto Intermediário</SelectItem>
                      <SelectItem value="07">07 — Material de Uso e Consumo</SelectItem>
                      <SelectItem value="08">08 — Ativo Imobilizado</SelectItem>
                      <SelectItem value="09">09 — Serviços</SelectItem>
                      <SelectItem value="10">10 — Outros insumos</SelectItem>
                      <SelectItem value="99">99 — Outras</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="CEST (Subst. Tributária)">
                  <div className="relative cursor-pointer" onClick={() => setCestOpen(true)}>
                    <Input
                      value={form.cest ? `${form.cest}${form.cest_descricao ? ' ' + form.cest_descricao : ''}` : ''}
                      readOnly
                      className="pt-1 pl-7 cursor-pointer truncate"
                      placeholder="Selecionar CEST..."
                    />
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Field>
                <Field label="Número da FCI">
                  <Input value={form.numero_fci} onChange={e => setForm(f => ({ ...f, numero_fci: e.target.value }))} className="pt-1" placeholder="Opcional" />
                </Field>
              </div>
              <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="CST ICMS"><Input value={form.cst_icms} onChange={e => setForm(f => ({ ...f, cst_icms: e.target.value }))} className="pt-1" placeholder="00" /></Field>
                <Field label="CSOSN"><Input value={form.csosn} onChange={e => setForm(f => ({ ...f, csosn: e.target.value }))} className="pt-1" placeholder="102" /></Field>
                <Field label="CST PIS"><Input value={form.cst_pis} onChange={e => setForm(f => ({ ...f, cst_pis: e.target.value }))} className="pt-1" placeholder="07" /></Field>
                <Field label="CST COFINS"><Input value={form.cst_cofins} onChange={e => setForm(f => ({ ...f, cst_cofins: e.target.value }))} className="pt-1" placeholder="07" /></Field>
                <Field label="CFOP"><Input value={form.cfop} onChange={e => setForm(f => ({ ...f, cfop: e.target.value }))} className="pt-1" placeholder="0000" /></Field>
                <Field label="Alíq. ICMS %"><Input value={form.p_icms} onChange={e => setForm(f => ({ ...f, p_icms: e.target.value }))} className="pt-1" placeholder="0" /></Field>
                <Field label="Alíq. PIS %"><Input value={form.p_pis} onChange={e => setForm(f => ({ ...f, p_pis: e.target.value }))} className="pt-1" placeholder="0" /></Field>
                <Field label="Alíq. COFINS %"><Input value={form.p_cofins} onChange={e => setForm(f => ({ ...f, p_cofins: e.target.value }))} className="pt-1" placeholder="0" /></Field>
              </div>
            </TabsContent>

            {/* Observações */}
            <TabsContent value="observacoes" className="border rounded-lg p-4 mt-2">
              <textarea className="w-full h-32 text-sm bg-background border rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Observações sobre este produto..." />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
            </Button>
          </div>
        </div>

        {/* Modal: Vincular Fornecedor */}
        <Dialog open={vincularOpen} onOpenChange={o => { setVincularOpen(o); if (!o) setFornBusca(''); }}>
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Vincular Fornecedor</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar fornecedor..." value={fornBusca} onChange={e => setFornBusca(e.target.value)} className="pl-9" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {fornFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {fornecedoresDisp.length === 0 ? 'Nenhum fornecedor cadastrado.' : 'Nenhum resultado encontrado.'}
                </p>
              ) : (
                fornFiltrados.map(f => (
                  <button key={f.id} onClick={() => vincularFornecedor(f)} className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <p className="text-sm font-medium">{f.nome}</p>
                    {f.documento && <p className="text-xs text-muted-foreground">{f.documento}</p>}
                    {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                  </button>
                ))
              )}
            </div>
            <div className="border-t pt-3">
              <Button variant="outline" className="w-full" onClick={() => { setVincularOpen(false); setNovoFornOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar novo fornecedor
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Novo Fornecedor */}
        <PessoaFormDialog
          open={novoFornOpen}
          onOpenChange={setNovoFornOpen}
          editing={null}
          defaultTipo="fornecedor"
          onSuccess={() => { setNovoFornOpen(false); setVincularOpen(true); }}
        />

        {/* Dialog: NCM */}
        <NcmDialog
          open={ncmOpen}
          onOpenChange={setNcmOpen}
          onSelect={(codigo, descricao) => setForm(f => ({ ...f, ncm: codigo, ncm_descricao: descricao }))}
        />

        {/* Dialog: CEST */}
        <CestDialog
          open={cestOpen}
          onOpenChange={setCestOpen}
          ncmAtual={form.ncm}
          onSelect={(codigo, descricao) => setForm(f => ({ ...f, cest: codigo, cest_descricao: descricao }))}
        />
      </div>
    );
  }

  // ══ LIST VIEW ══════════════════════════════════════════════════
  return (
    <div className="border rounded-lg overflow-hidden bg-background flex flex-col" style={{ minHeight: '500px' }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
        <Button size="sm" variant="ghost" className="text-accent hover:text-accent hover:bg-accent/10 gap-1 text-sm font-medium" onClick={openNovo}>
          <Plus className="w-4 h-4" /> Incluir
        </Button>
        <Button size="sm" variant="ghost" className="text-accent hover:text-accent hover:bg-accent/10 gap-1 text-sm font-medium">
          <Upload className="w-4 h-4" /> Importar Planilha
        </Button>
        <div className="ml-auto">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-7 h-7 text-xs w-52" />
          </div>
        </div>
      </div>

      <div className="bg-muted/40 border-b px-4 py-1.5 text-center text-xs text-muted-foreground">
        Arraste uma ou mais colunas aqui para agrupar
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Nenhum produto encontrado</p>
              <Button size="sm" onClick={openNovo}><Plus className="w-4 h-4 mr-1" /> Incluir primeiro produto</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background z-10 border-b">
                <tr>
                  <th className="w-8 py-2 px-2"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>
                  <ColHeader label="Situação" className="w-28" />
                  <ColHeader label="Descrição" />
                  <ColHeader label="Código" className="w-28" />
                  <ColHeader label="Família de Produto" className="w-36" />
                  <ColHeader label="Código NCM" className="w-28" />
                  <ColHeader label="CEST" className="w-24" />
                  <ColHeader label="Código EAN (GTIN)" className="w-36" />
                  <ColHeader label="Preço Unitário de Venda" className="w-40" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map(p => {
                  const isSel = selected === p.id;
                  return (
                    <tr key={p.id} className={`cursor-pointer transition-colors ${isSel ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-muted/30'}`} onClick={() => setSelected(isSel ? null : p.id)} onDoubleClick={() => openEdit(p)}>
                      <td className="py-2 px-2" onClick={e => e.stopPropagation()}><Checkbox checked={checked.has(p.id)} onCheckedChange={v => setChecked(prev => { const n = new Set(prev); v ? n.add(p.id) : n.delete(p.id); return n; })} /></td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${p.ativo ? 'bg-success' : 'bg-muted-foreground'}`} />
                          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${p.ativo ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-medium">{p.descricao}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{p.codigo ?? '—'}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground italic">{p.categoria ?? <span className="opacity-40">{'<não informado>'}</span>}</td>
                      <td className="py-2 px-2 text-xs text-foreground font-medium">{p.ncm ?? '—'}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{p.cest ?? <span className="opacity-40">—</span>}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{p.codigo_ean ?? <span className="opacity-40">—</span>}</td>
                      <td className="py-2 px-2 text-xs text-right">{p.preco_venda != null && p.preco_venda > 0 ? `R$ ${fmtPreco(p.preco_venda)}` : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <button className="w-6 bg-muted/30 border-l flex items-center justify-center hover:bg-muted/60 shrink-0" onClick={() => setPanelOpen(o => !o)}>
          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${panelOpen ? '' : 'rotate-180'}`} />
        </button>

        {panelOpen && (
          <div className="w-56 border-l bg-background shrink-0 overflow-y-auto">
            {selectedProduto ? (
              <div className="p-3 space-y-1">
                <p className="font-semibold text-sm leading-snug">{selectedProduto.descricao}</p>
                <p className="text-xs text-muted-foreground mb-3">{selectedProduto.codigo ?? '—'}</p>
                {[
                  { icon: Pencil, label: 'Editar', action: () => openEdit(selectedProduto), disabled: false },
                  { icon: Copy, label: 'Duplicar', action: () => openDuplicate(selectedProduto), disabled: false },
                  { icon: UserMinus, label: selectedProduto.ativo ? 'Inativar' : 'Reativar', action: () => handleInativar(selectedProduto.id), disabled: false },
                  { icon: Paperclip, label: 'Anexos', action: () => {}, disabled: true },
                  { icon: History, label: 'Histórico de Alterações', action: () => {}, disabled: true },
                  { icon: ClipboardList, label: 'Tarefas', action: () => {}, disabled: true },
                ].map(({ icon: Icon, label, action, disabled }) => (
                  <button key={label} onClick={action} disabled={disabled} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted/50'}`}>
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" /><span>{label}</span>
                  </button>
                ))}
                <div className="border-t pt-1">
                  <button onClick={() => handleDelete(selectedProduto.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-destructive/10 transition-colors text-destructive">
                    <Trash2 className="w-4 h-4 shrink-0" /><span>Excluir</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px]">
                <p className="text-xs text-muted-foreground text-center px-4">Clique em um produto para ver as ações disponíveis</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
        <span>{filtered.length === 0 ? 'Nenhum registro' : `${(curPage - 1) * PAGE_SIZE + 1} - ${Math.min(curPage * PAGE_SIZE, filtered.length)} de ${filtered.length} registros`}</span>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-4 h-4" /></button>
          <button className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-2 py-0.5 rounded bg-accent text-accent-foreground text-xs font-medium">{curPage}</span>
          <button className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight className="w-4 h-4" /></button>
          <button className="p-1 hover:text-foreground disabled:opacity-30" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
