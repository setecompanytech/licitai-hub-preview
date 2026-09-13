import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, Search, MapPin, Building2, Tag, Shield,
  Bell, Mail, MessageSquare, Loader2, Save, Target, Flame,
  Clock, Star, AlertTriangle, Zap, CheckCircle2,
  SlidersHorizontal, X, BarChart3, Send, TrendingUp
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const UFS_BRASIL = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

// Modalidades conforme Lei 14.133/2021 (Art. 28)
const MODALIDADES = [
  'Pregão Eletrônico', 'Concorrência', 'Concurso',
  'Leilão', 'Diálogo Competitivo', 'Dispensa de Licitação',
  'Inexigibilidade', 'Credenciamento',
];

const CORES_PERFIL = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

/** Legenda das classificações automáticas: a cor é reforço, o texto é a pista. */
const CLASSIFICACAO_CONFIG: {
  chave: string;
  label: string;
  variante: 'danger' | 'warning' | 'info' | 'muted' | 'outline';
  icone: LucideIcon;
  criterio: string;
}[] = [
  { chave: 'quente', label: 'Quente', variante: 'danger', icone: Flame, criterio: 'Score ≥ 80% e urgência ≥ 80%' },
  { chave: 'urgente', label: 'Urgente', variante: 'warning', icone: Clock, criterio: 'Abertura em até 3 dias' },
  { chave: 'premium', label: 'Premium', variante: 'info', icone: Star, criterio: 'Score ≥ 70%' },
  { chave: 'regional', label: 'Regional', variante: 'muted', icone: MapPin, criterio: 'Match geográfico e score ≥ 50%' },
  { chave: 'normal', label: 'Normal', variante: 'outline', icone: Search, criterio: 'Demais processos que passam nos filtros' },
];

/** Contagem de disparos e classificações de um perfil, na aba Analytics. */
type EstatisticaPerfil = {
  total: number; enviado: number; pendente: number; falhou: number;
  quente: number; urgente: number; premium: number;
};

const ESTATISTICA_ZERADA: EstatisticaPerfil = {
  total: 0, enviado: 0, pendente: 0, falhou: 0, quente: 0, urgente: 0, premium: 0,
};

/** O que a função `calcular-scores` devolve. */
type ResultadoScores = {
  total_perfis?: number;
  total_licitacoes?: number;
  scores_calculados?: number;
  dispatches_criados?: number;
};

type PerfilAlerta = {
  id: string;
  nome: string;
  ativo: boolean;
  cor: string;
  icone: string;
  cnaes: string[];
  palavras_chave: string[];
  palavras_negativas: string[];
  segmentos: string[];
  ufs: string[];
  municipios: string[];
  regiao: string | null;
  priorizar_regiao_sede: boolean;
  orgaos_favoritos: string[];
  orgaos_bloqueados: string[];
  modalidades: string[];
  tipos_publicacao: string[];
  valor_minimo: number | null;
  valor_maximo: number | null;
  exclusividade_meepp: boolean;
  peso_cnae: number;
  peso_palavra_chave: number;
  peso_regiao: number;
  peso_modalidade: number;
  peso_valor: number;
  peso_urgencia: number;
  canal_email: boolean;
  canal_whatsapp: boolean;
  canal_sistema: boolean;
  frequencia: string;
  horarios_disparo: string[];
  created_at: string;
  empresa_id: string | null;
};

const defaultPerfil: Omit<PerfilAlerta, 'id' | 'created_at'> = {
  nome: 'Novo Perfil',
  ativo: true,
  cor: '#3b82f6',
  icone: 'Search',
  cnaes: [],
  palavras_chave: [],
  palavras_negativas: [],
  segmentos: [],
  ufs: [],
  municipios: [],
  regiao: null,
  priorizar_regiao_sede: false,
  orgaos_favoritos: [],
  orgaos_bloqueados: [],
  modalidades: [],
  tipos_publicacao: [],
  valor_minimo: null,
  valor_maximo: null,
  exclusividade_meepp: false,
  peso_cnae: 30,
  peso_palavra_chave: 25,
  peso_regiao: 20,
  peso_modalidade: 10,
  peso_valor: 10,
  peso_urgencia: 5,
  canal_email: true,
  canal_whatsapp: false,
  canal_sistema: true,
  frequencia: 'imediato',
  horarios_disparo: ['08:00', '12:00', '18:00'],
  empresa_id: null,
};

