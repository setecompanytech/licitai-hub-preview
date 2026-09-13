import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProdutosOmie from '@/components/gestao-compras/ProdutosOmie';
import PedidosOmie, { type PedidosOmieRef } from '@/components/gestao-compras/PedidosOmie';
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { parseNFeXML, type NFeData, type NFeItemData } from '@/lib/parseNFe';
import { STATUS_QUE_RESERVAM } from '@/lib/estoque/reserva';
import { fichaDaMercadoria, completarFicha, type FichaDaMercadoria } from '@/lib/fiscal/entrada-para-saida';
import {
  sugerirFinalidade, avaliarCreditoIcms, ROTULO_FINALIDADE, DESCRICAO_FINALIDADE,
  type FinalidadeDaEntrada,
} from '@/lib/fiscal/credito-icms';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { trilhaDaRota } from '@/lib/navegacao/paginas';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import AbasGestao from '@/components/gestao/AbasGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { AvisoDeContexto, ValorIndisponivel, type TomSituacao } from '@/components/gestao/SeloSituacao';
import { Skeleton } from '@/components/ui/skeleton';
import { analisarParaMargem, precificarEntrada, situacaoDoPrecoContratado, type AnaliseMargemEmpresa } from '@/lib/financeiro/margem-sugerida';
import {
  ShoppingCart, Plus, Trash2, ArrowLeft, Loader2,
  Building2, Calendar, DollarSign, AlertTriangle, CheckCircle2,
  Clock, Package, Truck, Users, X, Pencil, FileText,
  Warehouse, TrendingUp, TrendingDown, Upload, RotateCcw, AlertCircle, ShieldCheck, PackagePlus,
  Download, History, Boxes,
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

// `contrato_itens.produto_id` existe no banco desde a migration administrativa
// de 24/08, mas nunca entrou no types.ts gerado. Esta é a forma mínima do
// construtor de consulta que a apuração de reserva usa — evita `any` sem
// fingir que o tipo gerado conhece a coluna.
type ConsultaSemTipoGerado = {
  select: (colunas: string) => {
    not: (coluna: string, operador: string, valor: null) => PromiseLike<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
};

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
// DOIS SISTEMAS DE PEDIDO CONVIVEM NESTE MÓDULO — leia antes de mexer.
//
//  · VIVO — `pedidos` / `pedido_itens`, na aba Pedidos (PedidosOmie). Tem
//    `tipo: 'venda' | 'compra'`, portanto cobre os dois lados, e é lido por
//    `FinPedidosAFaturar` (faturamento) e por `ContratoPedidos` (kanban do
//    contrato). É o sistema que o resto do app enxerga.
//
//  · LEGADO — `pedidos_compra` / `itens_pedido_compra`, cujo formulário mora
//    NESTA página. Fora daqui, nenhuma tela o lê. Não dá para apagar por
//    conta própria: `nfe_entradas.pedido_id` e `estoque_movimentos.pedido_id`
//    têm chave estrangeira APONTANDO PARA ELE, então o vínculo NF-e ↔ pedido
//    e a rastreabilidade das entradas dependem da tabela existir — e pode
//    haver dados de cliente nela. A migração para o sistema vivo exige mexer
//    nessas duas FKs, o que é decisão do dono do produto.
//
// O que mudou aqui: o botão "Novo pedido" do cabeçalho passa a existir só na
// aba Pedidos e a apontar para o sistema VIVO. O formulário legado, que antes
// aparecia como um segundo "Novo pedido" idêntico na aba Certificado (o ramo
// `else` da cadeia), ficou com uma porta só, na aba NF-e, chamada "Pedido ao
// fornecedor" — que é onde o registro dele é de fato consumido.
// ═══════════════════════════════════════════════════════════════
export default function GestaoCompras() {
  // A aba Pedidos tem a sua ação principal no CabecalhoPagina; quem abre o
  // formulário é o próprio PedidosOmie, por esta referência.
  const pedidosRef = useRef<PedidosOmieRef>(null);
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  // ── State: listas ─────────────────────────────────────────────
  const [pedidos,      setPedidos]      = useState<PedidoCompra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contratos,    setContratos]    = useState<Contrato[]>([]);
  const [produtos,     setProdutos]     = useState<Produto[]>([]);
  const [nfes,         setNfes]         = useState<NfeRecebida[]>([]);
  const [nfesComEstoque, setNfesComEstoque] = useState<Set<string>>(new Set());
  // Quando a primeira movimentação daquela NF-e entrou — só para o Histórico.
  const [nfeEstoqueEm, setNfeEstoqueEm] = useState<Map<string, string>>(new Map());
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
  // A aba mora em `?aba=`: com `useState` ela voltava para "Pedidos" a cada F5
  // e a cada retorno pelo botão Voltar do navegador. É o mesmo hook que
  // Contratos usa — a divergência entre as duas telas estava registrada no
  // inventário e se resolve aqui.
  const [mainTab,         setMainTab]         = useAbaNaUrl('pedidos');
  const [selectedPedido,  setSelectedPedido]  = useState<PedidoCompra | null>(null);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [selectedNfe,     setSelectedNfe]     = useState<NfeRecebida | null>(null);
  const [selectedForn,    setSelectedForn]    = useState<Pessoa | null>(null);
  const [itensPedido,     setItensPedido]     = useState<ItemPedido[]>([]);
  const [movimentos,      setMovimentos]      = useState<EstoqueMovimento[]>([]);
  // Subabas dos painéis laterais (composição exigida pelas referências).
  const [abaProduto,      setAbaProduto]      = useState<'movimentacoes' | 'vinculos'>('movimentacoes');
  const [abaNfe,          setAbaNfe]          = useState<'resumo' | 'itens' | 'arquivos' | 'historico'>('resumo');
  // Pedido novo pedido depois de trocar de aba: PedidosOmie só existe quando a
  // aba "Pedidos" está montada, então a chamada espera o commit do React.
  const [novoPedidoAoEntrar, setNovoPedidoAoEntrar] = useState(false);
  const [pularOnboarding, setPularOnboarding] = useState(false);

  // ── State: filtros ────────────────────────────────────────────
  const [fornSearch,    setFornSearch]   = useState('');
  const [estoqSearch,   setEstoqSearch]  = useState('');
  const [estoqSituacao, setEstoqSituacao] = useState('todas');
  const [nfeSearch,     setNfeSearch]    = useState('');
  const [nfeDe,         setNfeDe]        = useState('');
  const [nfeAte,        setNfeAte]       = useState('');
  const [nfeSituacao,   setNfeSituacao]  = useState('todas');

  // ── State: confirmação de exclusão ────────────────────────────
  // Apagar sem perguntar era o comportamento de pedido e fornecedor: um clique
  // em cima do ícone errado levava o registro embora sem volta.
  const [pedidoAExcluir, setPedidoAExcluir] = useState<PedidoCompra | null>(null);
  const [fornAExcluir,   setFornAExcluir]   = useState<Pessoa | null>(null);
  const [nfeAExcluir,    setNfeAExcluir]    = useState<NfeRecebida | null>(null);
  const [produtoAExcluir, setProdutoAExcluir] = useState<Produto | null>(null);

  // ── Reserva de estoque — DERIVADA, nunca persistida ───────────
  // O modelo de dados tem apenas `produtos.saldo_atual` e `produtos.saldo_minimo`.
  // Não existe coluna de reserva nem de disponível em lugar nenhum do schema.
  // A única apuração de reserva que o app faz vive na aba Pedidos do contrato
  // (`ContratoPedidos.tsx`): soma de `contrato_pedidos.quantidade` com status
  // 'pendente' ou 'parcial', agrupada pelo `produto_id` do `contrato_itens`
  // correspondente; disponível = físico − reservado. Reusamos EXATAMENTE esse
  // cálculo aqui para a aba Estoque mostrar as três colunas da referência.
  //
  // `null` significa "não apurado" — e é o estado quando a consulta falha. Nesse
  // caso as colunas Reservado e Disponível saem como indisponíveis, nunca 0:
  // zero é uma afirmação sobre o produto, ausência de apuração é uma afirmação
  // sobre o sistema.
  const [reservas, setReservas] = useState<Map<string, number> | null>(null);
  const [reservasErro, setReservasErro] = useState<string | null>(null);
  // Quais contratos reservam cada produto — alimenta a subaba "Vínculos".
  const [contratosPorProduto, setContratosPorProduto] = useState<Map<string, { numero: string; quantidade: number }[]>>(new Map());

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
  /**
   * O mapeamento de cada item da nota, agora com a FINALIDADE da compra.
   *
   * A finalidade é o parâmetro do direito a crédito de ICMS (regra do dono do
   * produto, 13/09/2026) e é do ITEM, não do produto: a mesma resma entra para
   * o escritório numa nota e para o cliente noutra. `finalidadeOrigem` guarda
   * de onde veio a sugestão, para separar o que alguém confirmou do que o
   * sistema chutou — campo pré-preenchido sem procedência é palpite com cara
   * de fato.
   */
  const [nfeItemMaps,    setNfeItemMaps]    = useState<{
    item: NFeItemData;
    produtoId: string;
    novaNome: string;
    incluir: boolean;
    finalidade: FinalidadeDaEntrada;
    finalidadeOrigem: 'cfop' | 'cadastro' | 'manual';
    finalidadeProcedencia: string;
  }[]>([]);
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

  // O "Gerar pedido" do aviso de reposição troca de aba e só então dispara o
  // formulário: a referência ao PedidosOmie só aponta para algo depois que a
  // aba monta, e o efeito roda depois do commit.
  useEffect(() => {
    if (!novoPedidoAoEntrar || mainTab !== 'pedidos') return;
    pedidosRef.current?.novoPedido();
    setNovoPedidoAoEntrar(false);
  }, [novoPedidoAoEntrar, mainTab]);

  // ── Loaders ───────────────────────────────────────────────────
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const loadAll = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    try {
      const [pRes, fRes, prRes, nRes, movRes] = await Promise.all([
        supabase.from('pedidos_compra').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false }),
        supabase.from('fornecedores').select('*').eq('empresa_id', empresaAtiva.id).order('razao_social'),
        supabase.from('produtos').select('*').eq('empresa_id', empresaAtiva.id).order('descricao'),
        (supabase.from('nfe_entradas' as never) as any).select('*').eq('empresa_id', empresaAtiva.id).order('recebida_em', { ascending: false }),
        // Quais NF-e já viraram estoque: decide o botão "Lançar estoque" e o
        // selo. O created_at vem junto para o Histórico do painel poder dizer
        // QUANDO a entrada foi lançada, em vez de só que foi.
        supabase.from('estoque_movimentos').select('nfe_id, created_at').eq('empresa_id', empresaAtiva.id).not('nfe_id', 'is', null),
      ]);
      // Princípio 3 do CLAUDE.md: a mensagem real do banco vai para a tela. O
      // `catch` genérico de antes trocava "column X does not exist" por
      // "verifique sua conexão" — e a pessoa reiniciava o roteador.
      const primeiroErro = [pRes, fRes, prRes, nRes, movRes].find(r => (r as { error?: { message?: string } }).error);
      if (primeiroErro) throw new Error((primeiroErro as { error: { message: string } }).error.message);

      const p = pRes.data, f = fRes.data, pr = prRes.data, n = nRes.data, mov = movRes.data;
      setErroCarga(null);
      const movNfe = (mov as Array<{ nfe_id: string; created_at: string }> | null) || [];
      setNfesComEstoque(new Set(movNfe.map(m => m.nfe_id)));
      const quando = new Map<string, string>();
      for (const m of movNfe) {
        const anterior = quando.get(m.nfe_id);
        if (!anterior || m.created_at < anterior) quando.set(m.nfe_id, m.created_at);
      }
      setNfeEstoqueEm(quando);
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
      if (selectedNfe) {
        const upd = ((n as unknown as NfeRecebida[]) || []).find(x => x.id === selectedNfe.id);
        setSelectedNfe(upd ?? null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErroCarga(msg);
      toast.error('Erro ao carregar dados de compras', { description: msg });
    } finally {
      setLoading(false);
    }
    void loadReservas();
  };

  const loadContratos = async () => {
    if (!empresaAtiva) return;
    // Princípio 2 do CLAUDE.md: o processo é da empresa. Filtrar por
    // `user_id` escondia do colega o contrato que ele não criou — e o select
    // de vínculo do pedido aparecia vazio para metade da equipe.
    const { data, error } = await supabase.from('contratos').select('id, numero_contrato, orgao_contratante, objeto')
      .eq('empresa_id', empresaAtiva.id).neq('status', 'encerrado').order('created_at', { ascending: false });
    if (error) { toast.error('Não foi possível carregar os contratos', { description: error.message }); return; }
    setContratos((data as Contrato[]) || []);
  };

  /**
   * Apuração da reserva de estoque — derivada, em memória, a cada carga.
   *
   * Mesma regra de `ContratoPedidos.tsx`: pedido de contrato com status
   * 'pendente' ou 'parcial' segura a quantidade do produto do item. Nada disso
   * é gravado; se a consulta falhar, `reservas` fica `null` e a tela declara a
   * ausência de apuração em vez de exibir zero.
   */
  const loadReservas = async () => {
    if (!empresaAtiva) return;
    try {
      // `contrato_itens` não tem empresa_id — o RLS do contrato é quem limita
      // o retorno; o filtro por empresa é conferido no join, como já se faz na
      // régua de margem desta mesma tela. types.ts ainda não conhece
      // produto_id (migration administrativa de 24/08), daí o cast.
      const { data: ciData, error: ciErro } = await (supabase.from('contrato_itens') as unknown as ConsultaSemTipoGerado)
        .select('id, produto_id, contratos!inner(numero_contrato, empresa_id, excluido_em)')
        .not('produto_id', 'is', null);
      if (ciErro) throw new Error(ciErro.message);

      type LinhaCi = { id: string; produto_id: string; contratos: { numero_contrato: string | null; empresa_id: string | null; excluido_em: string | null } | null };
      const linhas = ((ciData as LinhaCi[] | null) || [])
        .filter(l => l.contratos && l.contratos.empresa_id === empresaAtiva.id && !l.contratos.excluido_em);

      const mapaReserva = new Map<string, number>();
      const mapaContratos = new Map<string, { numero: string; quantidade: number }[]>();

      if (linhas.length) {
        const { data: pedData, error: pedErro } = await supabase.from('contrato_pedidos')
          .select('contrato_item_id, quantidade')
          .in('contrato_item_id', linhas.map(l => l.id))
          .in('status', [...STATUS_QUE_RESERVAM]);
        if (pedErro) throw new Error(pedErro.message);

        const itemPara = new Map(linhas.map(l => [l.id, l]));
        for (const r of (pedData as Array<{ contrato_item_id: string | null; quantidade: number }> | null) || []) {
          const linha = r.contrato_item_id ? itemPara.get(r.contrato_item_id) : undefined;
          if (!linha) continue;
          const qtd = Number(r.quantidade) || 0;
          mapaReserva.set(linha.produto_id, (mapaReserva.get(linha.produto_id) ?? 0) + qtd);
          const numero = linha.contratos?.numero_contrato || 'Contrato sem número';
          const lista = mapaContratos.get(linha.produto_id) ?? [];
          const existente = lista.find(x => x.numero === numero);
          if (existente) existente.quantidade += qtd;
          else lista.push({ numero, quantidade: qtd });
          mapaContratos.set(linha.produto_id, lista);
        }
      }
      // Produto ausente do mapa significa zero APURADO (nenhum pedido de
      // contrato pendente o segura) — quem distingue isso de "não apurado" é o
      // próprio `reservas` ser um Map e não `null`.
      setReservas(mapaReserva);
      setContratosPorProduto(mapaContratos);
      setReservasErro(null);
    } catch (e) {
      setReservas(null);
      setContratosPorProduto(new Map());
      setReservasErro(e instanceof Error ? e.message : String(e));
    }
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
  // Os dois apagavam no clique, sem pergunta e sem ler o erro do banco. Agora
  // passam pelo AlertDialog de confirmação e o erro real chega ao toast.
  const handleDeletePedido = async (id: string) => {
    const { error } = await supabase.from('pedidos_compra').delete().eq('id', id);
    setPedidoAExcluir(null);
    if (error) { toast.error('Não foi possível excluir o pedido', { description: error.message }); return; }
    toast.success('Pedido excluído');
    if (selectedPedido?.id === id) setSelectedPedido(null);
    loadAll();
  };

  const handleDeleteFornecedor = async (pessoa: Pessoa) => {
    setFornAExcluir(null);
    if (selectedForn?.id === pessoa.id) setSelectedForn(null);
    deletePessoa.mutate({ id: pessoa.id });
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

  const handleDeleteProduto = async (id: string) => {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    setProdutoAExcluir(null);
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

  /**
   * Monta a linha de trabalho de um item da nota: a que produto ele se liga e
   * para que a compra serve.
   *
   * Existia em três cópias — importar XML, importar DANFE e reabrir nota do
   * acervo — e só uma delas tinha o casamento por código de barras. Na prática
   * isso significava que o mesmo item era reconhecido ao reabrir a nota e
   * ignorado ao importá-la, que é a ordem inversa do útil.
   *
   * O casamento por `c_prod` sozinho quase nunca acerta: aquele é o código no
   * sistema do FORNECEDOR, e o nosso é gerado como `PRD%`. Os dois só
   * coincidem se alguém editou à mão. O EAN, sim, é do produto e é o mesmo nos
   * dois lados — por isso vem como segunda tentativa, e não como enfeite.
   */
  const montarMapaDoItem = (item: NFeItemData) => {
    const porCodigo = item.c_prod
      ? produtos.find((p) => p.ativo && p.codigo === item.c_prod)
      : undefined;
    const porEan = item.c_ean
      ? produtos.find((p) => p.ativo && p.codigo_ean && p.codigo_ean === item.c_ean)
      : undefined;
    const casado = porCodigo ?? porEan;

    const sugestao = sugerirFinalidade(
      item.cfop,
      (casado as { tipo_produto?: string } | undefined)?.tipo_produto,
    );
    return {
      item,
      produtoId: casado?.id ?? '',
      novaNome: item.x_prod,
      incluir: true,
      finalidade: sugestao.finalidade,
      // Enquanto ninguém tocar no seletor, a origem é a fonte da sugestão.
      finalidadeOrigem: (sugestao.procedencia.startsWith('CFOP')
        ? 'cfop'
        : sugestao.procedencia.startsWith('cadastro')
          ? 'cadastro'
          : 'manual') as 'cfop' | 'cadastro' | 'manual',
      finalidadeProcedencia: sugestao.procedencia,
    };
  };

  // ── Entrega → estoque ─────────────────────────────────────────
  /**
   * Cria o produto quando a pessoa escolheu "novo", com a FICHA DA MERCADORIA.
   *
   * O que entra aqui é só o que atravessa a operação: NCM, CEST, código de
   * barras, origem da mercadoria e unidade. O que descreve a operação DO
   * FORNECEDOR — CFOP, CST/CSOSN e alíquotas — não entra, e a razão está em
   * `src/lib/fiscal/entrada-para-saida.ts`: até 13/09 o CFOP da entrada era
   * gravado na ficha e relido pela emissão de saída, de modo que uma compra
   * com 1.102 virava uma venda com 1.102 — código que a SEFAZ rejeita (733),
   * porque saída começa com 5 ou 6.
   *
   * O `codigo` também deixou de vir do `c_prod` da nota: aquele é o código do
   * item no sistema do fornecedor, e usá-lo aqui quebrava a numeração `PRD%`
   * do app e colidia entre fornecedores que usem o mesmo código para coisas
   * diferentes.
   */
  const criarProdutoSeNovo = async (
    produtoId: string, nome: string, unidade: string,
    ficha?: FichaDaMercadoria,
  ): Promise<string | null> => {
    if (produtoId !== '__new__') return produtoId;
    if (!empresaAtiva || !nome.trim()) return null;
    const { data, error } = await supabase.from('produtos').insert({
      empresa_id: empresaAtiva.id,
      descricao: nome.trim(),
      unidade: ficha?.unidade || unidade || 'UN',
      ativo: true,
      codigo: await generateNextCodigo(),
      ...(ficha || {}),
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
        setNfeItemMaps(parsed.itens.map(montarMapaDoItem));
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
      setNfeItemMaps((parsed.itens || []).map(montarMapaDoItem));
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
      // n_item → produto_id resolvido. O item da nota conhece a sua posição; o
      // produto só existe depois de criado, e quem grava o detalhamento
      // precisa dos dois lados.
      const produtosCriados = new Map<number, string>();
      for (const m of toCreate) {
        const ficha = fichaDaMercadoria(m.item);
        const pid = await criarProdutoSeNovo(m.produtoId, m.novaNome, m.item.u_com, ficha);
        if (!pid) continue;

        // Produto que já existe também aprende com a nota — mas só onde tem
        // lacuna. Até 13/09 ele não aprendia NADA (só o custo médio), então
        // NCM, CEST, código de barras e origem ficavam em branco para sempre
        // se ninguém os digitasse, e a emissão de saída herdava esse vazio.
        // Preencher lacuna é diferente de sobrescrever: quem digitou o NCM à
        // mão conferiu numa tabela, e a nota do fornecedor não é autoridade
        // maior que essa conferência.
        if (m.produtoId !== '__new__') {
          const atual = produtos.find((p) => p.id === pid) as Record<string, unknown> | undefined;
          const lacunas = atual ? completarFicha(atual, ficha) : null;
          if (lacunas) {
            const { error: erroFicha } = await supabase
              .from('produtos')
              .update(lacunas as never)
              .eq('id', pid);
            if (erroFicha) {
              // Não aborta o lançamento: o estoque e a nota importam mais que
              // o complemento do cadastro. Mas não some em silêncio.
              toast.warning('Cadastro do produto não foi complementado', {
                description: erroFicha.message,
              });
            }
          }
        }
        produtosCriados.set(m.item.n_item, pid);
        rows.push({ empresa_id: empresaAtiva.id, produto_id: pid, nfe_id: (nfeRow as any).id, pedido_id: nfeForm.pedido_id || null, tipo: 'entrada', origem: 'nfe', quantidade: Math.abs(m.item.q_com), preco_unitario: m.item.v_un_com || null, created_by: user.id });
      }

      // ── Itens da entrada, com a finalidade e a classificação do crédito ───
      //
      // Grava TODOS os itens da nota, não só os que viraram estoque: um item
      // marcado "não registrar" continua sendo um item daquela nota, e some da
      // escrituração se só o estoque o guardar. Era exatamente o que acontecia
      // antes — os itens viviam num jsonb sem chave e o resto se perdia.
      //
      // A situação do crédito é congelada aqui, com a regra vigente hoje. A do
      // uso e consumo já foi adiada cinco vezes; reavaliar na leitura faria o
      // passado mudar de resposta conforme a lei de amanhã.
      const itensDaEntrada = nfeItemMaps.map((m) => {
        const vinculado = m.incluir && m.produtoId
          ? produtosCriados.get(m.item.n_item) ?? null
          : null;
        const credito = avaliarCreditoIcms(
          m.finalidade,
          empresaAtiva.regime_tributario as never,
        );
        return {
          empresa_id: empresaAtiva.id,
          nfe_entrada_id: (nfeRow as any).id,
          n_item: m.item.n_item,
          produto_id: vinculado,
          c_prod: m.item.c_prod || null,
          c_ean: m.item.c_ean || null,
          x_prod: m.item.x_prod || null,
          ncm: m.item.ncm || null,
          cest: m.item.cest || null,
          origem_mercadoria: m.item.orig || null,
          cfop: m.item.cfop || null,
          cst_icms: m.item.cst_icms || null,
          csosn: m.item.csosn || null,
          cst_pis: m.item.cst_pis || null,
          cst_cofins: m.item.cst_cofins || null,
          u_com: m.item.u_com || null,
          q_com: m.item.q_com || null,
          v_un_com: m.item.v_un_com || null,
          v_prod: m.item.v_prod || null,
          v_desc: m.item.v_desc || null,
          p_icms: m.item.p_icms || null,
          v_pis: m.item.v_pis || null,
          v_cofins: m.item.v_cofins || null,
          finalidade: m.finalidade,
          finalidade_origem: m.finalidadeOrigem,
          credito_icms_situacao: credito.situacao,
          credito_icms_fundamento: credito.fundamento ?? null,
        };
      });

      if (itensDaEntrada.length) {
        // `upsert` por (nfe_entrada_id, n_item): reimportar a mesma nota
        // corrige os itens em vez de duplicá-los.
        const { error: erroItens } = await (supabase.from('nfe_entrada_itens' as never) as any)
          .upsert(itensDaEntrada, { onConflict: 'nfe_entrada_id,n_item' });
        if (erroItens) {
          // A nota e o estoque já valem; o detalhamento fiscal é o que falta.
          // Dizer qual dos três é que falhou poupa a investigação.
          toast.error('NF-e salva, mas os itens não foram detalhados', {
            description: erroItens.message,
          });
        }
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

  const handleDeleteNfe = async (id: string) => {
    const { error } = await (supabase.from('nfe_entradas' as never) as any).delete().eq('id', id);
    setNfeAExcluir(null);
    if (error) { toast.error('Não foi possível excluir', { description: error.message }); return; }
    if (selectedNfe?.id === id) setSelectedNfe(null);
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
      setNfeItemMaps(parsed.itens.map(montarMapaDoItem));
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
  const prodAlerta     = produtos.filter(p => p.ativo && p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo).length;
  const valorEstoque   = produtos.filter(p => p.ativo).reduce((s, p) => s + p.saldo_atual * p.preco_custo_medio, 0);
  // O guia some quando há dado — ou quando a pessoa clica num passo que leva
  // a uma aba: sem isto, "Registre uma Compra" trocava a aba por baixo de uma
  // tela de onboarding que continuava cobrindo tudo, e nada acontecia.
  const isOnboarding   = !loading && !pularOnboarding && !pedidos.length && !fornecedores.length && !produtos.length && !nfes.length;

  const produtosAtivosParaSelect = produtos.filter(p => p.ativo);

  /**
   * Saldo físico, reserva e disponível de um produto.
   *
   * Só o físico é coluna (`produtos.saldo_atual`). Reserva e disponível são
   * derivados da apuração de `loadReservas` e voltam `null` enquanto ela não
   * concluiu ou falhou — nunca 0.
   */
  const estoqueDoProduto = (p: Produto) => {
    const fisico = Number(p.saldo_atual) || 0;
    if (!reservas) return { fisico, reservado: null as number | null, disponivel: null as number | null };
    const reservado = reservas.get(p.id) ?? 0;
    return { fisico, reservado, disponivel: fisico - reservado };
  };

  const situacaoDoProduto = (p: Produto): { tom: TomSituacao; texto: string; explicacao: string } => {
    if (!p.ativo) return { tom: 'neutro', texto: 'Inativo', explicacao: 'Produto desativado no catálogo.' };
    if (p.saldo_atual <= 0) return { tom: 'critico', texto: 'Sem saldo', explicacao: 'Saldo físico zerado ou negativo.' };
    if (p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo) {
      return { tom: 'atencao', texto: 'Abaixo do mínimo', explicacao: `Saldo físico ${p.saldo_atual} ≤ mínimo ${p.saldo_minimo}.` };
    }
    if (p.saldo_minimo <= 0) return { tom: 'neutro', texto: 'Sem mínimo definido', explicacao: 'Sem ponto de reposição cadastrado — não há como dizer se o nível está adequado.' };
    return { tom: 'sucesso', texto: 'Em nível', explicacao: `Saldo físico ${p.saldo_atual} acima do mínimo ${p.saldo_minimo}.` };
  };

  const filtProdutos = produtos.filter(p => {
    const busca = estoqSearch.trim().toLowerCase();
    const casaBusca = !busca
      || p.descricao.toLowerCase().includes(busca)
      || (p.codigo ?? '').toLowerCase().includes(busca)
      || (p.categoria ?? '').toLowerCase().includes(busca);
    if (!casaBusca) return false;
    if (estoqSituacao === 'todas') return true;
    if (estoqSituacao === 'inativos') return !p.ativo;
    if (estoqSituacao === 'alerta') return p.ativo && p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo;
    if (estoqSituacao === 'sem_saldo') return p.ativo && p.saldo_atual <= 0;
    return true;
  });
  const filtrosEstoqueAplicados = (estoqSearch ? 1 : 0) + (estoqSituacao !== 'todas' ? 1 : 0);

  // Fornecedores vêm de `financeiro_pessoas` (cadastro unificado com o
  // Financeiro). A tabela `fornecedores` continua viva porque é ela que a
  // auto-detecção por CNPJ da NF-e alimenta e para quem o pedido legado aponta.
  const filtForn = pessoasFornecedores.filter(f => {
    const busca = fornSearch.trim().toLowerCase();
    if (!busca) return true;
    return f.nome.toLowerCase().includes(busca)
      || (f.nome_fantasia ?? '').toLowerCase().includes(busca)
      || (f.documento ?? '').includes(busca)
      || (f.email ?? '').toLowerCase().includes(busca);
  });

  const situacaoEstoqueDaNfe = (n: NfeRecebida): { tom: TomSituacao; texto: string; explicacao: string } => {
    if (nfesComEstoque.has(n.id)) return { tom: 'sucesso', texto: 'Estoque lançado', explicacao: 'Há movimentações de estoque apontando para esta NF-e.' };
    if (!n.xml) return { tom: 'indisponivel', texto: 'Sem XML', explicacao: 'Sem o XML armazenado não há itens para conferir — importe o arquivo para lançar.' };
    return { tom: 'atencao', texto: 'Entrada a conferir', explicacao: 'XML disponível e nenhuma movimentação de estoque vinculada.' };
  };

  const filtNfes = nfes.filter(n => {
    const busca = nfeSearch.trim().toLowerCase();
    const casaBusca = !busca
      || String(n.numero ?? '').toLowerCase().includes(busca)
      || (n.emitente_nome ?? '').toLowerCase().includes(busca)
      || (n.emitente_cnpj ?? '').includes(busca)
      || (n.chave ?? '').includes(busca);
    if (!casaBusca) return false;
    if (nfeDe && (!n.data_emissao || n.data_emissao < nfeDe)) return false;
    if (nfeAte && (!n.data_emissao || n.data_emissao > nfeAte)) return false;
    if (nfeSituacao === 'todas') return true;
    if (nfeSituacao === 'lancada') return nfesComEstoque.has(n.id);
    if (nfeSituacao === 'pendente') return !nfesComEstoque.has(n.id) && !!n.xml;
    if (nfeSituacao === 'sem_xml') return !n.xml;
    return true;
  });
  const filtrosNfeAplicados = (nfeSearch ? 1 : 0) + (nfeDe ? 1 : 0) + (nfeAte ? 1 : 0) + (nfeSituacao !== 'todas' ? 1 : 0);
  const nfesPendentes = nfes.filter(n => !nfesComEstoque.has(n.id) && !!n.xml).length;
  const valorNfes = nfes.reduce((s, n) => s + (Number(n.valor_total) || 0), 0);

  /** Baixa o XML guardado da NF-e — arquivo real, gerado do que está no banco. */
  const baixarXml = (n: NfeRecebida) => {
    if (!n.xml) { toast.error('Esta NF-e não tem XML armazenado.'); return; }
    const url = URL.createObjectURL(new Blob([n.xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `nfe-${n.chave || `${n.numero}-${n.serie}`}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ══ CONFIRMAÇÕES DE EXCLUSÃO ═════════════════════════════════
  const confirmarExclusaoPedido = (
    <AlertDialog open={!!pedidoAExcluir} onOpenChange={o => { if (!o) setPedidoAExcluir(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este pedido de compra?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{pedidoAExcluir?.observacoes || 'Pedido de compra'}</p>
              <p>
                Os itens do pedido vão junto. NF-e e movimentações que apontam para ele
                permanecem, mas perdem o vínculo. Não há como desfazer.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => pedidoAExcluir && handleDeletePedido(pedidoAExcluir.id)}
          >
            Excluir pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ══ PAINEL: PRODUTO ══════════════════════════════════════════
  const painelProduto = selectedProduto && (() => {
    const p = selectedProduto;
    const { fisico, reservado, disponivel } = estoqueDoProduto(p);
    const sit = situacaoDoProduto(p);
    const precisaRepor = p.ativo && p.saldo_minimo > 0 && p.saldo_atual <= p.saldo_minimo;
    const vinculosContrato = contratosPorProduto.get(p.id) ?? [];
    const nfesDoProduto = movimentos
      .filter(m => m.nfe_id)
      .map(m => ({ mov: m, nfe: nfes.find(n => n.id === m.nfe_id) }))
      .filter(x => x.nfe);
    const pedidosDoProduto = movimentos
      .filter(m => m.pedido_id)
      .map(m => ({ mov: m, pedido: pedidos.find(x => x.id === m.pedido_id) }))
      .filter(x => x.pedido);

    // As quatro caixas do resumo. Reservado e Disponível são DERIVADOS; quando
    // a apuração não veio, saem como indisponíveis — nunca como zero.
    const caixas: { rotulo: string; valor: React.ReactNode; tom: string }[] = [
      { rotulo: 'Saldo físico', valor: fisico.toLocaleString('pt-BR'), tom: 'bg-muted text-foreground' },
      {
        rotulo: 'Reservado',
        valor: reservado === null ? <ValorIndisponivel razao="Reserva não apurada" /> : reservado.toLocaleString('pt-BR'),
        tom: 'bg-warning-tint text-warning-ink',
      },
      {
        rotulo: 'Disponível',
        valor: disponivel === null ? <ValorIndisponivel razao="Reserva não apurada" /> : disponivel.toLocaleString('pt-BR'),
        tom: disponivel !== null && disponivel < 0 ? 'bg-destructive-tint text-destructive-ink' : 'bg-success-tint text-success-ink',
      },
      { rotulo: 'Mínimo', valor: p.saldo_minimo > 0 ? p.saldo_minimo.toLocaleString('pt-BR') : <ValorIndisponivel razao="Sem ponto de reposição" />, tom: 'bg-muted text-foreground' },
    ];

    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="g-titulo-secao text-foreground">{p.descricao}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {p.codigo && <SeloSituacao tom="neutro">{p.codigo}</SeloSituacao>}
            <SeloSituacao tom={sit.tom} explicacao={sit.explicacao}>{sit.texto}</SeloSituacao>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {caixas.map(c => (
            <div key={c.rotulo} className={`rounded-[var(--g-raio)] px-3 py-2 ${c.tom}`}>
              <p className="g-meta opacity-80">{c.rotulo}</p>
              <p className="truncate text-xl font-bold leading-7 tabular-nums">{c.valor}</p>
              <p className="g-meta opacity-80">{p.unidade}</p>
            </div>
          ))}
        </div>

        {/* A referência mostra as três colunas; o schema só tem o físico. Quem
            lê a tela precisa saber de onde vêm as outras duas. */}
        <p className="g-meta text-muted-foreground">
          Reservado e disponível são apurados na hora, a partir dos pedidos de contrato
          pendentes ou parciais que apontam para este produto — não são colunas do estoque.
        </p>

        {precisaRepor && (
          <AvisoDeContexto
            titulo="Abaixo do ponto de reposição"
            acao={
              <Button size="sm" onClick={() => { setMainTab('pedidos'); setNovoPedidoAoEntrar(true); }}>
                <ShoppingCart className="h-4 w-4" /> Gerar pedido
              </Button>
            }
          >
            {`Saldo físico ${fisico.toLocaleString('pt-BR')} ${p.unidade} contra mínimo de ${p.saldo_minimo.toLocaleString('pt-BR')} ${p.unidade}.`}
          </AvisoDeContexto>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingProduto(p); setProdutoForm({ codigo: p.codigo ?? '', descricao: p.descricao, unidade: p.unidade, categoria: p.categoria ?? '', saldo_minimo: String(p.saldo_minimo), preco_custo_medio: String(p.preco_custo_medio), ativo: p.ativo, ncm: p.ncm ?? '', cfop: p.cfop ?? '', cst_icms: p.cst_icms ?? '', csosn: p.csosn ?? '', cst_pis: p.cst_pis ?? '', cst_cofins: p.cst_cofins ?? '', p_icms: p.p_icms != null ? String(p.p_icms) : '', p_pis: p.p_pis != null ? String(p.p_pis) : '', p_cofins: p.p_cofins != null ? String(p.p_cofins) : '' }); setProdutoOpen(true); }}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setMovForm(f => ({ ...f, produto_id: p.id })); setMovOpen(true); }}>
            <Plus className="h-4 w-4" /> Movimentação
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Excluir ${p.descricao}`} onClick={() => setProdutoAExcluir(p)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        <Tabs value={abaProduto} onValueChange={v => setAbaProduto(v as typeof abaProduto)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
            <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          </TabsList>

          <TabsContent value="movimentacoes" className="mt-3">
            {movimentos.length === 0 ? (
              <EstadoVazio tamanho="compacto" icone={<RotateCcw />} titulo="Nenhuma movimentação"
                descricao="Entradas, saídas e ajustes deste produto aparecem aqui." />
            ) : (
              <ul className="divide-y divide-border">
                {movimentos.map(m => {
                  const cfg = movConfig[m.tipo];
                  const Icone = cfg.icon;
                  const abs = Math.abs(m.quantidade);
                  const sinal = m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : (m.quantidade >= 0 ? '+' : '−');
                  return (
                    <li key={m.id} className="flex items-start gap-3 py-2.5">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                        <Icone className={`h-4 w-4 ${cfg.color}`} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`g-corpo font-semibold tabular-nums ${cfg.color}`}>
                          {sinal}{abs.toLocaleString('pt-BR')} {p.unidade}
                          <span className="ml-2 font-normal text-muted-foreground">{cfg.label}</span>
                        </p>
                        <p className="g-meta text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString('pt-BR')}
                          {m.origem ? ` · ${m.origem.replace(/_/g, ' ')}` : ''}
                          {m.preco_unitario != null && m.preco_unitario > 0 ? ` · ${fmtCurrency(m.preco_unitario)}/un` : ''}
                        </p>
                        {m.observacoes && <p className="g-meta text-muted-foreground">{m.observacoes}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="vinculos" className="mt-3 flex flex-col gap-4">
            <BlocoDoPainel titulo="Contratos que reservam">
              {reservas === null ? (
                <p className="g-corpo text-muted-foreground">
                  <ValorIndisponivel razao="Reserva não apurada" />
                </p>
              ) : vinculosContrato.length === 0 ? (
                <p className="g-corpo text-muted-foreground">Nenhum pedido de contrato pendente segura este produto.</p>
              ) : (
                <ListaDeCampos
                  campos={vinculosContrato.map(v => ({
                    rotulo: v.numero,
                    valor: `${v.quantidade.toLocaleString('pt-BR')} ${p.unidade}`,
                    numerico: true,
                  }))}
                />
              )}
            </BlocoDoPainel>

            <BlocoDoPainel titulo="NF-e de entrada">
              {nfesDoProduto.length === 0 ? (
                <p className="g-corpo text-muted-foreground">Nenhuma entrada veio de NF-e.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {nfesDoProduto.map(({ mov, nfe }) => (
                    <li key={mov.id}>
                      <button type="button"
                        className="g-corpo w-full rounded text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => { setSelectedProduto(null); setMainTab('nfe'); setSelectedNfe(nfe!); setAbaNfe('resumo'); }}>
                        Nº {nfe!.numero}/{nfe!.serie} — {nfe!.emitente_nome || 'emitente não informado'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </BlocoDoPainel>

            <BlocoDoPainel titulo="Pedidos de compra">
              {pedidosDoProduto.length === 0 ? (
                <p className="g-corpo text-muted-foreground">Nenhuma entrada veio de pedido de compra.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {pedidosDoProduto.map(({ mov, pedido }) => (
                    <li key={mov.id}>
                      <button type="button"
                        className="g-corpo w-full rounded text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => { setSelectedProduto(null); setSelectedPedido(pedido!); }}>
                        {pedido!.observacoes || 'Pedido de compra'} — {fmtCurrency(pedido!.valor_total)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </BlocoDoPainel>
          </TabsContent>
        </Tabs>
      </div>
    );
  })();

  // ══ PAINEL: NF-e ═════════════════════════════════════════════
  const painelNfe = selectedNfe && (() => {
    const n = selectedNfe;
    const sit = situacaoEstoqueDaNfe(n);
    const pedido = pedidos.find(p => p.id === n.pedido_id) ?? null;
    const contrato = pedido?.contrato_id ? contratos.find(c => c.id === pedido.contrato_id) ?? null : null;
    const fornecedor = fornecedores.find(f => f.id === n.fornecedor_id) ?? null;
    const itens = Array.isArray(n.itens) ? n.itens : [];
    const lancadaEm = nfeEstoqueEm.get(n.id) ?? null;

    // Histórico só com o que o banco registra. Não há tabela de eventos da
    // NF-e: inventar "XML validado" ou "conferida por fulano" seria dado de
    // demonstração numa tela de produção.
    const historico: { quando: string | null; titulo: string; detalhe: string }[] = [
      { quando: n.data_emissao, titulo: 'Emitida pelo fornecedor', detalhe: n.emitente_nome || 'Emitente não informado' },
      { quando: n.recebida_em, titulo: 'Recebida no acervo', detalhe: n.origem === 'importacao_compras' ? 'Importada em Compras' : (n.origem || 'Origem não informada') },
      ...(lancadaEm ? [{ quando: lancadaEm, titulo: 'Entrada lançada no estoque', detalhe: 'Movimentações vinculadas a esta NF-e' }] : []),
    ].filter(h => h.quando);

    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="g-titulo-secao text-foreground">Nº {n.numero} · Série {n.serie}</h2>
          <p className="g-corpo text-muted-foreground">{n.emitente_nome || 'Emitente não informado'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <SeloSituacao tom={sit.tom} explicacao={sit.explicacao}>{sit.texto}</SeloSituacao>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* "Conferir entrada" é o mesmo fluxo de lançamento no estoque: abre o
              assistente no passo de casar os itens da nota com o catálogo. */}
          {!nfesComEstoque.has(n.id) && n.xml && (
            <Button size="sm" onClick={() => abrirLancamentoEstoque(n)}>
              <PackagePlus className="h-4 w-4" /> Conferir entrada
            </Button>
          )}
          <Button variant="ghost" size="sm" aria-label={`Excluir NF-e ${n.numero}`} onClick={() => setNfeAExcluir(n)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        <Tabs value={abaNfe} onValueChange={v => setAbaNfe(v as typeof abaNfe)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
            <TabsTrigger value="arquivos">XML/PDF</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-3 flex flex-col gap-4">
            <ListaDeCampos
              campos={[
                { rotulo: 'Emissão', valor: fmtDate(n.data_emissao) },
                { rotulo: 'Valor total', valor: fmtCurrency(Number(n.valor_total) || 0), numerico: true },
                { rotulo: 'CNPJ do emitente', valor: n.emitente_cnpj || <ValorIndisponivel razao="Não informado" /> },
                { rotulo: 'Recebida em', valor: new Date(n.recebida_em).toLocaleString('pt-BR') },
                { rotulo: 'Chave de acesso', largo: true, valor: n.chave ? <span className="break-all font-mono text-xs">{n.chave}</span> : <ValorIndisponivel razao="Não informada" /> },
              ]}
            />
            <BlocoDoPainel titulo="Vínculos">
              <ListaDeCampos
                campos={[
                  {
                    rotulo: 'Fornecedor',
                    valor: fornecedor ? fornecedor.razao_social : <ValorIndisponivel razao="Não vinculado" />,
                  },
                  {
                    rotulo: 'Pedido de compra',
                    valor: pedido ? (
                      <button type="button"
                        className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => { setSelectedNfe(null); setSelectedPedido(pedido); }}>
                        {pedido.observacoes || 'Pedido de compra'}
                      </button>
                    ) : <ValorIndisponivel razao="Não vinculado" />,
                  },
                  {
                    rotulo: 'Contrato',
                    valor: contrato ? `${contrato.numero_contrato} — ${contrato.orgao_contratante}` : <ValorIndisponivel razao="Sem contrato pelo pedido" />,
                  },
                ]}
              />
            </BlocoDoPainel>
          </TabsContent>

          <TabsContent value="itens" className="mt-3">
            {itens.length === 0 ? (
              <EstadoVazio tamanho="compacto" icone={<Package />} titulo="Nenhum item guardado"
                descricao="Os itens são extraídos do XML na importação. Esta nota chegou sem eles." />
            ) : (
              <ul className="divide-y divide-border">
                {itens.map((it, i) => (
                  <li key={i} className="py-2.5">
                    <p className="g-corpo font-medium text-foreground">{it.x_prod}</p>
                    <p className="g-meta tabular-nums text-muted-foreground">
                      {it.q_com} {it.u_com} · {fmtCurrency(it.v_un_com)}/un
                      {it.c_prod ? ` · Cód. ${it.c_prod}` : ''}
                      {it.ncm ? ` · NCM ${it.ncm}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="arquivos" className="mt-3 flex flex-col gap-3">
            {n.xml ? (
              <>
                <p className="g-corpo text-muted-foreground">O XML autorizado está guardado com a nota.</p>
                <Button variant="outline" size="sm" className="self-start" onClick={() => baixarXml(n)}>
                  <Download className="h-4 w-4" /> Baixar XML
                </Button>
              </>
            ) : (
              <p className="g-corpo text-muted-foreground">
                <ValorIndisponivel razao="XML não armazenado" /> — esta nota entrou sem o arquivo.
                Importe o XML para poder conferir a entrada.
              </p>
            )}
            {/* O DANFE em PDF é lido para extrair dados e NÃO é guardado: não há
                coluna nem bucket para ele. Dizer o contrário criaria um botão
                que baixa nada. */}
            <p className="g-meta text-muted-foreground">
              O PDF do DANFE é usado apenas para extrair os dados na importação — ele não fica
              armazenado, então não há download de PDF aqui.
            </p>
          </TabsContent>

          <TabsContent value="historico" className="mt-3">
            {historico.length === 0 ? (
              <EstadoVazio tamanho="compacto" icone={<History />} titulo="Sem histórico"
                descricao="Nenhuma data foi registrada para esta nota." />
            ) : (
              <ul className="divide-y divide-border">
                {historico.map((h, i) => (
                  <li key={i} className="py-2.5">
                    <p className="g-corpo font-medium text-foreground">{h.titulo}</p>
                    <p className="g-meta text-muted-foreground">
                      {h.quando!.includes('T')
                        ? new Date(h.quando!).toLocaleString('pt-BR')
                        : fmtDate(h.quando!)} · {h.detalhe}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  })();

  // ══ PAINEL: FORNECEDOR ═══════════════════════════════════════
  const painelFornecedor = selectedForn && (() => {
    const f = selectedForn;
    const endereco = (f.endereco ?? null) as { logradouro?: string; numero?: string; bairro?: string; municipio?: string; uf?: string; cep?: string } | null;
    // O elo entre a pessoa do Financeiro e a linha de `fornecedores` é o
    // documento — é por CNPJ que a NF-e reconhece o emitente.
    const doc = normCnpj(f.documento ?? '');
    const legado = doc ? fornecedores.find(x => normCnpj(x.cnpj || '') === doc) ?? null : null;
    const nfesDele = legado ? nfes.filter(n => n.fornecedor_id === legado.id) : [];

    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="g-titulo-secao text-foreground">{f.nome}</h2>
          {f.nome_fantasia && <p className="g-corpo text-muted-foreground">{f.nome_fantasia}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <SeloSituacao tom={f.ativo ? 'ativo' : 'neutro'}>{f.ativo ? 'Ativo' : 'Inativo'}</SeloSituacao>
            {f.tipo === 'ambos' && <SeloSituacao tom="neutro">Cliente e fornecedor</SeloSituacao>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingPessoa(f); setPessoaOpen(true); }}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Excluir ${f.nome}`} onClick={() => setFornAExcluir(f)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        <ListaDeCampos
          campos={[
            { rotulo: 'Documento', valor: f.documento || <ValorIndisponivel razao="Não informado" /> },
            { rotulo: 'E-mail', valor: f.email || <ValorIndisponivel razao="Não informado" /> },
            { rotulo: 'Telefone', valor: f.telefone || <ValorIndisponivel razao="Não informado" /> },
            { rotulo: 'Regime tributário', valor: f.regime_tributario || <ValorIndisponivel razao="Não informado" /> },
            { rotulo: 'Prazo padrão', valor: f.prazo_padrao_dias != null ? `${f.prazo_padrao_dias} dia(s)` : <ValorIndisponivel razao="Não informado" />, numerico: f.prazo_padrao_dias != null },
            {
              rotulo: 'Endereço', largo: true,
              valor: endereco && (endereco.logradouro || endereco.municipio)
                ? [endereco.logradouro, endereco.numero, endereco.bairro, endereco.municipio, endereco.uf, endereco.cep].filter(Boolean).join(', ')
                : <ValorIndisponivel razao="Não informado" />,
            },
          ]}
        />

        <BlocoDoPainel titulo="NF-e recebidas">
          {!legado ? (
            <p className="g-corpo text-muted-foreground">
              Sem cadastro correspondente na base que a NF-e usa para reconhecer emitente — o
              vínculo nasce quando uma nota deste CNPJ é importada.
            </p>
          ) : nfesDele.length === 0 ? (
            <p className="g-corpo text-muted-foreground">Nenhuma NF-e deste fornecedor foi importada.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {nfesDele.slice(0, 8).map(n => (
                <li key={n.id}>
                  <button type="button"
                    className="g-corpo w-full rounded text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => { setSelectedForn(null); setMainTab('nfe'); setSelectedNfe(n); setAbaNfe('resumo'); }}>
                    Nº {n.numero}/{n.serie} · {fmtDate(n.data_emissao)} · {fmtCurrency(Number(n.valor_total) || 0)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BlocoDoPainel>
      </div>
    );
  })();

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
          denso
          titulo={p.observacoes || 'Pedido de compra'}
          icone={<ShoppingCart />}
          trilha={[...trilhaDaRota('/gestao-compras'), { rotulo: p.observacoes || 'Pedido de compra' }]}
          descricao={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {forn && <span className="flex items-center gap-1"><Truck className="w-4 h-4" aria-hidden="true" />{forn.razao_social}</span>}
              {cont && <span className="flex items-center gap-1"><Building2 className="w-4 h-4" aria-hidden="true" />Contrato {cont.numero_contrato}</span>}
              {p.data_pedido && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" aria-hidden="true" />Pedido: {fmtDate(p.data_pedido)}</span>}
              {p.data_entrega_prevista && <span className="flex items-center gap-1"><Truck className="w-4 h-4" aria-hidden="true" />Previsto: {fmtDate(p.data_entrega_prevista)}</span>}
              {p.data_entrega_real && <span className="flex items-center gap-1 text-success-ink"><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Entregue: {fmtDate(p.data_entrega_real)}</span>}
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
              <Button variant="ghost" aria-label="Excluir pedido" onClick={() => setPedidoAExcluir(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Itens do pedido</h2>
          {itensPedido.length === 0 ? (
            <EstadoVazio
              tamanho="compacto"
              icone={<Package />}
              titulo="Nenhum item cadastrado"
              descricao="Este pedido foi salvo sem itens."
            />
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

        {/* A confirmação vive nos dois ramos porque o detalhe do pedido é um
            return antecipado — sem isto, o botão de excluir daqui não teria
            onde abrir o diálogo. */}
        {confirmarExclusaoPedido}
      </AppLayout>
    );
  }

  // ══ LIST VIEW ════════════════════════════════════════════════
  return (
    <AppLayout>
      {/* Cabeçalho padrão da identidade 12/09: título, descrição, ícone e
          trilha vêm do registro `lib/navegacao/paginas.ts` pela própria rota —
          a tela não repete o que já está padronizado. A ação principal muda com
          a aba ativa (Produtos e Pedidos têm barra própria dentro da aba). */}
      <CabecalhoPagina
          denso
        acoes={!isOnboarding && (
          mainTab === 'fornecedores' ? (
            <Button onClick={() => { setEditingPessoa(null); setPessoaOpen(true); }}><Plus className="w-4 h-4" /> Novo fornecedor</Button>
          ) : mainTab === 'estoque' ? (
            <Button onClick={openNovoProduto}><Plus className="w-4 h-4" /> Novo produto</Button>
          ) : mainTab === 'nfe' ? (
            <Button onClick={() => { resetNfeDialog(); setNfeOpen(true); }}><Plus className="w-4 h-4" /> Importar NF-e</Button>
          ) : mainTab === 'pedidos' ? (
            <Button onClick={() => pedidosRef.current?.novoPedido()}><Plus className="w-4 h-4" /> Novo pedido</Button>
          ) : null
          // Produto e Certificado têm a ação dentro da própria aba. O ramo que
          // existia aqui no `else` abria o formulário de pedido LEGADO
          // (`pedidos_compra`) a partir da aba Certificado — dois botões
          // idênticos, "Novo pedido", criando registros em sistemas
          // diferentes. É a navegação duplicada que o padrão proíbe.
        )}
      />

      {!empresaAtiva ? (
        <Card>
          <EstadoVazio
            icone={<Building2 />}
            titulo="Nenhuma empresa ativa"
            descricao="Selecione uma empresa ativa para acessar o módulo de compras."
          />
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
            // Quem começa agora entra pelo sistema VIVO de pedidos (aba
            // Pedidos, tabela `pedidos`), não pelo formulário legado de
            // `pedidos_compra`, cujos registros nenhuma lista exibe.
            onNovoPedido={() => { setPularOnboarding(true); setMainTab('pedidos'); setNovoPedidoAoEntrar(true); }}
            onEstoque={() => { setPularOnboarding(true); setMainTab('estoque'); openNovoProduto(); }}
            onImportarNfe={() => { resetNfeDialog(); setNfeOpen(true); }}
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {/* Princípio 3: a carga que falhou diz o que aconteceu e oferece
              nova tentativa, em vez de deixar a tela parecendo vazia. */}
          {erroCarga && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">Não foi possível carregar os dados de compras: {erroCarga}</span>
                <Button size="sm" variant="outline" onClick={() => void loadAll()}>Tentar novamente</Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Abas sublinhadas do módulo Gestão. Os `value` são os mesmos de
              sempre (pedidos|produtos|fornecedores|estoque|nfe|certificado) —
              o que mudou é que agora eles moram em `?aba=`. */}
          <AbasGestao
            valor={mainTab}
            aoMudar={(v) => {
              setMainTab(v);
              // Rede de segurança preservada: entrar em Estoque ou Produtos
              // busca os produtos de novo.
              if (v === 'estoque' || v === 'produtos') void loadAll();
            }}
            abas={[
              { valor: 'pedidos', rotulo: 'Pedidos' },
              { valor: 'produtos', rotulo: 'Produtos' },
              { valor: 'fornecedores', rotulo: 'Fornecedores', contagem: pessoasFornecedores.length },
              { valor: 'estoque', rotulo: 'Estoque', contagem: produtos.length },
              { valor: 'nfe', rotulo: 'NF-e', contagem: nfes.length },
              { valor: 'certificado', rotulo: 'Certificado' },
            ]}
          />

          {/* ══ ABA PEDIDOS ══ */}
          {mainTab === 'pedidos' && <PedidosOmie ref={pedidosRef} />}

          {/* ══ ABA PRODUTOS ══ */}
          {mainTab === 'produtos' && <ProdutosOmie aoMudar={loadAll} />}

          {/* ══ ABA FORNECEDORES ══ */}
          {mainTab === 'fornecedores' && (
            <AreaComPainel
              painel={painelFornecedor}
              tituloPainel={selectedForn?.nome ?? 'Fornecedor'}
              aoFechar={() => setSelectedForn(null)}
            >
              <div className="flex min-w-0 flex-col gap-4">
                <BarraFiltros
                  busca={fornSearch}
                  aoBuscar={setFornSearch}
                  placeholderBusca="Buscar fornecedor, CNPJ ou e-mail..."
                  filtrosAplicados={fornSearch ? 1 : 0}
                  aoLimpar={() => setFornSearch('')}
                  acao={
                    <Button onClick={() => { setEditingPessoa(null); setPessoaOpen(true); }}>
                      <Plus className="h-4 w-4" /> Novo fornecedor
                    </Button>
                  }
                />
                <TabelaGestao
                  descricao="Fornecedores cadastrados da empresa"
                  itens={filtForn}
                  chaveDoItem={(f) => f.id}
                  aoSelecionar={(f) => setSelectedForn(f)}
                  selecionado={(f) => selectedForn?.id === f.id}
                  colunas={[
                    {
                      chave: 'nome', titulo: 'Fornecedor',
                      render: (f) => (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{f.nome}</span>
                          {f.nome_fantasia && <span className="g-meta truncate text-muted-foreground">{f.nome_fantasia}</span>}
                        </span>
                      ),
                    },
                    {
                      chave: 'documento', titulo: 'Documento', prioridade: 'desktop',
                      render: (f) => f.documento || <ValorIndisponivel razao="Não informado" />,
                    },
                    {
                      chave: 'contato', titulo: 'Contato', prioridade: 'desktop',
                      render: (f) => (
                        <span className="flex min-w-0 flex-col">
                          {f.email && <span className="truncate">{f.email}</span>}
                          {f.telefone && <span className="g-meta text-muted-foreground">{f.telefone}</span>}
                          {!f.email && !f.telefone && <ValorIndisponivel razao="Sem contato" />}
                        </span>
                      ),
                    },
                    {
                      chave: 'situacao', titulo: 'Situação', largura: '11rem',
                      render: (f) => (
                        <span className="flex flex-wrap gap-1">
                          <SeloSituacao tom={f.ativo ? 'ativo' : 'neutro'}>{f.ativo ? 'Ativo' : 'Inativo'}</SeloSituacao>
                          {f.tipo === 'ambos' && <SeloSituacao tom="neutro">Também cliente</SeloSituacao>}
                        </span>
                      ),
                    },
                  ]}
                  vazio={
                    <EstadoVazio
                      icone={<Users />}
                      titulo={fornSearch ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                      descricao={fornSearch ? 'Ajuste a busca para ver outros cadastros.' : 'Cadastre os fornecedores com quem a empresa compra.'}
                      acao={!fornSearch && <Button onClick={() => { setEditingPessoa(null); setPessoaOpen(true); }}><Plus className="h-4 w-4" /> Novo fornecedor</Button>}
                    />
                  }
                  rodape={`${filtForn.length} de ${pessoasFornecedores.length} fornecedor(es)`}
                />
              </div>
            </AreaComPainel>
          )}

          {/* ══ ABA ESTOQUE ══ */}
          {mainTab === 'estoque' && (
            <AreaComPainel
              painel={painelProduto}
              tituloPainel={selectedProduto?.descricao ?? 'Produto'}
              aoFechar={() => setSelectedProduto(null)}
            >
              <div className="flex min-w-0 flex-col gap-4">
                <FaixaIndicadores
                  itens={[
                    { rotulo: 'Produtos ativos', valor: produtos.filter(p => p.ativo).length, icone: Package },
                    {
                      rotulo: 'Abaixo do mínimo', valor: prodAlerta, icone: AlertCircle,
                      tom: prodAlerta > 0 ? 'aviso' : 'neutro',
                      aoClicar: () => setEstoqSituacao(estoqSituacao === 'alerta' ? 'todas' : 'alerta'),
                      ativo: estoqSituacao === 'alerta',
                    },
                    {
                      rotulo: 'Reservado',
                      // `null` quando a apuração não veio — a faixa mostra "—"
                      // com a razão, nunca 0.
                      valor: reservas ? [...reservas.values()].reduce((s, v) => s + v, 0).toLocaleString('pt-BR') : null,
                      razaoIndisponivel: 'Reserva não apurada',
                      detalhe: 'Pedidos de contrato pendentes',
                      icone: Boxes,
                    },
                    { rotulo: 'Valor em estoque', valor: fmtCurrency(valorEstoque), detalhe: 'Saldo físico × custo médio', icone: DollarSign, tom: 'ok' },
                  ]}
                />

                <BarraFiltros
                  busca={estoqSearch}
                  aoBuscar={setEstoqSearch}
                  placeholderBusca="Buscar produto, código ou categoria..."
                  filtrosAplicados={filtrosEstoqueAplicados}
                  aoLimpar={() => { setEstoqSearch(''); setEstoqSituacao('todas'); }}
                  acao={<Button onClick={openNovoProduto}><Plus className="h-4 w-4" /> Novo produto</Button>}
                >
                  <Select value={estoqSituacao} onValueChange={setEstoqSituacao}>
                    <SelectTrigger className="g-controle w-52" aria-label="Situação do estoque"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as situações</SelectItem>
                      <SelectItem value="alerta">Abaixo do mínimo</SelectItem>
                      <SelectItem value="sem_saldo">Sem saldo</SelectItem>
                      <SelectItem value="inativos">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </BarraFiltros>

                {/* Falhou a apuração da reserva: a tela diz, com o erro do
                    banco, em vez de mostrar zero nas duas colunas. */}
                {reservasErro && (
                  <AvisoDeContexto
                    titulo="Reserva e disponível não apurados"
                    acao={<Button size="sm" variant="outline" onClick={() => void loadReservas()}>Tentar novamente</Button>}
                  >
                    {`Não foi possível somar os pedidos de contrato pendentes: ${reservasErro}`}
                  </AvisoDeContexto>
                )}

                <TabelaGestao
                  descricao="Produtos em estoque com saldo físico, reserva e disponibilidade"
                  itens={filtProdutos}
                  chaveDoItem={(p) => p.id}
                  aoSelecionar={(p) => { setSelectedProduto(p); setAbaProduto('movimentacoes'); }}
                  selecionado={(p) => selectedProduto?.id === p.id}
                  colunas={[
                    {
                      chave: 'produto', titulo: 'Produto',
                      render: (p) => (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{p.descricao}</span>
                          {p.categoria && <span className="g-meta truncate text-muted-foreground">{p.categoria}</span>}
                        </span>
                      ),
                    },
                    {
                      chave: 'codigo', titulo: 'Código', prioridade: 'desktop', largura: '8rem',
                      render: (p) => p.codigo || <ValorIndisponivel razao="Sem código" />,
                    },
                    {
                      chave: 'unidade', titulo: 'Unidade', alinhamento: 'centro', prioridade: 'desktop', largura: '6rem',
                      render: (p) => p.unidade,
                    },
                    {
                      chave: 'fisico', titulo: 'Saldo físico', alinhamento: 'direita', largura: '8rem',
                      tituloCurto: 'Físico',
                      render: (p) => estoqueDoProduto(p).fisico.toLocaleString('pt-BR'),
                    },
                    {
                      chave: 'reservado', titulo: 'Reservado', alinhamento: 'direita', prioridade: 'desktop', largura: '9rem',
                      render: (p) => {
                        const { reservado } = estoqueDoProduto(p);
                        return reservado === null
                          ? <ValorIndisponivel razao="Não apurado" />
                          : reservado.toLocaleString('pt-BR');
                      },
                    },
                    {
                      chave: 'disponivel', titulo: 'Disponível', alinhamento: 'direita', largura: '9rem',
                      render: (p) => {
                        const { disponivel } = estoqueDoProduto(p);
                        if (disponivel === null) return <ValorIndisponivel razao="Não apurado" />;
                        return (
                          <span className={disponivel < 0 ? 'font-semibold text-destructive-ink' : undefined}>
                            {disponivel.toLocaleString('pt-BR')}
                          </span>
                        );
                      },
                    },
                    {
                      chave: 'situacao', titulo: 'Situação', largura: '12rem',
                      render: (p) => {
                        const s = situacaoDoProduto(p);
                        return <SeloSituacao tom={s.tom} explicacao={s.explicacao}>{s.texto}</SeloSituacao>;
                      },
                    },
                  ]}
                  vazio={
                    <EstadoVazio
                      icone={<Warehouse />}
                      titulo={filtrosEstoqueAplicados ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                      descricao={filtrosEstoqueAplicados ? 'Ajuste a busca ou a situação para ver outros produtos.' : 'Cadastre os produtos e materiais que a empresa controla em estoque.'}
                      acao={!filtrosEstoqueAplicados && <Button onClick={openNovoProduto}><Plus className="h-4 w-4" /> Novo produto</Button>}
                    />
                  }
                  rodape={
                    <>
                      <span>{filtProdutos.length} de {produtos.length} produto(s)</span>
                      {/* A origem das colunas derivadas fica declarada onde
                          elas aparecem, não só no código. */}
                      <span className="g-meta">
                        Reservado = pedidos de contrato pendentes ou parciais · Disponível = físico − reservado
                      </span>
                    </>
                  }
                />
              </div>
            </AreaComPainel>
          )}

          {/* ══ ABA NF-e ══ */}
          {mainTab === 'nfe' && (
            <AreaComPainel
              painel={painelNfe}
              tituloPainel={selectedNfe ? `NF-e ${selectedNfe.numero}/${selectedNfe.serie}` : 'NF-e'}
              aoFechar={() => setSelectedNfe(null)}
            >
              <div className="flex min-w-0 flex-col gap-4">
                <FaixaIndicadores
                  itens={[
                    { rotulo: 'Notas no acervo', valor: nfes.length, icone: FileText },
                    {
                      rotulo: 'Entradas a conferir', valor: nfesPendentes, icone: PackagePlus,
                      tom: nfesPendentes > 0 ? 'aviso' : 'neutro',
                      aoClicar: () => setNfeSituacao(nfeSituacao === 'pendente' ? 'todas' : 'pendente'),
                      ativo: nfeSituacao === 'pendente',
                    },
                    { rotulo: 'Valor das notas', valor: fmtCurrency(valorNfes), detalhe: 'Soma do acervo', icone: DollarSign },
                  ]}
                />

                <BarraFiltros
                  busca={nfeSearch}
                  aoBuscar={setNfeSearch}
                  placeholderBusca="Buscar por número, emitente, CNPJ ou chave..."
                  filtrosAplicados={filtrosNfeAplicados}
                  aoLimpar={() => { setNfeSearch(''); setNfeDe(''); setNfeAte(''); setNfeSituacao('todas'); }}
                  acao={
                    <>
                      {/* O pedido LEGADO (`pedidos_compra`) é o único alvo que a
                          coluna nfe_entradas.pedido_id aceita — é por isso que
                          este formulário continua acessível, e é a única porta
                          que restou para ele. Ver o comentário do cabeçalho
                          sobre os dois sistemas de pedido. */}
                      <Button variant="outline" onClick={() => { resetPedidoForm(); setPedidoOpen(true); }}>
                        <Truck className="h-4 w-4" /> Pedido ao fornecedor
                      </Button>
                      <Button onClick={() => { resetNfeDialog(); setNfeOpen(true); }}>
                        <Plus className="h-4 w-4" /> Importar NF-e
                      </Button>
                    </>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="nfe-de" className="g-meta text-muted-foreground">Emissão de</Label>
                    <Input id="nfe-de" type="date" value={nfeDe} onChange={e => setNfeDe(e.target.value)} className="g-controle w-40" />
                    <Label htmlFor="nfe-ate" className="g-meta text-muted-foreground">até</Label>
                    <Input id="nfe-ate" type="date" value={nfeAte} onChange={e => setNfeAte(e.target.value)} className="g-controle w-40" />
                  </div>
                  <Select value={nfeSituacao} onValueChange={setNfeSituacao}>
                    <SelectTrigger className="g-controle w-56" aria-label="Situação do estoque"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as situações</SelectItem>
                      <SelectItem value="pendente">Entrada a conferir</SelectItem>
                      <SelectItem value="lancada">Estoque lançado</SelectItem>
                      <SelectItem value="sem_xml">Sem XML</SelectItem>
                    </SelectContent>
                  </Select>
                </BarraFiltros>

                <TabelaGestao
                  descricao="NF-e de entrada recebidas pela empresa"
                  itens={filtNfes}
                  chaveDoItem={(n) => n.id}
                  aoSelecionar={(n) => { setSelectedNfe(n); setAbaNfe('resumo'); }}
                  selecionado={(n) => selectedNfe?.id === n.id}
                  colunas={[
                    {
                      chave: 'numero', titulo: 'Número / Série', largura: '10rem', tituloCurto: 'Nota',
                      render: (n) => (
                        <span className="flex flex-col">
                          <span className="font-medium text-foreground">Nº {n.numero}</span>
                          <span className="g-meta text-muted-foreground">Série {n.serie}</span>
                        </span>
                      ),
                    },
                    {
                      chave: 'emitente', titulo: 'Emitente',
                      render: (n) => (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{n.emitente_nome || 'Não informado'}</span>
                          {n.emitente_cnpj && <span className="g-meta truncate text-muted-foreground">{n.emitente_cnpj}</span>}
                        </span>
                      ),
                    },
                    {
                      chave: 'emissao', titulo: 'Emissão', prioridade: 'desktop', largura: '8rem',
                      render: (n) => n.data_emissao ? fmtDate(n.data_emissao) : <ValorIndisponivel razao="Sem data" />,
                    },
                    {
                      chave: 'valor', titulo: 'Valor', alinhamento: 'direita', largura: '9rem',
                      render: (n) => fmtCurrency(Number(n.valor_total) || 0),
                    },
                    {
                      chave: 'pedido', titulo: 'Pedido', prioridade: 'desktop', largura: '12rem',
                      render: (n) => {
                        const ped = pedidos.find(p => p.id === n.pedido_id);
                        return ped
                          ? <span className="truncate">{ped.observacoes || 'Pedido de compra'}</span>
                          : <ValorIndisponivel razao="Sem vínculo" />;
                      },
                    },
                    {
                      chave: 'estoque', titulo: 'Situação do estoque', largura: '13rem', tituloCurto: 'Estoque',
                      render: (n) => {
                        const s = situacaoEstoqueDaNfe(n);
                        return <SeloSituacao tom={s.tom} explicacao={s.explicacao}>{s.texto}</SeloSituacao>;
                      },
                    },
                    {
                      chave: 'acoes', titulo: <span className="sr-only">Ações</span>, alinhamento: 'direita',
                      prioridade: 'desktop', largura: '11rem',
                      render: (n) => (
                        <span className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {/* O Set nfesComEstoque continua decidindo: nota já
                              lançada não oferece o botão de novo. */}
                          {!nfesComEstoque.has(n.id) && n.xml && (
                            <Button size="sm" variant="outline" className="whitespace-nowrap"
                              onClick={() => abrirLancamentoEstoque(n)}>
                              <PackagePlus className="h-4 w-4" /> Conferir
                            </Button>
                          )}
                          {n.xml && (
                            <Button size="sm" variant="ghost" className="w-9 px-0" aria-label={`Baixar XML da NF-e ${n.numero}`}
                              onClick={() => baixarXml(n)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="w-9 px-0" aria-label={`Excluir NF-e ${n.numero}`}
                            onClick={() => setNfeAExcluir(n)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </span>
                      ),
                    },
                  ]}
                  vazio={
                    <EstadoVazio
                      icone={<FileText />}
                      titulo={filtrosNfeAplicados ? 'Nenhuma NF-e encontrada' : 'Nenhuma NF-e importada'}
                      descricao={filtrosNfeAplicados ? 'Ajuste os filtros para ver outras notas.' : 'Importe o XML ou o DANFE das notas recebidas para lançar o estoque.'}
                      acao={!filtrosNfeAplicados && <Button onClick={() => { resetNfeDialog(); setNfeOpen(true); }}><Plus className="h-4 w-4" /> Importar NF-e</Button>}
                    />
                  }
                  rodape={`${filtNfes.length} de ${nfes.length} nota(s)`}
                />
              </div>
            </AreaComPainel>
          )}

          {/* ══ ABA CERTIFICADO ══ */}
          {mainTab === 'certificado' && <CertificadoDigital />}
        </div>
      )}

      {/* ══ DIALOGS GLOBAIS ══════════════════════════════════════ */}

      {/* Confirmações — nenhuma exclusão desta tela apaga no primeiro clique. */}
      {confirmarExclusaoPedido}

      <AlertDialog open={!!fornAExcluir} onOpenChange={o => { if (!o) setFornAExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este fornecedor?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">{fornAExcluir?.nome}</p>
                <p>
                  O cadastro é compartilhado com o Financeiro: some das duas telas. Lançamentos e
                  notas já registrados permanecem, mas ficam sem o cadastro por trás.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => fornAExcluir && handleDeleteFornecedor(fornAExcluir)}
            >
              Excluir fornecedor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!produtoAExcluir} onOpenChange={o => { if (!o) setProdutoAExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">{produtoAExcluir?.descricao}</p>
                <p>
                  Produto com movimentações de estoque não sai — o banco recusa, e a tela mostra o
                  motivo. Sem movimentações, a exclusão é definitiva.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => produtoAExcluir && handleDeleteProduto(produtoAExcluir.id)}
            >
              Excluir produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!nfeAExcluir} onOpenChange={o => { if (!o) setNfeAExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta NF-e do acervo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  Nº {nfeAExcluir?.numero} · Série {nfeAExcluir?.serie} — {nfeAExcluir?.emitente_nome || 'emitente não informado'}
                </p>
                <p>
                  O XML guardado vai junto. As movimentações de estoque que vieram dela
                  permanecem — o saldo não muda. Não há como desfazer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => nfeAExcluir && handleDeleteNfe(nfeAExcluir.id)}
            >
              Excluir NF-e
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


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
                        {/* ── Finalidade da compra ─────────────────────────
                            É o parâmetro do crédito de ICMS, e é do ITEM: a
                            mesma mercadoria entra para o escritório numa nota e
                            para o cliente noutra. Fica ao lado do produto
                            porque as duas decisões são tomadas juntas, olhando
                            a mesma linha da nota. */}
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`nfe-fim-${idx}`} className="g-meta text-muted-foreground">
                            Para que esta compra serve
                          </Label>
                          <Select
                            value={m.finalidade}
                            onValueChange={(v) =>
                              setNfeItemMaps((arr) =>
                                arr.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        finalidade: v as FinalidadeDaEntrada,
                                        // Escolha da pessoa deixa de ser sugestão.
                                        finalidadeOrigem: 'manual',
                                        finalidadeProcedencia: 'escolha de quem lançou',
                                      }
                                    : x,
                                ),
                              )
                            }
                          >
                            <SelectTrigger id={`nfe-fim-${idx}`} className="g-controle">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(['revenda', 'uso_consumo', 'imobilizado', 'materia_prima', 'nao_informada'] as FinalidadeDaEntrada[]).map((f) => (
                                <SelectItem key={f} value={f}>
                                  {ROTULO_FINALIDADE[f]} — {DESCRICAO_FINALIDADE[f]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {(() => {
                            const credito = avaliarCreditoIcms(
                              m.finalidade,
                              empresaAtiva?.regime_tributario as never,
                            );
                            const tom =
                              credito.situacao === 'permitido'
                                ? 'text-success-ink'
                                : credito.situacao === 'a_conferir'
                                  ? 'text-warning-ink'
                                  : 'text-muted-foreground';
                            return (
                              <p className={`g-meta ${tom}`}>
                                <span className="font-semibold">ICMS: </span>
                                {credito.resumo}
                                {credito.fundamento && (
                                  <span className="text-muted-foreground"> ({credito.fundamento})</span>
                                )}
                                {m.finalidadeOrigem !== 'manual' && m.finalidade !== 'nao_informada' && (
                                  <span className="text-muted-foreground">
                                    {' '}· sugerido pelo {m.finalidadeProcedencia}, confirme
                                  </span>
                                )}
                              </p>
                            );
                          })()}
                        </div>

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
                                <p className="text-destructive-ink">Tributos + despesas + margem alvo somam 100% ou mais — nenhum preço fecha; revise a margem alvo em Custos por Contrato.</p>
                              )}
                              {ref && sit === 'abaixo_minimo' && (
                                <p className="text-destructive-ink">⚠ O contrato {ref.numero} paga {fmtCurrency(ref.preco)} — ABAIXO do mínimo: entregar é prejuízo. Caminho jurídico: reequilíbrio (art. 124, II, “d”).</p>
                              )}
                              {ref && sit === 'entre_minimo_e_sugerido' && (
                                <p className="text-warning-ink">O contrato {ref.numero} paga {fmtCurrency(ref.preco)} — cobre custos e tributos, mas fica abaixo da margem alvo.</p>
                              )}
                              {ref && sit === 'acima_sugerido' && (
                                <p className="text-success-ink">O contrato {ref.numero} paga {fmtCurrency(ref.preco)} ✓ acima da venda sugerida.</p>
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
