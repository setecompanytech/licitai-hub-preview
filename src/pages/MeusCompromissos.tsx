import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import TelaGestao from '@/components/gestao/TelaGestao';
import AbasGestao, { type AbaGestao } from '@/components/gestao/AbasGestao';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
import BarraFiltros from '@/components/gestao/BarraFiltros';
import TabelaGestao, {
  type ColunaGestao, type OrdenacaoTabela,
} from '@/components/gestao/TabelaGestao';
import AreaComPainel from '@/components/gestao/AreaComPainel';
import ListaDeCampos, { BlocoDoPainel, type Campo } from '@/components/gestao/ListaDeCampos';
import SeloSituacao, { ValorIndisponivel, type TomSituacao } from '@/components/gestao/SeloSituacao';
import TextoExpansivel from '@/components/gestao/TextoExpansivel';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock, Building2, Bell, Mail, MessageSquare, Zap,
  CheckCircle2, XCircle, Trash2, ExternalLink, AlertTriangle,
  Loader2, RefreshCw, ListChecks, Brain, Shield,
  Archive, ArchiveRestore, FolderOpen, BellPlus,
} from 'lucide-react';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import NovaPastaManualDialog, { BotaoNovaPastaManual } from '@/components/gestao/NovaPastaManualDialog';
import { montarPastas, type CompromissoPessoal, type Pasta, type ProcessoDaEmpresa } from '@/lib/processo/pastas';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';
import { padraoDaRota } from '@/lib/navegacao/paginas';
import { useAbaNaUrl } from '@/lib/navegacao/aba-na-url';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

/**
 * ── DE ONDE VEM A LISTA ──────────────────────────────────────────────────
 *
 * Do QUADRO DA EMPRESA (`licitacoes`) com o compromisso pessoal
 * (`processos_interesse`) por cima — a mesma junção da aba Compromissos da
 * Gestão (`lib/processo/pastas.ts`). Até 17/09 esta página lia só a tabela
 * pessoal: "Abrir página completa" saía de 19 pastas na aba e chegava a 2
 * aqui, porque as outras eram de um colega. A pasta é onde o processo é
 * montado; pasta que não aparece é processo fora de alcance.
 *
 * O que continua pessoal — e só existe depois de a pessoa ACOMPANHAR o
 * processo: a decisão de participar, o score da IA e os canais de alerta.
 * Sem compromisso próprio, a linha aparece, abre o processo, arquiva; as
 * ações de decisão esperam o "Acompanhar".
 */

type ExclusaoLog = {
  id: string;
  processo_numero: string | null;
  processo_orgao: string | null;
  processo_objeto: string | null;
  acao: string;
  motivo: string;
  created_at: string;
};

/**
 * DECISÃO DE PARTICIPAÇÃO — vocabulário próprio desta tela, e é de propósito.
 *
 * O princípio 1 do CLAUDE.md proíbe redeclarar status de processo fora de
 * `src/lib/licitacao/status.ts`. Esta lista NÃO é uma segunda cópia daquela:
 * são dois eixos diferentes, em duas tabelas diferentes.
 *
 *   `licitacoes.status`          → andamento do processo NA EMPRESA:
 *                                  Monitorando · Em Análise · Proposta Enviada ·
 *                                  Em Disputa · Vencida · Homologada · Perdida ·
 *                                  Arquivada. É o que o Kanban move e o que os
 *                                  triggers do comercial comparam no banco.
 *
 *   `processos_interesse.status` → decisão PESSOAL de acompanhar aquele edital:
 *                                  interessado · analisando · aprovado ·
 *                                  cadastrado · rejeitado · arquivado.
 *
 * A interseção entre os dois conjuntos é vazia, e passar um pelo
 * `normalizarStatus` do outro produziria "Monitorando" para tudo (é o destino
 * de qualquer valor desconhecido, por desenho daquele arquivo) — ou seja,
 * unificar aqui apagaria a decisão em vez de padronizá-la. Enquanto
 * `processos_interesse` for tabela pessoal com vocabulário próprio, ela
 * mantém a própria lista, e é ESTE comentário que impede a lista de ser
 * confundida com a divergência que o princípio 1 combate.
 *
 * O tom é o do `SeloSituacao`: texto + ícone + cor, nunca só cor.
 */
const DECISOES: Record<string, { label: string; tom: TomSituacao; icone: typeof CheckCircle2 }> = {
  interessado: { label: 'Interessado', tom: 'ativo', icone: ListChecks },
  analisando: { label: 'IA Analisando', tom: 'atencao', icone: Brain },
  aprovado: { label: 'Aprovado', tom: 'sucesso', icone: CheckCircle2 },
  cadastrado: { label: 'Cadastrado', tom: 'neutro', icone: Shield },
  rejeitado: { label: 'Rejeitado', tom: 'critico', icone: XCircle },
  arquivado: { label: 'Arquivado', tom: 'neutro', icone: Archive },
};

/**
 * As abas, na ordem da tela. "Removidos" não é decisão: é o log de exclusões
 * (`processos_exclusao_log`), outra tabela e outra carga — por isso vem depois
 * e à parte, e não sai do mesmo `DECISOES`.
 */
