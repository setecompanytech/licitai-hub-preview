import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Pencil, Trash2, Search, MapPin, Building2, Tag, Shield,
  Bell, Mail, MessageSquare, Loader2, Save, Target, Flame,
  Clock, Star, Globe, AlertTriangle, Zap, CheckCircle2,
  SlidersHorizontal, X, BarChart3, Send, Eye, TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

const UFS_BRASIL = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

const MODALIDADES = [
  'Pregão Eletrônico', 'Concorrência', 'Concorrência Eletrônica',
  'Dispensa de Licitação', 'Inexigibilidade', 'Credenciamento',
  'Leilão', 'Diálogo Competitivo', 'Concurso', 'Manifestação de Interesse',
  'Pré-qualificação', 'Leilão Eletrônico', 'Concurso Eletrônico',
];

const CORES_PERFIL = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CLASSIFICACAO_CONFIG: Record<string, { label: string; cor: string; icon: any }> = {
  quente: { label: '🔥 Quente', cor: 'bg-red-500', icon: Flame },
  urgente: { label: '⚡ Urgente', cor: 'bg-orange-500', icon: Clock },
  premium: { label: '⭐ Premium', cor: 'bg-yellow-500', icon: Star },
  regional: { label: '📍 Regional', cor: 'bg-blue-500', icon: MapPin },
  normal: { label: '📋 Normal', cor: 'bg-muted', icon: Search },
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
  const [scoreResults, setScoreResults] = useState<any>(null);

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
    setPerfis((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadPerfis(); }, [loadPerfis]);

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
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="w-6 h-6 text-accent" />
              Perfis de Alerta
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Crie perfis personalizados para receber alertas de licitações relevantes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCalcularScores} disabled={calculando} className="gap-1.5">
              {calculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Calcular Scores
            </Button>
            <Button size="sm" onClick={handleNovo} className="gap-1.5">
              <Plus className="w-4 h-4" /> Novo Perfil
            </Button>
          </div>
        </div>

        {/* Score results */}
        {scoreResults && (
          <Card className="p-4 mb-4 border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span className="font-medium">Matching concluído:</span>
              <Badge variant="secondary">{scoreResults.total_perfis} perfis</Badge>
              <span>×</span>
              <Badge variant="secondary">{scoreResults.total_licitacoes} licitações</Badge>
              <span>=</span>
              <Badge className="bg-accent text-accent-foreground">{scoreResults.scores_calculados} scores</Badge>
            </div>
          </Card>
        )}

        {/* Lista de perfis */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : perfis.length === 0 ? (
          <Card className="p-12 text-center">
            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum perfil de alerta</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie perfis para receber alertas personalizados de licitações
            </p>
            <Button onClick={handleNovo} className="gap-1.5">
              <Plus className="w-4 h-4" /> Criar Primeiro Perfil
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perfis.map(p => (
              <Card key={p.id} className={`p-4 relative transition-all ${!p.ativo ? 'opacity-50' : ''}`}>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <Switch checked={p.ativo} onCheckedChange={() => handleToggleAtivo(p.id, p.ativo)} />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.cor + '20' }}>
                    <Target className="w-4 h-4" style={{ color: p.cor }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{p.nome}</h3>
                    <p className="text-[10px] text-muted-foreground">{p.frequencia}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {p.palavras_chave?.slice(0, 3).map(kw => (
                    <Badge key={kw} variant="secondary" className="text-[10px]">{kw}</Badge>
                  ))}
                  {(p.palavras_chave?.length || 0) > 3 && (
                    <Badge variant="outline" className="text-[10px]">+{p.palavras_chave.length - 3}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-3 text-[10px] text-muted-foreground">
                  {p.ufs?.length > 0 && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.ufs.slice(0, 3).join(', ')}</span>}
                  {p.modalidades?.length > 0 && <span className="flex items-center gap-0.5 ml-2"><Shield className="w-3 h-3" />{p.modalidades.length} mod.</span>}
                  {p.cnaes?.length > 0 && <span className="flex items-center gap-0.5 ml-2"><Tag className="w-3 h-3" />{p.cnaes.length} CNAEs</span>}
                </div>

                <div className="flex items-center gap-1 mb-3">
                  {p.canal_email && <Badge variant="outline" className="text-[10px] gap-0.5"><Mail className="w-3 h-3" />E-mail</Badge>}
                  {p.canal_whatsapp && <Badge variant="outline" className="text-[10px] gap-0.5"><MessageSquare className="w-3 h-3" />WhatsApp</Badge>}
                  {p.canal_sistema && <Badge variant="outline" className="text-[10px] gap-0.5"><Bell className="w-3 h-3" />Sistema</Badge>}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditar(p)} className="flex-1 gap-1 text-xs">
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleExcluir(p.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Legenda de classificações */}
        <Card className="mt-6 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-accent" />
            Classificação Automática de Licitações
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(CLASSIFICACAO_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <div className={`w-3 h-3 rounded-full ${cfg.cor}`} />
                <span>{cfg.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            🔥 Quente: Score ≥80% + Urgência ≥80% · ⚡ Urgente: Abertura ≤3 dias · ⭐ Premium: Score ≥70% · 📍 Regional: Match geográfico + Score ≥50%
          </p>
        </Card>
      </div>

      {/* Dialog de edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando?.id ? 'Editar Perfil' : 'Novo Perfil de Alerta'}</DialogTitle>
          </DialogHeader>

          {editando && (
            <Tabs defaultValue="filtros" className="w-full">
              <TabsList className="w-full justify-start mb-4">
                <TabsTrigger value="filtros" className="gap-1 text-xs"><Search className="w-3.5 h-3.5" />Filtros</TabsTrigger>
                <TabsTrigger value="regiao" className="gap-1 text-xs"><MapPin className="w-3.5 h-3.5" />Região</TabsTrigger>
                <TabsTrigger value="orgaos" className="gap-1 text-xs"><Building2 className="w-3.5 h-3.5" />Órgãos</TabsTrigger>
                <TabsTrigger value="pesos" className="gap-1 text-xs"><SlidersHorizontal className="w-3.5 h-3.5" />Pesos</TabsTrigger>
                <TabsTrigger value="canais" className="gap-1 text-xs"><Bell className="w-3.5 h-3.5" />Canais</TabsTrigger>
              </TabsList>

              {/* Dados básicos */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label className="text-xs">Nome do Perfil</Label>
                  <Input value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} className="mt-1" placeholder="Ex: Merenda Escolar" />
                </div>
                <div>
                  <Label className="text-xs">Cor</Label>
                  <div className="flex gap-1 mt-1">
                    {CORES_PERFIL.map(cor => (
                      <button key={cor} onClick={() => setEditando({ ...editando, cor })}
                        className={`w-7 h-7 rounded-lg border-2 transition-all ${editando.cor === cor ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: cor }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab: Filtros */}
              <TabsContent value="filtros" className="space-y-4">
                {/* CNAEs */}
                <div>
                  <Label className="text-xs font-semibold">CNAEs</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tempCnae} onChange={e => setTempCnae(e.target.value)} placeholder="Ex: 4751-2/01" className="text-xs"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('cnaes', tempCnae, setTempCnae))} />
                    <Button size="sm" variant="outline" onClick={() => addToArray('cnaes', tempCnae, setTempCnae)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.cnaes?.map((c, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => removeFromArray('cnaes', i)}>
                        {c} <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Palavras-chave */}
                <div>
                  <Label className="text-xs font-semibold text-green-600">Palavras-chave (positivas)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tempPalavra} onChange={e => setTempPalavra(e.target.value)} placeholder="Ex: material de escritório" className="text-xs"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('palavras_chave', tempPalavra, setTempPalavra))} />
                    <Button size="sm" variant="outline" onClick={() => addToArray('palavras_chave', tempPalavra, setTempPalavra)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.palavras_chave?.map((kw, i) => (
                      <Badge key={i} className="gap-1 text-xs cursor-pointer bg-green-100 text-green-800 hover:bg-green-200" onClick={() => removeFromArray('palavras_chave', i)}>
                        {kw} <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Palavras negativas */}
                <div>
                  <Label className="text-xs font-semibold text-red-600">Palavras negativas (excluir)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tempNeg} onChange={e => setTempNeg(e.target.value)} placeholder="Ex: obra, construção" className="text-xs"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('palavras_negativas', tempNeg, setTempNeg))} />
                    <Button size="sm" variant="outline" onClick={() => addToArray('palavras_negativas', tempNeg, setTempNeg)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.palavras_negativas?.map((neg, i) => (
                      <Badge key={i} className="gap-1 text-xs cursor-pointer bg-red-100 text-red-800 hover:bg-red-200" onClick={() => removeFromArray('palavras_negativas', i)}>
                        {neg} <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Modalidades */}
                <div>
                  <Label className="text-xs font-semibold">Modalidades</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {MODALIDADES.map(mod => (
                      <Badge key={mod} variant={editando.modalidades?.includes(mod) ? 'default' : 'outline'}
                        className="text-[10px] cursor-pointer transition-colors"
                        onClick={() => toggleInArray('modalidades', mod)}>
                        {mod}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Valor */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor Mínimo (R$)</Label>
                    <Input type="number" value={editando.valor_minimo ?? ''} className="mt-1"
                      onChange={e => setEditando({ ...editando, valor_minimo: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label className="text-xs">Valor Máximo (R$)</Label>
                    <Input type="number" value={editando.valor_maximo ?? ''} className="mt-1"
                      onChange={e => setEditando({ ...editando, valor_maximo: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={editando.exclusividade_meepp} onCheckedChange={v => setEditando({ ...editando, exclusividade_meepp: v })} />
                  <Label className="text-xs">Priorizar licitações exclusivas ME/EPP</Label>
                </div>
              </TabsContent>

              {/* Tab: Região */}
              <TabsContent value="regiao" className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">UFs de Interesse</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {UFS_BRASIL.map(uf => (
                      <Badge key={uf} variant={editando.ufs?.includes(uf) ? 'default' : 'outline'}
                        className="text-xs cursor-pointer w-10 justify-center"
                        onClick={() => toggleInArray('ufs', uf)}>
                        {uf}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Municípios Prioritários</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tempMunicipio} onChange={e => setTempMunicipio(e.target.value)} placeholder="Ex: Belém, São Paulo" className="text-xs"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('municipios', tempMunicipio, setTempMunicipio))} />
                    <Button size="sm" variant="outline" onClick={() => addToArray('municipios', tempMunicipio, setTempMunicipio)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.municipios?.map((m, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => removeFromArray('municipios', i)}>
                        {m} <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Órgãos */}
              <TabsContent value="orgaos" className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-green-600">Órgãos Favoritos</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tempOrgaoFav} onChange={e => setTempOrgaoFav(e.target.value)} placeholder="Ex: Ministério da Saúde" className="text-xs"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('orgaos_favoritos', tempOrgaoFav, setTempOrgaoFav))} />
                    <Button size="sm" variant="outline" onClick={() => addToArray('orgaos_favoritos', tempOrgaoFav, setTempOrgaoFav)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.orgaos_favoritos?.map((o, i) => (
                      <Badge key={i} className="gap-1 text-xs cursor-pointer bg-green-100 text-green-800" onClick={() => removeFromArray('orgaos_favoritos', i)}>
                        {o} <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-red-600">Órgãos Bloqueados</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tempOrgaoBlock} onChange={e => setTempOrgaoBlock(e.target.value)} placeholder="Ex: Prefeitura de..." className="text-xs"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addToArray('orgaos_bloqueados', tempOrgaoBlock, setTempOrgaoBlock))} />
                    <Button size="sm" variant="outline" onClick={() => addToArray('orgaos_bloqueados', tempOrgaoBlock, setTempOrgaoBlock)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.orgaos_bloqueados?.map((o, i) => (
                      <Badge key={i} className="gap-1 text-xs cursor-pointer bg-red-100 text-red-800" onClick={() => removeFromArray('orgaos_bloqueados', i)}>
                        {o} <X className="w-3 h-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Pesos */}
              <TabsContent value="pesos" className="space-y-4">
                <p className="text-xs text-muted-foreground">Ajuste os pesos de cada critério para personalizar o score de aderência (total = 100%).</p>

                {[
                  { key: 'peso_cnae' as const, label: 'CNAE', icon: Tag },
                  { key: 'peso_palavra_chave' as const, label: 'Palavra-chave', icon: Search },
                  { key: 'peso_regiao' as const, label: 'Região', icon: MapPin },
                  { key: 'peso_modalidade' as const, label: 'Modalidade', icon: Shield },
                  { key: 'peso_valor' as const, label: 'Faixa de Valor', icon: Target },
                  { key: 'peso_urgencia' as const, label: 'Urgência', icon: Clock },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-accent" />{label}</Label>
                      <span className="text-xs font-mono font-bold">{editando[key]}%</span>
                    </div>
                    <Slider value={[editando[key]]} min={0} max={100} step={5}
                      onValueChange={([v]) => setEditando({ ...editando, [key]: v })} />
                  </div>
                ))}

                <div className="p-3 rounded-lg bg-muted/50 text-xs">
                  <strong>Soma atual:</strong>{' '}
                  {editando.peso_cnae + editando.peso_palavra_chave + editando.peso_regiao + editando.peso_modalidade + editando.peso_valor + editando.peso_urgencia}%
                  {(editando.peso_cnae + editando.peso_palavra_chave + editando.peso_regiao + editando.peso_modalidade + editando.peso_valor + editando.peso_urgencia) !== 100 && (
                    <span className="text-orange-600 ml-2">
                      <AlertTriangle className="w-3 h-3 inline" /> Recomendado: 100%
                    </span>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Canais */}
              <TabsContent value="canais" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-accent" />
                      <Label className="text-xs">E-mail</Label>
                    </div>
                    <Switch checked={editando.canal_email} onCheckedChange={v => setEditando({ ...editando, canal_email: v })} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-500" />
                      <Label className="text-xs">WhatsApp</Label>
                    </div>
                    <Switch checked={editando.canal_whatsapp} onCheckedChange={v => setEditando({ ...editando, canal_whatsapp: v })} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-orange-500" />
                      <Label className="text-xs">Notificação no Sistema</Label>
                    </div>
                    <Switch checked={editando.canal_sistema} onCheckedChange={v => setEditando({ ...editando, canal_sistema: v })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Frequência de Envio</Label>
                  <Select value={editando.frequencia} onValueChange={v => setEditando({ ...editando, frequencia: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imediato">Imediato</SelectItem>
                      <SelectItem value="resumo_diario">Resumo Diário</SelectItem>
                      <SelectItem value="resumo_turno">Resumo por Turno</SelectItem>
                      <SelectItem value="resumo_semanal">Resumo Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Perfil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
