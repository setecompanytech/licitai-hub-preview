import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
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
  Plus, Search, Clock, ArrowUpRight, ArrowDownRight, Minus, Info, Save, Loader2, ArrowRight,
  ExternalLink,
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

/** O portal oficial de quem CALCULA o índice — conferência na origem, a um
 *  clique do número. Derivado da fonte gravada na linha (nunca chutado).
 *  URLs verificadas em 08/09 (a primeira do BCB dava 404 no site novo, que
 *  responde 200 até para rota inexistente — SPA — e só mostra o erro na tela). */
const portalOficial = (fonte: string, categoria: string): { nome: string; url: string } => {
  if (fonte.startsWith('IBGE')) return { nome: 'IBGE', url: 'https://www.ibge.gov.br/indicadores' };
  if (fonte.startsWith('FGV')) return { nome: 'FGV', url: 'https://portal.fgv.br/indices-economicos' };
  if (categoria === 'juros') return { nome: 'Banco Central', url: 'https://www.bcb.gov.br/controleinflacao/taxaselic' };
  // Salário mínimo e demais séries do SGS: o portal público do próprio SGS —
  // a origem literal de onde estes números foram lidos.
  return { nome: 'Banco Central (SGS)', url: 'https://www3.bcb.gov.br/sgspub/' };
};

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
  // Número, não texto: o campo era um Input cru que aceitava "100000,00" sem
  // máscara e o parse manual espalhava-se por três pontos (08/09). MoneyInput
  // é o padrão da casa para dinheiro.
  const [simValor, setSimValor] = useState(0);
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
          valor_original: simValor,
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
        {/* Título, descrição, ícone e trilha vêm do registro do menu
            (`lib/navegacao/paginas.ts`): a tela de leitura não tem ação
            principal, e as abas são as três declaradas lá. */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <CabecalhoPagina>
            {/* ── A esteira: os índices correndo, como nos portais econômicos ──
                Visível em todas as abas do menu; os números são os MESMOS da base
                local (fonte SGS), só mudam de roupa. Duplicada para o loop ser
                contínuo; a segunda cópia é decorativa para o leitor de tela. */}
            {indices.length > 0 && (
              <div className="esteira-indices flex items-stretch rounded-lg border border-border bg-muted overflow-hidden">
                <span className="shrink-0 flex items-center px-3 py-2 text-xs font-semibold text-primary whitespace-nowrap border-r border-border bg-card">
                  ÍNDICES OFICIAIS
                </span>
                <div className="relative flex-1 overflow-hidden flex items-center">
                  <div className="esteira-indices-faixa flex w-max items-center gap-8 px-4">
                    {[0, 1].map((volta) => (
                      <span key={volta} className="flex items-center gap-8" aria-hidden={volta === 1}>
                        {indices.map((idx) => (
                          <span key={`${volta}-${idx.id}`} className="text-xs whitespace-nowrap tabular-nums">
                            <b>{idx.sigla}</b>
                            <span className="text-muted-foreground"> · {idx.periodo} · </span>
                            <span className={(idx.variacao_mensal ?? 0) < 0 ? 'text-success-ink' : 'text-warning-ink'}>
                              {idx.categoria === 'salario'
                                ? fmtCur(idx.valor)
                                : idx.categoria === 'juros'
                                  ? `${idx.valor}% a.a.`
                                  : fmtPerc(idx.valor)}
                            </span>
                            {idx.acumulado_12m != null && (
                              <span className="text-muted-foreground"> (12m: {fmtPerc(idx.acumulado_12m)})</span>
                            )}
                          </span>
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* O invólucro existe para a fila de abas continuar do tamanho do
                conteúdo: dentro da coluna flex do cabeçalho, um filho direto
                esticaria de ponta a ponta. */}
            <div>
              <TabsList>
                <TabsTrigger value="indices">Índices</TabsTrigger>
                <TabsTrigger value="ccts">CCTs</TabsTrigger>
                <TabsTrigger value="simulador">Simulador</TabsTrigger>
              </TabsList>
            </div>
          </CabecalhoPagina>

          {/* ═══ PAINEL DE ÍNDICES ═══ */}
          <TabsContent value="indices" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={atualizarIndices} disabled={atualizando}>
                {atualizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {atualizando ? 'Atualizando via IA...' : 'Atualizar Índices'}
              </Button>
              {/* Recorte por categoria: botões, não selos — quem filtra precisa
                  alcançar o controle pelo teclado, e selo não é botão. */}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
                <Button size="sm" variant={catFiltro === 'todos' ? 'default' : 'outline'} aria-pressed={catFiltro === 'todos'} onClick={() => setCatFiltro('todos')}>Todos</Button>
                {categorias.map(c => (
                  <Button key={c} size="sm" variant={catFiltro === c ? 'default' : 'outline'} aria-pressed={catFiltro === c} onClick={() => setCatFiltro(c)}>
                    {categoriaLabels[c] || c}
                  </Button>
                ))}
              </div>
            </div>

            {loadingIndices ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
              </div>
            ) : indices.length === 0 ? (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <EstadoVazio
                  icone={<TrendingUp />}
                  titulo="Nenhum índice cadastrado"
                  descricao="Busque as séries oficiais no Banco Central (SGS) para começar a acompanhar IPCA, INPC, IGP-M e os demais."
                  acao={
                    <Button onClick={atualizarIndices} disabled={atualizando}>
                      {atualizando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Atualizar Índices
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIndices.map(idx => {
                  const Icon = categoriaIcons[idx.categoria] || TrendingUp;
                  const isPositive = (idx.variacao_mensal ?? 0) >= 0;
                  return (
                    <Card key={idx.id} className="p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-md bg-primary-tint text-primary flex items-center justify-center">
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{idx.sigla}</p>
                            <p className="text-sm text-muted-foreground">{idx.fonte}</p>
                          </div>
                        </div>
                        <Badge variant="muted">{idx.periodo}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{idx.nome}</p>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <p className="text-[2rem] leading-10 font-bold tabular-nums break-normal">
                          {/* Só salário é dinheiro. INCC é VARIAÇÃO — "R$ 0,66"
                              afirmava um preço que não existe (print de 08/09). */}
                          {idx.categoria === 'salario'
                            ? fmtCur(idx.valor)
                            : idx.categoria === 'juros'
                              ? `${idx.valor}% a.a.`
                              : fmtPerc(idx.valor)
                          }
                        </p>
                        {idx.variacao_mensal != null && (
                          <div className={`flex items-center gap-0.5 text-sm font-medium tabular-nums ${isPositive ? 'text-warning-ink' : 'text-success-ink'}`}>
                            {isPositive ? <ArrowUpRight className="w-4 h-4" aria-hidden="true" /> : <ArrowDownRight className="w-4 h-4" aria-hidden="true" />}
                            {fmtPerc(idx.variacao_mensal)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground tabular-nums">
                        {idx.variacao_anual != null && <span>Ano: {fmtPerc(idx.variacao_anual)}</span>}
                        {idx.acumulado_12m != null && <span>12m: {fmtPerc(idx.acumulado_12m)}</span>}
                      </div>
                      {(() => {
                        const portal = portalOficial(idx.fonte, idx.categoria);
                        return (
                          <a href={portal.url} target="_blank" rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            Conferir no portal do {portal.nome} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        );
                      })()}
                    </Card>
                  );
                })}
              </div>
            )}

            <Alert variant="info">
              <Info className="w-4 h-4" aria-hidden="true" />
              <AlertDescription>
                <strong>Fundamentação Legal:</strong> Art. 92, §3º e Art. 135 da Lei 14.133/2021 — os contratos de serviços e fornecimentos contínuos terão reajuste com base em índice oficial.
                Para mão de obra: repactuação por CCT (Art. 135, I). Para insumos: reajuste por índice setorial (Art. 135, II).
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* ═══ CONVENÇÕES COLETIVAS ═══ */}
          <TabsContent value="ccts" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base text-muted-foreground">Base de convenções coletivas para repactuação de serviços com mão de obra</p>
              <Button onClick={() => setShowCCTForm(!showCCTForm)}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar CCT
              </Button>
            </div>

            {showCCTForm && (
              <Card className="p-6 space-y-4">
                <h2 className="text-lg font-semibold">Nova Convenção Coletiva</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="cct-categoria">Categoria Profissional *</Label>
                    <Input id="cct-categoria" placeholder="Ex: Vigilância, Limpeza..." value={cctForm.categoria_profissional} onChange={e => setCctForm(p => ({ ...p, categoria_profissional: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-sindicato">Sindicato Laboral</Label>
                    <Input id="cct-sindicato" placeholder="Nome do sindicato" value={cctForm.sindicato_laboral} onChange={e => setCctForm(p => ({ ...p, sindicato_laboral: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-mte">Nº Registro MTE</Label>
                    <Input id="cct-mte" placeholder="Ex: PA000123/2026" value={cctForm.numero_registro_mte} onChange={e => setCctForm(p => ({ ...p, numero_registro_mte: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-inicio">Vigência Início</Label>
                    <Input id="cct-inicio" type="date" value={cctForm.vigencia_inicio} onChange={e => setCctForm(p => ({ ...p, vigencia_inicio: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-fim">Vigência Fim</Label>
                    <Input id="cct-fim" type="date" value={cctForm.vigencia_fim} onChange={e => setCctForm(p => ({ ...p, vigencia_fim: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-piso">Piso Salarial (R$)</Label>
                    <Input id="cct-piso" placeholder="0,00" value={cctForm.piso_salarial} onChange={e => setCctForm(p => ({ ...p, piso_salarial: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-reajuste">Reajuste (%)</Label>
                    <Input id="cct-reajuste" placeholder="0,00" value={cctForm.reajuste_percentual} onChange={e => setCctForm(p => ({ ...p, reajuste_percentual: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cct-indice">Índice Base</Label>
                    <Select value={cctForm.indice_reajuste} onValueChange={v => setCctForm(p => ({ ...p, indice_reajuste: v }))}>
                      <SelectTrigger id="cct-indice"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INPC">INPC</SelectItem>
                        <SelectItem value="IPCA">IPCA</SelectItem>
                        <SelectItem value="IGP-M">IGP-M</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cct-uf">UF Abrangência</Label>
                    <Input id="cct-uf" placeholder="Ex: PA" value={cctForm.abrangencia_uf} onChange={e => setCctForm(p => ({ ...p, abrangencia_uf: e.target.value }))} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={salvarCCT}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
                  <Button variant="outline" onClick={() => setShowCCTForm(false)}>Cancelar</Button>
                </div>
              </Card>
            )}

            {loadingCCTs ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
            ) : ccts.length === 0 ? (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <EstadoVazio
                  icone={<Users />}
                  titulo="Nenhuma CCT cadastrada"
                  descricao="Adicione convenções coletivas para embasar repactuações de serviços com mão de obra."
                  acao={<Button onClick={() => setShowCCTForm(true)}><Plus className="w-4 h-4 mr-2" /> Cadastrar CCT</Button>}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {ccts.map(cct => (
                  <Card key={cct.id} className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-primary-tint text-primary flex items-center justify-center">
                          <Users className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{cct.categoria_profissional}</p>
                          {cct.sindicato_laboral && <p className="text-sm text-muted-foreground">{cct.sindicato_laboral}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cct.status === 'vigente' ? 'success' : 'muted'}>{cct.status}</Badge>
                        {cct.abrangencia_uf && <Badge variant="outline">{cct.abrangencia_uf}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                      {cct.piso_salarial && <span>Piso: {fmtCur(cct.piso_salarial)}</span>}
                      {cct.reajuste_percentual && <span>Reajuste: {cct.reajuste_percentual}%</span>}
                      {cct.indice_reajuste && <span>Índice: {cct.indice_reajuste}</span>}
                      {cct.vigencia_fim && <span>Até: {new Date(cct.vigencia_fim).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Alert variant="info">
              <Scale className="w-4 h-4" aria-hidden="true" />
              <AlertDescription>
                <strong>Art. 135, I — Lei 14.133/2021:</strong> A repactuação para serviços contínuos com dedicação exclusiva de mão de obra
                será precedida de nova CCT ou sentença normativa. O prazo mínimo é de 1 ano, contado da data do orçamento ou última repactuação.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* ═══ SIMULADOR DE REPACTUAÇÃO ═══ */}
          <TabsContent value="simulador" className="space-y-4">
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Simulador de Reajuste / Repactuação
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sim-valor">Valor Original do Contrato (R$)</Label>
                  <MoneyInput id="sim-valor" value={simValor} onValueChange={setSimValor} />
                </div>
                <div>
                  <Label htmlFor="sim-indice">Índice de Reajuste</Label>
                  <Select value={simIndice} onValueChange={setSimIndice}>
                    <SelectTrigger id="sim-indice"><SelectValue /></SelectTrigger>
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
                  <Label htmlFor="sim-perc">Percentual de Reajuste (%)</Label>
                  <Input id="sim-perc" placeholder="4,50" value={simPerc} onChange={e => setSimPerc(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="sim-data-orig">Data-Base Original</Label>
                  <Input id="sim-data-orig" type="date" value={simDataOrig} onChange={e => setSimDataOrig(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="sim-data-reaj">Data-Base do Reajuste</Label>
                  <Input id="sim-data-reaj" type="date" value={simDataReaj} onChange={e => setSimDataReaj(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="sim-tipo">Tipo de Serviço</Label>
                  <Select value={simTipo} onValueChange={setSimTipo}>
                    <SelectTrigger id="sim-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuado">Serviço Continuado (mão de obra)</SelectItem>
                      <SelectItem value="engenharia">Engenharia</SelectItem>
                      <SelectItem value="fornecimento">Fornecimento Contínuo</SelectItem>
                      <SelectItem value="comum">Serviço Comum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={simular} disabled={simLoading}>
                {simLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {simLoading ? 'Calculando com IA...' : 'Simular Repactuação'}
              </Button>
            </Card>

            {simResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Valor Original</p>
                    <p className="text-[2rem] leading-10 font-bold tabular-nums break-normal">{fmtCur(simValor || 0)}</p>
                  </Card>
                  <Card className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Valor Reajustado</p>
                    <p className="text-[2rem] leading-10 font-bold text-foreground tabular-nums break-normal">{fmtCur(simResult.valor_reajustado)}</p>
                  </Card>
                  <Card className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Diferença</p>
                    <p className="text-[2rem] leading-10 font-bold text-success-ink tabular-nums break-normal">{fmtCur(simResult.diferenca)}</p>
                  </Card>
                </div>

                {simResult.alertas?.length > 0 && (
                  <Alert variant="warning">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Alertas</p>
                      <ul className="space-y-1">
                        {simResult.alertas.map((a, i) => (
                          <li key={i} className="text-sm flex items-start gap-1">
                            <Minus className="w-3 h-3 mt-1 flex-shrink-0" aria-hidden="true" /> {a}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Card className="p-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Scale className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Fundamentação Jurídica
                  </h2>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                    <ReactMarkdown>{simResult.fundamentacao}</ReactMarkdown>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Parecer Técnico
                  </h2>
                  <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                    <ReactMarkdown>{simResult.parecer}</ReactMarkdown>
                  </div>
                </Card>
              </div>
            )}

            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-2">
                  <Scale className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-lg font-semibold">Gerar Pedido de Reequilíbrio Formal</p>
                    <p className="text-sm text-muted-foreground">Vá ao Apoio Jurídico para gerar documentos completos com estes índices e CCTs como fundamentação</p>
                  </div>
                </div>
                <Button onClick={() => navigate('/apoio-juridico')}>
                  Apoio Jurídico <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Button>
              </div>
            </Card>

            <Alert variant="info">
              <Info className="w-4 h-4" aria-hidden="true" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Referências Legais:</strong></p>
                  <p>• Art. 92, §3º, Lei 14.133/2021 — Cláusula de reajuste obrigatória em contratos com prazo &gt; 1 ano</p>
                  <p>• Art. 135, Lei 14.133/2021 — Reajuste em sentido estrito (índice) e repactuação (CCT/dissídio)</p>
                  <p>• Art. 124, II, "d", Lei 14.133/2021 — Reequilíbrio econômico-financeiro</p>
                  <p>• Acórdão TCU 1.563/2004, 1.827/2008 — Súmulas sobre reajuste contratual</p>
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