const ABAS: AbaGestao[] = [
  { valor: 'all', rotulo: 'Todos' },
  ...Object.entries(DECISOES).map(([valor, d]) => ({ valor, rotulo: d.label })),
  { valor: 'removidos', rotulo: 'Removidos' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

function Countdown({ targetDate }: { targetDate: string }) {
  const [diff, setDiff] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'danger'>('normal');

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const ms = target.getTime() - now.getTime();
      if (ms <= 0) { setDiff('Encerrado'); setUrgency('danger'); return; }
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      if (days <= 1) setUrgency('danger');
      else if (days <= 3) setUrgency('warning');
      else setUrgency('normal');
      setDiff(days > 0 ? `${days}d ${hours}h` : `${hours}h`);
    };
    calc();
    const i = setInterval(calc, 60000);
    return () => clearInterval(i);
  }, [targetDate]);

  const colors = {
    normal: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive animate-pulse',
  };

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${colors[urgency]}`}>
      <Clock className="h-4 w-4" aria-hidden="true" />
      {diff}
    </span>
  );
}

/** Os três canais de aviso do compromisso, sempre com rótulo acessível. */
function CanaisDeAlerta({ processo }: { processo: Pasta }) {
  // Pasta que a pessoa ainda não acompanha: os avisos de prazo são de quem
  // acompanha — dizer isso evita confiar num aviso que não vai chegar.
  if (processo.semCompromissoProprio) {
    return (
      <span
        className="g-meta text-muted-foreground"
        title="Você ainda não acompanha este processo; os avisos de prazo são de quem acompanha."
      >
        Sem alertas seus
      </span>
    );
  }
  const nenhum = !processo.alerta_sistema && !processo.alerta_email && !processo.alerta_whatsapp;
  if (nenhum) return <span className="g-meta text-muted-foreground">Sem alerta</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {processo.alerta_sistema && <Bell className="h-4 w-4 text-muted-foreground" aria-label="Alerta no sistema" />}
      {processo.alerta_email && <Mail className="h-4 w-4 text-info" aria-label="Alerta por e-mail" />}
      {processo.alerta_whatsapp && <MessageSquare className="h-4 w-4 text-success" aria-label="Alerta por WhatsApp" />}
    </span>
  );
}

/**
 * Chaves de ordenação da tabela. Ordenar é apresentação: a consulta continua
 * saindo do banco por `data_encerramento` crescente, e nada aqui altera filtro,
 * cálculo ou escrita.
 *
 * Sem data de encerramento vai para o fim do crescente (`Infinity`) — "não tem
 * prazo" não é "vence primeiro". Sem score vai para `-1` pelo mesmo motivo, e
 * é só ordenação: na célula o ausente continua sendo `ValorIndisponivel`.
 */
const CHAVE_ORDENACAO: Record<string, (p: Pasta) => string | number> = {
  processo: (p) => (p.numero || '').toLowerCase(),
  orgao: (p) => (p.orgao || '').toLowerCase(),
  decisao: (p) => DECISOES[p.situacao]?.label ?? p.situacao,
  score: (p) => p.ia_score ?? -1,
  prazo: (p) => (p.data_encerramento ? new Date(p.data_encerramento).getTime() : Number.POSITIVE_INFINITY),
};

export default function MeusCompromissos() {
  const { user } = useAuth();
  const { empresas } = useEmpresa();
  const [processos, setProcessos] = useState<Pasta[]>([]);
  const [loading, setLoading] = useState(true);
  // Falha de consulta não vira lista vazia (princípio 3): fica dita na tela.
  const [erro, setErro] = useState<string | null>(null);
  const [acompanhando, setAcompanhando] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('all');
  const [busca, setBusca] = useState('');
  // A aba mora em `?aba=` para o Voltar do navegador e o F5 caírem onde a
  // pessoa estava — antes era `useState` e todo retorno de processo recomeçava
  // em "Todos".
  const [filtroStatus, definirAba] = useAbaNaUrl('all');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTabela>({ chave: 'prazo', direcao: 'asc' });
  const [analisandoIA, setAnalisandoIA] = useState<string | null>(null);
  const [iaResult, setIaResult] = useState<Record<string, string>>({});
  const [arquivando, setArquivando] = useState<string | null>(null);
  const { arquivarProcesso, criarCompromisso } = useLicitacaoIntegration();
  const qc = useQueryClient();
  // Aba "Removidos": o log de exclusões sempre existiu (processos_exclusao_log,
  // com o motivo digitado em cada remoção) — só não tinha tela. Sem esta
  // consulta, remover parecia "sumir sem rastro".
  const [removidos, setRemovidos] = useState<ExclusaoLog[]>([]);
  const [removidosCarregado, setRemovidosCarregado] = useState(false);

  // State for rejection/removal dialog
  const [acaoDialog, setAcaoDialog] = useState<{ tipo: 'rejeitar' | 'remover'; processo: Pasta } | null>(null);
  // Remover sempre foi só o acompanhamento — a licitação em gestão ficava viva e
  // reaparecia depois, parecendo "erro no sistema" (aconteceu duas vezes com os
  // mesmos processos). Default ligado: quem remove quase sempre quer tirar o
  // processo da mesa também; quem não quiser, desmarca.
  const [arquivarJunto, setArquivarJunto] = useState(true);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [executandoAcao, setExecutandoAcao] = useState(false);
  // Pasta manual: processo que não passa pelo Monitoramento (dispensa em
  // sistema estadual). O diálogo fica no nível da página, fora da tabela.
  const [novaPasta, setNovaPasta] = useState(false);

  const carregarRemovidos = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('processos_exclusao_log')
      .select('id, processo_numero, processo_orgao, processo_objeto, acao, motivo, created_at')
      // Só remoções: rejeições têm aba própria ("Rejeitado") e apareciam
      // duplicadas aqui — a aba dizia "Removidos" e mostrava as duas ações.
      .eq('acao', 'remover')
      .order('created_at', { ascending: false })
      .limit(200);
    setRemovidos((data || []) as unknown as ExclusaoLog[]);
    setRemovidosCarregado(true);
  }, [user]);

  const carregarProcessos = useCallback(async () => {
    if (!user) return;
    // Semente da última visita: pinta já e atualiza em silêncio. Também
    // desliga o spinner das recargas por realtime — piscava a tela inteira a
    // cada mudança de linha.
    const semente = qc.getQueryData<Pasta[]>(['pastas-semente', user.id]);
    if (semente && semente.length > 0) { setProcessos(semente); setLoading(false); }
    else setLoading(true);

    // O universo é o do quadro: o RLS já limita `licitacoes` às empresas de
    // que a pessoa é membro, e o filtro "Empresa" da barra escolhe entre elas.
    const [quadro, compromissos] = await Promise.all([
      supabase
        .from('licitacoes')
        .select('id, empresa_id, numero, orgao, objeto, modalidade, ano_compra, valor_estimado, uf, municipio, data_abertura, data_encerramento, portal, url_edital, status, arquivado_em')
        .order('data_encerramento', { ascending: true }),
      supabase
        .from('processos_interesse')
        .select('*')
        .eq('user_id', user.id)
        .order('data_encerramento', { ascending: true }),
    ]);

    const falha = quadro.error || compromissos.error;
    setErro(falha ? (falha.message || 'Não foi possível carregar as pastas.') : null);
    if (quadro.error) { setLoading(false); return; }

    const linhas = montarPastas(
      (quadro.data || []) as ProcessoDaEmpresa[],
      (compromissos.data || []) as CompromissoPessoal[],
    );
    setProcessos(linhas);
    qc.setQueryData(['pastas-semente', user.id], linhas);
    setLoading(false);
  }, [user, qc]);

  useEffect(() => { carregarProcessos(); }, [carregarProcessos]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('processos-interesse')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processos_interesse', filter: `user_id=eq.${user.id}` }, () => {
        carregarProcessos();
      })
      // Duas fontes, um canal: o processo muda no Kanban (status, arquivamento,
      // processo novo) e o compromisso muda aqui — como na aba da Gestão.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitacoes' }, () => {
        carregarProcessos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, carregarProcessos]);

  const handleAprovar = async (p: Pasta) => {
    if (!p.compromissoId) return;
    const { error } = await supabase
      .from('processos_interesse')
      .update({ aprovado_usuario: true, status: 'aprovado' })
      .eq('id', p.compromissoId);
    if (error) { toast.error(error.message || 'Erro ao aprovar o processo.'); return; }
    toast.success('Processo aprovado!');
    carregarProcessos();
  };

  /**
   * Cria o compromisso próprio numa pasta do quadro que a pessoa ainda não
   * acompanha. É idempotente por (usuário, licitação) no hook; depois da
   * recarga a pasta troca de chave (`licitacao:<id>` → id do compromisso), e
   * a seleção segue junto para o painel não fechar no meio do gesto.
   */
  const acompanhar = async (p: Pasta) => {
    if (!p.licitacaoId) return;
    setAcompanhando(p.id);
    try {
      const id = await criarCompromisso({
        numero: p.numero || '',
        orgao: p.orgao || '',
        objeto: p.objeto || '',
        modalidade: p.modalidade || undefined,
        valor_estimado: p.valor_estimado,
        uf: p.uf,
        municipio: p.municipio,
        data_abertura: p.data_abertura,
        data_encerramento: p.data_encerramento,
        portal: p.portal,
        url: p.url,
      }, p.licitacaoId, p.empresa_id);
      if (!id) { toast.error('Não foi possível criar o seu acompanhamento.'); return; }
      toast.success('Agora você acompanha este processo — os avisos de prazo passam a chegar para você.');
      await carregarProcessos();
      setSelecionadoId(id);
    } finally {
      setAcompanhando(null);
    }
  };

  /** Arquivar aqui move o card para "Arquivada" no Kanban quando há vínculo. */
  const handleArquivar = async (p: Pasta) => {
    const restaurar = p.arquivada || p.situacao === 'arquivado';
    setArquivando(p.id);
    try {
      if (p.licitacaoId) {
        const ok = await arquivarProcesso(p.licitacaoId, !restaurar);
        if (!ok) return;
      } else if (p.compromissoId) {
        const { error } = await supabase
          .from('processos_interesse')
          .update({ status: restaurar ? 'interessado' : 'arquivado' })
          .eq('id', p.compromissoId);
        if (error) { toast.error('Erro ao arquivar processo.'); return; }
      }
      toast.success(restaurar ? 'Processo restaurado.' : 'Processo arquivado.');
      carregarProcessos();
    } finally {
      setArquivando(null);
    }
  };

  /** Fechar é sempre pelo mesmo caminho — o "arquivar junto" ficava ligado de
   *  uma remoção para a seguinte quando se saía pelo botão Cancelar. */
  const fecharDialog = () => {
    setAcaoDialog(null);
    setMotivoTexto('');
    setArquivarJunto(true);
  };

  const handleConfirmarAcao = async () => {
    if (!acaoDialog || !user) return;
    if (!motivoTexto.trim()) {
      toast.error('Informe o motivo da ação.');
      return;
    }
    setExecutandoAcao(true);
    const { tipo, processo } = acaoDialog;
    // Rejeitar e remover agem sobre o compromisso próprio; sem ele não há o
    // que rejeitar nem remover (o painel nem oferece os botões).
    if (!processo.compromissoId) return;
    try {
      // Log the action with reason
      await supabase.from('processos_exclusao_log').insert({
        user_id: user.id,
        processo_interesse_id: processo.compromissoId,
        processo_numero: processo.numero,
        processo_orgao: processo.orgao,
        processo_objeto: processo.objeto,
        empresa_id: processo.empresa_id,
        acao: tipo,
        motivo: motivoTexto.trim(),
      });

      if (tipo === 'rejeitar') {
        await supabase.from('processos_interesse').update({ status: 'rejeitado' }).eq('id', processo.compromissoId);
        toast.info('Processo rejeitado.');
      } else {
        await supabase.from('processos_interesse').delete().eq('id', processo.compromissoId);
        if (arquivarJunto && processo.licitacaoId) {
          const ok = await arquivarProcesso(processo.licitacaoId, true);
          toast.success(ok
            ? 'Removido da lista e arquivado na gestão.'
            : 'Removido da lista — mas não foi possível arquivar na gestão.');
        } else {
          toast.success('Processo removido da lista.');
        }
      }
      carregarProcessos();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao executar ação.');
    } finally {
      setExecutandoAcao(false);
      fecharDialog();
    }
  };

  const handleAnaliseIA = async (p: Pasta) => {
    if (!p.compromissoId) return;
    const compromissoId = p.compromissoId;
    setAnalisandoIA(p.id);
    let content = '';
    await streamAIChat({
      messages: [{
        role: 'user',
        content: `Você é um analista técnico de licitações públicas. Elabore um parecer técnico sobre o processo licitatório abaixo, com linguagem formal, objetiva e impessoal, conforme normas da ABNT e a Lei nº 14.133/2021.

