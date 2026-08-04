import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  CalendarDays, Clock, Building2, Bell, Mail, MessageSquare, Zap,
  CheckCircle2, XCircle, Trash2, ExternalLink, Bot, AlertTriangle,
  ArrowRight, Loader2, RefreshCw, ListChecks, Brain, Shield,
  ChevronDown, ChevronUp, Archive, ArchiveRestore,
} from 'lucide-react';
import { useLicitacaoIntegration } from '@/hooks/useLicitacaoIntegration';
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

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  interessado: { label: 'Interessado', color: 'bg-info/10 text-info border-info/20', icon: ListChecks },
  analisando: { label: 'IA Analisando', color: 'bg-warning/10 text-warning border-warning/20', icon: Brain },
  aprovado: { label: 'Aprovado', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
  cadastrado: { label: 'Cadastrado', color: 'bg-accent/10 text-accent border-accent/20', icon: Shield },
  rejeitado: { label: 'Rejeitado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  arquivado: { label: 'Arquivado', color: 'bg-muted text-muted-foreground border-border', icon: Archive },
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
    <span className={`tabular-nums font-bold text-sm ${colors[urgency]}`}>
      <Clock className="w-3.5 h-3.5 inline mr-1" />
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

  const carregarProcessos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('processos_interesse')
      .select('*')
      .eq('user_id', user.id)
      .order('data_encerramento', { ascending: true });
    setProcessos((data || []) as ProcessoInteresse[]);
    setLoading(false);
  }, [user]);

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
        toast.success('Processo removido da lista.');
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <ListChecks className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
              Meus Compromissos
            </h1>
            <p className="text-base text-muted-foreground mt-1">
              Processos de interesse com alertas multicanal e workflow autônomo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map(e => (
                  <SelectItem key={e.empresa_id} value={e.empresa_id}>{e.empresa.nome_fantasia || e.empresa.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={carregarProcessos}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-4 text-center border-info/30">
            <p className="text-2xl font-bold text-info">{stats.interessados}</p>
            <p className="text-xs text-muted-foreground">Interessados</p>
          </Card>
          <Card className="p-4 text-center border-success/30">
            <p className="text-2xl font-bold text-success">{stats.aprovados}</p>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </Card>
          <Card className="p-4 text-center border-accent/30">
            <p className="text-2xl font-bold text-accent">{stats.cadastrados}</p>
            <p className="text-xs text-muted-foreground">Cadastrados</p>
          </Card>
          <Card className="p-4 text-center border-destructive/30">
            <p className="text-2xl font-bold text-destructive">{stats.urgentes}</p>
            <p className="text-xs text-muted-foreground">Urgentes (&lt;3d)</p>
          </Card>
        </div>

        {/* Filter by status */}
        <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">Todos</TabsTrigger>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key}>{cfg.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <ListChecks className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum processo na lista</p>
            <p className="text-base text-muted-foreground mt-1">
              Marque interesse em editais no Monitoramento para adicioná-los aqui.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const cfg = statusConfig[p.status] || statusConfig.interessado;
              const StatusIcon = cfg.icon;
              return (
                <Card key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cfg.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="font-semibold text-sm">{p.numero}</span>
                        {p.data_encerramento && <Countdown targetDate={p.data_encerramento} />}
                        {p.auto_cadastro && (
                          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-xs">
                            <Zap className="w-3 h-3 mr-0.5" /> Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{p.orgao}</p>
                      <p className="text-base text-muted-foreground line-clamp-2 mt-0.5">{p.objeto}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {empresaMap[p.empresa_id] || 'Empresa'}
                        </span>
                        {p.valor_estimado && <span>{formatCurrency(p.valor_estimado)}</span>}
                        {p.uf && <span>{p.municipio ? `${p.municipio}/${p.uf}` : p.uf}</span>}
                        {p.portal && <span>{p.portal}</span>}
                        <span className="flex items-center gap-1">
                          {p.alerta_sistema && <Bell className="w-3 h-3 text-accent" />}
                          {p.alerta_email && <Mail className="w-3 h-3 text-info" />}
                          {p.alerta_whatsapp && <MessageSquare className="w-3 h-3 text-success" />}
                        </span>
                      </div>
                      {p.ia_score != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Score IA:</span>
                          <Progress value={p.ia_score} className="h-2 w-24" />
                          <span className="text-xs font-bold">{p.ia_score}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {p.status === 'interessado' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleAnaliseIA(p)} disabled={analisandoIA === p.id}>
                            <Brain className="w-3.5 h-3.5 mr-1" />
                            {analisandoIA === p.id ? 'Analisando...' : 'IA Analisar'}
                          </Button>
                          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleAprovar(p.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                          </Button>
                        </>
                      )}
                      {p.status === 'analisando' && (
                        <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleAprovar(p.id)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                        </Button>
                      )}
                      {p.status !== 'rejeitado' && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAcaoDialog({ tipo: 'rejeitar', processo: p })}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
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
                          ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          : p.status === 'arquivado'
                          ? <ArchiveRestore className="w-3.5 h-3.5 mr-1" />
                          : <Archive className="w-3.5 h-3.5 mr-1" />}
                        {p.status === 'arquivado' ? 'Restaurar' : 'Arquivar'}
                      </Button>
                      {p.status !== 'rejeitado' && (
                        <Button size="sm" variant="ghost" onClick={() => setAcaoDialog({ tipo: 'remover', processo: p })}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                        </Button>
                      )}
                      {p.url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={p.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* IA Analysis result */}
                  {(iaResult[p.id] || p.ia_recomendacao) && (
                    <div className="bg-muted/30 rounded-lg border border-border/50 text-base">
                      <button
                        className="flex items-center gap-2 w-full text-left p-3"
                        onClick={() => setExpandedAnalise(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      >
                        <Brain className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-semibold text-accent flex-1">Análise da IA</span>
                        {expandedAnalise[p.id] ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                      {expandedAnalise[p.id] && (
                        <div className="prose dark:prose-invert max-w-none px-3 pb-3">
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
        <Dialog open={!!acaoDialog} onOpenChange={(open) => { if (!open) { setAcaoDialog(null); setMotivoTexto(''); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {acaoDialog?.tipo === 'rejeitar' ? 'Rejeitar Processo' : 'Remover Processo'}
              </DialogTitle>
              <DialogDescription>
                Processo <strong>{acaoDialog?.processo.numero}</strong> — {acaoDialog?.processo.orgao}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Motivo *</Label>
                <Textarea
                  value={motivoTexto}
                  onChange={e => setMotivoTexto(e.target.value)}
                  placeholder="Descreva o motivo da rejeição/remoção..."
                  className="min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{motivoTexto.length}/500</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setAcaoDialog(null); setMotivoTexto(''); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAcao}
                disabled={executandoAcao || !motivoTexto.trim()}
                className={acaoDialog?.tipo === 'rejeitar' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {executandoAcao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {acaoDialog?.tipo === 'rejeitar' ? 'Confirmar Rejeição' : 'Confirmar Remoção'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
