import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Bot, Zap, Trophy, Clock, AlertTriangle, CheckCircle2, XCircle,
  Eye, Play, Pause, BarChart3, FileText, Scale, Shield, Activity,
  TrendingUp, Target, RefreshCw, Settings, DollarSign,
} from 'lucide-react';
import PrecificacaoReview from './PrecificacaoReview';
import PesquisaPrecos from './PesquisaPrecos';

interface AgentMetricas {
  total_monitoradas: number;
  em_andamento: number;
  em_disputa: number;
  aguardando_aprovacao: number;
  vitorias_30d: number;
  taxa_vitoria: number;
  valor_total_vitorias: number;
}

interface AgentLicitacao {
  id: string;
  score_relevancia: number;
  decisao: string;
  motivo_decisao: string;
  agente_atual: string;
  ultima_acao: string;
  proxima_acao: string;
  data_abertura: string;
  preco_proposta: number;
  created_at: string;
  updated_at: string;
  pncp_editais_cache: {
    objeto_compra: string;
    orgao_nome: string;
    valor_total_estimado: number;
    uf: string;
    modalidade_nome: string;
  } | null;
}

interface AgentAcaoLog {
  id: string;
  agente: string;
  acao: string;
  status: string;
  created_at: string;
  duracao_ms: number;
  erro_msg: string | null;
}

const DECISAO_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  participar: { label: 'Participar', variant: 'default', icon: Play },
  aguardar_aprovacao: { label: 'Aguardando', variant: 'secondary', icon: Clock },
  participando: { label: 'Participando', variant: 'default', icon: Activity },
  proposta_enviada: { label: 'Proposta Enviada', variant: 'default', icon: FileText },
  em_disputa: { label: 'Em Disputa', variant: 'destructive', icon: Zap },
  vencedor: { label: 'Vencedor', variant: 'default', icon: Trophy },
  perdedor: { label: 'Perdedor', variant: 'outline', icon: XCircle },
  descartado: { label: 'Descartado', variant: 'outline', icon: XCircle },
  em_contrato: { label: 'Em Contrato', variant: 'default', icon: FileText },
  concluido: { label: 'Concluído', variant: 'secondary', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', variant: 'outline', icon: XCircle },
};

