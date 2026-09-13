import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock, Building2, Bell, Mail, MessageSquare, Zap,
  CheckCircle2, XCircle, Trash2, ExternalLink, AlertTriangle,
  Loader2, RefreshCw, ListChecks, Brain, Shield,
  ChevronDown, ChevronUp, Archive, ArchiveRestore,
} from 'lucide-react';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
import { identidadeDoEdital } from '@/lib/licitacao/identidade-edital';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';

type ProcessoInteresse = {
  id: string;
  empresa_id: string;
  numero: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  portal: string | null;
  url: string | null;
  status: string;
  aprovado_usuario: boolean;
  auto_cadastro: boolean;
  preco_validado: boolean;
  alerta_email: boolean;
  alerta_whatsapp: boolean;
  alerta_sistema: boolean;
  ia_recomendacao: string | null;
  ia_score: number | null;
  notas: string | null;
  licitacao_id: string | null;
  created_at: string;
};

type ExclusaoLog = {
  id: string;
  processo_numero: string | null;
  processo_orgao: string | null;
  processo_objeto: string | null;
  acao: string;
  motivo: string;
  created_at: string;
};

/** Variantes semânticas do Badge (identidade 12/09) — status sempre com texto. */
type VarianteBadge = 'success' | 'warning' | 'danger' | 'info' | 'muted';

