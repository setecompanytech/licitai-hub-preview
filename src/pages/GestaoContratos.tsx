import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useColaboradores } from '@/hooks/useMetasComercial';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import { AMPARO_ART95, ESPECIES_OBJETO, FORMAS_EXECUCAO, FUNDAMENTOS_ART95, INSTRUMENTOS, LIMITES_ADITIVO, VIGENCIA_ATA, avisoDeVigencia } from '@/lib/contratos/instrumentos';
import { rotuloDaAta } from '@/lib/contratos/rotulos';
import { avisoDeVigenciaAta, calcularVigencia, somarDias, statusEfetivo } from '@/lib/contratos/vigencia';
import LocalDoOrgao from '@/components/contratos/LocalDoOrgao';
import { salvarNaPastaDoProcesso } from '@/lib/processo/salvarNaPasta';
import { ehMeu, noEscopo, type EscopoResponsavel } from '@/lib/equipe/escopoProprio';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

const formatInputBRL = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseBRLInput = (value: string): string => {
  const clean = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? '0' : String(num);
};
import {
  FileText, Plus, Search, Calendar, DollarSign, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, Building2, Loader2, Trash2,
  ArrowLeft, Package, ShoppingCart, BarChart3, FilePlus2, Paperclip, ScrollText, Link2
, User as UserIcon } from 'lucide-react';
import ContratoItens from '@/components/contratos/ContratoItens';
import ContratoPedidos from '@/components/contratos/ContratoPedidos';
import ContratoDashboard from '@/components/contratos/ContratoDashboard';
import ContratoArquivos from '@/components/contratos/ContratoArquivos';

