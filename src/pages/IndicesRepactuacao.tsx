import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import {
  TrendingUp, TrendingDown, RefreshCw, Calculator, FileText, Scale, Building2,
  HardHat, Users, DollarSign, Percent, CalendarDays, AlertTriangle, Sparkles,
  Plus, Search, Clock, ArrowUpRight, ArrowDownRight, Minus, Info, Save, Loader2, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type Indice = {
  id: string; nome: string; sigla: string; fonte: string; periodo: string;
  valor: number; variacao_mensal: number | null; variacao_anual: number | null;
  acumulado_12m: number | null; categoria: string;
};

type CCT = {
  id: string; categoria_profissional: string; sindicato_laboral: string | null;
  numero_registro_mte: string | null; vigencia_inicio: string | null;
  vigencia_fim: string | null; piso_salarial: number | null;
  reajuste_percentual: number | null; indice_reajuste: string | null;
  abrangencia_uf: string | null; status: string;
};

type SimResult = {
  valor_reajustado: number; diferenca: number; fundamentacao: string;
  parecer: string; alertas: string[]; indice_oficial_periodo: string | null;
};

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

const categoriaIcons: Record<string, typeof TrendingUp> = {
  inflacao: TrendingUp, construcao: Building2, salario: Users, juros: Percent,
};
const categoriaLabels: Record<string, string> = {
  inflacao: 'Inflação', construcao: 'Construção Civil', salario: 'Salário/Trabalho', juros: 'Juros/Monetário',
};

export default function IndicesRepactuacao() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('indices');
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [loadingIndices, setLoadingIndices] = useState(true);
  const [loadingCCTs, setLoadingCCTs] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [catFiltro, setCatFiltro] = useState('todos');

  // Simulador
  const [simValor, setSimValor] = useState('');
  const [simIndice, setSimIndice] = useState('IPCA');
  const [simPerc, setSimPerc] = useState('');
  const [simDataOrig, setSimDataOrig] = useState('');
  const [simDataReaj, setSimDataReaj] = useState('');
  const [simTipo, setSimTipo] = useState('continuado');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  // CCT form
  const [showCCTForm, setShowCCTForm] = useState(false);
  const [cctForm, setCctForm] = useState({ categoria_profissional: '', sindicato_laboral: '', numero_registro_mte: '', vigencia_inicio: '', vigencia_fim: '', piso_salarial: '', reajuste_percentual: '', indice_reajuste: 'INPC', abrangencia_uf: '' });

  useEffect(() => { fetchIndices(); fetchCCTs(); }, []);

  const fetchIndices = async () => {
    setLoadingIndices(true);
    const { data } = await supabase.from('indices_economicos').select('*').order('categoria').order('sigla');
    setIndices((data as Indice[]) || []);
    setLoadingIndices(false);
  };

  const fetchCCTs = async () => {
    setLoadingCCTs(true);
    const { data } = await supabase.from('convencoes_coletivas').select('*').order('created_at', { ascending: false });
    setCcts((data as CCT[]) || []);
    setLoadingCCTs(false);
  };

  const atualizarIndices = async () => {
    setAtualizando(true);
    try {
      const { data, error } = await supabase.functions.invoke('indices-economicos', {
        body: { action: 'atualizar_indices' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${data.indices_atualizados} índices atualizados com sucesso`);
        fetchIndices();
      } else {
        toast.error(data?.error || 'Erro ao atualizar');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar índices');
    } finally {
      setAtualizando(false);
    }
  };

  const simular = async () => {
    if (!simValor || !simPerc) { toast.error('Preencha valor e percentual'); return; }
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('indices-economicos', {
        body: {
          action: 'simular_repactuacao',
          valor_original: parseFloat(simValor.replace(/\./g, '').replace(',', '.')),
          indice: simIndice,
          percentual: parseFloat(simPerc.replace(',', '.')),
          data_base_original: simDataOrig,
          data_base_reajuste: simDataReaj,
          tipo_servico: simTipo,
        },
      });
      if (error) throw error;
      if (data?.success) setSimResult(data.data);
      else toast.error(data?.error || 'Erro na simulação');
    } catch (e: any) {
      toast.error(e.message || 'Erro na simulação');
    } finally {
      setSimLoading(false);
    }
  };

  const salvarCCT = async () => {
    if (!cctForm.categoria_profissional || !user) { toast.error('Informe a categoria profissional'); return; }
    const { error } = await supabase.from('convencoes_coletivas').insert({
      user_id: user.id,
      categoria_profissional: cctForm.categoria_profissional,
      sindicato_laboral: cctForm.sindicato_laboral || null,
      numero_registro_mte: cctForm.numero_registro_mte || null,
      vigencia_inicio: cctForm.vigencia_inicio || null,
      vigencia_fim: cctForm.vigencia_fim || null,
      piso_salarial: cctForm.piso_salarial ? parseFloat(cctForm.piso_salarial.replace(',', '.')) : null,
      reajuste_percentual: cctForm.reajuste_percentual ? parseFloat(cctForm.reajuste_percentual.replace(',', '.')) : null,
      indice_reajuste: cctForm.indice_reajuste,
      abrangencia_uf: cctForm.abrangencia_uf || null,
    });
    if (error) { toast.error('Erro ao salvar CCT'); return; }
    toast.success('Convenção Coletiva cadastrada');
    setShowCCTForm(false);
    setCctForm({ categoria_profissional: '', sindicato_laboral: '', numero_registro_mte: '', vigencia_inicio: '', vigencia_fim: '', piso_salarial: '', reajuste_percentual: '', indice_reajuste: 'INPC', abrangencia_uf: '' });
    fetchCCTs();
  };

  const filteredIndices = catFiltro === 'todos' ? indices : indices.filter(i => i.categoria === catFiltro);
  const categorias = [...new Set(indices.map(i => i.categoria))];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground flex-shrink-0" />
            Índices Econômicos & Repactuação
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Painel de índices oficiais, base de CCTs e simulador de repactuação — Lei 14.133/2021
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="indices">📊 Painel de Índices</TabsTrigger>
            <TabsTrigger value="ccts">📋 Convenções Coletivas</TabsTrigger>
            <TabsTrigger value="simulador">🧮 Simulador de Repactuação</TabsTrigger>
          </TabsList>

          {/* ═══ PAINEL DE ÍNDICES ═══ */}
          <TabsContent value="indices" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={atualizarIndices} disabled={atualizando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {atualizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {atualizando ? 'Atualizando via IA...' : 'Atualizar Índices'}
              </Button>
              <div className="flex gap-1 flex-wrap">
                <Badge variant={catFiltro === 'todos' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCatFiltro('todos')}>Todos</Badge>
                {categorias.map(c => (
                  <Badge key={c} variant={catFiltro === c ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCatFiltro(c)}>
                    {categoriaLabels[c] || c}
                  </Badge>
                ))}
              </div>
            </div>

            {loadingIndices ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ) : indices.length === 0 ? (
              <Card className="p-8 text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum índice cadastrado. Clique em "Atualizar Índices" para buscar dados via IA.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIndices.map(idx => {
                  const Icon = categoriaIcons[idx.categoria] || TrendingUp;
                  const isPositive = (idx.variacao_mensal ?? 0) >= 0;
                  return (
                    <Card key={idx.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{idx.sigla}</p>
                            <p className="text-xs text-muted-foreground">{idx.fonte}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{idx.periodo}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{idx.nome}</p>
                      <div className="flex items-end justify-between">
                        <p className="text-xl font-bold">
                          {idx.categoria === 'salario' || idx.categoria === 'construcao'
                            ? fmtCur(idx.valor)
                            : `${idx.valor}`
                          }
                        </p>
                        {idx.variacao_mensal != null && (
                          <div className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-warning' : 'text-success'}`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {fmtPerc(idx.variacao_mensal)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        {idx.variacao_anual != null && <span>Ano: {fmtPerc(idx.variacao_anual)}</span>}
                        {idx.acumulado_12m != null && <span>12m: {fmtPerc(idx.acumulado_12m)}</span>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Card className="p-4 bg-muted/30 border-dashed">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong>Fundamentação Legal:</strong> Art. 92, §3º e Art. 135 da Lei 14.133/2021 — os contratos de serviços e fornecimentos contínuos terão reajuste com base em índice oficial. 
                  Para mão de obra: repactuação por CCT (Art. 135, I). Para insumos: reajuste por índice setorial (Art. 135, II).
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* ═══ CONVENÇÕES COLETIVAS ═══ */}
          <TabsContent value="ccts" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Base de convenções coletivas para repactuação de serviços com mão de obra</p>
              <Button onClick={() => setShowCCTForm(!showCCTForm)} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Cadastrar CCT
              </Button>
            </div>

            {showCCTForm && (
              <Card className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Nova Convenção Coletiva</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Categoria Profissional *</Label>
                    <Input placeholder="Ex: Vigilância, Limpeza..." value={cctForm.categoria_profissional} onChange={e => setCctForm(p => ({ ...p, categoria_profissional: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Sindicato Laboral</Label>
                    <Input placeholder="Nome do sindicato" value={cctForm.sindicato_laboral} onChange={e => setCctForm(p => ({ ...p, sindicato_laboral: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Nº Registro MTE</Label>
                    <Input placeholder="Ex: PA000123/2026" value={cctForm.numero_registro_mte} onChange={e => setCctForm(p => ({ ...p, numero_registro_mte: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Vigência Início</Label>
                    <Input type="date" value={cctForm.vigencia_inicio} onChange={e => setCctForm(p => ({ ...p, vigencia_inicio: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Vigência Fim</Label>
                    <Input type="date" value={cctForm.vigencia_fim} onChange={e => setCctForm(p => ({ ...p, vigencia_fim: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Piso Salarial (R$)</Label>
                    <Input placeholder="0,00" value={cctForm.piso_salarial} onChange={e => setCctForm(p => ({ ...p, piso_salarial: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Reajuste (%)</Label>
                    <Input placeholder="0,00" value={cctForm.reajuste_percentual} onChange={e => setCctForm(p => ({ ...p, reajuste_percentual: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Índice Base</Label>
                    <Select value={cctForm.indice_reajuste} onValueChange={v => setCctForm(p => ({ ...p, indice_reajuste: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INPC">INPC</SelectItem>
                        <SelectItem value="IPCA">IPCA</SelectItem>
                        <SelectItem value="IGP-M">IGP-M</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">UF Abrangência</Label>
                    <Input placeholder="Ex: PA" value={cctForm.abrangencia_uf} onChange={e => setCctForm(p => ({ ...p, abrangencia_uf: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={salvarCCT} size="sm"><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCCTForm(false)}>Cancelar</Button>
                </div>
              </Card>
            )}

            {loadingCCTs ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : ccts.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma CCT cadastrada. Adicione convenções coletivas para embasar repactuações.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {ccts.map(cct => (
                  <Card key={cct.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{cct.categoria_profissional}</p>
                          {cct.sindicato_laboral && <p className="text-xs text-muted-foreground">{cct.sindicato_laboral}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cct.status === 'vigente' ? 'default' : 'secondary'} className="text-xs">{cct.status}</Badge>
                        {cct.abrangencia_uf && <Badge variant="outline" className="text-xs">{cct.abrangencia_uf}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      {cct.piso_salarial && <span>Piso: {fmtCur(cct.piso_salarial)}</span>}
                      {cct.reajuste_percentual && <span>Reajuste: {cct.reajuste_percentual}%</span>}
                      {cct.indice_reajuste && <span>Índice: {cct.indice_reajuste}</span>}
                      {cct.vigencia_fim && <span>Até: {new Date(cct.vigencia_fim).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Card className="p-4 bg-muted/30 border-dashed">
              <div className="flex items-start gap-2">
                <Scale className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong>Art. 135, I — Lei 14.133/2021:</strong> A repactuação para serviços contínuos com dedicação exclusiva de mão de obra 
                  será precedida de nova CCT ou sentença normativa. O prazo mínimo é de 1 ano, contado da data do orçamento ou última repactuação.
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* ═══ SIMULADOR DE REPACTUAÇÃO ═══ */}
          <TabsContent value="simulador" className="space-y-4">
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-muted-foreground" /> Simulador de Reajuste / Repactuação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Valor Original do Contrato (R$)</Label>
                  <Input placeholder="100.000,00" value={simValor} onChange={e => setSimValor(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Índice de Reajuste</Label>
                  <Select value={simIndice} onValueChange={setSimIndice}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPCA">IPCA (inflação geral)</SelectItem>
                      <SelectItem value="INPC">INPC (mão de obra)</SelectItem>
                      <SelectItem value="IGP-M">IGP-M</SelectItem>
                      <SelectItem value="SINAPI">SINAPI (construção civil)</SelectItem>
                      <SelectItem value="CUB">CUB/m² (engenharia)</SelectItem>
                      <SelectItem value="CCT">CCT / Dissídio Coletivo</SelectItem>
                      <SelectItem value="SICRO">SICRO/DNIT (obras rodoviárias)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Percentual de Reajuste (%)</Label>
                  <Input placeholder="4,50" value={simPerc} onChange={e => setSimPerc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data-Base Original</Label>
                  <Input type="date" value={simDataOrig} onChange={e => setSimDataOrig(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data-Base do Reajuste</Label>
                  <Input type="date" value={simDataReaj} onChange={e => setSimDataReaj(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Serviço</Label>
                  <Select value={simTipo} onValueChange={setSimTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuado">Serviço Continuado (mão de obra)</SelectItem>
                      <SelectItem value="engenharia">Engenharia</SelectItem>
                      <SelectItem value="fornecimento">Fornecimento Contínuo</SelectItem>
                      <SelectItem value="comum">Serviço Comum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={simular} disabled={simLoading} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {simLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {simLoading ? 'Calculando com IA...' : 'Simular Repactuação'}
              </Button>
            </Card>

            {simResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Valor Original</p>
                    <p className="text-lg font-bold">{fmtCur(parseFloat(simValor.replace(/\./g, '').replace(',', '.')) || 0)}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Valor Reajustado</p>
                    <p className="text-lg font-bold text-foreground">{fmtCur(simResult.valor_reajustado)}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Diferença</p>
                    <p className="text-lg font-bold text-success">{fmtCur(simResult.diferenca)}</p>
                  </Card>
                </div>

                {simResult.alertas?.length > 0 && (
                  <Card className="p-4 border-warning/30 bg-warning/5">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-warning" /> Alertas
                    </h4>
                    <ul className="space-y-1">
                      {simResult.alertas.map((a, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <Minus className="w-3 h-3 mt-0.5 flex-shrink-0" /> {a}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                <Card className="p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Scale className="w-4 h-4 text-muted-foreground" /> Fundamentação Jurídica
                  </h4>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-xs">
                    <ReactMarkdown>{simResult.fundamentacao}</ReactMarkdown>
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Parecer Técnico
                  </h4>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-xs">
                    <ReactMarkdown>{simResult.parecer}</ReactMarkdown>
                  </div>
                </Card>
              </div>
            )}

            <Card className="p-4 bg-muted/50 border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">Gerar Pedido de Reequilíbrio Formal</p>
                    <p className="text-xs text-muted-foreground">Vá ao Apoio Jurídico para gerar documentos completos com estes índices e CCTs como fundamentação</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate('/apoio-juridico')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Apoio Jurídico <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>

            <Card className="p-4 bg-muted/30 border-dashed">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Referências Legais:</strong></p>
                  <p>• Art. 92, §3º, Lei 14.133/2021 — Cláusula de reajuste obrigatória em contratos com prazo &gt; 1 ano</p>
                  <p>• Art. 135, Lei 14.133/2021 — Reajuste em sentido estrito (índice) e repactuação (CCT/dissídio)</p>
                  <p>• Art. 124, II, "d", Lei 14.133/2021 — Reequilíbrio econômico-financeiro</p>
                  <p>• Acórdão TCU 1.563/2004, 1.827/2008 — Súmulas sobre reajuste contratual</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