REGRAS OBRIGATÓRIAS:
- NÃO utilize emojis, emoticons ou caracteres decorativos em hipótese alguma.
- NÃO faça suposições, hipóteses ou sugestões genéricas. Baseie-se estritamente nos dados fornecidos.
- Utilize numeração arábica sequencial para seções (1., 2., 3., etc.) e alíneas com letras minúsculas (a), b), c)) para subitens.
- Mantenha tom técnico, corporativo e impessoal em todo o documento.
- Utilize terminologia jurídica e técnica adequada à Nova Lei de Licitações.

DADOS DO PROCESSO:
- Número: ${p.numero}
- Órgão: ${p.orgao}
- Objeto: ${p.objeto}
- Modalidade: ${p.modalidade}
- Valor Estimado: ${p.valor_estimado ? formatCurrency(p.valor_estimado) : 'Não informado'}
- UF/Município: ${p.uf || 'Não informado'} / ${p.municipio || 'Não informado'}
- Data de Encerramento: ${p.data_encerramento ? new Date(p.data_encerramento).toLocaleDateString('pt-BR') : 'Não informado'}
- Portal: ${p.portal || 'Não informado'}

ESTRUTURA DO PARECER:
1. Score de Viabilidade (0-100) — fundamentação objetiva baseada nos dados disponíveis
2. Análise de Preços — avaliação do valor estimado com base no objeto e na modalidade
3. Requisitos de Habilitação — exigências documentais previstas na Lei 14.133/2021 para a modalidade informada
4. Estratégia de Participação — orientações técnicas para apresentação de proposta e lances
5. Riscos Identificados — fatores de risco concretos baseados nos dados do processo
6. Cronograma de Ações — linha do tempo sugerida até a data de encerramento

