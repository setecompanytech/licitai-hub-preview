import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useColaboradores } from '@/hooks/useMetasComercial';
import { nomeExibido } from '@/lib/equipe/nomeExibido';
import { usePapelEmpresa } from '@/hooks/usePapelEmpresa';
import { AMPARO_ART95, ESPECIES_OBJETO, FORMAS_EXECUCAO, FUNDAMENTOS_ART95, INSTRUMENTOS, LIMITES_ADITIVO, VIGENCIA_ATA, avisoDeVigencia } from '@/lib/contratos/instrumentos';
import { rotuloDaAta, rotuloDoContrato, rotuloDoDocumento, nomeDoOrgao } from '@/lib/contratos/rotulos';
import { avisoDeVigenciaAta, calcularVigencia, situacaoDaVigencia, somarDias, statusEfetivo } from '@/lib/contratos/vigencia';
import { cn } from '@/lib/utils';
import LocalDoOrgao from '@/components/contratos/LocalDoOrgao';
import { salvarNaPastaDoProcesso } from '@/lib/processo/salvarNaPasta';
import { ehMeu, noEscopo, type EscopoResponsavel } from '@/lib/equipe/escopoProprio';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import TelaGestao, { SecaoGestao } from '@/components/gestao/TelaGestao';
import AbasGestao, { type AbaGestao } from '@/components/gestao/AbasGestao';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import TabelaGestao, { type ColunaGestao } from '@/components/gestao/TabelaGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import SeloSituacao, { ValorIndisponivel, AvisoDeContexto } from '@/components/gestao/SeloSituacao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import ListaDeCampos, { BlocoDoPainel } from '@/components/gestao/ListaDeCampos';
import PainelDoContrato from '@/components/contratos/PainelDoContrato';
import { montarLinhas, type LinhaHierarquica } from '@/components/contratos/hierarquiaAtaDerivados';
import {
  AVISO_BASES_DISTINTAS, EXPLICA_ATA_ENCERRADA, formatarBRL, foiApurado, situacaoDoDocumento,
} from '@/components/contratos/formato';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
  FileText, Plus, Calendar, DollarSign, AlertTriangle,
  CheckCircle2, TrendingUp, Building2, Loader2, Trash2,
  Package, ChevronDown, ChevronRight, FilePlus2, ScrollText, Link2
, User as UserIcon } from 'lucide-react';
import ContratoItens from '@/components/contratos/ContratoItens';
import ContratoPedidos from '@/components/contratos/ContratoPedidos';
import ContratoDashboard from '@/components/contratos/ContratoDashboard';
import ContratoArquivos from '@/components/contratos/ContratoArquivos';

import ImportarContratoPDF from '@/components/contratos/ImportarContratoPDF';

// O formatador de reais e o vocabulário de situação moram em
// `components/contratos/formato.ts`: o painel lateral e o resumo dos derivados
// escrevem os mesmos números, e duas cópias da mesma régua é como o app já
// ganhou dois "saldos" diferentes na mesma linha.
const formatCurrency = formatarBRL;

/**
 * 'AAAA-MM-DD' → 'DD/MM/AAAA', sem passar pelo `Date`.
 *
 * `new Date('2026-03-01')` é meia-noite UTC; no fuso de Belém isso é 28/02, e
 * a tabela mostrava o dia anterior ao que está gravado. Coluna `date` não tem
 * hora — converter para instante só pode errar.
 */