import ImportarContratoPDF from '@/components/contratos/ImportarContratoPDF';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  vigente: { label: 'Vigente', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  vencendo: { label: 'Vencendo', color: 'bg-warning/10 text-warning', icon: AlertTriangle },
  encerrado: { label: 'Encerrado', color: 'bg-muted text-muted-foreground', icon: Clock },
  suspenso: { label: 'Suspenso', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
};

type Contrato = {
  id: string; numero_contrato: string; objeto: string; orgao_contratante: string;
  valor_global: number; valor_consumido: number; saldo_remanescente: number;
  data_assinatura: string | null; data_inicio: string | null; data_fim: string | null;
  excluido_em?: string | null;
  vigencia_meses: number | null; status: string; modalidade: string | null;
  uf: string | null; municipio: string | null; fiscal_nome: string | null;
  fiscal_email: string | null; fiscal_telefone: string | null; observacoes: string | null;
  tipo_documento: 'contrato' | 'ata_srp';
  ata_srp_id: string | null;
  numero_ata: string | null;
  validade_ata_meses: number | null;
  permite_carona: boolean | null;
  licitacao_id: string | null;
  /** Responsável: define carteira, meta e bonificação. */
  vendedor_user_id: string | null;
  user_id: string | null;
};

type Licitacao = { id: string; numero: string; orgao: string; objeto: string; modalidade: string | null };

export default function GestaoContratos() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { isAdmin } = usePapelEmpresa();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [excluidos, setExcluidos] = useState<Contrato[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [licitacaoSearch, setLicitacaoSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'contrato' | 'ata_srp'>('all');
  // null = ainda não escolhido nesta sessão; o padrão sai do papel (abaixo).
  const [escopoFilter, setEscopoFilter] = useState<EscopoResponsavel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
  const [aExcluir, setAExcluir] = useState<Contrato | null>(null);
  // Documento assinado anexado no próprio cadastro: sem isso era preciso salvar,
  // reabrir o contrato e ir à aba Arquivos — três passos para guardar o papel
  // que motivou o cadastro.
  const [arquivoAssinado, setArquivoAssinado] = useState<File | null>(null);
  /**
   * Cadastro vindo de um processo vencido: `?novo_de=<licitacaoId>`.
   *
   * O contrato passa a nascer com o processo de origem gravado, em vez de
   * depender de alguém lembrar de vincular. Sem esse elo, diante de um impasse
   * — o órgão cobra algo que o contrato não prevê — achar o edital é busca
   * manual, e o histórico de "quanto do que disputamos virou contrato" não
   * existe.
   *
   * O cadastro manual continua intacto: é a porta para os certames de
   * plataformas que o sistema ainda não lê.
   */
  useEffect(() => {
    const de = searchParams.get('novo_de');
    if (!de) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from('licitacoes')
        .select('id, numero, orgao, objeto, valor_estimado, modalidade, uf, municipio')
        .eq('id', de)
        .maybeSingle();
      if (!vivo || !data) return;
      setForm((f) => ({
        ...f,
        licitacao_id: data.id,
        orgao_contratante: data.orgao || '',
        objeto: data.objeto || '',
        // Estimado é ponto de partida, não valor final: quem cadastra corrige
        // com o valor homologado.
        valor_global: data.valor_estimado ? String(data.valor_estimado) : '',
        modalidade: data.modalidade || '',
        uf: data.uf || '',
        municipio: data.municipio || '',
      }));
      setDialogOpen(true);
      // Some da URL para um F5 não reabrir o diálogo já preenchido.
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('novo_de'); return n; }, { replace: true });
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [form, setForm] = useState({
    tipo_documento: 'contrato' as 'contrato' | 'ata_srp',
    tipo_estrutura: 'itens' as 'itens' | 'lotes',
    ata_srp_id: '' as string,
    numero_ata: '',
    validade_ata_meses: '',
    permite_carona: true,
    forma_execucao: 'contrato_formal',
    art95_fundamento: '',
    especie_objeto: '',
    licitacao_id: '',
    numero_contrato: '', objeto: '', orgao_contratante: '',
    valor_global: '', valor_consumido: '0', data_assinatura: '',
    data_inicio: '', data_fim: '', vigencia_meses: '',
    status: 'vigente', modalidade: '', uf: '', municipio: '',
    fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '',
    // Quem VENDEU — diferente de quem cadastrou. É por este campo que o
    // contrato entra no realizado do colaborador (view de metas) e que a
    // bonificação encontra o beneficiário. Sem ele, os dois ficam órfãos.
    vendedor_user_id: '',
  });
  const { data: membrosEquipe } = useColaboradores();
  const [pendingItens, setPendingItens] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!user || !empresaAtiva) return;
    loadContratos();
    supabase.from('licitacoes').select('id, numero, orgao, objeto, modalidade')
      .eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false })
      .then(({ data }) => setLicitacoes((data as Licitacao[]) || []));
    const channel = supabase
      .channel('contratos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos', filter: `empresa_id=eq.${empresaAtiva.id}` }, () => loadContratos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, empresaAtiva]);

  const loadContratos = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data } = await supabase.from('contratos').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false });
    const list = (data as any[]) || [];
    // A lixeira é marca, não DELETE: ativos alimentam telas e contas; os
    // marcados vivem só na seção Lixeira, de onde se restauram.
    setContratos(list.filter(c => !c.excluido_em));
    setExcluidos(list.filter(c => !!c.excluido_em));
    if (selectedContrato) {
      const updated = list.find(c => c.id === selectedContrato.id);
      if (updated) setSelectedContrato(updated);
    }
    setLoading(false);
  };

  /** Atribui (ou solta) o vendedor de um contrato já cadastrado. */
  const atribuirVendedor = async (contratoId: string, vendedorId: string | null) => {
    const { error } = await supabase
      .from('contratos')
      .update({ vendedor_user_id: vendedorId })
      .eq('id', contratoId);
    if (error) { toast.error(`Não foi possível atribuir: ${error.message}`); return; }
    toast.success(vendedorId ? 'Contrato atribuído — passa a contar nas metas dessa pessoa.' : 'Vendedor removido do contrato.');
    loadContratos();
  };

  const atasDisponiveis = contratos.filter(c => c.tipo_documento === 'ata_srp');

  // Uma ATA cadastrada como contrato passa despercebida: a tela mostra o número
  // que a pessoa digitou, e nada denuncia o tipo errado. Foi assim que a ATA SRP
  // 022/2024 passou meses sendo medida pelo teto do art. 125, que não é dela.
  // O aviso não bloqueia — quem chama "Ata de reunião" a um contrato tem razão
  // de seguir; só não pode ser por não ter reparado.
  const pareceAtaMasEstaComoContrato =
    form.tipo_documento === 'contrato' &&
    /\b(ata|registro\s+de\s+pre[çc]os|srp|arp)\b/i.test(form.numero_contrato || '');

  const resetForm = () => { setLicitacaoSearch(''); setForm({
    tipo_documento: 'contrato', tipo_estrutura: 'itens', ata_srp_id: '', numero_ata: '', validade_ata_meses: '', permite_carona: true,
    forma_execucao: 'contrato_formal', art95_fundamento: '', especie_objeto: '',
    licitacao_id: '',
    numero_contrato: '', objeto: '', orgao_contratante: '', valor_global: '', valor_consumido: '0',
    data_assinatura: '', data_inicio: '', data_fim: '', vigencia_meses: '',
    status: 'vigente', modalidade: '', uf: '', municipio: '',
    fiscal_nome: '', fiscal_email: '', fiscal_telefone: '', observacoes: '', vendedor_user_id: '',
  }); };

  const handleSave = async () => {
    if (!form.numero_contrato || !form.objeto || !form.orgao_contratante) {
      toast.error('Preencha os campos obrigatórios'); return;
    }
    const val = parseFloat(form.valor_global) || 0;
    const consumed = parseFloat(form.valor_consumido) || 0;

    // A ARP registra a quantidade MÁXIMA: os contratos derivados a fracionam
    // até o esgotamento, e a soma deles não pode passar do registrado. Barrar
    // aqui é aplicar a lei — e é também a rede contra valor lido errado de um
    // PDF escaneado, que já consumiu 2.126% de uma ata nesta tela.
    if (form.tipo_documento === 'contrato' && form.ata_srp_id) {
      const ata = contratos.find(c => c.id === form.ata_srp_id);
      if (ata) {
        const saldoAta = (ata.valor_global || 0) - (ata.valor_consumido || 0);
        if (val > saldoAta) {
          toast.error('Contrato derivado excede o saldo da ATA', {
            description: `O contrato traz ${formatCurrency(val)}, mas o saldo registrado da ata é ${formatCurrency(saldoAta)}. A soma dos contratos derivados não pode passar do total registrado na ata.`,
            duration: 10000,
          });
          return;
        }
      }
    }

    setSaving(true);
    const { data: inserted, error } = await supabase.from('contratos').insert({
      user_id: user!.id,
      empresa_id: empresaAtiva!.id,
      tipo_documento: form.tipo_documento,
      tipo_estrutura: form.tipo_estrutura,
      ata_srp_id: form.tipo_documento === 'contrato' && form.ata_srp_id ? form.ata_srp_id : null,
      numero_ata: form.tipo_documento === 'ata_srp' ? (form.numero_ata || form.numero_contrato) : null,
      validade_ata_meses: form.tipo_documento === 'ata_srp' && form.validade_ata_meses ? parseInt(form.validade_ata_meses) : null,
      permite_carona: form.tipo_documento === 'ata_srp' ? form.permite_carona : null,
      // Só a ATA declara forma de execução: no contrato, o termo é o próprio
      // instrumento e a pergunta não faria sentido.
      forma_execucao: form.tipo_documento === 'ata_srp' ? form.forma_execucao : null,
      art95_fundamento: form.tipo_documento === 'ata_srp' && form.forma_execucao === 'empenho'
        ? (form.art95_fundamento || null) : null,
      especie_objeto: form.especie_objeto || null,
      numero_contrato: form.numero_contrato, objeto: form.objeto,
      orgao_contratante: form.orgao_contratante, valor_global: val, valor_global_original: val, valor_consumido: consumed,
      data_assinatura: form.data_assinatura || null, data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null, vigencia_meses: parseInt(form.vigencia_meses) || null,
      status: form.status, modalidade: form.modalidade || null, uf: form.uf || null,
      municipio: form.municipio || null, fiscal_nome: form.fiscal_nome || null,
      fiscal_email: form.fiscal_email || null, fiscal_telefone: form.fiscal_telefone || null,
      observacoes: form.observacoes || null,
      licitacao_id: form.licitacao_id || null,
      // Contrato cadastrado por quem não é administrador nasce no nome de quem
      // cadastrou — a alternativa seria nascer sem dono e ficar invisível para
      // o próprio autor, que abre a tela na carteira dele.
      vendedor_user_id: isAdmin ? (form.vendedor_user_id || null) : (user?.id ?? null),
    } as any).select('id').single();
    setSaving(false);
    if (error) { console.error('Erro ao salvar:', error); toast.error('Erro ao salvar', { description: error.message }); return; }

    // Documento assinado, quando anexado no cadastro. Falha aqui não desfaz o
    // contrato: ele já existe, e o arquivo pode ser reenviado pela aba Arquivos.
    if (inserted && arquivoAssinado && user) {
      const ext = arquivoAssinado.name.split('.').pop() || 'pdf';
      const caminho = `${user.id}/${inserted.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('contratos-docs').upload(caminho, arquivoAssinado);
      if (upErr) {
        toast.warning('Contrato salvo, mas o arquivo não subiu. Anexe pela aba Arquivos.');
      } else {
        await supabase.from('contrato_arquivos').insert({
          contrato_id: inserted.id,
          user_id: user.id,
          nome_arquivo: arquivoAssinado.name,
          storage_path: caminho,
          tipo: isAtaForm ? 'ata_srp' : 'contrato_original',
          tamanho_bytes: arquivoAssinado.size,
        } as never);

        // Espelho na pasta do certame, quando há elo — mesmo critério da aba
        // Arquivos: o que o órgão assinou vive também na pasta do processo.
        if (form.licitacao_id) {
          await salvarNaPastaDoProcesso({
            licitacaoId: form.licitacao_id,
            categoria: 'contrato',
            nomeArquivo: arquivoAssinado.name,
            blob: arquivoAssinado,
            descricao: `Anexado no cadastro do ${isAtaForm ? 'ATA SRP' : 'contrato'}`,
            metadata: { contrato_id: inserted.id },
          });
        }
      }
      setArquivoAssinado(null);
    }

    if (inserted && pendingItens.length > 0) {
      const itensToInsert = pendingItens.map(item => ({
        contrato_id: inserted.id,
        user_id: user!.id,
        descricao: item.descricao || 'Sem descrição',
        unidade: item.unidade || 'UN',
        quantidade_contratada: item.quantidade || 0,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.valor_total || (item.quantidade || 0) * (item.valor_unitario || 0),
        saldo_quantitativo: item.quantidade || 0,
        saldo_financeiro: item.valor_total || (item.quantidade || 0) * (item.valor_unitario || 0),
        codigo_item: item.codigo_item || null,
        numero_lote: form.tipo_estrutura === 'lotes' ? (item.numero_lote || item.lote || null) : null,
        descricao_lote: form.tipo_estrutura === 'lotes' ? (item.descricao_lote || null) : null,
      }));
      const { error: itensError } = await supabase.from('contrato_itens').insert(itensToInsert as any);
      if (itensError) {
        console.error('Erro ao salvar itens:', itensError);
        toast.error('Documento salvo, mas houve erro ao importar os itens');
      } else {
        toast.success(`${form.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato'} cadastrado com ${pendingItens.length} itens!`);
      }
      setPendingItens([]);
    } else {
      toast.success(`${form.tipo_documento === 'ata_srp' ? 'ATA SRP' : 'Contrato'} cadastrado!`);
    }

    setDialogOpen(false);
    resetForm();
    loadContratos();
  };

  // Excluir vira MARCA: o DELETE em cascata levava itens, aditivos, arquivos e
  // pedidos juntos, sem volta — e engano no primeiro clique era perda
  // definitiva. O registro sai das telas e das contas (os gatilhos da ATA
  // ignoram marcados e devolvem a fatia), mas restaurar é apagar a marca.
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('contratos')
      .update({ excluido_em: new Date().toISOString(), excluido_por: user?.id ?? null } as never)
      .eq('id', id);
    if (error) { toast.error('Não foi possível excluir: ' + error.message); return; }
    toast.success('Enviado à lixeira', { description: 'Restaurável na seção Lixeira, no fim da lista.' });
    if (selectedContrato?.id === id) setSelectedContrato(null);
    setAExcluir(null);
    loadContratos();
  };

  const restaurar = async (id: string) => {
    const { error } = await supabase.from('contratos')
      .update({ excluido_em: null, excluido_por: null } as never)
      .eq('id', id);
    if (error) { toast.error('Não foi possível restaurar: ' + error.message); return; }
    toast.success('Contrato restaurado — a fatia na ATA voltou a contar.');
    loadContratos();
  };

  const excluirDefinitivo = async (c: Contrato) => {
    // O gesto deliberado mora aqui, no segundo passo — não no ícone da lista.
    if (!confirm(`Excluir DEFINITIVAMENTE ${c.numero_contrato}?\n\nItens, aditivos, arquivos e pedidos serão apagados juntos. Esta ação não tem volta.`)) return;
    const { error } = await supabase.from('contratos').delete().eq('id', c.id);
    if (error) { toast.error('Não foi possível excluir: ' + error.message); return; }
    toast.success('Excluído definitivamente');
    loadContratos();
  };

  /**
   * Quem pode excluir: o responsável pelo contrato e o administrador.
   *
   * A lista agora mostra a carteira da equipe a um clique, e a lixeira ficava
   * ativa em contrato alheio — um toque apagava trabalho de outra pessoa, sem
   * confirmação nenhuma. Excluir é irreversível; ver não precisa dar esse poder.
   */
  const podeExcluir = (c: Contrato) => isAdmin || ehMeu(c as never, user?.id);

  const handleImportExtracted = (data: any, opts?: { tipo_estrutura?: 'itens' | 'lotes' }) => {
    const tipoEstrutura = opts?.tipo_estrutura || 'itens';
    const itensNormalizados = Array.isArray(data.itens)
      ? data.itens
          .map((item: any, index: number) => {
            const quantidade = Number(item.quantidade);
            const valorUnitario = Number(item.valor_unitario);
            const valorTotalInformado = Number(item.valor_total);
            const valorTotal = Number.isFinite(valorTotalInformado)
              ? valorTotalInformado
              : (Number.isFinite(quantidade) && Number.isFinite(valorUnitario) ? quantidade * valorUnitario : 0);
            return {
              codigo_item: item.codigo_item || String(index + 1),
              descricao: item.descricao || '',
              quantidade: Number.isFinite(quantidade) ? quantidade : 0,
              unidade: item.unidade || 'UN',
              valor_unitario: Number.isFinite(valorUnitario) ? valorUnitario : 0,
              valor_total: valorTotal,
              numero_lote: tipoEstrutura === 'lotes' ? (item.numero_lote || item.lote || null) : null,
              descricao_lote: tipoEstrutura === 'lotes' ? (item.descricao_lote || null) : null,
            };
          })
          .filter((item: any) => item.descricao.trim().length > 0)
      : [];

    setForm(f => ({
      ...f,
      tipo_estrutura: tipoEstrutura,
      numero_contrato: data.numero_contrato || '',
      objeto: data.objeto || '',
      orgao_contratante: data.orgao_contratante || '',
      valor_global: data.valor_global != null ? String(data.valor_global) : '',
      valor_consumido: '0',
      data_assinatura: data.data_assinatura || '',
      data_inicio: data.data_inicio || '',
      data_fim: data.data_fim || '',
      vigencia_meses: data.vigencia_meses != null ? String(data.vigencia_meses) : '',
      status: 'vigente',
      modalidade: data.modalidade || '',
      uf: data.uf || '',
      municipio: data.municipio || '',
      fiscal_nome: data.fiscal_nome || '',
      fiscal_email: data.fiscal_email || '',
      fiscal_telefone: data.fiscal_telefone || '',
      observacoes: data.observacoes || '',
    }));

    setPendingItens(itensNormalizados);
    if (itensNormalizados.length > 0) {
      const sufixo = tipoEstrutura === 'lotes' ? 'lotes' : 'itens';
      toast.info(`${itensNormalizados.length} ${sufixo} extraídos serão importados ao salvar.`);
    }
    setDialogOpen(true);
  };

  // A vigência deixa de depender da ordem em que a pessoa preencheu. Antes, o
  // fim só nascia se o prazo já estivesse lá quando a data foi digitada — e a
  // extração do PDF traz data, não prazo. Aqui o fim é DERIVADO: muda qualquer
  // das entradas, ele acompanha.
  const vigenciaCalculada = calcularVigencia({
    tipoDocumento: form.tipo_documento,
    dataInicio: form.data_inicio,
    dataAssinatura: form.data_assinatura,
    vigenciaMeses: form.vigencia_meses,
    validadeAtaMeses: form.validade_ata_meses,
  });
  const avisoAta = form.tipo_documento === 'ata_srp'
    ? avisoDeVigenciaAta(vigenciaCalculada.meses)
    : null;

  useEffect(() => {
    if (vigenciaCalculada.dataFim && vigenciaCalculada.dataFim !== form.data_fim) {
      setForm(f => ({ ...f, data_fim: vigenciaCalculada.dataFim! }));
    }
  }, [vigenciaCalculada.dataFim, form.data_fim]);

  // ═══ DETAIL VIEW ═══
  if (selectedContrato) {
    const c = selectedContrato;
    const isAta = c.tipo_documento === 'ata_srp';
    const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
    // O selo gravado envelhece sozinho; a data de fim manda. Ver vigencia.ts.
    const cfg = statusConfig[statusEfetivo(c.status, c.data_fim)] || statusConfig.vigente;
    const ataOrigem = c.ata_srp_id ? contratos.find(x => x.id === c.ata_srp_id) : null;
    return (
      <AppLayout>
        <div className="mb-4">
          {/* Rótulo distinto do Voltar do layout, que fica logo acima: este
              fecha o contrato aberto e devolve à lista; aquele sai da tela. Dois
              "Voltar" iguais lado a lado não deixam escolher. */}
          <Button variant="ghost" size="sm" onClick={() => setSelectedContrato(null)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Todos os contratos
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isAta && <Badge className="bg-muted text-muted-foreground border-border text-xs"><ScrollText className="w-3 h-3 mr-1" />ATA SRP</Badge>}
                <h1 className="text-xl font-bold">{c.numero_contrato}</h1>
                <Badge className={`${cfg.color} text-xs`}>{cfg.label}</Badge>
                {isAta && c.permite_carona && <Badge variant="outline" className="text-xs">Permite carona</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.objeto}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao_contratante}</span>
                {c.uf && <span>{c.uf}{c.municipio ? `/${c.municipio}` : ''}</span>}
                {ataOrigem && (
                  <button
                    onClick={() => setSelectedContrato(ataOrigem)}
                    className="flex items-center gap-1 text-accent hover:underline"
                    title="Abrir ATA SRP de origem"
                  >
                    <ScrollText className="w-3 h-3" />
                    Oriundo da ATA {ataOrigem.numero_ata || ataOrigem.numero_contrato}
                  </button>
                )}
                {/* O caminho de volta ao certame. Diante de uma dúvida sobre
                    cláusula, a resposta está no edital ou no Termo de
                    Referência — e eles vivem na pasta do processo. O vínculo
                    era exibido como texto morto; agora leva lá. */}
                {c.licitacao_id && (() => {
                  const l = licitacoes.find(x => x.id === c.licitacao_id);
                  return l ? (
                    <>
                      <button
                        onClick={() => navigate(`/processo/${c.licitacao_id}`)}
                        className="flex items-center gap-1 text-accent hover:underline"
                        title="Abrir a pasta do processo de origem"
                      >
                        <Link2 className="w-3 h-3" />
                        Processo {l.numero}
                      </button>
                      <button
                        onClick={() => navigate(`/processo/${c.licitacao_id}?aba=anexos`)}
                        className="flex items-center gap-1 text-accent hover:underline"
                        title="Edital, Termo de Referência e demais anexos do certame"
                      >
                        <FileText className="w-3 h-3" />
                        Edital e anexos
                      </button>
                    </>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor Global</p>
              <p className="text-lg font-bold">{formatCurrency(c.valor_global)}</p>
              <Progress value={Math.min(pct, 100)} className="h-1.5 w-40 mt-1" />
              <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% consumido</p>
            </div>
          </div>
        </div>

        {/* key={c.id}: o Tabs é não-controlado e o componente NÃO remonta ao
            trocar de registro — quem vinha da aba "Contratos derivados" da ata
            abria o contrato com a aba interna ainda em "derivados", que não
            existe no contrato: conteúdo em branco, nenhuma aba acesa. A chave
            por identidade remonta e todo registro abre no Dashboard. */}
        <Tabs key={c.id} defaultValue="dashboard" className="space-y-4" onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard"><BarChart3 className="w-3.5 h-3.5 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="itens"><Package className="w-3.5 h-3.5 mr-1" /> Itens/Lotes</TabsTrigger>
            {!isAta && <TabsTrigger value="pedidos"><ShoppingCart className="w-3.5 h-3.5 mr-1" /> Pedidos</TabsTrigger>}
            {isAta && (
              <TabsTrigger value="contratos-derivados">
                <FilePlus2 className="w-3.5 h-3.5 mr-1" /> Contratos derivados
              </TabsTrigger>
            )}
            <TabsTrigger value="contratos-aditivos"><FilePlus2 className="w-3.5 h-3.5 mr-1" /> {isAta ? 'Apostilamentos / Arquivos' : 'Arquivos e Aditivos'}</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><ContratoDashboard contratoId={c.id} /></TabsContent>
          <TabsContent value="itens"><ContratoItens contratoId={c.id} key={activeTab === 'itens' ? 'itens-active' : 'itens'} /></TabsContent>
          {!isAta && <TabsContent value="pedidos"><ContratoPedidos contratoId={c.id} /></TabsContent>}
          {isAta && (
            <TabsContent value="contratos-derivados">
              <ContratosDerivadosList ataId={c.id} contratos={contratos} onSelect={setSelectedContrato} />
            </TabsContent>
          )}
          <TabsContent value="contratos-aditivos">
            <ContratoArquivos
              contratoId={c.id}
              onCadastrarDerivado={isAta ? () => {
                resetForm();
                setForm(f => ({
                  ...f,
                  tipo_documento: 'contrato',
                  ata_srp_id: c.id,
                  orgao_contratante: c.orgao_contratante || '',
                  objeto: c.objeto || '',
                  uf: c.uf || '',
                  municipio: c.municipio || '',
                }));
                setDialogOpen(true);
              } : undefined}
            />
          </TabsContent>
        </Tabs>
      </AppLayout>
    );
  }

  // ═══ LIST VIEW ═══
  // Administrador abre na visão do negócio inteiro; quem opera abre na própria
  // carteira. Nos dois casos o outro recorte fica a um clique de distância.
  const escopo: EscopoResponsavel = escopoFilter ?? (isAdmin ? 'todos' : 'meus');
  // Quem não é administrador lê o responsável, não o escolhe: trocar o vendedor
  // move meta e bonificação de uma pessoa para outra.
  const nomeDoProprio = nomeExibido(
    (membrosEquipe ?? []).find((m) => m.user_id === user?.id) as never,
  );
  const nomeDoVendedor = (c: { vendedor_user_id?: string | null }) => {
    const id = c.vendedor_user_id;
    if (!id) return null;
    const m = (membrosEquipe ?? []).find((x) => x.user_id === id);
    // Id que não bate com nenhum membro da empresa ativa é problema de dado, não
    // um nome — chamá-lo de "Colaborador" escondia o caso atrás de um rótulo
    // plausível, e o contrato seguia sem contar meta para ninguém.
    return m ? nomeExibido(m as never) : 'Vendedor fora da equipe';
  };
  // Os cartões de topo seguem o escopo (senão o total contradiz a lista), mas
  // ignoram busca e status, que são recortes de consulta, não de carteira.
  const doEscopo = noEscopo(contratos as never[], escopo, user?.id) as typeof contratos;
  const ocultosPorEscopo = contratos.length - doEscopo.length;

  const filtered = doEscopo.filter(c => {
    // Contrato derivado mora DENTRO da pasta da ata (aba Contratos derivados):
    // na lista principal ele aparecia como irmão da própria ata, e a hierarquia
    // ATA → contrato → aditivo virava três cartões soltos. A busca por texto
    // continua encontrando-o, para ninguém achar que sumiu.
    const derivado = c.tipo_documento === 'contrato' && !!c.ata_srp_id;
    if (derivado && !search) return false;
    const matchSearch = !search || c.objeto.toLowerCase().includes(search.toLowerCase()) || c.numero_contrato.toLowerCase().includes(search.toLowerCase()) || c.orgao_contratante.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchTipo = tipoFilter === 'all' || c.tipo_documento === tipoFilter;
    return matchSearch && matchStatus && matchTipo;
  });
  const soContratos = doEscopo.filter(c => c.tipo_documento !== 'ata_srp');
  const soAtas = doEscopo.filter(c => c.tipo_documento === 'ata_srp');
  const totalValor = soContratos.reduce((s, c) => s + c.valor_global, 0);
  const totalSaldo = soContratos.reduce((s, c) => s + (c.saldo_remanescente || 0), 0);
  const vencendo = soContratos.filter(c => { if (!c.data_fim) return false; const d = (new Date(c.data_fim).getTime() - Date.now()) / 86400000; return d > 0 && d <= 60; }).length;

  const isAtaForm = form.tipo_documento === 'ata_srp';
  // Dez anos só cabem em serviço contínuo; compra imediata se esgota no ato.
  const avisoVigencia = avisoDeVigencia(form.especie_objeto, parseInt(form.vigencia_meses) || null);


  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Contratos e ATAs SRP</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle ATAs de Registro de Preços, contratos derivados, aditivos, itens e pedidos</p>
        </div>
        <div className="flex gap-2">
          <ImportarContratoPDF
            onExtracted={handleImportExtracted}
            onCadastroManual={() => { resetForm(); setDialogOpen(true); }}
          />
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { resetForm(); setPendingItens([]); setArquivoAssinado(null); } }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Novo</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar {isAtaForm ? 'ATA SRP' : 'Contrato Administrativo'}</DialogTitle></DialogHeader>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <div>
                <Label className="text-xs">Tipo de Documento *</Label>
                <Select value={form.tipo_documento} onValueChange={(v: 'contrato' | 'ata_srp') => setForm(f => ({ ...f, tipo_documento: v, ata_srp_id: v === 'ata_srp' ? '' : f.ata_srp_id }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato Administrativo</SelectItem>
                    <SelectItem value="ata_srp">ATA SRP — Sistema de Registro de Preços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estrutura *</Label>
                <Select value={form.tipo_estrutura} onValueChange={(v: 'itens' | 'lotes') => setForm(f => ({ ...f, tipo_estrutura: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="itens">Itens (individuais)</SelectItem>
                    <SelectItem value="lotes">Lotes (grupos de itens)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* O que cada instrumento é, com o amparo legal — cadastrar ATA
                  como contrato quebra o controle de saldo, porque a ATA não
                  obriga a comprar e o contrato sim. */}
              <div className="md:col-span-2 rounded-lg bg-muted/40 border border-border/60 p-3 space-y-1.5">
                <p className="text-sm font-medium">
                  {INSTRUMENTOS[isAtaForm ? 'ata_srp' : 'contrato'].nome}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {INSTRUMENTOS[isAtaForm ? 'ata_srp' : 'contrato'].amparo}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {INSTRUMENTOS[isAtaForm ? 'ata_srp' : 'contrato'].resumo}
                </p>
                <p className="text-sm text-muted-foreground">
                  {INSTRUMENTOS[isAtaForm ? 'ata_srp' : 'contrato'].papel}
                </p>
                {isAtaForm && (
                  <p className="text-xs text-muted-foreground">{VIGENCIA_ATA.observacao}</p>
                )}
                <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                  Alteração de contrato em execução é <strong>Termo Aditivo</strong>, lançado dentro
                  do próprio contrato — não um cadastro novo. {LIMITES_ADITIVO.observacao}
                </p>
                <p className="text-xs text-muted-foreground">
                  {form.tipo_estrutura === 'lotes'
                    ? 'Modo Lotes: itens agrupados por lote, com controle de pedidos por lote.'
                    : 'Modo Itens: cada item é gerenciado individualmente.'}
                </p>
              </div>

              <div className="md:col-span-2">
                <Label>{isAtaForm ? 'ATA SRP assinada (opcional)' : 'Contrato assinado (opcional)'}</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="mt-1"
                  onChange={(e) => setArquivoAssinado(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Fica guardado na aba Arquivos deste {isAtaForm ? 'registro' : 'contrato'}
                  {form.licitacao_id ? ' e também na pasta Contrato do processo de origem.' : '.'}
                  {' '}Pode ser anexado depois, se ainda não estiver assinado.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label>{isAtaForm ? 'Nº ATA *' : 'Nº Contrato *'}</Label>
                <Input value={form.numero_contrato} onChange={e => setForm(f => ({ ...f, numero_contrato: e.target.value }))} placeholder={isAtaForm ? 'ATA-001/2025' : 'CT-001/2025'} />
                {pareceAtaMasEstaComoContrato && (
                  <p className="text-xs text-warning mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      O número diz “ATA”, mas o tipo está como Contrato. São instrumentos
                      diferentes: a ata segue o Decreto 11.462/2023 (acréscimo vedado, adesão
                      com teto próprio) e o contrato, o art. 125 da Lei 14.133/2021.
                      Se for uma ata, mude o tipo acima.
                    </span>
                  </p>
                )}
              </div>
              <div><Label>Órgão {isAtaForm ? 'Gerenciador' : 'Contratante'} *</Label><Input value={form.orgao_contratante} onChange={e => setForm(f => ({ ...f, orgao_contratante: e.target.value }))} /></div>
              <div>
                <Label>Vendedor responsável</Label>
                {isAdmin ? (
                  <Select
                    value={form.vendedor_user_id || 'nenhum'}
                    onValueChange={(v) => setForm(f => ({ ...f, vendedor_user_id: v === 'nenhum' ? '' : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não atribuído</SelectItem>
                      {(membrosEquipe ?? []).map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m as never)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={nomeDoProprio} disabled className="bg-muted/40" />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Conta o contrato nas metas dessa pessoa e define quem recebe a bonificação.
                </p>
              </div>
              <div className="md:col-span-2"><Label>Objeto *</Label><Textarea value={form.objeto} onChange={e => setForm(f => ({ ...f, objeto: e.target.value }))} rows={2} /></div>

              {isAtaForm && (
                <>
                  <div><Label>Validade da ATA (meses)</Label><Input type="number" value={form.validade_ata_meses} onChange={e => setForm(f => ({ ...f, validade_ata_meses: e.target.value }))} placeholder="12" /></div>
                  <div className="flex items-center gap-3 mt-6">
                    <Switch id="permite-carona" checked={form.permite_carona} onCheckedChange={v => setForm(f => ({ ...f, permite_carona: v }))} />
                    <Label htmlFor="permite-carona" className="text-sm cursor-pointer">Permite carona / adesão</Label>
                  </div>

                  {/* Como esta ATA será executada. Declarar isso é o que permite
                      ao sistema perceber, depois, que uma execução declarada como
                      imediata virou entrega parcelada — caso em que o contrato
                      formal é obrigatório. */}
                  <div className="md:col-span-2">
                    <Label>Forma de execução *</Label>
                    <Select
                      value={form.forma_execucao}
                      onValueChange={(v) => setForm(f => ({
                        ...f, forma_execucao: v,
                        art95_fundamento: v === 'empenho' ? f.art95_fundamento : '',
                      }))}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMAS_EXECUCAO).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {FORMAS_EXECUCAO[form.forma_execucao as keyof typeof FORMAS_EXECUCAO]?.desc}
                    </p>
                  </div>

                  {form.forma_execucao === 'empenho' && (
                    <div className="md:col-span-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
                      <Label>Hipótese que dispensa o contrato *</Label>
                      <Select
                        value={form.art95_fundamento}
                        onValueChange={(v) => setForm(f => ({ ...f, art95_fundamento: v }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione a hipótese do art. 95" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FUNDAMENTOS_ART95).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.art95_fundamento && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {FUNDAMENTOS_ART95[form.art95_fundamento as keyof typeof FUNDAMENTOS_ART95]?.desc}
                        </p>
                      )}
                      <p className="text-xs text-warning mt-2">
                        Fora dessas hipóteses, entrega parcelada ou serviço contínuo exige termo de
                        contrato. {AMPARO_ART95}.
                      </p>
                    </div>
                  )}
                </>
              )}

              {!isAtaForm && atasDisponiveis.length > 0 && (
                <div className="md:col-span-2">
                  <Label>ATA SRP de origem (opcional)</Label>
                  <Select value={form.ata_srp_id || 'none'} onValueChange={v => setForm(f => ({ ...f, ata_srp_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Não vinculado a ATA" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Não vinculado —</SelectItem>
                      {atasDisponiveis.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.numero_ata || a.numero_contrato} — {a.orgao_contratante}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Os itens deste contrato poderão consumir o saldo da ATA selecionada.</p>
                </div>
              )}

              {/* Licitação vinculada */}
              <div className="md:col-span-2">
                <Label>Processo Licitatório de origem (opcional)</Label>
                <div className="space-y-1">
                  <Input
                    placeholder="Buscar por número ou órgão..."
                    value={licitacaoSearch}
                    onChange={e => setLicitacaoSearch(e.target.value)}
                    className="text-xs"
                  />
                  {licitacaoSearch && (
                    <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                      {licitacoes
                        .filter(l => `${l.numero} ${l.orgao} ${l.objeto}`.toLowerCase().includes(licitacaoSearch.toLowerCase()))
                        .slice(0, 6)
                        .map(l => (
                          <button
                            key={l.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 ${form.licitacao_id === l.id ? 'bg-primary/10 font-semibold' : ''}`}
                            onClick={() => { setForm(f => ({ ...f, licitacao_id: l.id })); setLicitacaoSearch(''); }}
                          >
                            <span className="font-medium">{l.numero}</span>
                            <span className="text-muted-foreground ml-1">— {l.orgao}</span>
                            <span className="block text-muted-foreground line-clamp-1">{l.objeto}</span>
                          </button>
                        ))}
                      {licitacoes.filter(l => `${l.numero} ${l.orgao} ${l.objeto}`.toLowerCase().includes(licitacaoSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum processo encontrado</p>
                      )}
                    </div>
                  )}
                  {form.licitacao_id && !licitacaoSearch && (() => {
                    const l = licitacoes.find(x => x.id === form.licitacao_id);
                    return l ? (
                      <div className="flex items-center gap-2 text-xs bg-muted border border-border rounded px-3 py-1.5">
                        <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{l.numero}</span>
                        <span className="text-muted-foreground">— {l.orgao}</span>
                        <button type="button" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setForm(f => ({ ...f, licitacao_id: '' }))}>✕</button>
                      </div>
                    ) : null;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Vincula este contrato ao processo licitatório original para rastreabilidade e sincronização com a precificação.</p>
              </div>

              <div><Label>Valor Global (R$)</Label><Input inputMode="decimal" value={form.valor_global ? formatInputBRL(form.valor_global) : ''} onChange={e => setForm(f => ({ ...f, valor_global: parseBRLInput(e.target.value) }))} placeholder="0,00" /></div>
              <div><Label>Valor Consumido (R$)</Label><Input inputMode="decimal" value={form.valor_consumido ? formatInputBRL(form.valor_consumido) : ''} onChange={e => setForm(f => ({ ...f, valor_consumido: parseBRLInput(e.target.value) }))} placeholder="0,00" /></div>
              {/* O fim NÃO é calculado aqui: ele é derivado de
                  calcularVigencia, acima. Duas fontes escrevendo o mesmo campo
                  faziam o resultado depender da ordem de preenchimento. */}
              <div><Label>Data Assinatura</Label><Input type="date" value={form.data_assinatura} onChange={e => {
                const assinatura = e.target.value;
                const updates: Record<string, string> = { data_assinatura: assinatura };
                // Início no dia seguinte à assinatura é a praxe do cadastro;
                // continua editável pela própria data de início.
                if (assinatura) updates.data_inicio = somarDias(assinatura, 1) ?? '';
                setForm(f => ({ ...f, ...updates }));
              }} /></div>
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} readOnly className="bg-muted/50" /></div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={form.data_fim} readOnly className="bg-muted/50" />
                {vigenciaCalculada.inferido && form.data_fim && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculada com 1 ano de vigência da ARP (Lei 14.133/2021, art. 84).
                    Informe a validade abaixo se o edital previr outro prazo.
                  </p>
                )}
                {avisoAta && <p className="text-xs text-warning mt-1">{avisoAta}</p>}
              </div>
              <div className="md:col-span-2">
                <Label>Espécie do objeto</Label>
                <Select value={form.especie_objeto} onValueChange={v => setForm(f => ({ ...f, especie_objeto: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Define o prazo máximo possível" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESPECIES_OBJETO).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.especie_objeto && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {ESPECIES_OBJETO[form.especie_objeto as keyof typeof ESPECIES_OBJETO].desc}
                    {' · '}
                    {ESPECIES_OBJETO[form.especie_objeto as keyof typeof ESPECIES_OBJETO].amparo}
                  </p>
                )}
                {avisoVigencia && <p className="text-xs text-warning mt-1">{avisoVigencia}</p>}
              </div>
              <div><Label>Vigência (meses)</Label><Input type="number" value={form.vigencia_meses} onChange={e => setForm(f => ({ ...f, vigencia_meses: e.target.value }))} /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="vencendo">Vencendo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem></SelectContent></Select></div>
              <div><Label>Modalidade</Label><Input value={form.modalidade} onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))} placeholder="Pregão Eletrônico" /></div>
              <LocalDoOrgao
                uf={form.uf}
                municipio={form.municipio}
                onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
              />
              <div><Label>Fiscal - Nome</Label><Input value={form.fiscal_nome} onChange={e => setForm(f => ({ ...f, fiscal_nome: e.target.value }))} /></div>
              <div><Label>Fiscal - E-mail</Label><Input value={form.fiscal_email} onChange={e => setForm(f => ({ ...f, fiscal_email: e.target.value }))} /></div>
              <div><Label>Fiscal - Telefone</Label><Input value={form.fiscal_telefone} onChange={e => setForm(f => ({ ...f, fiscal_telefone: e.target.value }))} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            </div>
            {pendingItens.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-muted border border-border">
                <p className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Package className="w-4 h-4" /> {pendingItens.length} itens extraídos do PDF
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Serão cadastrados automaticamente na aba "Itens" ao salvar.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setDialogOpen(false); setPendingItens([]); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Salvar {isAtaForm ? 'ATA' : 'Contrato'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" /> Contratos</div><p className="text-2xl font-bold">{soContratos.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ScrollText className="w-4 h-4" /> ATAs SRP</div><p className="text-2xl font-bold">{soAtas.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" /> Valor Total</div><p className="text-2xl font-bold">{formatCurrency(totalValor)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-4 h-4" /> Saldo Total</div><p className="text-2xl font-bold text-success">{formatCurrency(totalSaldo)}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="w-4 h-4" /> Vencendo 60d</div><p className="text-2xl font-bold text-warning">{vencendo}</p></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar por número, objeto ou órgão..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={tipoFilter} onValueChange={(v: any) => setTipoFilter(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="contrato">Contratos Administrativos</SelectItem>
            <SelectItem value="ata_srp">Apenas ATAs SRP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={escopo} onValueChange={(v) => setEscopoFilter(v as EscopoResponsavel)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="meus">Meus contratos</SelectItem>
            <SelectItem value="todos">Todos da equipe</SelectItem>
            {isAdmin && (membrosEquipe ?? []).map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m as never)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="vigente">Vigente</SelectItem><SelectItem value="vencendo">Vencendo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="suspenso">Suspenso</SelectItem></SelectContent></Select>
      </div>

      {escopo !== 'todos' && ocultosPorEscopo > 0 && (
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          {ocultosPorEscopo} contrato(s) sob responsabilidade de outros colaboradores não
          aparecem neste recorte.{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => setEscopoFilter('todos')}
          >
            Ver todos da equipe
          </button>
        </p>
      )}

      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este contrato?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="text-foreground font-medium">
                  {aExcluir?.orgao_contratante} — n. {aExcluir?.numero_contrato}
                </p>
                <p>{aExcluir?.objeto}</p>
                <p>
                  Vão junto os itens, pedidos, aditivos e arquivos deste contrato, e o valor
                  de {formatCurrency(aExcluir?.valor_global || 0)} sai das metas e da
                  bonificação de quem responde por ele. Não há como desfazer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => aExcluir && handleDelete(aExcluir.id)}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum registro encontrado</p></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const isAta = c.tipo_documento === 'ata_srp';
            const pct = c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : 0;
            const cfg = statusConfig[statusEfetivo(c.status, c.data_fim)] || statusConfig.vigente;
            const Icon = cfg.icon;
            const dias = c.data_fim ? Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / 86400000) : null;
            return (
              <Card key={c.id} className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${isAta ? 'border-l-4 border-l-accent' : ''}`} onClick={() => setSelectedContrato(c)}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* 1º — Órgão/cliente */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold truncate">{c.orgao_contratante}</span>
                    </div>
                    {/* 2º — Número + tipo + badges de status */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isAta
                        ? <span className="text-xs font-medium text-foreground">{rotuloDaAta(c.numero_ata || c.numero_contrato)}</span>
                        : <span className="text-xs font-medium text-foreground">Contrato n. {c.numero_contrato}</span>}
                      <Badge className={`${cfg.color} text-xs`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                      {/* Os derivados moram dentro da pasta da ata; o cartão diz
                          quantos, senão parecem ter sumido da lista. */}
                      {isAta && (() => {
                        const n = doEscopo.filter(x => x.ata_srp_id === c.id && x.tipo_documento === 'contrato').length;
                        return n > 0 ? (
                          <Badge variant="outline" className="text-xs text-info border-info/30">
                            <FilePlus2 className="w-3 h-3 mr-1" />{n} contrato{n > 1 ? 's' : ''} derivado{n > 1 ? 's' : ''}
                          </Badge>
                        ) : null;
                      })()}
                      {dias !== null && dias <= 60 && dias > 0 && <Badge variant="outline" className="text-xs text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" />{dias}d</Badge>}
                      {/* Consumo total não é "saldo baixo" — é fim do contrato.
                          O aviso servia para antecipar o esgotamento; depois
                          dele, dizer que o saldo está baixo descreve o passado
                          e sugere que ainda há o que consumir. */}
                      {!isAta && pct >= 100 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                          Saldo esgotado
                        </Badge>
                      )}
                      {!isAta && pct >= 80 && pct < 100 && (
                        <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                          Saldo baixo
                        </Badge>
                      )}
                      {c.ata_srp_id && <Badge variant="outline" className="text-xs text-muted-foreground border-border">Origem: ATA</Badge>}
                    </div>
                    {/* 3º — Objeto */}
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.objeto}</p>
                    {/* 4º — Data fim */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {c.data_fim && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Até {new Date(c.data_fim).toLocaleDateString('pt-BR')}</span>}
                      {/* Vendedor na própria linha: os contratos existentes foram
                          cadastrados pelo admin e ficaram sem dono, então metas e
                          bonificação não os enxergavam. Aqui se atribui sem abrir o
                          contrato. */}
                      <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <UserIcon className="w-3 h-3" />
                        {isAdmin ? (
                          <Select
                            value={c.vendedor_user_id || 'nenhum'}
                            onValueChange={(v) => atribuirVendedor(c.id, v === 'nenhum' ? null : v)}
                          >
                            <SelectTrigger className="h-6 text-xs border-0 bg-transparent px-1 gap-1 w-auto">
                              <SelectValue placeholder="Sem vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Sem vendedor</SelectItem>
                              {(membrosEquipe ?? []).map((m) => (
                                <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m as never)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{nomeDoVendedor(c) ?? 'Sem vendedor'}</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        {/* Era "Saldo registrado", ao lado de um "Saldo" com outro
                            número: dois saldos diferentes na mesma linha. Este
                            valor é o que já saiu, não o que resta. */}
                        <span>{isAta ? 'Consumido da ata' : 'Consumido'}: {formatCurrency(c.valor_consumido)}</span>
                        <span>Saldo: {formatCurrency(c.saldo_remanescente || 0)}</span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-2" />
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {podeExcluir(c) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Excluir contrato"
                        onClick={(e) => { e.stopPropagation(); setAExcluir(c); }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Lixeira: excluído por engano tem volta ─────────────────────────── */}
      {!loading && excluidos.length > 0 && (
        <Card className="mt-6 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Lixeira</span>
            <Badge variant="outline" className="text-xs">{excluidos.length}</Badge>
            <span className="text-xs text-muted-foreground">
              Fora das telas e dos cálculos — restaurar devolve tudo, inclusive a fatia na ATA.
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {excluidos.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 flex-wrap">
                <span className="text-sm font-medium">
                  {c.tipo_documento === 'ata_srp' ? rotuloDaAta(c.numero_ata || c.numero_contrato) : `Contrato n. ${c.numero_contrato}`}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[280px]">{c.orgao_contratante}</span>
                {c.excluido_em && (
                  <span className="text-xs text-muted-foreground">
                    excluído em {new Date(c.excluido_em).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => restaurar(c.id)}>
                    Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => excluirDefinitivo(c)}>
                    Excluir definitivamente
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AppLayout>
  );
}

// ═══ Contratos derivados de uma ATA SRP ═══
function ContratosDerivadosList({ ataId, contratos, onSelect }: { ataId: string; contratos: Contrato[]; onSelect: (c: Contrato) => void }) {
  const derivados = contratos.filter(c => c.ata_srp_id === ataId && c.tipo_documento === 'contrato');
  const totalConsumido = derivados.reduce((s, c) => s + (c.valor_global || 0), 0);
  // A régua do fracionamento é o REGISTRADO da ata: cada contrato mostra a
  // fatia que tomou dela ("25% da ata"), e o total, quanto da ata já virou
  // contrato. O saldo muda a cada assinatura; o registrado é fixo.
  const ata = contratos.find(c => c.id === ataId);
  const registradoAta = ata?.valor_global || 0;
  const pctDaAta = (v: number) => registradoAta > 0 ? Math.round((v / registradoAta) * 1000) / 10 : null;

  if (derivados.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FilePlus2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum contrato derivado desta ATA ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Ao criar um Contrato Administrativo, vincule-o a esta ATA para que os saldos sejam debitados automaticamente.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-muted/50 border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Contratos derivados</p>
            <p className="text-2xl font-bold">{derivados.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Valor total consumido</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalConsumido)}</p>
            {pctDaAta(totalConsumido) !== null && (
              <p className="text-xs text-muted-foreground">
                {pctDaAta(totalConsumido)!.toLocaleString('pt-BR')}% da ata · saldo {formatCurrency(Math.max(registradoAta - totalConsumido, 0))}
              </p>
            )}
          </div>
        </div>
      </Card>
      <div className="space-y-2">
        {derivados.map(c => (
          <Card key={c.id} className="p-3 hover:shadow-md cursor-pointer" onClick={() => onSelect(c)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{c.numero_contrato}</span>
                  <Badge variant="outline" className="text-xs">{c.status}</Badge>
                  {pctDaAta(c.valor_global || 0) !== null && (
                    <Badge variant="outline" className="text-xs text-info border-info/30">
                      {pctDaAta(c.valor_global || 0)!.toLocaleString('pt-BR')}% da ata
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.objeto}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-sm font-semibold">{formatCurrency(c.valor_global)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
