// v2
import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Listas-padrão dos emissores (09/09) ─────────────────────────────────────
// Campos como "Número de Parcelas" e "Cenário Fiscal" eram INPUT LIVRE com
// lupa decorativa e placeholder prometendo uma lista que não existia. O
// padrão de mercado (emissores fiscais) é escolher da lista; digitar é a
// exceção — e o SelectPadrao abaixo dá as duas coisas sem perder valor
// herdado que esteja fora da lista.
const CONDICOES_PAGAMENTO = [
  'A Vista', '7 Dias', '10 Dias', '14 Dias', '15 Dias', '20 Dias', '21 Dias',
  '28 Dias', '30 Dias', '45 Dias', '60 Dias', '90 Dias',
  '2x (30/60)', '3x (30/60/90)', '4x (30/60/90/120)', '6x (mensais)',
  '10x (mensais)', '12x (mensais)',
] as const;

// Destilado da Tabela CFOP oficial (09/09): só o essencial da operação —
// revenda de mercadorias a órgãos públicos, dentro/fora do estado, ST,
// entrega futura (o par 5.922 simples faturamento + 5.117 entrega é o
// desenho fiscal do EMPENHO), bonificação, remessas e devoluções. Venda
// mostra CFOPs de SAÍDA (5/6); compra, os de ENTRADA (1/2). O escape
// "Outro (digitar)…" do seletor cobre qualquer código fora da lista.
const CENARIOS_FISCAIS_VENDA = [
  '5.102 — Venda de mercadoria adquirida de terceiros (dentro do estado)',
  '6.102 — Venda de mercadoria adquirida de terceiros (fora do estado)',
  '6.108 — Venda a não contribuinte de outro estado (órgão público)',
  '5.117 — Venda p/ entrega futura — encomenda (dentro do estado)',
  '5.922 — Simples faturamento de venda p/ entrega futura',
  '5.405 — Venda com ICMS ST, contribuinte substituído (dentro do estado)',
  '6.404 — Venda com ICMS ST já retido (fora do estado)',
  '5.101 — Venda de produção própria (dentro do estado)',
  '6.101 — Venda de produção própria (fora do estado)',
  '5.910 — Remessa em bonificação, doação ou brinde',
  '5.912 — Remessa de mercadoria p/ demonstração',
  '5.915 — Remessa p/ conserto ou reparo',
  '5.202 — Devolução de compra p/ comercialização (dentro do estado)',
  '6.202 — Devolução de compra p/ comercialização (fora do estado)',
  '5.949 — Outra saída não especificada',
] as const;

const CENARIOS_FISCAIS_COMPRA = [
  '1.102 — Compra p/ comercialização (dentro do estado)',
  '2.102 — Compra p/ comercialização (outro estado)',
  '1.403 — Compra p/ comercialização com ICMS ST (dentro do estado)',
  '2.403 — Compra p/ comercialização com ICMS ST (outro estado)',
  '1.556 — Compra de material de uso ou consumo (dentro do estado)',
  '2.556 — Compra de material de uso ou consumo (outro estado)',
  '1.551 — Compra de bem p/ ativo imobilizado (dentro do estado)',
  '1.910 — Entrada de bonificação, doação ou brinde',
  '1.202 — Devolução de venda de mercadoria (dentro do estado)',
  '2.202 — Devolução de venda de mercadoria (outro estado)',
  '1.949 — Outra entrada não especificada',
] as const;

const CATEGORIAS_VENDA = [
  'Clientes - Revenda de Mercadoria',
  'Clientes - Venda de Produção Própria',
  'Clientes - Prestação de Serviço',
  'Órgão Público - Fornecimento (licitação)',
  'Outras Receitas',
] as const;

const CATEGORIAS_COMPRA = [
  'Fornecedores - Mercadoria para Revenda',
  'Fornecedores - Insumos de Produção',
  'Fornecedores - Serviços',
  'Despesas Operacionais',
  'Outras Compras',
] as const;

const LOCAIS_ESTOQUE = ['PADRAO - Local de Estoque Padrão'] as const;

/** Lista padrão + escape para valor livre. Valor herdado fora da lista abre
 *  em modo digitação (nunca é apagado); "voltar à lista" limpa e reabre o
 *  seletor. */