const statusConfig: Record<string, { label: string; variant: VarianteBadge; icon: typeof CheckCircle2 }> = {
  interessado: { label: 'Interessado', variant: 'info', icon: ListChecks },
  analisando: { label: 'IA Analisando', variant: 'warning', icon: Brain },
  aprovado: { label: 'Aprovado', variant: 'success', icon: CheckCircle2 },
  cadastrado: { label: 'Cadastrado', variant: 'muted', icon: Shield },
  rejeitado: { label: 'Rejeitado', variant: 'danger', icon: XCircle },
  arquivado: { label: 'Arquivado', variant: 'muted', icon: Archive },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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

export default function MeusCompromissos() {
  const { user } = useAuth();
  const { empresas } = useEmpresa();
  const [processos, setProcessos] = useState<ProcessoInteresse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('all');
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const [analisandoIA, setAnalisandoIA] = useState<string | null>(null);
  const [iaResult, setIaResult] = useState<Record<string, string>>({});
  const [arquivando, setArquivando] = useState<string | null>(null);
  const { arquivarProcesso } = useLicitacaoIntegration();
  const qc = useQueryClient();
  // Aba "Removidos": o log de exclusões sempre existiu (processos_exclusao_log,
  // com o motivo digitado em cada remoção) — só não tinha tela. Sem esta
  // consulta, remover parecia "sumir sem rastro".
  const [removidos, setRemovidos] = useState<ExclusaoLog[]>([]);
  const [removidosCarregado, setRemovidosCarregado] = useState(false);

  const carregarRemovidos = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('processos_exclusao_log' as never)
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
    const semente = qc.getQueryData<ProcessoInteresse[]>(['compromissos-semente', user.id]);
    if (semente && semente.length > 0) { setProcessos(semente); setLoading(false); }
    else setLoading(true);
    const { data } = await supabase
      .from('processos_interesse')
      .select('*')
      .eq('user_id', user.id)
      .order('data_encerramento', { ascending: true });
    const linhas = (data || []) as ProcessoInteresse[];
    setProcessos(linhas);
    qc.setQueryData(['compromissos-semente', user.id], linhas);
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, carregarProcessos]);

  const handleAprovar = async (id: string) => {
    await supabase.from('processos_interesse').update({ aprovado_usuario: true, status: 'aprovado' }).eq('id', id);
    toast.success('Processo aprovado!');
    carregarProcessos();
  };

  /** Arquivar aqui move o card para "Arquivada" no Kanban quando há vínculo. */
  const handleArquivar = async (p: ProcessoInteresse) => {
    const restaurar = p.status === 'arquivado';
    setArquivando(p.id);
    try {
      if (p.licitacao_id) {
        const ok = await arquivarProcesso(p.licitacao_id, !restaurar);
        if (!ok) return;
      } else {
        const { error } = await supabase
          .from('processos_interesse')
          .update({ status: restaurar ? 'interessado' : 'arquivado' })
          .eq('id', p.id);
        if (error) { toast.error('Erro ao arquivar processo.'); return; }
      }
      toast.success(restaurar ? 'Processo restaurado.' : 'Processo arquivado.');
      carregarProcessos();
    } finally {
      setArquivando(null);
    }
  };

  // State for rejection/removal dialog
  const [acaoDialog, setAcaoDialog] = useState<{ tipo: 'rejeitar' | 'remover'; processo: ProcessoInteresse } | null>(null);
  // Remover sempre foi só o acompanhamento — a licitação em gestão ficava viva e
  // reaparecia depois, parecendo "erro no sistema" (aconteceu duas vezes com os
  // mesmos processos). Default ligado: quem remove quase sempre quer tirar o
  // processo da mesa também; quem não quiser, desmarca.
  const [arquivarJunto, setArquivarJunto] = useState(true);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [executandoAcao, setExecutandoAcao] = useState(false);

  const handleConfirmarAcao = async () => {
    if (!acaoDialog || !user) return;
    if (!motivoTexto.trim()) {
      toast.error('Informe o motivo da ação.');
      return;
    }
    setExecutandoAcao(true);
    const { tipo, processo } = acaoDialog;
    try {
      // Log the action with reason
      await supabase.from('processos_exclusao_log' as any).insert({
        user_id: user.id,
        processo_interesse_id: processo.id,
        processo_numero: processo.numero,
        processo_orgao: processo.orgao,
        processo_objeto: processo.objeto,
        empresa_id: processo.empresa_id,
        acao: tipo,
        motivo: motivoTexto.trim(),
      });

      if (tipo === 'rejeitar') {
        await supabase.from('processos_interesse').update({ status: 'rejeitado' }).eq('id', processo.id);
        toast.info('Processo rejeitado.');
      } else {
        await supabase.from('processos_interesse').delete().eq('id', processo.id);
        if (arquivarJunto && processo.licitacao_id) {
          const ok = await arquivarProcesso(processo.licitacao_id, true);
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
      setAcaoDialog(null);
      setMotivoTexto('');
    }
  };

  const [expandedAnalise, setExpandedAnalise] = useState<Record<string, boolean>>({});

  const handleAnaliseIA = async (p: ProcessoInteresse) => {
    setAnalisandoIA(p.id);
    setExpandedAnalise(prev => ({ ...prev, [p.id]: true }));
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
        }).eq('id', p.id);
      },
      onError: () => {
        setAnalisandoIA(null);
        toast.error('Erro na análise IA.');
      },
    });
  };

  const empresaMap = Object.fromEntries(empresas.map(e => [e.empresa_id, e.empresa.nome_fantasia || e.empresa.razao_social]));

  const filtered = processos.filter(p => {
    if (filtroEmpresa !== 'all' && p.empresa_id !== filtroEmpresa) return false;
    // Arquivados só aparecem na aba própria — inclusive em "Todos"
    if (filtroStatus === 'all') return p.status !== 'arquivado';
    return p.status === filtroStatus;
  });

  const stats = {
    total: processos.filter(p => p.status !== 'arquivado').length,
    interessados: processos.filter(p => p.status === 'interessado').length,
    aprovados: processos.filter(p => p.status === 'aprovado').length,
    cadastrados: processos.filter(p => p.status === 'cadastrado').length,
    urgentes: processos.filter(p => {
      if (!p.data_encerramento) return false;
      const diff = new Date(p.data_encerramento).getTime() - Date.now();
      return diff > 0 && diff < 3 * 86400000;
    }).length,
  };

  return (
    <AppLayout>
      {/* Título, descrição, ícone e trilha saem do registro
          `lib/navegacao/paginas.ts` pela rota — nada de texto repetido aqui.
          A fila de filtros mora DENTRO do cabeçalho, logo abaixo do título,
          como na galeria: por isso o Tabs envolve o cabeçalho (o Radix exige
          a lista sob a mesma raiz). O valor continua em `filtroStatus`, e a
          carga preguiçosa de "Removidos" segue no mesmo lugar. */}
      <Tabs
        value={filtroStatus}
        onValueChange={(v) => { setFiltroStatus(v); if (v === 'removidos' && !removidosCarregado) carregarRemovidos(); }}
      >
        <CabecalhoPagina
          acoes={
            <Button variant="outline" onClick={carregarProcessos} aria-label="Atualizar lista de compromissos">
              <RefreshCw aria-hidden="true" /> Atualizar
            </Button>
          }
          filtros={
            <div className="flex w-full flex-col gap-1 sm:w-64">
              <Label htmlFor="filtro-empresa" className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger id="filtro-empresa">
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
          }
        >
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key}>{cfg.label}</TabsTrigger>
            ))}
            <TabsTrigger value="removidos">Removidos</TabsTrigger>
          </TabsList>
        </CabecalhoPagina>
      </Tabs>

      <div className="space-y-6">
        {/* REBRAND — a anatomia `kpi-meta`, a mesma dos Contratos: rótulo e
            ícone em cima, valor grande alinhado à esquerda, e uma NOTA embaixo.

            Antes eram cinco números centralizados com um rótulo de 12px. Número
            centralizado sem contexto é placar, não painel: "3" não diz se é
            muito, se é bom, nem o que fazer com isso.

            Os quatro primeiros são estados do funil e ficam neutros — a cor
            neles era decorativa (azul para "interessado", verde para
            "aprovado") e competia com o quinto, que é o único que pede ação
            hoje. "Encerra em menos de 3 dias" acende inteiro quando há o que
            olhar, e fica quieto quando não há. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {([
            { rot: 'Total', val: stats.total, ic: ListChecks, nota: 'Sem os arquivados' },
            { rot: 'Interessados', val: stats.interessados, ic: Bell, nota: 'Aguardando decisão' },
            { rot: 'Aprovados', val: stats.aprovados, ic: CheckCircle2, nota: 'Liberados para disputar' },
            { rot: 'Cadastrados', val: stats.cadastrados, ic: Building2, nota: 'Já viraram processo' },
          ] as const).map(({ rot, val, ic: Icone, nota }) => (
            <Card key={rot} className="min-w-0 p-6">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground">{rot}</span>
                <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-[2rem] font-bold leading-10 tabular-nums">{val}</p>
              <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
            </Card>
          ))}

          <Card className={`min-w-0 p-6 ${stats.urgentes > 0 ? 'border-destructive-line bg-destructive-tint' : ''}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className={`text-xs ${stats.urgentes > 0 ? 'text-destructive-ink' : 'text-muted-foreground'}`}>
                Encerra em 3 dias
              </span>
              <AlertTriangle
                className={`h-4 w-4 shrink-0 ${stats.urgentes > 0 ? 'text-destructive-ink' : 'text-muted-foreground'}`}
                aria-hidden="true"
              />
            </div>
            <p className={`text-[2rem] font-bold leading-10 tabular-nums ${stats.urgentes > 0 ? 'text-destructive-ink' : ''}`}>
              {stats.urgentes}
            </p>
            <p className={`mt-1 text-xs ${stats.urgentes > 0 ? 'text-destructive-ink' : 'text-muted-foreground'}`}>
              {stats.urgentes > 0 ? 'Decida hoje ou perde o prazo' : 'Nenhum prazo apertado'}
            </p>
          </Card>
        </div>

        {/* List */}
        {filtroStatus === 'removidos' ? (
          removidos.length === 0 ? (
            <Card>
              <EstadoVazio
                icone={<Trash2 />}
                titulo="Nenhuma remoção registrada"
                descricao="Quando você rejeitar ou remover um processo, o registro (com o motivo) fica consultável aqui."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {removidos.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={r.acao === 'rejeitar' ? 'danger' : 'muted'}>
                          {r.acao === 'rejeitar' ? 'Rejeitado' : 'Removido'}
                        </Badge>
                        <span className="font-semibold">{r.processo_numero || 's/ número'}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{r.processo_orgao}</p>
                      {r.processo_objeto && (
                        <p className="max-w-2xl truncate text-sm text-muted-foreground">{r.processo_objeto}</p>
                      )}
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">Motivo:</span> {r.motivo}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">Carregando compromissos…</span>
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <EstadoVazio
              icone={<ListChecks />}
              titulo="Nenhum processo na lista"
              descricao="Marque interesse em editais no Monitoramento para adicioná-los aqui."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const cfg = statusConfig[p.status] || statusConfig.interessado;
              const StatusIcon = cfg.icon;
              // Identidade padronizada: cada portal grava o número do seu
              // jeito ("P.E. 044", "6", "Pregão Eletrônico SRP Nº 014") —
              // aqui todos leem igual, e o hover preserva a forma original.
              const identidade = identidadeDoEdital({ numeroCompra: p.numero, modalidade: p.modalidade });
              return (
                <Card key={p.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cfg.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" aria-hidden="true" />
                          {cfg.label}
                        </Badge>
                        <span
                          className="cursor-help text-sm font-semibold"
                          title={identidade.reescrito ? `Como o portal publica: ${identidade.bruto}` : undefined}
                        >
                          {identidade.rotulo}
                        </span>
                        {identidade.srpNoTexto && (
                          <Badge variant="muted">SRP</Badge>
                        )}
                        {p.data_encerramento && <Countdown targetDate={p.data_encerramento} />}
                        {p.auto_cadastro && (
                          <Badge variant="muted" className="gap-1">
                            <Zap className="h-3 w-3" aria-hidden="true" /> Auto
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{p.orgao}</p>
                      <p className="mt-0.5 text-base text-muted-foreground line-clamp-2">{p.objeto}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" aria-hidden="true" />
                          {empresaMap[p.empresa_id] || 'Empresa'}
                        </span>
                        {p.valor_estimado && <span className="tabular-nums">{formatCurrency(p.valor_estimado)}</span>}
                        {p.uf && <span>{p.municipio ? `${p.municipio}/${p.uf}` : p.uf}</span>}
                        {p.portal && <span>{p.portal}</span>}
                        <span className="flex items-center gap-1">
                          {p.alerta_sistema && <Bell className="h-4 w-4 text-muted-foreground" aria-label="Alerta no sistema" />}
                          {p.alerta_email && <Mail className="h-4 w-4 text-info" aria-label="Alerta por e-mail" />}
                          {p.alerta_whatsapp && <MessageSquare className="h-4 w-4 text-success" aria-label="Alerta por WhatsApp" />}
                        </span>
                      </div>
                      {p.ia_score != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Score IA:</span>
                          <Progress value={p.ia_score} className="h-2 w-24" aria-label={`Score IA ${p.ia_score}%`} />
                          <span className="text-xs font-bold tabular-nums">{p.ia_score}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* As ações moram numa LINHA no rodapé: empilhadas à direita,
                      seis botões ditavam a altura do cartão e o conteúdo curto
                      deixava um vazio enorme embaixo (apontado em 12/09). */}
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                      {p.status === 'interessado' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleAnaliseIA(p)} disabled={analisandoIA === p.id}>
                            <Brain aria-hidden="true" />
                            {analisandoIA === p.id ? 'Analisando...' : 'IA Analisar'}
                          </Button>
                          <Button size="sm" onClick={() => handleAprovar(p.id)}>
                            <CheckCircle2 aria-hidden="true" /> Aprovar
                          </Button>
                        </>
                      )}
                      {p.status === 'analisando' && (
                        <Button size="sm" onClick={() => handleAprovar(p.id)}>
                          <CheckCircle2 aria-hidden="true" /> Aprovar
                        </Button>
                      )}
                      {p.status !== 'rejeitado' && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setAcaoDialog({ tipo: 'rejeitar', processo: p })}>
                          <XCircle aria-hidden="true" /> Rejeitar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => handleArquivar(p)}
                        disabled={arquivando === p.id}
                        title={p.licitacao_id ? 'Sincroniza com o Kanban' : undefined}
                      >
                        {arquivando === p.id
                          ? <Loader2 className="animate-spin" aria-hidden="true" />
                          : p.status === 'arquivado'
                          ? <ArchiveRestore aria-hidden="true" />
                          : <Archive aria-hidden="true" />}
                        {p.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                      </Button>
                      {p.status !== 'rejeitado' && (
                        <Button size="sm" variant="ghost" onClick={() => setAcaoDialog({ tipo: 'remover', processo: p })}>
                          <Trash2 aria-hidden="true" /> Remover
                        </Button>
                      )}
                      {p.url && (
                        <Button size="sm" variant="outline" asChild title="Abrir no portal de origem">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir no portal de origem">
                            <ExternalLink aria-hidden="true" />
                          </a>
                        </Button>
                      )}
                  </div>

                  {/* IA Analysis result */}
                  {(iaResult[p.id] || p.ia_recomendacao) && (
                    <div className="rounded-lg border border-border bg-muted text-base">
                      <button
                        type="button"
                        aria-expanded={!!expandedAnalise[p.id]}
                        className="flex w-full items-center gap-2 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => setExpandedAnalise(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      >
                        <Brain className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="flex-1 text-sm font-semibold text-foreground">Análise da IA</span>
                        {expandedAnalise[p.id] ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                      </button>
                      {expandedAnalise[p.id] && (
                        <div className="prose max-w-none px-3 pb-3 dark:prose-invert">
                          <ReactMarkdown>{iaResult[p.id] || p.ia_recomendacao || ''}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog de motivo para Rejeitar/Remover */}
        <Dialog open={!!acaoDialog} onOpenChange={(open) => { if (!open) { setAcaoDialog(null); setMotivoTexto(''); setArquivarJunto(true); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {acaoDialog?.tipo === 'rejeitar' ? 'Rejeitar processo' : 'Remover processo'}
              </DialogTitle>
              <DialogDescription>
                Processo <strong>{acaoDialog ? identidadeDoEdital({ numeroCompra: acaoDialog.processo.numero, modalidade: acaoDialog.processo.modalidade }).rotulo : ''}</strong> — {acaoDialog?.processo.orgao}
              </DialogDescription>
              {acaoDialog?.tipo === 'remover' && (
                <p className="text-sm text-muted-foreground">
                  Remover tira o processo <strong>da sua lista de acompanhamento</strong>.
                  {acaoDialog?.processo.licitacao_id
                    ? ' O processo em gestão (Kanban/Painel) continua existindo — marque abaixo para arquivá-lo junto.'
                    : ''}
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
                <p className="text-right text-xs text-muted-foreground tabular-nums">{motivoTexto.length}/500</p>
              </div>
              {acaoDialog?.tipo === 'remover' && acaoDialog?.processo.licitacao_id && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="arquivar-junto"
                    checked={arquivarJunto}
                    onCheckedChange={(v) => setArquivarJunto(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="arquivar-junto" className="cursor-pointer text-sm font-normal leading-5">
                    Também arquivar o processo na gestão (sai do Kanban e das listas ativas)
                  </Label>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setAcaoDialog(null); setMotivoTexto(''); }}>
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
      </div>
    </AppLayout>
  );
}
