import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Link as RotaLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePessoas } from '@/hooks/useFinanceiro';
import PessoaFormDialog from '@/components/financeiro/PessoaFormDialog';
import NcmDialog from '@/components/shared/NcmDialog';
import CestDialog from '@/components/shared/CestDialog';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TabelaGestao, { type ColunaGestao, type OrdenacaoTabela } from '@/components/gestao/TabelaGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { ValorIndisponivel } from '@/components/gestao/SeloSituacao';
import { SecaoGestao } from '@/components/gestao/TelaGestao';
import { NCM_CODES } from '@/data/ncm-codes';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Pencil, Copy, UserMinus, ClipboardList, Upload, Package,
  Search, Link as LinkIcon, X, Globe, Info, History, FileText, ShoppingCart, Boxes,
  ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { UNIDADES, unidadesMaisUsadas } from '@/lib/unidades';
import {
  interpretarPlanilha, lerCsv, MOTIVO_LEGIVEL,
  type ResultadoLeitura,
} from '@/lib/produtos/importar-planilha';

/**
 * CadastroProdutos — o cadastro de produtos da empresa, em um lugar só.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * Até 13/09 o mesmo cadastro morava DUAS vezes no repo: `src/pages/Produtos.tsx`
 * e `src/components/gestao-compras/ProdutosOmie.tsx`. Não eram telas parecidas
 * — eram a mesma tela: mesmas 7 subabas com as mesmas strings, mesmo
 * `defaultForm` de 40 campos, mesma geração de código `PRDnnnnn`, mesmos
 * diálogos de NCM e CEST, mesmo payload de 33 colunas. Conferido linha a linha:
 * a camada de dados das duas era idêntica byte a byte. O que divergia era só a
 * moldura (uma é rota com `AppLayout`, a outra é aba embutida) e o fio que
 * avisa a página mãe.
 *
 * Duas cópias do mesmo cadastro não é redundância inofensiva: é a garantia de
 * que a próxima correção fiscal entra em uma e esquece a outra. Foi exatamente
 * o que começou a acontecer — `ProdutosOmie` recebeu três correções que
 * `Produtos.tsx` não recebeu.
 *
 * Então o cadastro vive aqui, e as duas entradas apenas o vestem:
 *
 *   /produtos        → src/pages/Produtos.tsx        (AppLayout + cabeçalho)
 *   /gestao-compras  → .../ProdutosOmie.tsx          (aba, sem moldura)
 *
 * ⚠️ A PROTEÇÃO DE CADA ROTA NÃO MUDA COM A UNIFICAÇÃO. `/produtos` é
 * `ProtectedPages` (só autenticação) e `/gestao-compras` é `PlanPages`
 * (autenticação + plano). O portão mora em `src/App.tsx`, no elemento da rota,
 * e continua onde estava: unificar o miolo não afrouxa nem endurece o acesso de
 * ninguém. Quem alcançava cada tela antes alcança exatamente a mesma depois.
 * ────────────────────────────────────────────────────────────────────────────
 */

// Unidades: a lista vive em src/lib/unidades.ts, junto com os sinônimos e o
// que a NF-e aceita. Havia cinco listas divergentes no sistema, e a unidade
// escolhida aqui podia não existir na Calculadora nem no Contrato.
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
  observacoes: string;
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
  ncm_descricao: '', cest_descricao: '', observacoes: '', fornecedoresVinculados: [],
});

const PAGE_SIZE = 10;

