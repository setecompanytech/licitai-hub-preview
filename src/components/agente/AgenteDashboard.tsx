import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoneyInput } from '@/components/ui/money-input';
import { toast } from 'sonner';
import {
  Bot, Zap, Trophy, Clock, CheckCircle2, XCircle,
  Eye, Play, FileText, Activity,
  TrendingUp, Target, RefreshCw, Settings, DollarSign, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EstadoVazio from '@/components/shared/EstadoVazio';
import FaixaIndicadores, { type Indicador } from '@/components/gestao/FaixaIndicadores';
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

type VarianteStatus = 'success' | 'warning' | 'danger' | 'info' | 'muted';

// Status sempre em família semântica do Badge, com texto — a cor é reforço.
const DECISAO_CONFIG: Record<string, { label: string; variant: VarianteStatus; icon: React.ElementType }> = {
  participar: { label: 'Participar', variant: 'info', icon: Play },
  aguardar_aprovacao: { label: 'Aguardando', variant: 'warning', icon: Clock },
  participando: { label: 'Participando', variant: 'info', icon: Activity },
  proposta_enviada: { label: 'Proposta Enviada', variant: 'info', icon: FileText },
  em_disputa: { label: 'Em Disputa', variant: 'warning', icon: Zap },
  vencedor: { label: 'Vencedor', variant: 'success', icon: Trophy },
  perdedor: { label: 'Perdedor', variant: 'danger', icon: XCircle },
  descartado: { label: 'Descartado', variant: 'muted', icon: XCircle },
  em_contrato: { label: 'Em Contrato', variant: 'success', icon: FileText },
  concluido: { label: 'Concluído', variant: 'muted', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', variant: 'muted', icon: XCircle },
};

const LOG_STATUS: Record<string, { label: string; variant: VarianteStatus }> = {
  sucesso: { label: 'Sucesso', variant: 'success' },
  erro: { label: 'Erro', variant: 'danger' },
};

export default function AgenteDashboard() {
  const { empresaAtiva } = useEmpresa();
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
      toast.error(`Não foi possível ${novoEstado ? 'ativar' : 'desativar'} o agente AURÉLIA`, {
        description: 'Verifique sua conexão e tente novamente. Se o problema persistir, recarregue a página.',
        duration: 6000,
      });
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
      toast.error('Não foi possível aprovar a participação nesta licitação', {
        description: 'Verifique sua conexão e tente novamente. Se o problema persistir, recarregue a página.',
        duration: 6000,
      });
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
      <Card>
        <EstadoVazio
          icone={<Bot />}
          titulo="Selecione uma empresa"
          descricao="Escolha uma empresa para acessar o AURÉLIA Agent."
        />
      </Card>
    );
  }

  /* Os indicadores na anatomia do cartão KPI do DS (`FaixaIndicadores`): o
     tom do ladrilho é semântico só onde há estado real. */
  const kpis: Indicador[] = [
    { rotulo: 'Monitoradas', valor: metricas?.total_monitoradas ?? 0, icone: Eye, tom: 'neutro' },
    { rotulo: 'Em Andamento', valor: metricas?.em_andamento ?? 0, icone: Activity, tom: 'ok' },
    { rotulo: 'Em Disputa', valor: metricas?.em_disputa ?? 0, icone: Zap, tom: 'aviso' },
    { rotulo: 'Aguardando', valor: metricas?.aguardando_aprovacao ?? 0, icone: Clock, tom: 'aviso' },
    { rotulo: 'Vitórias (30d)', valor: metricas?.vitorias_30d ?? 0, icone: Trophy, tom: 'ok' },
    { rotulo: 'Taxa Vitória', valor: `${metricas?.taxa_vitoria ?? 0}%`, icone: TrendingUp, tom: 'ok' },
  ];

  return (
    <div className="space-y-6">
      {/* Barra de controle: o título da página vem do CabecalhoPagina (AgentePage). */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="agente-ativo" className="text-sm font-medium text-foreground">Agente</Label>
          <Switch id="agente-ativo" checked={agenteAtivo} onCheckedChange={toggleAgente} />
          <Badge variant={agenteAtivo ? 'success' : 'muted'}>
            {agenteAtivo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <Button variant="outline" onClick={carregarDados} disabled={loading}>
          <RefreshCw aria-hidden="true" className={cn('h-4 w-4', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <FaixaIndicadores itens={kpis} />

      {/* Valor total vitórias — a única superfície tingida do painel. */}
      {metricas && metricas.valor_total_vitorias > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-primary-line bg-primary-tint px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Valor total das vitórias (30 dias)</p>
            <p className="truncate text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">
              {formatCurrency(metricas.valor_total_vitorias)}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-success-tint text-success-ink"
          >
            <Trophy className="h-4 w-4" />
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="monitoradas" className="gap-2">
            <Target className="h-4 w-4" aria-hidden="true" />
            Licitações ({licitacoes.length})
          </TabsTrigger>
          <TabsTrigger value="precificacao" className="gap-2">
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            Precificação
          </TabsTrigger>
          <TabsTrigger value="pesquisa" className="gap-2">
            <Search className="h-4 w-4" aria-hidden="true" />
            Pesquisa de preços
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Log de ações
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Tab: Licitações Monitoradas — a tabela padrão, com a decisão em
            selo e as ações de aprovação na própria linha. */}
        <TabsContent value="monitoradas">
          {licitacoes.length === 0 ? (
            <Card>
              <EstadoVazio
                icone={<Bot />}
                titulo="Nenhuma licitação monitorada pelo agente"
                descricao="Ative o agente e configure os critérios de busca."
              />
            </Card>
          ) : (
            <div className="max-h-[560px] overflow-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Licitação</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead className="text-right">Valor estimado</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>Última ação</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Decisão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licitacoes.map((lic) => {
                    const cfg = DECISAO_CONFIG[lic.decisao] || { label: lic.decisao, variant: 'muted' as const, icon: Eye };
                    const Icon = cfg.icon;

                    return (
                      <TableRow key={lic.id}>
                        <TableCell className="min-w-[16rem] max-w-[24rem]">
                          <span className="block truncate font-medium text-foreground">
                            {lic.pncp_editais_cache?.objeto_compra || 'Carregando...'}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          <span className="block truncate">{lic.pncp_editais_cache?.orgao_nome}</span>
                          <span className="text-xs text-muted-foreground">{lic.pncp_editais_cache?.uf}</span>
                        </TableCell>
                        <TableCell nowrap className="text-right tabular-nums">
                          {lic.pncp_editais_cache?.valor_total_estimado
                            ? formatCurrency(lic.pncp_editais_cache.valor_total_estimado)
                            : 'Valor não informado'}
                        </TableCell>
                        <TableCell nowrap className="text-right tabular-nums">
                          <strong className="font-medium text-foreground">{lic.score_relevancia}</strong>
                          <span className="text-muted-foreground">/100</span>
                        </TableCell>
                        <TableCell nowrap>{lic.agente_atual}</TableCell>
                        <TableCell truncate>{lic.ultima_acao}</TableCell>
                        <TableCell nowrap className="tabular-nums">{formatDate(lic.data_abertura)}</TableCell>
                        <TableCell nowrap>
                          <Badge variant={cfg.variant} className="gap-1">
                            <Icon className="h-3 w-3" aria-hidden="true" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell nowrap className="text-right">
                          {lic.decisao === 'aguardar_aprovacao' && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="default" onClick={() => aprovarParticipacao(lic.id)}>
                                <CheckCircle2 className="h-4 w-4" /> Aprovar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => descartarLicitacao(lic.id)}>
                                <XCircle className="h-4 w-4" /> Descartar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab: Precificação */}
        <TabsContent value="precificacao">
          <div className="space-y-4">
            {licitacoes.length === 0 ? (
              <Card>
                <EstadoVazio
                  icone={<DollarSign />}
                  titulo="Nenhuma licitação para precificar"
                  descricao="Aprove licitações na aba anterior para iniciar a precificação."
                />
              </Card>
            ) : (
              <div className="space-y-6">
                {licitacoes
                  .filter(l => ['participar', 'participando', 'proposta_enviada', 'em_disputa', 'aguardar_aprovacao'].includes(l.decisao))
                  .map((lic) => (
                    <div key={lic.id} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">{lic.pncp_editais_cache?.modalidade_nome}</Badge>
                        <h4 className="min-w-0 flex-1 truncate text-lg font-semibold leading-6 text-foreground">
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

        {/* Tab: Pesquisa de Preços */}
        <TabsContent value="pesquisa">
          <PesquisaPrecos />
        </TabsContent>

        {/* Tab: Log de ações — tabela padrão. */}
        <TabsContent value="logs">
          {acoesLog.length === 0 ? (
            <Card>
              <EstadoVazio icone={<Activity />} titulo="Nenhuma ação registrada ainda" />
            </Card>
          ) : (
            <div className="max-h-[560px] overflow-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead className="text-right">Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acoesLog.map((log) => {
                    const st = LOG_STATUS[log.status] ?? { label: log.status, variant: 'warning' as const };
                    return (
                      <TableRow key={log.id}>
                        <TableCell nowrap>
                          <div className="flex items-center gap-2">
                            <Badge variant={st.variant}>{st.label}</Badge>
                            {log.erro_msg && (
                              <Badge variant="danger">Erro</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell nowrap className="font-mono text-xs text-muted-foreground">{log.agente}</TableCell>
                        <TableCell truncate className="max-w-[28rem]">{log.acao}</TableCell>
                        <TableCell nowrap className="text-right text-xs tabular-nums text-muted-foreground">
                          {log.duracao_ms ? `${log.duracao_ms}ms` : '—'}
                        </TableCell>
                        <TableCell nowrap className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatDate(log.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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

  const rotulo = 'mb-1 block text-sm font-medium text-foreground';

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Critérios de Prospecção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cfg-score-auto" className={rotulo}>Score mínimo (auto)</Label>
              <Input id="cfg-score-auto" type="number" value={config.score_minimo_auto} onChange={e => setConfig(c => ({ ...c, score_minimo_auto: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">Acima deste score, o agente participa automaticamente</p>
            </div>
            <div>
              <Label htmlFor="cfg-score-notif" className={rotulo}>Score mínimo (notificação)</Label>
              <Input id="cfg-score-notif" type="number" value={config.score_minimo_notif} onChange={e => setConfig(c => ({ ...c, score_minimo_notif: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">Abaixo deste score, é descartado silenciosamente</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cfg-valor-min" className={rotulo}>Valor mínimo (R$)</Label>
              <MoneyInput id="cfg-valor-min" value={Number(config.valor_minimo) || 0} onValueChange={v => setConfig(c => ({ ...c, valor_minimo: v }))} />
            </div>
            <div>
              <Label htmlFor="cfg-valor-max" className={rotulo}>Valor máximo (R$)</Label>
              <MoneyInput id="cfg-valor-max" value={Number(config.valor_maximo) || 0} onValueChange={v => setConfig(c => ({ ...c, valor_maximo: v }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estratégia de Lance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cfg-estrategia" className={rotulo}>Modo de lance</Label>
            <Select value={config.estrategia_lance} onValueChange={v => setConfig(c => ({ ...c, estrategia_lance: v }))}>
              <SelectTrigger id="cfg-estrategia"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agressivo">Agressivo — cobrir qualquer lance rapidamente</SelectItem>
                <SelectItem value="conservador">Conservador — preservar margem mínima</SelectItem>
                <SelectItem value="oportunista">Oportunista — lance único nos últimos minutos</SelectItem>
                <SelectItem value="adaptativo">Adaptativo (IA) — estratégia dinâmica via IA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cfg-preco-min-perc" className={rotulo}>Preço mínimo (% do estimado)</Label>
            <Input id="cfg-preco-min-perc" type="number" step="0.01" value={config.preco_minimo_perc} onChange={e => setConfig(c => ({ ...c, preco_minimo_perc: Number(e.target.value) }))} />
            <p className="text-xs text-muted-foreground mt-1">Nunca lançar abaixo de {(config.preco_minimo_perc * 100).toFixed(0)}% do valor estimado</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automação e Alertas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="cfg-auto-submeter" className="text-sm font-medium text-foreground">Auto-submeter proposta</Label>
              <p className="text-xs text-muted-foreground">Submeter proposta sem aprovação manual</p>
            </div>
            <Switch id="cfg-auto-submeter" checked={config.auto_submeter_prop} onCheckedChange={v => setConfig(c => ({ ...c, auto_submeter_prop: v }))} />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="cfg-auto-chat" className="text-sm font-medium text-foreground">Auto-responder chat</Label>
              <p className="text-xs text-muted-foreground">Responder automaticamente a mensagens simples do pregoeiro</p>
            </div>
            <Switch id="cfg-auto-chat" checked={config.auto_responder_chat} onCheckedChange={v => setConfig(c => ({ ...c, auto_responder_chat: v }))} />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="cfg-whatsapp" className="text-sm font-medium text-foreground">Alertas WhatsApp</Label>
              <p className="text-xs text-muted-foreground">Receber alertas urgentes via WhatsApp</p>
            </div>
            <Switch id="cfg-whatsapp" checked={config.alertar_whatsapp} onCheckedChange={v => setConfig(c => ({ ...c, alertar_whatsapp: v }))} />
          </div>
          {config.alertar_whatsapp && (
            <div>
              <Label htmlFor="cfg-whatsapp-numero" className={rotulo}>Número WhatsApp</Label>
              <Input id="cfg-whatsapp-numero" type="text" placeholder="5511999999999" value={config.whatsapp_numero}
                onChange={e => setConfig(c => ({ ...c, whatsapp_numero: e.target.value }))} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cfg-horario-inicio" className={rotulo}>Horário início</Label>
              <Input id="cfg-horario-inicio" type="time" value={config.horario_inicio} onChange={e => setConfig(c => ({ ...c, horario_inicio: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="cfg-horario-fim" className={rotulo}>Horário fim</Label>
              <Input id="cfg-horario-fim" type="time" value={config.horario_fim} onChange={e => setConfig(c => ({ ...c, horario_fim: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Precificação Autônoma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cfg-fator-proposta" className={rotulo}>Fator preço proposta</Label>
              <Input id="cfg-fator-proposta" type="number" step="0.001" value={config.fator_preco_proposta} onChange={e => setConfig(c => ({ ...c, fator_preco_proposta: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">{((1 - config.fator_preco_proposta) * 100).toFixed(1)}% abaixo do mercado</p>
            </div>
            <div>
              <Label htmlFor="cfg-fator-lance" className={rotulo}>Fator lance inicial</Label>
              <Input id="cfg-fator-lance" type="number" step="0.001" value={config.fator_lance_inicial} onChange={e => setConfig(c => ({ ...c, fator_lance_inicial: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">{((1 - config.fator_lance_inicial) * 100).toFixed(1)}% abaixo do mercado</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cfg-margem-min" className={rotulo}>Margem mínima (%)</Label>
              <Input id="cfg-margem-min" type="number" step="0.001" value={config.margem_minima_perc_cfg} onChange={e => setConfig(c => ({ ...c, margem_minima_perc_cfg: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">{(config.margem_minima_perc_cfg * 100).toFixed(1)}% margem mínima</p>
            </div>
            <div>
              <Label htmlFor="cfg-margem-alvo" className={rotulo}>Margem alvo (%)</Label>
              <Input id="cfg-margem-alvo" type="number" step="0.001" value={config.margem_alvo_perc} onChange={e => setConfig(c => ({ ...c, margem_alvo_perc: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">{(config.margem_alvo_perc * 100).toFixed(1)}% margem alvo</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cfg-confianca" className={rotulo}>Confiança mín. auto-aprovação</Label>
              <Input id="cfg-confianca" type="number" step="0.01" value={config.confianca_minima_auto} onChange={e => setConfig(c => ({ ...c, confianca_minima_auto: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground mt-1">{(config.confianca_minima_auto * 100).toFixed(0)}% — abaixo pede revisão humana</p>
            </div>
            <div>
              <Label htmlFor="cfg-preco-min-abs" className={rotulo}>Preço mínimo absoluto (R$)</Label>
              <MoneyInput id="cfg-preco-min-abs" value={Number(config.preco_minimo_absoluto) || 0} onValueChange={v => setConfig(c => ({ ...c, preco_minimo_absoluto: v }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={salvar} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Salvando...' : 'Salvar Configurações'}
      </Button>
    </div>
  );
}