export default function AgenteDashboard() {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();
  const [metricas, setMetricas] = useState<AgentMetricas | null>(null);
  const [licitacoes, setLicitacoes] = useState<AgentLicitacao[]>([]);
  const [acoesLog, setAcoesLog] = useState<AgentAcaoLog[]>([]);
  const [agenteAtivo, setAgenteAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('monitoradas');

  const carregarDados = useCallback(async () => {
    if (!empresaAtiva?.id) return;

    try {
      // Metrics
      const { data: metricasData } = await supabase.rpc('calcular_metricas_agente', {
        p_empresa_id: empresaAtiva.id,
      });
      if (metricasData) setMetricas(metricasData as unknown as AgentMetricas);

      // Licitações
      const { data: licsData } = await supabase
        .from('agent_licitacoes')
        .select('*, pncp_editais_cache(objeto_compra, orgao_nome, valor_total_estimado, uf, modalidade_nome)')
        .eq('empresa_id', empresaAtiva.id)
        .not('decisao', 'in', '(descartado,concluido,cancelado)')
        .order('updated_at', { ascending: false })
        .limit(30);
      if (licsData) setLicitacoes(licsData as unknown as AgentLicitacao[]);

      // Config
      const { data: configData } = await supabase
        .from('agent_configuracoes')
        .select('agente_ativo')
        .eq('empresa_id', empresaAtiva.id)
        .maybeSingle();
      setAgenteAtivo(configData?.agente_ativo || false);

      // Recent actions
      const { data: logsData } = await supabase
        .from('agent_acoes_log')
        .select('id, agente, acao, status, created_at, duracao_ms, erro_msg')
        .order('created_at', { ascending: false })
        .limit(50);
      if (logsData) setAcoesLog(logsData as AgentAcaoLog[]);
    } catch (e) {
      console.error('Erro ao carregar dados do agente:', e);
    } finally {
      setLoading(false);
    }
  }, [empresaAtiva?.id]);

  useEffect(() => {
    carregarDados();

    // Realtime subscription
    const channel = supabase
      .channel('agent-dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_licitacoes',
      }, () => carregarDados())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [carregarDados]);

  const toggleAgente = async () => {
    if (!empresaAtiva?.id) return;

    const novoEstado = !agenteAtivo;

    const { error } = await supabase
      .from('agent_configuracoes')
      .upsert({
        empresa_id: empresaAtiva.id,
        agente_ativo: novoEstado,
      }, { onConflict: 'empresa_id' });

    if (error) {
      toast.error('Erro ao alterar estado do agente');
      return;
    }

    setAgenteAtivo(novoEstado);
    toast.success(novoEstado ? 'Agente AURÉLIA ativado!' : 'Agente desativado');
  };

  const aprovarParticipacao = async (licitacaoId: string) => {
    const { error } = await supabase
      .from('agent_licitacoes')
      .update({ decisao: 'participar', aprovacao_humana: true })
      .eq('id', licitacaoId);

    if (error) {
      toast.error('Erro ao aprovar');
      return;
    }

    // Trigger preparation
    supabase.functions.invoke('agent-orchestrator', {
      body: { tipo: 'preparar', payload: { licitacao_id: licitacaoId, empresa_id: empresaAtiva?.id } },
    }).catch(() => {});

    toast.success('Participação aprovada — agente preparando análise');
    carregarDados();
  };

  const descartarLicitacao = async (licitacaoId: string) => {
    await supabase
      .from('agent_licitacoes')
      .update({ decisao: 'descartado', motivo_decisao: 'Descartado manualmente pelo usuário' })
      .eq('id', licitacaoId);

    toast.info('Licitação descartada');
    carregarDados();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (date: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!empresaAtiva?.id) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Selecione uma empresa para acessar o AURÉLIA Agent.</p>
      </div>
    );
  }

  const kpis = [
    { label: 'Monitoradas', value: metricas?.total_monitoradas ?? 0, icon: Eye, color: 'text-blue-400' },
    { label: 'Em Andamento', value: metricas?.em_andamento ?? 0, icon: Activity, color: 'text-emerald-400' },
    { label: 'Em Disputa', value: metricas?.em_disputa ?? 0, icon: Zap, color: 'text-orange-400' },
    { label: 'Aguardando', value: metricas?.aguardando_aprovacao ?? 0, icon: Clock, color: 'text-yellow-400' },
    { label: 'Vitórias (30d)', value: metricas?.vitorias_30d ?? 0, icon: Trophy, color: 'text-[hsl(var(--primary))]' },
    { label: 'Taxa Vitória', value: `${metricas?.taxa_vitoria ?? 0}%`, icon: TrendingUp, color: 'text-[hsl(var(--primary))]' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AURÉLIA Agent</h2>
            <p className="text-sm text-muted-foreground">Agente autônomo 24/7 — ciclo licitatório completo</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agente</span>
            <Switch checked={agenteAtivo} onCheckedChange={toggleAgente} />
            <Badge variant={agenteAtivo ? 'default' : 'outline'} className={agenteAtivo ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''}>
              {agenteAtivo ? '● Ativo' : '○ Inativo'}
            </Badge>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Valor total vitórias */}
      {metricas && metricas.valor_total_vitorias > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Valor total das vitórias (30 dias)</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(metricas.valor_total_vitorias)}</p>
            </div>
            <Trophy className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 flex-wrap">
          <TabsTrigger value="monitoradas">
            <Target className="h-4 w-4 mr-2" />
            Licitações ({licitacoes.length})
          </TabsTrigger>
          <TabsTrigger value="precificacao">
            <DollarSign className="h-4 w-4 mr-2" />
            Precificação
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Activity className="h-4 w-4 mr-2" />
            Log de Ações
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Tab: Licitações Monitoradas */}
        <TabsContent value="monitoradas">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {licitacoes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma licitação monitorada pelo agente.</p>
                  <p className="text-sm mt-1">Ative o agente e configure os critérios de busca.</p>
                </div>
              )}

              {licitacoes.map((lic) => {
                const cfg = DECISAO_CONFIG[lic.decisao] || { label: lic.decisao, variant: 'outline' as const, icon: Eye };
                const Icon = cfg.icon;

                return (
                  <Card key={lic.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {lic.pncp_editais_cache?.objeto_compra || 'Carregando...'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {lic.pncp_editais_cache?.orgao_nome} • {lic.pncp_editais_cache?.uf} •{' '}
                            {lic.pncp_editais_cache?.valor_total_estimado
                              ? formatCurrency(lic.pncp_editais_cache.valor_total_estimado)
                              : 'Valor não informado'}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>Score: <strong className="text-foreground">{lic.score_relevancia}/100</strong></span>
                            <span>Agente: {lic.agente_atual}</span>
                            <span>Última ação: {lic.ultima_acao}</span>
                            {lic.data_abertura && <span>Abertura: {formatDate(lic.data_abertura)}</span>}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={cfg.variant}>
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>

                          {lic.decisao === 'aguardar_aprovacao' && (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="default" className="text-xs h-7" onClick={() => aprovarParticipacao(lic.id)}>
                                ✓ Aprovar
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => descartarLicitacao(lic.id)}>
                                ✗ Descartar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab: Precificação */}
        <TabsContent value="precificacao">
          <div className="space-y-4">
            {licitacoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma licitação para precificar.</p>
                <p className="text-sm mt-1">Aprove licitações na aba anterior para iniciar a precificação.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {licitacoes
                  .filter(l => ['participar', 'participando', 'proposta_enviada', 'em_disputa', 'aguardar_aprovacao'].includes(l.decisao))
                  .map((lic) => (
                    <div key={lic.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{lic.pncp_editais_cache?.modalidade_nome}</Badge>
                        <h4 className="text-sm font-medium text-foreground truncate flex-1">
                          {lic.pncp_editais_cache?.objeto_compra || 'Carregando...'}
                        </h4>
                        <span className="text-xs text-muted-foreground">{lic.pncp_editais_cache?.orgao_nome}</span>
                      </div>
                      <PrecificacaoReview licitacaoId={lic.id} />
                      <Separator />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {acoesLog.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma ação registrada ainda.</p>
                </div>
              )}

              {acoesLog.map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                  <div className={`w-2 h-2 rounded-full ${log.status === 'sucesso' ? 'bg-emerald-400' : log.status === 'erro' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{log.agente}</span>
                  <span className="flex-1 truncate text-foreground">{log.acao}</span>
                  {log.duracao_ms && <span className="text-xs text-muted-foreground">{log.duracao_ms}ms</span>}
                  <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                  {log.erro_msg && (
                    <Badge variant="destructive" className="text-xs">Erro</Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab: Configurações */}
        <TabsContent value="config">
          <AgentConfig empresaId={empresaAtiva.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AgentConfig({ empresaId }: { empresaId: string }) {
  const [config, setConfig] = useState({
    score_minimo_auto: 70,
    score_minimo_notif: 40,
    valor_minimo: 0,
    valor_maximo: 999999999,
    preco_minimo_perc: 0.7,
    estrategia_lance: 'adaptativo',
    auto_submeter_prop: false,
    auto_responder_chat: true,
    alertar_whatsapp: true,
    whatsapp_numero: '',
    horario_inicio: '07:00',
    horario_fim: '22:00',
    // Precificação
    fator_preco_proposta: 0.920,
    fator_lance_inicial: 0.900,
    margem_minima_perc_cfg: 0.080,
    margem_alvo_perc: 0.150,
    valor_maximo_por_item: null as number | null,
    preco_minimo_absoluto: 0.01,
    confianca_minima_auto: 0.60,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase
        .from('agent_configuracoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (data) {
        setConfig({
          score_minimo_auto: data.score_minimo_auto ?? 70,
          score_minimo_notif: data.score_minimo_notif ?? 40,
          valor_minimo: data.valor_minimo ?? 0,
          valor_maximo: data.valor_maximo ?? 999999999,
          preco_minimo_perc: data.preco_minimo_perc ?? 0.7,
          estrategia_lance: data.estrategia_lance ?? 'adaptativo',
          auto_submeter_prop: data.auto_submeter_prop ?? false,
          auto_responder_chat: data.auto_responder_chat ?? true,
          alertar_whatsapp: data.alertar_whatsapp ?? true,
          whatsapp_numero: data.whatsapp_numero ?? '',
          horario_inicio: data.horario_inicio ?? '07:00',
          horario_fim: data.horario_fim ?? '22:00',
          fator_preco_proposta: (data as any).fator_preco_proposta ?? 0.920,
          fator_lance_inicial: (data as any).fator_lance_inicial ?? 0.900,
          margem_minima_perc_cfg: (data as any).margem_minima_perc ?? 0.080,
          margem_alvo_perc: (data as any).margem_alvo_perc ?? 0.150,
          valor_maximo_por_item: (data as any).valor_maximo_por_item ?? null,
          preco_minimo_absoluto: (data as any).preco_minimo_absoluto ?? 0.01,
          confianca_minima_auto: (data as any).confianca_minima_auto ?? 0.60,
        });
      }
    };
    loadConfig();
  }, [empresaId]);

  const salvar = async () => {
    setSaving(true);
    const { fator_preco_proposta, fator_lance_inicial, margem_minima_perc_cfg, margem_alvo_perc, valor_maximo_por_item, preco_minimo_absoluto, confianca_minima_auto, ...restConfig } = config;
    const payload = {
      empresa_id: empresaId,
      ...restConfig,
      fator_preco_proposta,
      fator_lance_inicial,
      margem_minima_perc: margem_minima_perc_cfg,
      margem_alvo_perc,
      valor_maximo_por_item,
      preco_minimo_absoluto,
      confianca_minima_auto,
    };
    const { error } = await supabase
      .from('agent_configuracoes')
      .upsert(payload as any, { onConflict: 'empresa_id' });

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações salvas');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Critérios de Prospecção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Score mínimo (auto)</label>
              <input type="number" value={config.score_minimo_auto} onChange={e => setConfig(c => ({ ...c, score_minimo_auto: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Acima deste score, o agente participa automaticamente</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Score mínimo (notificação)</label>
              <input type="number" value={config.score_minimo_notif} onChange={e => setConfig(c => ({ ...c, score_minimo_notif: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Abaixo deste score, é descartado silenciosamente</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Valor mínimo (R$)</label>
              <input type="number" value={config.valor_minimo} onChange={e => setConfig(c => ({ ...c, valor_minimo: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Valor máximo (R$)</label>
              <input type="number" value={config.valor_maximo} onChange={e => setConfig(c => ({ ...c, valor_maximo: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Estratégia de Lance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Modo de lance</label>
            <select value={config.estrategia_lance} onChange={e => setConfig(c => ({ ...c, estrategia_lance: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm">
              <option value="agressivo">Agressivo — cobrir qualquer lance rapidamente</option>
              <option value="conservador">Conservador — preservar margem mínima</option>
              <option value="oportunista">Oportunista — lance único nos últimos minutos</option>
              <option value="adaptativo">Adaptativo (IA) — estratégia dinâmica via IA</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Preço mínimo (% do estimado)</label>
            <input type="number" step="0.01" value={config.preco_minimo_perc} onChange={e => setConfig(c => ({ ...c, preco_minimo_perc: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Nunca lançar abaixo de {(config.preco_minimo_perc * 100).toFixed(0)}% do valor estimado</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Automação e Alertas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-submeter proposta</p>
              <p className="text-xs text-muted-foreground">Submeter proposta sem aprovação manual</p>
            </div>
            <Switch checked={config.auto_submeter_prop} onCheckedChange={v => setConfig(c => ({ ...c, auto_submeter_prop: v }))} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-responder chat</p>
              <p className="text-xs text-muted-foreground">Responder automaticamente a mensagens simples do pregoeiro</p>
            </div>
            <Switch checked={config.auto_responder_chat} onCheckedChange={v => setConfig(c => ({ ...c, auto_responder_chat: v }))} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Alertas WhatsApp</p>
              <p className="text-xs text-muted-foreground">Receber alertas urgentes via WhatsApp</p>
            </div>
            <Switch checked={config.alertar_whatsapp} onCheckedChange={v => setConfig(c => ({ ...c, alertar_whatsapp: v }))} />
          </div>
          {config.alertar_whatsapp && (
            <div>
              <label className="text-sm text-muted-foreground">Número WhatsApp</label>
              <input type="text" placeholder="5511999999999" value={config.whatsapp_numero}
                onChange={e => setConfig(c => ({ ...c, whatsapp_numero: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Horário início</label>
              <input type="time" value={config.horario_inicio} onChange={e => setConfig(c => ({ ...c, horario_inicio: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Horário fim</label>
              <input type="time" value={config.horario_fim} onChange={e => setConfig(c => ({ ...c, horario_fim: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Precificação Autônoma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Fator preço proposta</label>
              <input type="number" step="0.001" value={config.fator_preco_proposta} onChange={e => setConfig(c => ({ ...c, fator_preco_proposta: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">{((1 - config.fator_preco_proposta) * 100).toFixed(1)}% abaixo do mercado</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Fator lance inicial</label>
              <input type="number" step="0.001" value={config.fator_lance_inicial} onChange={e => setConfig(c => ({ ...c, fator_lance_inicial: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">{((1 - config.fator_lance_inicial) * 100).toFixed(1)}% abaixo do mercado</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Margem mínima (%)</label>
              <input type="number" step="0.001" value={config.margem_minima_perc_cfg} onChange={e => setConfig(c => ({ ...c, margem_minima_perc_cfg: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">{(config.margem_minima_perc_cfg * 100).toFixed(1)}% margem mínima</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Margem alvo (%)</label>
              <input type="number" step="0.001" value={config.margem_alvo_perc} onChange={e => setConfig(c => ({ ...c, margem_alvo_perc: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">{(config.margem_alvo_perc * 100).toFixed(1)}% margem alvo</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Confiança mín. auto-aprovação</label>
              <input type="number" step="0.01" value={config.confianca_minima_auto} onChange={e => setConfig(c => ({ ...c, confianca_minima_auto: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground mt-1">{(config.confianca_minima_auto * 100).toFixed(0)}% — abaixo pede revisão humana</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Preço mínimo absoluto (R$)</label>
              <input type="number" step="0.01" value={config.preco_minimo_absoluto} onChange={e => setConfig(c => ({ ...c, preco_minimo_absoluto: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={salvar} disabled={saving} className="w-full">
        {saving ? 'Salvando...' : 'Salvar Configurações'}
      </Button>
    </div>
  );
}
