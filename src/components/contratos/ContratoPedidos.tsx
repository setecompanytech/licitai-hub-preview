import { useState, useEffect, useRef, useMemo } from 'react';
import { avaliarCabimento } from '@/lib/contratos/cabimento';
import { limiteDeEntrega } from '@/lib/contratos/prazo-de-entrega';
import { normalizarNumeroEmpenho, tipoDeEmpenho, ROTULO_DO_EMPENHO } from '@/lib/contratos/empenho';
import {
  oQueODocumentoCria, especieComOrigem, atribuirCotas,
  ROTULO_DA_COTA, ROTULO_DA_ORIGEM_DA_COTA,
} from '@/lib/contratos/autoriza-ou-consome';
import { formatarNumeroNfe, numeroNfeComoInteiro } from '@/lib/financeiro/chave-nfe';
import { proximoNumeroDePedido } from '@/lib/contratos/numero-do-pedido';
import { ordenarCandidatos, PONTOS_PARA_SUGERIR, type TituloCandidato } from '@/lib/contratos/casar-pedido';
import VincularLancamentoDialog from './VincularLancamentoDialog';
import type { PedidoParaCasar } from '@/lib/contratos/casar-pedido';
import { useSituacaoJuridica } from '@/hooks/useSituacaoJuridica';
import AvisoDePrazoDeEntrega, { type PrazosDoContrato } from './AvisoDePrazoDeEntrega';
import { situacaoDoPrazo } from '@/lib/contratos/prazo-de-entrega';
import { useDocumentoFiscal, useDocumentosPorNumeroNota, chaveDoNumero } from '@/hooks/useDocumentoFiscal';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { avisoDeExecucaoIncompativel } from '@/lib/contratos/instrumentos';
import KitFaturamento from '@/components/financeiro/KitFaturamento';
import {
  Plus, Trash2, Loader2, ShoppingCart, CheckCircle2, Clock, XCircle,
  Upload, FileText, AlertTriangle, DollarSign, Receipt, Pencil, ArrowUpDown, ArrowUp, ArrowDown,
  ExternalLink, Link2, Eye,
} from 'lucide-react';
import GerarPreNotaDialog from './GerarPreNotaDialog';
import { useMembroPermissoes } from '@/hooks/useMembroPermissoes';
import { MoneyInput } from '@/components/ui/money-input';

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

type ContratoItem = { id: string; codigo_item: string | null; descricao: string; unidade: string; valor_unitario: number; origem_aditivo_id: string | null };
type AditivoRef = { id: string; numero_aditivo: string; tipo: string };

const getOrigemLabel = (item: ContratoItem, aditivos: AditivoRef[]): string => {
  if (!item.origem_aditivo_id) return '📄 Contrato Original';
  const ad = aditivos.find(a => a.id === item.origem_aditivo_id);
  return ad ? `📎 ${ad.numero_aditivo}` : '📎 Aditivo';
};

/** Chave de agrupamento para identificar o mesmo item físico entre versões */
function itemGroupKey(item: ContratoItem): string {
  return item.codigo_item?.toLowerCase().trim()
    || item.descricao.toLowerCase().trim();
}
type Pedido = {
  id: string; numero_pedido: string; descricao: string | null;
  contrato_item_id: string | null; quantidade: number; valor_unitario: number;
  valor_total: number; data_pedido: string | null; data_entrega: string | null;
  status: string; nota_fiscal: string | null; observacoes: string | null;
  nf_quitada: boolean; data_quitacao: string | null;
  pedido_id?: string | null;
};
type NotaFiscalSync = {
  id: string; numero_nf: string | null; tipo: string; status: string | null;
  valor_total: number | null; data_emissao: string | null; chave_acesso: string | null;
  contrato_pedido_id: string | null; natureza_operacao: string | null;
  destinatario_razao_social: string | null;
};

const statusCfg: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
  entregue: { label: 'Entregue', color: 'bg-success/10 text-success' },
  parcial: { label: 'Parcial', color: 'bg-info/10 text-info' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
};