function dataBr(iso: string | null | undefined): string | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function derivadosVigentesDa(ataId: string, todos: Array<{ ata_srp_id?: string | null; tipo_documento?: string | null; status: string; data_fim: string | null }>): number {
  return todos.filter(x =>
    x.ata_srp_id === ataId &&
    x.tipo_documento === 'contrato' &&
    ['vigente', 'vencendo'].includes(statusEfetivo(x.status, x.data_fim)),
  ).length;
}

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

  // ═══ A PASTA DO CONTRATO MORA NA URL ═══
  // ?contrato=<id> diz qual detalhe está aberto. Assim o Voltar comum do
  // layout fecha a pasta como fecha qualquer tela (histórico), o botão
  // "Todos os contratos" duplicado morre, e F5/link compartilhado reabrem o
  // contrato certo — o mesmo padrão do ?lid= das licitações.
  const contratoNaUrl = searchParams.get('contrato');
  useEffect(() => {
    if (!contratoNaUrl) { setSelectedContrato(null); return; }
    setSelectedContrato(prev =>
      contratos.find(x => x.id === contratoNaUrl) ?? (contratos.length ? null : prev));
  }, [contratoNaUrl, contratos]);

  const abrirContrato = (c: Contrato) => {
    const next = new URLSearchParams(searchParams);
    next.set('contrato', c.id);
    next.delete('aba');
    setSearchParams(next);
  };
  const fecharContrato = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('contrato');
    setSearchParams(next, { replace: true });
  };

  // ═══ SELEÇÃO NA LISTA ≠ PASTA ABERTA ═══
  // Selecionar uma linha abre o PAINEL lateral sem tirar a pessoa da lista —
  // a composição que o comando de 13/09 fixa para esta tela. Entrar na pasta
  // continua sendo um gesto explícito, e continua morando em `?contrato=`.
  //
  // A seleção mora em `?sel=` pelo mesmo motivo que a aba mora em `?aba=`:
  // F5 e o voltar do navegador têm de cair onde a pessoa estava. `replace`
  // porque escolher uma linha não é navegar — senão o Voltar teria de desfazer
  // uma seleção de cada vez antes de sair da tela. Fechar a pasta preserva
  // `?sel=`: volta-se à lista com o mesmo registro em foco.
  const selecionadoNaUrl = searchParams.get('sel');
  const selecionar = (c: Contrato) => {
    const next = new URLSearchParams(searchParams);
    next.set('sel', c.id);
    setSearchParams(next, { replace: true });
  };
  const limparSelecao = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('sel');
    setSearchParams(next, { replace: true });
  };

  // As atas nascem ABERTAS: a tela existe para mostrar a relação entre a ata e
  // os contratos que saíram dela, e uma hierarquia que começa toda recolhida
  // reproduz exatamente o que havia antes — a ata sozinha, os derivados
  // invisíveis. Este conjunto guarda só as que a pessoa recolheu.
  const [atasRecolhidas, setAtasRecolhidas] = useState<Set<string>>(new Set());
  const alternarAta = (ataId: string) => {
    setAtasRecolhidas((antes) => {
      const proximo = new Set(antes);
      if (proximo.has(ataId)) proximo.delete(ataId);
      else proximo.add(ataId);
      return proximo;
    });
  };

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
    forma_fornecimento: '',
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
  // A aba do detalhe também mora na URL (&aba=): F5 devolve o usuário à
  // MESMA visão, não à visão-base. 'dashboard' é o padrão e fica fora da URL.
  // O hook `useAbaNaUrl` é exatamente o que esta tela fazia à mão — foi
  // extraído daqui para Compras usar o mesmo comportamento.
  const [abaAtiva, trocarAba] = useAbaNaUrl('dashboard');
  const noCelular = useIsMobile();

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
    forma_execucao: 'contrato_formal', art95_fundamento: '', especie_objeto: '', forma_fornecimento: '',
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
      forma_fornecimento: form.forma_fornecimento || null,
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
    if (selectedContrato?.id === id) fecharContrato();
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
      forma_fornecimento: data.forma_fornecimento === 'unico' || data.forma_fornecimento === 'continuo' ? data.forma_fornecimento : '',
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
    const numeroDoRegistro = isAta ? (c.numero_ata || c.numero_contrato) : c.numero_contrato;
    const valorApurado = foiApurado(c.valor_global);
    const pct = valorApurado && c.valor_global > 0 ? (c.valor_consumido / c.valor_global) * 100 : null;
    // O selo gravado envelhece sozinho; a data de fim manda. Ver vigencia.ts.
    const chaveSituacao = statusEfetivo(c.status, c.data_fim);
    const situacao = situacaoDoDocumento(chaveSituacao);
    const ataOrigem = c.ata_srp_id ? contratos.find(x => x.id === c.ata_srp_id) : null;
    const derivadosDaAta = isAta
      ? contratos.filter(x => x.ata_srp_id === c.id && x.tipo_documento === 'contrato')
      : [];
    const vivos = isAta ? derivadosVigentesDa(c.id, contratos) : 0;
    const processo = c.licitacao_id ? licitacoes.find(x => x.id === c.licitacao_id) : null;

    // Os `value` são contrato firmado com o resto do app (`?aba=`, links
    // externos, o retorno da aba Arquivos): mudam de rótulo, nunca de valor.
    const abas: AbaGestao[] = [
      { valor: 'dashboard', rotulo: 'Resumo' },
      { valor: 'itens', rotulo: 'Itens/Lotes' },
      ...(!isAta ? [{ valor: 'pedidos', rotulo: 'Pedidos' }] : []),
      ...(isAta
        ? [{ valor: 'contratos-derivados', rotulo: 'Contratos derivados', contagem: derivadosDaAta.length }]
        : []),
      {
        valor: 'contratos-aditivos',
        // Na ata o que se registra é apostila e adesão, não termo aditivo —
        // a lei separa os instrumentos (ver lib/contratos/rotulos.ts).
        rotulo: isAta ? 'Apostilamentos / Arquivos' : 'Arquivos e Aditivos',
      },
    ];

    return (
      // A trilha mora na faixa superior; o identificador do registro aberto é o
      // único degrau que o roteador não conhece, e entra por aqui.
      <AppLayout trilhaExtra={[{ rotulo: numeroDoRegistro }]}>
        {/* key={c.id}: o Tabs é não-controlado e o componente NÃO remonta ao
            trocar de registro — quem vinha da aba "Contratos derivados" da ata
            abria o contrato com a aba interna ainda em "derivados", que não
            existe no contrato: conteúdo em branco, nenhuma aba acesa. A chave
            por identidade remonta e todo registro abre no Resumo.
            O Tabs envolve a tela porque `AbasGestao` (a fila sublinhada do
            módulo) e os painéis são irmãos dentro de `TelaGestao`. */}
        <Tabs key={c.id} value={abaAtiva} onValueChange={trocarAba}>
          <TelaGestao
            titulo={rotuloDoDocumento(c.tipo_documento, numeroDoRegistro)}
            // Objeto extenso NÃO ocupa o cabeçalho inteiro: fica em duas linhas
            // com botão real de expansão, como manda o padrão do módulo.
            descricao={<TextoExpansivel texto={c.objeto} linhas={2} />}
            selos={
              <>
                {/* Ata com vigência encerrada rende DOIS selos separados: a
                    vigência acabou (não admite nova contratação) e a execução
                    dos derivados segue. Um selo só fazia a tela negar o outro —
                    foi assim que a ata da SEDUC pareceu morta com um contrato
                    vivo debaixo dela. */}
                {isAta && chaveSituacao === 'encerrado' ? (
                  <>
                    <SeloSituacao tom="neutro" icone={situacao.icone} explicacao={EXPLICA_ATA_ENCERRADA}>
                      Vigência encerrada
                    </SeloSituacao>
                    {vivos > 0 && (
                      <SeloSituacao tom="sucesso" icone={CheckCircle2} explicacao={EXPLICA_ATA_ENCERRADA}>
                        Execução dos derivados ativa — {vivos} contrato{vivos > 1 ? 's' : ''} vigente{vivos > 1 ? 's' : ''}
                      </SeloSituacao>
                    )}
                  </>
                ) : (
                  <SeloSituacao tom={situacao.tom} icone={situacao.icone}>{situacao.rotulo}</SeloSituacao>
                )}
                {isAta && <SeloSituacao tom="neutro" icone={ScrollText}>ATA SRP</SeloSituacao>}
                {isAta && c.permite_carona && <SeloSituacao tom="neutro">Permite carona</SeloSituacao>}
              </>
            }
            contexto={
              <>
                <span className="flex items-center gap-1">
                  <Building2 aria-hidden="true" className="h-3.5 w-3.5" />
                  {nomeDoOrgao(c.orgao_contratante)}
                </span>
                {c.uf && <span>{c.uf}{c.municipio ? `/${c.municipio}` : ''}</span>}
                {/* Valor no cabeçalho em UMA linha, não num cartão: o número
                    grande é do painel do Resumo, aqui ele só identifica. */}
                <span className="tabular-nums">
                  {valorApurado ? (
                    <>
                      {formatCurrency(c.valor_global)}
                      {pct !== null && <> · {pct.toFixed(1).replace('.', ',')}% consumido</>}
                    </>
                  ) : (
                    <ValorIndisponivel razao="Valor global não informado" />
                  )}
                </span>
                {ataOrigem && (
                  <button
                    type="button"
                    onClick={() => abrirContrato(ataOrigem)}
                    className="flex items-center gap-1 text-primary hover:underline"
                    title="Abrir ATA SRP de origem"
                  >
                    <ScrollText aria-hidden="true" className="h-3.5 w-3.5" />
                    Oriundo da ATA {ataOrigem.numero_ata || ataOrigem.numero_contrato}
                  </button>
                )}
                {/* O caminho de volta ao certame. Diante de uma dúvida sobre
                    cláusula, a resposta está no edital ou no Termo de
                    Referência — e eles vivem na pasta do processo. */}
                {processo && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/processo/${c.licitacao_id}`)}
                      className="flex items-center gap-1 text-primary hover:underline"
                      title="Abrir a pasta do processo de origem"
                    >
                      <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Processo {processo.numero}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/processo/${c.licitacao_id}?aba=documentos`)}
                      className="flex items-center gap-1 text-primary hover:underline"
                      title="Edital, Termo de Referência e demais anexos do certame"
                    >
                      <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                      Edital e anexos
                    </button>
                  </>
                )}
              </>
            }
            abas={<AbasGestao abas={abas} valor={abaAtiva} aoMudar={trocarAba} className="nao-imprime" />}
          >
            <TabsContent value="dashboard"><ContratoDashboard contratoId={c.id} /></TabsContent>
            <TabsContent value="itens"><ContratoItens contratoId={c.id} key={abaAtiva === 'itens' ? 'itens-active' : 'itens'} /></TabsContent>
            {!isAta && <TabsContent value="pedidos"><ContratoPedidos contratoId={c.id} /></TabsContent>}
            {isAta && (
              <TabsContent value="contratos-derivados">
                <ContratosDerivadosList ataId={c.id} contratos={contratos} onSelect={abrirContrato} />
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
          </TelaGestao>
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

  // O recorte de CONSULTA — busca, tipo e situação. Quem é mãe e quem é filho
  // na tabela é assunto de `montarLinhas`; aqui só se decide se um registro,
  // sozinho, atende ao que foi pedido.
  const termoBuscado = search.trim().toLowerCase();
  const atende = (c: Contrato) => {
    const matchSearch = !termoBuscado
      || c.objeto.toLowerCase().includes(termoBuscado)
      || c.numero_contrato.toLowerCase().includes(termoBuscado)
      || c.orgao_contratante.toLowerCase().includes(termoBuscado);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchTipo = tipoFilter === 'all' || c.tipo_documento === tipoFilter;
    return matchSearch && matchStatus && matchTipo;
  };

  /**
   * A tabela hierárquica: a ATA é linha-mãe, os contratos derivados dela são
   * linhas indentadas logo abaixo.
   *
   * Antes o derivado era simplesmente escondido da lista, e a relação que a
   * lei cria — a ata REGISTRA preços, o contrato EXECUTA (art. 84) — não
   * aparecia em lugar nenhum da primeira tela. Nada de novo é consultado: a
   * relação já está em `contratos.ata_srp_id`.
   *
   * No celular a hierarquia continua visível (o cartão do filho é indentado e
   * marcado), mas sem o botão de recolher: o cartão inteiro já é um botão, e
   * botão dentro de botão não é HTML válido nem alvo de toque previsível.
   */
  const linhas = montarLinhas(doEscopo, {
    atende,
    aberta: (ataId) => noCelular || !atasRecolhidas.has(ataId),
  });

  const soContratos = doEscopo.filter(c => c.tipo_documento !== 'ata_srp');
  const soAtas = doEscopo.filter(c => c.tipo_documento === 'ata_srp');
  // Σ SEM as atas — a regra dura da tela. O valor registrado na ata é teto
  // estimado de fornecimento; o do contrato derivado é a parte desse teto que
  // virou obrigação. Somar os dois conta o mesmo dinheiro duas vezes.
  const contratosComValor = soContratos.filter(c => foiApurado(c.valor_global));
  const totalValor = contratosComValor.reduce((s, c) => s + c.valor_global, 0);
  const semValorApurado = soContratos.length - contratosComValor.length;
  const contratosComSaldo = soContratos.filter(c => foiApurado(c.saldo_remanescente));
  const totalSaldo = contratosComSaldo.reduce((s, c) => s + c.saldo_remanescente, 0);
  const vencendo = soContratos.filter(c => { if (!c.data_fim) return false; const d = (new Date(c.data_fim).getTime() - Date.now()) / 86400000; return d > 0 && d <= 60; }).length;
  // Contrato que nasceu de uma ATA: agora aparece aninhado sob ela, não some.
  const derivadosDeAta = soContratos.filter(c => !!c.ata_srp_id).length;
  // O risco de dupla contagem só existe quando as duas bases estão na tela.
  const temAtaComDerivado = soAtas.some(a => doEscopo.some(x => x.ata_srp_id === a.id && x.tipo_documento === 'contrato'));

  /**
   * Os indicadores, cada um declarando a própria BASE.
   *
   * O comando de 13/09 exige "identificar a base de cada indicador", e é o que
   * a linha de detalhe faz: sem ela, "R$ 2,4 mi" não diz de que conjunto veio
   * nem se a ata entrou — e a pergunta "isso já inclui as atas?" voltava a
   * cada reunião.
   *
   * Nenhum indicador vira filtro, de propósito. "Vencendo" conta por `data_fim`
   * nos próximos 60 dias, e o filtro de situação conta pelo campo `status`
   * gravado; "Contratos" conta `tipo_documento <> ata_srp`, e o filtro de tipo
   * casa `= contrato`. Os conjuntos não são os mesmos, e um clique que entrega
   * lista diferente do número clicado ensina a pessoa a desconfiar da tela.
   */
  const indicadores: Indicador[] = [
    {
      rotulo: 'Contratos',
      valor: soContratos.length,
      icone: FileText,
      detalhe: derivadosDeAta > 0
        ? `Base: contratos administrativos · ${derivadosDeAta} derivado(s) de ATA`
        : 'Base: contratos administrativos, sem ATAs',
    },
    {
      rotulo: 'ATAs SRP',
      valor: soAtas.length,
      icone: ScrollText,
      detalhe: 'Base: documentos registrados como ATA SRP',
    },
    {
      rotulo: 'Valor total',
      // Nenhum contrato com valor apurado ≠ carteira que soma zero.
      valor: soContratos.length > 0 && contratosComValor.length === 0
        ? null
        : formatCurrency(totalValor),
      razaoIndisponivel: 'Nenhum contrato com valor apurado',
      icone: DollarSign,
      detalhe: semValorApurado > 0
        ? `Base: Σ valor global dos contratos, sem ATAs · ${semValorApurado} sem valor apurado`
        : 'Base: Σ valor global dos contratos, sem ATAs',
    },
    {
      rotulo: 'Saldo remanescente',
      valor: soContratos.length > 0 && contratosComSaldo.length === 0
        ? null
        : formatCurrency(totalSaldo),
      razaoIndisponivel: 'Saldo ainda não apurado',
      icone: TrendingUp,
      tom: 'ok',
      detalhe: totalValor > 0
        ? `Base: Σ saldo dos contratos, sem ATAs · ${Math.round((totalSaldo / totalValor) * 100)}% do valor total`
        : 'Base: Σ saldo dos contratos, sem ATAs',
    },
    {
      rotulo: 'Vencendo em 60 dias',
      valor: vencendo,
      icone: AlertTriangle,
      tom: vencendo > 0 ? 'aviso' : 'neutro',
      detalhe: 'Base: data de fim nos próximos 60 dias — não o campo Situação',
    },
  ];

  const filtrosAplicados =
    (termoBuscado ? 1 : 0)
    + (tipoFilter !== 'all' ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0)
    + (escopoFilter !== null ? 1 : 0);
  const limparFiltros = () => {
    setSearch('');
    setTipoFilter('all');
    setStatusFilter('all');
    setEscopoFilter(null);
  };

  // O registro em foco no painel lateral. Ele vem da lista JÁ carregada — o
  // painel não consulta nada por conta própria.
  const emFoco = selecionadoNaUrl ? doEscopo.find(c => c.id === selecionadoNaUrl) ?? null : null;

  const derivadosDe = (ataId: string) =>
    doEscopo.filter(x => x.ata_srp_id === ataId && x.tipo_documento === 'contrato');

  const abrirNaAba = (c: Contrato, aba: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('contrato', c.id);
    next.set('aba', aba);
    setSearchParams(next);
  };

  const painelDoRegistro = emFoco ? (() => {
    const ehAta = emFoco.tipo_documento === 'ata_srp';
    const ataOrigem = emFoco.ata_srp_id ? contratos.find(x => x.id === emFoco.ata_srp_id) ?? null : null;
    const l = emFoco.licitacao_id ? licitacoes.find(x => x.id === emFoco.licitacao_id) ?? null : null;
    return (
      <PainelDoContrato
        registro={emFoco}
        derivados={ehAta ? derivadosDe(emFoco.id) : []}
        derivadosVigentes={ehAta ? derivadosVigentesDa(emFoco.id, doEscopo) : 0}
        ataDeOrigem={ataOrigem}
        // Atribuir vendedor saiu da linha da tabela e veio para o painel: a
        // coluna "Responsável" não cabia nas oito colunas que o comando fixa, e
        // um seletor dentro de uma linha clicável era alvo de toque duvidoso.
        // A trava continua a mesma — quem não é administrador LÊ o responsável,
        // porque trocá-lo move meta e bonificação de uma pessoa para outra.
        responsavel={isAdmin ? (
          <Select
            value={emFoco.vendedor_user_id || 'nenhum'}
            onValueChange={(v) => atribuirVendedor(emFoco.id, v === 'nenhum' ? null : v)}
          >
            <SelectTrigger className="g-controle" aria-label="Vendedor responsável">
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
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {nomeDoVendedor(emFoco) ?? 'Sem vendedor'}
          </span>
        )}
        aoAbrir={() => abrirContrato(emFoco)}
        aoAbrirNaAba={(aba) => abrirNaAba(emFoco, aba)}
        aoAbrirAtaDeOrigem={ataOrigem ? () => abrirContrato(ataOrigem) : undefined}
        processo={l ? {
          numero: l.numero,
          aoAbrir: () => navigate(`/processo/${l.id}`),
          aoAbrirAnexos: () => navigate(`/processo/${l.id}?aba=documentos`),
        } : null}
      />
    );
  })() : null;

  /**
   * As oito colunas que o comando de 13/09 fixa para esta tela:
   * Número · Objeto · Órgão · Vigência · Execução · Valor · Saldo · Ações.
   *
   * No celular sobrevivem Número, Objeto e Execução (`prioridade: 'sempre'`) —
   * o resto se lê no painel, que é para onde a linha já levava.
   *
   * A tabela NÃO oferece ordenação por coluna, e isto é deliberado: ordenar por
   * valor ou por vigência embaralharia mãe e filho, e a hierarquia ATA →
   * derivado é justamente o que esta lista existe para mostrar. Quem procura
   * um registro específico usa a busca, que atravessa os dois níveis.
   */
  const colunas: ColunaGestao<LinhaHierarquica<Contrato>>[] = [
    {
      chave: 'numero',
      titulo: 'Número',
      prioridade: 'sempre',
      render: (linha) => {
        const c = linha.registro;
        const ehAta = c.tipo_documento === 'ata_srp';
        const rotulo = ehAta
          ? rotuloDaAta(c.numero_ata || c.numero_contrato)
          : rotuloDoContrato(c.numero_contrato);
        const temFilhos = linha.nivel === 0 && linha.derivadosVisiveis > 0;
        return (
          <div className={cn('flex items-start gap-2', linha.nivel === 1 && 'ml-1 border-l-2 border-border pl-3')}>
            {/* O botão de recolher só existe no desktop: no celular a linha
                inteira já é um botão, e botão dentro de botão não é HTML
                válido nem alvo de toque previsível. Lá a ata fica aberta. */}
            {!noCelular && (temFilhos ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); alternarAta(c.id); }}
                aria-expanded={linha.aberta}
                aria-label={linha.aberta
                  ? `Recolher os contratos derivados de ${rotulo}`
                  : `Mostrar os contratos derivados de ${rotulo}`}
                className="mt-0.5 shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {linha.aberta
                  ? <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  : <ChevronRight aria-hidden="true" className="h-4 w-4" />}
              </button>
            ) : (
              <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            ))}
            <div className="flex min-w-0 flex-col gap-1">
              {noCelular ? (
                <span className="font-semibold text-foreground">{rotulo}</span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); abrirContrato(c); }}
                  className="rounded text-left font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {rotulo}
                </button>
              )}
              <span className="flex flex-wrap items-center gap-1.5">
                {ehAta && <Badge variant="muted"><ScrollText aria-hidden="true" className="mr-1 h-3 w-3" />ATA SRP</Badge>}
                {linha.nivel === 0 && linha.derivadosTotal > 0 && (
                  <Badge variant="info">
                    <FilePlus2 aria-hidden="true" className="mr-1 h-3 w-3" />
                    {linha.derivadosVisiveis < linha.derivadosTotal
                      ? `${linha.derivadosVisiveis} de ${linha.derivadosTotal} derivados`
                      : `${linha.derivadosTotal} contrato${linha.derivadosTotal > 1 ? 's' : ''} derivado${linha.derivadosTotal > 1 ? 's' : ''}`}
                  </Badge>
                )}
                {linha.nivel === 1 && <Badge variant="muted">Derivado desta ATA</Badge>}
                {/* Derivado cuja ata não está no recorte: ele sobe de nível em
                    vez de sumir, e diz por quê. */}
                {linha.orfao && <Badge variant="muted">Derivado de ATA fora deste recorte</Badge>}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      chave: 'objeto',
      titulo: 'Objeto',
      prioridade: 'sempre',
      render: (linha) => (noCelular
        ? <span className="line-clamp-2">{linha.registro.objeto}</span>
        : <TextoExpansivel texto={linha.registro.objeto} linhas={2} className="min-w-[13rem] max-w-[46ch]" />),
    },
    {
      chave: 'orgao',
      titulo: 'Órgão',
      prioridade: 'desktop',
      render: (linha) => (
        // `truncate` numa tabela de largura automática não limita nada: o nome
        // fica inteiro numa linha e a coluna toma a largura das outras. Em
        // 14/09/2026 o Órgão chegou a 562 px e empurrou Valor e Saldo para fora
        // da tela. Duas linhas no máximo, com teto de largura; o nome inteiro
        // continua no `title`.
        <span className="flex min-w-[9rem] max-w-[13rem] items-start gap-1.5">
          <Building2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2" title={nomeDoOrgao(linha.registro.orgao_contratante)}>
            {nomeDoOrgao(linha.registro.orgao_contratante)}
          </span>
        </span>
      ),
    },
    {
      chave: 'vigencia',
      titulo: 'Vigência',
      prioridade: 'desktop',
      render: (linha) => {
        const fim = dataBr(linha.registro.data_fim);
        if (!fim) return <ValorIndisponivel razao="Sem data de fim" />;
        const prazo = situacaoDaVigencia(linha.registro.data_fim);
        return (
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
              Até {fim}
            </span>
            {/* Nunca "vence em −375 dias": a frase pronta inverte o sinal. */}
            {prazo.frase && <span className="g-meta text-muted-foreground">{prazo.frase}</span>}
          </span>
        );
      },
    },
    {
      chave: 'execucao',
      titulo: 'Execução',
      prioridade: 'sempre',
      render: (linha) => {
        const c = linha.registro;
        const ehAta = c.tipo_documento === 'ata_srp';
        // O selo gravado envelhece sozinho; a data de fim manda (vigencia.ts).
        const chave = statusEfetivo(c.status, c.data_fim);
        const s = situacaoDoDocumento(chave);
        const vivos = ehAta ? derivadosVigentesDa(c.id, doEscopo) : 0;
        const pct = foiApurado(c.valor_global) && c.valor_global > 0
          ? (c.valor_consumido / c.valor_global) * 100
          : null;
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            {ehAta && chave === 'encerrado' ? (
              <SeloSituacao tom="neutro" icone={s.icone} explicacao={EXPLICA_ATA_ENCERRADA}>
                Vigência encerrada
              </SeloSituacao>
            ) : (
              <SeloSituacao tom={s.tom} icone={s.icone}>{s.rotulo}</SeloSituacao>
            )}
            {/* Ata expirada com derivado vigente: a OPERAÇÃO segue — e é um
                fato separado do fim da vigência, em selo separado. */}
            {ehAta && chave === 'encerrado' && vivos > 0 && (
              <SeloSituacao tom="sucesso" icone={CheckCircle2} explicacao={EXPLICA_ATA_ENCERRADA}>
                Execução dos derivados ativa — {vivos} vigente{vivos > 1 ? 's' : ''}
              </SeloSituacao>
            )}
            {/* Consumo total não é "saldo baixo" — é fim do contrato. O aviso
                servia para antecipar o esgotamento; depois dele, dizer que o
                saldo está baixo descreve o passado. */}
            {!ehAta && pct !== null && pct >= 100 && <SeloSituacao tom="neutro">Saldo esgotado</SeloSituacao>}
            {!ehAta && pct !== null && pct >= 80 && pct < 100 && <SeloSituacao tom="critico">Saldo baixo</SeloSituacao>}
          </span>
        );
      },
    },
    {
      chave: 'valor',
      titulo: 'Valor',
      alinhamento: 'direita',
      prioridade: 'desktop',
      render: (linha) => {
        const c = linha.registro;
        // Valor que ninguém apurou NÃO é R$ 0,00: zero afirmaria que o
        // instrumento não vale nada.
        if (!foiApurado(c.valor_global)) return <ValorIndisponivel razao="Valor não informado" />;
        return (
          <span className="flex flex-col items-end gap-0.5 whitespace-nowrap">
            <span className="font-semibold">{formatCurrency(c.valor_global)}</span>
            {/* A base do número, na própria célula: o da ata é teto estimado;
                o do contrato é obrigação assumida. */}
            <span className="g-meta text-muted-foreground">
              {c.tipo_documento === 'ata_srp' ? 'Registrado na ata' : 'Valor global'}
            </span>
          </span>
        );
      },
    },
    {
      chave: 'saldo',
      titulo: 'Saldo',
      alinhamento: 'direita',
      prioridade: 'desktop',
      render: (linha) => {
        const c = linha.registro;
        if (!foiApurado(c.saldo_remanescente)) return <ValorIndisponivel razao="Saldo não apurado" />;
        const pct = foiApurado(c.valor_global) && c.valor_global > 0
          ? (c.valor_consumido / c.valor_global) * 100
          : null;
        return (
          <span className="flex flex-col items-end gap-1 whitespace-nowrap">
            <span className="font-semibold">{formatCurrency(c.saldo_remanescente)}</span>
            {pct !== null && <Progress value={Math.min(pct, 100)} className="h-1.5 w-24" />}
            <span className="g-meta text-muted-foreground">
              {pct === null ? 'Consumo não apurado' : `${pct.toFixed(0)}% consumido`}
            </span>
          </span>
        );
      },
    },
    {
      chave: 'acoes',
      titulo: <span className="sr-only">Ações</span>,
      alinhamento: 'direita',
      prioridade: 'desktop',
      largura: '3rem',
      render: (linha) => (podeExcluir(linha.registro) ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Excluir ${linha.registro.numero_contrato}`}
          title="Excluir contrato"
          onClick={(e) => { e.stopPropagation(); setAExcluir(linha.registro); }}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
        </Button>
      ) : null),
    },
  ];

  const isAtaForm = form.tipo_documento === 'ata_srp';
  // Dez anos só cabem em serviço contínuo; compra imediata se esgota no ato.
  const avisoVigencia = avisoDeVigencia(form.especie_objeto, parseInt(form.vigencia_meses) || null);


  return (
    <AppLayout>
      {/* O topo é o CabecalhoPagina: título, descrição, ícone e trilha vêm do
          registro (`lib/navegacao/paginas.ts`), e as duas portas de entrada da
          tela ficam nele — importar o PDF do documento assinado e cadastrar à
          mão.

          Os indicadores entram logo abaixo do título, em TIRA BAIXA: nesta tela
          eles são a legenda da tabela que vem a seguir, não o assunto da
          página. Cada um declara a própria base (ver `indicadores`, acima) —
          sem isso, "R$ 2,4 mi" não diz de que conjunto veio nem se a ata
          entrou na conta. */}
      <CabecalhoPagina
          denso
        acoes={
          <>
            <ImportarContratoPDF
              onExtracted={handleImportExtracted}
              onCadastroManual={() => { resetForm(); setDialogOpen(true); }}
            />
            {/* Sem DialogTrigger: o diálogo já é controlado por `dialogOpen`, e
                assim ele fica fora do cabeçalho, com o formulário inteiro. */}
            <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo contrato</Button>
          </>
        }
      >
        <FaixaIndicadores itens={indicadores} />
      </CabecalhoPagina>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { resetForm(); setPendingItens([]); setArquivoAssinado(null); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar {isAtaForm ? 'ATA SRP' : 'Contrato Administrativo'}</DialogTitle></DialogHeader>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted">
              <div>
                <Label>Tipo de Documento *</Label>
                <Select value={form.tipo_documento} onValueChange={(v: 'contrato' | 'ata_srp') => setForm(f => ({ ...f, tipo_documento: v, ata_srp_id: v === 'ata_srp' ? '' : f.ata_srp_id }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato Administrativo</SelectItem>
                    <SelectItem value="ata_srp">ATA SRP — Sistema de Registro de Preços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estrutura *</Label>
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
              <div className="md:col-span-2 rounded-lg bg-card border border-border p-4 space-y-1.5">
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
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
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
                  <p className="text-xs text-warning-ink mt-1 flex items-start gap-1">
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
                  <Input value={nomeDoProprio} disabled className="bg-muted" />
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
                    <div className="md:col-span-2 rounded-lg border border-warning-line bg-warning-tint p-4">
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
                      <p className="text-xs text-warning-ink mt-2">
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
                  />
                  {licitacaoSearch && (
                    <div className="border border-border rounded-md max-h-40 overflow-y-auto divide-y divide-border">
                      {licitacoes
                        .filter(l => `${l.numero} ${l.orgao} ${l.objeto}`.toLowerCase().includes(licitacaoSearch.toLowerCase()))
                        .slice(0, 6)
                        .map(l => (
                          <button
                            key={l.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${form.licitacao_id === l.id ? 'bg-primary-tint font-semibold' : ''}`}
                            onClick={() => { setForm(f => ({ ...f, licitacao_id: l.id })); setLicitacaoSearch(''); }}
                          >
                            <span className="font-medium">{l.numero}</span>
                            <span className="text-muted-foreground ml-1">— {l.orgao}</span>
                            <span className="block text-muted-foreground line-clamp-1">{l.objeto}</span>
                          </button>
                        ))}
                      {licitacoes.filter(l => `${l.numero} ${l.orgao} ${l.objeto}`.toLowerCase().includes(licitacaoSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum processo encontrado</p>
                      )}
                    </div>
                  )}
                  {form.licitacao_id && !licitacaoSearch && (() => {
                    const l = licitacoes.find(x => x.id === form.licitacao_id);
                    return l ? (
                      <div className="flex items-center gap-2 text-sm bg-muted border border-border rounded-md px-3 py-2">
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
              <div><Label>Data Início</Label><Input type="date" value={form.data_inicio} readOnly className="bg-muted" /></div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={form.data_fim} readOnly className="bg-muted" />
                {vigenciaCalculada.inferido && form.data_fim && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculada com 1 ano de vigência da ARP (Lei 14.133/2021, art. 84).
                    Informe a validade abaixo se o edital previr outro prazo.
                  </p>
                )}
                {avisoAta && <p className="text-xs text-warning-ink mt-1">{avisoAta}</p>}
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
                {avisoVigencia && <p className="text-xs text-warning-ink mt-1">{avisoVigencia}</p>}
              </div>
              <div className="md:col-span-2">
                <Label>Forma de fornecimento</Label>
                <Select value={form.forma_fornecimento || 'nao_informado'} onValueChange={v => setForm(f => ({ ...f, forma_fornecimento: v === 'nao_informado' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="O contrato costuma dizer na cláusula de entrega" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">— Não informado —</SelectItem>
                    <SelectItem value="unico">Entrega única (integral)</SelectItem>
                    <SelectItem value="continuo">Fornecimento contínuo / parcelado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.forma_fornecimento === 'unico'
                    ? 'Saldo esgotado será tratado como conclusão do fornecimento — sem alerta de saldo baixo.'
                    : form.forma_fornecimento === 'continuo'
                      ? 'O alerta de saldo baixo protege os próximos pedidos deste contrato.'
                      : 'Se não informado, o painel pergunta quando o saldo se esgotar.'}
                </p>
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

      {/* ── Indicadores → filtros → tabela + painel ───────────────────────
          A composição que o comando de 13/09 fixa para esta tela. A tabela é
          HIERÁRQUICA: a ata é a linha-mãe, os contratos derivados dela são as
          linhas indentadas logo abaixo. Selecionar qualquer uma abre o painel
          de 384px à direita (gaveta abaixo de 1280px) sem tirar a pessoa da
          lista. */}
      <div className="flex min-w-0 flex-col gap-4">
        {/* A regra dura, dita na tela onde ela pode ser violada: os
            indicadores acima somam contratos, a tabela mostra atas e
            derivados, e a tentação de juntar os dois números está a um olhar
            de distância. O aviso só aparece quando as duas bases convivem de
            fato — alerta que aparece sempre vira moldura e some da vista. */}
        {temAtaComDerivado && (
          <AvisoDeContexto titulo={AVISO_BASES_DISTINTAS.titulo}>
            {AVISO_BASES_DISTINTAS.texto}
          </AvisoDeContexto>
        )}

        <BarraFiltros
          busca={search}
          aoBuscar={setSearch}
          placeholderBusca="Buscar por número, objeto ou órgão..."
          filtrosAplicados={filtrosAplicados}
          aoLimpar={limparFiltros}
        >
          <Select value={tipoFilter} onValueChange={(v: 'all' | 'contrato' | 'ata_srp') => setTipoFilter(v)}>
            <SelectTrigger className="g-controle w-[200px]" aria-label="Tipo de documento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="contrato">Contratos Administrativos</SelectItem>
              <SelectItem value="ata_srp">Apenas ATAs SRP</SelectItem>
            </SelectContent>
          </Select>
          <Select value={escopo} onValueChange={(v) => setEscopoFilter(v as EscopoResponsavel)}>
            <SelectTrigger className="g-controle w-[200px]" aria-label="Responsável"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="meus">Meus contratos</SelectItem>
              <SelectItem value="todos">Todos da equipe</SelectItem>
              {isAdmin && (membrosEquipe ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{nomeExibido(m as never)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="g-controle w-[160px]" aria-label="Situação"><SelectValue placeholder="Situação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </BarraFiltros>

        {escopo !== 'todos' && ocultosPorEscopo > 0 && (
          <p className="g-corpo text-muted-foreground">
            {ocultosPorEscopo} contrato(s) sob responsabilidade de outros colaboradores não
            aparecem neste recorte.{' '}
            <button
              type="button"
              className="rounded underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setEscopoFilter('todos')}
            >
              Ver todos da equipe
            </button>
          </p>
        )}

        <AreaComPainel
          tituloPainel="Detalhes do registro"
          aoFechar={limparSelecao}
          painel={painelDoRegistro}
        >
          <TabelaGestao
            descricao="Contratos e ATAs SRP, com os contratos derivados aninhados sob a ata de origem"
            colunas={colunas}
            itens={linhas}
            chaveDoItem={(linha) => linha.registro.id}
            aoSelecionar={(linha) => selecionar(linha.registro)}
            selecionado={(linha) => linha.registro.id === selecionadoNaUrl}
            carregando={loading}
            vazio={
              <EstadoVazio
                icone={<FileText />}
                titulo="Nenhum registro encontrado"
                descricao={filtrosAplicados > 0
                  ? 'Nenhum contrato ou ATA atende a esta busca. Limpe os filtros para ver a carteira inteira.'
                  : 'Cadastre o primeiro contrato ou importe o PDF do documento assinado.'}
                acao={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo contrato</Button>}
              />
            }
            rodape={
              <span>
                {linhas.filter((linha) => linha.nivel === 0).length} instrumento(s) no primeiro nível
                {derivadosDeAta > 0 && ` · ${derivadosDeAta} contrato(s) derivado(s) aninhado(s) sob a ata de origem`}
              </span>
            }
          />
        </AreaComPainel>
      </div>

      {/* ── Lixeira: excluído por engano tem volta ─────────────────────────── */}
      {!loading && excluidos.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Lixeira</h2>
            <Badge variant="muted">{excluidos.length}</Badge>
            <span className="text-sm text-muted-foreground">
              Fora das telas e dos cálculos — restaurar devolve tudo, inclusive a fatia na ATA.
            </span>
          </div>
          <div className="divide-y divide-border">
            {excluidos.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-3 flex-wrap">
                <span className="text-sm font-medium">
                  {rotuloDoDocumento(c.tipo_documento, c.tipo_documento === 'ata_srp' ? (c.numero_ata || c.numero_contrato) : c.numero_contrato)}
                </span>
                <span className="text-sm text-muted-foreground truncate max-w-[280px]" title={nomeDoOrgao(c.orgao_contratante)}>{nomeDoOrgao(c.orgao_contratante)}</span>
                {c.excluido_em && (
                  <span className="text-sm text-muted-foreground">
                    excluído em {new Date(c.excluido_em).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => restaurar(c.id)}>
                    Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => excluirDefinitivo(c)}>
                    Excluir definitivamente
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  );
}

// ═══ Contratos derivados de uma ATA SRP ═══
/**
 * A aba "Contratos derivados", dentro da pasta da ata.
 *
 * Mesma regra dura da lista, no lugar onde ela é mais tentadora: aqui estão,
 * lado a lado, o que a ata REGISTROU e o que os contratos derivados
 * COMPROMETERAM. São bases de cálculo diferentes — o registrado é um teto
 * estimado de fornecimento, o comprometido é obrigação assumida — e por isso
 * aparecem em dois blocos nomeados, com o aviso entre eles.
 *
 * A régua do fracionamento é o REGISTRADO da ata, não o saldo: o saldo muda a
 * cada assinatura, o registrado é fixo, e é contra ele que "25% da ata" quer
 * dizer alguma coisa.
 */
function ContratosDerivadosList({ ataId, contratos, onSelect }: { ataId: string; contratos: Contrato[]; onSelect: (c: Contrato) => void }) {
  const derivados = contratos.filter(c => c.ata_srp_id === ataId && c.tipo_documento === 'contrato');
  const comValor = derivados.filter(c => foiApurado(c.valor_global));
  const totalComprometido = comValor.reduce((s, c) => s + c.valor_global, 0);
  const semValor = derivados.length - comValor.length;

  const ata = contratos.find(c => c.id === ataId);
  const registradoApurado = foiApurado(ata?.valor_global);
  const registradoAta = registradoApurado ? (ata as Contrato).valor_global : 0;
  const pctDaAta = (v: number) => (registradoApurado && registradoAta > 0
    ? Math.round((v / registradoAta) * 1000) / 10
    : null);

  if (derivados.length === 0) {
    return (
      <div className="g-cartao">
        <EstadoVazio
          icone={<FilePlus2 />}
          titulo="Nenhum contrato derivado desta ATA ainda"
          descricao="Ao criar um Contrato Administrativo, vincule-o a esta ATA para que os saldos sejam debitados automaticamente."
        />
      </div>
    );
  }

  const execucaoGlobal = pctDaAta(totalComprometido);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="g-cartao p-4">
          <BlocoDoPainel titulo="Base da ATA">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Valor total estimado',
                  valor: registradoApurado
                    ? formatCurrency(registradoAta)
                    : <ValorIndisponivel razao="Valor não informado no cadastro" />,
                  numerico: true,
                },
                {
                  // Não é zero: é apuração que esta aba não faz. Os itens
                  // vivem em `contrato_itens`, na aba Itens/Lotes.
                  rotulo: 'Total de itens',
                  valor: <ValorIndisponivel razao="Apurado na aba Itens/Lotes" />,
                },
                {
                  rotulo: 'Saldo a contratar',
                  valor: registradoApurado
                    ? formatCurrency(Math.max(registradoAta - totalComprometido, 0))
                    : <ValorIndisponivel razao="Sem valor registrado na ATA" />,
                  numerico: true,
                },
              ]}
            />
            <p className="g-meta text-muted-foreground">
              Base: valor registrado na ata — teto estimado de fornecimento, não obrigação.
            </p>
          </BlocoDoPainel>
        </div>

        <div className="g-cartao p-4">
          <BlocoDoPainel titulo="Valor dos contratos derivados">
            <ListaDeCampos
              campos={[
                {
                  rotulo: 'Valor total',
                  valor: comValor.length === 0
                    ? <ValorIndisponivel razao="Nenhum derivado com valor apurado" />
                    : formatCurrency(totalComprometido),
                  numerico: true,
                },
                { rotulo: 'Quantidade', valor: derivados.length, numerico: true },
                {
                  rotulo: 'Execução global',
                  valor: execucaoGlobal === null
                    ? <ValorIndisponivel razao="Sem valor registrado na ATA" />
                    : (
                      <span className="inline-flex flex-col items-end gap-1">
                        <span>{execucaoGlobal.toLocaleString('pt-BR')}% do registrado</span>
                        <Progress value={Math.min(execucaoGlobal, 100)} className="h-1.5 w-28" />
                      </span>
                    ),
                  numerico: true,
                },
              ]}
            />
            <p className="g-meta text-muted-foreground">
              Base: Σ valor global dos contratos derivados
              {semValor > 0 ? ` · ${semValor} sem valor apurado` : ''}.
            </p>
          </BlocoDoPainel>
        </div>
      </div>

      <AvisoDeContexto titulo={AVISO_BASES_DISTINTAS.titulo}>
        {AVISO_BASES_DISTINTAS.texto}
      </AvisoDeContexto>

      <SecaoGestao titulo="Contratos derivados" contagem={derivados.length}>
        <div className="flex flex-col gap-2">
          {derivados.map(c => {
            // O status gravado envelhece sozinho; a data de fim manda — a MESMA
            // regra da lista, senão a aba diz "vigente" para contrato vencido há
            // um ano e as telas se contradizem.
            const s = situacaoDoDocumento(statusEfetivo(c.status, c.data_fim));
            const fatia = pctDaAta(foiApurado(c.valor_global) ? c.valor_global : 0);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className="g-cartao flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="g-corpo font-semibold text-foreground">{rotuloDoContrato(c.numero_contrato)}</span>
                    <SeloSituacao tom={s.tom} icone={s.icone}>{s.rotulo}</SeloSituacao>
                    {fatia !== null && foiApurado(c.valor_global) && (
                      <Badge variant="info">{fatia.toLocaleString('pt-BR')}% da ata</Badge>
                    )}
                  </span>
                  <span className="g-corpo mt-1 line-clamp-1 block text-muted-foreground" title={c.objeto}>{c.objeto}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="g-meta block text-muted-foreground">Valor</span>
                  <span className="g-corpo block font-semibold tabular-nums">
                    {foiApurado(c.valor_global)
                      ? formatCurrency(c.valor_global)
                      : <ValorIndisponivel razao="Valor não informado" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SecaoGestao>
    </div>
  );
}
