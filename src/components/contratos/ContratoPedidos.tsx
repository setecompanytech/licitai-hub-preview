import { useState, useEffect, useRef, useMemo } from 'react';
import { avaliarCabimento, fraseDoLimite } from '@/lib/contratos/cabimento';
import { auditarPedidos } from '@/lib/contratos/auditoria-de-pedidos';
import { limiteDeEntrega } from '@/lib/contratos/prazo-de-entrega';
import { normalizarNumeroEmpenho, tipoDeEmpenho, ROTULO_DO_EMPENHO, empenhoCancelado } from '@/lib/contratos/empenho';
import { STATUS_QUE_RESERVAM } from '@/lib/estoque/reserva';
import {
  oQueODocumentoCria, especieComOrigem, atribuirCotas,
  ROTULO_DA_COTA, ROTULO_DA_ORIGEM_DA_COTA,
} from '@/lib/contratos/autoriza-ou-consome';
import { formatarNumeroNfe, numeroNfeComoInteiro } from '@/lib/financeiro/chave-nfe';
import { proximoNumeroDePedido } from '@/lib/contratos/numero-do-pedido';
import { ordenarCandidatos, PONTOS_PARA_SUGERIR, type TituloCandidato } from '@/lib/contratos/casar-pedido';
import VincularLancamentoDialog from './VincularLancamentoDialog';
import MovimentosDoEmpenho, { type EmpenhoParaMovimentar } from './MovimentosDoEmpenho';
import EditarEmpenhoDialog, { type EmpenhoParaEditar } from './EditarEmpenhoDialog';
import { detalheDosEmpenhos, resumoDosEmpenhos } from '@/lib/contratos/empenhos-do-contrato';
import { agruparEmLotes, rotuloDoLote, type Lote, porUnidadeComposta } from '@/lib/contratos/lotes-de-pedidos';
import { parseNFeXML } from '@/lib/parseNFe';
import { abrirEspelho } from '@/lib/financeiro/espelho-da-nfe';
import { arquivoDanfe } from '@/lib/financeiro/danfe-pdf';
import type { NotaDoPedido } from '@/hooks/useNotaDoPedido';
import { FILTRO_ORIGINAL, FILTRO_TODOS, filtrarPorSituacao, rotuloDoItemNoSeletor, situacaoPorItem, termosDoFiltro, type LinhaAplicada, type SituacaoDoItem } from '@/lib/contratos/situacao-do-item';
import type { PedidoParaCasar } from '@/lib/contratos/casar-pedido';
import { useSituacaoJuridica } from '@/hooks/useSituacaoJuridica';
import AvisoDePrazoDeEntrega, { type PrazosDoContrato } from './AvisoDePrazoDeEntrega';
import { situacaoDoPrazo } from '@/lib/contratos/prazo-de-entrega';
import { useDocumentoFiscal, useDocumentosPorNumeroNota, chaveDoNumero } from '@/hooks/useDocumentoFiscal';
import { useNotasDosPedidos } from '@/hooks/useNotaDoPedido';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rotuloDoMotivo } from '@/lib/contratos/encerramento';
import { buscarRecebimentoDaNota } from '@/lib/financeiro/buscar-recebimento-da-nota';
import { avisoDeExecucaoIncompativel } from '@/lib/contratos/instrumentos';
import KitFaturamento from '@/components/financeiro/KitFaturamento';
import {
  Plus, Trash2, Loader2, ShoppingCart, CheckCircle2, Clock, XCircle,
  Upload, FileText, AlertTriangle, DollarSign, Receipt, Pencil, ArrowUpDown, ArrowUp, ArrowDown,
  ExternalLink, Link2, Eye, TrendingUp, Ban, ChevronDown, ChevronUp, Undo2,
} from 'lucide-react';
import GerarPreNotaDialog from './GerarPreNotaDialog';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { MoneyInput } from '@/components/ui/money-input';
import AbasGestao from '@/components/gestao/AbasGestao';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import FaixaIndicadores from '@/components/gestao/FaixaIndicadores';
import SeloSituacao, { ValorIndisponivel, AvisoDeContexto } from '@/components/gestao/SeloSituacao';
import ComprasDoPedidoDialog from './ComprasDoPedidoDialog';
import { fraseDaCobertura, ROTULO_SITUACAO, situacaoDoCusto, type SituacaoDoCusto } from '@/lib/contratos/cobertura-de-custo';
import { unidadeLegivel } from '@/lib/texto/unidade';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import TextoRecolhido from '@/components/shared/TextoRecolhido';
import SecaoRecolhivel from '@/components/ui/secao-recolhivel';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Editor monetário inline: salva ao perder o foco. */
function CustoInlineEditor({ initialValue, onSave }: { initialValue: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState<number>(initialValue);
  return (
    <MoneyInput
      value={val}
      onValueChange={setVal}
      onBlur={() => onSave(val)}
      className="h-7 w-28 text-xs"
    />
  );
}

type ContratoItem = { id: string; codigo_item: string | null; descricao: string; unidade: string; valor_unitario: number; origem_aditivo_id: string | null; produto_id?: string | null };
type AditivoRef = { id: string; numero_aditivo: string; tipo: string };

// O rótulo do item nos seletores vem da SITUAÇÃO (último termo aplicado à
// linha, `lib/contratos/situacao-do-item.ts`), não da camada que a criou:
// "[Contrato Original]" em item reajustado por três termos foi o erro de 28/09.
type Pedido = {
  id: string; numero_pedido: string; descricao: string | null;
  contrato_item_id: string | null; quantidade: number; valor_unitario: number;
  valor_total: number; data_pedido: string | null; data_entrega: string | null;
  status: string; nota_fiscal: string | null; observacoes: string | null;
  nf_quitada: boolean; data_quitacao: string | null;
  /** Custo de compra DECLARADO (22/09): unitário × quantidade pelo gatilho do banco. Gerencial. */
  custo_unitario?: number | null;
  custo_total?: number | null;
  /** Unidade composta do lote (30/09): "cesta básica" × quantas o lote entrega. */
  unidade_composta?: string | null;
  unidades_compostas?: number | null;
  custo_declarado_em?: string | null;
  pedido_id?: string | null;
  /**
   * Colunas que vieram de migration colada à mão e que o `types.ts` gerado
   * ainda não conhece — por isso os inserts daqui passam por `as any`. Elas
   * EXISTEM no banco e chegam no `select('*')`; declará-las opcionais é o que
   * permite o painel do pedido mostrar de qual empenho a entrega sai, em que
   * cota, e qual documento a autorizou, em vez de recortar o tipo linha a
   * linha com cast inline.
   */
  numero_empenho?: string | null;
  empenho_id?: string | null;
  cota?: string | null;
  origem_aditivo_id?: string | null;
  arquivo_ordem_id?: string | null;
  /** Partes de uma nota rateada em N itens (29/09): mesma linha na tabela, painel do lote. */
  lote_id?: string | null;
};
/** O cruzamento do custo (tabela `contrato_pedidos_custo`, migration 20260923000001). */
type CustoDoPedido = {
  situacao: SituacaoDoCusto; comprovado_pago: number; comprovado_aberto: number; documento_em: string | null;
};
type NotaFiscalSync = {
  id: string; numero_nf: string | null; tipo: string; status: string | null;
  valor_total: number | null; data_emissao: string | null; chave_acesso: string | null;
  contrato_pedido_id: string | null; natureza_operacao: string | null;
  destinatario_razao_social: string | null;
};

const statusCfg: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning-tint text-warning-ink' },
  entregue: { label: 'Entregue', color: 'bg-success-tint text-success-ink' },
  parcial: { label: 'Parcial', color: 'bg-muted text-foreground' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive-tint text-destructive-ink' },
};

const kanbanCfg: Record<string, { label: string; color: string }> = {
  pedido:          { label: 'Aguard. Faturamento', color: 'bg-muted text-muted-foreground border-border' },
  separar_estoque: { label: 'Separar Estoque',     color: 'bg-warning-tint text-warning-ink border-warning-line' },
  faturar:         { label: 'Faturar',             color: 'bg-warning-tint text-warning-ink border-warning-line' },
  faturado:        { label: 'Faturado',            color: 'bg-success-tint text-success-ink border-success-line' },
  entrega:         { label: 'Em Entrega',          color: 'bg-muted text-foreground border-border' },
  cancelado:       { label: 'Cancelado',           color: 'bg-destructive-tint text-destructive-ink border-destructive-line' },
};

/** Uma linha do documento recém-lido, antes de a cota ser decidida. */
type LinhaLida = {
  key: string; descricao: string; quantidade: string; valor_unitario: string;
  contrato_item_id: string;
  /** O que a nota escreveu na linha, se escreveu algo. */
  cotaBruta: string | null;
  valorTotal: number;
};

const tiposDocumento = [
  { value: 'ordem_fornecimento', label: 'Ordem de Fornecimento (OF)' },
  { value: 'empenho_global', label: 'Empenho Global' },
  { value: 'empenho_ordinario', label: 'Empenho Ordinário' },
  { value: 'empenho_estimativo', label: 'Empenho Estimativo' },
  { value: 'prd', label: 'PRD (Pedido de Reposição de Demanda)' },
  { value: 'outro', label: 'Outro' },
];

export default function ContratoPedidos({ contratoId }: { contratoId: string }) {
  const { data: docsPorNumero } = useDocumentosPorNumeroNota();
  // A nota pelo VÍNCULO, não pelo número digitado. Ver useNotaDoPedido.
  const { data: notaDoPedido } = useNotasDosPedidos(contratoId);
  const { abrirArquivo, guardarArquivo, chaveJaArquivada } = useDocumentoFiscal();
  const [gerandoDanfe, setGerandoDanfe] = useState<string | null>(null);
  /**
   * O DANFE gerado do XML (30/09): quem tem o XML autorizado imprime o DANFE.
   * Nasce sozinho na importação; para nota que entrou antes, este botão gera,
   * guarda no cofre ligado ao título e a linha passa a "Abrir DANFE".
   */
  const gerarDanfeDaNota = async (nd: NotaDoPedido) => {
    if (!nd.arquivo_xml || !nd.lancamento_id) return;
    setGerandoDanfe(nd.lancamento_id);
    try {
      const nfe = parseNFeXML(nd.arquivo_xml);
      const arquivo = arquivoDanfe(nfe);
      const doc = await guardarArquivo(arquivo, {
        tipo: 'nfe', numero: nfe.numero_nf ? String(nfe.numero_nf) : null, serie: nfe.serie ? String(nfe.serie) : null,
        // A chave é única por empresa no cofre: o XML já a ocupa; o PDF entra ligado ao título.
        chave_acesso: (await chaveJaArquivada(nfe.chave_acesso)) ? null : (nfe.chave_acesso || null),
        data_emissao: nfe.data_emissao ? String(nfe.data_emissao).slice(0, 10) : null,
        valor_total: Number(nfe.v_nf) || 0, lancamento_id: nd.lancamento_id,
      });
      if (!doc) { toast.error('O DANFE foi gerado, mas não pôde ser guardado no cofre.'); return; }
      toast.success(`DANFE da NF-e ${nfe.numero_nf} gerado e guardado junto do título.`);
      void qc.invalidateQueries({ queryKey: ['nf-por-pedido'] });
    } catch (e) {
      toast.error('Não foi possível gerar o DANFE deste XML.', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setGerandoDanfe(null);
    }
  };

  /** Abre o DANFE arquivado no Financeiro, por URL assinada. */
  /**
   * Abre a Ordem de Fornecimento / Nota de Empenho que autorizou o pedido.
   *
   * O `arquivo_ordem_id` era gravado em três lugares e lido em nenhum: o PDF
   * ficava guardado e sem caminho até ele. Guardar sem dar como alcançar é
   * meio arquivamento — e é o documento que se apresenta quando o órgão
   * questiona quantidade empenhada.
   */
  const abrirOrdem = async (p: Pedido) => {
    const id = (p as { arquivo_ordem_id?: string | null }).arquivo_ordem_id;

    // Caminho direto: o pedido sabe qual arquivo o autorizou.
    if (id) {
      const { data } = await supabase
        .from('contrato_arquivos')
        .select('storage_path, nome_arquivo')
        .eq('id', id)
        .single();
      if (data?.storage_path) {
        void abrirArquivoDoContrato(data.storage_path, data.nome_arquivo ?? 'Ordem/Empenho');
        return;
      }
    }

    // Caminho de recuperação: pedido anterior ao vínculo, ou empenho anexado
    // pela aba Arquivos e Aditivos em vez do upload de pedido. O documento
    // existe, só não foi ligado — e procurá-lo pelo número é melhor do que
    // dizer que não há.
    const numero = String(p.numero_pedido ?? '').replace(/\D+/g, '');
    if (numero.length >= 4) {
      const { data: candidatos } = await supabase
        .from('contrato_arquivos')
        .select('id, storage_path, nome_arquivo')
        .eq('contrato_id', contratoId);
      const achado = (candidatos ?? []).find((a) =>
        String(a.nome_arquivo ?? '').replace(/\D+/g, '').includes(numero.slice(-6)),
      );
      if (achado?.storage_path) {
        // Liga para a próxima vez: achar de novo a cada clique seria repetir
        // uma busca cuja resposta já se conhece.
        await supabase
          .from('contrato_pedidos')
          .update({ arquivo_ordem_id: achado.id } as never)
          .eq('id', p.id);
        void abrirArquivoDoContrato(achado.storage_path, achado.nome_arquivo ?? 'Ordem/Empenho');
        load();
        return;
      }
    }

    // Terceiro caminho (21/09): o documento está no EMPENHO que autoriza o
    // pedido (`contrato_empenhos.arquivo_id`), não no pedido — é o caso comum
    // do empenho registrado pela subaba Empenhos. Dizer "nenhum documento" com
    // o empenho anexado logo abaixo era falso.
    const empenhoId = (p as { empenho_id?: string | null }).empenho_id;
    const empenhoLigado = empenhoId ? empenhosDoContrato.find((e) => e.id === empenhoId) : undefined;
    if (empenhoLigado?.arquivo_id) {
      await abrirDocumentoDoEmpenho(empenhoLigado.arquivo_id);
      return;
    }

    toast.info('Nenhum documento anexado a este pedido nem ao empenho que o autoriza.', {
      description: 'Use "Registrar Ordem/Empenho" para anexar a nota, ou a aba Arquivos e Aditivos.',
      action: { label: 'Ver o pedido', onClick: () => setPedidoSelecionado(p.id) },
    });
  };

  /**
   * Abre um documento do dossiê pelo id — o caminho que o empenho usa.
   *
   * O empenho guarda o PDF em `arquivo_id`, e não no pedido: ele é UM
   * documento que autoriza várias entregas, então repeti-lo em cada pedido
   * seria guardar a mesma nota tantas vezes quantas ela for consumida.
   */
  const abrirDocumentoDoEmpenho = async (arquivoId: string) => {
    const { data } = await supabase
      .from('contrato_arquivos')
      .select('storage_path, nome_arquivo')
      .eq('id', arquivoId)
      .single();
    if (data?.storage_path) {
      void abrirArquivoDoContrato(data.storage_path, data.nome_arquivo ?? 'Empenho');
      return;
    }
    toast.error('O documento não foi encontrado no dossiê.');
  };

  /**
   * Abre documento do FINANCEIRO — bucket `financeiro-documentos`.
   *
   * O nome antigo era `abrirDanfe`, e ele não dizia o armário. Isso produziu o
   * MESMO erro duas vezes no mesmo dia, nas duas direções: documento de
   * contrato assinado no bucket do Financeiro pela manhã, NF-e do Financeiro
   * assinada no bucket dos contratos à tarde. Assinar caminho no bucket errado
   * falha sempre — "Object not found" —, e nada no nome da função avisava.
   *
   * Agora os dois nomes carregam o armário, e escolher errado fica visível na
   * linha da chamada.
   */
  const abrirDocumentoDoFinanceiro = async (storagePath: string, nome: string) => {
    const url = await abrirArquivo(storagePath);
    if (!url) {
      toast.error('Não foi possível abrir o documento.', {
        description: `"${nome}" está guardado, mas o link de acesso falhou. Tente de novo.`,
      });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Abre um documento do CONTRATO — e o bucket é outro.
   *
   * `abrirDocumentoDoFinanceiro` assina em `financeiro-documentos`, onde moram
   * as DANFEs. Os documentos do contrato estão em `contratos-docs`. Assinar um
   * caminho no bucket errado falha sempre, e a mensagem convidava a tentar de
   * novo uma coisa que nunca ia dar certo.
   *
   * É a causa de "não consigo ver o empenho anexado", relatado duas vezes: o
   * vínculo estava certo, o caminho estava certo, o arquivo estava lá — só era
   * procurado no armário errado.
   */
  /** Abre documento do CONTRATO — bucket `contratos-docs`. */
  const abrirArquivoDoContrato = async (storagePath: string, nome: string) => {
    const { data, error } = await supabase.storage
      .from('contratos-docs')
      .createSignedUrl(storagePath, 600);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível abrir o documento.', {
        // A mensagem real do storage distingue "não está lá" de falha
        // passageira — e só uma das duas se resolve tentando de novo.
        description: `"${nome}": ${error?.message ?? 'link não gerado'}`,
      });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const qc = useQueryClient();

  // A NF-e anexada no Financeiro tem de aparecer AQUI sem F5 (08/09): o
  // vínculo e o documento mudam lá, e esta aba só sabia via cache de 60s.
  useEffect(() => {
    if (!contratoId || !empresaAtiva?.id) return;
    const canal = supabase
      .channel(`nf-pedidos-${contratoId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'financeiro_lancamentos', filter: `contrato_id=eq.${contratoId}` },
        () => qc.invalidateQueries({ queryKey: ['nf-por-pedido'] }))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'financeiro_documentos_fiscais', filter: `empresa_id=eq.${empresaAtiva.id}` },
        () => qc.invalidateQueries({ queryKey: ['nf-por-pedido'] }))
      // DELETE não atravessa filtro: o evento de exclusão carrega só a chave
      // da linha, sem empresa_id para comparar. Sem esta assinatura à parte,
      // apagar o documento pela lixeira não some da coluna até o F5.
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'financeiro_documentos_fiscais' },
        () => qc.invalidateQueries({ queryKey: ['nf-por-pedido'] }))
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [contratoId, empresaAtiva?.id, qc]);
  const navigate = useNavigate();
  const { isFinanceiro, isAdmin } = useMembroPermissoes();
  const podeVerCustos = isFinanceiro || isAdmin;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  /**
   * Subaba da aba Pedidos: o que CONSOME (pedidos/ordens) e o que AUTORIZA
   * (empenhos). Empilhados na mesma rolagem, um escondia o outro — e foi a
   * lista de empenhos invisível que levou ao cadastro em duplicidade do
   * 2026NE003716.
   */
  const [subAba, setSubAba] = useState<'pedidos' | 'empenhos'>('pedidos');
  /** Busca e filtro locais, sobre o que já está carregado. */
  const [buscaPedido, setBuscaPedido] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('__todos__');
  /** Pedido aberto no painel lateral — detalhe sem tirar a pessoa da lista. */
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string | null>(null);
  const [loteSelecionado, setLoteSelecionado] = useState<string | null>(null);
  // Ordem das partes na caixa do lote pelo NÚMERO do item do contrato (1, 2, 3…), crescente ou decrescente.
  const [ordemDoLote, setOrdemDoLote] = useState<'asc' | 'desc'>('asc');
  /**
   * Identificação do contrato para o painel do pedido. Vem das MESMAS colunas
   * do `select` que a aba já fazia — nenhuma consulta nova; só duas colunas a
   * mais, ambas de uso corrente no resto do módulo.
   */
  const [contratoInfo, setContratoInfo] = useState<{
    numero_contrato: string | null; orgao_contratante: string | null; valor_global: number | null;
  } | null>(null);
  /**
   * O contrato foi DECLARADO encerrado (21/09): pedido novo não entra — as
   * obrigações terminaram, e quem precisa lançar reabre no Resumo. Os pedidos
   * já lançados seguem editáveis: entrega, nota e quitação continuam.
   */
  const [contratoEncerrado, setContratoEncerrado] = useState<{ data: string | null; motivo: string | null } | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [aditivos, setAditivos] = useState<AditivoRef[]>([]);
  const [nfsSync, setNfsSync] = useState<NotaFiscalSync[]>([]);
  const [kanbanStatuses, setKanbanStatuses] = useState<Record<string, string>>({});
  const [updatingKanban, setUpdatingKanban] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  // Pré-NF dialog
  const [preNfDialogOpen, setPreNfDialogOpen] = useState(false);
  const [preNotas, setPreNotas] = useState<any[]>([]);

  // NF quitada dialog (setor financeiro)
  const [nfDialog, setNfDialog] = useState<Pedido | null>(null);
  const [nfNumero, setNfNumero] = useState('');
  const [nfData, setNfData] = useState('');
  const [nfValorPago, setNfValorPago] = useState('');
  const [solicitandoComissao, setSolicitandoComissao] = useState(false);

  // Edit state
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    numero_pedido: '', descricao: '', contrato_item_id: '',
    quantidade: '', valor_unitario: '', data_pedido: '',
    data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
    numero_empenho: '', tipo_empenho: '', valor_empenho: '', cota: '',
    empenho_id: '',
    custo_unitario: '',
  });
  const [reenviandoOrdem, setReenviandoOrdem] = useState(false);
  // O cruzamento do custo por pedido (22/09) e o diálogo das compras do pedido.
  const [custosPedidos, setCustosPedidos] = useState<Record<string, CustoDoPedido>>({});
  const [comprasDialog, setComprasDialog] = useState<Pedido | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete audit dialog
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; numero: string; lote?: { id: string; partes: string[] } } | null>(null);
  /**
   * Trocar o empenho (30/09): erro humano no vínculo não pode custar refazer o
   * lançamento. O empenho é fato do PEDIDO (empenho_id/numero/tipo em
   * contrato_pedidos); o título do Financeiro não o guarda. Trocar nas partes
   * do lote (ou no pedido solto) basta: o saldo de cada empenho é recalculado
   * pelas RPCs a partir dos pedidos.
   */
  const [trocaDeEmpenho, setTrocaDeEmpenho] = useState<{ rotulo: string; pedidos: string[]; atual: string | null } | null>(null);
  const [novoEmpenhoId, setNovoEmpenhoId] = useState<string>('');
  const [trocandoEmpenho, setTrocandoEmpenho] = useState(false);
  const confirmarTrocaDeEmpenho = async () => {
    if (!trocaDeEmpenho) return;
    const alvo = novoEmpenhoId === 'nenhum' ? null : empenhosDoContrato.find((e) => e.id === novoEmpenhoId) ?? null;
    if (novoEmpenhoId !== 'nenhum' && !alvo) return;
    setTrocandoEmpenho(true);
    const { error } = await supabase.from('contrato_pedidos')
      .update({ empenho_id: alvo?.id ?? null, numero_empenho: alvo?.numero ?? null, tipo_empenho: alvo?.tipo ?? null } as never)
      .in('id', trocaDeEmpenho.pedidos);
    setTrocandoEmpenho(false);
    if (error) { toast.error('Não foi possível trocar o empenho', { description: error.message }); return; }
    toast.success(alvo ? `Empenho trocado para ${alvo.numero} em ${trocaDeEmpenho.pedidos.length} pedido(s). Os saldos dos dois empenhos foram recalculados.` : `Vínculo com empenho removido de ${trocaDeEmpenho.pedidos.length} pedido(s).`);
    setTrocaDeEmpenho(null);
    load();
  };
  const [deleteReason, setDeleteReason] = useState('');
  // Desfazer quitação (21/09): o pedido em questão, o motivo e o que a
  // pré-leitura achou (títulos pagos, bonificações pagas/pendentes).
  const [desfazerDialog, setDesfazerDialog] = useState<Pedido | null>(null);
  const [desfazerMotivo, setDesfazerMotivo] = useState('');
  const [desfazendo, setDesfazendo] = useState(false);
  const [desfazerInfo, setDesfazerInfo] = useState<{
    titulosPagos: number; bonusPagas: number; bonusPendentes: number; valorBonusPendente: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
  // O que a leitura está fazendo e há quanto tempo: "Extraindo dados com
  // IA..." parado por um minuto parecia travamento (28/09/2026).
  const [etapaLeitura, setEtapaLeitura] = useState('');
  const [segundosLeitura, setSegundosLeitura] = useState(0);
  useEffect(() => {
    if (!uploading) { setSegundosLeitura(0); return; }
    const inicio = Date.now();
    const t = setInterval(() => setSegundosLeitura(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(t);
  }, [uploading]);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    numero_pedido: '', descricao: '', contrato_item_id: '',
    quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
    data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
    numero_empenho: '', tipo_empenho: '', valor_empenho: '', cota: '',
    // De qual empenho este pedido sai. É o vínculo que faz o saldo do empenho
    // baixar quando a entrega acontece — e não quando o dinheiro é reservado.
    empenho_id: '',
    tipo_documento: 'ordem_fornecimento', origem_aditivo_id: '',
  });
  const [origemFilter, setOrigemFilter] = useState<string>(FILTRO_TODOS);
  const [situacaoDosItens, setSituacaoDosItens] = useState<Map<string, SituacaoDoItem>>(new Map());
  const [ataSrpId, setAtaSrpId] = useState<string | null>(null);
  // Forma de execução declarada da ATA — é o que permite apontar o parcelamento.
  const [dadosExecucao, setDadosExecucao] = useState<{ forma: string | null; fundamento: string | null }>(
    { forma: null, fundamento: null },
  );
  const [itensAta, setItensAta] = useState<ContratoItem[]>([]);
  const [fonteItens, setFonteItens] = useState<'contrato' | 'ata'>('contrato');
  const [ataItemSelecionado, setAtaItemSelecionado] = useState('');
  /** Quando true, ao salvar pedido(s) o sistema também cria lançamento(s) "a receber" no Financeiro vinculados a este contrato. */
  const [gerarContaReceber, setGerarContaReceber] = useState(true);

  // Multi-item support
  const [extractedItens, setExtractedItens] = useState<Array<{
    key: string; descricao: string; quantidade: string; valor_unitario: string;
    contrato_item_id: string;
    // A cota de cada linha, e de onde ela saiu — rótulo do documento ou
    // dedução pela proporção 75/25. A tela diz qual das duas, porque deduzida
    // é para conferir, lida é para confiar.
    cota: string; cota_origem: 'documento' | 'proporcao' | 'indefinida';
  }>>([]);

  const [prazos, setPrazos] = useState<PrazosDoContrato | null>(null);
  // Registrar pedido num contrato que ainda não produz efeitos é o erro que
  // mais custa: a entrega sai, e a cobrança nasce sem título que a sustente.
  const { situacao: juridico } = useSituacaoJuridica(contratoId);
  // Pedido retroativo: o recebimento já está no Financeiro e o que falta é
  // ligá-los. Ver VincularLancamentoDialog.
  const [vinculando, setVinculando] = useState<PedidoParaCasar | null>(null);
  const [lendo, setLendo] = useState<Pedido | null>(null);
  // Saldo que resta no contrato — para o formulário avisar quando a edição
  // estoura o que sobrou, em vez de aceitar e deixar o consumo em 303%.
  const [saldoDoContrato, setSaldoDoContrato] = useState(0);
  // Saldo por cota dos empenhos deste contrato, para a checagem tripla.
  /** Os empenhos chegam numa consulta própria depois dos pedidos: enquanto não chegam, a tela diz "carregando", não "nenhum". */
  const [carregandoEmpenhos, setCarregandoEmpenhos] = useState(true);
  const [saldosDeEmpenho, setSaldosDeEmpenho] = useState<
    Array<{
      empenho_id: string; numero: string; tipo: string; arquivo_id: string | null;
      cota: string; saldo_qtd: number; qtd_empenhada: number;
      /** Do empenho inteiro, não da cota: é o que diz se ele foi cancelado. */
      valor_original: number; reforcos: number; anulacoes: number; valor_vigente: number;
      reforcado: boolean;
      // O saldo em VALOR. No estimativo é ele que vale: a quantidade impressa
      // na nota é formalidade — o 149/2024 traz "1 pacote" num contrato de
      // 3.600 —, e o que o empenho reservou de fato é dinheiro.
      saldo_valor: number;
    }>
  >([]);
  // O PDF da Ordem/Empenho guardado nesta sessão de upload, para ligar ao
  // pedido no momento em que ele for salvo.
  const [arquivoOrdem, setArquivoOrdem] = useState<string | null>(null);
  // O PDF ainda NÃO guardado: fica em memória até o Registrar. Anexar não é
  // registrar — quem desiste no meio não deixa arquivo solto no dossiê.
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null);
  /** O empenho cuja vida — reforços e anulações — está aberta. */
  const [movimentando, setMovimentando] = useState<EmpenhoParaMovimentar | null>(null);
  // Editar/apagar o empenho na íntegra (28/09/2026). `?empenho=<id>` abre
  // direto — é o atalho que o dossiê (Arquivos e Aditivos) usa.
  const [editandoEmpenho, setEditandoEmpenho] = useState<EmpenhoParaEditar | null>(null);
  const [abriuPelaUrl, setAbriuPelaUrl] = useState(false);

  /**
   * Guarda o PDF da Ordem/Empenho e devolve o id em `contrato_arquivos`.
   *
   * Chamada no momento de salvar, uma vez. Se o mesmo formulário já guardou o
   * arquivo (segunda tentativa depois de um erro), reaproveita — subir duas
   * vezes deixaria o dossiê com o mesmo documento em duplicidade.
   */
  const guardarArquivoDaOrdem = async (): Promise<string | null> => {
    if (arquivoOrdem) return arquivoOrdem;
    const file = arquivoPendente;
    if (!file) return null;
    // A política de `contrato_arquivos` é `auth.uid() = user_id`. Passar null
    // ali nunca satisfaz a comparação, e o insert volta como "violates row-
    // level security policy".
    if (!user?.id) {
      toast.warning('O PDF não pôde ser guardado: sessão sem usuário.');
      return null;
    }
    // A PRIMEIRA pasta tem de ser o auth.uid(): a política do bucket é
    // `auth.uid()::text = (storage.foldername(name))[1]`. Começar pelo
    // contrato faz o upload ser recusado com uma mensagem que soa como
    // problema de tabela e é do storage.
    const caminho = `${user.id}/${contratoId}/ordens/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
    const { error: upErr } = await supabase.storage
      .from('contratos-docs')
      .upload(caminho, file, { upsert: false, contentType: file.type });
    if (upErr) {
      // Não impede o registro, mas não passa calada: quem lançar precisa saber
      // que a autorização ficou de fora do dossiê.
      toast.warning('O PDF não pôde ser guardado no contrato.', { description: upErr.message });
      return null;
    }
    const { data: arq, error: arqErr } = await supabase
      .from('contrato_arquivos')
      .insert({
        contrato_id: contratoId,
        nome_arquivo: file.name,
        storage_path: caminho,
        tamanho_bytes: file.size,
        tipo: 'ordem_fornecimento',
        descricao: 'Ordem de Fornecimento / Nota de Empenho',
        user_id: user.id,
      } as never)
      .select('id')
      .single();
    if (arqErr) {
      toast.warning('O PDF subiu, mas não entrou no dossiê.', { description: arqErr.message });
      return null;
    }
    const id = (arq as { id: string } | null)?.id ?? null;
    setArquivoOrdem(id);
    return id;
  };

  /**
   * O aviso que o pedido dispara no instante em que é registrado.
   *
   * O usuário acabou de assumir uma obrigação com prazo — é aqui que ela
   * precisa ser dita, não numa tela que ele talvez não abra. Quando o contrato
   * não registra prazo, o aviso diz isso: silêncio seria lido como "não há
   * prazo", que é diferente de "ninguém cadastrou".
   */
  /**
   * Depois de salvar um pedido sem gerar conta a receber, procura no Financeiro
   * um título que pareça ser dele — e oferece o vínculo ali mesmo.
   *
   * O caminho do pedido retroativo tem três passos: lançar, abater saldo,
   * vincular ao título que já existe. Os três funcionavam, e eram três ações
   * separadas que o usuário precisava saber que existiam. A terceira é a que
   * impede a divergência com Contas a Receber, e era a mais fácil de esquecer
   * justamente por ser a última.
   *
   * Sugere, não vincula: casar sozinho o dinheiro de alguém é decisão que o
   * sistema não tem como tomar. O diálogo mostra os motivos e quem decide
   * confirma.
   */
  const sugerirVinculo = async (p: { id: string; numero_pedido: string; valor_total: number; data_pedido: string | null; nota_fiscal?: string | null }) => {
    if (!empresaAtiva?.id) return;
    const alvo = {
      id: p.id,
      numero_pedido: p.numero_pedido,
      valor_total: Number(p.valor_total) || 0,
      data_pedido: p.data_pedido,
      nota_fiscal: p.nota_fiscal ?? null,
    };
    const { data } = await supabase
      .from('financeiro_lancamentos')
      .select('id, descricao, valor, data_competencia, numero_documento, status, contrato_pedido_id, contrato_id')
      .eq('empresa_id', empresaAtiva.id)
      .eq('tipo', 'a_receber')
      .is('contrato_pedido_id', null)
      .limit(400);
    if (!data?.length) return;

    const fortes = ordenarCandidatos(alvo, data as unknown as TituloCandidato[])
      .filter((c) => c.pontos >= PONTOS_PARA_SUGERIR);
    if (fortes.length === 0) return;

    const primeiro = fortes[0];
    toast.info(
      `${fortes.length} lançamento(s) no Financeiro parece(m) ser deste pedido.`,
      {
        description: `${primeiro.descricao} · ${fmt(Number(primeiro.valor))} — ${primeiro.motivos.join(', ')}. Vincular evita contar a receita duas vezes.`,
        action: { label: 'Vincular', onClick: () => setVinculando(alvo) },
        duration: 20000,
      },
    );
  };

  /**
   * A data-limite de entrega, derivada da cláusula do contrato.
   *
   * O sistema já calculava isto para mostrar o aviso vermelho na linha do
   * pedido — e deixava o campo "Data de Entrega" vazio, pedindo que alguém
   * digitasse o que ele acabara de calcular.
   *
   * O marco é a data DO PEDIDO nos três tipos de empenho, e não por acaso: no
   * ordinário há uma entrega só e a data dela é a do empenho; no global e no
   * estimativo cada pedido abre o próprio prazo, contado da sua ordem de
   * fornecimento. Um marco só atende os três porque o pedido sempre carrega a
   * data que o inicia.
   *
   * Preenche, mas não tranca: a cláusula é a regra geral e a ordem pode trazer
   * prazo próprio. Quem editar sobrepõe.
   */
  /**
   * O pedido cabe nos três saldos que o limitam?
   *
   * Contrato, item e cota do empenho restringem a mesma entrega sem que um
   * implique o outro: o contrato pode ter saldo com o item esgotado, e o item
   * pode ter saldo com o empenho esgotado. Verificar um só deixa passar o que
   * os outros dois barrariam — foi assim que este contrato chegou a 303%.
   */
  const conferirCabimento = (qtd: number, valor: number, itemId: string, cota?: string | null) => {
    const item = itens.find((i) => i.id === itemId) as
      | { descricao?: string; codigo_item?: string; saldo_quantitativo?: number }
      | undefined;
    // Só o empenho escolhido, e dentro dele só a cota do pedido. Cair no
    // primeiro da lista quando a cota não bate confere o pedido contra o saldo
    // ERRADO — a reservada passaria por ter folga na principal, que é
    // exatamente a confusão que separar as cotas existe para evitar.
    const doEmpenho = form.empenho_id
      ? saldosDeEmpenho.filter((e) => e.empenho_id === form.empenho_id)
      : saldosDeEmpenho;
    const emp = cota
      ? doEmpenho.find((e) => e.cota === cota)
      : (doEmpenho.length === 1 ? doEmpenho[0] : undefined);
    return avaliarCabimento(
      { quantidade: qtd, valor },
      {
        empenho: emp
          ? {
              rotulo: `cota ${emp.cota} do empenho ${emp.numero}`,
              saldoQtd: emp.saldo_qtd,
              saldoValor: emp.saldo_valor,
              tipo: emp.tipo,
              reforcado: emp.reforcado,
            }
          : null,
        item: item?.saldo_quantitativo != null
          ? { rotulo: `item ${item.codigo_item ?? ''}`.trim(), saldoQtd: Number(item.saldo_quantitativo) }
          : null,
        contrato: { saldoValor: saldoDoContrato || null },
      },
    );
  };

  /** Os empenhos do contrato, um por número, com o saldo somado das cotas. */
  const empenhosDoContrato = useMemo(() => {
    const porId = new Map<string, {
      id: string; numero: string; tipo: string; arquivo_id: string | null;
      saldo: number; cancelado: boolean; vigente: number;
    }>();
    for (const s of saldosDeEmpenho) {
      const atual = porId.get(s.empenho_id);
      if (atual) atual.saldo += Number(s.saldo_qtd) || 0;
      else porId.set(s.empenho_id, {
        id: s.empenho_id, numero: s.numero, tipo: s.tipo, arquivo_id: s.arquivo_id,
        saldo: Number(s.saldo_qtd) || 0,
        // Cancelado é ANULAÇÃO que cobre tudo — não é saldo zero por consumo.
        // Os dois mostram zero e significam o oposto.
        cancelado: empenhoCancelado({
          valorOriginal: s.valor_original, reforcos: s.reforcos, anulacoes: s.anulacoes,
        }),
        vigente: Number(s.valor_vigente) || 0,
      });
    }
    return [...porId.values()];
  }, [saldosDeEmpenho]);

  /** O que o upload em curso vai criar: autorização ou consumo. */
  // A espécie entra junto: se a leitura achou "estimativo", "global" ou
  // "ordinário" no campo rotulado, aquilo é nota de empenho — e isso não
  // depende de como a IA escreveu o tipo do documento.
  const documentoCria = oQueODocumentoCria(
    extractedData?.tipo_documento || form.tipo_documento,
    extractedData?.especie_empenho || form.tipo_empenho,
  );

  /**
   * O aviso que não barra.
   *
   * O empenho estimativo entra no cabimento como referência, não como
   * impedimento — o saldo que o sistema conhece é parcial enquanto os reforços
   * não estiverem registrados. Mas silenciar seria pior: quem fatura precisa
   * saber que o reforço está pendente ANTES de a nota sair, porque pagar além
   * do empenhado é o que o art. 60 não admite.
   */
  const avisarDeReforco = (c: ReturnType<typeof avaliarCabimento>) => {
    for (const a of c.avisos) {
      // A frase sai do PRÓPRIO limite: `c.frase` fala do gargalo que decide, e
      // o aviso é sobre outro número.
      toast.warning(fraseDoLimite(a), { description: a.providencia });
    }
  };

  /**
   * O aviso leve da decisão 4 do dono (21/09): quando o pedido que acabou de
   * entrar esgota o saldo em valor do contrato, quem lançou fica sabendo que
   * há uma decisão a tomar — no Resumo, não aqui. Aviso, nunca janela: quem
   * opera pedidos nem sempre tem alçada para encerrar um contrato, e uma
   * pergunta neste momento induziria decisão apressada.
   */
  const avisarSaldoEsgotado = (valorDoPedido: number) => {
    if (!(saldoDoContrato > 0) || saldoDoContrato - valorDoPedido > 0) return;
    toast.info('Este pedido esgota o saldo do contrato.', {
      description: 'Há aditivo a registrar, ou o contrato chegou ao fim? A decisão fica no Resumo do contrato.',
      duration: 12000,
      action: {
        label: 'Abrir o Resumo',
        onClick: () => navigate(`/gestao-contratos?contrato=${contratoId}&aba=dashboard`),
      },
    });
  };

  const limiteDerivado = (dataDoPedido: string | null | undefined): string => {
    if (!prazos?.prazo_entrega_dias || !dataDoPedido) return '';
    return limiteDeEntrega(dataDoPedido, {
      dias: prazos.prazo_entrega_dias,
      unidade: (prazos.prazo_entrega_unidade as 'uteis' | 'corridos' | null) ?? null,
    }) ?? '';
  };

  const avisarPrazo = (dataDoPedido: string | null | undefined) => {
    // Antes do prazo de entrega, a pergunta anterior: este contrato já produz
    // efeitos? Sai primeiro porque é a que muda a decisão — de nada adianta
    // saber a data-limite de um pedido que não deveria existir ainda.
    if (juridico && !juridico.podeExecutar) {
      toast.warning(`Pedido registrado — ${juridico.titulo.toLowerCase()}`, {
        description: juridico.detalhe,
        duration: 14000,
      });
      return;
    }
    const s = situacaoDoPrazo(dataDoPedido, {
      dias: prazos?.prazo_entrega_dias ?? null,
      unidade: (prazos?.prazo_entrega_unidade as 'uteis' | 'corridos' | null) ?? null,
    });
    if (s.estado === 'sem_prazo') {
      toast.warning('Pedido registrado — prazo de entrega não cadastrado no contrato.', {
        description: 'O sistema não consegue calcular a data-limite. Reenvie o PDF do contrato ou preencha o prazo à mão.',
      });
      return;
    }
    toast.success('Pedido registrado.', {
      description: prazos?.local_entrega ? `${s.frase} · Entregar em: ${prazos.local_entrega}` : s.frase,
      duration: 8000,
    });
  };

  const load = async () => {
    setLoading(true);
    const [pedidosRes, itensRes, nfsRes, preNotasRes, aditivosRes, contratoRes] = await Promise.all([
      supabase.from('contrato_pedidos').select('*').eq('contrato_id', contratoId).order('data_pedido', { ascending: false }),
      supabase.from('contrato_itens').select('id, codigo_item, descricao, unidade, valor_unitario, origem_aditivo_id, produto_id').eq('contrato_id', contratoId),
      supabase.from('notas_fiscais').select('id, numero_nf, tipo, status, valor_total, data_emissao, chave_acesso, contrato_pedido_id, natureza_operacao, destinatario_razao_social').eq('contrato_id', contratoId),
      supabase.from('pre_notas_fiscais' as any).select('id, status, natureza_operacao, valor_total, created_at, motivo_rejeicao, motivo_devolucao').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
      supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      // `numero_contrato` e `orgao_contratante` entram aqui para o painel do
      // pedido dizer DE QUE contrato e DE QUE órgão ele é — a referência pede
      // os dois. São colunas antigas e de uso corrente (o cabeçalho do
      // relatório do Dashboard já as lê), então não repetem o risco da consulta
      // de prazos abaixo, que é separada justamente por depender de migration
      // colada à mão.
      supabase.from('contratos').select('ata_srp_id, tipo_documento, forma_execucao, art95_fundamento, saldo_remanescente, valor_global, numero_contrato, orgao_contratante, status, data_encerramento, motivo_encerramento').eq('id', contratoId).single(),
    ]);
    const pedidosData = (pedidosRes.data as any[]) || [];
    setPedidos(pedidosData);
    // O cruzamento do custo (22/09): tabela ao lado, de migration colada à
    // mão — ausente, a tela mostra o declarado e calcula o selo localmente.
    {
      const { data: cx } = await supabase
        .from('contrato_pedidos_custo' as never)
        .select('contrato_pedido_id, situacao, comprovado_pago, comprovado_aberto, documento_em')
        .eq('contrato_id', contratoId);
      const mapa: Record<string, CustoDoPedido> = {};
      for (const r of ((cx ?? []) as unknown as Array<CustoDoPedido & { contrato_pedido_id: string }>)) mapa[r.contrato_pedido_id] = r;
      setCustosPedidos(mapa);
    }
    // Fetch kanban status for linked pedidos
    const linkedIds = pedidosData.map((p: any) => p.pedido_id).filter(Boolean) as string[];
    if (linkedIds.length > 0) {
      const { data: kRows } = await supabase.from('pedidos').select('id, status').in('id', linkedIds);
      const kMap: Record<string, string> = {};
      for (const k of (kRows ?? []) as any[]) kMap[k.id] = k.status;
      setKanbanStatuses(kMap);
    } else {
      setKanbanStatuses({});
    }
    setItens((itensRes.data as any[]) || []);
    setNfsSync((nfsRes.data as any[]) || []);
    setPreNotas((preNotasRes.data as any[]) || []);
    setAditivos((aditivosRes.data as any[]) || []);
    // As linhas de termo aplicadas: é o que diz "3º TA" no seletor de itens.
    const { data: linhasAplicadas } = await supabase
      .from('contrato_aditivo_itens' as never)
      .select('contrato_item_id, aditivo_id, aplicado_em, aditivo:contrato_aditivos(numero_aditivo)')
      .eq('contrato_id', contratoId)
      .not('aplicado_em', 'is', null);
    setSituacaoDosItens(situacaoPorItem(((linhasAplicadas ?? []) as unknown as Array<{ contrato_item_id: string | null; aditivo_id: string; aplicado_em: string | null; aditivo: { numero_aditivo: string | null } | null }>)
      .map((l): LinhaAplicada => ({ contrato_item_id: l.contrato_item_id, aditivo_id: l.aditivo_id, aplicado_em: l.aplicado_em, numero_aditivo: l.aditivo?.numero_aditivo ?? null }))));
    setAtaSrpId((contratoRes.data as any)?.ata_srp_id ?? null);
    setSaldoDoContrato(Number((contratoRes.data as any)?.saldo_remanescente ?? 0));
    const cabecalho = contratoRes.data as unknown as { numero_contrato?: string | null; orgao_contratante?: string | null; valor_global?: number | string | null } | null;
    setContratoInfo({
      numero_contrato: cabecalho?.numero_contrato ?? null,
      orgao_contratante: cabecalho?.orgao_contratante ?? null,
      valor_global: cabecalho?.valor_global != null ? Number(cabecalho.valor_global) : null,
    });
    const fimDeclarado = contratoRes.data as unknown as {
      status?: string | null; data_encerramento?: string | null; motivo_encerramento?: string | null;
    } | null;
    setContratoEncerrado(fimDeclarado?.status === 'encerrado'
      ? { data: fimDeclarado.data_encerramento ?? null, motivo: fimDeclarado.motivo_encerramento ?? null }
      : null);

    // Empenhos e o saldo de cada cota. Consulta separada e tolerante: as
    // tabelas vêm de migration colada à mão, e sem elas a checagem apenas não
    // avalia o empenho — não impede ninguém de trabalhar.
    // Os saldos por empenho vinham um a um, em série (14 empenhos × 2 RPCs =
    // 28 idas ao banco em fila): a faixa dizia "Nenhum empenho registrado"
    // por segundos. Agora todos em paralelo, e a tela sabe que está esperando.
    setCarregandoEmpenhos(true);
    supabase
      .from('contrato_empenhos' as never)
      .select('id, numero, tipo, arquivo_id')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: true })
      .then(async ({ data: emps, error }) => {
        try {
          if (error || !emps?.length) { setSaldosDeEmpenho([]); return; }
          const lista = emps as unknown as Array<{ id: string; numero: string; tipo: string; arquivo_id: string | null }>;
          const respostas = await Promise.all(lista.map((e) => Promise.all([
            supabase.rpc('contrato_empenho_saldo_por_cota' as never, { p_empenho_id: e.id } as never),
            supabase.rpc('contrato_empenho_valor_vigente' as never, { p_empenho_id: e.id } as never),
          ])));
          const linhas: typeof saldosDeEmpenho = [];
          lista.forEach((e, i) => {
            const [{ data: saldo }, { data: vig }] = respostas[i];
            const v = ((vig ?? []) as unknown as Array<{
              valor_original: number; reforcos: number; anulacoes: number; valor_vigente: number;
            }>)[0];
            for (const s of (saldo ?? []) as unknown as Array<{
              cota: string; saldo_qtd: number; qtd_empenhada: number;
              /** Do empenho inteiro, não da cota: é o que diz se ele foi cancelado. */
              valor_original: number; reforcos: number; anulacoes: number; valor_vigente: number; saldo_valor: number;
            }>) {
              linhas.push({
                empenho_id: e.id, numero: e.numero, tipo: e.tipo, arquivo_id: e.arquivo_id,
                cota: s.cota, saldo_qtd: Number(s.saldo_qtd) || 0,
                qtd_empenhada: Number(s.qtd_empenhada) || 0,
                saldo_valor: Number(s.saldo_valor) || 0,
                valor_original: Number(v?.valor_original) || 0,
                reforcos: Number(v?.reforcos) || 0,
                anulacoes: Number(v?.anulacoes) || 0,
                valor_vigente: Number(v?.valor_vigente) || 0,
                reforcado: (Number(v?.reforcos) || 0) > 0 || (Number(v?.anulacoes) || 0) > 0,
              });
            }
          });
          setSaldosDeEmpenho(linhas);
        } finally {
          setCarregandoEmpenhos(false);
        }
      });
    // Consulta SEPARADA, de propósito. As colunas de prazo vêm da migration
    // 20260829000004, que é colada à mão no SQL Editor: enquanto ela não
    // rodar, pedi-las junto com o resto derrubaria a aba INTEIRA por "column
    // does not exist". Aqui a falha custa só o aviso de prazo, e o aviso já
    // sabe dizer "prazo não registrado" — que é a verdade nos dois casos.
    supabase
      .from('contratos')
      .select('prazo_entrega_dias, prazo_entrega_unidade, prazo_entrega_clausula, local_entrega, prazo_recebimento_dias, prazo_recebimento_unidade')
      .eq('id', contratoId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setPrazos(null);
          return;
        }
        setPrazos(data as unknown as PrazosDoContrato);
      });
    setDadosExecucao({
      forma: (contratoRes.data as any)?.forma_execucao ?? null,
      fundamento: (contratoRes.data as any)?.art95_fundamento ?? null,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [contratoId]);

  useEffect(() => {
    if (!ataSrpId) { setItensAta([]); return; }
    supabase
      .from('contrato_itens')
      .select('id, codigo_item, descricao, unidade, valor_unitario, origem_aditivo_id')
      .eq('contrato_id', ataSrpId)
      .then(({ data }) => setItensAta((data as any[]) || []));
  }, [ataSrpId]);

  // Realtime: reflete em tempo real exclusões/edições feitas no Financeiro
  // (cascata via trigger trg_cleanup_contrato_pedido_on_lancamento_delete) ou em outras abas.
  useEffect(() => {
    if (!contratoId) return;
    const channel = supabase
      .channel(`contrato-pedidos-${contratoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_pedidos', filter: `contrato_id=eq.${contratoId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contrato_itens', filter: `contrato_id=eq.${contratoId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'financeiro_lancamentos' },
        (payload: any) => {
          // Recarrega se o lançamento removido pertencia a algum pedido deste contrato
          const pedidoId = payload?.old?.contrato_pedido_id;
          if (pedidoId && pedidos.some((p) => p.id === pedidoId)) load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratoId]);

  /** Itens do seletor pelo filtro de situação: todos, nunca alterados, ou atualizados por um termo. */
  const itensFiltrados = useMemo((): ContratoItem[] => filtrarPorSituacao(itens, situacaoDosItens, origemFilter), [itens, situacaoDosItens, origemFilter]);
  const termosNoFiltro = useMemo(() => termosDoFiltro(situacaoDosItens), [situacaoDosItens]);

  const handleItemChange = (itemId: string) => {
    setForm(f => {
      const item = itens.find(i => i.id === itemId);
      return { ...f, contrato_item_id: itemId, valor_unitario: item ? String(item.valor_unitario) : f.valor_unitario };
    });
  };

  const handleItemChangeAta = (ataItemId: string) => {
    setAtaItemSelecionado(ataItemId);
    const ataItem = itensAta.find(i => i.id === ataItemId);
    if (!ataItem) return;
    const normAta = ataItem.descricao.toLowerCase().trim();
    const matched = itens.find(i => {
      const normContrato = i.descricao.toLowerCase().trim();
      return normContrato === normAta
        || normContrato.includes(normAta.substring(0, 30))
        || normAta.includes(normContrato.substring(0, 30));
    });
    if (!matched) {
      toast.warning('Item não encontrado no contrato — vincule manualmente');
      setForm(f => ({ ...f, valor_unitario: String(ataItem.valor_unitario), contrato_item_id: '' }));
      return;
    }
    setForm(f => ({ ...f, contrato_item_id: matched.id, valor_unitario: String(ataItem.valor_unitario) }));
  };

  /**
   * Continua a numeração do contrato em vez de abrir outra.
   *
   * O gerador antigo contava (`count(*)`) e prefixava com o ano — `P-2026-001`
   * —, o que criava uma segunda sequência ao lado da que vem do Kanban (5, 6,
   * 7, 8). E, apagado um pedido, a contagem repetia número de alguém: o mesmo
   * número aparece na descrição do lançamento financeiro, na NF e no ofício ao
   * órgão.
   */
  const gerarNumeroPedido = async (): Promise<string> => {
    const { data } = await supabase
      .from('contrato_pedidos')
      .select('numero_pedido')
      .eq('contrato_id', contratoId);
    return proximoNumeroDePedido((data ?? []).map((p) => p.numero_pedido));
  };

  const resetForm = () => {
    setForm({
      numero_pedido: '', descricao: '', contrato_item_id: '',
      quantidade: '', valor_unitario: '', data_pedido: new Date().toISOString().split('T')[0],
      data_entrega: '', status: 'pendente', nota_fiscal: '', observacoes: '',
      tipo_documento: 'ordem_fornecimento', origem_aditivo_id: '',
      numero_empenho: '', tipo_empenho: '', valor_empenho: '', cota: '',
      empenho_id: '',
    });
    setArquivoOrdem(null);
    setArquivoPendente(null);
    setExtractedData(null);
    setExtractedItens([]);
    setFonteItens('contrato');
    setAtaItemSelecionado('');
  };

  const openNewDialog = async () => {
    if (contratoEncerrado) {
      const quando = contratoEncerrado.data
        ? ` em ${new Date(`${String(contratoEncerrado.data).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')}`
        : '';
      toast.warning(`Contrato encerrado${quando} — pedido novo não entra`, {
        description: `Motivo: ${rotuloDoMotivo(contratoEncerrado.motivo)}. Se o fornecimento continuou (aditivo, prorrogação), reabra o contrato no Resumo e lance o pedido em seguida.`,
      });
      return;
    }
    resetForm();
    const numero = await gerarNumeroPedido();
    setForm(f => ({ ...f, numero_pedido: numero }));
    setDialogOpen(true);
  };

  // PDF Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF'); return; }

    setUploading(true);
    try {
      // ── O arquivo espera o Registrar ─────────────────────────────────────
      //
      // Guardava-se aqui, antes da leitura, para que uma falha da IA não
      // perdesse o documento. O raciocínio estava errado: o PDF está no
      // computador de quem o anexou — nada se perde. O que a pressa produzia
      // era pior: quem anexasse e desistisse deixava o arquivo no dossiê do
      // contrato, como se fizesse parte dele, sem nada que o explicasse.
      //
      // Anexar não é registrar. O arquivo entra no contrato no mesmo instante
      // em que o empenho ou o pedido entram — nem antes, nem sem eles.
      setArquivoPendente(file);
      setArquivoOrdem(null);

      // Dois caminhos (28/09/2026), decididos por uma olhada nas 3 primeiras
      // páginas:
      //  • nato-digital → texto do PDF no navegador + extração (rápido);
      //  • escaneado → o ARQUIVO vai inteiro, numa chamada só, e volta
      //    estruturado. Antes ele era rasterizado página a página, lido por
      //    OCR em lotes sequenciais e só depois extraído: 60–90 s numa nota
      //    de 10 páginas. O OCR por lotes ficou como reserva.
      const { extractTextFromFile, inspecionarPdf, arquivoParaBase64 } = await import('@/lib/pdf-text-extractor');
      setEtapaLeitura('Abrindo o PDF…');
      const olhada = await inspecionarPdf(file, 3);
      const escaneado = olhada.comTexto === 0;
      const cabeInteiro = file.size <= 12 * 1024 * 1024 && olhada.paginas <= 60;

      // O que a IA devolve segue o esquema da edge (extrair_pedido); o consumo abaixo já lidava com ele sem tipo.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: { data?: any; error?: string } | null = null;
      if (escaneado && cabeInteiro) {
        setEtapaLeitura(`PDF escaneado (${olhada.paginas} página${olhada.paginas === 1 ? '' : 's'}): a IA está lendo o arquivo inteiro…`);
        const r = await supabase.functions.invoke('extrair-pedido-pdf', {
          body: { pdf_base64: await arquivoParaBase64(file), tipo_documento: form.tipo_documento },
        });
        if (!r.error && !r.data?.error) result = r.data;
        else console.warn('leitura direta do PDF falhou; caindo para o OCR por lotes:', r.error?.message ?? r.data?.error);
      }
      if (!result) {
        const fullText = await extractTextFromFile(file, 30, false, escaneado ? 5 : 0, (msg) => setEtapaLeitura(msg));
        if (fullText.trim().length < 30) {
          toast.error('Não foi possível ler o PDF, nem por OCR.');
          setUploading(false);
          return;
        }
        setEtapaLeitura('Extraindo número, itens, quantidades e valores…');
        const { data, error } = await supabase.functions.invoke('extrair-pedido-pdf', {
          body: { texto_pdf: fullText, tipo_documento: form.tipo_documento },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        result = data;
      }

      const extracted = result?.data;
      if (!extracted) throw new Error('A IA não devolveu dados do documento.');
      setExtractedData(extracted);
      setForm(f => ({
        ...f,
        numero_pedido: extracted.numero_documento || f.numero_pedido,
        descricao: extracted.observacoes || f.descricao,
        data_pedido: extracted.data_documento || f.data_pedido,
        // O documento manda; sem data nele, a cláusula do contrato preenche.
        data_entrega: extracted.data_entrega
          || f.data_entrega
          || limiteDerivado(extracted.data_documento || f.data_pedido),
        nota_fiscal: extracted.nota_fiscal || f.nota_fiscal,
        tipo_documento: extracted.tipo_documento || f.tipo_documento,
        observacoes: extracted.observacoes || '',
        // O empenho passa a ser CAMPO, não texto solto nas observações. É por
        // ele que se sabe quantos pedidos saíram do mesmo documento e se a
        // soma deles passou o valor empenhado.
        numero_empenho:
          normalizarNumeroEmpenho(extracted.numero_empenho ?? extracted.numero_documento) ?? f.numero_empenho,
        // A ESPÉCIE vem do campo rotulado na nota, não do tipo do documento:
        // "nota de empenho" não diz se é ordinária, global ou estimativa, e é
        // essa diferença que decide se um excesso é rotina ou irregularidade.
        tipo_empenho:
          especieComOrigem({
            especieDoDocumento: extracted.especie_empenho,
            escolhaManual: extracted.tipo_documento,
          }).tipo ?? f.tipo_empenho,
        valor_empenho: extracted.valor_total ? String(extracted.valor_total) : f.valor_empenho,
      }));

      if (extracted.itens?.length > 0) {
        const linhas: LinhaLida[] = extracted.itens.map((ei: Record<string, unknown>) => {
          const desc = String(ei.descricao ?? '');
          const matchedItem = itens.find(ci =>
            ci.descricao.toLowerCase().includes(desc.toLowerCase().substring(0, 20)) ||
            (desc.length >= 20 && desc.toLowerCase().includes(ci.descricao.toLowerCase().substring(0, 20)))
          );
          const unit = ei.valor_unitario
            ? Number(ei.valor_unitario)
            : (matchedItem ? Number(matchedItem.valor_unitario) : 0);
          return {
            key: crypto.randomUUID(),
            descricao: desc,
            quantidade: ei.quantidade ? String(ei.quantidade) : '',
            valor_unitario: ei.valor_unitario ? String(ei.valor_unitario) : (matchedItem ? String(matchedItem.valor_unitario) : ''),
            contrato_item_id: matchedItem?.id || '',
            cotaBruta: (ei.cota as string) ?? null,
            valorTotal: (Number(ei.quantidade) || 0) * unit,
          };
        });
        // A divisão em cota principal e reservada (LC 123/2006, art. 48, III) é
        // reconhecida aqui, não no formulário: quem preenche à mão não vê que
        // duas linhas do mesmo produto em 75/25 são UMA divisão, e foi assim
        // que o empenho do 008/2026 virou dois pedidos.
        const cotas = atribuirCotas(linhas.map((l: LinhaLida) => ({
          descricao: l.descricao, cota: l.cotaBruta, valorTotal: l.valorTotal,
        })));
        setExtractedItens(linhas.map((l: LinhaLida, i: number) => ({
          key: l.key,
          descricao: l.descricao,
          quantidade: l.quantidade,
          valor_unitario: l.valor_unitario,
          contrato_item_id: l.contrato_item_id,
          cota: cotas[i].cota ?? '',
          cota_origem: cotas[i].origem,
        })));
      }
      setActiveTab('manual');
      const cria = oQueODocumentoCria(extracted.tipo_documento || form.tipo_documento, extracted.especie_empenho);
      toast.success(
        cria === 'empenho'
          ? `Nota de empenho lida: ${extracted.itens?.length || 0} linha(s). Ao salvar, ela AUTORIZA — nenhum saldo é consumido.`
          : `Dados extraídos: ${extracted.itens?.length || 0} itens identificados.`,
      );
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Erro ao processar documento');
    } finally {
      setUploading(false);
      setEtapaLeitura('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Cria lançamentos "a_receber" no Financeiro vinculados ao contrato e aos
   * pedidos recém-criados — DEPOIS de procurar o recebimento que já existe.
   *
   * O extrato importado antes da DANFE (21/09) fazia cada anexo virar um
   * segundo título. Agora, nota com número: procura recebimento baixado e
   * livre que cite a nota. Um só, com o mesmo valor → casa e não cria.
   * Indício (número sem valor, ou só valor) → não cria e abre o diálogo de
   * casar, porque valor igual não prova duplicidade (regra do dono). Nada
   * parecido → cria, como antes.
   */
  const gerarLancamentosFinanceiros = async (
    pedidosCriados: Array<{ id: string; numero_pedido: string; descricao: string | null; valor_total: number; data_pedido: string | null; contrato_item_id?: string | null; nota_fiscal?: string | null }>,
  ) => {
    if (!gerarContaReceber || pedidosCriados.length === 0) return;
    try {
      const { data: contratoInfo } = await supabase
        .from('contratos')
        .select('empresa_id, numero_contrato, orgao_contratante')
        .eq('id', contratoId)
        .single();
      const empresaId = (contratoInfo as any)?.empresa_id || empresaAtiva?.id;
      if (!empresaId) {
        toast.warning('Pedido salvo, mas empresa do contrato não definida — lançamento financeiro não criado.');
        return;
      }

      const paraCriar: typeof pedidosCriados = [];
      for (const p of pedidosCriados) {
        const nf = p.nota_fiscal ?? null;
        const busca = nf
          ? await buscarRecebimentoDaNota(empresaId, { numero: nf, valor: Number(p.valor_total) || 0, dataEmissao: p.data_pedido ?? null })
          : ({ veredito: 'nenhum' } as const);
        if (busca.veredito === 'certo') {
          const { error: erroCasar } = await supabase
            .from('financeiro_lancamentos')
            .update({
              contrato_pedido_id: p.id,
              contrato_id: contratoId,
              contrato_item_id: p.contrato_item_id ?? null,
              numero_documento: busca.recebimento.numero_documento ?? nf,
            } as never)
            .eq('id', busca.recebimento.id);
          if (erroCasar) {
            toast.warning(`NF ${nf}: o recebimento existe, mas não foi possível casar — ${erroCasar.message}`);
            paraCriar.push(p);
            continue;
          }
          const quando = busca.recebimento.data_realizado ?? busca.recebimento.data_competencia;
          const quandoBr = quando ? new Date(`${String(quando).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'data não informada';
          toast.success(`NF ${nf} já estava recebida: pedido casado com o recebimento de ${quandoBr}.`, {
            description: `${busca.motivos.join(', ')}. Nenhum título novo foi criado.`,
            duration: 10000,
          });
          continue;
        }
        if (busca.veredito === 'ambiguo') {
          const s = busca.sugestoes[0];
          const abrirVincular = () => setVinculando({ id: p.id, numero_pedido: p.numero_pedido, valor_total: Number(p.valor_total) || 0, data_pedido: p.data_pedido, nota_fiscal: nf });
          // ── Fracionado (22/09): recebimento MENOR que a nota (empenho pago
          // em duas vezes). Casa o que já entrou e lança o restante como
          // parcela em aberto do mesmo pedido: a quitação, que exige todas as
          // parcelas pagas, quita no segundo pagamento — e não antes.
          if (s.relacao === 'parcial') {
            toast.info(`NF ${nf}: o recebimento de ${fmt(Number(s.recebimento.valor))} é MENOR que a nota (${fmt(Number(p.valor_total) || 0)}).`, {
              description: `${s.recebimento.descricao ?? 'sem descrição'} — ${s.motivos.join(', ')}. ${fmt(s.restante)} ficam em aberto.`,
              action: {
                label: 'Casar e lançar o restante',
                onClick: () => {
                  void (async () => {
                    const { error: erroCasar } = await supabase
                      .from('financeiro_lancamentos')
                      .update({ contrato_pedido_id: p.id, contrato_id: contratoId, contrato_item_id: p.contrato_item_id ?? null, numero_documento: s.recebimento.numero_documento ?? nf } as never)
                      .eq('id', s.recebimento.id);
                    if (erroCasar) { toast.error('Não foi possível casar o recebimento', { description: erroCasar.message }); return; }
                    const { error: erroRestante } = await supabase.from('financeiro_lancamentos').insert({
                      empresa_id: empresaId,
                      tipo: 'a_receber', natureza: 'receita', status: 'previsto',
                      descricao: `${(contratoInfo as { numero_contrato?: string | null } | null)?.numero_contrato ?? 'Contrato'} · Pedido ${p.numero_pedido} — restante da NF ${nf}`,
                      valor: s.restante,
                      data_competencia: p.data_pedido ?? new Date().toISOString().slice(0, 10),
                      data_emissao: p.data_pedido ?? null,
                      numero_documento: nf,
                      contrato_id: contratoId, contrato_pedido_id: p.id, contrato_item_id: p.contrato_item_id ?? null,
                      parcela_pai_id: s.recebimento.id,
                      origem: 'manual', origem_tipo: 'manual', origem_job: 'ContratoPedidos.gerarLancamentosFinanceiros.restante',
                      origem_usuario_id: user?.id ?? null, origem_timestamp: new Date().toISOString(),
                      observacoes: `Restante da NF ${nf}: ${fmt(Number(s.recebimento.valor))} já recebidos em outro título; ${fmt(s.restante)} em aberto.`,
                      created_by: user?.id ?? null,
                    } as never);
                    if (erroRestante) { toast.error('Recebimento casado, mas o restante não foi lançado', { description: erroRestante.message }); }
                    else toast.success(`NF ${nf}: recebimento casado e ${fmt(s.restante)} lançados em aberto como parcela do pedido.`);
                    load();
                  })();
                },
              },
              duration: 30000,
            });
            continue;
          }
          if (s.relacao === 'parte') {
            toast.info(`NF ${nf}: o recebimento de ${fmt(Number(s.recebimento.valor))} é MAIOR que a nota — pode pagar mais de uma.`, {
              description: `${s.recebimento.descricao ?? 'sem descrição'} — ${s.motivos.join(', ')}. Use Ratear em Vincular lançamento para destinar ${fmt(Number(p.valor_total) || 0)} a este pedido.`,
              action: { label: 'Ratear', onClick: abrirVincular },
              duration: 30000,
            });
            continue;
          }
          toast.info(`NF ${nf}: há recebimento parecido no Financeiro — nenhum título foi criado.`, {
            description: `${s.recebimento.descricao ?? 'sem descrição'} · ${fmt(Number(s.recebimento.valor))} — ${s.motivos.join(', ')}. Confira e case, ou crie o título pelo diálogo.`,
            action: { label: 'Casar', onClick: abrirVincular },
            duration: 20000,
          });
          continue;
        }
        paraCriar.push(p);
      }
      if (paraCriar.length === 0) return;

      const inserts = paraCriar.map((p) => ({
        empresa_id: empresaId,
        tipo: 'a_receber' as const,
        natureza: 'receita' as const,
        status: 'previsto' as const,
        descricao: `${(contratoInfo as any)?.numero_contrato ?? 'Contrato'} · Pedido ${p.numero_pedido}${p.descricao ? ' — ' + p.descricao : ''}`,
        valor: p.valor_total,
        data_competencia: p.data_pedido ?? new Date().toISOString().slice(0, 10),
        data_emissao: p.data_pedido ?? null,
        contrato_id: contratoId,
        contrato_pedido_id: p.id,
        contrato_item_id: p.contrato_item_id ?? null,
        origem: 'manual' as const,
        origem_tipo: 'manual' as const,
        origem_job: 'ContratoPedidos.gerarLancamentosFinanceiros',
        origem_usuario_id: user?.id ?? null,
        origem_timestamp: new Date().toISOString(),
        origem_metadata: { contrato_id: contratoId, pedido_id: p.id, numero_pedido: p.numero_pedido },
        observacoes: `Lançamento gerado automaticamente a partir do pedido ${p.numero_pedido} do contrato ${(contratoInfo as any)?.numero_contrato ?? ''}.`,
        created_by: user?.id ?? null,
      }));
      const { error } = await supabase.from('financeiro_lancamentos').insert(inserts as any);
      if (error) {
        console.error('Erro ao criar lançamento financeiro:', error);
        toast.warning('Pedido salvo, mas houve erro ao criar conta a receber: ' + error.message);
      } else {
        toast.success(`${inserts.length} conta(s) a receber criada(s) no Financeiro.`);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // ——— Trava do preço contratado (Fase B, 09/09) ————————————————————————
  // Pedido é EXECUÇÃO do contrato: unitário divergente do item vinculado não
  // finaliza — pede revisão. Se o preço mudou por reequilíbrio/reajuste, o
  // caminho é atualizar o ITEM (Itens/Lotes) antes, e o pedido nasce certo.
  // Tolerância de 0,5% para arredondamento de centavos. Empenho fica fora:
  // ele AUTORIZA com o valor literal do documento, não consome item.
  const precoForaDoContratado = (linhas: Array<{ descricao?: string | null; valor_unitario: string | number; contrato_item_id?: string | null }>): string | null => {
    for (const l of linhas) {
      if (!l.contrato_item_id) continue;
      const item = itens.find(i => i.id === l.contrato_item_id);
      const contratado = Number(item?.valor_unitario) || 0;
      const vu = typeof l.valor_unitario === 'number' ? l.valor_unitario : parseFloat(String(l.valor_unitario)) || 0;
      if (contratado > 0 && vu > 0 && Math.abs(vu - contratado) / contratado > 0.005) {
        return `"${(l.descricao || 'item').slice(0, 60)}": unitário ${fmt(vu)} difere do contratado ${fmt(contratado)}. Revise o valor — e se o preço mudou por reequilíbrio/reajuste, atualize o item do contrato em Itens/Lotes antes de registrar o pedido.`;
      }
    }
    return null;
  };

  // ——— Fase C: estoque físico × virtual —————————————————————————————————
  // Disponível = saldo físico do produto − reservas (pedidos pendentes ou
  // parciais de QUALQUER contrato apontando itens do mesmo produto). A régua
  // aparece na criação do pedido; quantidade que não cabe vira confirmação
  // explícita — a entrada da compra pode legitimamente vir depois.
  const [estoqueInfo, setEstoqueInfo] = useState<Map<string, { fisico: number; reservado: number }>>(new Map());
  useEffect(() => {
    const produtoIds = [...new Set(itens.map(i => i.produto_id).filter(Boolean))] as string[];
    if (!produtoIds.length) { setEstoqueInfo(new Map()); return; }
    let vivo = true;
    (async () => {
      const [prodRes, ciRes] = await Promise.all([
        supabase.from('produtos').select('id, saldo_atual').in('id', produtoIds),
        // types.ts ainda não conhece produto_id em contrato_itens (migration adm.)
        (supabase.from('contrato_itens') as any).select('id, produto_id').in('produto_id', produtoIds),
      ]);
      const linhasCi = (ciRes.data as unknown as Array<{ id: string; produto_id: string }> | null) || [];
      const prodDoItem = new Map(linhasCi.map(x => [x.id, x.produto_id]));
      let reservas: Array<{ contrato_item_id: string | null; quantidade: number }> = [];
      if (linhasCi.length) {
        const { data } = await supabase.from('contrato_pedidos')
          .select('contrato_item_id, quantidade')
          .in('contrato_item_id', linhasCi.map(x => x.id))
          .in('status', [...STATUS_QUE_RESERVAM]);
        reservas = (data as typeof reservas) || [];
      }
      if (!vivo) return;
      const mapa = new Map<string, { fisico: number; reservado: number }>();
      for (const p of (prodRes.data as Array<{ id: string; saldo_atual: number }> | null) || []) {
        mapa.set(p.id, { fisico: Number(p.saldo_atual) || 0, reservado: 0 });
      }
      for (const r of reservas) {
        const pid = r.contrato_item_id ? prodDoItem.get(r.contrato_item_id) : undefined;
        const e = pid ? mapa.get(pid) : undefined;
        if (e) e.reservado += Number(r.quantidade) || 0;
      }
      setEstoqueInfo(mapa);
    })();
    return () => { vivo = false; };
  }, [itens, pedidos]);

  const estoqueDoItem = (contratoItemId?: string | null) => {
    if (!contratoItemId) return null;
    const item = itens.find(i => i.id === contratoItemId);
    if (!item?.produto_id) return null;
    const e = estoqueInfo.get(item.produto_id);
    if (!e) return null;
    return { ...e, disponivel: e.fisico - e.reservado };
  };

  const avisoEstoqueInsuficiente = (linhas: Array<{ descricao?: string | null; quantidade: string | number; contrato_item_id?: string | null }>): string | null => {
    for (const l of linhas) {
      const e = estoqueDoItem(l.contrato_item_id);
      if (!e) continue;
      const qtd = typeof l.quantidade === 'number' ? l.quantidade : parseFloat(String(l.quantidade)) || 0;
      if (qtd > e.disponivel) {
        return `"${(l.descricao || 'item').slice(0, 60)}": pedido de ${qtd.toLocaleString('pt-BR')} com ${e.disponivel.toLocaleString('pt-BR')} disponível (${e.fisico.toLocaleString('pt-BR')} físico − ${e.reservado.toLocaleString('pt-BR')} já reservado em pedidos).`;
      }
    }
    return null;
  };

  const handleSaveSingle = async () => {
    // A mesma bifurcação do upload, no lançamento à mão: quem escolhe "Empenho
    // Ordinário" no tipo do documento está registrando uma AUTORIZAÇÃO, e ela
    // não pode virar entrega só porque foi digitada em vez de lida.
    if (oQueODocumentoCria(form.tipo_documento, form.tipo_empenho) === 'empenho') {
      return salvarEmpenho([{
        descricao: form.descricao,
        quantidade: form.quantidade,
        valor_unitario: form.valor_unitario,
        contrato_item_id: form.contrato_item_id,
        cota: form.cota,
      }]);
    }

    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }
    const qty = parseFloat(form.quantidade) || 0;
    const unit = parseFloat(form.valor_unitario) || 0;

    const travaPreco = precoForaDoContratado([{ descricao: form.descricao, valor_unitario: unit, contrato_item_id: form.contrato_item_id }]);
    if (travaPreco) { toast.error('Preço fora do contratado', { description: travaPreco }); return; }

    const alertaEstoque = avisoEstoqueInsuficiente([{ descricao: form.descricao, quantidade: qty, contrato_item_id: form.contrato_item_id }]);
    if (alertaEstoque && !confirm(`Estoque insuficiente\n\n${alertaEstoque}\n\nRegistrar mesmo assim? (a entrada da compra pode ser lançada depois)`)) return;

    // Avisa e deixa seguir: há entrega legítima que estoura o saldo previsto —
    // reforço de empenho em andamento, aditivo em tramitação. Barrar seria
    // decidir no lugar de quem conhece o processo; calar seria deixar o
    // contrato chegar a 303% de novo.
    const cabimento = conferirCabimento(qty, qty * unit, form.contrato_item_id, form.cota);
    if (!cabimento.cabe && cabimento.gargalo) {
      const seguir = confirm(
        `${cabimento.frase}\n\n${cabimento.gargalo.providencia}\n\nRegistrar mesmo assim?`,
      );
      if (!seguir) return;
    }
    // O aviso do estimativo sai mesmo quando o pedido cabe: ele não impede,
    // mas quem fatura precisa saber que o reforço do empenho está pendente
    // antes de a nota sair.
    avisarDeReforco(cabimento);

    setSaving(true);
    // O PDF entra no dossiê agora, junto com o pedido — não no anexo.
    const arquivoId = await guardarArquivoDaOrdem();
    const { data: novoPedido, error } = await supabase.from('contrato_pedidos').insert({
      contrato_id: contratoId, user_id: user!.id,
      numero_pedido: form.numero_pedido, descricao: form.descricao || null,
      contrato_item_id: form.contrato_item_id || null,
      quantidade: qty, valor_unitario: unit, valor_total: qty * unit,
      data_pedido: form.data_pedido || null, data_entrega: form.data_entrega || null,
      status: form.status, nota_fiscal: form.nota_fiscal || null,
      observacoes: form.observacoes || null,
      origem_aditivo_id: form.origem_aditivo_id || null,
      numero_empenho: normalizarNumeroEmpenho(form.numero_empenho),
      tipo_empenho: tipoDeEmpenho(form.tipo_empenho),
      valor_empenho: parseFloat(form.valor_empenho) || null,
      arquivo_ordem_id: arquivoId,
      cota: form.cota || null,
      empenho_id: form.empenho_id || null,
    } as any).select('id, numero_pedido, descricao, valor_total, data_pedido, contrato_item_id').single();
    if (error) { console.error('Erro ao salvar pedido:', error.message, error.details, error.code); toast.error('Erro ao salvar pedido: ' + error.message); setSaving(false); return; }
    await gerarLancamentosFinanceiros([{ ...(novoPedido as any), nota_fiscal: form.nota_fiscal || null }]);
    setSaving(false);
    avisarPrazo(novoPedido?.data_pedido);
    avisarSaldoEsgotado(qty * unit);
    // Só faz sentido sugerir quando NÃO se acabou de criar um título: com a
    // caixa marcada, o pedido já tem o seu, e a sugestão convidaria a somar
    // dois pelo mesmo dinheiro.
    if (!gerarContaReceber && novoPedido) void sugerirVinculo(novoPedido as never);
    setDialogOpen(false);
    resetForm();
    load();
  };

  /**
   * A nota de empenho vira EMPENHO, e nenhum pedido.
   *
   * Empenhar é o órgão reservar o dinheiro; entregar é outra coisa, e vem
   * depois. Enquanto o upload da nota criava pedidos, o saldo do contrato caía
   * no instante da reserva — o 008/2026 marcava 100% consumido sem uma única
   * entrega, e a primeira de verdade o punha acima disso.
   *
   * As linhas viram `contrato_empenho_itens`, cada uma com a sua cota, porque
   * a principal e a reservada esgotam separadas.
   */
  const salvarEmpenho = async (
    linhasBrutas: Array<{
      descricao: string; quantidade: string; valor_unitario: string;
      contrato_item_id: string; cota: string;
    }>,
  ) => {
    const numero = normalizarNumeroEmpenho(form.numero_empenho || form.numero_pedido);
    if (!numero) { toast.error('Informe o número da nota de empenho'); return; }

    const especie = especieComOrigem({
      especieDoDocumento: extractedData?.especie_empenho,
      trecho: extractedData?.especie_empenho_texto,
      escolhaManual: form.tipo_empenho || form.tipo_documento,
    });
    // Sem espécie não há como julgar excesso — no ordinário é irregularidade,
    // no estimativo é rotina. Parar aqui é melhor do que gravar um palpite.
    if (!especie.tipo) {
      toast.error('Escolha a espécie do empenho (ordinário, global ou estimativo) antes de salvar.');
      return;
    }

    const linhas = linhasBrutas.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0);
    const empresaId = empresaAtiva?.id;
    if (!empresaId) { toast.error('Nenhuma empresa ativa.'); return; }

    setSaving(true);
    const arquivoId = await guardarArquivoDaOrdem();
    const totalValor = linhas.length
      ? linhas.reduce((s, l) => s + (parseFloat(l.quantidade) || 0) * (parseFloat(l.valor_unitario) || 0), 0)
      : (parseFloat(form.valor_empenho) || parseFloat(extractedData?.valor_total) || 0);
    const totalQtd = linhas.reduce((s, l) => s + (parseFloat(l.quantidade) || 0), 0);

    const { data: empenho, error } = await supabase
      .from('contrato_empenhos' as never)
      .insert({
        empresa_id: empresaId,
        contrato_id: contratoId,
        numero,
        tipo: especie.tipo,
        tipo_origem: especie.origem,
        tipo_trecho: especie.trecho,
        valor: totalValor || null,
        quantidade: totalQtd || null,
        unidade: 'un',
        data_emissao: form.data_pedido || extractedData?.data_documento || null,
        arquivo_id: arquivoId,
        observacao: form.observacoes || null,
        created_by: user!.id,
      } as never)
      .select('id, numero')
      .single();
    // `contrato_empenhos` ainda não está no types.ts gerado — a tabela nasceu
    // depois da última regeneração. O `as never` acima cala o cliente; aqui a
    // forma volta a ser declarada, e é ela que o resto usa.
    const criado = empenho as unknown as { id: string; numero: string } | null;

    // ── Já registrado não é erro: é o documento chegando depois ─────────────
    //
    // O empenho pode existir sem o PDF — foi assim que o 2026NE003716 nasceu,
    // convertido por SQL a partir de dois lançamentos, sem documento nenhum.
    // Quem sobe a nota depois está trazendo justamente o que faltava. Recusar
    // com "já está registrado" devolve a pessoa ao ponto de partida sem dizer
    // o que fazer, e o dossiê continua sem a autorização.
    if (error?.code === '23505') {
      const { data: existente } = await supabase
        .from('contrato_empenhos' as never)
        .select('id, arquivo_id')
        .eq('contrato_id', contratoId)
        .eq('numero', numero)
        .single();
      const jaExiste = existente as unknown as { id: string; arquivo_id: string | null } | null;
      if (jaExiste && arquivoId && !jaExiste.arquivo_id) {
        await supabase
          .from('contrato_empenhos' as never)
          .update({ arquivo_id: arquivoId } as never)
          .eq('id', jaExiste.id);
        setSaving(false);
        toast.success(`Empenho ${numero} já estava registrado — o PDF foi anexado a ele.`);
        setDialogOpen(false);
        resetForm();
        load();
        return;
      }
      setSaving(false);
      toast.error(
        jaExiste?.arquivo_id
          ? `O empenho ${numero} já está registrado neste contrato, com documento anexado.`
          : `O empenho ${numero} já está registrado neste contrato.`,
      );
      return;
    }

    if (error) {
      setSaving(false);
      toast.error('Erro ao registrar empenho: ' + error.message);
      return;
    }

    if (linhas.length > 0) {
      const { error: erroItens } = await supabase
        .from('contrato_empenho_itens' as never)
        .insert(linhas.map(l => {
          const qtd = parseFloat(l.quantidade) || 0;
          const unit = parseFloat(l.valor_unitario) || 0;
          return {
            empresa_id: empresaId,
            empenho_id: criado!.id,
            contrato_item_id: l.contrato_item_id || null,
            cota: l.cota || null,
            descricao: l.descricao,
            quantidade: qtd,
            unidade: 'un',
            valor_unitario: unit,
            valor_total: qtd * unit,
          };
        }) as never)
        .select('id');
      // O empenho sem as linhas é um saldo sem do que ser feito: a checagem
      // por cota passa a não ter contra o que conferir. Falar alto, não deixar
      // passar como se tivesse dado certo.
      if (erroItens) {
        toast.error('Empenho criado, mas as linhas falharam: ' + erroItens.message);
      }
    }

    setSaving(false);
    toast.success(
      `Empenho ${criado!.numero} registrado (${ROTULO_DO_EMPENHO[especie.tipo].toLowerCase()}). ` +
      'Nenhum saldo foi consumido — ele autoriza os pedidos que virão.',
    );
    setDialogOpen(false);
    resetForm();
    load();
  };

  const handleSaveBatch = async () => {
    if (!extractedData) { toast.error('Nenhum documento extraído'); return; }

    // A bifurcação: nota de empenho AUTORIZA, ordem de fornecimento CONSOME.
    if (oQueODocumentoCria(
          extractedData.tipo_documento || form.tipo_documento,
          extractedData.especie_empenho || form.tipo_empenho,
        ) === 'empenho') {
      return salvarEmpenho(extractedItens);
    }

    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }

    const itensSalvar = extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0);

    const travaPreco = precoForaDoContratado(itensSalvar);
    if (travaPreco) { toast.error('Preço fora do contratado', { description: travaPreco }); return; }

    const alertaEstoque = avisoEstoqueInsuficiente(itensSalvar);
    if (alertaEstoque && !confirm(`Estoque insuficiente\n\n${alertaEstoque}\n\nRegistrar mesmo assim? (a entrada da compra pode ser lançada depois)`)) return;

    // A mesma checagem tripla do lançamento avulso: contrato, item e cota do
    // empenho limitam a mesma entrega, e nenhum implica o outro.
    for (const ei of itensSalvar) {
      const qtd = parseFloat(ei.quantidade) || 0;
      const unit = parseFloat(ei.valor_unitario) || 0;
      const cabimento = conferirCabimento(qtd, qtd * unit, ei.contrato_item_id, ei.cota || form.cota);
      if (!cabimento.cabe && cabimento.gargalo) {
        const seguir = confirm(
          `${ei.descricao}\n\n${cabimento.frase}\n\n${cabimento.gargalo.providencia}\n\nRegistrar mesmo assim?`,
        );
        if (!seguir) return;
      }
      avisarDeReforco(cabimento);
    }

    // Fallback: nenhum item válido → cria um único pedido com o total do documento (comportamento original)
    if (itensSalvar.length === 0) {
      setSaving(true);
      const arquivoId = await guardarArquivoDaOrdem();
      const valorTotal = parseFloat(extractedData.valor_total) || 0;
      const tipoLabel = tiposDocumento.find(t => t.value === (extractedData.tipo_documento || form.tipo_documento))?.label || form.tipo_documento;
      const descricao = `${tipoLabel}${extractedData.numero_documento ? ' — ' + extractedData.numero_documento : ''}`;
      const { data: novoPedido, error } = await supabase
        .from('contrato_pedidos')
        .insert({
          contrato_id: contratoId, user_id: user!.id,
          numero_pedido: form.numero_pedido,
          descricao,
          quantidade: 1,
          valor_unitario: valorTotal,
          valor_total: valorTotal,
          data_pedido: form.data_pedido || extractedData.data_documento || null,
          data_entrega: form.data_entrega || extractedData.data_entrega || null,
          status: form.status,
          nota_fiscal: form.nota_fiscal || extractedData.nota_fiscal || null,
          observacoes: form.observacoes || extractedData.observacoes || null,
          origem_aditivo_id: form.origem_aditivo_id || null,
      numero_empenho: normalizarNumeroEmpenho(form.numero_empenho),
      tipo_empenho: tipoDeEmpenho(form.tipo_empenho),
      valor_empenho: parseFloat(form.valor_empenho) || null,
      arquivo_ordem_id: arquivoId,
      cota: form.cota || null,
      empenho_id: form.empenho_id || null,
        } as any)
        .select('id, numero_pedido, descricao, valor_total, data_pedido, contrato_item_id')
        .single();
      if (error) { console.error('Erro ao salvar pedido:', error.message); toast.error('Erro ao salvar pedido: ' + error.message); setSaving(false); return; }
      await gerarLancamentosFinanceiros([{ ...(novoPedido as any), nota_fiscal: form.nota_fiscal || extractedData.nota_fiscal || null }]);
      setSaving(false);
      avisarPrazo(novoPedido?.data_pedido);
      avisarSaldoEsgotado(valorTotal);
      if (!gerarContaReceber && novoPedido) void sugerirVinculo(novoPedido as never);
      setDialogOpen(false);
      resetForm();
      load();
      return;
    }

    // Múltiplos itens: um registro individual por item extraído
    // Itens sem contrato_item_id mapeado são salvos com contrato_item_id: null (fallback seguro por item)
    setSaving(true);
    const arquivoId = await guardarArquivoDaOrdem();
    const campos = {
      data_pedido: form.data_pedido || extractedData.data_documento || null,
      data_entrega: form.data_entrega || extractedData.data_entrega || null,
      status: form.status,
      nota_fiscal: form.nota_fiscal || extractedData.nota_fiscal || null,
      observacoes: form.observacoes || extractedData.observacoes || null,
      origem_aditivo_id: form.origem_aditivo_id || null,
      numero_empenho: normalizarNumeroEmpenho(form.numero_empenho),
      tipo_empenho: tipoDeEmpenho(form.tipo_empenho),
      valor_empenho: parseFloat(form.valor_empenho) || null,
      arquivo_ordem_id: arquivoId,
      cota: form.cota || null,
      empenho_id: form.empenho_id || null,
    };
    const inserts = itensSalvar.map((ei) => {
      const qty = parseFloat(ei.quantidade) || 0;
      const unit = parseFloat(ei.valor_unitario) || 0;
      return {
        contrato_id: contratoId,
        user_id: user!.id,
        // O número do documento é UM. Sufixar `-1`, `-2` por item inventava
        // documentos que não existem: as duas linhas de um empenho dividido em
        // cota principal e reservada são o MESMO 2026.260101NE003716, e a
        // divisão está na cota, não no número.
        numero_pedido: form.numero_pedido,
        descricao: ei.descricao,
        contrato_item_id: ei.contrato_item_id || null,
        quantidade: qty,
        valor_unitario: unit,
        valor_total: qty * unit,
        ...campos,
        // A cota é da LINHA, não do documento: uma OF pode consumir das duas.
        // O campo do formulário só entra onde a linha não disse nada.
        cota: ei.cota || form.cota || null,
      };
    });
    const { data: novosPedidos, error } = await supabase
      .from('contrato_pedidos')
      .insert(inserts as any)
      .select('id, numero_pedido, descricao, valor_total, data_pedido, contrato_item_id');
    if (error) { console.error('Erro ao salvar pedidos:', error.message); toast.error('Erro ao salvar pedidos: ' + error.message); setSaving(false); return; }
    await gerarLancamentosFinanceiros((novosPedidos ?? []) as any[]);
    setSaving(false);
    toast.success(`${inserts.length} pedido(s) registrado(s).`);
    setDialogOpen(false);
    resetForm();
    load();
  };

  const openDeleteDialog = (id: string, numero: string) => {
    setDeleteDialog({ id, numero });
    setDeleteReason('');
  };

  // ── Desfazer quitação (21/09) ─────────────────────────────────────────────
  // O inverso de "Quitar NF", na ordem inversa: só a quitação MANUAL se desfaz
  // aqui. A que veio de título pago é do Financeiro ("Desfazer conciliação";
  // o gatilho de 31/08 devolve o pedido sozinho), e bonificação já paga é fato
  // consumado. A pré-leitura abaixo só decide o que o diálogo mostra — a
  // guarda de verdade é a função `desfazer_quitacao_do_pedido`, no banco.
  const openDesfazerDialog = async (p: Pedido) => {
    setDesfazerDialog(p);
    setDesfazerMotivo('');
    setDesfazerInfo(null);
    const [{ data: titulos }, { data: bonus }] = await Promise.all([
      supabase.from('financeiro_lancamentos' as any).select('id, status').eq('contrato_pedido_id', p.id),
      supabase.from('comissoes_lancamentos' as any).select('id, status, valor_comissao').eq('contrato_pedido_id', p.id),
    ]);
    const titulosPagos = ((titulos ?? []) as unknown as { status: string }[])
      .filter(t => t.status === 'realizado' || t.status === 'conciliado').length;
    const lista = (bonus ?? []) as unknown as { status: string; valor_comissao: number | null }[];
    const pendentes = lista.filter(b => b.status !== 'pago');
    setDesfazerInfo({
      titulosPagos,
      bonusPagas: lista.filter(b => b.status === 'pago').length,
      bonusPendentes: pendentes.length,
      valorBonusPendente: pendentes.reduce((s, b) => s + (Number(b.valor_comissao) || 0), 0),
    });
  };

  const handleDesfazerQuitacao = async () => {
    if (!desfazerDialog || desfazerMotivo.trim().length < 5) return;
    setDesfazendo(true);
    const { data, error } = await supabase.rpc('desfazer_quitacao_do_pedido' as any, {
      p_pedido_id: desfazerDialog.id,
      p_motivo: desfazerMotivo.trim(),
    } as any);
    setDesfazendo(false);
    if (error) { toast.error('Não foi possível desfazer a quitação', { description: error.message }); return; }
    const apagadas = Number((data as { bonificacoes_apagadas?: number } | null)?.bonificacoes_apagadas) || 0;
    toast.success(apagadas > 0
      ? `Quitação desfeita. ${apagadas} bonificação(ões) pendente(s) apagada(s); o pedido voltou a ser editável.`
      : 'Quitação desfeita. O pedido voltou a ser editável.');
    setDesfazerDialog(null);
    load();
  };

  /** Apaga um pedido com o motivo no histórico do Admin e desliga o que apontava para ele. */
  const apagarPedido = async (id: string, numero: string, motivo: string): Promise<string | null> => {
    const pedidoSnap = pedidos.find(p => p.id === id);
    await supabase.from('pedidos_exclusoes' as any).insert({
      contrato_id: contratoId,
      pedido_id: id,
      numero_pedido: numero,
      descricao: pedidoSnap?.descricao || null,
      valor_total: pedidoSnap?.valor_total || 0,
      data_pedido: pedidoSnap?.data_pedido || null,
      status: pedidoSnap?.status || null,
      deletado_por_user_id: user?.id,
      deletado_por_email: user?.email,
      motivo,
      pedido_snapshot: pedidoSnap ? pedidoSnap : null,
    });
    await supabase.from('comissoes_lancamentos' as any).delete().eq('contrato_pedido_id', id);
    await supabase.from('contrato_custos').delete().eq('contrato_pedido_id', id);
    await supabase.from('notas_fiscais').update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    await supabase.from('contas_receber' as any).update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    await supabase.from('pre_nota_itens' as any).update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    const { error } = await supabase.from('contrato_pedidos').delete().eq('id', id);
    return error ? error.message : null;
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteDialog || !deleteReason.trim()) return;
    const { id, numero } = deleteDialog;
    // Lote inteiro (30/09): cada parte sai com o mesmo motivo; o título único
    // do lote, se houver, fica no Financeiro sem lote — apagar título é lá.
    if (deleteDialog.lote) {
      // Uma chamada, uma transação (migration 20260930000003): parte a parte
      // pelo navegador parou no meio na 595.
      setDeleting(true);
      const lote = deleteDialog.lote;
      const { data, error } = await supabase.rpc('excluir_lote_de_pedidos' as never, { p_lote_id: lote.id, p_motivo: deleteReason.trim() } as never);
      setDeleting(false);
      if (error) {
        toast.error('O lote não foi excluído', { description: error.message.includes('excluir_lote_de_pedidos') ? 'A função excluir_lote_de_pedidos ainda não existe no banco: cole a migration 20260930000003.' : error.message });
        return;
      }
      const r = (data ?? {}) as { partes_apagadas?: number; titulos_desligados?: number };
      setDeleteDialog(null);
      setDeleteReason('');
      setLoteSelecionado(null);
      toast.success(`Lote excluído de uma vez: ${r.partes_apagadas ?? lote.partes.length} partes. Motivo registrado.${(r.titulos_desligados ?? 0) > 0 ? ' O título no Financeiro ficou sem lote — se for repetido, exclua-o lá.' : ''}`);
      load();
      return;
    }
    setDeleting(true);
    const erro = await apagarPedido(id, numero, deleteReason.trim());
    setDeleting(false);
    if (erro) {
      toast.error('Erro ao excluir pedido: ' + erro);
      setDeleteDialog(null);
      return;
    }
    toast.success('Pedido excluído. Motivo registrado.');
    setDeleteDialog(null);
    load();
  };

  /**
   * Reenvia o PDF da Ordem/Empenho de um pedido existente: guarda em
   * contratos-docs, registra em contrato_arquivos e atualiza o
   * arquivo_ordem_id — o dossiê passa a apontar o documento novo, sem apagar
   * o antigo (histórico é histórico).
   */
  const reenviarOrdem = async (file: File) => {
    if (!editingPedido || !user?.id) return;
    setReenviandoOrdem(true);
    try {
      const caminho = `${user.id}/${contratoId}/ordens/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('contratos-docs')
        .upload(caminho, file, { upsert: false, contentType: file.type });
      if (upErr) { toast.error('O PDF não pôde ser guardado: ' + upErr.message); return; }
      const { data: arq, error: arqErr } = await supabase
        .from('contrato_arquivos')
        .insert({
          contrato_id: contratoId,
          nome_arquivo: file.name,
          storage_path: caminho,
          tipo: 'ordem_fornecimento',
          user_id: user.id,
        } as never)
        .select('id')
        .single();
      if (arqErr || !arq) { toast.error('O arquivo subiu, mas o registro falhou: ' + (arqErr?.message ?? '')); return; }
      const novoId = (arq as unknown as { id: string }).id;
      const { error: pedErr } = await supabase
        .from('contrato_pedidos')
        .update({ arquivo_ordem_id: novoId } as never)
        .eq('id', editingPedido.id);
      if (pedErr) { toast.error('Não foi possível apontar o pedido para o novo documento: ' + pedErr.message); return; }
      toast.success('Ordem/Empenho reenviada — o pedido passa a apontar o documento novo.');
    } finally {
      setReenviandoOrdem(false);
    }
  };

  const openEditDialog = (p: Pedido) => {
    setEditingPedido(p);
    setEditForm({
      numero_pedido: p.numero_pedido || '',
      descricao: p.descricao || '',
      contrato_item_id: p.contrato_item_id || '',
      quantidade: String(p.quantidade || ''),
      valor_unitario: String(p.valor_unitario || ''),
      data_pedido: p.data_pedido || '',
      data_entrega: p.data_entrega || '',
      status: p.status || 'pendente',
      nota_fiscal: p.nota_fiscal || '',
      observacoes: p.observacoes || '',
      numero_empenho: (p as { numero_empenho?: string }).numero_empenho || '',
      tipo_empenho: (p as { tipo_empenho?: string }).tipo_empenho || '',
      valor_empenho: String((p as { valor_empenho?: number }).valor_empenho ?? ''),
      cota: (p as { cota?: string }).cota || '',
      empenho_id: (p as { empenho_id?: string | null }).empenho_id || '',
      custo_unitario: Number(p.custo_unitario) > 0 ? String(p.custo_unitario) : '',
    });
    setEditDialogOpen(true);
  };

  /**
   * Campos que a quitação da NF e a bonificação do vendedor usaram como base.
   * Com a NF quitada eles ficam como estão (o diálogo já os mostra travados);
   * o resto do pedido continua corrigível — antes de 21/09 a trava era o
   * pedido inteiro, e um número de documento ou uma data errada obrigavam a
   * refazer tudo.
   */
  // A SITUAÇÃO saiu da trava em 22/09 (decisão 15 do dono): nove dos dez
  // pedidos do 068/2025 estavam quitados e presos em "pendente". Quitação e
  // bonificação não dependem dela; entrega é fato posterior à nota.
  const CAMPOS_TRAVADOS_APOS_QUITACAO = 'quantidade, valores, item do contrato e número da NF';

  const handleSaveEdit = async () => {
    if (!editingPedido) return;
    const quitada = Boolean(editingPedido.nf_quitada);
    const qty = parseFloat(editForm.quantidade) || 0;
    const unit = parseFloat(editForm.valor_unitario) || 0;
    if (!quitada) {
      const travaPreco = precoForaDoContratado([{ descricao: editForm.descricao, valor_unitario: unit, contrato_item_id: editForm.contrato_item_id }]);
      if (travaPreco) { toast.error('Preço fora do contratado', { description: travaPreco }); return; }
      const alertaEstoque = avisoEstoqueInsuficiente([{ descricao: editForm.descricao, quantidade: qty, contrato_item_id: editForm.contrato_item_id }]);
      if (alertaEstoque && !confirm(`Estoque insuficiente\n\n${alertaEstoque}\n\nSalvar mesmo assim? (a entrada da compra pode ser lançada depois)`)) return;
    }
    setSavingEdit(true);
    // Sempre corrigíveis: identificação, datas, empenho e observações.
    const alteracoes: Record<string, unknown> = {
      numero_pedido: editForm.numero_pedido,
      descricao: editForm.descricao || null,
      data_pedido: editForm.data_pedido || null,
      data_entrega: editForm.data_entrega || null,
      observacoes: editForm.observacoes || null,
      numero_empenho: normalizarNumeroEmpenho(editForm.numero_empenho),
      tipo_empenho: tipoDeEmpenho(editForm.tipo_empenho),
      valor_empenho: parseFloat(editForm.valor_empenho) || null,
      // O vínculo com o empenho JÁ ANEXADO — é dele que a cota consome e é
      // ele que o kit de faturamento pré-seleciona.
      empenho_id: editForm.empenho_id || null,
      // Situação (pendente, entregue…) é livre mesmo com a NF quitada.
      status: editForm.status,
    };
    // Só sem NF quitada: a base da quitação e da bonificação não muda por aqui.
    if (!quitada) {
      Object.assign(alteracoes, {
        contrato_item_id: editForm.contrato_item_id || null,
        quantidade: qty,
        valor_unitario: unit,
        valor_total: qty * unit,
        nota_fiscal: editForm.nota_fiscal || null,
      });
    }
    const { error } = await supabase.from('contrato_pedidos').update(alteracoes as any).eq('id', editingPedido.id);
    if (error) { setSavingEdit(false); toast.error('Erro ao atualizar: ' + error.message); return; }
    // O custo de compra DECLARADO (22/09) vai pela RPC — trilha e cruzamento —
    // e não é trancado pela quitação: é custo da compra, não da venda.
    if (podeVerCustos) {
      const custoNovo = parseFloat(editForm.custo_unitario) || 0;
      const custoAtual = Number(editingPedido.custo_unitario) || 0;
      if (Math.abs(custoNovo - custoAtual) > 0.00005) {
        const { error: errCusto } = await supabase.rpc('declarar_custo_do_pedido' as never, {
          p_pedido_id: editingPedido.id, p_custo_unitario: custoNovo, p_motivo: null,
        } as never);
        if (errCusto) toast.error('O pedido foi salvo, mas o custo não foi declarado', { description: errCusto.message });
      }
    }
    setSavingEdit(false);
    toast.success(quitada
      ? `Pedido atualizado. Com a NF quitada, ${CAMPOS_TRAVADOS_APOS_QUITACAO} ficaram como estavam.`
      : 'Pedido atualizado.');
    setEditDialogOpen(false);
    setEditingPedido(null);
    load();
  };

  const removeExtractedItem = (key: string) => setExtractedItens(prev => prev.filter(i => i.key !== key));
  const updateExtractedItem = (key: string, field: string, value: string) =>
    setExtractedItens(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));

  // NF Quitada — Fluxo do Financeiro: informa data/valor do pagamento, sistema auto-calcula bonificação
  const openNfDialog = (pedido: Pedido) => {
    setNfDialog(pedido);
    setNfNumero(pedido.nota_fiscal || '');
    setNfData(pedido.data_quitacao || new Date().toISOString().split('T')[0]);
    setNfValorPago(String(pedido.valor_total));
  };

  const handleMarcarNfQuitada = async () => {
    if (!nfDialog || !nfNumero.trim()) { toast.error('Informe o número da Nota Fiscal'); return; }
    if (!nfData) { toast.error('Informe a data do pagamento'); return; }
    const valorPago = parseFloat(nfValorPago) || 0;
    if (valorPago <= 0) { toast.error('Informe o valor pago'); return; }
    setSolicitandoComissao(true);

    // 1. Update pedido with NF quitada
    const { error: updateErr } = await supabase.from('contrato_pedidos').update({
      // Grava já no formato do DANFE: normalizar na entrada evita que a mesma
      // nota exista em três grafias no banco, o que nenhuma formatação de
      // tela consegue desfazer para efeito de busca e ordenação.
      nota_fiscal: formatarNumeroNfe(nfNumero) ?? nfNumero.trim(),
      nf_quitada: true,
      data_quitacao: nfData,
    } as any).eq('id', nfDialog.id);

    if (updateErr) {
      toast.error('Erro ao atualizar NF');
      setSolicitandoComissao(false);
      return;
    }

    // 2. Buscar vendedor responsável pelo contrato
    const { data: contrato } = await supabase
      .from('contratos')
      .select('vendedor_user_id, empresa_id')
      .eq('id', contratoId)
      .single();

    const vendedorId = (contrato as any)?.vendedor_user_id;
    const empresaId = (contrato as any)?.empresa_id || empresaAtiva?.id;

    if (!vendedorId || !empresaId) {
      toast.warning('NF quitada registrada, mas não há vendedor vinculado ao contrato para cálculo de bonificação.');
      setSolicitandoComissao(false);
      setNfDialog(null);
      load();
      return;
    }

    // 3. Buscar config de bonificação do vendedor
    const { data: comConfig } = await supabase
      .from('comissoes_config' as any)
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .maybeSingle();

    const percentual = (comConfig as any)?.percentual || 0;
    const valorFixo = (comConfig as any)?.valor_fixo || 0;
    const tipoComissao = (comConfig as any)?.tipo_comissao || 'percentual_nf_quitada';

    // O tipo salvo é 'percentual_contrato' | 'percentual_lucro' |
    // 'percentual_faturamento' | 'percentual_nf_quitada' | 'valor_fixo' |
    // 'nota_fiscal'. A comparação anterior era com a string 'percentual', que
    // NUNCA bate com nenhum deles — toda bonificação automática saía pelo valor
    // fixo, mesmo configurada em percentual (e pagava 0 a quem não tinha fixo).
    const ehPercentual = tipoComissao.startsWith('percentual');

    // Base do percentual: 'faturamento' usa o valor da nota emitida; os demais
    // percentuais usam o que de fato entrou. Diferente quando há pagamento
    // parcial, e a distinção é o que o operador escolheu ao configurar.
    const valorNota = Number(nfDialog?.valor_total) || valorPago;
    const base = tipoComissao === 'percentual_faturamento' ? valorNota : valorPago;

    const valorComissao = ehPercentual ? base * (percentual / 100) : valorFixo;

    // 4. Criar lançamento de bonificação automático
    const { error: comErr } = await supabase.from('comissoes_lancamentos' as any).insert({
      empresa_id: empresaId,
      user_id: vendedorId,
      solicitado_por: user?.id,
      tipo: 'nota_fiscal',
      valor_base: base,
      percentual_comissao: ehPercentual ? percentual : 0,
      valor_comissao: valorComissao,
      nota_fiscal: nfNumero,
      status: 'pendente',
      contrato_pedido_id: nfDialog.id,
      observacoes: `Bonificação auto-calculada pelo financeiro. NF ${nfNumero} quitada em ${nfData}. Valor pago: ${fmt(valorPago)}. Bonificação (${ehPercentual ? percentual + '% sobre ' + fmt(base) : 'valor fixo'}): ${fmt(valorComissao)}.`,
    } as any);

    if (comErr) {
      console.error('Erro ao criar bonificação:', comErr);
      toast.warning('NF quitada, mas houve erro ao gerar bonificação automaticamente.');
    } else {
      toast.success(`NF quitada! Bonificação de ${fmt(valorComissao)} gerada para o vendedor responsável.`);
    }

    setSolicitandoComissao(false);
    setNfDialog(null);
    load();
  };

  const updateKanbanStatus = async (pedidoId: string, newStatus: string) => {
    setUpdatingKanban(prev => ({ ...prev, [pedidoId]: true }));
    const { error } = await supabase
      .from('pedidos')
      .update({ status: newStatus })
      .eq('id', pedidoId);
    if (error) {
      toast.error('Erro ao atualizar status: ' + error.message);
    } else {
      setKanbanStatuses(prev => ({ ...prev, [pedidoId]: newStatus }));
    }
    setUpdatingKanban(prev => ({ ...prev, [pedidoId]: false }));
  };

  const totalPedidos = pedidos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + p.valor_total, 0);
  const totalExtracted = extractedItens.reduce((s, ei) => {
    const qty = parseFloat(ei.quantidade) || 0;
    const unit = parseFloat(ei.valor_unitario) || 0;
    return s + qty * unit;
  }, 0);

  // Contradição entre a hipótese declarada e o uso real. Aviso, não trava: quem
  // conhece o processo pode ter razão que o sistema não vê, e bloquear aqui
  // empurraria o registro para fora do sistema.
  const avisoExecucao = avisoDeExecucaoIncompativel({
    formaExecucao: dadosExecucao.forma,
    fundamento: dadosExecucao.fundamento,
    quantidadePedidos: pedidos.filter((p) => p.status !== 'cancelado').length,
  });


  // ── Busca e filtro locais ────────────────────────────────────────────────
  // Filtram o que JÁ está carregado; nenhuma consulta nova. Um contrato de
  // fornecimento contínuo chega a centenas de pedidos, e achar "OF-114" rolando
  // a tabela era o que fazia esta aba parecer interminável.
  const termoPedido = buscaPedido.trim().toLowerCase();
  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroStatus !== '__todos__' && p.status !== filtroStatus) return false;
    if (!termoPedido) return true;
    return p.numero_pedido.toLowerCase().includes(termoPedido)
      || (p.descricao ?? '').toLowerCase().includes(termoPedido)
      || (p.nota_fiscal ?? '').toLowerCase().includes(termoPedido)
      || (p.numero_empenho ?? '').toLowerCase().includes(termoPedido);
  });
  const filtrosDePedido = (termoPedido ? 1 : 0) + (filtroStatus !== '__todos__' ? 1 : 0);

  const pedidoAberto = pedidos.find((p) => p.id === pedidoSelecionado) ?? null;

  /** Status em texto + ícone + cor — nunca só cor. */
  const tomDoStatus = (s: string): 'atencao' | 'sucesso' | 'ativo' | 'critico' =>
    s === 'entregue' ? 'sucesso' : s === 'cancelado' ? 'critico' : s === 'parcial' ? 'ativo' : 'atencao';

  /**
   * Os empenhos do contrato, desenhados uma vez e usados em DOIS lugares.
   *
   * A referência pede as duas presenças, e cada uma responde a uma pergunta
   * diferente: na subaba "Empenhos" é o assunto; na subaba "Pedidos" é o
   * contexto — "o que autoriza estes pedidos, e quanto ainda resta neles". Uma
   * função só evita o defeito clássico de duas cópias que divergem na primeira
   * regra que mudar.
   */
  useEffect(() => {
    if (abriuPelaUrl || empenhosDoContrato.length === 0) return;
    const alvo = new URLSearchParams(window.location.search).get('empenho');
    if (!alvo) return;
    const e = empenhosDoContrato.find((x) => x.id === alvo);
    if (e) setEditandoEmpenho({ id: e.id, numero: e.numero });
    setAbriuPelaUrl(true);
  }, [empenhosDoContrato, abriuPelaUrl]);

  const listaDeEmpenhos = (
    <div className="flex flex-col gap-2">
      {empenhosDoContrato.map(e => {
        const cotas = saldosDeEmpenho.filter(s => s.empenho_id === e.id);
        return (
          <div key={e.id} className={`rounded-lg border p-3 ${
            e.cancelado ? 'border-destructive-line bg-destructive-tint' : 'border-border bg-card'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`g-corpo font-medium tabular-nums ${
                  e.cancelado ? 'line-through text-muted-foreground' : ''
                }`}>{e.numero}</span>
                <Badge variant="muted">
                  {ROTULO_DO_EMPENHO[e.tipo as 'ordinario'] ?? e.tipo}
                </Badge>
                {/* O painel é o que se olha. Sem isto o empenho cancelado
                    aparece igual a um vivo, com "1 de 1 disponíveis", e
                    quem lançar entrega sobre ele produz despesa sem
                    cobertura sem nenhum sinal na tela. */}
                {e.cancelado && (
                  <SeloSituacao tom="critico" icone={Ban}>Cancelado</SeloSituacao>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* A vida do empenho: original, reforços, anulações. O
                    estimativo nasce pequeno e é reforçado — sem isto,
                    aumentá-lo exigiria sobrescrever o valor e apagar que
                    houve reforço. */}
                <Button size="sm" variant="ghost"
                  onClick={() => setEditandoEmpenho({ id: e.id, numero: e.numero })}
                  title="Editar número, espécie, data, valor, linhas — ou apagar">
                  <Pencil aria-hidden="true" /> Editar
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => setMovimentando({
                    id: e.id, numero: e.numero, tipo: e.tipo, contratoId,
                  })}>
                  <TrendingUp aria-hidden="true" /> Reforço / anulação
                </Button>
                {e.arquivo_id ? (
                  <Button size="sm" variant="ghost"
                    onClick={() => abrirDocumentoDoEmpenho(e.arquivo_id!)}>
                    <Eye aria-hidden="true" /> Ver documento
                  </Button>
                ) : (
                  // Empenho sem PDF é autorização que não se prova. Dizer
                  // qual está sem documento é o que permite ir buscá-lo.
                  <span className="g-meta text-warning-ink">
                    sem documento anexado
                  </span>
                )}
              </div>
            </div>
            {e.cancelado ? (
              // A quantidade continua lá porque anulação é ato de VALOR e
              // não mexe em quantidade. Mostrá-la aqui faria o empenho
              // parecer disponível — o que vale dizer é que ele não
              // autoriza mais nada.
              <p className="g-meta text-destructive-ink mt-1.5">
                Anulado por inteiro. Não autoriza mais nenhuma entrega — entregar sob empenho
                cancelado é despesa sem cobertura (Lei 4.320/64, art. 60).
              </p>
            ) : (
              <>
                <div className="mt-1.5 flex flex-wrap gap-4">
                  {cotas.map(cota => (
                    <span key={cota.cota} className="g-meta text-muted-foreground">
                      {cota.cota === 'reservada' ? 'Cota reservada' : 'Cota principal'}:{' '}
                      {cota.reforcado ? (
                        // Empenho com reforço mede-se em DINHEIRO: reforço é
                        // ato de valor, e a quantidade da nota original fica
                        // obsoleta no primeiro. "−395 de 2.802" acusava
                        // déficit num empenho com R$ 63 mil positivos.
                        <>
                          <b className="text-foreground tabular-nums">
                            {cota.saldo_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </b>{' '}
                          disponíveis (com reforços — a régua é o valor)
                        </>
                      ) : (
                        <>
                          <b className="text-foreground tabular-nums">
                            {cota.saldo_qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                          </b>{' '}
                          de {cota.qtd_empenhada.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} disponíveis
                        </>
                      )}
                    </span>
                  ))}
                </div>
                {/* O valor total vigente (original + reforços − anulações),
                    abaixo das cotas — a mesma régua da RPC. Sem valor
                    registrado, nada é inventado. */}
                {(cotas[0]?.valor_vigente ?? 0) > 0 && (
                  <p className="g-meta text-muted-foreground mt-1">
                    Valor:{' '}
                    <b className="text-foreground tabular-nums">
                      {Number(cotas[0].valor_vigente).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </b>
                    {cotas[0].reforcado && ' (com reforços)'}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  /**
   * O painel do pedido selecionado.
   *
   * Traz para um lugar só o que a linha da tabela não comporta sem virar um
   * muro: de que contrato e de que órgão o pedido é, qual empenho o autoriza,
   * o que o estoque tem reservado para ele, e as três ações do contexto. Cada
   * campo sem dado apurado sai como indisponível, não como zero.
   */
  const itemDoPedido = pedidoAberto?.contrato_item_id
    ? itens.find(i => i.id === pedidoAberto.contrato_item_id) ?? null
    : null;
  const empenhoDoPedido = pedidoAberto?.empenho_id
    ? empenhosDoContrato.find(e => e.id === pedidoAberto.empenho_id) ?? null
    : null;
  const reservaDoPedido = pedidoAberto ? estoqueDoItem(pedidoAberto.contrato_item_id) : null;

  const painelDoPedido = pedidoAberto ? (
    // A caixa do pedido (30/09): cabeçalho numa faixa, o item e as observações
    // à esquerda, origem e prazo à direita, as ações num rodapé. Blocos de
    // alturas diferentes em duas colunas soltas deixavam buracos.
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start [&>*]:min-w-0">
      <div className="xl:col-span-2 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold leading-tight">Pedido {pedidoAberto.numero_pedido}</h3>
            <SeloSituacao tom={tomDoStatus(pedidoAberto.status)}>{(statusCfg[pedidoAberto.status] ?? statusCfg.pendente).label}</SeloSituacao>
          </div>
          {pedidoAberto.descricao
            ? <TextoRecolhido texto={pedidoAberto.descricao} linhas={2} limiar={140} className="g-corpo mt-1 leading-relaxed" />
            : <p className="g-corpo mt-1 text-muted-foreground">Sem descrição registrada.</p>}
        </div>
        {pedidoAberto.lote_id && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => { const l = pedidoAberto.lote_id!; setPedidoSelecionado(null); setLoteSelecionado(l); }}>
            ← Voltar ao lote
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 xl:order-2">
      <BlocoDoPainel titulo="Origem">
        <ListaDeCampos
          campos={[
            {
              rotulo: 'Contrato',
              valor: contratoInfo?.numero_contrato || <ValorIndisponivel razao="Sem número" />,
            },
            {
              rotulo: 'Órgão',
              largo: true,
              valor: contratoInfo?.orgao_contratante || <ValorIndisponivel razao="Não informado" />,
            },
            {
              rotulo: 'Origem do item',
              valor: itemDoPedido
                ? (situacaoDosItens.get(itemDoPedido.id) ? `Atualizado pelo ${situacaoDosItens.get(itemDoPedido.id)!.rotulo}` : 'Contrato original, sem termo aplicado')
                : <ValorIndisponivel razao="Pedido sem item vinculado" />,
            },
            {
              rotulo: 'Empenho de origem',
              valor: empenhoDoPedido
                ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="tabular-nums">{empenhoDoPedido.numero}</span>
                    {empenhoDoPedido.cancelado && <SeloSituacao tom="critico" icone={Ban}>Cancelado</SeloSituacao>}
                    {/* O PDF do empenho mora no empenho, não no pedido: daqui
                        ele abre direto, sem passar pela subaba Empenhos. */}
                    {empenhoDoPedido.arquivo_id && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void abrirDocumentoDoEmpenho(empenhoDoPedido.arquivo_id!)}
                        title="Abrir o documento deste empenho"
                      >
                        <Eye aria-hidden="true" className="h-3.5 w-3.5" /> Ver documento
                      </button>
                    )}
                  </span>
                )
                : pedidoAberto.numero_empenho
                  // Pedido antigo guarda o número solto, sem o vínculo
                  // `empenho_id` — dizer isso é o que permite corrigi-lo na
                  // edição, em vez de parecer pedido sem empenho nenhum.
                  ? <span className="tabular-nums" title="Número digitado, sem vínculo ao empenho registrado">{pedidoAberto.numero_empenho}</span>
                  : <ValorIndisponivel razao="Sem empenho vinculado" />,
            },
            {
              rotulo: 'Situação da reserva',
              largo: true,
              valor: reservaDoPedido
                ? (
                  <span className={reservaDoPedido.disponivel < 0 ? 'text-warning-ink' : undefined}>
                    {reservaDoPedido.disponivel.toLocaleString('pt-BR')} disponível
                    {' · '}{reservaDoPedido.fisico.toLocaleString('pt-BR')} físico
                    {' − '}{reservaDoPedido.reservado.toLocaleString('pt-BR')} reservado
                  </span>
                )
                : <ValorIndisponivel razao="Item sem produto no estoque" />,
            },
          ]}
        />
      </BlocoDoPainel>
      <BlocoDoPainel titulo="Prazo">
        <ListaDeCampos
          campos={[
            { rotulo: 'Data do pedido', valor: pedidoAberto.data_pedido ? new Date(pedidoAberto.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : <ValorIndisponivel razao="Não informada" /> },
            { rotulo: 'Entrega prevista', valor: pedidoAberto.data_entrega ? new Date(pedidoAberto.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : <ValorIndisponivel razao="Não informada" /> },
          ]}
        />
        <AvisoDePrazoDeEntrega
          contrato={prazos}
          dataDoPedido={pedidoAberto.data_pedido}
          dataDeEntrega={pedidoAberto.status === 'entregue' ? pedidoAberto.data_entrega : null}
        />
      </BlocoDoPainel>
      </div>

      <div className="flex flex-col gap-4 xl:order-1">
      <BlocoDoPainel titulo="Item, quantidade e valores">
        <ListaDeCampos
          campos={[
            {
              rotulo: 'Item do contrato',
              largo: true,
              valor: itemDoPedido
                ? <TextoRecolhido texto={itemDoPedido.descricao} linhas={2} limiar={160} />
                : <ValorIndisponivel razao="Não vinculado" />,
            },
            {
              rotulo: 'Quantidade',
              numerico: true,
              valor: pedidoAberto.quantidade == null
                ? <ValorIndisponivel razao="Não informada" />
                : `${Number(pedidoAberto.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${itemDoPedido?.unidade ? ` ${itemDoPedido.unidade}` : ''}`,
            },
            {
              rotulo: 'Valor unitário',
              numerico: true,
              valor: pedidoAberto.valor_unitario == null
                ? <ValorIndisponivel razao="Não informado" />
                : fmt(Number(pedidoAberto.valor_unitario)),
            },
            { rotulo: 'Valor total', numerico: true, valor: fmt(Number(pedidoAberto.valor_total) || 0) },
            { rotulo: 'Cota', valor: pedidoAberto.cota ? (ROTULO_DA_COTA[pedidoAberto.cota as 'principal'] ?? pedidoAberto.cota) : <ValorIndisponivel razao="Sem divisão de cota" /> },
            { rotulo: 'Nota fiscal', valor: pedidoAberto.nota_fiscal ? (formatarNumeroNfe(pedidoAberto.nota_fiscal) ?? pedidoAberto.nota_fiscal) : <ValorIndisponivel razao="Ainda não faturado" /> },
          ]}
        />
      </BlocoDoPainel>
      {pedidoAberto.observacoes && (
        <BlocoDoPainel titulo="Observações">
          <p className="g-meta whitespace-pre-wrap">{pedidoAberto.observacoes}</p>
        </BlocoDoPainel>
      )}
      </div>


      <div className="xl:col-span-2 xl:order-3">
      <BlocoDoPainel titulo={pedidoAberto.lote_id ? 'Ações desta parte' : 'Ações'}>
        <div className="flex flex-col gap-2">
          {/* Parte de um lote (30/09): o que é da NOTA (ordem, pré-NF, kit,
              vínculo do título) mora na caixa do lote; aqui fica só o que é
              desta parte — custo, quitação, editar, excluir. */}
          {!pedidoAberto.lote_id && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="g-controle" onClick={openNewDialog}
              title="Anexar a Ordem de Fornecimento ou Nota de Empenho e registrar o pedido">
              <Upload aria-hidden="true" /> Registrar ordem/empenho
            </Button>
            <Button size="sm" variant="outline" className="g-controle" onClick={() => setPreNfDialogOpen(true)}
              disabled={pedidos.filter(p => p.status !== 'cancelado').length === 0}>
              <Receipt aria-hidden="true" /> Gerar pré-NF
            </Button>
            <Button size="sm" variant="outline" className="g-controle"
              title="Abrir Gestão de Compras para criar o pedido pelo funil comercial"
              onClick={() => navigate(`/gestao-compras?novo_contrato=${contratoId}`)}>
              <ShoppingCart aria-hidden="true" /> Criar no Kanban
            </Button>
          </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {/* Kit vale antes e depois da quitação: o órgão pede a segunda via,
                e a fila do financeiro só mostra o que ainda não foi baixado. */}
            {!pedidoAberto.lote_id && (
            <KitFaturamento
              pedido={{
                id: pedidoAberto.id,
                numero_pedido: pedidoAberto.numero_pedido,
                valor_total: pedidoAberto.valor_total,
                nota_fiscal: pedidoAberto.nota_fiscal,
                contrato_id: contratoId,
              }}
            />
            )}
            {podeVerCustos && (
              <Button size="sm" variant="outline" className="g-controle" onClick={() => setComprasDialog(pedidoAberto)}
                title="Contas a pagar do contrato atribuídas a este pedido — o custo comprovado, contra o declarado">
                <ShoppingCart aria-hidden="true" /> Compras deste pedido
              </Button>
            )}
            {!pedidoAberto.nf_quitada && pedidoAberto.status === 'entregue' && (isFinanceiro || isAdmin) && (
              <Button size="sm" variant="outline"
                className="g-controle border-success-line text-success-ink hover:bg-success-tint hover:text-success-ink"
                onClick={() => openNfDialog(pedidoAberto)}
                title="Registrar pagamento da NF-e e gerar bonificação">
                <DollarSign aria-hidden="true" /> Quitar NF
              </Button>
            )}
            {(isFinanceiro || isAdmin) && !pedidoAberto.lote_id && (
              /* Pedido retroativo — cadastrado depois de o recebimento já estar
                 no Financeiro. Vincular em vez de gerar evita contar a receita
                 duas vezes. */
              <Button size="sm" variant="outline" className="g-controle"
                title="Vincular a lançamento existente no Financeiro"
                onClick={() => setVinculando({
                  id: pedidoAberto.id,
                  numero_pedido: pedidoAberto.numero_pedido,
                  valor_total: Number(pedidoAberto.valor_total) || 0,
                  data_pedido: pedidoAberto.data_pedido,
                  nota_fiscal: pedidoAberto.nota_fiscal ?? null,
                })}>
                <Link2 aria-hidden="true" /> Vincular lançamento
              </Button>
            )}
            {!pedidoAberto.lote_id && (
            <Button size="sm" variant="outline" className="g-controle"
              onClick={() => void abrirOrdem(pedidoAberto)}
              title="Abrir a Ordem de Fornecimento ou a Nota de Empenho que autorizou este pedido">
              <FileText aria-hidden="true" /> Ordem / Empenho
            </Button>
            )}
            {pedidoAberto.nf_quitada && (isFinanceiro || isAdmin) && (
              <Button size="sm" variant="outline" className="g-controle"
                onClick={() => void openDesfazerDialog(pedidoAberto)}
                title="Desfazer a quitação desta NF-e (com motivo — fica no histórico do Admin)">
                <Undo2 aria-hidden="true" /> Desfazer quitação
              </Button>
            )}
            {!pedidoAberto.lote_id && empenhosDoContrato.length > 0 && (
              <Button size="sm" variant="outline" className="g-controle" title="Trocar o empenho que autoriza este pedido"
                onClick={() => { setNovoEmpenhoId(pedidoAberto.empenho_id ?? 'nenhum'); setTrocaDeEmpenho({ rotulo: `pedido ${pedidoAberto.numero_pedido}`, pedidos: [pedidoAberto.id], atual: pedidoAberto.empenho_id ?? null }); }}>
                <FileText aria-hidden="true" /> Trocar empenho
              </Button>
            )}
            <Button size="sm" variant="outline" className="g-controle"
              onClick={() => openEditDialog(pedidoAberto)}
              title={(isFinanceiro || isAdmin)
                ? (pedidoAberto.nf_quitada ? 'Editar pedido (NF quitada: quantidade, valores e NF ficam travados)' : 'Editar pedido')
                : 'Ver detalhes'}>
              <Pencil aria-hidden="true" /> {(isFinanceiro || isAdmin) ? 'Editar' : 'Ver detalhes'}
            </Button>
            {/* Todo membro exclui — o precedente das publicações (02/09): a
                exclusão EXIGE motivo e grava snapshot em pedidos_exclusoes para
                o Admin; o RLS é por membro desde 22/06. */}
            {!pedidoAberto.nf_quitada && (
              <Button size="sm" variant="outline" className="g-controle text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink"
                title="Excluir pedido (motivo obrigatório — fica no histórico do Admin)"
                onClick={() => openDeleteDialog(pedidoAberto.id, pedidoAberto.numero_pedido)}>
                <Trash2 aria-hidden="true" /> Excluir
              </Button>
            )}
          </div>
        </div>
      </BlocoDoPainel>
      </div>
    </div>
  ) : null;

  /** O lote aberto: a nota rateada e as partes, item a item (29/09). */
  const loteAberto: Lote<Pedido> | null = loteSelecionado
    ? (agruparEmLotes(pedidos).find((l) => l.tipo === 'lote' && l.lote.id === loteSelecionado) as { tipo: 'lote'; lote: Lote<Pedido> } | undefined)?.lote ?? null
    : null;
  const empenhoDoLote = loteAberto?.empenho_id ? empenhosDoContrato.find(e => e.id === loteAberto.empenho_id) ?? null : null;
  // O lote abre numa CAIXA ampla no centro (29/09, pedido do dono), não na
  // gaveta lateral: origem à esquerda, as partes à direita, com espaço para
  // a tabela. A parte aberta vai para o painel do pedido, que tem as ações.
  const abrirParteDoLote = (id: string) => { setLoteSelecionado(null); setPedidoSelecionado(id); };

  /** O clique no número da nota (30/09): abre o DANFE; sem PDF, gera do XML e abre; sem XML, diz o que falta. */
  const abrirNotaDoLote = async (lote: Lote<Pedido>) => {
    const nd = lote.partes.map((p) => notaDoPedido?.[p.id]).find((x) => x && (x.storage_path || x.arquivo_xml)) ?? null;
    if (!nd) { toast.info('Esta nota ainda não tem título ligado a este lote.', { description: 'Importe o XML pela Extração de Documentos; o DANFE nasce junto.' }); return; }
    if (nd.tem_pdf && nd.storage_path) { await abrirDocumentoDoFinanceiro(nd.storage_path, nd.arquivo_nome ?? 'DANFE'); return; }
    if (nd.arquivo_xml) {
      await gerarDanfeDaNota(nd);
      try { abrirEspelho(parseNFeXML(nd.arquivo_xml)); } catch { /* o DANFE guardado abre pela linha assim que a lista recarregar */ }
      return;
    }
    if (nd.storage_path) await abrirDocumentoDoFinanceiro(nd.storage_path, nd.arquivo_nome ?? 'Arquivo');
  };

  /** A nota do lote: o arquivo (DANFE em PDF, quando anexado) e o espelho lido do XML. Vive no título único; as partes a compartilham. */
  const notaDoLote = (lote: Lote<Pedido>, modo: 'links' | 'botoes' = 'links') => {
    const nd = lote.partes.map((p) => notaDoPedido?.[p.id]).find((x) => x && (x.storage_path || x.arquivo_xml)) ?? null;
    if (modo === 'botoes') {
      // Na Origem do lote (30/09): o DANFE é um botão. Sem título ligado, diz o que falta.
      if (!nd) return <span className="g-meta text-muted-foreground">Sem título do Financeiro ligado a este lote — importe o XML pela Extração de Documentos.</span>;
      return (
        <div className="flex flex-wrap items-center gap-2">
          {nd.tem_pdf && nd.storage_path && (
            <Button size="sm" variant="default" onClick={() => abrirDocumentoDoFinanceiro(nd.storage_path!, nd.arquivo_nome ?? 'DANFE')} title={`Abrir ${nd.arquivo_nome}`}>
              <FileText aria-hidden="true" />Abrir DANFE (PDF)
            </Button>
          )}
          {nd.arquivo_xml && !nd.tem_pdf && (
            <Button size="sm" variant="default" disabled={gerandoDanfe === nd.lancamento_id} onClick={() => void gerarDanfeDaNota(nd)} title="Gera o DANFE (PDF) a partir do XML autorizado e guarda junto do título">
              {gerandoDanfe === nd.lancamento_id ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FileText aria-hidden="true" />}Gerar DANFE (PDF)
            </Button>
          )}
          {nd.storage_path && !nd.tem_pdf && (
            <Button size="sm" variant="outline" onClick={() => abrirDocumentoDoFinanceiro(nd.storage_path!, nd.arquivo_nome ?? 'Arquivo')} title={`Abrir ${nd.arquivo_nome}`}>
              <ExternalLink aria-hidden="true" />Abrir arquivo
            </Button>
          )}
          {nd.arquivo_xml && (
            <Button size="sm" variant="ghost" title="Leitura do XML da nota em nova aba"
              onClick={() => { try { if (!abrirEspelho(parseNFeXML(nd.arquivo_xml!))) toast.error('O navegador bloqueou a janela do espelho da nota.'); } catch { toast.error('Não foi possível ler o XML desta nota.'); } }}>
              Espelho do XML
            </Button>
          )}
        </div>
      );
    }
    if (!nd) return null;
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {nd.storage_path && (
          <button type="button" className="g-meta inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" onClick={() => abrirDocumentoDoFinanceiro(nd.storage_path!, nd.arquivo_nome ?? 'Nota fiscal')} title={`Abrir ${nd.arquivo_nome}`}>
            <ExternalLink aria-hidden="true" className="h-3 w-3" />{/\.xml$/i.test(nd.arquivo_nome ?? '') ? 'Abrir XML' : 'Abrir DANFE'}
          </button>
        )}
        {nd.arquivo_xml && !nd.tem_pdf && (
          <button type="button" className="g-meta inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline disabled:opacity-60" disabled={gerandoDanfe === nd.lancamento_id}
            title="Gera o DANFE (PDF) a partir do XML autorizado e guarda junto do título" onClick={() => void gerarDanfeDaNota(nd)}>
            {gerandoDanfe === nd.lancamento_id ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : <FileText aria-hidden="true" className="h-3 w-3" />}Gerar DANFE
          </button>
        )}
        {nd.arquivo_xml && (
          <button type="button" className="g-meta inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:underline" title="Leitura do XML da nota em nova aba"
            onClick={() => { try { if (!abrirEspelho(parseNFeXML(nd.arquivo_xml!))) toast.error('O navegador bloqueou a janela do espelho da nota.'); } catch { toast.error('Não foi possível ler o XML desta nota.'); } }}>
            Espelho
          </button>
        )}
      </span>
    );
  };
  const caixaDoLote = (
    <Dialog open={!!loteAberto} onOpenChange={(v) => { if (!v) setLoteSelecionado(null); }}>
      <DialogContent className="max-w-[min(97vw,100rem)] max-h-[92vh] overflow-y-auto" data-testid="painel-do-lote">
        {loteAberto && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-3">
                <DialogTitle>Lote {loteAberto.numero}</DialogTitle>
                <SeloSituacao tom={tomDoStatus(loteAberto.status)}>{(statusCfg[loteAberto.status] ?? statusCfg.pendente).label}</SeloSituacao>
                {loteAberto.progresso && <span className="g-meta text-muted-foreground">{loteAberto.progresso}</span>}
              </div>
              <DialogDescription>{rotuloDoLote(loteAberto)} — cada parte é um pedido do item do contrato: consome o saldo dele e tem as próprias ações.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
              <BlocoDoPainel titulo="Origem">
                <ListaDeCampos
                  campos={[
                    { rotulo: 'Contrato', valor: contratoInfo?.numero_contrato || <ValorIndisponivel razao="Sem número" /> },
                    { rotulo: 'Órgão', largo: true, valor: contratoInfo?.orgao_contratante || <ValorIndisponivel razao="Não informado" /> },
                    { rotulo: 'Empenho de origem', largo: true, valor: empenhoDoLote
                      ? (empenhoDoLote.arquivo_id
                        ? <button type="button" className="inline-flex items-center gap-1 rounded text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Abrir o documento deste empenho" onClick={() => void abrirDocumentoDoEmpenho(empenhoDoLote.arquivo_id!)}>
                            <span className="tabular-nums">{empenhoDoLote.numero}</span> ({ROTULO_DO_EMPENHO[empenhoDoLote.tipo as 'ordinario'] ?? empenhoDoLote.tipo}) <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        : <span title="Empenho sem documento anexado">{empenhoDoLote.numero} ({ROTULO_DO_EMPENHO[empenhoDoLote.tipo as 'ordinario'] ?? empenhoDoLote.tipo}) · sem documento</span>)
                      : loteAberto.numero_empenho || <ValorIndisponivel razao="Sem empenho" /> },
                    { rotulo: 'Nota fiscal', largo: true, valor: loteAberto.nota_fiscal
                      ? <span className="inline-flex flex-wrap items-center gap-2">
                          <button type="button" className="inline-flex items-center gap-1 rounded text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Abrir o DANFE desta nota" onClick={() => void abrirNotaDoLote(loteAberto)}>
                            <span className="tabular-nums">{formatarNumeroNfe(loteAberto.nota_fiscal) ?? loteAberto.nota_fiscal}</span> <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                          {notaDoLote(loteAberto)}
                        </span>
                      : <ValorIndisponivel razao="Sem nota" /> },
                    { rotulo: 'Data', valor: loteAberto.data_pedido ? new Date(loteAberto.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : <ValorIndisponivel razao="Sem data" /> },
                    { rotulo: 'Valor do lote', valor: fmt(loteAberto.valor_total), numerico: true },
                    { rotulo: 'Partes', valor: loteAberto.partes.length, numerico: true },
                    // A cesta (30/09): o que o órgão compra é a cesta, não o açúcar —
                    // preço, custo e margem por cesta quando o lote sabe quantas entregou.
                    ...(() => {
                      const c = porUnidadeComposta(loteAberto);
                      if (!c) return [];
                      const nome = loteAberto.unidade_composta || 'cesta';
                      return [
                        { rotulo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)}s entregues`, valor: Number(loteAberto.unidades_compostas).toLocaleString('pt-BR'), numerico: true },
                        { rotulo: `Faturado por ${nome}`, valor: fmt(c.preco), numerico: true },
                        { rotulo: `Custo por ${nome}`, valor: c.custo != null ? fmt(c.custo) : <ValorIndisponivel razao="Sem custo nas partes" />, numerico: true },
                        { rotulo: `Margem por ${nome}`, valor: c.margem != null ? `${fmt(c.margem)} (${c.margemPct?.toFixed(1)}%)` : <ValorIndisponivel razao="Sem custo nas partes" />, numerico: true },
                      ];
                    })(),
                  ]}
                />
              </BlocoDoPainel>
              <BlocoDoPainel titulo={`Itens do lote (${loteAberto.partes.length})`}>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 whitespace-nowrap" aria-sort={ordemDoLote === 'asc' ? 'ascending' : 'descending'}>
                          <button type="button" className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOrdemDoLote((o) => (o === 'asc' ? 'desc' : 'asc'))} title="Ordenar pelo número do item">
                            Item {ordemDoLote === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />}
                          </button>
                        </th>
                        <th className="px-3 py-2 whitespace-nowrap">Itens do Processo</th>
                        <th className="px-3 py-2 min-w-[18rem]">Descrição</th>
                        <th className="px-3 py-2 whitespace-nowrap">Unidade</th>
                        <th className="px-3 py-2 text-right">Qtd</th>
                        <th className="px-3 py-2 text-right">Unitário</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2">Situação</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...loteAberto.partes]
                        .map((parte) => ({ parte, item: parte.contrato_item_id ? itens.find(i => i.id === parte.contrato_item_id) ?? null : null }))
                        .sort((a, b) => {
                          // Número do item do contrato (1, 2, 3…); sem número, fica no fim, pela parte.
                          const na = parseInt(String(a.item?.codigo_item ?? ''), 10); const nb = parseInt(String(b.item?.codigo_item ?? ''), 10);
                          const va = Number.isFinite(na) ? na : Number.MAX_SAFE_INTEGER; const vb = Number.isFinite(nb) ? nb : Number.MAX_SAFE_INTEGER;
                          const cmp = va - vb || a.parte.numero_pedido.localeCompare(b.parte.numero_pedido, 'pt-BR', { numeric: true });
                          return ordemDoLote === 'asc' ? cmp : -cmp;
                        })
                        .map(({ parte, item }) => (
                          <tr key={parte.id} className="hover:bg-muted/60">
                            <td className="px-3 py-2 whitespace-nowrap font-medium tabular-nums">{item?.codigo_item ?? '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <button type="button" className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => abrirParteDoLote(parte.id)} title="Abrir esta parte: notas, custo e ações">{parte.numero_pedido}</button>
                            </td>
                            <td className="px-3 py-2 min-w-64"><span className="line-clamp-2" title={item?.descricao ?? parte.descricao ?? ''}>{item ? item.descricao : (parte.descricao ?? '—')}</span></td>
                            <td className="px-3 py-2 whitespace-nowrap">{item?.unidade ? unidadeLegivel(item.unidade) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{Number(parte.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(Number(parte.valor_unitario) || 0)}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(parte.valor_total)}</td>
                            <td className="px-3 py-2 whitespace-nowrap"><SeloSituacao tom={tomDoStatus(parte.status)}>{(statusCfg[parte.status] ?? statusCfg.pendente).label}</SeloSituacao></td>
                            <td className="px-3 py-2 whitespace-nowrap text-right"><Button size="sm" variant="outline" className="h-7" onClick={() => abrirParteDoLote(parte.id)}>Abrir</Button></td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-secondary"><tr className="text-sm font-semibold"><td className="px-3 py-2" colSpan={6}>Total do lote</td><td className="px-3 py-2 text-right tabular-nums">{fmt(loteAberto.valor_total)}</td><td colSpan={2}></td></tr></tfoot>
                  </table>
                </div>
              </BlocoDoPainel>
              <div className="xl:col-span-2">
              {/* As ações da NOTA moram aqui (30/09): o lote é a nota; a parte é o item. */}
              <BlocoDoPainel titulo="Ações do lote">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" className="g-controle" onClick={openNewDialog} title="Anexar a Ordem de Fornecimento ou Nota de Empenho e registrar o pedido">
                    <Upload aria-hidden="true" /> Registrar ordem/empenho
                  </Button>
                  <Button size="sm" variant="outline" className="g-controle" onClick={() => setPreNfDialogOpen(true)} disabled={pedidos.filter(p => p.status !== 'cancelado').length === 0}>
                    <Receipt aria-hidden="true" /> Gerar pré-NF
                  </Button>
                  <Button size="sm" variant="outline" className="g-controle" title="Abrir Gestão de Compras para criar o pedido pelo funil comercial" onClick={() => navigate(`/gestao-compras?novo_contrato=${contratoId}`)}>
                    <ShoppingCart aria-hidden="true" /> Criar no Kanban
                  </Button>
                  {loteAberto.partes[0] && (
                    <KitFaturamento pedido={{ id: loteAberto.partes[0].id, numero_pedido: loteAberto.numero, valor_total: loteAberto.valor_total, nota_fiscal: loteAberto.nota_fiscal, contrato_id: contratoId }} />
                  )}
                  {loteAberto.partes[0] && (
                    <Button size="sm" variant="outline" className="g-controle" onClick={() => void abrirOrdem(loteAberto.partes[0])} title="Abrir a Ordem de Fornecimento ou a Nota de Empenho que autorizou este lote">
                      <FileText aria-hidden="true" /> Ordem / Empenho
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="g-controle" title="Trocar o empenho que autoriza este lote — vale para as 18 partes e recalcula os saldos"
                    onClick={() => { setNovoEmpenhoId(loteAberto.empenho_id ?? 'nenhum'); setTrocaDeEmpenho({ rotulo: `lote ${loteAberto.numero} (${loteAberto.partes.length} partes)`, pedidos: loteAberto.partes.map((p) => p.id), atual: loteAberto.empenho_id ?? null }); }}>
                    <FileText aria-hidden="true" /> Trocar empenho
                  </Button>
                  <Button size="sm" variant="outline" className="g-controle text-destructive-ink hover:bg-destructive-tint hover:text-destructive-ink" onClick={() => setDeleteDialog({ id: loteAberto.id, numero: `${loteAberto.numero} (lote)`, lote: { id: loteAberto.id, partes: loteAberto.partes.map((p) => p.id) } })} title="Exclui as partes deste lote com motivo no histórico do Admin">
                    <Trash2 aria-hidden="true" /> Excluir lote
                  </Button>
                </div>
              </BlocoDoPainel>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLoteSelecionado(null)}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  // ── A auditoria dos lançamentos: o alerta que fica ────────────────────────
  // Política definida em 01/09 sobre o caso real: uma NF-e com VU errado
  // (22,50 num contrato de 22,55) seguiu "sem intervenção humana" e a entrega
  // entrou DUAS vezes — R$ 33.750 de consumo fantasma que só a conferência
  // contra o Portal pegou. Não se barra (erro humano é exceção legítima);
  // ALERTA-SE, persistentemente, com o IMPACTO em reais. Derivado a cada render
  // — quando os dados são corrigidos, o aviso morre sozinho.
  const suspeitasDeLancamento = auditarPedidos(
    pedidos.map(p => ({
      id: p.id, numero_pedido: p.numero_pedido,
      quantidade: p.quantidade, valor_unitario: p.valor_unitario,
      valor_total: p.valor_total, data_pedido: p.data_pedido,
      contrato_item_id: p.contrato_item_id, status: p.status, lote_id: p.lote_id ?? null,
    })),
    itens.length === 1 ? itens[0].valor_unitario : null,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {avisoExecucao && (
        <AvisoDeContexto titulo="Forma de execução declarada não bate com o uso">
          {avisoExecucao}
        </AvisoDeContexto>
      )}

      {/* Os números que o cabeçalho antigo carregava em texto corrido
          ("N pedidos | Total: R$ …"), agora em tira baixa e com a base de cada
          um declarada — regra 2 do comando. */}
      <FaixaIndicadores
        itens={[
          {
            rotulo: 'Pedidos lançados',
            valor: pedidos.length,
            detalhe: 'todos os registros da aba, inclusive cancelados',
            icone: ShoppingCart,
            tom: 'neutro',
          },
          {
            rotulo: 'Valor dos pedidos',
            // Zero com pedidos lançados é fato; sem nenhum pedido não há
            // total apurado — e R$ 0,00 ali afirmaria execução parada num
            // contrato que talvez só não tenha sido lançado ainda.
            valor: pedidos.length > 0 ? fmt(totalPedidos) : null,
            razaoIndisponivel: 'Nenhum pedido lançado',
            detalhe: 'soma dos pedidos com situação diferente de cancelado',
            icone: DollarSign,
            tom: 'ok',
          },
          {
            // "13 empenhos" sem soma não dizia quanto o órgão já reservou
            // (28/09): agora o valor empenhado (vigente, sem os cancelados),
            // a cobertura do global e o que falta empenhar.
            rotulo: 'Valor empenhado',
            valor: empenhosDoContrato.length > 0 ? fmt(resumoDosEmpenhos(empenhosDoContrato, contratoInfo?.valor_global).empenhado) : null,
            razaoIndisponivel: carregandoEmpenhos ? 'Carregando empenhos…' : 'Nenhum empenho registrado',
            detalhe: empenhosDoContrato.length > 0
              ? detalheDosEmpenhos(resumoDosEmpenhos(empenhosDoContrato, contratoInfo?.valor_global))
              : carregandoEmpenhos ? 'somando os empenhos vigentes' : 'o empenho autoriza as entregas — registre pela nota',
            icone: FileText,
            tom: empenhosDoContrato.some(e => e.cancelado) || resumoDosEmpenhos(empenhosDoContrato, contratoInfo?.valor_global).excesso > 0 ? 'aviso' : 'neutro',
          },
        ]}
      />

      {/* ── Subabas ──────────────────────────────────────────────────────────
          Pedido e empenho são coisas diferentes — um consome, o outro autoriza
          — e conviviam empilhados na mesma rolagem. Separados, cada assunto
          tem a tela inteira, e a subaba mostra de cara quantos há de cada. */}
      <AbasGestao
        abas={[
          { valor: 'pedidos', rotulo: 'Pedidos / Ordens', contagem: pedidos.length },
          { valor: 'empenhos', rotulo: 'Empenhos', contagem: carregandoEmpenhos && empenhosDoContrato.length === 0 ? undefined : empenhosDoContrato.length },
        ]}
        valor={subAba}
        aoMudar={(v) => setSubAba(v as 'pedidos' | 'empenhos')}
      />

      {subAba === 'pedidos' ? (
        <>
          <BarraFiltros
            busca={buscaPedido}
            aoBuscar={setBuscaPedido}
            placeholderBusca="Buscar por nº do pedido, descrição, NF ou empenho..."
            filtrosAplicados={filtrosDePedido}
            aoLimpar={() => { setBuscaPedido(''); setFiltroStatus('__todos__'); }}
            acao={
              <>
                <Button size="sm" variant="outline" className="g-controle" onClick={() => setPreNfDialogOpen(true)} disabled={pedidos.filter(p => p.status !== 'cancelado').length === 0}>
                  <Receipt aria-hidden="true" /> Gerar Pré-NF
                </Button>
                {/* Este SAI da tela: leva ao Kanban comercial. O nome "Novo Pedido"
                    era idêntico ao do botão ao lado, que cria aqui mesmo — e os dois
                    fazem coisas diferentes. */}
                <Button size="sm" variant="outline" className="g-controle"
                  title="Abrir Gestão de Compras para criar o pedido pelo funil comercial"
                  onClick={() => navigate(`/gestao-compras?novo_contrato=${contratoId}`)}>
                  <ShoppingCart aria-hidden="true" /> Criar no Kanban
                </Button>
                {/* Não é tela legada: é a ÚNICA forma de cadastrar pedido direto
                    no contrato — o botão ao lado navega para Gestão de Compras e
                    cria pelo Kanban. Quem lança pedido retroativo, de contrato que
                    já estava em andamento antes da adesão ao sistema, passa por
                    aqui. */}
                <Button size="sm" className="g-controle" onClick={openNewDialog}
                  title="Anexar a Ordem de Fornecimento ou Nota de Empenho e registrar o pedido">
                  <Upload aria-hidden="true" /> Registrar Ordem/Empenho
                </Button>
              </>
            }
          >
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="g-controle w-auto min-w-[170px] rounded-[var(--g-raio)]" aria-label="Filtrar por situação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Situação: todas</SelectItem>
                {Object.entries(statusCfg).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </BarraFiltros>

          {suspeitasDeLancamento.length > 0 && (
            <Card className="g-cartao border-warning-line bg-warning-tint p-4">
              <SecaoRecolhivel
                id={`pedidos-auditoria-${contratoId}`}
                classNameTitulo="text-base font-semibold leading-6 text-warning-ink"
                classNameIcone="text-warning-ink"
                icone={<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />}
                titulo={<>Auditoria dos lançamentos — {suspeitasDeLancamento.length} ponto(s) a revisar</>}
              >
                <div className="mt-2 space-y-2">
                  {suspeitasDeLancamento.map((sp, i) => (
                    <div key={i} className="g-meta">
                      <p className="text-foreground">{sp.frase}</p>
                      <p className="text-muted-foreground mt-0.5">{sp.providencia}</p>
                    </div>
                  ))}
                </div>
              </SecaoRecolhivel>
            </Card>
          )}

          {loading ? (
            <Card className="overflow-hidden" role="status" aria-busy="true">
              <span className="sr-only">Carregando pedidos…</span>
              <div className="flex flex-col gap-px bg-border">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="ml-auto h-4 w-20" />
                  </div>
                ))}
              </div>
            </Card>
          ) : pedidos.length === 0 ? (
            <Card>
              <EstadoVazio
                tamanho="compacto"
                icone={<ShoppingCart />}
                titulo={empenhosDoContrato.length > 0
                  ? 'Nenhum pedido registrado ainda — o empenho acima autoriza, e cada entrega lançada aqui consome dele.'
                  : 'Nenhum pedido registrado'}
              />
            </Card>
          ) : (
            <AreaComPainel>
              {pedidosFiltrados.length === 0 ? (
                <Card>
                  <EstadoVazio tamanho="compacto" titulo="Nenhum pedido corresponde aos filtros aplicados." />
                </Card>
              ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap" aria-sort={sortOrder === 'asc' ? 'ascending' : sortOrder === 'desc' ? 'descending' : undefined}>
                        <button
                          type="button"
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                          className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Pedido
                          {sortOrder === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : sortOrder === 'desc' ? <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 opacity-50" />}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Item</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Quantidade</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Prazo</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Situação</TableHead>
                      <TableHead className="min-w-[12rem] whitespace-nowrap">NF-e</TableHead>
                      {podeVerCustos && (
                        <TableHead className="min-w-[8.5rem] whitespace-nowrap text-right"
                          title="Custo de compra declarado no pedido e a situação do cruzamento com as contas a pagar atribuídas a ele.">
                          Custo
                        </TableHead>
                      )}
                      {/* Só em tela larga (22/09): abaixo de 1536 px a tabela não
                          cabia e a coluna fixa de Ações cobria "Custo". A etapa
                          vive no painel do pedido e no Kanban de Compras. */}
                      <TableHead className="hidden 2xl:table-cell whitespace-nowrap text-center"
                        title="Em que etapa o pedido está no quadro de operação: aguardando faturamento, separar estoque, faturar, faturado, em entrega. Só os pedidos criados pelo Kanban têm esta etapa.">
                        Etapa operacional
                      </TableHead>
                      {/* Fixa à direita. As colunas cresceram quando a fonte subiu
                          para 14px e empurraram as ações para fora da area visivel —
                          e o macOS esconde a barra de rolagem, entao os botoes
                          simplesmente sumiam. Acao de linha nao pode depender de
                          alguem descobrir que a tabela rola. */}
                      <TableHead className="sticky right-0 z-10 w-px border-l border-border bg-secondary">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const sorted = sortOrder
                        ? [...pedidosFiltrados].sort((a, b) => {
                            const cmp = a.numero_pedido.localeCompare(b.numero_pedido, 'pt-BR', { numeric: true });
                            return sortOrder === 'asc' ? cmp : -cmp;
                          })
                        : pedidosFiltrados;
                      // Uma nota rateada em N itens é UMA linha (29/09): as partes
                      // moram no painel do lote. Pedido solto segue como sempre.
                      const linhas = agruparEmLotes(sorted);
                      return linhas.map(linha => {
                      if (linha.tipo === 'lote') {
                        const lote = linha.lote;
                        const cfgLote = statusCfg[lote.status] || statusCfg.pendente;
                        const selecionadoLote = loteSelecionado === lote.id;
                        return (
                          <TableRow key={`lote-${lote.id}`} data-state={selecionadoLote ? 'selected' : undefined} className={selecionadoLote ? 'border-l-2 border-l-primary' : undefined} data-testid={`linha-lote-${lote.id}`}>
                            <TableCell className="whitespace-nowrap font-medium tabular-nums">
                              <button type="button" className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setPedidoSelecionado(null); setLoteSelecionado(lote.id); }} aria-expanded={selecionadoLote} title="Abrir o lote: as partes, item a item">
                                {lote.numero}
                              </button>
                              <div className="g-meta text-muted-foreground">lote · {lote.partes.length} partes{lote.numero_empenho ? ` · emp. ${lote.numero_empenho}` : ''}</div>
                            </TableCell>
                            <TableCell className="min-w-[12rem] max-w-[17rem]">
                              {/* Texto, não link: o número e "Abrir lote" já abrem a caixa (30/09). */}
                              <span className="line-clamp-2 block leading-snug">{rotuloDoLote(lote)}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              <div>{lote.partes.length} itens</div>
                              <div className="g-meta font-medium text-muted-foreground">{fmt(lote.valor_total)}</div>
                            </TableCell>
                            <TableCell className="min-w-[8rem] max-w-[10rem] text-center">
                              <div className="whitespace-nowrap">{lote.data_pedido ? new Date(lote.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
                              <AvisoDePrazoDeEntrega resumido contrato={prazos} dataDoPedido={lote.data_pedido} dataDeEntrega={lote.status === 'entregue' ? (lote.partes[0]?.data_entrega ?? null) : null} />
                            </TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              <SeloSituacao tom={tomDoStatus(lote.status)}>{cfgLote.label}</SeloSituacao>
                              {lote.progresso && <div className="g-meta text-muted-foreground">{lote.progresso}</div>}
                            </TableCell>
                            <TableCell className="min-w-[12rem]">
                              {lote.nota_fiscal ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium">
                                    <FileText aria-hidden="true" className="mr-1 inline h-3 w-3" />{formatarNumeroNfe(lote.nota_fiscal) ?? lote.nota_fiscal}
                                  </span>
                                  {notaDoLote(lote) ?? <div className="g-meta text-muted-foreground">sem arquivo — anexe o XML ou o DANFE pela Extração de Documentos</div>}
                                  <div className="g-meta text-muted-foreground">rateada em {lote.partes.length} partes</div>
                                </div>
                              ) : <span className="g-meta text-muted-foreground">sem nota</span>}
                            </TableCell>
                            {podeVerCustos && (
                              <TableCell className="whitespace-nowrap text-right tabular-nums">
                                {lote.custo_total != null ? <div className="font-medium">{fmt(lote.custo_total)}</div> : <span className="g-meta text-muted-foreground">Sem custo</span>}
                              </TableCell>
                            )}
                            <TableCell className="hidden 2xl:table-cell text-center"><span className="g-meta text-muted-foreground">por parte</span></TableCell>
                            <TableCell className="sticky right-0 z-10 whitespace-nowrap border-l border-border bg-card">
                              <Button size="sm" variant="outline" onClick={() => { setPedidoSelecionado(null); setLoteSelecionado(lote.id); }}>Abrir lote</Button>
                            </TableCell>
                          </TableRow>
                        );
                      }
                      const p = linha.pedido;
                      const cfg = statusCfg[p.status] || statusCfg.pendente;
                      const linkedNfs = nfsSync.filter(nf => nf.contrato_pedido_id === p.id);
                      const selecionado = pedidoSelecionado === p.id;
                      return (
                        <TableRow
                          key={p.id}
                          data-state={selecionado ? 'selected' : undefined}
                          className={selecionado ? 'border-l-2 border-l-primary' : undefined}
                        >
                          <TableCell className="whitespace-nowrap font-medium tabular-nums">
                            {/* O número abre o PEDIDO (21/09): o painel com empenho de
                                origem, ordem, notas e ações — em toda linha, quitada ou
                                não. Antes a linha quitada não tinha clique nenhum, e a
                                outra abria só o PDF, que muitas vezes está no empenho e
                                não no pedido; o painel mostra os dois caminhos. */}
                            <button
                              type="button"
                              className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => setPedidoSelecionado(p.id)}
                              aria-expanded={selecionado}
                              title="Abrir o pedido: empenho de origem, ordem, notas e ações"
                            >
                              {p.numero_pedido}
                            </button>
                            {p.numero_empenho && (
                              <div className="g-meta text-muted-foreground" title="Empenho que autoriza este pedido">
                                emp. {p.numero_empenho}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[12rem] max-w-[17rem]">
                            {/* ── Quebrar em duas linhas, não cortar na primeira ────
                                Em 200px cabia "FORN. NFE N° 000.00…" — o corte caía
                                exatamente no número, que é a parte que identifica o
                                pedido. Duas linhas mostram a descrição inteira na
                                maioria dos casos; o clique continua abrindo o texto
                                completo, agora no painel ao lado. */}
                            {p.descricao ? (
                              <button
                                type="button"
                                className="line-clamp-2 block w-full rounded text-left leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Abrir o detalhe do pedido no painel"
                                onClick={() => setPedidoSelecionado(p.id)}
                              >
                                {p.descricao}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Abrir o detalhe do pedido no painel"
                                onClick={() => setPedidoSelecionado(p.id)}
                              >
                                sem descrição
                              </button>
                            )}
                          </TableCell>
                          {/* Quantidade e valor no mesmo bloco: são duas leituras do
                              mesmo fato, e separá-las custava uma coluna que empurrava
                              as ações para fora da tela. */}
                          <TableCell className="whitespace-nowrap text-right tabular-nums">
                            <div>{p.quantidade == null ? '—' : Number(p.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
                            <div className="g-meta font-medium text-muted-foreground">{fmt(p.valor_total)}</div>
                          </TableCell>
                          {/* Sem `whitespace-nowrap` na célula inteira: o aviso de
                              prazo — "Prazo vencido há 113 dia(s) — limite era
                              10/05/2026" — travava a coluna nessa largura e empurrava
                              a NF-e para baixo da coluna fixa de ações. A DATA
                              continua numa linha só; o aviso quebra. */}
                          <TableCell className="min-w-[8rem] max-w-[10rem] text-center">
                            <div className="whitespace-nowrap">{p.data_pedido ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
                            {/* O prazo que começou a correr quando este pedido foi
                                lançado. `dataDeEntrega` só é passada quando o STATUS
                                diz que houve entrega: `data_entrega` guarda a data
                                PREVISTA, e tratá-la como realizada fazia a linha
                                afirmar "Entregue com 286 dias de atraso" para um
                                pedido que nunca saiu. */}
                            <AvisoDePrazoDeEntrega
                              resumido
                              contrato={prazos}
                              dataDoPedido={p.data_pedido}
                              dataDeEntrega={p.status === 'entregue' ? p.data_entrega : null}
                            />
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <SeloSituacao tom={tomDoStatus(p.status)}>{cfg.label}</SeloSituacao>
                          </TableCell>
                          <TableCell className="min-w-[12rem]">
                            <div className="space-y-1">
                              {/* ── A coluna da NOTA: número, estado e o documento ──
                                  Aqui é onde a nota vive. O número identifica; a
                                  quitação é estado DELA, não do pedido — e estava na
                                  coluna de ações, sem cabeçalho, parecendo um botão.
                                  Clicável só quando há arquivo: número sem link diz
                                  qual nota é e que falta anexá-la, que é mais do que
                                  um traço diz.

                                  O vínculo (pedido → lançamento → documento) vem
                                  antes do casamento por texto: ele acha a nota mesmo
                                  quando `nota_fiscal` do pedido ficou vazio. */}
                              {notaDoPedido?.[p.id] && (() => {
                                const nd = notaDoPedido[p.id];
                                const rotulo = (
                                  <>
                                    <FileText aria-hidden="true" className="mr-1 inline h-3 w-3" />
                                    {formatarNumeroNfe(nd.numero) ?? nd.numero ?? 'sem número'}
                                  </>
                                );
                                // A quitação em linha própria (08/09): dentro do selo,
                                // número e estado disputavam a mesma linha e a leitura
                                // vinha espremida.
                                const quitada = p.nf_quitada && p.data_quitacao && (
                                  <p className="g-meta whitespace-nowrap text-success-ink">
                                    Quitada {new Date(p.data_quitacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </p>
                                );
                                // Nota que entrou pelo XML (30/09): o espelho da NF-e, lido do
                                // XML, abre aqui; o DANFE em PDF, quando anexado ao mesmo
                                // título, é o arquivo que abre no selo.
                                const espelho = nd.arquivo_xml ? (
                                  <span className="flex flex-wrap items-center gap-2">
                                    {!nd.tem_pdf && (
                                      <button type="button" className="g-meta text-primary underline-offset-2 hover:underline disabled:opacity-60" disabled={gerandoDanfe === nd.lancamento_id}
                                        title="Gera o DANFE (PDF) a partir do XML autorizado e guarda junto do título" onClick={() => void gerarDanfeDaNota(nd)}>
                                        Gerar DANFE
                                      </button>
                                    )}
                                    <button type="button" className="g-meta text-muted-foreground underline-offset-2 hover:underline"
                                      title="Abre a leitura do XML da nota em nova aba"
                                      onClick={() => {
                                        try {
                                          if (!abrirEspelho(parseNFeXML(nd.arquivo_xml!))) toast.error('O navegador bloqueou a janela do espelho da nota.');
                                        } catch {
                                          toast.error('Não foi possível ler o XML desta nota.');
                                        }
                                      }}>
                                      Espelho
                                    </button>
                                  </span>
                                ) : null;
                                if (!nd.storage_path) {
                                  return (
                                    <>
                                      <Badge variant="outline" className="g-meta block w-fit whitespace-nowrap text-foreground"
                                        title="A nota está lançada no Financeiro, mas sem arquivo anexado.">
                                        {rotulo}
                                        <span className="ml-1 text-muted-foreground font-normal">• sem arquivo</span>
                                      </Badge>
                                      {espelho}
                                      {quitada}
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <button type="button" className="block w-fit"
                                      onClick={() => abrirDocumentoDoFinanceiro(nd.storage_path!, nd.arquivo_nome ?? 'Nota fiscal')}
                                      title={`Abrir ${nd.arquivo_nome} em nova aba`}>
                                      <Badge variant="outline"
                                        className="g-meta whitespace-nowrap text-foreground border-primary/40 hover:bg-primary-tint cursor-pointer transition-colors">
                                        {rotulo}
                                        <ExternalLink aria-hidden="true" className="ml-1 inline h-3 w-3 text-primary" />
                                      </Badge>
                                    </button>
                                    {espelho}
                                    {quitada}
                                  </>
                                );
                              })()}
                              {!notaDoPedido?.[p.id] && p.nota_fiscal && (() => {
                                // O número da nota é o elo entre o pedido e o
                                // documento arquivado no Financeiro: o pedido não
                                // guarda lancamento_id. Havendo arquivo, o selo vira
                                // botão e abre o DANFE — ver o pedido e não alcançar
                                // a nota que o comprova é o passo que faltava.
                                const doc = chaveDoNumero(p.nota_fiscal)
                                  .map((k) => docsPorNumero?.[k]).find(Boolean);
                                const conteudo = (
                                  <>
                                    <FileText aria-hidden="true" className="mr-1 inline h-3 w-3" />
                                    {/* Formato do DANFE. O campo é texto livre e
                                        recebe "125", "NF 000000125" e "125/2026" —
                                        três grafias da mesma nota, que sem
                                        normalizar viram três linhas diferentes. */}
                                    {formatarNumeroNfe(p.nota_fiscal) ?? p.nota_fiscal}
                                  </>
                                );
                                const quitada = p.nf_quitada && p.data_quitacao && (
                                  <p className="g-meta whitespace-nowrap text-success-ink">
                                    Quitada {new Date(p.data_quitacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </p>
                                );
                                if (!doc) {
                                  // Número sem arquivo é indistinguível de link
                                  // quebrado: o selo fica igual, só não clica. Dizer
                                  // qual dos dois é — e onde se resolve — evita a
                                  // conclusão de que o sistema perdeu a nota.
                                  //
                                  // Pedido quitado SEM título próprio foi pago por
                                  // rateio (uma TED para várias notas): não há linha
                                  // dele em A Receber para o clipe. A DANFE entra pela
                                  // Extração, como PARTE do recebimento que a pagou
                                  // (22/09), e aparece aqui pelo número.
                                  const porRateio = !!p.nf_quitada;
                                  return (
                                    <>
                                      <Badge variant="outline" className="g-meta block w-fit whitespace-nowrap text-foreground"
                                        title={porRateio
                                          ? 'A nota foi recebida por rateio (um recebimento pagou várias notas) e não tem arquivo guardado. Anexe a DANFE em Financeiro › Contas a Receber › Extração de documentos: ela entra como parte do recebimento e aparece aqui.'
                                          : 'A nota não tem arquivo guardado. Anexe pelo clipe na linha do lançamento, em Financeiro › A Receber, ou pela Extração de documentos.'}>
                                        {conteudo}
                                        <span className="ml-1 text-muted-foreground font-normal">• sem arquivo</span>
                                      </Badge>
                                      {((p.nf_quitada && p.data_quitacao) || porRateio) && (
                                        <p className="g-meta">
                                          {p.nf_quitada && p.data_quitacao && (
                                            <span className="whitespace-nowrap text-success-ink">Quitada {new Date(p.data_quitacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                          )}
                                          {porRateio && (
                                            <>
                                              {p.nf_quitada && p.data_quitacao ? ' · ' : ''}
                                              <Link to="/financeiro/a_receber" className="whitespace-nowrap text-primary hover:underline">anexar pela Extração</Link>
                                            </>
                                          )}
                                        </p>
                                      )}
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => abrirDocumentoDoFinanceiro(doc.storage_path, doc.arquivo_nome)}
                                      title={`Abrir ${doc.arquivo_nome} em nova aba`}
                                      className="block w-fit"
                                    >
                                      <Badge variant="outline"
                                        className="g-meta whitespace-nowrap text-foreground border-primary/40 hover:bg-primary-tint cursor-pointer transition-colors">
                                        {conteudo}
                                        <ExternalLink aria-hidden="true" className="ml-1 inline h-3 w-3 text-primary" />
                                      </Badge>
                                    </button>
                                    {quitada}
                                  </>
                                );
                              })()}
                              {linkedNfs.map(nf => {
                                // Dois donos do mesmo número: `contrato_pedidos.nota_fiscal`
                                // é digitado, `notas_fiscais.numero_nf` é o documento
                                // emitido. Quando divergem, a tela precisa dizer —
                                // senão fica igual ao saldo com duas fórmulas: dois
                                // números convivendo e ninguém sabendo qual vale.
                                const diverge =
                                  !!p.nota_fiscal && !!nf.numero_nf &&
                                  numeroNfeComoInteiro(p.nota_fiscal) !== null &&
                                  numeroNfeComoInteiro(p.nota_fiscal) !== numeroNfeComoInteiro(nf.numero_nf);
                                return (
                                  <Badge key={nf.id} variant="outline" className={`g-meta block w-fit ${
                                    diverge ? 'border-warning-line text-warning-ink' :
                                    nf.status === 'autorizada' ? 'border-success-line text-success-ink' :
                                    nf.status === 'rejeitada' ? 'border-destructive-line text-destructive-ink' :
                                    'border-border text-muted-foreground'
                                  }`}
                                  title={diverge
                                    ? `A nota emitida (${formatarNumeroNfe(nf.numero_nf)}) não é a mesma que foi digitada no pedido (${formatarNumeroNfe(p.nota_fiscal)}).`
                                    : undefined}>
                                    <FileText aria-hidden="true" className="mr-1 inline h-3 w-3" />
                                    {formatarNumeroNfe(nf.numero_nf) ?? 'Rascunho'} • {nf.tipo === 'saida' ? 'Saída' : 'Entrada'} {nf.valor_total ? `• ${fmt(nf.valor_total)}` : ''}
                                    {diverge && ' • diverge do pedido'}
                                  </Badge>
                                );
                              })}
                              {!notaDoPedido?.[p.id] && !p.nota_fiscal && linkedNfs.length === 0 && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          {podeVerCustos && (
                            <TableCell className="min-w-[8.5rem] whitespace-nowrap text-right tabular-nums">
                              {(() => {
                                const cx = custosPedidos[p.id];
                                const c = { declarado: Number(p.custo_total) || 0, pago: Number(cx?.comprovado_pago) || 0, aberto: Number(cx?.comprovado_aberto) || 0 };
                                const s = cx?.situacao ?? situacaoDoCusto(c);
                                return (
                                  <div className="flex flex-col items-end gap-1 whitespace-nowrap" title={fraseDaCobertura(c, s)}>
                                    {c.declarado > 0 && <div>{fmt(c.declarado)}</div>}
                                    <SeloSituacao tom={ROTULO_SITUACAO[s].tom}>{ROTULO_SITUACAO[s].rotulo}</SeloSituacao>
                                  </div>
                                );
                              })()}
                            </TableCell>
                          )}
                          <TableCell className="hidden 2xl:table-cell text-center whitespace-nowrap">
                            {p.pedido_id ? (
                              updatingKanban[p.pedido_id] ? (
                                <Loader2 aria-hidden="true" className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Select
                                  value={kanbanStatuses[p.pedido_id] ?? 'pedido'}
                                  onValueChange={(val) => updateKanbanStatus(p.pedido_id!, val)}
                                >
                                  <SelectTrigger className={`h-7 g-meta border px-2 py-0 w-fit mx-auto ${kanbanCfg[kanbanStatuses[p.pedido_id] ?? 'pedido']?.color ?? 'bg-muted text-muted-foreground'}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(kanbanCfg).map(([key, cfgK]) => (
                                      <SelectItem key={key} value={key} className="g-meta">{cfgK.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )
                            ) : (
                              /* A etapa vive no pedido do Kanban de Compras (`pedidos.status`);
                                 pedido lançado direto no contrato não tem uma. Um traço
                                 mudo parecia coluna "oculta" (21/09) — agora diz o porquê. */
                              <span
                                className="g-meta text-foreground-tertiary"
                                title="Sem pedido no Kanban de Compras: a etapa operacional acompanha o pedido criado por lá (Criar no Kanban). Este foi lançado direto no contrato."
                              >
                                sem etapa
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 whitespace-nowrap border-l border-border bg-card">
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              {/* Kit vale antes e depois da quitação: o órgão pede a
                                  segunda via, e a fila do financeiro só mostra o que
                                  ainda não foi baixado. */}
                              <KitFaturamento
                                pedido={{
                                  id: p.id,
                                  numero_pedido: p.numero_pedido,
                                  valor_total: p.valor_total,
                                  nota_fiscal: p.nota_fiscal,
                                  contrato_id: contratoId,
                                }}
                              />
                              {/* Só a AÇÃO fica aqui. O ESTADO "quitada" mudou para a
                                  coluna NF-e, junto da nota a que ele se refere. */}
                              {/* Ícone na linha (22/09): com o texto, a coluna de ações
                                  passava da tela e cobria "Custo". O botão com texto
                                  continua no painel do pedido. */}
                              {!p.nf_quitada && p.status === 'entregue' && (isFinanceiro || isAdmin) && (
                                <Button
                                  size="icon-sm" variant="outline"
                                  className="border-success-line text-success-ink hover:bg-success-tint hover:text-success-ink"
                                  onClick={() => openNfDialog(p)}
                                  title="Quitar NF — registrar o pagamento da NF-e e gerar a bonificação"
                                  aria-label="Quitar NF"
                                >
                                  <DollarSign aria-hidden="true" />
                                </Button>
                              )}
                              {(isFinanceiro || isAdmin) && (
                                /* Pedido retroativo — cadastrado depois de o
                                   recebimento já estar no Financeiro. Vincular em vez
                                   de gerar evita contar a receita duas vezes. */
                                <Button
                                  size="icon-sm" variant="ghost"
                                  title="Vincular a lançamento existente no Financeiro"
                                  aria-label="Vincular a lançamento existente no Financeiro"
                                  onClick={() => setVinculando({
                                    id: p.id,
                                    numero_pedido: p.numero_pedido,
                                    valor_total: Number(p.valor_total) || 0,
                                    data_pedido: p.data_pedido,
                                    nota_fiscal: p.nota_fiscal ?? null,
                                  })}
                                >
                                  <Link2 aria-hidden="true" className="text-muted-foreground" />
                                </Button>
                              )}
                              {/* Todo membro exclui — o precedente das publicações
                                  (02/09): a exclusão EXIGE motivo e grava snapshot em
                                  pedidos_exclusoes para o Admin; o RLS é por membro
                                  desde 22/06. Esconder do colaborador só o obrigava a
                                  pedir a um admin o que a auditoria já cobre. */}
                              {!p.nf_quitada && (
                                <Button
                                  size="icon-sm" variant="ghost-destructive"
                                  title="Excluir pedido (motivo obrigatório — fica no histórico do Admin)"
                                  aria-label="Excluir pedido"
                                  onClick={() => openDeleteDialog(p.id, p.numero_pedido)}
                                >
                                  <Trash2 aria-hidden="true" />
                                </Button>
                              )}
                              {p.nf_quitada && (isFinanceiro || isAdmin) && (
                                <Button
                                  size="icon-sm" variant="ghost" onClick={() => void openDesfazerDialog(p)}
                                  title="Desfazer quitação (com motivo — fica no histórico do Admin)"
                                  aria-label="Desfazer quitação"
                                >
                                  <Undo2 aria-hidden="true" className="text-muted-foreground" />
                                </Button>
                              )}
                              {/* O lápis existe em TODA linha (21/09): pedido com NF
                                  quitada também se corrige — descrição, datas,
                                  empenho, observações. O que a quitação e a
                                  bonificação usaram (quantidade, valores, item,
                                  situação, NF) fica travado dentro do diálogo. */}
                              {(isFinanceiro || isAdmin) && (
                                <Button
                                  size="icon-sm" variant="ghost" onClick={() => openEditDialog(p)}
                                  title={p.nf_quitada ? 'Editar pedido (NF quitada: quantidade, valores e NF ficam travados)' : 'Editar pedido'}
                                  aria-label="Editar pedido"
                                >
                                  <Pencil aria-hidden="true" className="text-muted-foreground" />
                                </Button>
                              )}
                              {!(isFinanceiro || isAdmin) && (
                                <Button size="icon-sm" variant="ghost" onClick={() => openEditDialog(p)} title="Ver detalhes" aria-label="Ver detalhes">
                                  <Pencil aria-hidden="true" className="text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                    })()}
                  </TableBody>
                </Table>
              </div>
              )}
            </AreaComPainel>
          )}

          {/* ── Os empenhos, como contexto da tabela ──────────────────────────
              Faltava esta lista, e a falta tinha consequência: o 2026NE003716
              estava registrado, a aba mostrava "0 pedidos | R$ 0,00", e a única
              leitura possível era a de que nada havia sido registrado. Daí a
              segunda tentativa de cadastrar o mesmo empenho.

              Nasce RECOLHIDA agora que os empenhos ganharam subaba própria: o
              título já informa quantos há, que era o dado que faltava, e quem
              quiser o saldo de cada um abre — ou vai para a subaba. A escolha
              fica lembrada por quem a fez. */}
          {empenhosDoContrato.length > 0 && (
            <Card className="g-cartao p-4">
              <SecaoRecolhivel
                id={`pedidos-empenhos-${contratoId}`}
                recolhidaPorPadrao
                classNameTitulo="text-base font-semibold leading-6 text-foreground"
                icone={<FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                titulo={carregandoEmpenhos && empenhosDoContrato.length === 0
                  ? <>Empenhos registrados — carregando…</>
                  : <>Empenhos registrados ({empenhosDoContrato.length}) — {fmt(resumoDosEmpenhos(empenhosDoContrato, contratoInfo?.valor_global).empenhado)} empenhados, autorizam os pedidos acima</>}
              >
                <div className="mt-2">{listaDeEmpenhos}</div>
              </SecaoRecolhivel>
            </Card>
          )}

          {nfsSync.length > 0 && (
            <Card className="g-cartao p-4">
              <SecaoRecolhivel
                id={`pedidos-nfs-sync-${contratoId}`}
                recolhidaPorPadrao
                classNameTitulo="text-base font-semibold leading-6 text-foreground"
                icone={<FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                titulo={<>Notas fiscais sincronizadas do Financeiro ({nfsSync.length})</>}
              >
                <div className="mt-3">
                  <div className="grade-kpi mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-md bg-secondary p-3">
                      <p className="g-meta text-muted-foreground">NFs Saída</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">{nfsSync.filter(n => n.tipo === 'saida').length}</p>
                      <p className="g-meta text-muted-foreground">{fmt(nfsSync.filter(n => n.tipo === 'saida').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
                    </div>
                    <div className="rounded-md bg-secondary p-3">
                      <p className="g-meta text-muted-foreground">NFs Entrada</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">{nfsSync.filter(n => n.tipo === 'entrada').length}</p>
                      <p className="g-meta text-muted-foreground">{fmt(nfsSync.filter(n => n.tipo === 'entrada').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
                    </div>
                    <div className="rounded-md bg-secondary p-3">
                      <p className="g-meta text-muted-foreground">Autorizadas</p>
                      <p className="text-lg font-semibold tabular-nums text-success-ink">{nfsSync.filter(n => n.status === 'autorizada').length}</p>
                    </div>
                    <div className="rounded-md bg-secondary p-3">
                      <p className="g-meta text-muted-foreground">Pendentes</p>
                      <p className="text-lg font-semibold tabular-nums text-warning-ink">{nfsSync.filter(n => n.status !== 'autorizada' && n.status !== 'cancelada').length}</p>
                    </div>
                  </div>
                  <p className="g-meta text-muted-foreground italic">
                    As notas fiscais são emitidas e controladas pelo setor Financeiro. Acesse o módulo Financeiro para emitir ou editar NFs.
                  </p>
                </div>
              </SecaoRecolhivel>
            </Card>
          )}

          {preNotas.length > 0 && (
            <Card className="g-cartao p-4">
              <SecaoRecolhivel
                id={`pedidos-pre-notas-${contratoId}`}
                recolhidaPorPadrao
                classNameTitulo="text-base font-semibold leading-6 text-foreground"
                icone={<Receipt className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                titulo={<>Pré-notas fiscais solicitadas ({preNotas.length})</>}
              >
                <div className="mt-3 space-y-2">
                  {preNotas.map((pn: any) => {
                    const statusMap: Record<string, { label: string; tom: 'atencao' | 'neutro' | 'sucesso' | 'critico' }> = {
                      pendente: { label: 'Pendente', tom: 'atencao' },
                      em_revisao: { label: 'Em Revisão', tom: 'neutro' },
                      aprovada: { label: 'Aprovada', tom: 'sucesso' },
                      rejeitada: { label: 'Rejeitada', tom: 'critico' },
                      devolvida: { label: 'Devolvida', tom: 'atencao' },
                    };
                    const st = statusMap[pn.status] || statusMap.pendente;
                    return (
                      <div key={pn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeloSituacao tom={st.tom}>{st.label}</SeloSituacao>
                          <span>{pn.natureza_operacao}</span>
                          <span className="font-medium whitespace-nowrap tabular-nums">{fmt(pn.valor_total)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{new Date(pn.created_at).toLocaleDateString('pt-BR')}</span>
                          {pn.motivo_devolucao && (
                            <Badge variant="outline" className="g-meta text-warning-ink" title={pn.motivo_devolucao}>
                              <AlertTriangle aria-hidden="true" className="mr-1 h-3 w-3" /> Devolvida
                            </Badge>
                          )}
                          {pn.motivo_rejeicao && (
                            <Badge variant="outline" className="g-meta text-destructive-ink" title={pn.motivo_rejeicao}>
                              <XCircle aria-hidden="true" className="mr-1 h-3 w-3" /> Rejeitada
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SecaoRecolhivel>
            </Card>
          )}
        </>
      ) : (
        /* ── Subaba Empenhos ──────────────────────────────────────────────── */
        <div className="flex flex-col gap-3">
          <p className="g-corpo text-muted-foreground">
            Empenho <strong>autoriza</strong>; não consome. O saldo de item e de contrato só é
            abatido quando a entrega é lançada contra ele, na subaba Pedidos / Ordens.
          </p>
          {loading || (carregandoEmpenhos && empenhosDoContrato.length === 0) ? (
            <Card className="overflow-hidden" role="status" aria-busy="true">
              <span className="sr-only">Carregando empenhos…</span>
              <div className="flex flex-col gap-px bg-border">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 bg-card px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            </Card>
          ) : empenhosDoContrato.length === 0 ? (
            <Card>
              <EstadoVazio
                tamanho="compacto"
                icone={<FileText />}
                titulo="Nenhum empenho registrado. Use “Registrar Ordem/Empenho” na subaba Pedidos / Ordens para anexar a nota de empenho."
              />
            </Card>
          ) : (
            <Card className="g-cartao p-4">{listaDeEmpenhos}</Card>
          )}
        </div>
      )}

      {/* ── Registrar Pedido ─────────────────────────────────────────────────
          As duas portas continuam onde estavam: "Importar Documento" lê o PDF e
          "Inclusão Manual" digita. O diálogo passou a ser controlado pelo
          estado, porque o gatilho migrou para a barra de filtros. */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-muted-foreground" /> Registrar Pedido
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="upload">
                <Upload aria-hidden="true" className="h-4 w-4" /> Importar Documento
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Plus aria-hidden="true" className="h-4 w-4" /> Inclusão Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 mt-3">
              <div className="space-y-1.5">
                <Label>Tipo de Documento</Label>
                <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tiposDocumento.map(td => (
                      <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border-2 border-dashed border-input p-6 text-center">
                <Upload aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="g-corpo font-medium">Faça upload do documento PDF</p>
                <p className="g-meta text-muted-foreground mt-1">OF, Nota de Empenho, PRD ou documento similar</p>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <><Loader2 aria-hidden="true" className="animate-spin" /> Processando...</> : <><Upload aria-hidden="true" /> Selecionar PDF</>}
                </Button>
              </div>

              {uploading && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-primary-line bg-primary-tint p-4 text-center">
                  <SeloPraefectusIA />
                  <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
                  <p className="g-meta text-muted-foreground" role="status">{etapaLeitura || 'Extraindo dados com IA…'}{segundosLeitura >= 5 ? ` (${segundosLeitura} s)` : ''}</p>
                </div>
              )}

              <div className="space-y-1 rounded-lg border border-border bg-secondary p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Documentos suportados:</p>
                <p>Ordem de Fornecimento (OF), Nota de Empenho (Global, Ordinário, Estimativo), PRD</p>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-3 mt-3">
              {extractedData && (
                <div className="rounded-lg border border-success-line bg-success-tint p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-success-ink">
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    Dados extraídos — revise e corrija se necessário
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>N.o Documento *</Label>
                  <Input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} placeholder="OF-001, NE-2025/001" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de Documento</Label>
                  <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposDocumento.map(td => (
                        <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data do Pedido</Label>
                  <Input type="date" value={form.data_pedido} onChange={e => setForm(f => ({ ...f, data_pedido: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Entrega (prevista)</Label>
                  <Input type="date" value={form.data_entrega} onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))} />
                  {/* De onde a data veio. Derivado e digitado se parecem na
                      tela, e quem confere precisa saber em qual está apoiado
                      — o mesmo motivo do cartão de procedência do DRE. */}
                  {prazos?.prazo_entrega_dias && form.data_pedido && (
                    <p className="g-meta text-muted-foreground mt-1">
                      {form.data_entrega === limiteDerivado(form.data_pedido)
                        ? `Derivado da cláusula: ${prazos.prazo_entrega_dias} dias ${prazos.prazo_entrega_unidade === 'uteis' ? 'úteis' : 'corridos'} da data do pedido.`
                        : `A cláusula do contrato daria ${limiteDerivado(form.data_pedido)
                            ? new Date(limiteDerivado(form.data_pedido) + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '—'} (${prazos.prazo_entrega_dias} dias ${prazos.prazo_entrega_unidade === 'uteis' ? 'úteis' : 'corridos'}).`}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="entregue">Entregue</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nota Fiscal</Label>
                  <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
                </div>
              </div>

              {/* O que este documento vai fazer, dito ANTES de salvar.
                  Empenhar não é entregar: enquanto a nota criava pedidos, o
                  saldo caía no instante em que o dinheiro era reservado. */}
              {extractedData && documentoCria === 'empenho' && (
                  <div className="space-y-3 rounded-lg border border-border bg-secondary p-4">
                    <p className="g-meta font-semibold text-foreground">
                      Nota de empenho — <b>autoriza</b>, não consome
                    </p>
                    <p className="g-meta text-muted-foreground">
                      Vai ser registrada como empenho do contrato. Nenhum saldo de item ou de
                      contrato é abatido: isso acontece quando as entregas forem lançadas contra
                      ela.
                    </p>
                    <div className="grid gap-4 pt-1 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Número do empenho</Label>
                        <Input
                          value={form.numero_empenho}
                          onChange={e => setForm(f => ({ ...f, numero_empenho: e.target.value }))}
                          placeholder="2026NE003716"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Espécie</Label>
                        <Select value={form.tipo_empenho} onValueChange={v => setForm(f => ({ ...f, tipo_empenho: v }))}>
                          <SelectTrigger><SelectValue placeholder="Escolha a espécie" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ordinario" className="g-meta">{ROTULO_DO_EMPENHO.ordinario}</SelectItem>
                            <SelectItem value="global" className="g-meta">{ROTULO_DO_EMPENHO.global}</SelectItem>
                            <SelectItem value="estimativo" className="g-meta">{ROTULO_DO_EMPENHO.estimativo}</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Lida do documento é fato; escolhida à mão é
                            declaração. O mesmo excesso é irregularidade num
                            ordinário e rotina num estimativo. */}
                        <p className="g-meta text-muted-foreground mt-1">
                          {tipoDeEmpenho(extractedData?.especie_empenho)
                            ? 'Lida do documento.'
                            : 'Não veio rotulada no documento — a escolha fica registrada como manual.'}
                        </p>
                      </div>
                    </div>
                  </div>
              )}

              {/* De qual empenho a entrega sai. Sem isto o pedido não abate
                  nada, e o saldo do empenho fica parado enquanto o material
                  some do estoque. */}
              {documentoCria === 'pedido' && empenhosDoContrato.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Empenho que autoriza este pedido</Label>
                    <Select
                      value={form.empenho_id || '__sem__'}
                      onValueChange={v => setForm(f => ({ ...f, empenho_id: v === '__sem__' ? '' : v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sem__" className="g-meta">Sem empenho registrado</SelectItem>
                        {empenhosDoContrato.map(e => (
                          <SelectItem key={e.id} value={e.id} className="g-meta">
                            {e.numero} — {ROTULO_DO_EMPENHO[e.tipo as 'ordinario'] ?? e.tipo}
                            {/* Continua na lista: há caso legítimo de lançar
                                entrega anterior ao cancelamento. Mas sai
                                marcado, para ninguém escolhê-lo sem ver. */}
                            {e.cancelado
                              ? ' · CANCELADO'
                              : ` · saldo ${e.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
              )}

              {extractedItens.length > 0 ? (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      {documentoCria === 'empenho' ? 'Linhas do empenho' : 'Itens Extraídos'} ({extractedItens.length})
                    </p>
                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                      {extractedItens.map((ei, idx) => (
                        <Card key={ei.key} className="space-y-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="g-meta font-semibold text-muted-foreground">Item {idx + 1}</span>
                            <Button size="icon-sm" variant="ghost-destructive" aria-label={`Remover o item ${idx + 1}`} onClick={() => removeExtractedItem(ei.key)}>
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Descrição</Label>
                            <Input value={ei.descricao} onChange={e => updateExtractedItem(ei.key, 'descricao', e.target.value)} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                              <Label>Item do Contrato</Label>
                              <Select value={ei.contrato_item_id} onValueChange={v => {
                                const item = itens.find(i => i.id === v);
                                updateExtractedItem(ei.key, 'contrato_item_id', v);
                                if (item) updateExtractedItem(ei.key, 'valor_unitario', String(item.valor_unitario));
                              }}>
                                <SelectTrigger><SelectValue placeholder="Vincular item" /></SelectTrigger>
                                {/* Descrição de item de merenda tem 400+ caracteres, e o
                                    Radix COPIA o conteúdo da opção para dentro do gatilho:
                                    o line-clamp-2 (caixa -webkit aninhada) furava o recorte
                                    do trigger e o texto atravessava o formulário (09/09).
                                    Uma linha truncada se comporta igual nos dois lugares;
                                    a descrição completa fica no title e na ficha do item. */}
                                <SelectContent className="max-w-[min(560px,90vw)]">
                                  {itens.map(i => (
                                    <SelectItem key={i.id} value={i.id} className="g-meta">
                                      <span className="block max-w-[500px] truncate" title={i.descricao}>
                                        <span className="text-muted-foreground mr-1">[{rotuloDoItemNoSeletor(i, situacaoDosItens.get(i.id))}]</span>
                                        {i.descricao}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Quantidade</Label>
                              <Input type="number" value={ei.quantidade} onChange={e => updateExtractedItem(ei.key, 'quantidade', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Valor Unit. (R$)</Label>
                              <MoneyInput value={Number(ei.valor_unitario) || 0} onValueChange={v => updateExtractedItem(ei.key, 'valor_unitario', String(v))} />
                            </div>
                          </div>
                          {/* A cota fica no nível da LINHA porque é aí que ela
                              vive: a principal e a reservada são divisões do
                              mesmo item (LC 123/2006, art. 48, III) e esgotam
                              separadas. */}
                          <div className="space-y-1.5">
                            <Label>Cota</Label>
                            <Select
                              value={ei.cota || '__sem__'}
                              onValueChange={v => {
                                updateExtractedItem(ei.key, 'cota', v === '__sem__' ? '' : v);
                                updateExtractedItem(ei.key, 'cota_origem', 'documento');
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__sem__" className="g-meta">Sem divisão de cota</SelectItem>
                                <SelectItem value="principal" className="g-meta">{ROTULO_DA_COTA.principal}</SelectItem>
                                <SelectItem value="reservada" className="g-meta">{ROTULO_DA_COTA.reservada}</SelectItem>
                              </SelectContent>
                            </Select>
                            {/* Deduzida é para conferir; lida é para confiar.
                                Não dizer qual das duas é apresentar palpite
                                com a mesma cara de fato. */}
                            {ei.cota_origem === 'proporcao' && (
                              <p className="g-meta text-warning-ink mt-1">
                                {ROTULO_DA_ORIGEM_DA_COTA.proporcao}
                              </p>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                    <span className="g-meta font-medium">{extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} itens válidos</span>
                    <span className="text-base font-semibold tabular-nums text-foreground">Total: {fmt(totalExtracted)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                  </div>

                  {/* Empenho não gera cobrança: não há entrega para faturar.
                      O título nasce quando a OF for lançada contra ele. */}
                  {documentoCria === 'pedido' && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                      <Checkbox id="ger-cr-batch" checked={gerarContaReceber} onCheckedChange={(v) => setGerarContaReceber(!!v)} />
                      <Label htmlFor="ger-cr-batch" className="cursor-pointer">
                        <DollarSign aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                        Gerar <b>contas a receber</b> (uma por item) no Financeiro vinculadas a este contrato
                      </Label>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveBatch} disabled={saving}>
                      {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
                      {documentoCria === 'empenho'
                        ? `Registrar empenho (${extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} linhas)`
                        : `Registrar ${extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} itens`}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <Separator />
                  {ataSrpId && itensAta.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                      <span className="g-meta shrink-0 text-muted-foreground">Fonte dos valores:</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant={fonteItens === 'contrato' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => { setFonteItens('contrato'); setAtaItemSelecionado(''); setForm(f => ({ ...f, contrato_item_id: '' })); }}
                        >
                          Contrato
                        </Button>
                        <Button
                          type="button"
                          variant={fonteItens === 'ata' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => { setFonteItens('ata'); setOrigemFilter('__todos__'); setAtaItemSelecionado(''); setForm(f => ({ ...f, contrato_item_id: '' })); }}
                        >
                          ATA pai
                        </Button>
                      </div>
                    </div>
                  )}
                  {fonteItens === 'contrato' && (
                    <div className="space-y-1.5">
                      <Label>Situação do item</Label>
                      <Select value={origemFilter} onValueChange={v => { setOrigemFilter(v); setForm(f => ({ ...f, contrato_item_id: '', origem_aditivo_id: '' })); }}>
                        <SelectTrigger><SelectValue placeholder="Filtrar por situação" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FILTRO_TODOS}>Todos os itens ({itens.length})</SelectItem>
                          <SelectItem value={FILTRO_ORIGINAL}>Nunca alterados por termo ({itens.filter(i => !situacaoDosItens.has(i.id)).length})</SelectItem>
                          {termosNoFiltro.map((t) => (
                            <SelectItem key={t.id} value={t.id}>Atualizados pelo {t.rotulo} ({t.itens})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>{fonteItens === 'ata' ? 'Item da ATA (Fonte)' : 'Item do Contrato'}</Label>
                    {fonteItens === 'ata' ? (
                      <Select value={ataItemSelecionado} onValueChange={handleItemChangeAta}>
                        <SelectTrigger><SelectValue placeholder="Selecionar item da ATA" /></SelectTrigger>
                        <SelectContent className="max-w-[min(560px,90vw)]">
                          {itensAta.map(i => (
                            <SelectItem key={i.id} value={i.id}>
                              <span className="block max-w-[500px] truncate" title={i.descricao}>
                                {i.descricao} ({i.unidade}) — {fmt(i.valor_unitario)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={form.contrato_item_id} onValueChange={handleItemChange}>
                        <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                        <SelectContent className="max-w-[min(560px,90vw)]">
                          {itensFiltrados.map(i => (
                            <SelectItem key={i.id} value={i.id}>
                              <span className="block max-w-[500px] truncate" title={i.descricao}>
                                <span className="text-muted-foreground mr-1">[{situacaoDosItens.get(i.id)?.rotuloCurto ?? 'Original'}]</span>
                                {i.descricao} ({i.unidade}) — {fmt(i.valor_unitario)}
                              </span>
                            </SelectItem>
                          ))}
                          {itensFiltrados.length === 0 && (
                            <div className="py-2 text-center g-meta text-muted-foreground">Nenhum item para esta origem</div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    {(() => {
                      // Fase C: a régua do estoque mora ao lado do item.
                      const e = estoqueDoItem(form.contrato_item_id);
                      if (!e) return null;
                      const qtd = parseFloat(form.quantidade) || 0;
                      const falta = qtd > 0 && qtd > e.disponivel;
                      return (
                        <p className={`g-meta mt-1 ${falta ? 'text-warning-ink' : 'text-muted-foreground'}`}>
                          Estoque: {e.fisico.toLocaleString('pt-BR')} físico · {e.reservado.toLocaleString('pt-BR')} reservado ·{' '}
                          <b>{e.disponivel.toLocaleString('pt-BR')} disponível</b>
                          {falta ? ' — quantidade acima do disponível' : ''}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Quantidade</Label>
                      <Input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor Unitário (R$)</Label>
                      <MoneyInput value={Number(form.valor_unitario) || 0} onValueChange={v => setForm(f => ({ ...f, valor_unitario: String(v) }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2">
                    <Checkbox id="ger-cr-single" checked={gerarContaReceber} onCheckedChange={(v) => setGerarContaReceber(!!v)} />
                    <Label htmlFor="ger-cr-single" className="cursor-pointer">
                      <DollarSign aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                      Gerar <b>conta a receber</b> automaticamente no Financeiro vinculada a este contrato
                    </Label>
                  </div>
                  <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveSingle} disabled={saving}>
                      {saving && <Loader2 aria-hidden="true" className="animate-spin" />} Registrar
                    </Button>
                  </DialogFooter>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* NF Quitada — Diálogo do Financeiro */}
      <Dialog open={!!nfDialog} onOpenChange={v => { if (!v) setNfDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign aria-hidden="true" className="h-5 w-5 text-success-ink" />
              Registrar Pagamento de NF-e
            </DialogTitle>
          </DialogHeader>
          {nfDialog && (
            <div className="space-y-4">
              <div className="space-y-1 rounded-lg border border-border bg-secondary p-3 text-xs">
                <p><strong>Pedido:</strong> {nfDialog.numero_pedido}</p>
                <p><strong>Valor do Pedido:</strong> {fmt(nfDialog.valor_total)}</p>
                {nfDialog.descricao && <p><strong>Descrição:</strong> {nfDialog.descricao}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Número da Nota Fiscal *</Label>
                <Input value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="NF-e 000.000.001" />
              </div>

              <div className="space-y-1.5">
                <Label>Data do Pagamento *</Label>
                <Input type="date" value={nfData} onChange={e => setNfData(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Valor Pago (R$) *</Label>
                <MoneyInput
                  value={Number(nfValorPago) || 0}
                  onValueChange={(v) => setNfValorPago(String(v))}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="rounded-lg border border-border bg-secondary p-3">
                <p className="g-meta text-muted-foreground">
                  Ao registrar o pagamento, o sistema calculará automaticamente a bonificação do vendedor
                  responsável pelo contrato com base na configuração de bonificação vigente.
                </p>
              </div>

              <Button
                onClick={handleMarcarNfQuitada}
                disabled={solicitandoComissao || !nfNumero.trim() || !nfData || !(parseFloat(nfValorPago) > 0)}
                className="w-full"
              >
                {solicitandoComissao ? <Loader2 aria-hidden="true" className="animate-spin" /> : <DollarSign aria-hidden="true" />}
                Confirmar Pagamento e Gerar Bonificação
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Audit Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={v => { if (!v && !deleting) { setDeleteDialog(null); setDeleteReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive-ink">
              <Trash2 aria-hidden="true" className="h-5 w-5" /> {deleteDialog?.lote ? 'Excluir lote inteiro' : 'Excluir Pedido'}
            </DialogTitle>
          </DialogHeader>
          {deleteDialog && (
            <div className="space-y-4">
              <div className="space-y-1 rounded-lg border border-destructive-line bg-destructive-tint p-3 text-xs">
                <p className="font-medium text-destructive-ink">Atenção: esta ação não pode ser desfeita.</p>
                <p className="text-muted-foreground">{deleteDialog.lote ? 'Lote' : 'Pedido'}: <strong className="text-foreground">{deleteDialog.numero}</strong>{deleteDialog.lote ? ` — ${deleteDialog.lote.partes.length} partes saem juntas` : ''}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Motivo da exclusão *</Label>
                <Textarea
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="Informe o motivo da exclusão..."
                  rows={3}
                />
              </div>
              <p className="g-meta text-muted-foreground">
                Registrado por: <strong>{user?.email}</strong>
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeleteDialog(null); setDeleteReason(''); }} disabled={deleting}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirmed}
                  disabled={!deleteReason.trim() || deleting}
                >
                  {deleting && <Loader2 aria-hidden="true" className="animate-spin" />}
                  Confirmar Exclusão
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* O pedido aberto numa caixa (30/09): o painel lateral espremia origem,
          valores e ações numa coluna; a caixa usa a tela em duas colunas. */}
      <Dialog open={!!pedidoAberto} onOpenChange={(v) => { if (!v) setPedidoSelecionado(null); }}>
        <DialogContent className="max-w-[min(96vw,80rem)] max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhe do pedido {pedidoAberto?.numero_pedido ?? ''}</DialogTitle>
            <DialogDescription>Origem, item, valores, nota e ações do pedido.</DialogDescription>
          </DialogHeader>
          {painelDoPedido}
        </DialogContent>
      </Dialog>

      {/* Trocar empenho (30/09) */}
      <Dialog open={!!trocaDeEmpenho} onOpenChange={(v) => { if (!v && !trocandoEmpenho) setTrocaDeEmpenho(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Trocar o empenho — {trocaDeEmpenho?.rotulo}</DialogTitle>
            <DialogDescription>
              O empenho autoriza a entrega e é dele que o saldo baixa. A troca vale para {trocaDeEmpenho?.pedidos.length === 1 ? 'este pedido' : `as ${trocaDeEmpenho?.pedidos.length} partes`}; o título no Financeiro não muda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Empenho que autoriza (art. 60)</Label>
            <Select value={novoEmpenhoId} onValueChange={setNovoEmpenhoId}>
              <SelectTrigger><SelectValue placeholder="Escolha o empenho" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem vínculo com empenho</SelectItem>
                {empenhosDoContrato.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.numero} — {ROTULO_DO_EMPENHO[e.tipo as 'ordinario'] ?? e.tipo}{e.cancelado ? ' · CANCELADO' : ` · vigente ${fmt(e.vigente)}`}{e.id === trocaDeEmpenho?.atual ? ' (atual)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrocaDeEmpenho(null)} disabled={trocandoEmpenho}>Cancelar</Button>
            <Button onClick={() => void confirmarTrocaDeEmpenho()} disabled={trocandoEmpenho || !novoEmpenhoId || novoEmpenhoId === (trocaDeEmpenho?.atual ?? 'nenhum')}>
              {trocandoEmpenho && <Loader2 aria-hidden="true" className="animate-spin" />}Trocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerar Pré-NF Dialog */}
      <GerarPreNotaDialog
        open={preNfDialogOpen}
        onOpenChange={setPreNfDialogOpen}
        contratoId={contratoId}
        pedidos={pedidos}
        itens={itens}
        onCreated={load}
      />

      {/* Compras deste pedido (22/09): o custo comprovado, pelo rateio das contas a pagar. */}
      {comprasDialog && (
        <ComprasDoPedidoDialog
          pedido={comprasDialog}
          contratoId={contratoId}
          custo={custosPedidos[comprasDialog.id]}
          aoFechar={() => setComprasDialog(null)}
          aoMudar={load}
        />
      )}

      {/* Edit Pedido Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingPedido(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil aria-hidden="true" className="h-5 w-5 text-muted-foreground" /> Editar Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPedido?.nf_quitada && (
              <div role="status" className="rounded-lg border border-warning-line bg-warning-tint p-3 text-sm text-warning-ink">
                <p className="font-semibold">
                  NF quitada{editingPedido.data_quitacao ? ` em ${new Date(`${editingPedido.data_quitacao}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}: {CAMPOS_TRAVADOS_APOS_QUITACAO} ficam como estão.
                </p>
                <p className="mt-1">
                  A quitação e a bonificação do vendedor foram calculadas sobre esses valores. Os demais campos
                  (documento, descrição, situação, datas, empenho, observações e o custo de compra) podem ser corrigidos e salvos normalmente.
                </p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>N.o Documento</Label>
                <Input value={editForm.numero_pedido} onChange={e => setEditForm(f => ({ ...f, numero_pedido: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusCfg).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            {itens.length > 0 && (
              <div className="space-y-1.5">
                <Label>Item do Contrato</Label>
                <Select value={editForm.contrato_item_id} disabled={!!editingPedido?.nf_quitada} onValueChange={v => {
                  const item = itens.find(i => i.id === v);
                  setEditForm(f => ({ ...f, contrato_item_id: v, valor_unitario: item ? String(item.valor_unitario) : f.valor_unitario }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="max-w-[min(560px,90vw)]">
                    {itens.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        <span className="block max-w-[500px] truncate" title={i.descricao}>
                          <span className="text-muted-foreground mr-1">[{situacaoDosItens.get(i.id)?.rotuloCurto ?? 'Original'}]</span>
                          {i.descricao} ({fmt(i.valor_unitario)}/{i.unidade})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" value={editForm.quantidade} disabled={!!editingPedido?.nf_quitada} onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor Unitário</Label>
                <MoneyInput value={Number(editForm.valor_unitario) || 0} disabled={!!editingPedido?.nf_quitada} onValueChange={v => setEditForm(f => ({ ...f, valor_unitario: String(v) }))} />
              </div>
            </div>

            {/* ── Empenho / Ordem de fornecimento — vínculo e documento ──────
                Pedidos anteriores a 30/08 nasceram antes do vínculo
                empenho_id; aqui a edição resolve os dois lados: escolher o
                empenho já anexado e reenviar o PDF da ordem. */}
            <div className="space-y-3 rounded-lg border border-border bg-secondary p-4">
              <p className="text-sm font-semibold text-foreground">Empenho / Ordem de fornecimento</p>
              <div className="space-y-1.5">
                <Label>Empenho que autoriza (já anexados ao contrato)</Label>
                <Select value={editForm.empenho_id || 'nenhum'} onValueChange={v => setEditForm(f => ({ ...f, empenho_id: v === 'nenhum' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">— Sem vínculo —</SelectItem>
                    {empenhosDoContrato.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.numero}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="g-meta text-muted-foreground mt-1">
                  É deste empenho que a cota consome — e é ele que o kit de faturamento pré-seleciona.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Reenviar o PDF da Ordem/Empenho</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  disabled={reenviandoOrdem}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void reenviarOrdem(f); e.target.value = ''; }}
                />
                <p className="g-meta text-muted-foreground mt-1">
                  {reenviandoOrdem
                    ? 'Enviando…'
                    : 'Atualiza o documento que o dossiê aponta; o anterior permanece no histórico de arquivos.'}
                </p>
              </div>
            </div>

            {/* O total, calculado à vista.
                Pedido vindo do Kanban chega sem `valor_unitario`: o campo abre
                vazio e quem edita preenche com o que conhece — o TOTAL. Salva
                150 × 3.382,50 e o contrato passa a 303% consumido, sem que
                nada tenha avisado. Mostrar a conta antes de salvar é o que
                torna o erro visível no momento em que ele é cometido. */}
            {(() => {
              const q = parseFloat(editForm.quantidade) || 0;
              const u = parseFloat(editForm.valor_unitario) || 0;
              const total = q * u;
              const saldo = saldoDoContrato;
              const anterior = Number(editingPedido?.valor_total) || 0;
              const estoura = saldo > 0 && total - anterior > saldo;
              if (q <= 0 || u <= 0) return null;
              return (
                <div className={`rounded-lg border p-3 text-xs ${estoura ? 'border-destructive-line bg-destructive-tint' : 'border-border bg-secondary'}`}>
                  <p className={estoura ? 'text-destructive-ink font-medium' : 'text-muted-foreground'}>
                    {q} × {fmt(u)} = <strong>{fmt(total)}</strong>
                  </p>
                  {estoura && (
                    <p className="text-destructive-ink mt-1">
                      Isso passa em {fmt(total - anterior - saldo)} o saldo que resta no contrato
                      ({fmt(saldo)}). Confira se o valor digitado é o UNITÁRIO e não o total.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ── Custo de compra DECLARADO (decisão do dono, 22/09) ──────────
                A exceção: Admin ou Financeiro declara o custo dentro do
                pedido; o sistema cruza com as contas a pagar rateadas a ele e
                avisa quem lançou primeiro. Não é trancado pela quitação — é
                custo da compra, não da venda. */}
            {podeVerCustos && (() => {
              const q = parseFloat(editForm.quantidade) || 0;
              const cu = parseFloat(editForm.custo_unitario) || 0;
              const cx = editingPedido ? custosPedidos[editingPedido.id] : undefined;
              const c = { declarado: q * cu, pago: Number(cx?.comprovado_pago) || 0, aberto: Number(cx?.comprovado_aberto) || 0 };
              const s = cx?.situacao ?? situacaoDoCusto(c);
              // "null" chegou como texto num item importado (print de 22/09).
              const unidade = unidadeLegivel(itens.find(i => i.id === editForm.contrato_item_id)?.unidade, 'unidade');
              return (
                <div className="space-y-3 rounded-lg border border-border bg-secondary p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Custo de compra (declarado)</p>
                    <SeloSituacao tom={ROTULO_SITUACAO[s].tom}>{ROTULO_SITUACAO[s].rotulo}</SeloSituacao>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Custo unitário (R$ por {unidade})</Label>
                      <MoneyInput value={cu} onValueChange={v => setEditForm(f => ({ ...f, custo_unitario: v > 0 ? String(v) : '' }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Custo total declarado</Label>
                      <p className="g-corpo font-semibold tabular-nums">{cu > 0 ? fmt(q * cu) : '—'}</p>
                      {cu > 0 && <p className="g-meta text-muted-foreground">{q.toLocaleString('pt-BR')} × {fmt(cu)}</p>}
                    </div>
                  </div>
                  <p className="g-meta text-muted-foreground">
                    {cx || cu > 0 ? fraseDaCobertura(c, s) : 'Declarado é gerencial: não entra na DRE nem no estoque. Fica como declarado até a nota de entrada ou a conta a pagar atribuída a este pedido o cobrir — e o cruzamento avisa quem lançou primeiro.'}
                  </p>
                </div>
              );
            })()}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data do Pedido</Label>
                <Input type="date" value={editForm.data_pedido} onChange={e => setEditForm(f => ({ ...f, data_pedido: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Entrega</Label>
                <Input type="date" value={editForm.data_entrega} onChange={e => setEditForm(f => ({ ...f, data_entrega: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nota Fiscal</Label>
              <Input value={editForm.nota_fiscal} disabled={!!editingPedido?.nf_quitada} onChange={e => setEditForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? <><Loader2 aria-hidden="true" className="animate-spin" /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Desfazer quitação — o inverso do "Quitar NF", com as guardas da
          função do banco: título pago manda ao Financeiro, bonificação paga
          bloqueia, o resto pede motivo e fica no histórico. */}
      <Dialog open={!!desfazerDialog} onOpenChange={(o) => !o && setDesfazerDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
              Desfazer quitação do pedido {desfazerDialog?.numero_pedido}
            </DialogTitle>
            <DialogDescription>
              Quitada
              {desfazerDialog?.data_quitacao ? ` em ${new Date(`${desfazerDialog.data_quitacao}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}
              {desfazerDialog?.nota_fiscal ? ` · NF ${desfazerDialog.nota_fiscal}` : ''}
              {' · '}{fmt(Number(desfazerDialog?.valor_total) || 0)}
            </DialogDescription>
          </DialogHeader>
          {desfazerInfo === null ? (
            <div role="status" className="space-y-2">
              <span className="sr-only">Conferindo títulos e bonificações…</span>
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : desfazerInfo.titulosPagos > 0 ? (
            <div className="rounded-lg border border-info-line bg-info-tint p-3 text-sm text-info-ink">
              <p className="font-semibold">A quitação veio do Financeiro.</p>
              <p className="mt-1">
                Há {desfazerInfo.titulosPagos} título(s) pago(s) ligado(s) a este pedido: o dinheiro entrou. Para
                desfazer, use "Desfazer conciliação" no recebimento, em Financeiro › Conciliação — o pedido
                acompanha sozinho.
              </p>
            </div>
          ) : desfazerInfo.bonusPagas > 0 ? (
            <div className="rounded-lg border border-destructive-line bg-destructive-tint p-3 text-sm text-destructive-ink">
              <p className="font-semibold">Bonificação já paga.</p>
              <p className="mt-1">
                {desfazerInfo.bonusPagas} bonificação(ões) sobre este pedido já foi(ram) paga(s) ao vendedor.
                Estorne-a(s) em Equipe › Comissões antes de desfazer a quitação.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-warning-line bg-warning-tint p-3 text-sm text-warning-ink">
                <p className="font-semibold">O que vai acontecer</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>O pedido volta a "não quitado", sem data de quitação, e passa a ser editável por inteiro e excluível com motivo.</li>
                  <li>
                    {desfazerInfo.bonusPendentes > 0
                      ? `${desfazerInfo.bonusPendentes} bonificação(ões) pendente(s), no total de ${fmt(desfazerInfo.valorBonusPendente)}, será(ão) apagada(s).`
                      : 'Não há bonificação pendente a apagar.'}
                  </li>
                  <li>Quem desfez, quando, o motivo e a data anterior ficam no histórico do Admin.</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desfazer-quitacao-motivo">Motivo (obrigatório)</Label>
                <Textarea
                  id="desfazer-quitacao-motivo" rows={3} value={desfazerMotivo}
                  onChange={e => setDesfazerMotivo(e.target.value)}
                  placeholder="Ex.: NF quitada no pedido errado; o pagamento é do pedido 004."
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDesfazerDialog(null)}>Cancelar</Button>
            {desfazerInfo !== null && desfazerInfo.titulosPagos === 0 && desfazerInfo.bonusPagas === 0 && (
              <Button variant="destructive" onClick={handleDesfazerQuitacao} disabled={desfazendo || desfazerMotivo.trim().length < 5}>
                {desfazendo ? <><Loader2 aria-hidden="true" className="animate-spin" /> Desfazendo…</> : 'Desfazer quitação'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leitura, não edição: quem clica na descrição quer LER o que foi
          pedido. Abrir o formulário de edição para isso põe campo gravável
          na frente de quem só queria conferir. Hoje a leitura mora no painel
          lateral; este diálogo continua atendendo quem chega pela lista de
          descrições longas. */}
      <Dialog open={!!lendo} onOpenChange={(o) => !o && setLendo(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pedido {lendo?.numero_pedido}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 g-corpo">
            <div>
              <p className="g-meta text-muted-foreground mb-1">Descrição</p>
              <p className="whitespace-pre-wrap">{lendo?.descricao || '—'}</p>
            </div>
            {lendo?.observacoes && (
              <div>
                <p className="g-meta text-muted-foreground mb-1">Observações</p>
                <p className="whitespace-pre-wrap">{lendo.observacoes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Quantidade</span>
                <p className="font-medium">{lendo?.quantidade ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor total</span>
                <p className="font-medium">{lendo ? fmt(Number(lendo.valor_total) || 0) : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data do pedido</span>
                <p className="font-medium">
                  {lendo?.data_pedido ? new Date(lendo.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Nota fiscal</span>
                <p className="font-medium">{lendo?.nota_fiscal || '—'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MovimentosDoEmpenho
        empenho={movimentando}
        onFechar={() => setMovimentando(null)}
        onMudou={() => load()}
      />

      {caixaDoLote}

      <EditarEmpenhoDialog
        empenho={editandoEmpenho}
        contratoId={contratoId}
        empresaId={empresaAtiva?.id}
        itensDoContrato={itens}
        podeApagar={isAdmin}
        onFechar={() => setEditandoEmpenho(null)}
        onMudou={() => load()}
      />

      <VincularLancamentoDialog
        aberto={!!vinculando}
        onFechar={() => setVinculando(null)}
        contratoId={contratoId}
        empresaId={empresaAtiva?.id}
        pedido={vinculando}
        aoVincular={load}
      />

    </div>
  );
}