const kanbanCfg: Record<string, { label: string; color: string }> = {
  pedido:          { label: 'Aguard. Faturamento', color: 'bg-muted text-muted-foreground border-border' },
  separar_estoque: { label: 'Separar Estoque',     color: 'bg-warning/10 text-warning border-warning/20' },
  faturar:         { label: 'Faturar',             color: 'bg-warning/10 text-warning border-warning/20' },
  faturado:        { label: 'Faturado',            color: 'bg-success/10 text-success border-success/20' },
  entrega:         { label: 'Em Entrega',          color: 'bg-info/10 text-info border-info/20' },
  cancelado:       { label: 'Cancelado',           color: 'bg-destructive/10 text-destructive border-destructive/20' },
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
  const { abrirArquivo } = useDocumentoFiscal();

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

    toast.info('Nenhum documento anexado a este pedido.', {
      description: 'Use "Registrar Ordem/Empenho" para anexar a nota, ou a aba Arquivos e Aditivos.',
      action: { label: 'Ver detalhes', onClick: () => openEditDialog(p) },
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

  const abrirDanfe = async (storagePath: string, nome: string) => {
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
   * `abrirDanfe` assina em `financeiro-documentos`, onde moram as DANFEs. Os
   * documentos do contrato estão em `contratos-docs`. Assinar um caminho no
   * bucket errado falha sempre, e a mensagem convidava a tentar de novo uma
   * coisa que nunca ia dar certo.
   *
   * É a causa de "não consigo ver o empenho anexado", relatado duas vezes: o
   * vínculo estava certo, o caminho estava certo, o arquivo estava lá — só era
   * procurado no armário errado.
   */
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
  const navigate = useNavigate();
  const { isFinanceiro, isAdmin } = useMembroPermissoes();
  const podeVerCustos = isFinanceiro || isAdmin;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
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
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete audit dialog
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; numero: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
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
  const [origemFilter, setOrigemFilter] = useState<string>('__todos__');
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
  const [saldosDeEmpenho, setSaldosDeEmpenho] = useState<
    Array<{
      empenho_id: string; numero: string; tipo: string; arquivo_id: string | null;
      cota: string; saldo_qtd: number; qtd_empenhada: number;
    }>
  >([]);
  // O PDF da Ordem/Empenho guardado nesta sessão de upload, para ligar ao
  // pedido no momento em que ele for salvo.
  const [arquivoOrdem, setArquivoOrdem] = useState<string | null>(null);
  // O PDF ainda NÃO guardado: fica em memória até o Registrar. Anexar não é
  // registrar — quem desiste no meio não deixa arquivo solto no dossiê.
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null);

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
          ? { rotulo: `cota ${emp.cota} do empenho ${emp.numero}`, saldoQtd: emp.saldo_qtd, tipo: emp.tipo }
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
    const porId = new Map<string, { id: string; numero: string; tipo: string; arquivo_id: string | null; saldo: number }>();
    for (const s of saldosDeEmpenho) {
      const atual = porId.get(s.empenho_id);
      if (atual) atual.saldo += Number(s.saldo_qtd) || 0;
      else porId.set(s.empenho_id, {
        id: s.empenho_id, numero: s.numero, tipo: s.tipo, arquivo_id: s.arquivo_id,
        saldo: Number(s.saldo_qtd) || 0,
      });
    }
    return [...porId.values()];
  }, [saldosDeEmpenho]);

  /** O que o upload em curso vai criar: autorização ou consumo. */
  const documentoCria = oQueODocumentoCria(extractedData?.tipo_documento || form.tipo_documento);

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
      supabase.from('contrato_itens').select('id, codigo_item, descricao, unidade, valor_unitario, origem_aditivo_id').eq('contrato_id', contratoId),
      supabase.from('notas_fiscais').select('id, numero_nf, tipo, status, valor_total, data_emissao, chave_acesso, contrato_pedido_id, natureza_operacao, destinatario_razao_social').eq('contrato_id', contratoId),
      supabase.from('pre_notas_fiscais' as any).select('id, status, natureza_operacao, valor_total, created_at, motivo_rejeicao, motivo_devolucao').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
      supabase.from('contrato_aditivos').select('id, numero_aditivo, tipo').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('contratos').select('ata_srp_id, tipo_documento, forma_execucao, art95_fundamento, saldo_remanescente, valor_global').eq('id', contratoId).single(),
    ]);
    const pedidosData = (pedidosRes.data as any[]) || [];
    setPedidos(pedidosData);
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
    setAtaSrpId((contratoRes.data as any)?.ata_srp_id ?? null);
    setSaldoDoContrato(Number((contratoRes.data as any)?.saldo_remanescente ?? 0));

    // Empenhos e o saldo de cada cota. Consulta separada e tolerante: as
    // tabelas vêm de migration colada à mão, e sem elas a checagem apenas não
    // avalia o empenho — não impede ninguém de trabalhar.
    supabase
      .from('contrato_empenhos' as never)
      .select('id, numero, tipo, arquivo_id')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: true })
      .then(async ({ data: emps, error }) => {
        if (error || !emps?.length) { setSaldosDeEmpenho([]); return; }
        const linhas: typeof saldosDeEmpenho = [];
        for (const e of emps as unknown as Array<{ id: string; numero: string; tipo: string; arquivo_id: string | null }>) {
          const { data: saldo } = await supabase.rpc('contrato_empenho_saldo_por_cota' as never, { p_empenho_id: e.id } as never);
          for (const s of (saldo ?? []) as unknown as Array<{ cota: string; saldo_qtd: number; qtd_empenhada: number }>) {
            linhas.push({
              empenho_id: e.id, numero: e.numero, tipo: e.tipo, arquivo_id: e.arquivo_id,
              cota: s.cota, saldo_qtd: Number(s.saldo_qtd) || 0,
              qtd_empenhada: Number(s.qtd_empenhada) || 0,
            });
          }
        }
        setSaldosDeEmpenho(linhas);
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

  /**
   * Filtra itens de acordo com a origem selecionada, usando lógica de mesclagem:
   * - "Todos": mostra todos os registros individuais
   * - "Contrato Original": apenas itens sem origem_aditivo_id
   * - "Aditivo X": mostra a versão EFETIVA de cada item físico no nível desse aditivo
   *   (itens modificados pelo aditivo X com os novos valores + itens não tocados com valores originais)
   *   Isso garante que o usuário veja TODOS os itens disponíveis com os preços corretos da época do aditivo.
   */
  const itensFiltrados = useMemo((): ContratoItem[] => {
    if (origemFilter === '__todos__') return itens;
    if (origemFilter === '__contrato__') return itens.filter(i => !i.origem_aditivo_id);

    const aditivoIdx = aditivos.findIndex(a => a.id === origemFilter);
    if (aditivoIdx < 0) return itens;

    // Aditivos "em escopo" até o selecionado (inclusive)
    const aditivoIdsEmEscopo = new Set(aditivos.slice(0, aditivoIdx + 1).map(a => a.id));

    // Agrupa por item físico
    const grupos = new Map<string, ContratoItem[]>();
    for (const item of itens) {
      const key = itemGroupKey(item);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(item);
    }

    const resultado: ContratoItem[] = [];
    for (const grupo of grupos.values()) {
      // Versões válidas até o aditivo selecionado: original + aditivos anteriores e o selecionado
      const emEscopo = grupo.filter(i => !i.origem_aditivo_id || aditivoIdsEmEscopo.has(i.origem_aditivo_id));
      if (emEscopo.length === 0) continue;

      // Pega a versão mais recente em escopo: ordena por índice do aditivo (original = -1)
      const ordenado = [...emEscopo].sort((a, b) => {
        const ia = a.origem_aditivo_id ? aditivos.findIndex(x => x.id === a.origem_aditivo_id) : -1;
        const ib = b.origem_aditivo_id ? aditivos.findIndex(x => x.id === b.origem_aditivo_id) : -1;
        return ib - ia; // maior índice primeiro
      });
      resultado.push(ordenado[0]); // o mais recente em escopo
    }

    return resultado;
  }, [itens, aditivos, origemFilter]);

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

      // Leitor da casa: página por página, OCR reencaixado no lugar. Era a
      // quarta cópia do leitor antigo — e empenho/nota ESCANEADOS são o caso
      // comum deste upload, não a exceção.
      const { extractTextFromFile } = await import('@/lib/pdf-text-extractor');
      const fullText = await extractTextFromFile(file, 30, false, 10);
      if (fullText.trim().length < 30) {
        toast.error('Não foi possível ler o PDF, nem por OCR.');
        setUploading(false);
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('extrair-pedido-pdf', {
        body: {
          texto_pdf: fullText,
          tipo_documento: form.tipo_documento,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const extracted = result.data;
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
      const cria = oQueODocumentoCria(extracted.tipo_documento || form.tipo_documento);
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Cria lançamentos "a_receber" no Financeiro vinculados ao contrato e aos pedidos recém-criados. */
  const gerarLancamentosFinanceiros = async (
    pedidosCriados: Array<{ id: string; numero_pedido: string; descricao: string | null; valor_total: number; data_pedido: string | null; contrato_item_id?: string | null }>,
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
      const inserts = pedidosCriados.map((p) => ({
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

  const handleSaveSingle = async () => {
    // A mesma bifurcação do upload, no lançamento à mão: quem escolhe "Empenho
    // Ordinário" no tipo do documento está registrando uma AUTORIZAÇÃO, e ela
    // não pode virar entrega só porque foi digitada em vez de lida.
    if (oQueODocumentoCria(form.tipo_documento) === 'empenho') {
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
    await gerarLancamentosFinanceiros([novoPedido as any]);
    setSaving(false);
    avisarPrazo(novoPedido?.data_pedido);
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
    if (oQueODocumentoCria(extractedData.tipo_documento || form.tipo_documento) === 'empenho') {
      return salvarEmpenho(extractedItens);
    }

    if (!form.numero_pedido) { toast.error('Informe o número do pedido'); return; }

    const itensSalvar = extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0);

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
      await gerarLancamentosFinanceiros([novoPedido as any]);
      setSaving(false);
      avisarPrazo(novoPedido?.data_pedido);
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

  const handleDeleteConfirmed = async () => {
    if (!deleteDialog || !deleteReason.trim()) return;
    const { id, numero } = deleteDialog;
    const pedidoSnap = pedidos.find(p => p.id === id);
    setDeleting(true);

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
      motivo: deleteReason.trim(),
      pedido_snapshot: pedidoSnap ? pedidoSnap : null,
    });

    await supabase.from('comissoes_lancamentos' as any).delete().eq('contrato_pedido_id', id);
    await supabase.from('contrato_custos').delete().eq('contrato_pedido_id', id);
    await supabase.from('notas_fiscais').update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    await supabase.from('contas_receber' as any).update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);
    await supabase.from('pre_nota_itens' as any).update({ contrato_pedido_id: null } as any).eq('contrato_pedido_id', id);

    const { error } = await supabase.from('contrato_pedidos').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      toast.error('Erro ao excluir pedido: ' + error.message);
      setDeleteDialog(null);
      return;
    }
    toast.success('Pedido excluído. Motivo registrado.');
    setDeleteDialog(null);
    load();
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
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPedido) return;
    if (editingPedido.nf_quitada) { toast.error('Pedido com NF quitada não pode ser editado.'); return; }
    const qty = parseFloat(editForm.quantidade) || 0;
    const unit = parseFloat(editForm.valor_unitario) || 0;
    setSavingEdit(true);
    const { error } = await supabase.from('contrato_pedidos').update({
      numero_pedido: editForm.numero_pedido,
      descricao: editForm.descricao || null,
      contrato_item_id: editForm.contrato_item_id || null,
      quantidade: qty,
      valor_unitario: unit,
      valor_total: qty * unit,
      data_pedido: editForm.data_pedido || null,
      data_entrega: editForm.data_entrega || null,
      status: editForm.status,
      nota_fiscal: editForm.nota_fiscal || null,
      observacoes: editForm.observacoes || null,
      numero_empenho: normalizarNumeroEmpenho(editForm.numero_empenho),
      tipo_empenho: tipoDeEmpenho(editForm.tipo_empenho),
      valor_empenho: parseFloat(editForm.valor_empenho) || null,
    } as any).eq('id', editingPedido.id);
    setSavingEdit(false);
    if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
    toast.success('Pedido atualizado.');
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

  return (
    <div className="space-y-4">
      {avisoExecucao && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{avisoExecucao}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" /> Pedidos / Ordens de Fornecimento
          </h3>
          <p className="text-xs text-muted-foreground">
            {pedidos.length} pedidos | Total: {fmt(totalPedidos)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreNfDialogOpen(true)} disabled={pedidos.filter(p => p.status !== 'cancelado').length === 0}>
            <Receipt className="w-3.5 h-3.5 mr-1" /> Gerar Pré-NF
          </Button>
          {/* Este SAI da tela: leva ao Kanban comercial. O nome "Novo Pedido"
              era idêntico ao do botão ao lado, que cria aqui mesmo — e os dois
              fazem coisas diferentes. */}
          <Button size="sm" variant="outline"
            title="Abrir Gestão de Compras para criar o pedido pelo funil comercial"
            onClick={() => navigate(`/gestao-compras?novo_contrato=${contratoId}`)}>
            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Criar no Kanban
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            {/* Não é tela legada: é a ÚNICA forma de cadastrar pedido direto
                no contrato — o botão azul ao lado navega para Gestão de
                Compras e cria pelo Kanban. Quem lança pedido retroativo, de
                contrato que já estava em andamento antes da adesão ao sistema,
                passa por aqui. O rótulo "Legada" dizia o contrário e convidava
                a remover o que não dá para remover. */}
            {/* O caminho principal de quem administra o contrato: chegou a
                Ordem de Fornecimento ou a nota de empenho, anexa aqui, o
                sistema lê os itens e abate saldo e quantidade. */}
            <Button size="sm" onClick={openNewDialog} className="gap-1"
              title="Anexar a Ordem de Fornecimento ou Nota de Empenho e registrar o pedido">
              <Upload className="w-3.5 h-3.5" /> Registrar Ordem/Empenho
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" /> Registrar Pedido
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1 text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Importar Documento
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Inclusão Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 mt-3">
                <div>
                  <Label className="text-xs">Tipo de Documento</Label>
                  <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposDocumento.map(td => (
                        <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Faça upload do documento PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">OF, Nota de Empenho, PRD ou documento similar</p>
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processando...</> : <><Upload className="w-4 h-4 mr-1" /> Selecionar PDF</>}
                  </Button>
                </div>

                {uploading && (
                  <div className="p-3 rounded-lg bg-muted/50 border text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Extraindo dados com IA...</p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Documentos suportados:</p>
                  <p>Ordem de Fornecimento (OF), Nota de Empenho (Global, Ordinário, Estimativo), PRD</p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                {extractedData && (
                  <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      Dados extraídos — revise e corrija se necessário
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">N.o Documento *</Label>
                    <Input value={form.numero_pedido} onChange={e => setForm(f => ({ ...f, numero_pedido: e.target.value }))} placeholder="OF-001, NE-2025/001" />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de Documento</Label>
                    <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tiposDocumento.map(td => (
                          <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Data do Pedido</Label>
                    <Input type="date" value={form.data_pedido} onChange={e => setForm(f => ({ ...f, data_pedido: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Data de Entrega (prevista)</Label>
                    <Input type="date" value={form.data_entrega} onChange={e => setForm(f => ({ ...f, data_entrega: e.target.value }))} />
                    {/* De onde a data veio. Derivado e digitado se parecem na
                        tela, e quem confere precisa saber em qual está apoiado
                        — o mesmo motivo do cartão de procedência do DRE. */}
                    {prazos?.prazo_entrega_dias && form.data_pedido && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {form.data_entrega === limiteDerivado(form.data_pedido)
                          ? `Derivado da cláusula: ${prazos.prazo_entrega_dias} dias ${prazos.prazo_entrega_unidade === 'uteis' ? 'úteis' : 'corridos'} da data do pedido.`
                          : `A cláusula do contrato daria ${limiteDerivado(form.data_pedido)
                              ? new Date(limiteDerivado(form.data_pedido) + 'T12:00:00').toLocaleDateString('pt-BR')
                              : '—'} (${prazos.prazo_entrega_dias} dias ${prazos.prazo_entrega_unidade === 'uteis' ? 'úteis' : 'corridos'}).`}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
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
                  <div>
                    <Label className="text-xs">Nota Fiscal</Label>
                    <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
                  </div>
                </div>

                {/* O que este documento vai fazer, dito ANTES de salvar.
                    Empenhar não é entregar: enquanto a nota criava pedidos, o
                    saldo caía no instante em que o dinheiro era reservado. */}
                {extractedData && documentoCria === 'empenho' && (
                    <div className="p-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 space-y-2">
                      <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                        Nota de empenho — <b>autoriza</b>, não consome
                      </p>
                      <p className="text-xs text-blue-900/80 dark:text-blue-200/80">
                        Vai ser registrada como empenho do contrato. Nenhum saldo de item ou de
                        contrato é abatido: isso acontece quando as entregas forem lançadas contra
                        ela.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <Label className="text-xs">Número do empenho</Label>
                          <Input
                            value={form.numero_empenho}
                            onChange={e => setForm(f => ({ ...f, numero_empenho: e.target.value }))}
                            placeholder="2026NE003716"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Espécie</Label>
                          <Select value={form.tipo_empenho} onValueChange={v => setForm(f => ({ ...f, tipo_empenho: v }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha a espécie" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ordinario" className="text-xs">{ROTULO_DO_EMPENHO.ordinario}</SelectItem>
                              <SelectItem value="global" className="text-xs">{ROTULO_DO_EMPENHO.global}</SelectItem>
                              <SelectItem value="estimativo" className="text-xs">{ROTULO_DO_EMPENHO.estimativo}</SelectItem>
                            </SelectContent>
                          </Select>
                          {/* Lida do documento é fato; escolhida à mão é
                              declaração. O mesmo excesso é irregularidade num
                              ordinário e rotina num estimativo. */}
                          <p className="text-[11px] text-muted-foreground mt-1">
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
                    <div>
                      <Label className="text-xs">Empenho que autoriza este pedido</Label>
                      <Select
                        value={form.empenho_id || '__sem__'}
                        onValueChange={v => setForm(f => ({ ...f, empenho_id: v === '__sem__' ? '' : v }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__sem__" className="text-xs">Sem empenho registrado</SelectItem>
                          {empenhosDoContrato.map(e => (
                            <SelectItem key={e.id} value={e.id} className="text-xs">
                              {e.numero} — {ROTULO_DO_EMPENHO[e.tipo as 'ordinario'] ?? e.tipo}
                              {' · '}saldo {e.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
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
                      <p className="text-xs font-semibold mb-2">
                        {documentoCria === 'empenho' ? 'Linhas do empenho' : 'Itens Extraídos'} ({extractedItens.length})
                      </p>
                      <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                        {extractedItens.map((ei, idx) => (
                          <Card key={ei.key} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeExtractedItem(ei.key)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                            <div>
                              <Label className="text-xs">Descrição</Label>
                              <Input value={ei.descricao} onChange={e => updateExtractedItem(ei.key, 'descricao', e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Item do Contrato</Label>
                                <Select value={ei.contrato_item_id} onValueChange={v => {
                                  const item = itens.find(i => i.id === v);
                                  updateExtractedItem(ei.key, 'contrato_item_id', v);
                                  if (item) updateExtractedItem(ei.key, 'valor_unitario', String(item.valor_unitario));
                                }}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vincular item" /></SelectTrigger>
                                  <SelectContent>
                                    {itens.map(i => (
                                      <SelectItem key={i.id} value={i.id} className="text-xs">
                                        <span className="text-muted-foreground text-xs mr-1">[{getOrigemLabel(i, aditivos)}]</span>
                                        {i.descricao}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Quantidade</Label>
                                <Input type="number" value={ei.quantidade} onChange={e => updateExtractedItem(ei.key, 'quantidade', e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-xs">Valor Unit. (R$)</Label>
                                <MoneyInput value={Number(ei.valor_unitario) || 0} onValueChange={v => updateExtractedItem(ei.key, 'valor_unitario', String(v))} className="h-8 text-xs" />
                              </div>
                            </div>
                            {/* A cota fica no nível da LINHA porque é aí que ela
                                vive: a principal e a reservada são divisões do
                                mesmo item (LC 123/2006, art. 48, III) e esgotam
                                separadas. */}
                            <div>
                              <Label className="text-xs">Cota</Label>
                              <Select
                                value={ei.cota || '__sem__'}
                                onValueChange={v => {
                                  updateExtractedItem(ei.key, 'cota', v === '__sem__' ? '' : v);
                                  updateExtractedItem(ei.key, 'cota_origem', 'documento');
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__sem__" className="text-xs">Sem divisão de cota</SelectItem>
                                  <SelectItem value="principal" className="text-xs">{ROTULO_DA_COTA.principal}</SelectItem>
                                  <SelectItem value="reservada" className="text-xs">{ROTULO_DA_COTA.reservada}</SelectItem>
                                </SelectContent>
                              </Select>
                              {/* Deduzida é para conferir; lida é para confiar.
                                  Não dizer qual das duas é apresentar palpite
                                  com a mesma cara de fato. */}
                              {ei.cota_origem === 'proporcao' && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-1">
                                  {ROTULO_DA_ORIGEM_DA_COTA.proporcao}
                                </p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border flex justify-between items-center">
                      <span className="text-xs font-medium">{extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} itens válidos</span>
                      <span className="text-sm font-bold text-foreground">Total: {fmt(totalExtracted)}</span>
                    </div>

                    <div className="col-span-2">
                      <Label className="text-xs">Observações</Label>
                      <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                    </div>

                    {/* Empenho não gera cobrança: não há entrega para faturar.
                        O título nasce quando a OF for lançada contra ele. */}
                    {documentoCria === 'pedido' && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
                        <Checkbox id="ger-cr-batch" checked={gerarContaReceber} onCheckedChange={(v) => setGerarContaReceber(!!v)} />
                        <Label htmlFor="ger-cr-batch" className="text-xs cursor-pointer">
                          <DollarSign className="w-3 h-3 inline mr-1" />
                          Gerar <b>contas a receber</b> (uma por item) no Financeiro vinculadas a este contrato
                        </Label>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSaveBatch} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                        {documentoCria === 'empenho'
                          ? `Registrar empenho (${extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} linhas)`
                          : `Registrar ${extractedItens.filter(ei => ei.descricao && (parseFloat(ei.quantidade) || 0) > 0).length} itens`}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Separator />
                    {ataSrpId && itensAta.length > 0 && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border">
                        <span className="text-xs text-muted-foreground shrink-0">Fonte dos valores:</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant={fonteItens === 'contrato' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setFonteItens('contrato'); setAtaItemSelecionado(''); setForm(f => ({ ...f, contrato_item_id: '' })); }}
                          >
                            Contrato
                          </Button>
                          <Button
                            type="button"
                            variant={fonteItens === 'ata' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setFonteItens('ata'); setOrigemFilter('__todos__'); setAtaItemSelecionado(''); setForm(f => ({ ...f, contrato_item_id: '' })); }}
                          >
                            ATA pai
                          </Button>
                        </div>
                      </div>
                    )}
                    {fonteItens === 'contrato' && (
                      <div>
                        <Label className="text-xs">Origem do Pedido</Label>
                        <Select value={origemFilter} onValueChange={v => { setOrigemFilter(v); setForm(f => ({ ...f, contrato_item_id: '', origem_aditivo_id: v === '__todos__' || v === '__contrato__' ? '' : v })); }}>
                          <SelectTrigger><SelectValue placeholder="Filtrar por origem" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__todos__">Todos os Itens</SelectItem>
                            <SelectItem value="__contrato__">Contrato Original</SelectItem>
                            {aditivos.map((a, idx) => (
                              <SelectItem key={a.id} value={a.id}>{`${idx + 1}º Termo Aditivo`} ({a.tipo})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">{fonteItens === 'ata' ? 'Item da ATA (Fonte)' : 'Item do Contrato'}</Label>
                      {fonteItens === 'ata' ? (
                        <Select value={ataItemSelecionado} onValueChange={handleItemChangeAta}>
                          <SelectTrigger><SelectValue placeholder="Selecionar item da ATA" /></SelectTrigger>
                          <SelectContent>
                            {itensAta.map(i => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.descricao} ({i.unidade}) — {fmt(i.valor_unitario)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={form.contrato_item_id} onValueChange={handleItemChange}>
                          <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                          <SelectContent>
                            {itensFiltrados.map(i => (
                              <SelectItem key={i.id} value={i.id}>
                                <span className="text-muted-foreground text-xs mr-1">[{getOrigemLabel(i, aditivos)}]</span>
                                {i.descricao} ({i.unidade}) — {fmt(i.valor_unitario)}
                              </SelectItem>
                            ))}
                            {itensFiltrados.length === 0 && (
                              <div className="py-2 text-center text-xs text-muted-foreground">Nenhum item para esta origem</div>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Quantidade</Label>
                        <Input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Valor Unitário (R$)</Label>
                        <MoneyInput value={Number(form.valor_unitario) || 0} onValueChange={v => setForm(f => ({ ...f, valor_unitario: String(v) }))} />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Observações</Label>
                      <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
                      <Checkbox id="ger-cr-single" checked={gerarContaReceber} onCheckedChange={(v) => setGerarContaReceber(!!v)} />
                      <Label htmlFor="ger-cr-single" className="text-xs cursor-pointer">
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        Gerar <b>conta a receber</b> automaticamente no Financeiro vinculada a este contrato
                      </Label>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSaveSingle} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Registrar
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* ── Os empenhos do contrato ───────────────────────────────────────
          Faltava esta lista, e a falta tinha consequência: o 2026NE003716
          estava registrado, a aba mostrava "0 pedidos | R$ 0,00", e a única
          leitura possível era a de que nada havia sido registrado. Daí a
          segunda tentativa de cadastrar o mesmo empenho.
          Empenho não é pedido, então não entra na tabela de pedidos — mas
          precisa estar à vista, com o que já autoriza e o que dele resta. */}
      {empenhosDoContrato.length > 0 && (
        <Card className="p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Empenhos registrados ({empenhosDoContrato.length})
            </h4>
            <span className="text-xs text-muted-foreground">autorizam os pedidos abaixo</span>
          </div>
          <div className="space-y-2">
            {empenhosDoContrato.map(e => {
              const cotas = saldosDeEmpenho.filter(s => s.empenho_id === e.id);
              return (
                <div key={e.id} className="rounded-md border p-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{e.numero}</span>
                      <Badge variant="outline" className="text-[11px]">
                        {ROTULO_DO_EMPENHO[e.tipo as 'ordinario'] ?? e.tipo}
                      </Badge>
                    </div>
                    {e.arquivo_id ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => abrirDocumentoDoEmpenho(e.arquivo_id!)}>
                        <Eye className="w-3 h-3 mr-1" /> Ver documento
                      </Button>
                    ) : (
                      // Empenho sem PDF é autorização que não se prova. Dizer
                      // qual está sem documento é o que permite ir buscá-lo.
                      <span className="text-[11px] text-amber-700 dark:text-amber-500">
                        sem documento anexado
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 flex-wrap mt-1.5">
                    {cotas.map(c => (
                      <span key={c.cota} className="text-xs text-muted-foreground">
                        {c.cota === 'reservada' ? 'Cota reservada' : 'Cota principal'}:{' '}
                        <b className="text-foreground tabular-nums">
                          {c.saldo_qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </b>{' '}
                        de {c.qtd_empenhada.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} disponíveis
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : pedidos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          {empenhosDoContrato.length > 0
            ? 'Nenhum pedido registrado ainda — o empenho acima autoriza, e cada entrega lançada aqui consome dele.'
            : 'Nenhum pedido registrado'}
        </Card>
      ) : (
        <>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead className="text-sm whitespace-nowrap cursor-pointer select-none" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}>
                  <div className="flex items-center gap-1">
                    N.º Pedido
                    {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </TableHead>
                <TableHead className="text-sm whitespace-nowrap">Descrição</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap">Qtd</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap">Vlr Total</TableHead>
                <TableHead className="text-sm text-center whitespace-nowrap">Data</TableHead>
                <TableHead className="text-sm text-center whitespace-nowrap">Status</TableHead>
                <TableHead className="text-sm text-center whitespace-nowrap">Status Kanban</TableHead>
                <TableHead className="text-sm whitespace-nowrap">NF-e Financeiro</TableHead>
                {/* Fixa à direita. As colunas cresceram quando a fonte subiu
                    para 14px e empurraram as ações para fora da area visivel —
                    e o macOS esconde a barra de rolagem, entao os botoes
                    simplesmente sumiam. Acao de linha nao pode depender de
                    alguem descobrir que a tabela rola. */}
                <TableHead className="text-sm sticky right-0 bg-background z-10 w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const sorted = sortOrder
                  ? [...pedidos].sort((a, b) => {
                      const cmp = a.numero_pedido.localeCompare(b.numero_pedido, 'pt-BR', { numeric: true });
                      return sortOrder === 'asc' ? cmp : -cmp;
                    })
                  : pedidos;
                return sorted.map(p => {
                const cfg = statusCfg[p.status] || statusCfg.pendente;
                const linkedNfs = nfsSync.filter(nf => nf.contrato_pedido_id === p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-mono font-medium whitespace-nowrap">
                      {p.nf_quitada ? (
                        <span className="text-muted-foreground" title="NF quitada — edição bloqueada">{p.numero_pedido}</span>
                      ) : (
                        <button
                          className="hover:underline text-primary cursor-pointer"
                          onClick={() => abrirOrdem(p)}
                          title={(p as { arquivo_ordem_id?: string | null }).arquivo_ordem_id
                            ? 'Abrir a Ordem/Empenho que autorizou este pedido'
                            : 'Abrir detalhes do pedido'}
                        >
                          {p.numero_pedido}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {/* A descrição do objeto não cabe em 200px e a leitura
                          completa é o que diz O QUE foi pedido. Truncar sem
                          dar como abrir esconde justamente isso. */}
                      {p.descricao ? (
                        <button
                          type="button"
                          className="truncate block w-full text-left hover:underline cursor-pointer"
                          title="Ver descrição completa"
                          onClick={() => setLendo(p)}
                        >
                          {p.descricao}
                        </button>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-right whitespace-nowrap">{p.quantidade}</TableCell>
                    <TableCell className="text-sm text-right font-medium whitespace-nowrap">{fmt(p.valor_total)}</TableCell>
                    <TableCell className="text-sm text-center whitespace-nowrap">
                      <div>{p.data_pedido ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
                      {/* O prazo que começou a correr quando este pedido foi
                          lançado. Antes a coluna mostrava a data e parava aí.

                          `dataDeEntrega` só é passada quando o STATUS diz que
                          houve entrega. `data_entrega` guarda a data PREVISTA
                          — a própria extração a descreve assim — e tratá-la
                          como realizada fazia a linha afirmar "Entregue com
                          286 dias de atraso" para um pedido que nunca saiu,
                          usando a data de fim do empenho lida do documento.
                          Quem sabe se entregou é o status; a data prevista só
                          diz para quando era. */}
                      <AvisoDePrazoDeEntrega
                        compacto
                        contrato={prazos}
                        dataDoPedido={p.data_pedido}
                        dataDeEntrega={p.status === 'entregue' ? p.data_entrega : null}
                      />
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {p.pedido_id ? (
                        updatingKanban[p.pedido_id] ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                          <Select
                            value={kanbanStatuses[p.pedido_id] ?? 'pedido'}
                            onValueChange={(val) => updateKanbanStatus(p.pedido_id!, val)}
                          >
                            <SelectTrigger className={`h-6 text-xs border px-2 py-0 w-fit mx-auto ${kanbanCfg[kanbanStatuses[p.pedido_id] ?? 'pedido']?.color ?? 'bg-muted/50 text-muted-foreground'}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(kanbanCfg).map(([key, cfg]) => (
                                <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-1">
                        {p.nota_fiscal && (() => {
                          // O número da nota é o elo entre o pedido e o
                          // documento arquivado no Financeiro: o pedido não
                          // guarda lancamento_id. Havendo arquivo, o selo vira
                          // botão e abre o DANFE — ver o pedido e não alcançar
                          // a nota que o comprova é o passo que faltava.
                          const doc = chaveDoNumero(p.nota_fiscal)
                            .map((k) => docsPorNumero?.[k]).find(Boolean);
                          const conteudo = (
                            <>
                              <FileText className="w-3 h-3 mr-1 inline" />
                              {/* Formato do DANFE. O campo é texto livre e
                                  recebe "125", "NF 000000125" e "125/2026" —
                                  três grafias da mesma nota, que sem
                                  normalizar viram três linhas diferentes. */}
                              {formatarNumeroNfe(p.nota_fiscal) ?? p.nota_fiscal}
                              {p.nf_quitada && p.data_quitacao && (
                                <span className="ml-1 text-success">• Quitada {new Date(p.data_quitacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              )}
                            </>
                          );
                          if (!doc) {
                            return (
                              <Badge variant="outline" className="text-xs block w-fit text-foreground">
                                {conteudo}
                              </Badge>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => abrirDanfe(doc.storage_path, doc.arquivo_nome)}
                              title={`Abrir ${doc.arquivo_nome}`}
                              className="block w-fit"
                            >
                              <Badge variant="outline"
                                className="text-xs text-foreground border-primary/40 hover:bg-primary/5 cursor-pointer transition-colors">
                                {conteudo}
                                <ExternalLink className="w-3 h-3 ml-1 inline text-primary" />
                              </Badge>
                            </button>
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
                            <Badge key={nf.id} variant="outline" className={`text-xs block w-fit ${
                              diverge ? 'border-warning/50 text-warning' :
                              nf.status === 'autorizada' ? 'border-success/30 text-success' :
                              nf.status === 'rejeitada' ? 'border-destructive/30 text-destructive' :
                              'border-muted-foreground/30 text-muted-foreground'
                            }`}
                            title={diverge
                              ? `A nota emitida (${formatarNumeroNfe(nf.numero_nf)}) não é a mesma que foi digitada no pedido (${formatarNumeroNfe(p.nota_fiscal)}).`
                              : undefined}>
                              <FileText className="w-3 h-3 mr-1 inline" />
                              {formatarNumeroNfe(nf.numero_nf) ?? 'Rascunho'} • {nf.tipo === 'saida' ? 'Saída' : 'Entrada'} {nf.valor_total ? `• ${fmt(nf.valor_total)}` : ''}
                              {diverge && ' • diverge do pedido'}
                            </Badge>
                          );
                        })}
                        {!p.nota_fiscal && linkedNfs.length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-background z-10 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                      <div className="flex items-center gap-1">
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
                        {p.nf_quitada ? (
                          <Badge className="text-xs bg-success/10 text-success border border-success/30 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> NF Quitada
                          </Badge>
                        ) : (
                          p.status === 'entregue' && (isFinanceiro || isAdmin) && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-xs text-success border-success/30 hover:bg-success/5"
                              onClick={() => openNfDialog(p)}
                              title="Registrar pagamento da NF-e e gerar bonificação"
                            >
                              <DollarSign className="w-3 h-3 mr-1" /> NF Quitada
                            </Button>
                          )
                        )}
                        {(isFinanceiro || isAdmin) && (
                          /* Pedido retroativo — cadastrado depois de o
                             recebimento já estar no Financeiro. Vincular em vez
                             de gerar evita contar a receita duas vezes. */
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            title="Vincular a lançamento existente no Financeiro"
                            onClick={() => setVinculando({
                              id: p.id,
                              numero_pedido: p.numero_pedido,
                              valor_total: Number(p.valor_total) || 0,
                              data_pedido: p.data_pedido,
                              nota_fiscal: p.nota_fiscal ?? null,
                            })}
                          >
                            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        {(isFinanceiro || isAdmin) && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            title="Excluir pedido"
                            onClick={() => openDeleteDialog(p.id, p.numero_pedido)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                        {(isFinanceiro || isAdmin) && !p.nf_quitada && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(p)} title="Editar pedido">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        {!(isFinanceiro || isAdmin) && !p.nf_quitada && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(p)} title="Ver detalhes">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
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

        {nfsSync.length > 0 && (
          <Card className="p-4 mt-4">
            <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Notas Fiscais Sincronizadas do Financeiro
              <Badge variant="outline" className="text-xs">{nfsSync.length} NFs</Badge>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">NFs Saída</p>
                <p className="text-sm font-bold">{nfsSync.filter(n => n.tipo === 'saida').length}</p>
                <p className="text-xs text-muted-foreground">{fmt(nfsSync.filter(n => n.tipo === 'saida').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">NFs Entrada</p>
                <p className="text-sm font-bold">{nfsSync.filter(n => n.tipo === 'entrada').length}</p>
                <p className="text-xs text-muted-foreground">{fmt(nfsSync.filter(n => n.tipo === 'entrada').reduce((s, n) => s + (n.valor_total || 0), 0))}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Autorizadas</p>
                <p className="text-sm font-bold text-success">{nfsSync.filter(n => n.status === 'autorizada').length}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-sm font-bold text-warning">{nfsSync.filter(n => n.status !== 'autorizada' && n.status !== 'cancelada').length}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              As notas fiscais são emitidas e controladas pelo setor Financeiro. Acesse o módulo Financeiro para emitir ou editar NFs.
            </p>
          </Card>
        )}
        </>
      )}

      {/* NF Quitada — Diálogo do Financeiro */}
      <Dialog open={!!nfDialog} onOpenChange={v => { if (!v) setNfDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              Registrar Pagamento de NF-e
            </DialogTitle>
          </DialogHeader>
          {nfDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                <p><strong>Pedido:</strong> {nfDialog.numero_pedido}</p>
                <p><strong>Valor do Pedido:</strong> {fmt(nfDialog.valor_total)}</p>
                {nfDialog.descricao && <p><strong>Descrição:</strong> {nfDialog.descricao}</p>}
              </div>

              <div>
                <Label>Número da Nota Fiscal *</Label>
                <Input value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="NF-e 000.000.001" />
              </div>

              <div>
                <Label>Data do Pagamento *</Label>
                <Input type="date" value={nfData} onChange={e => setNfData(e.target.value)} />
              </div>

              <div>
                <Label>Valor Pago (R$) *</Label>
                <MoneyInput
                  value={Number(nfValorPago) || 0}
                  onValueChange={(v) => setNfValorPago(String(v))}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  Ao registrar o pagamento, o sistema calculará automaticamente a bonificação do vendedor 
                  responsável pelo contrato com base na configuração de bonificação vigente.
                </p>
              </div>

              <Button
                onClick={handleMarcarNfQuitada}
                disabled={solicitandoComissao || !nfNumero.trim() || !nfData || !(parseFloat(nfValorPago) > 0)}
                className="w-full bg-success hover:bg-success/90 text-success-foreground"
              >
                {solicitandoComissao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <DollarSign className="w-4 h-4 mr-1" />}
                Confirmar Pagamento e Gerar Bonificação
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pré-Notas Fiscais */}
      {preNotas.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            Pré-Notas Fiscais Solicitadas
            <Badge variant="outline" className="text-xs">{preNotas.length}</Badge>
          </h4>
          <div className="space-y-2">
            {preNotas.map((pn: any) => {
              const statusMap: Record<string, { label: string; color: string }> = {
                pendente: { label: 'Pendente', color: 'bg-warning/10 text-warning' },
                em_revisao: { label: 'Em Revisão', color: 'bg-info/10 text-info' },
                aprovada: { label: 'Aprovada', color: 'bg-success/10 text-success' },
                rejeitada: { label: 'Rejeitada', color: 'bg-destructive/10 text-destructive' },
                devolvida: { label: 'Devolvida', color: 'bg-warning/10 text-warning' },
              };
              const st = statusMap[pn.status] || statusMap.pendente;
              return (
                <div key={pn.id} className="flex items-center justify-between p-2 rounded border bg-muted/30 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                    <span>{pn.natureza_operacao}</span>
                    <span className="font-medium">{fmt(pn.valor_total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{new Date(pn.created_at).toLocaleDateString('pt-BR')}</span>
                    {pn.motivo_devolucao && (
                      <Badge variant="outline" className="text-xs text-warning" title={pn.motivo_devolucao}>
                        <AlertTriangle className="w-3 h-3 mr-1" /> Devolvida
                      </Badge>
                    )}
                    {pn.motivo_rejeicao && (
                      <Badge variant="outline" className="text-xs text-destructive" title={pn.motivo_rejeicao}>
                        <XCircle className="w-3 h-3 mr-1" /> Rejeitada
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Delete Audit Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={v => { if (!v && !deleting) { setDeleteDialog(null); setDeleteReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Excluir Pedido
            </DialogTitle>
          </DialogHeader>
          {deleteDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-1">
                <p className="font-medium text-destructive">Atenção: esta ação não pode ser desfeita.</p>
                <p className="text-muted-foreground">Pedido: <strong className="text-foreground">{deleteDialog.numero}</strong></p>
              </div>
              <div>
                <Label className="text-xs">Motivo da exclusão *</Label>
                <Textarea
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="Informe o motivo da exclusão..."
                  className="mt-1.5 text-xs"
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Registrado por: <strong>{user?.email}</strong>
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setDeleteDialog(null); setDeleteReason(''); }} disabled={deleting}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteConfirmed}
                  disabled={!deleteReason.trim() || deleting}
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  Confirmar Exclusão
                </Button>
              </div>
            </div>
          )}
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

      {/* Edit Pedido Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingPedido(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-muted-foreground" /> Editar Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N.o Documento</Label>
                <Input value={editForm.numero_pedido} onChange={e => setEditForm(f => ({ ...f, numero_pedido: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
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
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            {itens.length > 0 && (
              <div>
                <Label className="text-xs">Item do Contrato</Label>
                <Select value={editForm.contrato_item_id} onValueChange={v => {
                  const item = itens.find(i => i.id === v);
                  setEditForm(f => ({ ...f, contrato_item_id: v, valor_unitario: item ? String(item.valor_unitario) : f.valor_unitario }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {itens.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        <span className="text-muted-foreground text-xs mr-1">[{getOrigemLabel(i, aditivos)}]</span>
                        {i.descricao} ({fmt(i.valor_unitario)}/{i.unidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" value={editForm.quantidade} onChange={e => setEditForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Valor Unitário</Label>
                <MoneyInput value={Number(editForm.valor_unitario) || 0} onValueChange={v => setEditForm(f => ({ ...f, valor_unitario: String(v) }))} />
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
                <div className={`rounded-lg border p-2.5 text-xs ${estoura ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/30'}`}>
                  <p className={estoura ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {q} × {fmt(u)} = <strong>{fmt(total)}</strong>
                  </p>
                  {estoura && (
                    <p className="text-destructive mt-1">
                      Isso passa em {fmt(total - anterior - saldo)} o saldo que resta no contrato
                      ({fmt(saldo)}). Confira se o valor digitado é o UNITÁRIO e não o total.
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data do Pedido</Label>
                <Input type="date" value={editForm.data_pedido} onChange={e => setEditForm(f => ({ ...f, data_pedido: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Data de Entrega</Label>
                <Input type="date" value={editForm.data_entrega} onChange={e => setEditForm(f => ({ ...f, data_entrega: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nota Fiscal</Label>
              <Input value={editForm.nota_fiscal} onChange={e => setEditForm(f => ({ ...f, nota_fiscal: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Leitura, não edição: quem clica na descrição quer LER o que foi
          pedido. Abrir o formulário de edição para isso põe campo gravável
          na frente de quem só queria conferir. */}
      <Dialog open={!!lendo} onOpenChange={(o) => !o && setLendo(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pedido {lendo?.numero_pedido}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Descrição</p>
              <p className="whitespace-pre-wrap">{lendo?.descricao || '—'}</p>
            </div>
            {lendo?.observacoes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="whitespace-pre-wrap">{lendo.observacoes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t text-xs">
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