Formate em Markdown com seções numeradas. Não inclua saudações, apresentações pessoais ou referências a si mesmo.`
      }],
      action: 'analise_processo',
      onDelta: (chunk) => {
        content += chunk;
        setIaResult(prev => ({ ...prev, [p.id]: content }));
      },
      onDone: async () => {
        setAnalisandoIA(null);
        // Save recommendation
        const scoreMatch = content.match(/(\d{1,3})\/100|Score.*?(\d{1,3})/i);
        const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : null;
        await supabase.from('processos_interesse').update({
          ia_recomendacao: content,
          ia_score: score,
          status: 'analisando',
        }).eq('id', compromissoId);
      },
      onError: () => {
        setAnalisandoIA(null);
        toast.error('Erro na análise IA.');
      },
    });
  };

  const empresaMap = useMemo(
    () => Object.fromEntries(empresas.map(e => [e.empresa_id, e.empresa.nome_fantasia || e.empresa.razao_social])),
    [empresas],
  );

  const termo = busca.trim().toLowerCase();

  /**
   * Base comum de tabela e indicadores: empresa + busca, SEM a aba.
   *
   * Os cinco números ignoravam `filtroEmpresa` e `filtroStatus` por completo —
   * contavam sobre `processos` cru. Com duas empresas na conta, trocar a
   * empresa mudava a lista inteira e deixava os KPIs parados, dizendo respeito
   * a outro conjunto de processos. Agora empresa e busca valem para os dois.
   *
   * A ABA continua de fora, e por um motivo que o rótulo não conseguiria
   * salvar: "Interessados", "Aprovados" e "Cadastrados" contam estados
   * DIFERENTES da aba aberta. Respeitar a aba zeraria quatro dos cinco a cada
   * clique — o indicador viraria eco do filtro em vez de visão do conjunto.
   * A nota abaixo da faixa declara isso em texto, como manda a regra.
   */
  const baseDosNumeros = useMemo(() => processos.filter(p => {
    if (filtroEmpresa !== 'all' && p.empresa_id !== filtroEmpresa) return false;
    if (termo && !`${p.numero} ${p.orgao} ${p.objeto}`.toLowerCase().includes(termo)) return false;
    return true;
  }), [processos, filtroEmpresa, termo]);

  const filtrados = useMemo(() => baseDosNumeros.filter(p => {
    // Arquivados só aparecem na aba própria — inclusive em "Todos".
    // Regra antiga e silenciosa: quem abria "Todos" não tinha como saber que
    // faltava gente. O rodapé da tabela agora diz quantos ficaram de fora.
    // (`situacao` já é 'arquivado' quando o PROCESSO foi arquivado — o
    // arquivamento vem do quadro, como na aba.)
    if (filtroStatus === 'all') return p.situacao !== 'arquivado';
    return p.situacao === filtroStatus;
  }), [baseDosNumeros, filtroStatus]);

  const ordenados = useMemo(() => {
    const extrair = CHAVE_ORDENACAO[ordenacao.chave];
    if (!extrair) return filtrados;
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = extrair(a);
      const vb = extrair(b);
      if (va === vb) return 0;
      return va > vb ? sinal : -sinal;
    });
  }, [filtrados, ordenacao]);

  const stats = {
    total: baseDosNumeros.filter(p => p.situacao !== 'arquivado').length,
    interessados: baseDosNumeros.filter(p => p.situacao === 'interessado').length,
    aprovados: baseDosNumeros.filter(p => p.situacao === 'aprovado').length,
    cadastrados: baseDosNumeros.filter(p => p.situacao === 'cadastrado').length,
    arquivados: baseDosNumeros.filter(p => p.situacao === 'arquivado').length,
    urgentes: baseDosNumeros.filter(p => {
      if (!p.data_encerramento) return false;
      const diff = new Date(p.data_encerramento).getTime() - Date.now();
      return diff > 0 && diff < 3 * 86400000;
    }).length,
  };

  const trocarAba = useCallback((valor: string) => {
    definirAba(valor);
    // A seleção pertence à lista que estava na tela: mantê-la deixaria o painel
    // aberto sobre um registro que a nova aba não mostra.
    setSelecionadoId(null);
  }, [definirAba]);

  // Carga preguiçosa do log de exclusões: ele não interessa a quem nunca abre a
  // aba. Fica num efeito, e não no clique, porque com a aba na URL dá para cair
  // direto em `?aba=removidos` (link, F5, Voltar) sem passar por clique nenhum —
  // e aí a tabela ficaria em esqueleto para sempre.
  useEffect(() => {
    if (filtroStatus === 'removidos' && !removidosCarregado) carregarRemovidos();
  }, [filtroStatus, removidosCarregado, carregarRemovidos]);

  // Busca em `processos`, não em `filtrados`: aprovar um processo na aba
  // "Interessado" o tira da lista, e fechar o painel no mesmo gesto esconderia
  // o resultado da ação. Remover de verdade (DELETE) some com a linha da fonte,
  // e aí o painel fecha sozinho — que é o correto.
  const selecionado = useMemo(
    () => processos.find(p => p.id === selecionadoId) ?? null,
    [processos, selecionadoId],
  );

  const filtrosAplicados = (filtroEmpresa !== 'all' ? 1 : 0) + (termo ? 1 : 0);

  const alternarOrdenacao = (chave: string) => {
    setOrdenacao(atual => atual.chave === chave
      ? { chave, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
      : { chave, direcao: 'asc' });
  };

  const indicadores: Indicador[] = [
    // Os quatro do funil ficam neutros de propósito: a cor neles era decorativa
    // (azul de "interessado", verde de "aprovado") e disputava atenção com o
    // quinto, que é o único que pede ação hoje.
    { rotulo: 'Total', valor: stats.total, icone: ListChecks, detalhe: 'Sem os arquivados', aoClicar: () => trocarAba('all'), ativo: filtroStatus === 'all' },
    { rotulo: 'Interessados', valor: stats.interessados, icone: Bell, detalhe: 'Aguardando decisão', aoClicar: () => trocarAba('interessado'), ativo: filtroStatus === 'interessado' },
    { rotulo: 'Aprovados', valor: stats.aprovados, icone: CheckCircle2, detalhe: 'Liberados para disputar', aoClicar: () => trocarAba('aprovado'), ativo: filtroStatus === 'aprovado' },
    { rotulo: 'Cadastrados', valor: stats.cadastrados, icone: Building2, detalhe: 'Já viraram processo', aoClicar: () => trocarAba('cadastrado'), ativo: filtroStatus === 'cadastrado' },
    {
      rotulo: 'Encerra em 3 dias',
      valor: stats.urgentes,
      icone: AlertTriangle,
      tom: stats.urgentes > 0 ? 'critico' : 'neutro',
      detalhe: stats.urgentes > 0 ? 'Decida hoje ou perde o prazo' : 'Nenhum prazo apertado',
    },
  ];

  const colunas: ColunaGestao<Pasta>[] = [
    {
      chave: 'processo',
      titulo: 'Processo',
      prioridade: 'sempre',
      ordenavel: true,
      largura: '30%',
      render: (p) => {
        // Identidade padronizada: cada portal grava o número do seu jeito
        // ("P.E. 044", "6", "Pregão Eletrônico SRP Nº 014") — aqui todos leem
        // igual, e o hover preserva a forma original.
        const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade, anoCompra: p.ano_compra });
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className="cursor-help font-semibold text-foreground"
                title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
              >
                {identidade.rotulo}
              </span>
              {identidade.srpNoTexto && <Badge variant="muted">SRP</Badge>}
              {p.auto_cadastro && (
                <Badge variant="muted" className="gap-1">
                  <Zap className="h-3 w-3" aria-hidden="true" /> Auto
                </Badge>
              )}
            </span>
            <span className="g-meta line-clamp-1 text-muted-foreground">{p.objeto}</span>
          </div>
        );
      },
    },
    {
      chave: 'orgao',
      titulo: 'Órgão',
      prioridade: 'desktop',
      ordenavel: true,
      render: (p) => <span className="line-clamp-2">{p.orgao}</span>,
    },
    {
      // Coluna própria: a decisão de participar é escolha de quem acompanha.
      // Misturada com o prazo na mesma linha, como era antes, ninguém sabia se
      // "Interessado" era um estado do edital ou uma resposta da pessoa.
      chave: 'decisao',
      titulo: 'Decisão',
      prioridade: 'sempre',
      ordenavel: true,
      render: (p) => {
        const d = DECISOES[p.situacao] ?? DECISOES.interessado;
        return (
          <SeloSituacao
            tom={d.tom}
            icone={d.icone}
            explicacao={p.semCompromissoProprio
              ? 'Você ainda não acompanha este processo — a decisão é sua quando acompanhar. O andamento na empresa fica no Kanban.'
              : 'Decisão de participação. O andamento do processo na empresa fica no Kanban.'}
          >
            {d.label}
          </SeloSituacao>
        );
      },
    },
    {
      chave: 'score',
      titulo: 'Score IA',
      alinhamento: 'direita',
      prioridade: 'desktop',
      ordenavel: true,
      largura: '9rem',
      // O score sai por regex do parecer em markdown e pode não vir. Ausente é
      // ausente — 0% diria "a IA avaliou e reprovou", que é outra afirmação.
      render: (p) => (p.ia_score == null
        ? <ValorIndisponivel razao="Sem análise" />
        : <span className="font-semibold">{p.ia_score}%</span>),
    },
    {
      // O prazo é do EDITAL, não da decisão — por isso vive numa coluna só dele.
      chave: 'prazo',
      titulo: 'Prazo',
      prioridade: 'sempre',
      ordenavel: true,
      largura: '9rem',
      render: (p) => (p.data_encerramento
        ? <Countdown targetDate={p.data_encerramento} />
        : <ValorIndisponivel razao="Sem encerramento" />),
    },
    {
      chave: 'alertas',
      titulo: 'Alertas',
      prioridade: 'desktop',
      largura: '6rem',
      render: (p) => <CanaisDeAlerta processo={p} />,
    },
    {
      chave: 'acoes',
      titulo: <span className="sr-only">Ações</span>,
      alinhamento: 'direita',
      prioridade: 'desktop',
      largura: '7rem',
      // Só os dois "ir para" ficam na linha; o que muda o registro (aprovar,
      // arquivar, rejeitar, remover, analisar) mora no painel, onde a pessoa vê
      // o que está decidindo. O stopPropagation impede que clicar no link
      // também selecione a linha.
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {p.licitacaoId && (
            <Button asChild size="sm" variant="ghost" title="Abrir o processo na gestão">
              <Link to={`/processo/${p.licitacaoId}`} aria-label={`Abrir o processo ${p.numero} na gestão`}>
                <FolderOpen aria-hidden="true" />
              </Link>
            </Button>
          )}
          {p.url && (
            <Button asChild size="sm" variant="ghost" title="Abrir no portal de origem">
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir o edital ${p.numero} no portal de origem`}
              >
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const colunasRemovidos: ColunaGestao<ExclusaoLog>[] = [
    {
      chave: 'processo',
      titulo: 'Processo',
      prioridade: 'sempre',
      render: (r) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-foreground">{r.processo_numero || 's/ número'}</span>
          {r.processo_objeto && (
            <span className="g-meta line-clamp-1 text-muted-foreground">{r.processo_objeto}</span>
          )}
        </div>
      ),
    },
    {
      chave: 'orgao',
      titulo: 'Órgão',
      prioridade: 'desktop',
      render: (r) => <span className="line-clamp-2">{r.processo_orgao}</span>,
    },
    {
      chave: 'acao',
      titulo: 'Ação',
      prioridade: 'sempre',
      largura: '9rem',
      render: (r) => (
        <SeloSituacao tom={r.acao === 'rejeitar' ? 'critico' : 'neutro'}>
          {r.acao === 'rejeitar' ? 'Rejeitado' : 'Removido'}
        </SeloSituacao>
      ),
    },
    {
      chave: 'motivo',
      titulo: 'Motivo',
      prioridade: 'sempre',
      render: (r) => <span className="line-clamp-2">{r.motivo}</span>,
    },
    {
      chave: 'data',
      titulo: 'Registrado em',
      alinhamento: 'direita',
      prioridade: 'desktop',
      largura: '8rem',
      render: (r) => formatData(r.created_at),
    },
  ];

  const identidadeSelecionada = selecionado
    ? identidadeDoEdital({ numeroCompra: selecionado.numero, modalidade: selecionado.modalidade, anoCompra: selecionado.ano_compra })
    : null;

  const camposDoPainel: Campo[] = selecionado ? [
    { rotulo: 'Órgão', valor: selecionado.orgao, largo: true },
    {
      rotulo: 'Empresa',
      valor: (selecionado.empresa_id && empresaMap[selecionado.empresa_id]) || <ValorIndisponivel razao="Sem empresa vinculada" />,
    },
    {
      rotulo: 'Valor estimado',
      numerico: true,
      valor: selecionado.valor_estimado != null
        ? formatCurrency(selecionado.valor_estimado)
        : <ValorIndisponivel razao="Não publicado" />,
    },
    {
      rotulo: 'Local',
      valor: selecionado.uf
        ? (selecionado.municipio ? `${selecionado.municipio}/${selecionado.uf}` : selecionado.uf)
        : <ValorIndisponivel razao="Não informado" />,
    },
    {
      rotulo: 'Portal',
      valor: selecionado.portal ?? <ValorIndisponivel razao="Não informado" />,
    },
    {
      rotulo: 'Prazo do edital',
      valor: selecionado.data_encerramento
        ? <Countdown targetDate={selecionado.data_encerramento} />
        : <ValorIndisponivel razao="Sem encerramento" />,
    },
    {
      rotulo: 'Score IA',
      numerico: true,
      valor: selecionado.ia_score == null
        ? <ValorIndisponivel razao="Sem análise" />
        : `${selecionado.ia_score}%`,
    },
    {
      rotulo: 'Na sua lista desde',
      numerico: true,
      valor: selecionado.acompanhadaDesde
        ? formatData(selecionado.acompanhadaDesde)
        : <ValorIndisponivel razao="Você ainda não acompanha" />,
    },
  ] : [];

  const analiseVisivel = selecionado
    ? (iaResult[selecionado.id] || selecionado.ia_recomendacao || '')
    : '';

  const painel = selecionado && identidadeSelecionada ? (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 className="g-titulo-secao text-foreground">{identidadeSelecionada.rotulo}</h2>
        {identidadeSelecionada.reescrito && (
          <p className="g-meta text-muted-foreground">
            Como o portal publica: {identidadeSelecionada.bruto}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const d = DECISOES[selecionado.situacao] ?? DECISOES.interessado;
            return <SeloSituacao tom={d.tom} icone={d.icone}>{d.label}</SeloSituacao>;
          })()}
          {identidadeSelecionada.srpNoTexto && <Badge variant="muted">SRP</Badge>}
          {selecionado.auto_cadastro && (
            <Badge variant="muted" className="gap-1">
              <Zap className="h-3 w-3" aria-hidden="true" /> Auto
            </Badge>
          )}
        </div>
      </header>

      <BlocoDoPainel titulo="Objeto">
        <TextoExpansivel texto={selecionado.objeto} linhas={4} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Identificação">
        <ListaDeCampos campos={camposDoPainel} />
      </BlocoDoPainel>

      <BlocoDoPainel titulo="Canais de alerta">
        <div className="flex flex-col gap-1">
          <CanaisDeAlerta processo={selecionado} />
          <p className="g-meta text-muted-foreground">
            {selecionado.semCompromissoProprio
              ? 'Este processo está no quadro da empresa, mas você ainda não o acompanha: os avisos de prazo não chegam para você.'
              : 'Por onde este compromisso avisa quando o prazo se aproxima.'}
          </p>
        </div>
      </BlocoDoPainel>

      {analiseVisivel && (
        <BlocoDoPainel titulo="Análise da IA">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{analiseVisivel}</ReactMarkdown>
          </div>
        </BlocoDoPainel>
      )}

      <BlocoDoPainel titulo="Ações">
        <div className="flex flex-wrap gap-2">
          {selecionado.semCompromissoProprio ? (
            // Sem compromisso próprio não há decisão nem análise para agir:
            // primeiro a pessoa acompanha, depois decide.
            <Button
              size="sm"
              onClick={() => acompanhar(selecionado)}
              disabled={acompanhando === selecionado.id || !selecionado.licitacaoId}
            >
              {acompanhando === selecionado.id
                ? <Loader2 className="animate-spin" aria-hidden="true" />
                : <BellPlus aria-hidden="true" />}
              Acompanhar
            </Button>
          ) : (
            <>
              {selecionado.situacao === 'interessado' && (
                <Button size="sm" variant="outline" onClick={() => handleAnaliseIA(selecionado)} disabled={analisandoIA === selecionado.id}>
                  <Brain aria-hidden="true" />
                  {analisandoIA === selecionado.id ? 'Analisando...' : 'IA Analisar'}
                </Button>
              )}
              {(selecionado.situacao === 'interessado' || selecionado.situacao === 'analisando') && (
                <Button size="sm" onClick={() => handleAprovar(selecionado)}>
                  <CheckCircle2 aria-hidden="true" /> Aprovar
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => handleArquivar(selecionado)}
            disabled={arquivando === selecionado.id}
            title={selecionado.licitacaoId ? 'Sincroniza com o Kanban' : undefined}
          >
            {arquivando === selecionado.id
              ? <Loader2 className="animate-spin" aria-hidden="true" />
              : selecionado.situacao === 'arquivado'
              ? <ArchiveRestore aria-hidden="true" />
              : <Archive aria-hidden="true" />}
            {selecionado.situacao === 'arquivado' ? 'Restaurar' : 'Arquivar'}
          </Button>
          {!selecionado.semCompromissoProprio && selecionado.situacao !== 'rejeitado' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setAcaoDialog({ tipo: 'rejeitar', processo: selecionado })}
            >
              <XCircle aria-hidden="true" /> Rejeitar
            </Button>
          )}
          {!selecionado.semCompromissoProprio && selecionado.situacao !== 'rejeitado' && (
            <Button size="sm" variant="ghost" onClick={() => setAcaoDialog({ tipo: 'remover', processo: selecionado })}>
              <Trash2 aria-hidden="true" /> Remover
            </Button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {selecionado.licitacaoId ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/processo/${selecionado.licitacaoId}`}>
                <FolderOpen aria-hidden="true" /> Abrir processo
              </Link>
            </Button>
          ) : (
            <p className="g-meta text-muted-foreground">
              Ainda sem processo na gestão — aprovar cria o vínculo.
            </p>
          )}
          {selecionado.url && (
            <Button asChild size="sm" variant="outline">
              <a href={selecionado.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" /> Portal de origem
              </a>
            </Button>
          )}
        </div>
      </BlocoDoPainel>
    </div>
  ) : null;

  const pagina = padraoDaRota('/meus-compromissos');

  return (
    <AppLayout>
      {/* Título e descrição saem do registro `lib/navegacao/paginas.ts`, e a
          trilha da faixa superior (`TrilhaDoTopo`) — a tela não repete nenhum
          dos dois. */}
      <TelaGestao
        titulo={pagina?.titulo ?? 'Meus compromissos'}
        descricao={pagina?.descricao}
        acoesSecundarias={
          <Button variant="outline" onClick={carregarProcessos} aria-label="Atualizar lista de compromissos">
            <RefreshCw aria-hidden="true" /> Atualizar
          </Button>
        }
        acaoPrincipal={<BotaoNovaPastaManual variant="default" aoAbrir={() => setNovaPasta(true)} />}
        abas={<AbasGestao abas={ABAS} valor={filtroStatus} aoMudar={trocarAba} />}
      >
        <div className="flex flex-col gap-2">
          <FaixaIndicadores itens={indicadores} />
          {/* Regra 3 do comando, dita em texto: os indicadores seguem empresa e
              busca, e não a aba. Sem esta linha o "Interessados: 4" na aba
              "Aprovado" pareceria erro de contagem. */}
          <p className="g-meta text-muted-foreground">
            Os indicadores seguem o filtro de empresa e a busca. A aba não os altera —
            cada um conta um estado diferente.
          </p>
        </div>

        {erro && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive-line bg-destructive-tint p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive-ink" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm leading-5 text-destructive-ink">
              Lista incompleta — {erro} O que está abaixo pode não ser tudo.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={carregarProcessos}>
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </div>
        )}

        <BarraFiltros
          busca={busca}
          aoBuscar={setBusca}
          placeholderBusca="Buscar por número, órgão ou objeto"
          filtrosAplicados={filtrosAplicados}
          aoLimpar={() => { setFiltroEmpresa('all'); setBusca(''); }}
        >
          <div className="flex w-full flex-col gap-1 md:w-64">
            <Label htmlFor="filtro-empresa" className="g-meta text-muted-foreground">Empresa</Label>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger id="filtro-empresa" className="g-controle rounded-[var(--g-raio)]">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map(e => (
                  <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.empresa.nome_fantasia || e.empresa.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </BarraFiltros>

        {filtroStatus === 'removidos' ? (
          <TabelaGestao
            descricao="Processos removidos da lista de acompanhamento, com o motivo registrado"
            colunas={colunasRemovidos}
            itens={removidos}
            chaveDoItem={(r) => r.id}
            carregando={!removidosCarregado}
            vazio={
              <EstadoVazio
                icone={<Trash2 />}
                titulo="Nenhuma remoção registrada"
                descricao="Quando você rejeitar ou remover um processo, o registro (com o motivo) fica consultável aqui."
              />
            }
            rodape={<span className="tabular-nums">{removidos.length} registro(s)</span>}
          />
        ) : (
          <AreaComPainel
            painel={painel}
            tituloPainel={identidadeSelecionada?.rotulo ?? 'Detalhes do compromisso'}
            aoFechar={() => setSelecionadoId(null)}
          >
            <TabelaGestao
              descricao="Compromissos de acompanhamento de editais"
              colunas={colunas}
              itens={ordenados}
              chaveDoItem={(p) => p.id}
              aoSelecionar={(p) => setSelecionadoId(p.id)}
              selecionado={(p) => p.id === selecionadoId}
              ordenacao={ordenacao}
              aoOrdenar={alternarOrdenacao}
              carregando={loading}
              vazio={
                <EstadoVazio
                  icone={<ListChecks />}
                  titulo="Nenhum processo na gestão"
                  descricao="Inicie um processo no Monitoramento de Editais — a pasta nasce junto, com prazos e alertas. Processo que não passa pelo PNCP (como dispensas em sistemas estaduais) entra por uma pasta manual."
                  acao={
                    <>
                      <Button asChild variant="outline">
                        <Link to="/monitoramento-editais">Ir para Monitoramento</Link>
                      </Button>
                      <BotaoNovaPastaManual rotulo="Criar pasta manual" aoAbrir={() => setNovaPasta(true)} />
                    </>
                  }
                />
              }
              rodape={
                <>
                  <span className="tabular-nums">{ordenados.length} pasta(s)</span>
                  {/* A exclusão dos arquivados em "Todos" era invisível: a aba
                      dizia "Todos" e escondia gente. Agora diz quantos, e onde. */}
                  {filtroStatus === 'all' && (
                    <span>
                      &ldquo;Todos&rdquo; não inclui arquivados
                      {stats.arquivados > 0
                        ? ` — os ${stats.arquivados} arquivados ficam na aba Arquivado.`
                        : ' — eles ficam na aba Arquivado.'}
                    </span>
                  )}
                </>
              }
            />
          </AreaComPainel>
        )}

        {/* Dialog de motivo para Rejeitar/Remover */}
        <NovaPastaManualDialog
          aberto={novaPasta}
          aoFechar={() => setNovaPasta(false)}
          aoCriar={() => { carregarProcessos(); }}
        />

        <Dialog open={!!acaoDialog} onOpenChange={(open) => { if (!open) fecharDialog(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {acaoDialog?.tipo === 'rejeitar' ? 'Rejeitar processo' : 'Remover processo'}
              </DialogTitle>
              <DialogDescription>
                Processo <strong>{acaoDialog ? identidadeDoEdital({ numeroCompra: acaoDialog.processo.numero, modalidade: acaoDialog.processo.modalidade, anoCompra: acaoDialog.processo.ano_compra }).rotulo : ''}</strong> — {acaoDialog?.processo.orgao}
              </DialogDescription>
              {acaoDialog?.tipo === 'remover' && (
                <p className="g-corpo text-muted-foreground">
                  Remover desfaz <strong>o seu acompanhamento</strong> (decisão e alertas).
                  {acaoDialog?.processo.licitacaoId
                    ? ' O processo continua no quadro da empresa e nesta lista — marque abaixo para arquivá-lo junto.'
                    : ' A pasta manual sai da sua lista.'}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="motivo-acao">Motivo *</Label>
                <Textarea
                  id="motivo-acao"
                  value={motivoTexto}
                  onChange={e => setMotivoTexto(e.target.value)}
                  placeholder="Descreva o motivo da rejeição/remoção..."
                  className="min-h-[100px]"
                  maxLength={500}
                  required
                />
                <p className="g-meta text-right text-muted-foreground tabular-nums">{motivoTexto.length}/500</p>
              </div>
              {acaoDialog?.tipo === 'remover' && acaoDialog?.processo.licitacaoId && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="arquivar-junto"
                    checked={arquivarJunto}
                    onCheckedChange={(v) => setArquivarJunto(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="arquivar-junto" className="g-corpo cursor-pointer font-normal">
                    Também arquivar o processo na gestão (sai do Kanban e das listas ativas)
                  </Label>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={fecharDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAcao}
                disabled={executandoAcao || !motivoTexto.trim()}
                variant={acaoDialog?.tipo === 'rejeitar' ? 'destructive' : 'default'}
              >
                {executandoAcao ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {acaoDialog?.tipo === 'rejeitar' ? 'Confirmar Rejeição' : 'Confirmar Remoção'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TelaGestao>
    </AppLayout>
  );
}
