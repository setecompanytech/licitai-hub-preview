import { useState, useEffect, useRef } from 'react';
import { UNIDADES, unidadesMaisUsadas } from '@/lib/unidades';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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
  Upload, Package, Building2, Search, Filter, ChevronsUpDown, Link, X,
} from 'lucide-react';

// ── Unidades ───────────────────────────────────────────────────────────────
// Mesma autoridade das outras telas — ver src/lib/unidades.ts.
const UNIDADES_TOP = unidadesMaisUsadas().map(u => ({ value: u.codigo, label: `${u.nome} (${u.codigo})` }));
const UNIDADES_TODAS = UNIDADES.map(u => ({ value: u.codigo, label: `${u.nome} (${u.codigo})` }));

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
// Os ícones de ordenar/filtrar do cabeçalho eram <button> sem handler — parada
// de foco que não fazia nada. Ficam decorativos (aria-hidden) até ganharem função.
function ColHeader({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={cn('py-2 px-2 text-left text-sm font-semibold text-muted-foreground whitespace-nowrap', className)}>
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <ChevronsUpDown className="w-3 h-3 opacity-50" aria-hidden="true" />
        <Filter className="w-3 h-3 opacity-50" aria-hidden="true" />
      </div>
    </th>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <span className="absolute -top-2 left-2 text-xs text-muted-foreground bg-card px-1 z-10">{label}</span>
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
    // Fechar sem escolher devolve a unidade selecionada ao campo.
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(value); }
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, value]);

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
          aria-label="Unidade"
          // Abrir a lista limpa a BUSCA, não a seleção: com "PC" no campo, o
          // filtro deixava só "Peça (PC)" e "Pacote (PCT)" à vista.
          onFocus={() => { setOpen(true); setSearch(''); }}
          onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }}
          className="pt-1 pr-9"
          placeholder="PC"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
          aria-label={search ? 'Limpar unidade' : 'Abrir lista de unidades'}
          onClick={() => { setSearch(''); onChange(''); setOpen(true); }}
        >
          {search ? <X className="w-4 h-4" aria-hidden="true" /> : <ChevronsUpDown className="w-4 h-4" aria-hidden="true" />}
        </Button>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 rounded-md border border-border bg-popover shadow-md max-h-60 overflow-y-auto text-sm">
          {topFiltered.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mais Utilizadas</div>
              {topFiltered.map(u => (
                <Button
                  key={u.value}
                  type="button"
                  variant="ghost"
                  className={cn('h-auto w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal', value === u.value && 'bg-primary-tint text-primary font-medium hover:bg-primary-tint hover:text-primary')}
                  onClick={() => { onChange(u.value); setSearch(u.value); setOpen(false); }}
                >
                  {u.label}
                </Button>
              ))}
              {todasFiltered.length > 0 && <div className="border-t border-border mx-2 my-1" />}
            </>
          )}
          {todasFiltered.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Todas as Unidades</div>
              {todasFiltered.map(u => (
                <Button
                  key={u.value}
                  type="button"
                  variant="ghost"
                  className={cn('h-auto w-full justify-start rounded-none px-3 py-1.5 text-sm font-normal', value === u.value && 'bg-primary-tint text-primary font-medium hover:bg-primary-tint hover:text-primary')}
                  onClick={() => { onChange(u.value); setSearch(u.value); setOpen(false); }}
                >
                  {u.label}
                </Button>
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
export default function Produtos() {
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

  // ── No empresa ──
  if (!empresaAtiva) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <CabecalhoPagina
            icone={<Package />}
            titulo="Produtos"
            descricao="Cadastro de produtos da empresa — código, unidade, NCM, CEST, EAN e preço de venda."
          />
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <EstadoVazio
              icone={<Building2 />}
              titulo="Nenhuma empresa ativa"
              descricao="Selecione uma empresa ativa para acessar o cadastro de produtos."
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  // ══ FORM VIEW ══════════════════════════════════════════════════
  if (view === 'form') {
    const codigoDisplay = editingId ? (produtos.find(p => p.id === editingId)?.codigo ?? '—') : codigoNovo;

    return (
      <AppLayout>
        <div className="space-y-6">
          <CabecalhoPagina
            icone={<Package />}
            trilha={[{ rotulo: 'Produtos' }, { rotulo: editingId ? 'Editar produto' : 'Novo produto' }]}
            titulo={editingId ? 'Editar Produto' : 'Incluir Produto'}
            descricao={codigoDisplay ? `Código ${codigoDisplay}` : undefined}
            acoes={
              <>
                <Button variant="outline" onClick={closeForm}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Salvar
                </Button>
              </>
            }
          />

        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="p-6 space-y-6">
            {/* Top: image + fields + definição */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Image */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-24 h-24 rounded-md bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs text-center p-1">
                  {codigoDisplay || 'Novo'}
                </div>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs">
                  <Pencil className="w-3 h-3" aria-hidden="true" /> Alterar
                </Button>
                <span className="text-xs text-muted-foreground">1 imagem</span>
              </div>

              {/* Main fields */}
              <div className="flex-1 space-y-3">
                <Field label="Descrição do Produto">
                  <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="pt-1" />
                </Field>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Código do Produto">
                    <Input value={codigoDisplay} readOnly className="pt-1 bg-muted text-muted-foreground" />
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
                      <Input value={form.familia_produto} onChange={e => setForm(f => ({ ...f, familia_produto: e.target.value }))} className="pt-1 pr-9" placeholder="Opcional" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground" aria-label="Editar família de produto">
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Opcional (mas importante para os seus relatórios de estoque e de faturamento)</p>
                  </Field>
                </div>
              </div>

              {/* Definição do Produto */}
              <div className="shrink-0 w-full md:w-44 rounded-lg border border-border p-3 space-y-3">
                <p className="text-sm font-semibold">Definição do Produto</p>
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
              <TabsList>
                {[
                  { value: 'estoque', label: 'Estoque' },
                  { value: 'fornecedores', label: 'Fornecedores' },
                  { value: 'historico', label: 'Histórico de Compras' },
                  { value: 'info', label: 'Informações Adicionais' },
                  { value: 'caracteristicas', label: 'Características' },
                  { value: 'fiscal', label: 'Recomendações Fiscais' },
                  { value: 'observacoes', label: 'Observações' },
                ].map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
              </TabsList>

              {/* Estoque */}
              <TabsContent value="estoque" className="rounded-lg border border-border p-4 mt-2 space-y-3">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Estoque Mínimo</h3>
                  <p className="text-sm text-muted-foreground">Clique diretamente em qualquer célula desta coluna para atualizar o estoque mínimo de cada local de estoque</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="ctrl-lote" />
                  <Label htmlFor="ctrl-lote" className="text-sm flex items-center gap-1">Este produto possui controle de lote <span className="text-muted-foreground cursor-help">ⓘ</span></Label>
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {['Local de Estoque','Estoque Disponível','CMC Unitário','CMC Total','Estoque Mínimo','Previsão de Entrada','Previsão de Saída'].map(col => (
                          <th key={col} className="py-2 px-3 text-left text-sm font-semibold text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1">{col}<ChevronsUpDown className="w-3 h-3 opacity-40" aria-hidden="true" /><Filter className="w-3 h-3 opacity-40" aria-hidden="true" /></div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border">
                        <td className="py-2 px-3 font-medium">PADRAO - Local de Estoque Padrão</td>
                        <td className="py-2 px-3 text-right tabular-nums">0 {form.unidade}</td>
                        <td className="py-2 px-3 text-right tabular-nums">0,00</td>
                        <td className="py-2 px-3 text-right tabular-nums">0,00</td>
                        <td className="py-2 px-3 text-right"><Input aria-label="Estoque mínimo" className="h-9 w-20 text-sm text-right tabular-nums ml-auto" defaultValue="0" /></td>
                        <td className="py-2 px-3 text-right tabular-nums">0.000000 {form.unidade}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Fornecedores */}
              <TabsContent value="fornecedores" className="rounded-lg border border-border p-4 mt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="text-lg font-semibold">Fornecedores vinculados</p>
                  <Button variant="outline" onClick={() => { setFornBusca(''); setVincularOpen(true); }}>
                    <Link className="w-4 h-4" aria-hidden="true" /> Vincular Fornecedor
                  </Button>
                </div>
                {form.fornecedoresVinculados.length === 0 ? (
                  <EstadoVazio
                    tamanho="compacto"
                    icone={<Package />}
                    titulo="Nenhum fornecedor vinculado"
                    descricao="Nenhum fornecedor vinculado a este produto."
                    acao={
                      <Button variant="outline" onClick={() => { setFornBusca(''); setVincularOpen(true); }}>
                        <Plus className="w-4 h-4" aria-hidden="true" /> Adicionar fornecedor
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {form.fornecedoresVinculados.map(f => (
                      <div key={f.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
                        <div>
                          <p className="text-sm font-medium">{f.nome}</p>
                          {f.documento && <p className="text-xs text-muted-foreground">{f.documento}</p>}
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive-tint" aria-label={`Desvincular ${f.nome}`} onClick={() => desvincularFornecedor(f.id)}>
                          <X className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Histórico */}
              <TabsContent value="historico" className="rounded-lg border border-border p-4 mt-2">
                <EstadoVazio
                  tamanho="compacto"
                  icone={<History />}
                  titulo="Sem histórico"
                  descricao="Nenhum histórico de compras disponível."
                />
              </TabsContent>

              {/* Informações Adicionais */}
              <TabsContent value="info" className="rounded-lg border border-border p-4 mt-2 space-y-4">
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
              <TabsContent value="caracteristicas" className="rounded-lg border border-border p-4 mt-2">
                <EstadoVazio
                  tamanho="compacto"
                  icone={<ClipboardList />}
                  titulo="Sem características"
                  descricao="Nenhuma característica cadastrada."
                />
              </TabsContent>

              {/* Recomendações Fiscais */}
              <TabsContent value="fiscal" className="rounded-lg border border-border p-4 mt-2 space-y-4">
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
                <div className="border-t border-border pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <TabsContent value="observacoes" className="rounded-lg border border-border p-4 mt-2">
                <Label htmlFor="produto-observacoes" className="text-sm">Observações</Label>
                <Textarea id="produto-observacoes" className="mt-1 min-h-32 resize-none" placeholder="Observações sobre este produto..." />
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Salvar
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input aria-label="Buscar fornecedor" placeholder="Buscar fornecedor..." value={fornBusca} onChange={e => setFornBusca(e.target.value)} className="pl-9" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {fornFiltrados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {fornecedoresDisp.length === 0 ? 'Nenhum fornecedor cadastrado.' : 'Nenhum resultado encontrado.'}
                  </p>
                ) : (
                  fornFiltrados.map(f => (
                    <Button key={f.id} type="button" variant="outline" onClick={() => vincularFornecedor(f)} className="h-auto w-full flex-col items-start whitespace-normal p-3 text-left font-normal">
                      <span className="text-sm font-medium">{f.nome}</span>
                      {f.documento && <span className="text-xs text-muted-foreground">{f.documento}</span>}
                      {f.email && <span className="text-xs text-muted-foreground">{f.email}</span>}
                    </Button>
                  ))
                )}
              </div>
              <div className="border-t border-border pt-3">
                <Button variant="outline" className="w-full" onClick={() => { setVincularOpen(false); setNovoFornOpen(true); }}>
                  <Plus className="w-4 h-4" aria-hidden="true" /> Cadastrar novo fornecedor
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
        </div>
      </AppLayout>
    );
  }

  // ══ LIST VIEW ══════════════════════════════════════════════════
  return (
    <AppLayout>
      <div className="space-y-6">
      <CabecalhoPagina
        icone={<Package />}
        titulo="Produtos"
        descricao="Cadastro de produtos da empresa — código, unidade, NCM, CEST, EAN e preço de venda."
        acoes={
          <>
            <Button variant="outline">
              <Upload className="w-4 h-4" aria-hidden="true" /> Importar Planilha
            </Button>
            <Button onClick={openNovo}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Incluir
            </Button>
          </>
        }
        filtros={
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Buscar produto" placeholder="Buscar produto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
        <div className="bg-muted border-b border-border px-4 py-2 text-center text-xs text-muted-foreground">
          Arraste uma ou mais colunas aqui para agrupar
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="p-4 space-y-2" role="status" aria-label="Carregando produtos">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filtered.length === 0 ? (
              <EstadoVazio
                icone={<Package />}
                titulo="Nenhum produto encontrado"
                descricao="Cadastre o primeiro produto ou ajuste a busca."
                acao={
                  <Button onClick={openNovo}><Plus className="w-4 h-4" aria-hidden="true" /> Incluir primeiro produto</Button>
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10 border-b border-border">
                  <tr>
                    <th className="w-8 py-2 px-2"><Checkbox aria-label="Selecionar todos da página" checked={allChecked} onCheckedChange={toggleAll} /></th>
                    <ColHeader label="Situação" className="w-28" />
                    <ColHeader label="Descrição" />
                    <ColHeader label="Código" className="w-28" />
                    <ColHeader label="Família de Produto" className="w-36" />
                    <ColHeader label="Código NCM" className="w-28" />
                    <ColHeader label="CEST" className="w-24" />
                    <ColHeader label="Código EAN (GTIN)" className="w-36" />
                    <ColHeader label="Preço Unitário de Venda" className="w-40 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageItems.map(p => {
                    const isSel = selected === p.id;
                    return (
                      <tr key={p.id} className={cn('cursor-pointer transition-colors', isSel ? 'bg-primary-tint border-l-2 border-l-primary' : 'hover:bg-muted')} onClick={() => setSelected(isSel ? null : p.id)} onDoubleClick={() => openEdit(p)}>
                        <td className="py-2 px-2" onClick={e => e.stopPropagation()}><Checkbox aria-label={`Selecionar ${p.descricao}`} checked={checked.has(p.id)} onCheckedChange={v => setChecked(prev => { const n = new Set(prev); if (v) n.add(p.id); else n.delete(p.id); return n; })} /></td>
                        <td className="py-2 px-2">
                          <Badge variant={p.ativo ? 'success' : 'muted'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </td>
                        <td className="py-2 px-2 font-medium">{p.descricao}</td>
                        <td className="py-2 px-2 text-sm text-muted-foreground">{p.codigo ?? '—'}</td>
                        <td className="py-2 px-2 text-sm text-muted-foreground italic">{p.categoria ?? <span className="opacity-60">{'<não informado>'}</span>}</td>
                        <td className="py-2 px-2 text-sm text-foreground font-medium">{p.ncm ?? '—'}</td>
                        <td className="py-2 px-2 text-sm text-muted-foreground">{p.cest ?? <span className="opacity-60">—</span>}</td>
                        <td className="py-2 px-2 text-sm text-muted-foreground">{p.codigo_ean ?? <span className="opacity-60">—</span>}</td>
                        <td className="py-2 px-2 text-sm text-right tabular-nums">{p.preco_venda != null && p.preco_venda > 0 ? `R$ ${fmtPreco(p.preco_venda)}` : <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-auto w-6 shrink-0 rounded-none border-l border-border bg-muted hover:bg-muted/80"
            aria-label={panelOpen ? 'Recolher painel de ações' : 'Expandir painel de ações'}
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen(o => !o)}
          >
            <ChevronRight className={cn('w-3 h-3 text-muted-foreground transition-transform', panelOpen ? '' : 'rotate-180')} aria-hidden="true" />
          </Button>

          {panelOpen && (
            <div className="w-56 border-l border-border bg-card shrink-0 overflow-y-auto">
              {selectedProduto ? (
                <div className="p-3 space-y-1">
                  <p className="font-semibold text-sm">{selectedProduto.descricao}</p>
                  <p className="text-xs text-muted-foreground mb-3">{selectedProduto.codigo ?? '—'}</p>
                  {[
                    { icon: Pencil, label: 'Editar', action: () => openEdit(selectedProduto), disabled: false },
                    { icon: Copy, label: 'Duplicar', action: () => openDuplicate(selectedProduto), disabled: false },
                    { icon: UserMinus, label: selectedProduto.ativo ? 'Inativar' : 'Reativar', action: () => handleInativar(selectedProduto.id), disabled: false },
                    { icon: Paperclip, label: 'Anexos', action: () => {}, disabled: true },
                    { icon: History, label: 'Histórico de Alterações', action: () => {}, disabled: true },
                    { icon: ClipboardList, label: 'Tarefas', action: () => {}, disabled: true },
                  ].map(({ icon: Icon, label, action, disabled }) => (
                    <Button key={label} type="button" variant="ghost" size="sm" onClick={action} disabled={disabled} className="w-full justify-start gap-2 px-2 font-normal">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" /><span>{label}</span>
                    </Button>
                  ))}
                  <div className="border-t border-border pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(selectedProduto.id)} className="w-full justify-start gap-2 px-2 font-normal text-destructive hover:text-destructive hover:bg-destructive-tint">
                      <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" /><span>Excluir</span>
                    </Button>
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

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-border bg-muted text-xs text-muted-foreground">
          <span>{filtered.length === 0 ? 'Nenhum registro' : `${(curPage - 1) * PAGE_SIZE + 1} - ${Math.min(curPage * PAGE_SIZE, filtered.length)} de ${filtered.length} registros`}</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Primeira página" disabled={curPage <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-4 h-4" aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Página anterior" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" aria-hidden="true" /></Button>
            <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-medium" aria-current="page">{curPage}</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Próxima página" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight className="w-4 h-4" aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Última página" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-4 h-4" aria-hidden="true" /></Button>
          </div>
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