export default function PerfisAlerta() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [perfis, setPerfis] = useState<PerfilAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<PerfilAlerta | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [scoreResults, setScoreResults] = useState<ResultadoScores | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<'perfis' | 'analytics'>('perfis');
  const [dispatchStats, setDispatchStats] = useState<Record<string, EstatisticaPerfil>>({});
  const [loadingStats, setLoadingStats] = useState(false);

  // Temp input states for array fields
  const [tempCnae, setTempCnae] = useState('');
  const [tempPalavra, setTempPalavra] = useState('');
  const [tempNeg, setTempNeg] = useState('');
  const [tempMunicipio, setTempMunicipio] = useState('');
  const [tempOrgaoFav, setTempOrgaoFav] = useState('');
  const [tempOrgaoBlock, setTempOrgaoBlock] = useState('');

  const loadPerfis = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('perfis_alerta')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setPerfis((data as unknown as PerfilAlerta[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadPerfis(); }, [loadPerfis]);

  const loadAnalytics = useCallback(async () => {
    if (!user || perfis.length === 0) return;
    setLoadingStats(true);
    try {
      // Load dispatch stats per profile
      const { data: dispatches } = await supabase
        .from('alerta_dispatches')
        .select('perfil_alerta_id, status')
        .eq('user_id', user.id);
      
      // Load score classifications per profile
      const { data: scores } = await supabase
        .from('licitacao_scores')
        .select('perfil_alerta_id, classificacao')
        .eq('user_id', user.id);

      const stats: Record<string, EstatisticaPerfil> = {};
      for (const p of perfis) {
        const pDispatches = (dispatches || []).filter(d => d.perfil_alerta_id === p.id);
        const pScores = (scores || []).filter(s => s.perfil_alerta_id === p.id);
        stats[p.id] = {
          total: pDispatches.length,
          enviado: pDispatches.filter(d => d.status === 'enviado').length,
          pendente: pDispatches.filter(d => d.status === 'pendente').length,
          falhou: pDispatches.filter(d => d.status === 'falhou').length,
          quente: pScores.filter(s => s.classificacao === 'quente').length,
          urgente: pScores.filter(s => s.classificacao === 'urgente').length,
          premium: pScores.filter(s => s.classificacao === 'premium').length,
        };
      }
      setDispatchStats(stats);
    } catch (err) {
      console.error('Erro ao carregar analytics:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [user, perfis]);

  useEffect(() => { if (analyticsTab === 'analytics') loadAnalytics(); }, [analyticsTab, loadAnalytics]);

  const handleNovo = () => {
    setEditando({
      ...defaultPerfil,
      id: '',
      created_at: '',
      empresa_id: empresaAtiva?.id || null,
    } as PerfilAlerta);
    setDialogOpen(true);
  };

  const handleEditar = (p: PerfilAlerta) => {
    setEditando({ ...p });
    setDialogOpen(true);
  };

  const handleSalvar = async () => {
    if (!editando || !user) return;
    setSaving(true);
    try {
      const payload: any = {
        user_id: user.id,
        empresa_id: editando.empresa_id,
        nome: editando.nome,
        ativo: editando.ativo,
        cor: editando.cor,
        cnaes: editando.cnaes,
        palavras_chave: editando.palavras_chave,
        palavras_negativas: editando.palavras_negativas,
        ufs: editando.ufs,
        municipios: editando.municipios,
        modalidades: editando.modalidades,
        orgaos_favoritos: editando.orgaos_favoritos,
        orgaos_bloqueados: editando.orgaos_bloqueados,
        valor_minimo: editando.valor_minimo,
        valor_maximo: editando.valor_maximo,
        exclusividade_meepp: editando.exclusividade_meepp,
        peso_cnae: editando.peso_cnae,
        peso_palavra_chave: editando.peso_palavra_chave,
        peso_regiao: editando.peso_regiao,
        peso_modalidade: editando.peso_modalidade,
        peso_valor: editando.peso_valor,
        peso_urgencia: editando.peso_urgencia,
        canal_email: editando.canal_email,
        canal_whatsapp: editando.canal_whatsapp,
        canal_sistema: editando.canal_sistema,
        frequencia: editando.frequencia,
        horarios_disparo: editando.horarios_disparo,
      };

      if (editando.id) {
        const { error } = await supabase.from('perfis_alerta').update(payload).eq('id', editando.id);
        if (error) throw error;
        toast.success('Perfil atualizado!');
      } else {
        const { error } = await supabase.from('perfis_alerta').insert(payload);
        if (error) throw error;
        toast.success('Perfil criado!');
      }
      setDialogOpen(false);
      setEditando(null);
      loadPerfis();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este perfil de alerta?')) return;
    await supabase.from('perfis_alerta').delete().eq('id', id);
    toast.success('Perfil excluído');
    loadPerfis();
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('perfis_alerta').update({ ativo: !ativo }).eq('id', id);
    loadPerfis();
  };

  const handleCalcularScores = async () => {
    setCalculando(true);
    try {
      const { data, error } = await supabase.functions.invoke('calcular-scores', {
        body: {},
      });
      if (error) throw error;
      setScoreResults(data);
      toast.success(`${data?.scores_calculados || 0} scores calculados!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao calcular scores');
    } finally {
      setCalculando(false);
    }
  };

  const addToArray = (field: keyof PerfilAlerta, value: string, setter: (v: string) => void) => {
    if (!editando || !value.trim()) return;
    const arr = (editando[field] as string[]) || [];
    if (!arr.includes(value.trim())) {
      setEditando({ ...editando, [field]: [...arr, value.trim()] });
    }
    setter('');
  };

  const removeFromArray = (field: keyof PerfilAlerta, idx: number) => {
    if (!editando) return;
    const arr = [...((editando[field] as string[]) || [])];
    arr.splice(idx, 1);
    setEditando({ ...editando, [field]: arr });
  };

  const toggleInArray = (field: keyof PerfilAlerta, value: string) => {
    if (!editando) return;
    const arr = (editando[field] as string[]) || [];
    if (arr.includes(value)) {
      setEditando({ ...editando, [field]: arr.filter(v => v !== value) });
    } else {
      setEditando({ ...editando, [field]: [...arr, value] });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <CabecalhoPagina
          titulo="Perfis de alerta"
          descricao="Perfis que decidem quais licitações viram alerta para você, e por qual canal"
          icone={<Target />}
          trilha={[
            { rotulo: 'Painel', para: '/dashboard' },
            { rotulo: 'Monitoramento' },
            { rotulo: 'Perfis de alerta' },
          ]}
          acoes={
            <>
              <Button variant="outline" onClick={handleCalcularScores} disabled={calculando}>
                {calculando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}
                Calcular scores
              </Button>
              <Button onClick={handleNovo}>
                <Plus aria-hidden="true" /> Novo perfil
              </Button>
            </>
          }
        />

        {/* Score results */}
        {scoreResults && (
          <Alert variant="success" className="mb-4">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Matching concluído:</span>
              <Badge variant="muted">{scoreResults.total_perfis} perfis</Badge>
              <span aria-hidden="true">×</span>
              <Badge variant="muted">{scoreResults.total_licitacoes} licitações</Badge>
              <span aria-hidden="true">=</span>
              <Badge variant="success">{scoreResults.scores_calculados} scores</Badge>
              {(scoreResults.dispatches_criados ?? 0) > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <Badge variant="info">{scoreResults.dispatches_criados} alertas</Badge>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={analyticsTab} onValueChange={(v) => setAnalyticsTab(v as 'perfis' | 'analytics')} className="space-y-4">
          <TabsList>
            <TabsTrigger value="perfis" className="gap-2">
              <Target className="h-4 w-4" aria-hidden="true" />
              Perfis
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfis">
            {/* Lista de perfis */}
            {loading ? (
              <div role="status" aria-busy="true" className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Carregando perfis de alerta</span>
              </div>
            ) : perfis.length === 0 ? (
              <Card>
                <EstadoVazio
                  icone={<Target />}
                  titulo="Nenhum perfil de alerta"
                  descricao="Crie perfis para receber alertas personalizados de licitações."
                  acao={<Button onClick={handleNovo}><Plus aria-hidden="true" /> Criar primeiro perfil</Button>}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {perfis.map(p => (
                  <Card key={p.id} className={cn('relative p-6 transition-colors', !p.ativo && 'opacity-60')}>
                    <div className="absolute right-4 top-4 flex items-center gap-2">
                      <Switch
                        id={`perfil-ativo-${p.id}`}
                        checked={p.ativo}
                        onCheckedChange={() => handleToggleAtivo(p.id, p.ativo)}
                      />
                      <Label htmlFor={`perfil-ativo-${p.id}`} className="sr-only">
                        {p.ativo ? `Desativar o perfil ${p.nome}` : `Ativar o perfil ${p.nome}`}
                      </Label>
                    </div>
                    <div className="mb-3 flex items-center gap-3 pr-14">
                      {/* A cor é dado do usuário (gravada na linha do perfil), por
                          isso vem de `style` — o resto do cartão é token. */}
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: p.cor + '20' }}
                      >
                        <Target className="h-4 w-4" style={{ color: p.cor }} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-foreground">{p.nome}</h2>
                        <p className="text-xs text-muted-foreground">{p.frequencia}</p>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {p.palavras_chave?.slice(0, 3).map(kw => (
                        <Badge key={kw} variant="muted">{kw}</Badge>
                      ))}
                      {(p.palavras_chave?.length || 0) > 3 && (
                        <Badge variant="muted">+{p.palavras_chave.length - 3}</Badge>
                      )}
                    </div>

                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.ufs?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />{p.ufs.slice(0, 3).join(', ')}
                        </span>
                      )}
                      {p.modalidades?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" aria-hidden="true" />{p.modalidades.length} mod.
                        </span>
                      )}
                      {p.cnaes?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" aria-hidden="true" />{p.cnaes.length} CNAEs
                        </span>
                      )}
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      {p.canal_email && <Badge variant="info" className="gap-1"><Mail className="h-3 w-3" aria-hidden="true" />E-mail</Badge>}
                      {p.canal_whatsapp && <Badge variant="info" className="gap-1"><MessageSquare className="h-3 w-3" aria-hidden="true" />WhatsApp</Badge>}
                      {p.canal_sistema && <Badge variant="info" className="gap-1"><Bell className="h-3 w-3" aria-hidden="true" />Sistema</Badge>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditar(p)} className="flex-1">
                        <Pencil aria-hidden="true" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Excluir o perfil ${p.nome}`} onClick={() => handleExcluir(p.id)} className="text-destructive hover:text-destructive">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Legenda de classificações */}
            <Card className="mt-6 p-6">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Classificação automática de licitações
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                O selo que cada processo recebe depois do cálculo de score, e o critério que o define
              </p>
              <ul className="flex flex-col gap-3">
                {CLASSIFICACAO_CONFIG.map(cfg => {
                  const Icone = cfg.icone;
                  return (
                    <li key={cfg.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge variant={cfg.variante} className="gap-1">
                        <Icone className="h-3 w-3" aria-hidden="true" />
                        {cfg.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{cfg.criterio}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-4">
            {loadingStats ? (
              <div role="status" aria-busy="true" className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Carregando o desempenho dos perfis</span>
              </div>
            ) : perfis.length === 0 ? (
              <Card>
                <EstadoVazio
                  icone={<BarChart3 />}
                  titulo="Nada para medir ainda"
                  descricao="Crie perfis de alerta para acompanhar o desempenho de cada um aqui."
                  acao={<Button onClick={handleNovo}><Plus aria-hidden="true" /> Novo perfil</Button>}
                />
              </Card>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="p-6 text-center">
                    <Target className="mx-auto mb-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">{perfis.length}</p>
                    {/* O número conta TODOS os perfis, inclusive os desligados —
                        o rótulo diz o que ele mede. */}
                    <p className="text-sm text-muted-foreground">Perfis cadastrados</p>
                  </Card>
                  <Card className="p-6 text-center">
                    <Send className="mx-auto mb-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">
                      {Object.values(dispatchStats).reduce((sum, s) => sum + s.total, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Alertas totais</p>
                  </Card>
                  <Card className="p-6 text-center">
                    <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-success" aria-hidden="true" />
                    <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">
                      {Object.values(dispatchStats).reduce((sum, s) => sum + s.enviado, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Enviados</p>
                  </Card>
                  <Card className="p-6 text-center">
                    <Flame className="mx-auto mb-1 h-5 w-5 text-destructive" aria-hidden="true" />
                    <p className="text-[2rem] font-bold leading-10 tabular-nums text-foreground">
                      {Object.values(dispatchStats).reduce((sum, s) => sum + s.quente, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Oportunidades quentes</p>
                  </Card>
                </div>

                {/* Per-profile analytics */}
                <h2 className="mt-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Desempenho por perfil
                </h2>
                <div className="space-y-4">
                  {perfis.map(p => {
                    const stats = dispatchStats[p.id] || ESTATISTICA_ZERADA;
                    const celulas: { rotulo: string; valor: number; classe?: string }[] = [
                      { rotulo: 'Alertas', valor: stats.total },
                      { rotulo: 'Enviados', valor: stats.enviado, classe: 'text-success-ink' },
                      { rotulo: 'Pendentes', valor: stats.pendente, classe: 'text-warning-ink' },
                      { rotulo: 'Falhas', valor: stats.falhou, classe: 'text-destructive-ink' },
                      { rotulo: 'Quentes', valor: stats.quente },
                      { rotulo: 'Urgentes', valor: stats.urgente },
                      { rotulo: 'Premium', valor: stats.premium },
                    ];
                    return (
                      <Card key={p.id} className="p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          {/* Cor do perfil: dado do usuário, por isso `style`. */}
                          <span
                            aria-hidden="true"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                            style={{ backgroundColor: p.cor + '20' }}
                          >
                            <Target className="h-3 w-3" style={{ color: p.cor }} />
                          </span>
                          <span className="text-base font-semibold text-foreground">{p.nome}</span>
                          {!p.ativo && <Badge variant="muted">Inativo</Badge>}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4 lg:grid-cols-7">
                          {celulas.map(c => (
                            <div key={c.rotulo}>
                              <p className={cn('text-lg font-semibold tabular-nums text-foreground', c.classe)}>{c.valor}</p>
                              <p className="text-xs text-muted-foreground">{c.rotulo}</p>
                            </div>
                          ))}
                        </div>
                        {stats.total > 0 && (
                          <div
                            role="img"
                            aria-label={`${stats.enviado} enviados, ${stats.pendente} pendentes e ${stats.falhou} falhas de ${stats.total} alertas`}
                            className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted"
                          >
                            <div className="h-full bg-success" style={{ width: `${(stats.enviado / stats.total) * 100}%` }} />
                            <div className="h-full bg-warning" style={{ width: `${(stats.pendente / stats.total) * 100}%` }} />
                            <div className="h-full bg-destructive" style={{ width: `${(stats.falhou / stats.total) * 100}%` }} />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando?.id ? 'Editar perfil' : 'Novo perfil de alerta'}</DialogTitle>
          </DialogHeader>

          {editando && (
            <Tabs defaultValue="filtros" className="w-full">
              {/* O TabsList já embrulha sozinho — a fila de 5 abas quebra em
                  duas linhas no celular sem precisar de largura forçada. */}
              <TabsList className="mb-4">
                <TabsTrigger value="filtros" className="gap-2"><Search className="h-4 w-4" aria-hidden="true" />Filtros</TabsTrigger>
                <TabsTrigger value="regiao" className="gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />Região</TabsTrigger>
                <TabsTrigger value="orgaos" className="gap-2"><Building2 className="h-4 w-4" aria-hidden="true" />Órgãos</TabsTrigger>
                <TabsTrigger value="pesos" className="gap-2"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Pesos</TabsTrigger>
                <TabsTrigger value="canais" className="gap-2"><Bell className="h-4 w-4" aria-hidden="true" />Canais</TabsTrigger>
              </TabsList>

              {/* Dados básicos */}
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="perfil-nome" className="mb-2 block text-sm">Nome do perfil</Label>
                  <Input id="perfil-nome" value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} placeholder="Ex: Merenda Escolar" />
                </div>
                <div>
                  <span className="mb-2 block text-sm font-medium">Cor</span>
                  {/* A cor é dado do usuário (fica gravada na linha do perfil), por
                      isso vem de `style` e não de token — o contorno e o foco, não. */}
                  <div className="flex flex-wrap gap-2">
                    {CORES_PERFIL.map(cor => (
                      <button
                        key={cor}
                        type="button"
                        aria-label={`Usar a cor ${cor}`}
                        aria-pressed={editando.cor === cor}
                        onClick={() => setEditando({ ...editando, cor })}
                        className={cn(
                          'h-8 w-8 rounded-md border-2 transition-all',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          editando.cor === cor ? 'border-foreground scale-110' : 'border-transparent',
                        )}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab: Filtros */}
              <TabsContent value="filtros" className="space-y-4">
                {/* CNAEs */}
                <div>
                  <Label htmlFor="perfil-cnae" className="mb-2 block text-sm font-semibold">CNAEs</Label>
                  <div className="flex gap-2">
                    <Input id="perfil-cnae" value={tempCnae} onChange={e => setTempCnae(e.target.value)} placeholder="Ex: 4751-2/01"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('cnaes', tempCnae, setTempCnae))} />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Adicionar CNAE" onClick={() => addToArray('cnaes', tempCnae, setTempCnae)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editando.cnaes?.map((c, i) => (
                      <button key={i} type="button" aria-label={`Remover o CNAE ${c}`} onClick={() => removeFromArray('cnaes', i)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Badge variant="muted" className="gap-1">
                          {c} <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Palavras-chave */}
                <div>
                  <Label htmlFor="perfil-palavra" className="mb-2 block text-sm font-semibold">Palavras-chave (positivas)</Label>
                  <div className="flex gap-2">
                    <Input id="perfil-palavra" value={tempPalavra} onChange={e => setTempPalavra(e.target.value)} placeholder="Ex: material de escritório"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('palavras_chave', tempPalavra, setTempPalavra))} />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Adicionar palavra-chave" onClick={() => addToArray('palavras_chave', tempPalavra, setTempPalavra)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editando.palavras_chave?.map((kw, i) => (
                      <button key={i} type="button" aria-label={`Remover a palavra-chave ${kw}`} onClick={() => removeFromArray('palavras_chave', i)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Badge variant="success" className="gap-1">
                          {kw} <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Palavras negativas */}
                <div>
                  <Label htmlFor="perfil-negativa" className="mb-2 block text-sm font-semibold">Palavras negativas (excluir)</Label>
                  <div className="flex gap-2">
                    <Input id="perfil-negativa" value={tempNeg} onChange={e => setTempNeg(e.target.value)} placeholder="Ex: obra, construção"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('palavras_negativas', tempNeg, setTempNeg))} />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Adicionar palavra negativa" onClick={() => addToArray('palavras_negativas', tempNeg, setTempNeg)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editando.palavras_negativas?.map((neg, i) => (
                      <button key={i} type="button" aria-label={`Remover a palavra negativa ${neg}`} onClick={() => removeFromArray('palavras_negativas', i)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Badge variant="danger" className="gap-1">
                          {neg} <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modalidades */}
                <div>
                  <span className="mb-2 block text-sm font-semibold">Modalidades</span>
                  <div className="flex flex-wrap gap-2">
                    {MODALIDADES.map(mod => (
                      <button
                        key={mod}
                        type="button"
                        aria-pressed={editando.modalidades?.includes(mod)}
                        onClick={() => toggleInArray('modalidades', mod)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Badge variant={editando.modalidades?.includes(mod) ? 'default' : 'outline'} className="transition-colors">
                          {mod}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Valor */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="perfil-valor-min" className="mb-2 block text-sm">Valor mínimo (R$)</Label>
                    <MoneyInput id="perfil-valor-min" value={editando.valor_minimo ?? 0}
                      onValueChange={v => setEditando({ ...editando, valor_minimo: v || null })} />
                  </div>
                  <div>
                    <Label htmlFor="perfil-valor-max" className="mb-2 block text-sm">Valor máximo (R$)</Label>
                    <MoneyInput id="perfil-valor-max" value={editando.valor_maximo ?? 0}
                      onValueChange={v => setEditando({ ...editando, valor_maximo: v || null })} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch id="perfil-meepp" checked={editando.exclusividade_meepp} onCheckedChange={v => setEditando({ ...editando, exclusividade_meepp: v })} />
                  <Label htmlFor="perfil-meepp" className="text-sm">Priorizar licitações exclusivas ME/EPP</Label>
                </div>
              </TabsContent>

              {/* Tab: Região */}
              <TabsContent value="regiao" className="space-y-4">
                <div>
                  <span className="mb-2 block text-sm font-semibold">UFs de interesse</span>
                  <div className="flex flex-wrap gap-2">
                    {UFS_BRASIL.map(uf => (
                      <button
                        key={uf}
                        type="button"
                        aria-pressed={editando.ufs?.includes(uf)}
                        onClick={() => toggleInArray('ufs', uf)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Badge variant={editando.ufs?.includes(uf) ? 'default' : 'outline'} className="w-10 justify-center">
                          {uf}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="perfil-municipio" className="mb-2 block text-sm font-semibold">Municípios prioritários</Label>
                  <div className="flex gap-2">
                    <Input id="perfil-municipio" value={tempMunicipio} onChange={e => setTempMunicipio(e.target.value)} placeholder="Ex: Belém, São Paulo"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('municipios', tempMunicipio, setTempMunicipio))} />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Adicionar município" onClick={() => addToArray('municipios', tempMunicipio, setTempMunicipio)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editando.municipios?.map((m, i) => (
                      <button key={i} type="button" aria-label={`Remover o município ${m}`} onClick={() => removeFromArray('municipios', i)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Badge variant="muted" className="gap-1">
                          {m} <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Órgãos */}
              <TabsContent value="orgaos" className="space-y-4">
                <div>
                  <Label htmlFor="perfil-orgao-fav" className="mb-2 block text-sm font-semibold">Órgãos favoritos</Label>
                  <div className="flex gap-2">
                    <Input id="perfil-orgao-fav" value={tempOrgaoFav} onChange={e => setTempOrgaoFav(e.target.value)} placeholder="Ex: Ministério da Saúde"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('orgaos_favoritos', tempOrgaoFav, setTempOrgaoFav))} />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Adicionar órgão favorito" onClick={() => addToArray('orgaos_favoritos', tempOrgaoFav, setTempOrgaoFav)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editando.orgaos_favoritos?.map((o, i) => (
                      <button key={i} type="button" aria-label={`Remover o órgão favorito ${o}`} onClick={() => removeFromArray('orgaos_favoritos', i)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Badge variant="success" className="gap-1">
                          {o} <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="perfil-orgao-bloq" className="mb-2 block text-sm font-semibold">Órgãos bloqueados</Label>
                  <div className="flex gap-2">
                    <Input id="perfil-orgao-bloq" value={tempOrgaoBlock} onChange={e => setTempOrgaoBlock(e.target.value)} placeholder="Ex: Prefeitura de..."
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('orgaos_bloqueados', tempOrgaoBlock, setTempOrgaoBlock))} />
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Adicionar órgão bloqueado" onClick={() => addToArray('orgaos_bloqueados', tempOrgaoBlock, setTempOrgaoBlock)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editando.orgaos_bloqueados?.map((o, i) => (
                      <button key={i} type="button" aria-label={`Remover o órgão bloqueado ${o}`} onClick={() => removeFromArray('orgaos_bloqueados', i)}
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <Badge variant="danger" className="gap-1">
                          {o} <X className="h-3 w-3" aria-hidden="true" />
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Pesos */}
              <TabsContent value="pesos" className="space-y-4">
                <p className="text-sm text-muted-foreground">Ajuste os pesos de cada critério para personalizar o score de aderência (total = 100%).</p>

                {[
                  { key: 'peso_cnae' as const, label: 'CNAE', icon: Tag },
                  { key: 'peso_palavra_chave' as const, label: 'Palavra-chave', icon: Search },
                  { key: 'peso_regiao' as const, label: 'Região', icon: MapPin },
                  { key: 'peso_modalidade' as const, label: 'Modalidade', icon: Shield },
                  { key: 'peso_valor' as const, label: 'Faixa de Valor', icon: Target },
                  { key: 'peso_urgencia' as const, label: 'Urgência', icon: Clock },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span id={`rotulo-${key}`} className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{editando[key]}%</span>
                    </div>
                    <Slider aria-labelledby={`rotulo-${key}`} value={[editando[key]]} min={0} max={100} step={5}
                      onValueChange={([v]) => setEditando({ ...editando, [key]: v })} />
                  </div>
                ))}

                <div className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
                  <strong className="font-semibold">Soma atual:</strong>{' '}
                  <span className="tabular-nums">
                    {editando.peso_cnae + editando.peso_palavra_chave + editando.peso_regiao + editando.peso_modalidade + editando.peso_valor + editando.peso_urgencia}%
                  </span>
                  {(editando.peso_cnae + editando.peso_palavra_chave + editando.peso_regiao + editando.peso_modalidade + editando.peso_valor + editando.peso_urgencia) !== 100 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-warning-ink">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Recomendado: 100%
                    </span>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Canais */}
              <TabsContent value="canais" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Label htmlFor="perfil-canal-email" className="text-sm font-medium">E-mail</Label>
                    </div>
                    <Switch id="perfil-canal-email" checked={editando.canal_email} onCheckedChange={v => setEditando({ ...editando, canal_email: v })} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Label htmlFor="perfil-canal-whatsapp" className="text-sm font-medium">WhatsApp</Label>
                    </div>
                    <Switch id="perfil-canal-whatsapp" checked={editando.canal_whatsapp} onCheckedChange={v => setEditando({ ...editando, canal_whatsapp: v })} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted p-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Label htmlFor="perfil-canal-sistema" className="text-sm font-medium">Notificação no sistema</Label>
                    </div>
                    <Switch id="perfil-canal-sistema" checked={editando.canal_sistema} onCheckedChange={v => setEditando({ ...editando, canal_sistema: v })} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="perfil-frequencia" className="mb-2 block text-sm font-semibold">Frequência de envio</Label>
                  <Select value={editando.frequencia} onValueChange={v => setEditando({ ...editando, frequencia: v })}>
                    <SelectTrigger id="perfil-frequencia"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imediato">Imediato</SelectItem>
                      <SelectItem value="resumo_diario">Resumo diário</SelectItem>
                      <SelectItem value="resumo_turno">Resumo por turno</SelectItem>
                      <SelectItem value="resumo_semanal">Resumo semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Salvar perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