function SelectPadrao({ valor, onChange, opcoes, placeholder, cfop }: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: readonly string[];
  placeholder?: string;
  /** Modo CFOP: no "Outro (digitar)", cada dígito afunila a tabela oficial
      completa ("5.1" → todos os 5.1xx; "5.10" → mais curto ainda). */
  cfop?: boolean;
}) {
  const foraDaLista = !!valor && !opcoes.includes(valor);
  const [livre, setLivre] = useState(foraDaLista);
  const [focado, setFocado] = useState(false);
  useEffect(() => { if (foraDaLista) setLivre(true); }, [foraDaLista]);
  if (livre) {
    const sugestoes = cfop && focado ? buscarCfop(valor) : [];
    return (
      <div className="relative">
        <div className="flex gap-1 mt-1">
          <Input value={valor} onChange={e => onChange(e.target.value)} className="text-sm"
            placeholder={cfop ? 'Digite o número (ex.: 5.1) ou parte da descrição…' : placeholder}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)} />
          <Button type="button" size="sm" variant="ghost" className="px-2 text-xs shrink-0" title="Voltar à lista padrão"
            onClick={() => { onChange(''); setLivre(false); }}>
            lista
          </Button>
        </div>
        {sugestoes.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {sugestoes.map(sug => (
              <button
                type="button"
                key={sug.codigo}
                className="flex w-full items-baseline gap-2 rounded-sm px-3 py-2 text-left text-xs transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:bg-muted"
                // onMouseDown + preventDefault: o clique vence o blur do input.
                onMouseDown={e => {
                  e.preventDefault();
                  onChange(`${formatarCfop(sug.codigo)} — ${sug.descricao}`);
                  setFocado(false);
                }}
              >
                <span className="font-mono font-semibold shrink-0 tabular-nums">{formatarCfop(sug.codigo)}</span>
                <span className="text-muted-foreground">{sug.descricao}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <Select value={valor || undefined} onValueChange={v => { if (v === '__outro__') setLivre(true); else onChange(v); }}>
      <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder={placeholder ?? 'Selecionar…'} /></SelectTrigger>
      <SelectContent className="max-h-72">
        {opcoes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="__outro__">Outro (digitar)…</SelectItem>
      </SelectContent>
    </Select>
  );
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import ListaDeCampos from '@/components/gestao/ListaDeCampos';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePessoas } from '@/hooks/useFinanceiro';
import { toast } from 'sonner';
import { formatarMoedaBr, mascaraMoedaBr, parseMoedaBr, parseQuantidade } from '@/lib/compras/numeros';
import CondicoesPagamento from './CondicoesPagamento';
import { buscarCfop, formatarCfop } from '@/data/cfop';
import {
  Plus, Search, MoreVertical, ShoppingCart, ShoppingBag, Pencil, Trash2,
  Loader2, X, Save, Printer, Copy, Check, Zap, Paperclip, Download,
  History, User, LayoutGrid, List,
  ChevronsUpDown, Filter, Link2,
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
// As cinco colunas do QUADRO DE PEDIDOS — e "quadro" é a palavra certa.
//
// Este quadro acompanha ATENDIMENTO E ENTREGA de pedidos de compra e venda:
// o pedido entra, o estoque é separado, fatura-se, e a mercadoria sai. Ele é
// coisa distinta do Kanban de licitações (`/kanban`), que acompanha o PROCESSO
// licitatório — outro objeto, outras etapas, outra tela. Chamar os dois de
// "kanban" na interface fazia a pessoa procurar o processo aqui dentro, então
// a palavra sumiu de tudo que aparece na tela. Nas variáveis de estado
// (`view`, `viewMode`) os valores antigos continuam, de propósito: são os dois
// eixos que a tela já tinha e renomeá-los é risco sem retorno visível.
//
// `cancelado` existe em STATUS_MSG e em STATUS_BADGE, mas NÃO é coluna: um
// pedido cancelado sai do fluxo, não vira uma sexta pilha para percorrer.
//
// Cada etapa tem cor própria (09/09): o quadro era cinza-sobre-cinza e as
// colunas de largura fixa deixavam um vão morto à direita — parecia
// transparente. No Design System v3 (19/09) a cor da etapa mora no PONTO ao
// lado do título da coluna — a mesma anatomia do Kanban de licitações —, e a
// coluna é a superfície rebaixada (`secondary`) com cartões brancos. Faturar
// e Entrega dividiam o mesmo verde depois que `accent` virou `primary`;
// Entrega fica no navy para o fluxo continuar legível de relance.
const COLUNAS_QUADRO: { key: Pedido['status']; label: string; ponto: string }[] = [
  { key: 'pedido',          label: 'Pedidos',         ponto: 'bg-info' },
  { key: 'separar_estoque', label: 'Separar Estoque', ponto: 'bg-warning' },
  { key: 'faturar',         label: 'Faturar',         ponto: 'bg-primary' },
  { key: 'faturado',        label: 'Faturado',        ponto: 'bg-success' },
  { key: 'entrega',         label: 'Entrega',         ponto: 'bg-navy' },
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
// Dinheiro e quantidade têm parsers DIFERENTES (lib/compras/numeros.ts): a
// quantidade vem do campo numérico com ponto decimal ("818.21"); lida pelo
// parser de dinheiro virava 81.821 e o total saía 3.109.198,00 (28/09/2026).
const fmtM = formatarMoedaBr;
const parseM = parseMoedaBr;
const parseQ = parseQuantidade;
const inputM = mascaraMoedaBr;
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
        <Button type="button" variant="outline" size="sm" className={value ? 'border-primary text-foreground' : 'text-muted-foreground font-normal'}>
          <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={d => {
            onChange(d ? d.toISOString().slice(0, 10) : '');
            setOpen(false);
          }}
          locale={{ localize: { day: n => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][n], month: n => ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][n] } } as unknown as React.ComponentProps<typeof Calendar>['locale']}
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
          className="pr-9"
          aria-label="Buscar pessoa"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-lg">
          {filtered.map(p => (
            <button type="button" key={p.id} className="w-full rounded-sm px-3 py-2 text-left transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:bg-muted"
              onClick={() => { onChange(p.id); setInputVal(p.nome); setQ(''); setOpen(false); }}>
              <div className="font-medium text-sm">{p.nome}</div>
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

  const valorTotal = parseQ(item.quantidade) * parseM(item.preco_unitario);

  function handleConfirm() {
    if (!item.descricao.trim()) { toast.error('Informe a descrição do item'); return; }
    onConfirm({ ...item, _key: item._key || crypto.randomUUID() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>
            {initial?.id ? 'Editar Item' : 'Incluir Item'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="space-y-2 border-b border-border px-5 py-3">
            <div className="relative">
              <Label htmlFor="item-busca-produto" className="sr-only">Buscar produto</Label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="item-busca-produto" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto por código ou descrição..." className="pl-9" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-background">
              {filtered.length === 0
                ? <EstadoVazio tamanho="compacto" titulo="Nenhum produto encontrado" descricao="Ajuste a busca ou cadastre o produto no catálogo." />
                : filtered.map(p => (
                  <button type="button" key={p.id}
                    aria-pressed={item.produto_id === p.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-tint focus-visible:outline-none focus-visible:bg-primary-tint border-b border-border last:border-0 transition-colors ${item.produto_id === p.id ? 'bg-primary-tint' : ''}`}
                    onClick={() => selectProd(p)}
                  >
                    <span className="font-medium text-foreground mr-2">{p.codigo ?? '—'}</span>
                    <span>{p.descricao}</span>
                    <span className="ml-2 text-muted-foreground">({p.unidade})</span>
                    {p.preco_venda != null && p.preco_venda > 0 && (
                      <span className="ml-2 text-success-ink font-medium tabular-nums">R$ {fmtM(p.preco_venda)}</span>
                    )}
                  </button>
                ))
              }
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="item-codigo">Código</Label>
                <Input id="item-codigo" value={item.codigo_produto} onChange={e => setItem(i => ({ ...i, codigo_produto: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unidade">Unidade</Label>
                <Input id="item-unidade" value={item.unidade} onChange={e => setItem(i => ({ ...i, unidade: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-descricao">Descrição do Produto *</Label>
              <Input id="item-descricao" value={item.descricao} onChange={e => setItem(i => ({ ...i, descricao: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-qtd">Quantidade</Label>
                <Input id="item-qtd" value={item.quantidade} onChange={e => setItem(i => ({ ...i, quantidade: e.target.value }))}
                  className="text-right tabular-nums" type="number" min="0" step="0.001" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-preco">Preço Unitário</Label>
                <Input id="item-preco" value={item.preco_unitario} onChange={e => setItem(i => ({ ...i, preco_unitario: inputM(e.target.value) }))}
                  className="text-right tabular-nums" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-total">Valor Total</Label>
                <Input id="item-total" value={fmtM(valorTotal)} readOnly className="bg-muted text-right tabular-nums text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label>Local de Estoque</Label>
              <SelectPadrao
                valor={item.local_estoque}
                onChange={v => setItem(i => ({ ...i, local_estoque: v }))}
                opcoes={LOCAIS_ESTOQUE}
                placeholder="Local de estoque…"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>
            {initial?.id ? 'Salvar' : 'Incluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
/**
 * O que a página de Compras pode disparar de fora. O registro
 * (`lib/navegacao/paginas.ts`) declara "Novo pedido" como a ação principal de
 * /gestao-compras — ela precisa nascer no CabecalhoPagina, não numa segunda
 * barra dentro da aba. Por isso o disparo do diálogo sobe por este punho.
 */
/** Origem do pedido como o seletor a conhece; sem valor, "sistema". */
const origemNormalizada = (v: string | null | undefined): string => v || 'sistema';

export interface PedidosDeCompraRef {
  novoPedido: () => void;
}

const PedidosDeCompra = forwardRef<PedidosDeCompraRef>(function PedidosDeCompra(_props, ref) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const { data: todasPessoas = [] } = usePessoas();

  const [pedidos, setPedidos]   = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<ProdutoCat[]>([]);
  const [contratos, setContratos] = useState<ContratoOpt[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  // Condições de pagamento vêm do CADASTRO da empresa (modelo dos ERPs);
  // a lista fixa vira só o fallback de quem ainda não cadastrou nada.
  const [condicoesCadastro, setCondicoesCadastro] = useState<string[]>([]);
  const [cadastroCondicoesAberto, setCadastroCondicoesAberto] = useState(false);
  // `as never` na tabela porque `financeiro_condicoes_pagamento` não está no
  // types.ts gerado; o resultado é estreitado na leitura, não com `any`.
  const carregarCondicoes = () => {
    if (!empresaAtiva) return;
    void (async () => {
      const { data } = await supabase
        .from('financeiro_condicoes_pagamento' as never)
        .select('descricao')
        .eq('empresa_id', empresaAtiva.id)
        .eq('ativo', true)
        .order('codigo');
      const linhas = (data ?? []) as unknown as Array<{ descricao: string }>;
      setCondicoesCadastro([...new Set(linhas.map(d => d.descricao))]);
    })();
  };
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
    carregarCondicoes();
    // Vendedor/comprador escolhe-se da EQUIPE, não se datilografa.
    supabase.from('empresa_membros').select('nome_individual, nome').eq('empresa_id', empresaAtiva.id)
      .then(({ data }) => {
        const nomes = [...new Set(((data as Array<{ nome_individual: string | null; nome: string | null }>) || [])
          .map(m => m.nome_individual || m.nome).filter(Boolean))] as string[];
        setVendedores(nomes.sort((a, b) => a.localeCompare(b)));
      });
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
    return (((data as Array<{ numero: number }> | null)?.[0]?.numero) ?? 0) + 1;
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
      projeto: p.projeto ?? '', origem_pedido: origemNormalizada(p.origem_pedido),
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
    const totalMerc = itens.reduce((s, i) => s + parseQ(i.quantidade) * parseM(i.preco_unitario), 0);
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
      toast.error(`Erro ao salvar pedido: ${(error as { message?: string } | null)?.message ?? 'verifique o console'}`);
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
            quantidade: parseQ(i.quantidade) || 1, preco_unitario: parseM(i.preco_unitario),
            valor_total: parseQ(i.quantidade) * parseM(i.preco_unitario),
            local_estoque: i.local_estoque || null,
          })) as never
        );
      }
    }

    // Sincroniza vínculo com contrato
    if (pedidoId) {
      if (form.contrato_id) {
        const cpDescricao = itens.map(i => i.descricao).join('; ').slice(0, 255) || `Pedido Nº ${numero}`;
        const cpQtd = itens.reduce((s, i) => s + (parseQ(i.quantidade) || 1), 0) || 1;
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
          }).eq('id', (existing as { id: string }).id);
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
          } as never);
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
      const qt = parseQ(i.quantidade);
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
        <button class="no-print" onclick="window.print()" style="padding:6px 16px;background:#fff;color:#111;border:1px solid #ddd;border-radius:6px;cursor:pointer">Imprimir</button>
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
            quantidade: parseQ(i.quantidade) || 1, preco_unitario: parseM(i.preco_unitario),
            valor_total: parseQ(i.quantidade) * parseM(i.preco_unitario),
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
      return { name: f.name, size: (f as { metadata?: { size?: number } }).metadata?.size ?? 0, url: urlData.publicUrl };
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
  const totalMerc  = itens.reduce((s, i) => s + parseQ(i.quantidade) * parseM(i.preco_unitario), 0);
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

  // Punho para o botão "Novo pedido" do CabecalhoPagina (setTipoOpen é estável).
  useImperativeHandle(ref, () => ({ novoPedido: () => setTipoOpen(true) }), []);

  const colunasDoQuadro = useMemo(() =>
    COLUNAS_QUADRO.map(col => ({
      ...col,
      items: filteredPedidos.filter(p => p.status === col.key),
    })), [filteredPedidos]
  );

  const selectedItemObj = itens.find(i => i._key === selectedItem);

  // ── Status badge variants (sempre com texto; a cor é reforço) ──────────
  const STATUS_BADGE: Record<string, 'info' | 'success' | 'danger'> = {
    pedido:          'info',
    separar_estoque: 'info',
    faturar:         'info',
    faturado:        'success',
    entrega:         'info',
    cancelado:       'danger',
  };

  // ── Delete Confirm Dialog ──────────────────────────────────────────────
  const DeleteConfirmDialog = (
    <Dialog open={!!deleteConfirmId} onOpenChange={v => { if (!v) { setDeleteConfirmId(null); setDeleteMotivo(''); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive-ink">
            <Trash2 className="h-5 w-5" aria-hidden="true" /> Excluir Pedido
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta ação também removerá o vínculo deste pedido dentro da <strong>Gestão de Contratos</strong>, caso exista.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pedido-delete-motivo">Motivo da exclusão <span className="text-destructive-ink">*</span></Label>
            <Textarea
              id="pedido-delete-motivo"
              className="resize-none"
              rows={3}
              placeholder="Descreva o motivo para excluir este pedido..."
              value={deleteMotivo}
              onChange={e => setDeleteMotivo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDeleteConfirmId(null); setDeleteMotivo(''); }}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmarDelete} disabled={deletingPedido || !deleteMotivo.trim()}>
            {deletingPedido ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── NF-e Alert Dialog ──────────────────────────────────────────────────
  const NfeAlertDialog = (
    <Dialog open={nfeAlertOpen} onOpenChange={setNfeAlertOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Faturar Pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ao mover para <strong>Faturado</strong>, o sistema pode emitir a NF-e automaticamente
            se houver um certificado A3 vinculado à conta.
          </p>
          <div role="status" className="flex items-start gap-2 rounded-md border border-warning-line bg-warning-tint p-4 text-sm text-warning-ink">
            <Zap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Nenhum certificado A3 vinculado. A NF-e <strong>não será emitida</strong> automaticamente.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setNfeAlertOpen(false); setPendingFaturarId(null); }}>
            Cancelar
          </Button>
          <Button
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
                  setFaturadoContas((contas ?? []) as Array<{ id: string; nome: string; tipo: string }>);
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
            <Zap aria-hidden="true" /> Faturar mesmo assim
          </Button>
        </DialogFooter>
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
          <DialogTitle>Lançar Conta a Receber</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pedido faturado com sucesso. Deseja registrar uma conta a receber no Financeiro?
          </p>
          {faturadoPedido && (
            <div className="space-y-1 rounded-md border border-border bg-secondary p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedido</span>
                <span className="font-medium tabular-nums">#{faturadoPedido.numero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {faturadoPedido.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="faturado-conta">Conta destino</Label>
            <Select value={faturadoContaId} onValueChange={setFaturadoContaId}>
              <SelectTrigger id="faturado-conta">
                <SelectValue placeholder="Selecione a conta bancária..." />
              </SelectTrigger>
              <SelectContent>
                {faturadoContas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="faturado-parcelas">Número de parcelas</Label>
            <Input
              id="faturado-parcelas"
              type="number" min="1" max="60"
              className="tabular-nums"
              value={faturadoParcelas}
              onChange={e => setFaturadoParcelas(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setFaturadoContaOpen(false); setPendingFaturarId(null); }}>
            Pular
          </Button>
          <Button disabled={!faturadoContaId || savingFaturado}
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
                    origem_job: 'PedidosDeCompra.faturado',
                    origem_usuario_id: user?.id ?? null,
                    origem_timestamp: new Date().toISOString(),
                    created_by: user?.id ?? null,
                  };
                });
                const { error } = await supabase.from('financeiro_lancamentos' as never).insert(inserts as never);
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
              ? <Loader2 className="animate-spin" aria-hidden="true" />
              : <Check aria-hidden="true" />}
            Gerar {parseInt(faturadoParcelas) > 1 ? `${faturadoParcelas} parcelas` : 'conta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Type selection dialog ───────────────────────────────────────────────
  const TypeDialog = (
    <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
          <DialogDescription>Selecione o tipo de pedido:</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => openNovo('compra')}
            className="h-auto flex-col gap-3 whitespace-normal rounded-lg p-5 hover:border-primary"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-tint text-primary"><ShoppingBag className="!size-5" aria-hidden="true" /></span>
            <span className="text-center">
              <span className="block text-sm font-semibold">Pedido de Compra</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Vincular fornecedor</span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => openNovo('venda')}
            className="h-auto flex-col gap-3 whitespace-normal rounded-lg p-5 hover:border-primary"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-tint text-primary"><ShoppingCart className="!size-5" aria-hidden="true" /></span>
            <span className="text-center">
              <span className="block text-sm font-semibold">Pedido de Venda</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Vincular cliente</span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Anexos Dialog ──────────────────────────────────────────────────────
  const AnexosDialog = (
    <Dialog open={anexosOpen} onOpenChange={setAnexosOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Anexos — Pedido Nº {editingNum}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{anexosList.length} arquivo(s)</span>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingAnexo}>
              {uploadingAnexo
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />}
              Adicionar arquivo
            </Button>
          </div>
          {anexosLoading ? (
            <div role="status" aria-busy="true" className="space-y-2">
              <span className="sr-only">Carregando</span>
              <Skeleton className="h-11 rounded-md" />
              <Skeleton className="h-11 rounded-md" />
            </div>
          ) : anexosList.length === 0 ? (
            <div className="rounded-md border border-dashed border-border">
              <EstadoVazio
                tamanho="compacto"
                icone={<Paperclip />}
                titulo="Nenhum arquivo anexado"
                descricao="Anexe a nota, o empenho ou o comprovante deste pedido."
              />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {anexosList.map(f => (
                <div key={f.name} className="flex items-center gap-2 p-3 rounded-md border border-border text-sm">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate font-medium">{f.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {f.size > 1024 * 1024
                      ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
                      : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                  </span>
                  <Button asChild size="icon-sm" variant="ghost">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`Baixar ${f.name}`}>
                      <Download aria-hidden="true" />
                    </a>
                  </Button>
                  <Button
                    size="icon-sm" variant="ghost-destructive" aria-label={`Remover ${f.name}`}
                    onClick={async () => {
                      const path = `${empresaAtiva!.id}/${editingId}/${f.name}`;
                      await supabase.storage.from('pedidos-anexos').remove([path]);
                      toast.success('Arquivo removido.');
                      await loadAnexos();
                    }}
                  >
                    <Trash2 aria-hidden="true" />
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
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Histórico — Pedido Nº {editingNum}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!historicoData ? (
            <div role="status" aria-busy="true" className="space-y-2">
              <span className="sr-only">Carregando</span>
              <Skeleton className="h-40 rounded-md" />
            </div>
          ) : (
            <>
              {/* Rótulo à esquerda, valor à direita — o `ListaDeCampos` dos
                  painéis de Gestão (Design System v3). */}
              <div className="rounded-md border border-border bg-secondary px-4 py-1">
                <ListaDeCampos
                  campos={[
                    { rotulo: 'Criado em',        valor: new Date(historicoData.created_at).toLocaleString('pt-BR') },
                    { rotulo: 'Última alteração', valor: new Date(historicoData.updated_at).toLocaleString('pt-BR') },
                    { rotulo: 'Status atual',     valor: STATUS_MSG[historicoData.status] ?? historicoData.status },
                    { rotulo: 'Tipo',             valor: historicoData.tipo === 'venda' ? 'Pedido de Venda' : 'Pedido de Compra' },
                    { rotulo: 'Origem',           valor: origemNormalizada(historicoData.origem_pedido) },
                    { rotulo: 'Etapa',            valor: historicoData.etapa ?? '—' },
                  ]}
                />
              </div>
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Registro detalhado de alterações requer configuração de auditoria no banco de dados.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── LISTA / QUADRO ──────────────────────────────────────────────────────
  // `view === 'kanban'` é o eixo "estou na lista de pedidos, não no
  // formulário". O valor do estado não mudou (é um dos dois eixos que a tela
  // já tinha); só a palavra que chega à pessoa mudou, para "Quadro".
  if (view === 'kanban') {
    const noQuadro = viewMode === 'kanban';

    // As colunas da LISTA. Mesma informação dos cartões do quadro — número,
    // tipo, quem, etapa, previsão e valor — só que enfileirada e comparável.
    const colunasDaLista: ColunaGestao<Pedido>[] = [
      {
        chave: 'numero', titulo: 'Nº', largura: '90px', prioridade: 'sempre',
        render: p => <span className="font-medium tabular-nums">#{p.numero}</span>,
      },
      {
        chave: 'tipo', titulo: 'Tipo', largura: '150px', prioridade: 'sempre',
        render: p => (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="info">{p.tipo === 'venda' ? 'Venda' : 'Compra'}</Badge>
            {p.contrato_id && <Badge variant="muted">Contrato</Badge>}
          </div>
        ),
      },
      {
        chave: 'pessoa', titulo: 'Cliente / Fornecedor', prioridade: 'sempre',
        render: p => {
          const nome = getPessoaNome(p.pessoa_id);
          return nome ? <span className="font-medium">{nome}</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        chave: 'status', titulo: 'Etapa', largura: '170px', prioridade: 'sempre',
        render: p => <Badge variant={STATUS_BADGE[p.status] ?? 'info'}>{STATUS_MSG[p.status]}</Badge>,
      },
      {
        chave: 'previsao', titulo: 'Previsão', largura: '160px', prioridade: 'desktop',
        render: p => {
          const isHoje = p.previsao_faturamento === todayISO();
          return (
            <span className={isHoje ? 'font-medium text-warning-ink' : 'text-muted-foreground'}>
              {p.previsao_faturamento ? fmtDateBR(p.previsao_faturamento) : '—'}
              {isHoje && <span className="g-meta ml-1">• hoje</span>}
            </span>
          );
        },
      },
      {
        chave: 'valor', titulo: 'Valor total', alinhamento: 'direita', largura: '150px', prioridade: 'sempre',
        render: p => <span className="font-semibold">R$ {fmtM(p.valor_total)}</span>,
      },
      {
        chave: 'acoes', titulo: 'Ações', alinhamento: 'direita', largura: '110px', prioridade: 'sempre',
        render: p => (
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar pedido ${p.numero}`} onClick={() => openEdit(p)}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost-destructive" size="icon-sm" aria-label={`Excluir pedido ${p.numero}`} onClick={() => handleDelete(p.id)}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ),
      },
    ];

    return (
      <div className="flex flex-col gap-4">
        {TypeDialog}
        {NfeAlertDialog}
        {FaturadoContaDialog}
        {AnexosDialog}
        {HistoricoDialog}
        {DeleteConfirmDialog}

        {/* Busca + alternância Lista/Quadro */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Label htmlFor="pedidos-busca" className="sr-only">Pesquisar pedidos</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="pedidos-busca"
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por número do pedido ou por cliente/fornecedor…"
              className="g-controle rounded-[var(--g-raio)] pl-9 pr-10"
            />
            {search && (
              <Button type="button" variant="ghost" size="sm" aria-label="Limpar busca"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* A alternância mostra o RÓTULO, não só o ícone: dois quadradinhos
              cinza não dizem qual é qual, e "quadro" é justamente a palavra
              que precisa aparecer para separar esta tela do Kanban de
              licitações. `aria-pressed` continua contando o estado a quem lê
              a tela por leitor de tela. */}
          {/* Alternância em `secondary` (tonal): o verde sólido fica para a
              única ação principal da tela, o "Novo pedido" do cabeçalho. */}
          <div role="group" aria-label="Modo de visualização dos pedidos" className="flex items-center gap-1 rounded-md border border-input bg-card p-1">
            <Button
              type="button" size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              className="h-8"
              aria-pressed={viewMode === 'list'}
              title="Ver os pedidos em lista"
              onClick={() => setViewMode('list')}
            >
              <List aria-hidden="true" /> Lista
            </Button>
            <Button
              type="button" size="sm" variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              className="h-8"
              aria-pressed={viewMode === 'kanban'}
              title="Ver os pedidos no quadro de atendimento e entrega"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid aria-hidden="true" /> Quadro
            </Button>
          </div>
          {/* "Novo pedido" não se repete aqui: é a ação principal declarada
              para /gestao-compras e mora no CabecalhoPagina da página. */}
        </div>

        {/* O que o quadro é — e o que ele NÃO é. Sem esta linha, "quadro com
            colunas" no mesmo sistema que tem um Kanban de processos leva a
            pessoa a procurar a licitação aqui dentro. */}
        {noQuadro && (
          <p className="g-corpo text-muted-foreground">
            <strong className="text-foreground">Quadro de pedidos</strong> — acompanha atendimento e
            entrega, do pedido até a saída da mercadoria. É diferente do{' '}
            <strong className="text-foreground">Kanban de licitações</strong>, que acompanha o processo
            licitatório em outra tela.
          </p>
        )}

        {/* Filtros + Somatório */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          {/* Filtro tipo */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="whitespace-nowrap text-sm text-muted-foreground">Tipo:</span>
            <div role="group" aria-label="Filtrar por tipo" className="flex items-center gap-1 rounded-md border border-input p-1">
              {([['', 'Todos'], ['compra', 'Compra'], ['venda', 'Venda']] as const).map(([val, lbl]) => (
                <Button key={val} type="button" size="sm" variant={tipoFilter === val ? 'secondary' : 'ghost'}
                  className="h-8"
                  aria-pressed={tipoFilter === val}
                  onClick={() => setTipoFilter(val)}>
                  {lbl}
                </Button>
              ))}
            </div>
          </div>

          {/* Filtro data */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap text-sm text-muted-foreground">Previsão:</span>
            <DatePickerBtn value={dateFrom} onChange={setDateFrom} placeholder="Data inicial" />
            <span className="text-sm text-muted-foreground">até</span>
            <DatePickerBtn value={dateTo} onChange={setDateTo} placeholder="Data final" />
            {(dateFrom || dateTo) && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Limpar período"
                onClick={() => { setDateFrom(''); setDateTo(''); }}>
                <X aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Somatórios */}
          <div className="ml-auto flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Compras:</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">R$ {fmtM(totalCompras)}</span>
            </div>
            <div className="w-px h-4 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Vendas:</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">R$ {fmtM(totalVendas)}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div role="status" aria-busy="true" className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <span className="sr-only">Carregando</span>
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
          </div>
        ) : viewMode === 'list' ? (
          /* ── LISTA ──
             A mesma coleção de pedidos do quadro, com as mesmas regras de
             filtro: `filteredPedidos` alimenta os dois, então alternar não
             muda o conjunto, só a forma de olhar para ele. */
          <TabelaGestao
            descricao="Pedidos de compra e venda"
            colunas={colunasDaLista}
            itens={filteredPedidos}
            chaveDoItem={p => p.id}
            aoSelecionar={p => openEdit(p)}
            vazio={
              <EstadoVazio
                icone={<ShoppingCart />}
                titulo="Nenhum pedido encontrado"
                descricao="Ajuste a busca e os filtros, ou crie o primeiro pedido."
                acao={<Button onClick={() => setTipoOpen(true)}><Plus className="w-4 h-4" /> Novo pedido</Button>}
              />
            }
            rodape={
              <span className="tabular-nums">
                {filteredPedidos.length === 0
                  ? 'Nenhum registro'
                  : `${filteredPedidos.length} pedido${filteredPedidos.length !== 1 ? 's' : ''}`}
              </span>
            }
          />
        ) : (
          /* ── QUADRO ──
             Colunas de no mínimo 260px com rolagem horizontal LOCAL: o padrão
             proíbe comprimir coluna para caber, e a rolagem fica presa a este
             contêiner — a página inteira nunca rola de lado. */
          <div
            role="group"
            aria-label="Quadro de pedidos: atendimento e entrega"
            className="relative flex gap-3 overflow-x-auto pb-2 min-h-[calc(100vh-320px)]"
          >
            {/* Ghost card shown while dragging */}
            {draggingId && ghostPos && (() => {
              const dp = pedidos.find(x => x.id === draggingId);
              return dp ? (
                <div
                  style={{ position: 'fixed', left: ghostPos.x + 12, top: ghostPos.y + 8, zIndex: 9999, pointerEvents: 'none', width: 210 }}
                  className="rotate-1 rounded-md border border-primary/60 bg-card p-3 opacity-95 shadow-lg"
                >
                  <p className="text-xs font-semibold text-muted-foreground">Pedido Nº {dp.numero}</p>
                  {getPessoaNome(dp.pessoa_id) && <p className="mt-1 truncate text-xs font-medium">{getPessoaNome(dp.pessoa_id)}</p>}
                  <p className="mt-1 text-xs font-semibold tabular-nums">R$ {fmtM(dp.valor_total)}</p>
                </div>
              ) : null;
            })()}

            {colunasDoQuadro.map((col, colIdx) => (
              <div key={col.key}
                data-col={col.key}
                // Coluna do Design System v3: superfície rebaixada com um fio
                // fino; a cor da etapa fica no ponto ao lado do título.
                className={`flex flex-1 flex-col min-w-[260px] overflow-hidden rounded-lg border transition-colors duration-150 ${draggingId && dragOverCol === col.key ? 'border-primary bg-primary-tint ring-2 ring-ring' : 'border-border/70 bg-secondary'}`}
              >
                <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${col.ponto}`} aria-hidden="true" />
                  <h3 className="text-sm font-semibold leading-5 text-foreground">{col.label}</h3>
                  <Badge variant="muted" className="ml-auto tabular-nums">
                    {col.items.length}
                    <span className="sr-only"> pedido(s) em {col.label}</span>
                  </Badge>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-2">
                  {col.items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-input py-6 text-center g-meta text-muted-foreground">
                      Nenhum pedido nesta etapa
                    </div>
                  ) : col.items.map(p => {
                    const pessoaNome = getPessoaNome(p.pessoa_id);
                    const isHoje = p.previsao_faturamento === todayISO();
                    const statusMsg = isHoje ? 'Previsto para hoje' : STATUS_MSG[p.status];
                    const menuOpen = kanbanMenu === p.id;

                    return (
                      <div key={p.id}
                        onPointerDown={e => { if (!(e.target as HTMLElement).closest('button')) startDrag(e, p.id); }}
                        onDoubleClick={() => { if (!draggingId) openEdit(p); }}
                        className={`rounded-md border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md select-none touch-none ${draggingId === p.id ? 'opacity-40 scale-95 cursor-grabbing' : 'cursor-grab'}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                Pedido Nº {p.numero}
                              </span>
                              <Badge variant={p.tipo === 'venda' ? 'success' : 'info'}>
                                {p.tipo === 'venda' ? 'Venda' : 'Compra'}
                              </Badge>
                              {p.contrato_id && (
                                <Badge variant="muted">
                                  Contrato
                                </Badge>
                              )}
                            </div>
                            {pessoaNome && (
                              <p className="mt-1 truncate text-sm font-medium leading-5 text-foreground">{pessoaNome}</p>
                            )}
                            <p className={`mt-1 text-xs ${isHoje ? 'font-semibold text-warning-ink' : 'text-muted-foreground'}`}>{statusMsg}</p>
                            <p className="mt-2 text-base font-semibold tabular-nums text-foreground">
                              R$ {fmtM(p.valor_total)}
                              {/* Condição como está escrita — "em 30 Diasx" era o
                                  sufixo cego de quando o campo só guardava número. */}
                              {p.numero_parcelas && p.numero_parcelas !== 'A Vista' && (
                                <span className="text-xs text-muted-foreground font-normal"> · {p.numero_parcelas}</span>
                              )}
                            </p>
                          </div>
                          <Button
                            type="button" variant="ghost" size="icon-sm" className="shrink-0"
                            aria-label={`Ações do pedido ${p.numero}`}
                            aria-expanded={menuOpen}
                            onClick={e => {
                              e.stopPropagation();
                              setKanbanMenu(menuOpen ? null : p.id);
                            }}
                          >
                            <MoreVertical aria-hidden="true" />
                          </Button>
                        </div>
                        {menuOpen && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                            <Button type="button" variant="ghost" size="sm" className="w-full justify-start font-normal"
                              onClick={() => { setKanbanMenu(null); openEdit(p); }}
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Editar
                            </Button>
                            {COLUNAS_QUADRO.filter(s => s.key !== p.status).map(s => (
                              <Button key={s.key} type="button" variant="ghost" size="sm" className="w-full justify-start font-normal"
                                onClick={async () => {
                                  setKanbanMenu(null);
                                  if (s.key === 'faturado') { setPendingFaturarId(p.id); setNfeAlertOpen(true); }
                                  else await updatePedidoStatus(p.id, s.key);
                                }}
                              >
                                <ChevronsUpDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Mover → {s.label}
                              </Button>
                            ))}
                            <Button type="button" variant="ghost-destructive" size="sm" className="w-full justify-start font-normal"
                              onClick={() => handleDelete(p.id)}
                            >
                              <Trash2 aria-hidden="true" /> Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé da coluna.
                    Aqui moravam "Faturar Todos" e "Comunicar com a SEFAZ":
                    dois botões sem `onClick`, sem função por trás e sem
                    integração com a SEFAZ em lugar nenhum do sistema. Botão
                    que não faz nada é pior que botão ausente — quem clica
                    acredita ter faturado. Sobrou o único que sempre funcionou.
                    Faturamento em lote volta quando existir de verdade; hoje
                    se fatura pelo cartão ou pelo formulário do pedido. */}
                <div className="border-t border-border/70 px-3 py-2">
                  {colIdx === 0 ? (
                    <Button type="button" size="sm" className="w-full" onClick={() => setTipoOpen(true)}>
                      <Plus aria-hidden="true" /> Novo Pedido
                    </Button>
                  ) : (
                    <div className="h-9" aria-hidden="true" />
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
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {TypeDialog}
      {NfeAlertDialog}
      {FaturadoContaDialog}
      {AnexosDialog}
      {HistoricoDialog}
      {DeleteConfirmDialog}
      <CondicoesPagamento
        aberto={cadastroCondicoesAberto}
        aoFechar={() => setCadastroCondicoesAberto(false)}
        aoMudar={carregarCondicoes}
      />
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-semibold leading-6 text-foreground">{formTitle}</h2>
        </div>

        {/* Status changer — só exibe ao editar um pedido existente */}
        {editingId && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">Coluna atual:</span>
            <Badge variant={STATUS_BADGE[editingStatus] ?? 'info'}>
              {STATUS_MSG[editingStatus]}
            </Badge>
            <span className="text-muted-foreground" aria-hidden="true">→</span>
            <span className="text-muted-foreground whitespace-nowrap">Mover para:</span>
            <div className="flex flex-wrap items-center gap-1">
              {COLUNAS_QUADRO.filter(s => s.key !== editingStatus).map(s => (
                <Button
                  key={s.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (s.key === 'faturado') {
                      setPendingFaturarId(editingId);
                      setNfeAlertOpen(true);
                    } else {
                      await updatePedidoStatus(editingId, s.key);
                      setEditingStatus(s.key);
                    }
                  }}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Button type="button" variant="ghost" size="sm" onClick={closeForm} className="shrink-0">
          Fechar <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left: form */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {/* Top section */}
          <div className="p-4 border-b border-border space-y-4">
            {/* Pessoa + date */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground sm:flex" aria-hidden="true">
                <User className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>{isVenda ? 'Cliente' : 'Fornecedor'}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <PessoaCombobox
                    pessoas={pessoasParaTipo}
                    value={form.pessoa_id}
                    onChange={id => setForm(f => ({ ...f, pessoa_id: id }))}
                  />
                  {isVenda && (
                    // Sem ação por trás ainda: fica como nota, não como link —
                    // texto em cor de ação com sublinhado no hover prometia um
                    // clique que não existe.
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Consulta de crédito em breve
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 space-y-1.5">
                <Label htmlFor="pedido-previsao">Previsão de Faturamento</Label>
                <Input
                  id="pedido-previsao"
                  type="date"
                  value={form.previsao_faturamento}
                  onChange={e => setForm(f => ({ ...f, previsao_faturamento: e.target.value }))}
                  className="w-full sm:w-44"
                />
              </div>
            </div>

            {/* Vínculo com Contrato (opcional) */}
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">Contrato vinculado:</span>
              {form.contrato_id ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {contratos.find(c => c.id === form.contrato_id)?.numero_contrato ?? '—'}
                    {contratos.find(c => c.id === form.contrato_id)?.orgao_contratante
                      ? ` · ${contratos.find(c => c.id === form.contrato_id)!.orgao_contratante}`
                      : ''}
                  </span>
                  <Button
                    type="button" variant="ghost" size="icon-sm" className="shrink-0"
                    onClick={() => setForm(f => ({ ...f, contrato_id: '' }))}
                    aria-label="Remover vínculo com contrato"
                    title="Remover vínculo"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Select value="" onValueChange={v => setForm(f => ({ ...f, contrato_id: v }))}>
                  <SelectTrigger className="max-w-sm flex-1" aria-label="Vincular a contrato">
                    <SelectValue placeholder="Nenhum — selecione para vincular (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratos.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum contrato cadastrado</div>
                    ) : contratos.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero_contrato}{c.orgao_contratante ? ` — ${c.orgao_contratante}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {([
                { label: 'Total de Mercadorias',   val: fmtM(totalMerc),   editable: false },
                { label: 'Valor do Desconto',       val: null,              editable: true  },
                { label: 'Total de IPI',            val: '0,00',            editable: false },
                { label: 'Total de ICMS ST',        val: '0,00',            editable: false },
                { label: 'Valor Total do Pedido',   val: fmtM(valorTotal),  editable: false },
              ] as const).map(t => (
                <div key={t.label} className="space-y-1.5">
                  <Label className="leading-tight">{t.label}</Label>
                  {t.editable ? (
                    <Input
                      aria-label={t.label}
                      value={form.valor_desconto}
                      onChange={e => setForm(f => ({ ...f, valor_desconto: inputM(e.target.value) }))}
                      className="text-right tabular-nums" inputMode="numeric"
                    />
                  ) : (
                    <Input aria-label={t.label} value={t.val!} readOnly className="bg-muted text-right tabular-nums text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>

            {/* Vendedor / Parcelas / Cenário */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>{isVenda ? 'Vendedor' : 'Comprador'}</Label>
                <SelectPadrao
                  valor={form.vendedor}
                  onChange={v => setForm(f => ({ ...f, vendedor: v }))}
                  opcoes={vendedores}
                  placeholder="Escolher da equipe…"
                />
              </div>
              <div>
                <Label>
                  Condição de Pagamento{' '}
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm font-normal" onClick={() => setCadastroCondicoesAberto(true)}>
                    (cadastro)
                  </Button>
                </Label>
                <SelectPadrao
                  valor={form.numero_parcelas}
                  onChange={v => setForm(f => ({ ...f, numero_parcelas: v }))}
                  opcoes={condicoesCadastro.length ? condicoesCadastro : CONDICOES_PAGAMENTO}
                  placeholder="A VISTA, BOLETO 30 DIAS…"
                />
              </div>
              <div>
                <Label>Cenário Fiscal</Label>
                <SelectPadrao
                  valor={form.cenario_fiscal}
                  onChange={v => setForm(f => ({ ...f, cenario_fiscal: v }))}
                  opcoes={isVenda ? CENARIOS_FISCAIS_VENDA : CENARIOS_FISCAIS_COMPRA}
                  placeholder="Escolher o cenário (CFOP)…"
                  cfop
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="itens">
            {/* Fila sublinhada da ui, rolável de lado quando as sete abas não
                cabem — sem embrulhar numa segunda linha sem filete. */}
            <div className="px-4 pt-3">
            <TabsList className="flex-nowrap overflow-x-auto">
              {[
                { value: 'itens',        label: `Itens da ${isVenda ? 'Venda' : 'Compra'}` },
                { value: 'departamentos', label: 'Departamentos'          },
                { value: 'frete',        label: 'Frete e Outras Despesas' },
                { value: 'adicional',    label: 'Informações Adicionais'  },
                { value: 'parcelas',     label: 'Parcelas'                },
                { value: 'obs',          label: 'Observações'             },
                { value: 'email',        label: `E-mail para o ${isVenda ? 'Cliente' : 'Fornecedor'}` },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            </div>

            {/* Itens */}
            <TabsContent value="itens" className="m-0 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm"
                  onClick={() => { setEditingItem(undefined); setItemDialogOpen(true); }}>
                  <Plus aria-hidden="true" /> Novo Item
                </Button>
                <Button size="sm" variant="outline" disabled={!selectedItem}
                  onClick={() => { setEditingItem(selectedItemObj); setItemDialogOpen(true); }}>
                  <Pencil aria-hidden="true" /> Editar Item
                </Button>
                <Button size="sm" variant="ghost-destructive"
                  disabled={!selectedItem}
                  onClick={() => selectedItem && removeItem(selectedItem)}>
                  <Trash2 aria-hidden="true" /> Excluir Item
                </Button>
              </div>

              {/* Tabela do Design System (`ui/table`): cabeçalho em superfície
                  rebaixada, rótulos 12/600, linhas de 48px, números à direita
                  com dígitos tabulares e a rolagem presa ao contêiner. */}
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-24">Produto</TableHead>
                      <TableHead>Descrição do Produto</TableHead>
                      <TableHead className="w-24 text-center">Quantidade</TableHead>
                      <TableHead>Local de Estoque</TableHead>
                      <TableHead className="w-28 text-right">Preço Unitário</TableHead>
                      <TableHead className="w-24 text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <EstadoVazio
                            tamanho="compacto"
                            titulo="Nenhum item no pedido"
                            descricao="Use “Novo Item” para incluir produtos do catálogo."
                          />
                        </TableCell>
                      </TableRow>
                    ) : itens.map(item => {
                      const vt = parseQ(item.quantidade) * parseM(item.preco_unitario);
                      const isSel = selectedItem === item._key;
                      return (
                        <TableRow key={item._key}
                          aria-selected={isSel}
                          data-state={isSel ? 'selected' : undefined}
                          className={`cursor-pointer ${isSel ? 'border-l-2 border-l-primary bg-primary-tint' : ''}`}
                          onClick={() => setSelectedItem(isSel ? null : item._key)}
                          onDoubleClick={() => { setEditingItem(item); setItemDialogOpen(true); }}
                        >
                          <TableCell nowrap className="font-medium text-foreground">{item.codigo_produto || '—'}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell nowrap className="text-center tabular-nums">{item.quantidade} {item.unidade}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.local_estoque}</TableCell>
                          <TableCell nowrap className="text-right tabular-nums">{item.preco_unitario}</TableCell>
                          <TableCell nowrap className="text-right font-medium tabular-nums">{fmtM(vt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="border-t border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  {itens.length === 0
                    ? 'Nenhum registro encontrado'
                    : `1 - ${itens.length} de ${itens.length} registro${itens.length !== 1 ? 's' : ''}`}
                </div>
              </div>
            </TabsContent>

            {/* Departamentos */}
            <TabsContent value="departamentos" className="p-4 m-0">
              <EstadoVazio tamanho="compacto" titulo="Rateio por departamentos" descricao="Em breve — ainda não é possível ratear este pedido." />
            </TabsContent>

            {/* Frete */}
            <TabsContent value="frete" className="p-4 m-0">
              <EstadoVazio tamanho="compacto" titulo="Frete e outras despesas" descricao="Em breve — ainda não é possível lançar frete neste pedido." />
            </TabsContent>

            {/* Informações Adicionais */}
            <TabsContent value="adicional" className="m-0 space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Categoria</Label>
                  <SelectPadrao
                    valor={form.categoria}
                    onChange={v => setForm(f => ({ ...f, categoria: v }))}
                    opcoes={isVenda ? CATEGORIAS_VENDA : CATEGORIAS_COMPRA}
                    placeholder="Escolher categoria…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pedido-conta-corrente">Conta Corrente</Label>
                  <Input id="pedido-conta-corrente" value={form.conta_corrente} onChange={e => setForm(f => ({ ...f, conta_corrente: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pedido-etapa">Etapa</Label>
                  <Input id="pedido-etapa" value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pedido-num-cliente">Nº do Pedido do Cliente</Label>
                  <Input id="pedido-num-cliente" value={form.num_pedido_cliente} onChange={e => setForm(f => ({ ...f, num_pedido_cliente: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pedido-num-contrato">Nº do Contrato de Venda</Label>
                  <Input id="pedido-num-contrato" value={form.num_contrato_venda} onChange={e => setForm(f => ({ ...f, num_contrato_venda: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pedido-contato">Contato</Label>
                  <Input id="pedido-contato" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pedido-projeto">Projeto +</Label>
                  <Input id="pedido-projeto" value={form.projeto} onChange={e => setForm(f => ({ ...f, projeto: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pedido-origem">Origem do Pedido</Label>
                <Select value={form.origem_pedido} onValueChange={v => setForm(f => ({ ...f, origem_pedido: v }))}>
                  <SelectTrigger id="pedido-origem" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sistema">Sistema</SelectItem>
                    <SelectItem value="outro_sistema">Outro sistema</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pedido-dados-nfe">Dados Adicionais para a Nota Fiscal</Label>
                <Textarea
                  id="pedido-dados-nfe"
                  value={form.dados_adicionais_nfe}
                  onChange={e => setForm(f => ({ ...f, dados_adicionais_nfe: e.target.value }))}
                  className="min-h-20 resize-none"
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
            <TabsContent value="parcelas" className="m-0 p-4">
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Forma de Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valorTotal > 0 ? (
                      <TableRow>
                        <TableCell nowrap className="tabular-nums">1/1</TableCell>
                        <TableCell nowrap className="tabular-nums">{fmtDateBR(form.previsao_faturamento)}</TableCell>
                        <TableCell nowrap className="text-right font-medium tabular-nums">R$ {fmtM(valorTotal)}</TableCell>
                        <TableCell className="text-muted-foreground">{form.numero_parcelas}</TableCell>
                      </TableRow>
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="p-0">
                          <EstadoVazio
                            tamanho="compacto"
                            titulo="Nenhum dado de parcelas"
                            descricao="As parcelas aparecem depois que o pedido tem valor."
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Observações */}
            <TabsContent value="obs" className="m-0 space-y-1.5 p-4">
              <Label htmlFor="pedido-observacoes">Observações</Label>
              <Textarea
                id="pedido-observacoes"
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                className="min-h-40 resize-none"
                placeholder="Observações gerais do pedido..."
              />
            </TabsContent>

            {/* E-mail */}
            <TabsContent value="email" className="m-0 space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="pedido-emails">Utilizar os seguintes endereços de e-mail</Label>
                <Textarea
                  id="pedido-emails"
                  value={form.email_destinatario}
                  onChange={e => setForm(f => ({ ...f, email_destinatario: e.target.value }))}
                  className="min-h-20 resize-none"
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
              <Alert variant="warning">
                <AlertDescription>
                  Apenas o DANFE e o XML da NF-e serão enviados por meio do Portal para o cliente
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          {/* Bottom status bar */}
          <div className="shrink-0 border-t border-border bg-secondary px-4 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
              {form.previsao_faturamento
                ? `Previsão de faturamento: ${fmtDateBR(form.previsao_faturamento)}`
                : 'Sem previsão definida'}
            </p>
          </div>
        </div>

        {/* Right panel — coluna no desktop, barra de ações embrulhada no celular */}
        <div className="w-full md:w-44 border-t md:border-t-0 md:border-l border-border bg-card shrink-0 overflow-y-auto">
          <div className="p-2 flex flex-wrap md:flex-col gap-1">
            {rightActions.map(({ label, icon: Icon, action, disabled, loading }) => (
              <Button key={label} type="button" variant="ghost" size="sm" onClick={action} disabled={disabled || loading}
                className="md:w-full justify-start font-normal"
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{label}</span>
                {loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
            ))}
            {editingId && (
              <>
                <div className="hidden md:block border-t border-border my-1" aria-hidden="true" />
                <Button
                  type="button" variant="ghost-destructive" size="sm"
                  onClick={() => handleDelete(editingId)}
                  className="md:w-full justify-start font-normal"
                >
                  <Trash2 className="shrink-0" aria-hidden="true" />
                  <span>Excluir</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PedidosDeCompra.displayName = 'PedidosDeCompra';

export default PedidosDeCompra;