const fmtPreco = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function parseMoeda(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

function formatMoeda(v: string): string {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

// ── Sub-components ─────────────────────────────────────────────────────────
/**
 * Ícone de informação que realmente informa: `title` dá a dica no hover do
 * mouse e o `sr-only` entrega o mesmo texto ao leitor de tela. Sem o `title`
 * o ⓘ virava enfeite para a maioria dos usuários.
 */
function Ajuda({ texto }: { texto: string }) {
  return (
    <span title={texto} className="inline-flex cursor-help items-center">
      <Info className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{texto}</span>
    </span>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute -top-2 left-2 g-meta text-muted-foreground bg-background px-1 z-10">{label}</span>
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
    // Fechar sem escolher devolve a unidade selecionada ao campo — abrir a
    // lista não pode apagar o que já estava lá.
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
          // Abrir a lista limpa a BUSCA, não a seleção. O campo guardava a
          // unidade escolhida ("PC") e filtrava por ela, então a lista mostrava
          // só "Peça (PC)" e "Pacote (PCT)" — parecia que o sistema só tinha
          // duas unidades, quando tem 58.
          onFocus={() => { setOpen(true); setSearch(''); }}
          onChange={e => { setSearch(e.target.value); setOpen(true); onChange(e.target.value); }}
          className="g-controle pt-1 pr-10"
          placeholder="PC"
          aria-label="Unidade"
        />
        <Button type="button" variant="ghost" size="sm" aria-label={search ? 'Limpar unidade' : 'Abrir lista de unidades'}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0 text-muted-foreground hover:text-foreground"
          onClick={() => { setSearch(''); onChange(''); setOpen(true); }}>
          {search ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 rounded-[var(--g-raio)] border border-border bg-popover shadow-md max-h-60 overflow-y-auto g-corpo">
          {topFiltered.length > 0 && (
            <>
              <div className="px-3 py-2 g-meta font-semibold text-muted-foreground uppercase tracking-wide">Mais Utilizadas</div>
              {topFiltered.map(u => (
                <button type="button" key={u.value} className={`w-full text-left px-3 py-2 hover:bg-muted focus-visible:outline-none focus-visible:bg-muted transition-colors ${value === u.value ? 'bg-primary-tint text-primary font-medium' : ''}`}
                  onClick={() => { onChange(u.value); setSearch(u.value); setOpen(false); }}>
                  {u.label}
                </button>
              ))}
              {todasFiltered.length > 0 && <div className="border-t border-border mx-2 my-1" />}
            </>
          )}
          {todasFiltered.length > 0 && (
            <>
              <div className="px-3 py-2 g-meta font-semibold text-muted-foreground uppercase tracking-wide">Todas as Unidades</div>
              {todasFiltered.map(u => (
                <button type="button" key={u.value} className={`w-full text-left px-3 py-2 hover:bg-muted focus-visible:outline-none focus-visible:bg-muted transition-colors ${value === u.value ? 'bg-primary-tint text-primary font-medium' : ''}`}
                  onClick={() => { onChange(u.value); setSearch(u.value); setOpen(false); }}>
                  {u.label}
                </button>
              ))}
            </>
          )}
          {topFiltered.length === 0 && todasFiltered.length === 0 && (
            <div className="px-3 py-3 g-meta text-muted-foreground text-center">Nenhuma unidade encontrada</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vínculos do produto ────────────────────────────────────────────────────
/**
 * O que amarra um produto ao resto do sistema. Os três números vêm de
 * consulta real, cada um da sua tabela:
 *
 *   Itens de contrato → `contrato_itens.produto_id`
 *   Pedidos           → `pedido_itens.produto_id` (pedidos distintos)
 *   Estoque           → `estoque_movimentos.produto_id`
 *
 * Enquanto a consulta não volta, o número é `null` e a caixa mostra "—" com a
 * razão, nunca `0`: zero é uma afirmação ("este produto não está em contrato
 * nenhum") e ainda não temos como fazê-la.
 */
type VinculoContrato = { id: string; contrato_id: string; descricao: string; quantidade_contratada: number; unidade: string };
type VinculoPedido = { id: string; pedido_id: string; quantidade: number; valor_total: number; numero: number | null; tipo: string | null; status: string | null; data: string | null };
type VinculoMovimento = { id: string; tipo: string; quantidade: number; origem: string; created_at: string };

type Vinculos = {
  contratos: VinculoContrato[];
  pedidos: VinculoPedido[];
  movimentos: VinculoMovimento[];
  carregando: boolean;
  /** A consulta falhou — a caixa diz isso em vez de mostrar zero. */
  erro: boolean;
};

const VINCULOS_VAZIOS: Vinculos = { contratos: [], pedidos: [], movimentos: [], carregando: false, erro: false };

export interface CadastroProdutosRef {
  novoProduto: () => void;
}

const CadastroProdutos = forwardRef<CadastroProdutosRef, { aoMudar?: () => void }>(
  function CadastroProdutos({ aoMudar }, ref) {
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
  const [search, setSearch] = useState('');
  const [situacao, setSituacao] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [page, setPage] = useState(1);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela>({ chave: 'descricao', direcao: 'asc' });
  const [abaPainel, setAbaPainel] = useState<'dados' | 'fornecedores' | 'vinculos'>('dados');

  // Dialog states
  const [vincularOpen, setVincularOpen] = useState(false);
  const [novoFornOpen, setNovoFornOpen] = useState(false);
  const [fornBusca, setFornBusca] = useState('');
  const [ncmOpen, setNcmOpen] = useState(false);
  const [cestOpen, setCestOpen] = useState(false);

  // Importação de planilha
  const inputPlanilhaRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [previaImport, setPreviaImport] = useState<ResultadoLeitura | null>(null);
  const [gravandoImport, setGravandoImport] = useState(false);

  // Vínculos do produto selecionado (e do produto em edição, para o histórico)
  const [vinculos, setVinculos] = useState<Vinculos>(VINCULOS_VAZIOS);
  // Fornecedores do produto SELECIONADO na lista — o painel lateral mostra o
  // vínculo gravado, não o rascunho do formulário.
  const [fornDoSelecionado, setFornDoSelecionado] = useState<FornecedorVinculado[]>([]);

  // Sem lista de dependências de propósito: `openNovo` é declaração de função
  // (recriada a cada render) e o punho só é lido no clique.
  useImperativeHandle(ref, () => ({ novoProduto: () => { void openNovo(); } }));

  useEffect(() => {
    if (!empresaAtiva) { setLoading(false); return; }
    loadProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva]);

  // O produto em foco — seja o selecionado na lista, seja o aberto no
  // formulário — é quem manda carregar os vínculos. Uma consulta só serve às
  // três caixas, à subaba "Vínculos" e ao "Histórico de Compras".
  const idEmFoco = view === 'form' ? editingId : selected;

  useEffect(() => {
    let cancelado = false;
    if (!idEmFoco || !empresaAtiva) { setVinculos(VINCULOS_VAZIOS); setFornDoSelecionado([]); return; }
    setVinculos({ ...VINCULOS_VAZIOS, carregando: true });

    (async () => {
      const [contratosRes, pedidosRes, movimentosRes, fornRes] = await Promise.all([
        // `as never` na tabela: `contrato_itens.produto_id` existe no banco
        // (migration 20260824000003) mas ainda não foi regerado no types.ts,
        // então o genérico recusaria o `.eq('produto_id', …)`. É o mesmo
        // contorno que o resto do repo usa para coluna fora do tipo gerado.
        supabase.from('contrato_itens' as never)
          .select('id, contrato_id, descricao, quantidade_contratada, unidade')
          .eq('produto_id', idEmFoco),
        supabase.from('pedido_itens' as never)
          .select('id, pedido_id, quantidade, valor_total, pedidos(numero, tipo, status, created_at)')
          .eq('produto_id', idEmFoco),
        supabase.from('estoque_movimentos')
          .select('id, tipo, quantidade, origem, created_at')
          .eq('produto_id', idEmFoco)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('produto_fornecedores')
          .select('pessoa_id, financeiro_pessoas(id, nome, documento)')
          .eq('produto_id', idEmFoco),
      ]);
      if (cancelado) return;

      const erro = Boolean(contratosRes.error || pedidosRes.error || movimentosRes.error);
      setVinculos({
        carregando: false,
        erro,
        contratos: ((contratosRes.data ?? []) as unknown as VinculoContrato[]),
        pedidos: ((pedidosRes.data ?? []) as unknown as Array<Record<string, unknown>>).map(r => {
          const ped = r.pedidos as { numero?: number; tipo?: string; status?: string; created_at?: string } | null;
          return {
            id: String(r.id),
            pedido_id: String(r.pedido_id),
            quantidade: Number(r.quantidade ?? 0),
            valor_total: Number(r.valor_total ?? 0),
            numero: ped?.numero ?? null,
            tipo: ped?.tipo ?? null,
            status: ped?.status ?? null,
            data: ped?.created_at ?? null,
          };
        }),
        movimentos: ((movimentosRes.data ?? []) as unknown as VinculoMovimento[]),
      });
      setFornDoSelecionado(((fornRes.data ?? []) as unknown as Array<Record<string, unknown>>).map(r => {
        const p = r.financeiro_pessoas as { id?: string; nome?: string; documento?: string | null } | null;
        return { id: p?.id ?? String(r.pessoa_id), nome: p?.nome ?? '', documento: p?.documento ?? null };
      }));
    })();

    return () => { cancelado = true; };
  }, [idEmFoco, empresaAtiva]);

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
      // A coluna `observacoes` existe em `produtos` desde a migration de
      // 04/07, mas o campo da aba Observações nunca teve `value`/`onChange`:
      // quem escrevia ali perdia o texto ao salvar, nas duas cópias da tela.
      observacoes: form.observacoes || null,
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
    aoMudar?.();
    await loadProdutos();
    closeForm();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Produto excluído');
    aoMudar?.();
    if (selected === id) setSelected(null);
    await loadProdutos();
  }

  async function handleInativar(id: string) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    const { error } = await supabase.from('produtos').update({ ativo: !p.ativo } as never).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success(p.ativo ? 'Produto inativado' : 'Produto reativado');
    aoMudar?.();
    await loadProdutos();
  }

  /** Produto do banco → rascunho do formulário. Um só lugar, porque editar e
   *  duplicar preenchiam os mesmos 30 campos em dois blocos copiados. */
  function produtoParaForm(p: Produto, fornVinc: FornecedorVinculado[], duplicando: boolean): ProdutoForm {
    const fmtNum = (v: number | null) =>
      v != null && v > 0
        ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
        : '';
    const fmtDec = (v: number | null) => (v != null ? String(v).replace('.', ',') : '0,000');
    const ncmCode = p.ncm ?? '';

    return {
      ...defaultForm(),
      descricao: duplicando ? `${p.descricao} (cópia)` : p.descricao,
      codigo_ean: p.codigo_ean ?? '',
      unidade: p.unidade,
      preco_venda: fmtNum(p.preco_venda),
      ncm: ncmCode,
      ncm_descricao: NCM_CODES.find(n => n.codigo === ncmCode)?.descricao ?? '',
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
      observacoes: p.observacoes ?? '',
      // Duplicar sempre nasce ativo; editar preserva a situação gravada.
      ativo: duplicando ? true : p.ativo,
      fornecedoresVinculados: fornVinc,
    };
  }

  async function carregarFornecedores(produtoId: string): Promise<FornecedorVinculado[]> {
    const { data } = await supabase
      .from('produto_fornecedores')
      .select('pessoa_id, financeiro_pessoas(id, nome, documento)')
      .eq('produto_id', produtoId);
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(r => {
      const p = r.financeiro_pessoas as { id?: string; nome?: string; documento?: string | null } | null;
      return { id: p?.id ?? String(r.pessoa_id), nome: p?.nome ?? '', documento: p?.documento ?? null };
    });
  }

  async function openEdit(p: Produto) {
    setEditingId(p.id);
    setForm(produtoParaForm(p, await carregarFornecedores(p.id), false));
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
    setForm(produtoParaForm(p, await carregarFornecedores(p.id), true));
    setView('form');
  }

  function closeForm() {
    setView('list'); setEditingId(null); setCodigoNovo(''); setForm(defaultForm());
  }

  // ── Importação de planilha ───────────────────────────────────────────────
  /**
   * Lê o arquivo e MOSTRA o que vai acontecer antes de gravar qualquer coisa.
   * A confirmação existe porque importação é a operação com maior chance de
   * duplicar cadastro, e a pessoa precisa ver quantas linhas serão recusadas
   * — e por quê — enquanto ainda dá para cancelar.
   */
  async function lerArquivoPlanilha(file: File) {
    setImportando(true);
    try {
      let celulas: string[][];
      if (/\.csv$/i.test(file.name)) {
        celulas = lerCsv(await file.text());
      } else {
        // `exceljs` só entra no bundle de quem realmente importa uma planilha.
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.worksheets[0];
        if (!ws) { toast.error('A planilha não tem nenhuma aba com dados.'); return; }
        celulas = [];
        ws.eachRow({ includeEmpty: false }, (row) => {
          const valores: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            valores[col - 1] = cell.text ?? '';
          });
          celulas.push(Array.from(valores, v => v ?? ''));
        });
      }
      const resultado = interpretarPlanilha(celulas, produtos.map(p => p.descricao));
      if (resultado.lidas === 0) {
        toast.error('Nenhuma linha de dado encontrada. A primeira linha precisa ser o cabeçalho (Descrição, Unidade, NCM, Preço…).');
        return;
      }
      setPreviaImport(resultado);
    } catch {
      toast.error('Não foi possível ler a planilha. Aceitos: .xlsx e .csv.');
    } finally {
      setImportando(false);
    }
  }

  async function confirmarImportacao() {
    if (!previaImport || !empresaAtiva || previaImport.novas.length === 0) return;
    setGravandoImport(true);
    try {
      // Códigos sequenciais gerados a partir do MAIOR existente, um por linha —
      // o mesmo critério do cadastro manual, para a planilha não abrir uma
      // segunda numeração paralela.
      const base = await generateNextCodigo();
      const inicio = parseInt(base.replace('PRD', ''), 10) || 1;
      const linhas = previaImport.novas.map((l, i) => ({
        empresa_id: empresaAtiva.id,
        codigo: `PRD${String(inicio + i).padStart(5, '0')}`,
        descricao: l.descricao,
        unidade: l.unidade || 'PC',
        categoria: l.familia || null,
        ncm: l.ncm || null,
        codigo_ean: l.codigo_ean || null,
        preco_venda: l.preco_venda,
        saldo_atual: 0,
        saldo_minimo: 0,
        ativo: true,
      }));
      const { error } = await supabase.from('produtos').insert(linhas as never);
      if (error) { toast.error(`Erro ao importar: ${error.message}`); return; }
      toast.success(`${linhas.length} produto(s) importado(s).`);
      setPreviaImport(null);
      aoMudar?.();
      await loadProdutos();
    } catch {
      toast.error('Erro ao importar a planilha.');
    } finally {
      setGravandoImport(false);
    }
  }

  // ── Lista filtrada, ordenada e paginada ──────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = produtos.filter(p => {
      if (situacao === 'ativos' && !p.ativo) return false;
      if (situacao === 'inativos' && p.ativo) return false;
      if (!q) return true;
      return p.descricao.toLowerCase().includes(q)
        || (p.codigo ?? '').toLowerCase().includes(q)
        || (p.ncm ?? '').toLowerCase().includes(q)
        || (p.categoria ?? '').toLowerCase().includes(q);
    });
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (ordenacao.chave) {
        case 'codigo': return sinal * (a.codigo ?? '').localeCompare(b.codigo ?? '', 'pt-BR');
        case 'unidade': return sinal * a.unidade.localeCompare(b.unidade, 'pt-BR');
        case 'familia': return sinal * (a.categoria ?? '').localeCompare(b.categoria ?? '', 'pt-BR');
        case 'ncm': return sinal * (a.ncm ?? '').localeCompare(b.ncm ?? '', 'pt-BR');
        case 'preco': return sinal * ((a.preco_venda ?? 0) - (b.preco_venda ?? 0));
        case 'situacao': return sinal * (Number(b.ativo) - Number(a.ativo));
        default: return sinal * a.descricao.localeCompare(b.descricao, 'pt-BR');
      }
    });
  }, [produtos, search, situacao, ordenacao]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const selectedProduto = produtos.find(p => p.id === selected) ?? null;

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

  const filtrosAplicados = (search.trim() ? 1 : 0) + (situacao !== 'todos' ? 1 : 0);

  /** As compras deste produto — pedidos de COMPRA que o contêm. */
  const historicoCompras = useMemo(
    () => vinculos.pedidos
      .filter(p => p.tipo === 'compra')
      .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '')),
    [vinculos.pedidos],
  );

  const pedidosDistintos = useMemo(
    () => new Set(vinculos.pedidos.map(p => p.pedido_id)).size,
    [vinculos.pedidos],
  );

  // ══ FORM VIEW ══════════════════════════════════════════════════
  if (view === 'form') {
    const codigoDisplay = editingId ? (produtos.find(p => p.id === editingId)?.codigo ?? '—') : codigoNovo;
    const produtoEmEdicao = editingId ? produtos.find(p => p.id === editingId) ?? null : null;

    // bg-background (não bg-card): os rótulos flutuantes do `Field` pintam
    // `bg-background` por cima da borda do campo — sobre um painel branco
    // apareceria uma faixa off-white acima de cada input.
    return (
      <div className="g-cartao bg-background overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted">
          <h2 className="g-titulo-secao">{editingId ? 'Editar produto' : 'Incluir produto'}</h2>
          <div className="flex items-center gap-2">
            <span className="g-meta text-muted-foreground tabular-nums">{codigoDisplay || 'Novo'}</span>
            <Button variant="ghost" size="sm" onClick={closeForm}>Fechar <X className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Altura pelo Tailwind (purgável), não por `style` inline. */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-12.5rem)]">
          {/* Identificação — duas colunas, como pede a composição */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 space-y-4 min-w-0">
              <Field label="Descrição do Produto">
                <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="g-controle pt-1" aria-label="Descrição do Produto" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Código do Produto">
                  <Input value={codigoDisplay} readOnly aria-label="Código do Produto" className="g-controle pt-1 bg-muted text-muted-foreground" />
                </Field>
                <Field label="Código EAN (GTIN)">
                  <div className="relative">
                    <Input value={form.codigo_ean} onChange={e => setForm(f => ({ ...f, codigo_ean: e.target.value }))} className="g-controle pt-1 pr-9" aria-label="Código EAN (GTIN)" />
                    <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Field>
                <Field label="Unidade">
                  <UnidadeCombobox value={form.unidade} onChange={v => setForm(f => ({ ...f, unidade: v }))} />
                </Field>
                <Field label="Preço Unitário de Venda">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground g-meta select-none" aria-hidden="true">R$</span>
                    <Input
                      value={form.preco_venda}
                      onChange={e => setForm(f => ({ ...f, preco_venda: formatMoeda(e.target.value) }))}
                      className="g-controle pt-1 pl-9 text-right tabular-nums"
                      placeholder="0,00"
                      inputMode="numeric"
                      aria-label="Preço Unitário de Venda"
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Código NCM">
                  <div className="relative cursor-pointer" onClick={() => setNcmOpen(true)}>
                    <Input
                      value={form.ncm ? `${form.ncm}${form.ncm_descricao ? ' ' + form.ncm_descricao : ''}` : ''}
                      readOnly
                      className="g-controle pt-1 pl-9 cursor-pointer truncate"
                      placeholder="Selecionar NCM..."
                      aria-label="Código NCM"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Field>
                <Field label="Família de Produto">
                  <Input value={form.familia_produto} onChange={e => setForm(f => ({ ...f, familia_produto: e.target.value }))} className="g-controle pt-1" placeholder="Opcional" aria-label="Família de Produto" />
                  <p className="g-meta text-muted-foreground mt-1">Opcional (mas importante para os seus relatórios de estoque e de faturamento)</p>
                </Field>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="prod-ativo" checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                <Label htmlFor="prod-ativo" className="g-corpo">Produto ativo</Label>
              </div>
            </div>

            {/* Definição do Produto */}
            {/* `title` no elemento visível, não só no sr-only: para quem usa
                mouse o "Em breve" é a única explicação de por que os dois
                últimos interruptores estão mortos. */}
            <div className="shrink-0 lg:w-48 g-cartao p-4 space-y-3">
              <p className="g-corpo font-semibold">Definição do Produto</p>
              <div className="flex items-center justify-between">
                <Label className="g-corpo flex items-center gap-1">Simples <Ajuda texto="Produto simples, sem variações" /></Label>
                <Switch checked={form.tipo_simples} onCheckedChange={v => setForm(f => ({ ...f, tipo_simples: v }))} />
              </div>
              <div className="flex items-center justify-between opacity-50">
                <Label className="g-corpo flex items-center gap-1 cursor-not-allowed">Kit <Ajuda texto="Em breve" /></Label>
                <Switch checked={false} disabled />
              </div>
              <div className="flex items-center justify-between opacity-50">
                <Label className="g-corpo flex items-center gap-1 cursor-not-allowed">Com Variações <Ajuda texto="Em breve" /></Label>
                <Switch checked={false} disabled />
              </div>
            </div>
          </div>

          {/* As 7 subabas do produto — rótulos e ordem inalterados. */}
          <Tabs defaultValue="estoque" className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start">
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

            {/* Estoque — saldo REAL do cadastro, não uma linha de exemplo.
                O CMC (custo médio) aparece só quando foi apurado: custo não
                apurado exibido como 0,00 afirma que o produto não custou nada. */}
            <TabsContent value="estoque" className="g-cartao p-4 mt-2 space-y-4">
              <div>
                <h3 className="g-titulo-secao mb-1">Saldo em estoque</h3>
                <p className="g-corpo text-muted-foreground">
                  O saldo é movimentado pelas entradas de NF-e e pelas baixas de pedido — não se digita aqui.
                </p>
              </div>
              {produtoEmEdicao ? (
                <ListaDeCampos
                  campos={[
                    { rotulo: 'Local de estoque', valor: 'PADRAO — Local de Estoque Padrão' },
                    { rotulo: 'Saldo atual', valor: `${produtoEmEdicao.saldo_atual} ${produtoEmEdicao.unidade}`, numerico: true },
                    { rotulo: 'Estoque mínimo', valor: `${produtoEmEdicao.saldo_minimo} ${produtoEmEdicao.unidade}`, numerico: true },
                    {
                      rotulo: 'Custo médio (CMC)',
                      valor: produtoEmEdicao.preco_custo_medio > 0
                        ? `R$ ${fmtPreco(produtoEmEdicao.preco_custo_medio)}`
                        : <ValorIndisponivel razao="Sem entrada custeada" />,
                      numerico: produtoEmEdicao.preco_custo_medio > 0,
                    },
                    { rotulo: 'Movimentações registradas', valor: vinculos.carregando ? '…' : vinculos.movimentos.length, numerico: true },
                  ]}
                />
              ) : (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Boxes />}
                  titulo="Estoque começa em zero"
                  descricao="O saldo passa a existir depois que o produto for salvo e tiver a primeira entrada."
                />
              )}
            </TabsContent>

            {/* Fornecedores */}
            <TabsContent value="fornecedores" className="g-cartao p-4 mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="g-titulo-secao">Fornecedores vinculados</h3>
                <Button variant="outline" onClick={() => { setFornBusca(''); setVincularOpen(true); }}>
                  <LinkIcon className="w-4 h-4" /> Vincular Fornecedor
                </Button>
              </div>
              {form.fornecedoresVinculados.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<Package />}
                  titulo="Nenhum fornecedor vinculado"
                  descricao="Vincule quem fornece este produto para agilizar os pedidos de compra."
                  acao={
                    <Button variant="outline" onClick={() => { setFornBusca(''); setVincularOpen(true); }}>
                      <Plus className="w-4 h-4" /> Adicionar fornecedor
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {form.fornecedoresVinculados.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-3 g-cartao p-4">
                      <div className="min-w-0">
                        <p className="g-corpo font-medium">{f.nome}</p>
                        {f.documento && <p className="g-meta text-muted-foreground">{f.documento}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="w-9 px-0 shrink-0" aria-label={`Desvincular ${f.nome}`} onClick={() => desvincularFornecedor(f.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Histórico de Compras — dados reais de `pedido_itens` + `pedidos`.
                Era um estado vazio permanente ("As compras deste produto
                aparecerão aqui") que nunca se preenchia, em nenhuma das duas
                cópias da tela: a consulta simplesmente não existia. */}
            <TabsContent value="historico" className="g-cartao p-4 mt-2">
              {!editingId ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<History />}
                  titulo="Produto ainda não salvo"
                  descricao="O histórico de compras aparece depois que o produto existe no catálogo."
                />
              ) : vinculos.carregando ? (
                <p role="status" className="g-corpo text-muted-foreground">Carregando compras deste produto…</p>
              ) : vinculos.erro ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<History />}
                  titulo="Não foi possível consultar as compras"
                  descricao="A consulta aos pedidos falhou. Recarregue a página para tentar de novo."
                />
              ) : historicoCompras.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  icone={<History />}
                  titulo="Nenhuma compra registrada"
                  descricao="Este produto ainda não entrou em nenhum pedido de compra."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full g-corpo">
                    <caption className="sr-only">Pedidos de compra que contêm este produto</caption>
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th scope="col" className="g-meta px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">Pedido</th>
                        <th scope="col" className="g-meta px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">Data</th>
                        <th scope="col" className="g-meta px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">Situação</th>
                        <th scope="col" className="g-meta px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted-foreground">Qtd.</th>
                        <th scope="col" className="g-meta px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoCompras.map(c => (
                        <tr key={c.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium tabular-nums">#{c.numero ?? '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{fmtData(c.data)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.status ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.quantidade}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">R$ {fmtPreco(c.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Informações Adicionais */}
            <TabsContent value="info" className="g-cartao p-4 mt-2 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Peso Líquido (Kg)"><Input value={form.peso_liquido} onChange={e => setForm(f => ({ ...f, peso_liquido: e.target.value }))} className="g-controle pt-1" /></Field>
                <Field label="Peso Bruto (Kg)"><Input value={form.peso_bruto} onChange={e => setForm(f => ({ ...f, peso_bruto: e.target.value }))} className="g-controle pt-1" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Altura (cm)"><Input value={form.altura} onChange={e => setForm(f => ({ ...f, altura: e.target.value }))} className="g-controle pt-1" /></Field>
                <Field label="Largura (cm)"><Input value={form.largura} onChange={e => setForm(f => ({ ...f, largura: e.target.value }))} className="g-controle pt-1" /></Field>
                <Field label="Profundidade (cm)"><Input value={form.profundidade} onChange={e => setForm(f => ({ ...f, profundidade: e.target.value }))} className="g-controle pt-1" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Dias de Crossdocking"><Input value={form.dias_crossdocking} onChange={e => setForm(f => ({ ...f, dias_crossdocking: e.target.value }))} className="g-controle pt-1" /></Field>
                <Field label="Lead Time de Ressuprimento"><Input value={form.lead_time_ressuprimento} onChange={e => setForm(f => ({ ...f, lead_time_ressuprimento: e.target.value }))} className="g-controle pt-1" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Marca"><Input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} className="g-controle pt-1" placeholder="Opcional" /></Field>
                <Field label="Modelo"><Input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} className="g-controle pt-1" placeholder="Opcional" /></Field>
                <Field label="Dias de Garantia"><Input value={form.dias_garantia} onChange={e => setForm(f => ({ ...f, dias_garantia: e.target.value }))} className="g-controle pt-1" /></Field>
              </div>
            </TabsContent>

            {/* Características */}
            <TabsContent value="caracteristicas" className="g-cartao p-4 mt-2">
              <EstadoVazio
                tamanho="compacto"
                icone={<ClipboardList />}
                titulo="Nenhuma característica cadastrada"
                descricao="Atributos como cor, tamanho e voltagem ficam aqui."
              />
            </TabsContent>

            {/* Recomendações Fiscais */}
            <TabsContent value="fiscal" className="g-cartao p-4 mt-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Origem da Mercadoria">
                  <Select value={form.origem_mercadoria} onValueChange={v => setForm(f => ({ ...f, origem_mercadoria: v }))}>
                    <SelectTrigger className="g-controle pt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
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
                    <SelectTrigger className="g-controle pt-1"><SelectValue /></SelectTrigger>
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
                      className="g-controle pt-1 pl-9 cursor-pointer truncate"
                      placeholder="Selecionar CEST..."
                      aria-label="CEST"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Field>
                <Field label="Número da FCI">
                  <Input value={form.numero_fci} onChange={e => setForm(f => ({ ...f, numero_fci: e.target.value }))} className="g-controle pt-1" placeholder="Opcional" />
                </Field>
              </div>
              <div className="border-t border-border pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="CST ICMS"><Input value={form.cst_icms} onChange={e => setForm(f => ({ ...f, cst_icms: e.target.value }))} className="g-controle pt-1" placeholder="00" /></Field>
                <Field label="CSOSN"><Input value={form.csosn} onChange={e => setForm(f => ({ ...f, csosn: e.target.value }))} className="g-controle pt-1" placeholder="102" /></Field>
                <Field label="CST PIS"><Input value={form.cst_pis} onChange={e => setForm(f => ({ ...f, cst_pis: e.target.value }))} className="g-controle pt-1" placeholder="07" /></Field>
                <Field label="CST COFINS"><Input value={form.cst_cofins} onChange={e => setForm(f => ({ ...f, cst_cofins: e.target.value }))} className="g-controle pt-1" placeholder="07" /></Field>
                <Field label="CFOP"><Input value={form.cfop} onChange={e => setForm(f => ({ ...f, cfop: e.target.value }))} className="g-controle pt-1" placeholder="0000" /></Field>
                <Field label="Alíq. ICMS %"><Input value={form.p_icms} onChange={e => setForm(f => ({ ...f, p_icms: e.target.value }))} className="g-controle pt-1" placeholder="0" /></Field>
                <Field label="Alíq. PIS %"><Input value={form.p_pis} onChange={e => setForm(f => ({ ...f, p_pis: e.target.value }))} className="g-controle pt-1" placeholder="0" /></Field>
                <Field label="Alíq. COFINS %"><Input value={form.p_cofins} onChange={e => setForm(f => ({ ...f, p_cofins: e.target.value }))} className="g-controle pt-1" placeholder="0" /></Field>
              </div>
            </TabsContent>

            {/* Observações — agora ligada ao formulário e ao payload. */}
            <TabsContent value="observacoes" className="g-cartao p-4 mt-2">
              <Label htmlFor="prod-observacoes" className="sr-only">Observações</Label>
              <Textarea
                id="prod-observacoes"
                className="h-32 resize-none"
                placeholder="Observações sobre este produto..."
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
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
              <Label htmlFor="busca-forn-vinculo" className="sr-only">Buscar fornecedor</Label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="busca-forn-vinculo" placeholder="Buscar fornecedor..." value={fornBusca} onChange={e => setFornBusca(e.target.value)} className="g-controle pl-9" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {fornFiltrados.length === 0 ? (
                <EstadoVazio
                  tamanho="compacto"
                  titulo={fornecedoresDisp.length === 0 ? 'Nenhum fornecedor cadastrado' : 'Nenhum resultado encontrado'}
                  descricao={fornecedoresDisp.length === 0 ? 'Cadastre um fornecedor para vinculá-lo a este produto.' : 'Ajuste a busca para encontrar o fornecedor.'}
                />
              ) : (
                fornFiltrados.map(f => (
                  <button type="button" key={f.id} onClick={() => vincularFornecedor(f)} className="w-full text-left p-3 rounded-[var(--g-raio)] border border-border hover:bg-primary-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <p className="g-corpo font-medium">{f.nome}</p>
                    {f.documento && <p className="g-meta text-muted-foreground">{f.documento}</p>}
                    {f.email && <p className="g-meta text-muted-foreground">{f.email}</p>}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border pt-3">
              <Button variant="outline" className="w-full" onClick={() => { setVincularOpen(false); setNovoFornOpen(true); }}>
                <Plus className="w-4 h-4" /> Cadastrar novo fornecedor
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
  const colunas: ColunaGestao<Produto>[] = [
    {
      chave: 'situacao', titulo: 'Situação', ordenavel: true, largura: '120px', prioridade: 'sempre',
      render: p => (
        <SeloSituacao tom={p.ativo ? 'sucesso' : 'neutro'}>{p.ativo ? 'Ativo' : 'Inativo'}</SeloSituacao>
      ),
    },
    {
      chave: 'descricao', titulo: 'Descrição', ordenavel: true, prioridade: 'sempre',
      render: p => <span className="font-medium">{p.descricao}</span>,
    },
    {
      chave: 'codigo', titulo: 'Código', ordenavel: true, largura: '120px', prioridade: 'sempre',
      render: p => <span className="tabular-nums text-muted-foreground">{p.codigo ?? '—'}</span>,
    },
    {
      chave: 'unidade', titulo: 'Unidade', ordenavel: true, largura: '100px', prioridade: 'desktop',
      render: p => <span className="text-muted-foreground">{p.unidade}</span>,
    },
    {
      chave: 'familia', titulo: 'Família', ordenavel: true, largura: '160px', prioridade: 'desktop',
      render: p => p.categoria
        ? <span className="text-muted-foreground">{p.categoria}</span>
        : <SeloSituacao tom="neutro">Não informado</SeloSituacao>,
    },
    {
      chave: 'ncm', titulo: 'NCM', ordenavel: true, largura: '150px', prioridade: 'desktop',
      // NCM ausente é um selo neutro que DIZ que está ausente, não uma célula
      // em branco: em branco lê-se como "ainda não carregou".
      render: p => p.ncm
        ? <span className="tabular-nums font-medium">{p.ncm}</span>
        : <SeloSituacao tom="neutro">Não informado</SeloSituacao>,
    },
    {
      chave: 'preco', titulo: 'Preço de venda', ordenavel: true, alinhamento: 'direita', largura: '150px', prioridade: 'sempre',
      render: p => p.preco_venda != null && p.preco_venda > 0
        ? <span className="font-semibold">R$ {fmtPreco(p.preco_venda)}</span>
        : <ValorIndisponivel razao="Preço não definido" />,
    },
    {
      chave: 'acoes', titulo: 'Ações', alinhamento: 'direita', largura: '140px', prioridade: 'sempre',
      render: p => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <Button type="button" variant="ghost" size="sm" className="w-9 px-0" aria-label={`Editar ${p.descricao}`} onClick={() => openEdit(p)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="w-9 px-0" aria-label={`Duplicar ${p.descricao}`} onClick={() => openDuplicate(p)}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="w-9 px-0" aria-label={`${p.ativo ? 'Inativar' : 'Reativar'} ${p.descricao}`} onClick={() => handleInativar(p.id)}>
            <UserMinus className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="w-9 px-0" aria-label={`Excluir ${p.descricao}`} onClick={() => handleDelete(p.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const painel = selectedProduto ? (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="g-titulo-secao">{selectedProduto.descricao}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="g-meta text-muted-foreground tabular-nums">{selectedProduto.codigo ?? 'sem código'}</span>
          <SeloSituacao tom={selectedProduto.ativo ? 'sucesso' : 'neutro'}>
            {selectedProduto.ativo ? 'Ativo' : 'Inativo'}
          </SeloSituacao>
        </div>
      </div>

      <Tabs value={abaPainel} onValueChange={v => setAbaPainel(v as typeof abaPainel)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
        </TabsList>

        {/* Dados — o formulário em duas colunas, em leitura. Editar abre o
            cadastro completo; o painel não é um segundo formulário com os
            mesmos ids do que já existe. */}
        <TabsContent value="dados" className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <ListaDeCampos
              campos={[
                { rotulo: 'Código', valor: selectedProduto.codigo ?? '—', numerico: true },
                { rotulo: 'Unidade', valor: selectedProduto.unidade },
                {
                  rotulo: 'Família',
                  valor: selectedProduto.categoria ?? <SeloSituacao tom="neutro">Não informado</SeloSituacao>,
                },
                {
                  rotulo: 'NCM',
                  valor: selectedProduto.ncm ?? <SeloSituacao tom="neutro">Não informado</SeloSituacao>,
                  numerico: Boolean(selectedProduto.ncm),
                },
              ]}
            />
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Preço de venda',
                  valor: selectedProduto.preco_venda && selectedProduto.preco_venda > 0
                    ? `R$ ${fmtPreco(selectedProduto.preco_venda)}`
                    : <ValorIndisponivel razao="Preço não definido" />,
                  numerico: Boolean(selectedProduto.preco_venda),
                },
                {
                  rotulo: 'Custo médio',
                  valor: selectedProduto.preco_custo_medio > 0
                    ? `R$ ${fmtPreco(selectedProduto.preco_custo_medio)}`
                    : <ValorIndisponivel razao="Sem entrada custeada" />,
                  numerico: selectedProduto.preco_custo_medio > 0,
                },
                { rotulo: 'Saldo em estoque', valor: `${selectedProduto.saldo_atual} ${selectedProduto.unidade}`, numerico: true },
                { rotulo: 'CEST', valor: selectedProduto.cest ?? '—', numerico: Boolean(selectedProduto.cest) },
              ]}
            />
          </div>
          {selectedProduto.observacoes && (
            <BlocoDoPainel titulo="Observações">
              <p className="g-corpo whitespace-pre-wrap text-muted-foreground">{selectedProduto.observacoes}</p>
            </BlocoDoPainel>
          )}
          <Button onClick={() => openEdit(selectedProduto)} className="self-start">
            <Pencil className="w-4 h-4" /> Editar cadastro
          </Button>
        </TabsContent>

        {/* Fornecedores do produto, com o atalho para o cadastro da pessoa. */}
        <TabsContent value="fornecedores" className="mt-3 flex flex-col gap-3">
          {fornDoSelecionado.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Package />}
              titulo="Nenhum fornecedor vinculado"
              descricao="Vincule quem fornece este produto pelo cadastro, na aba Fornecedores."
              acao={<Button variant="outline" onClick={() => openEdit(selectedProduto)}><LinkIcon className="w-4 h-4" /> Vincular fornecedor</Button>}
            />
          ) : (
            <>
              {/* A referência traz os selos "Principal" e "Homologado" ao lado
                  de cada fornecedor. Eles NÃO existem no sistema:
                  `produto_fornecedores` guarda só empresa, produto e pessoa
                  (UNIQUE produto+pessoa) — nenhuma coluna diz qual é o
                  principal nem quem está homologado. Inventar o selo aqui
                  criaria um dado de demonstração com cara de informação
                  contratual, então o vínculo é mostrado pelo que ele é, e a
                  classificação aparece como não cadastrada. */}
              <p className="g-meta text-muted-foreground">
                {fornDoSelecionado.length} fornecedor(es) vinculado(s). A classificação entre principal e
                homologado ainda não é registrada neste cadastro.
              </p>
              <ul className="flex flex-col gap-2">
                {fornDoSelecionado.map(f => (
                  <li key={f.id} className="g-cartao flex flex-col gap-1.5 p-3">
                    <p className="g-corpo font-medium">{f.nome}</p>
                    {f.documento && <p className="g-meta text-muted-foreground tabular-nums">{f.documento}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <SeloSituacao tom="indisponivel" explicacao="O cadastro não registra fornecedor principal nem homologação.">
                        Classificação não cadastrada
                      </SeloSituacao>
                    </div>
                    {/* `/financeiro/pessoas` e não `?pessoa=<id>`: a subtela do
                        Financeiro é escolhida pelo CAMINHO (`/financeiro/:view`)
                        e não lê parâmetro de pessoa nenhum. Mandar um id que o
                        destino ignora é prometer um link profundo que não
                        existe. A rota também tem o mesmo portão desta tela
                        (só autenticação), então ninguém cai num bloqueio de
                        plano ao seguir o atalho. */}
                    <Button asChild variant="link" size="sm" className="h-auto justify-start p-0">
                      <RotaLink to="/financeiro/pessoas">
                        Abrir cadastro do fornecedor
                        <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                      </RotaLink>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        {/* Vínculos — as LINHAS por trás dos três números da seção abaixo da
            tabela. As caixas contam; aqui se vê o que foi contado. */}
        <TabsContent value="vinculos" className="mt-3 flex flex-col gap-4">
          {vinculos.carregando ? (
            <p role="status" className="g-corpo text-muted-foreground">Carregando vínculos…</p>
          ) : vinculos.erro ? (
            <p role="status" className="g-corpo text-warning-ink">Não foi possível consultar os vínculos deste produto.</p>
          ) : (
            <>
              <BlocoDoPainel titulo={`Itens de contrato (${vinculos.contratos.length})`}>
                {vinculos.contratos.length === 0 ? (
                  <p className="g-corpo text-muted-foreground">Não está em nenhum item de contrato.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {vinculos.contratos.slice(0, 8).map(c => (
                      <li key={c.id} className="g-corpo flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{c.descricao}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{c.quantidade_contratada} {c.unidade}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </BlocoDoPainel>

              <BlocoDoPainel titulo={`Pedidos (${pedidosDistintos})`}>
                {vinculos.pedidos.length === 0 ? (
                  <p className="g-corpo text-muted-foreground">Não entrou em nenhum pedido.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {vinculos.pedidos.slice(0, 8).map(p => (
                      <li key={p.id} className="g-corpo flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">
                          #{p.numero ?? '—'} · {p.tipo === 'compra' ? 'Compra' : 'Venda'}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{p.quantidade}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </BlocoDoPainel>

              <BlocoDoPainel titulo={`Estoque (${vinculos.movimentos.length})`}>
                {vinculos.movimentos.length === 0 ? (
                  <p className="g-corpo text-muted-foreground">Nenhuma movimentação registrada.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {vinculos.movimentos.slice(0, 8).map(m => (
                      <li key={m.id} className="g-corpo flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{fmtData(m.created_at)} · {m.tipo}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{m.quantidade}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </BlocoDoPainel>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  ) : null;

  /** Uma caixa da seção "Vínculos do produto". Contagem real ou "—". */
  const caixaVinculo = (
    rotulo: string,
    Icone: typeof FileText,
    valor: number | null,
    detalhe: string,
  ) => (
    <div className="g-cartao flex items-start gap-3 p-4">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--g-raio)] bg-muted text-muted-foreground">
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="g-meta text-muted-foreground">{rotulo}</p>
        <p className="text-xl font-bold leading-7 tabular-nums text-foreground">
          {valor === null ? <ValorIndisponivel razao="Consulta pendente" /> : valor}
        </p>
        <p className="g-meta text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );

  const semContagem = vinculos.carregando || vinculos.erro;

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputPlanilhaRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await lerArquivoPlanilha(f);
          e.target.value = '';
        }}
      />

      <BarraFiltros
        busca={search}
        aoBuscar={v => { setSearch(v); setPage(1); }}
        placeholderBusca="Buscar por descrição, código, NCM ou família…"
        filtrosAplicados={filtrosAplicados}
        aoLimpar={() => { setSearch(''); setSituacao('todos'); setPage(1); }}
        acao={
          <>
            <Button variant="outline" disabled={importando} onClick={() => inputPlanilhaRef.current?.click()}>
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar planilha
            </Button>
            <Button onClick={openNovo}>
              <Plus className="w-4 h-4" /> Incluir produto
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Label htmlFor="produtos-situacao" className="g-corpo text-muted-foreground whitespace-nowrap">Situação</Label>
          <Select value={situacao} onValueChange={v => { setSituacao(v as typeof situacao); setPage(1); }}>
            <SelectTrigger id="produtos-situacao" className="g-controle w-40 rounded-[var(--g-raio)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </BarraFiltros>

      <AreaComPainel
        painel={painel}
        tituloPainel={selectedProduto ? selectedProduto.descricao : 'Produto'}
        aoFechar={() => setSelected(null)}
      >
        <TabelaGestao
          descricao="Produtos cadastrados"
          colunas={colunas}
          itens={pageItems}
          chaveDoItem={p => p.id}
          carregando={loading}
          aoSelecionar={p => setSelected(prev => (prev === p.id ? null : p.id))}
          selecionado={p => p.id === selected}
          ordenacao={ordenacao}
          aoOrdenar={chave => setOrdenacao(o => ({
            chave,
            direcao: o.chave === chave && o.direcao === 'asc' ? 'desc' : 'asc',
          }))}
          vazio={
            <EstadoVazio
              icone={<Package />}
              titulo="Nenhum produto encontrado"
              descricao={filtrosAplicados > 0
                ? 'Ajuste a busca e os filtros para encontrar o produto.'
                : 'Cadastre o primeiro produto do catálogo ou importe uma planilha.'}
              acao={<Button onClick={openNovo}><Plus className="w-4 h-4" /> Incluir produto</Button>}
            />
          }
          rodape={
            <>
              <span className="tabular-nums">
                {filtered.length === 0
                  ? 'Nenhum registro'
                  : `${(curPage - 1) * PAGE_SIZE + 1}–${Math.min(curPage * PAGE_SIZE, filtered.length)} de ${filtered.length}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="w-9 px-0" aria-label="Primeira página" disabled={curPage <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" className="w-9 px-0" aria-label="Página anterior" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <span aria-current="page" className="rounded-[var(--g-raio)] bg-primary px-2 py-1 g-meta font-medium tabular-nums text-primary-foreground">{curPage}</span>
                <Button variant="ghost" size="sm" className="w-9 px-0" aria-label="Próxima página" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" className="w-9 px-0" aria-label="Última página" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-4 h-4" /></Button>
              </div>
            </>
          }
        />
      </AreaComPainel>

      {/* Vínculos do produto — só existe quando há produto selecionado: é o
          vínculo DELE, não um resumo do catálogo. */}
      {selectedProduto && (
        <SecaoGestao titulo="Vínculos do produto">
          <p className="g-corpo text-muted-foreground">
            Onde <strong>{selectedProduto.descricao}</strong> aparece no resto do sistema.
          </p>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            {caixaVinculo('Itens de contrato', FileText, semContagem ? null : vinculos.contratos.length, 'Itens de contrato que apontam para este produto')}
            {caixaVinculo('Pedidos', ShoppingCart, semContagem ? null : pedidosDistintos, 'Pedidos de compra e venda que o contêm')}
            {caixaVinculo('Estoque', Boxes, semContagem ? null : vinculos.movimentos.length, 'Movimentações de entrada e saída registradas')}
          </div>
        </SecaoGestao>
      )}

      {/* Prévia da importação — nada é gravado antes desta confirmação. */}
      <Dialog open={Boolean(previaImport)} onOpenChange={o => { if (!o) setPreviaImport(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar planilha de produtos</DialogTitle>
          </DialogHeader>
          {previaImport && (
            <>
              <p className="g-corpo text-muted-foreground">
                {previaImport.lidas} linha(s) lida(s). {previaImport.novas.length} produto(s) serão criados
                {previaImport.rejeitadas.length > 0 ? ` e ${previaImport.rejeitadas.length} linha(s) serão ignoradas.` : '.'}
              </p>
              {previaImport.rejeitadas.length > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--g-raio)] border border-border">
                  <table className="w-full g-corpo">
                    <caption className="sr-only">Linhas que não serão importadas</caption>
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th scope="col" className="g-meta px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">Linha</th>
                        <th scope="col" className="g-meta px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">Descrição</th>
                        <th scope="col" className="g-meta px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previaImport.rejeitadas.map(r => (
                        <tr key={`${r.linha}-${r.motivo}`} className="border-t border-border">
                          <td className="px-3 py-2 tabular-nums">{r.linha}</td>
                          <td className="px-3 py-2 truncate">{r.descricao || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-muted-foreground">{MOTIVO_LEGIVEL[r.motivo]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setPreviaImport(null)}>Cancelar</Button>
                <Button disabled={previaImport.novas.length === 0 || gravandoImport} onClick={confirmarImportacao}>
                  {gravandoImport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Importar {previaImport.novas.length} produto(s)
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default CadastroProdutos;
