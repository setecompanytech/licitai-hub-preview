import { useState, useEffect, useMemo } from 'react';
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
import {
  dataBr, htmlDoEstudo, montarEstudo, nomeDoArquivoDoEstudo, referenciasDoRegime, temSerieOficial,
  type EntradaDoEstudo, type Estudo, type SerieOficial, type TipoDeServico,
} from '@/lib/contratos/estudo-de-reajuste';
import { hojeLocal } from '@/lib/financeiro/data-local';
import {
  TrendingUp, TrendingDown, RefreshCw, Calculator, FileText, Scale, Building2,
  HardHat, Users, DollarSign, Percent, CalendarDays, AlertTriangle,
  Plus, Search, Clock, ArrowUpRight, ArrowDownRight, Minus, Info, Save, Loader2, ArrowRight,
  ExternalLink, Printer, Download,
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

/** "ago/2026" → número ordenável, para ficar com o mês mais novo de cada sigla. */
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ordemDoPeriodo = (periodo: string): number => {
  const [m, a] = periodo.toLowerCase().split('/');
  const mes = MESES_ABREV.indexOf(m);
  return (Number(a) || 0) * 12 + (mes >= 0 ? mes : 0);
};

const percentualDaSerie = (s: SerieOficial) => (Math.round(s.percentual * 100) / 100).toFixed(2).replace('.', ',');

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
  // O percentual nasce da série oficial; editado à mão, fica como a pessoa
  // deixou até ela trocar índice ou data (27/09).
  const [simPercEditado, setSimPercEditado] = useState(false);
  const [simDataOrig, setSimDataOrig] = useState('');
  const [simDataReaj, setSimDataReaj] = useState('');
  const [simTipo, setSimTipo] = useState<TipoDeServico>('fornecimento');
  const [serieOficial, setSerieOficial] = useState<SerieOficial | null>(null);
  const [buscandoSerie, setBuscandoSerie] = useState(false);
  const [erroDaSerie, setErroDaSerie] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ entrada: EntradaDoEstudo; estudo: Estudo } | null>(null);

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

  // Índice com série no SGS + as duas datas = percentual oficial no campo.
  // Quem editou o campo não é atropelado: a série fica ao lado, com "usar o oficial".
  useEffect(() => {
    const datasOk = /^\d{4}-\d{2}-\d{2}$/.test(simDataOrig) && /^\d{4}-\d{2}-\d{2}$/.test(simDataReaj) && simDataReaj > simDataOrig;
    if (!temSerieOficial(simIndice) || !datasOk) {
      setSerieOficial(null);
      setErroDaSerie(null);
      return;
    }
    let vivo = true;
    setBuscandoSerie(true);
    setErroDaSerie(null);
    supabase.functions.invoke('indices-economicos', {
      body: { action: 'calculo_reajuste', indice: simIndice, data_base: simDataOrig, data_alvo: simDataReaj },
    }).then(({ data, error }) => {
      if (!vivo) return;
      if (error || !data?.success) {
        setSerieOficial(null);
        setErroDaSerie(`Não foi possível ler a série oficial: ${error?.message ?? data?.error ?? 'falha na consulta'}. Informe o percentual à mão.`);
        return;
      }
      const serie = data as SerieOficial;
      setSerieOficial(serie);
      if (!simPercEditado) setSimPerc(percentualDaSerie(serie));
    }).finally(() => { if (vivo) setBuscandoSerie(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simIndice, simDataOrig, simDataReaj]);

  const percentualAplicado = (): number | null => {
    const t = simPerc.trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  };

  /** A conta e o estudo, sem IA: lib `estudo-de-reajuste`. */
  const simular = () => {
    const perc = percentualAplicado();
    if (!simValor || perc === null) { toast.error('Preencha a base de cálculo e o percentual'); return; }
    const entrada: EntradaDoEstudo = {
      valorBase: simValor,
      indice: simIndice,
      percentualAplicado: perc,
      dataBase: simDataOrig || null,
      dataAlvo: simDataReaj || null,
      tipoServico: simTipo,
      serie: serieOficial,
      hoje: hojeLocal(),
    };
    setResultado({ entrada, estudo: montarEstudo(entrada) });
  };

  const imprimirEstudo = () => {
    if (!resultado) return;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Habilite pop-ups para imprimir o estudo.'); return; }
    w.document.write(htmlDoEstudo(resultado.entrada, resultado.estudo, { imprimirAoAbrir: true }));
    w.document.close();
  };

  const baixarEstudoWord = () => {
    if (!resultado) return;
    const html = htmlDoEstudo(resultado.entrada, resultado.estudo, { paraWord: true });
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeDoArquivoDoEstudo(resultado.entrada, 'doc');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  // Um índice por sigla, o mês mais novo: a atualização guarda cada mês em
  // linha própria e a tela mostrava INPC de jul e de ago lado a lado (27/09).
  const indicesAtuais = useMemo(() => {
    const porSigla = new Map<string, Indice>();
    for (const i of indices) {
      const atual = porSigla.get(i.sigla);
      if (!atual || ordemDoPeriodo(i.periodo) > ordemDoPeriodo(atual.periodo)) porSigla.set(i.sigla, i);
    }
    return [...porSigla.values()];
  }, [indices]);
  const filteredIndices = catFiltro === 'todos' ? indicesAtuais : indicesAtuais.filter(i => i.categoria === catFiltro);
  const categorias = [...new Set(indicesAtuais.map(i => i.categoria))];

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
            {/* `width: max-content` inline e `shrink-0` nos itens: com a largura
                pela classe, a faixa encolhia até a caixa e os 14 itens se
                sobrepunham a 54 px cada — o print do dono de 27/09. */}
            {indicesAtuais.length > 0 && (
              <div className="esteira-indices flex items-stretch rounded-lg border border-border bg-muted overflow-hidden">
                <span className="flex shrink-0 items-center whitespace-nowrap border-r border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ÍNDICES OFICIAIS
                </span>
                <div className="relative flex-1 overflow-hidden flex items-center">
                  <div className="esteira-indices-faixa flex shrink-0 items-center gap-8 px-4" style={{ width: 'max-content' }}>
                    {[0, 1].map((volta) => (
                      <span key={volta} className="flex shrink-0 items-center gap-8" aria-hidden={volta === 1}>
                        {indicesAtuais.map((idx) => (
                          <span key={`${volta}-${idx.id}`} className="shrink-0 text-xs whitespace-nowrap tabular-nums">
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
                {atualizando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                {atualizando ? 'Atualizando…' : 'Atualizar Índices'}
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
                      {atualizando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
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
                    <Card key={idx.id} className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-tint text-primary">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-base font-semibold leading-6 text-foreground">{idx.sigla}</p>
                            <p className="text-sm text-muted-foreground">{idx.fonte}</p>
                          </div>
                        </div>
                        <Badge variant="muted">{idx.periodo}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{idx.nome}</p>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <p className="break-normal text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">
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
                <strong>Fundamentação legal:</strong> Lei 14.133/2021, art. 92, § 4º — serviços contínuos: reajustamento em sentido estrito por índice (I) ou repactuação (II).
                Na repactuação (art. 135), os custos de mercado têm data vinculada à proposta (inciso I) e os de mão de obra à convenção, acordo ou dissídio coletivo (inciso II).
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* ═══ CONVENÇÕES COLETIVAS ═══ */}
          <TabsContent value="ccts" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base text-muted-foreground">Base de convenções coletivas para repactuação de serviços com mão de obra</p>
              <Button onClick={() => setShowCCTForm(!showCCTForm)}>
                <Plus aria-hidden="true" /> Cadastrar CCT
              </Button>
            </div>

            {showCCTForm && (
              <Card className="space-y-4 p-5">
                <h2 className="text-lg font-semibold leading-6 text-foreground">Nova Convenção Coletiva</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cct-categoria">Categoria Profissional *</Label>
                    <Input id="cct-categoria" placeholder="Ex: Vigilância, Limpeza..." value={cctForm.categoria_profissional} onChange={e => setCctForm(p => ({ ...p, categoria_profissional: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cct-sindicato">Sindicato Laboral</Label>
                    <Input id="cct-sindicato" placeholder="Nome do sindicato" value={cctForm.sindicato_laboral} onChange={e => setCctForm(p => ({ ...p, sindicato_laboral: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cct-mte">Nº Registro MTE</Label>
                    <Input id="cct-mte" placeholder="Ex: PA000123/2026" value={cctForm.numero_registro_mte} onChange={e => setCctForm(p => ({ ...p, numero_registro_mte: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cct-inicio">Vigência Início</Label>
                    <Input id="cct-inicio" type="date" value={cctForm.vigencia_inicio} onChange={e => setCctForm(p => ({ ...p, vigencia_inicio: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cct-fim">Vigência Fim</Label>
                    <Input id="cct-fim" type="date" value={cctForm.vigencia_fim} onChange={e => setCctForm(p => ({ ...p, vigencia_fim: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cct-piso">Piso Salarial (R$)</Label>
                    <Input id="cct-piso" placeholder="0,00" value={cctForm.piso_salarial} onChange={e => setCctForm(p => ({ ...p, piso_salarial: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cct-reajuste">Reajuste (%)</Label>
                    <Input id="cct-reajuste" placeholder="0,00" value={cctForm.reajuste_percentual} onChange={e => setCctForm(p => ({ ...p, reajuste_percentual: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="cct-uf">UF Abrangência</Label>
                    <Input id="cct-uf" placeholder="Ex: PA" value={cctForm.abrangencia_uf} onChange={e => setCctForm(p => ({ ...p, abrangencia_uf: e.target.value }))} />
                  </div>
                </div>
                {/* Rodapé de formulário: ações à direita, a principal por último. */}
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowCCTForm(false)}>Cancelar</Button>
                  <Button onClick={salvarCCT}><Save aria-hidden="true" /> Salvar</Button>
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
                  <Card key={cct.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-tint text-primary">
                          <Users className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-base font-semibold leading-6 text-foreground">{cct.categoria_profissional}</p>
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
                <strong>Art. 135, II — Lei 14.133/2021:</strong> na repactuação de serviços contínuos com dedicação exclusiva ou predominância de mão de obra, a
                parcela de pessoal tem data vinculada à convenção, ao acordo ou ao dissídio coletivo a que a proposta esteja vinculada. O interregno mínimo é de 1 ano (art. 92, § 4º), contado dessa data-base ou da última repactuação.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* ═══ SIMULADOR DE REAJUSTE / REPACTUAÇÃO ═══
              Sem IA (27/09): a série vem do SGS pela edge `calculo_reajuste`,
              a conta e as citações são da lib `estudo-de-reajuste`. O
              percentual se preenche sozinho ao escolher índice e datas, e
              continua editável — edição fica dita no estudo. */}
          <TabsContent value="simulador" className="space-y-4">
            <Card className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                <Calculator className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Simulador de Reajuste / Repactuação
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sim-valor">Base de cálculo (R$)</Label>
                  <MoneyInput id="sim-valor" value={simValor} onValueChange={setSimValor} />
                  <p className="g-meta text-muted-foreground">Use o saldo a executar na data do aniversário: parcela já paga não se reajusta.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-indice">Índice de reajuste</Label>
                  <Select value={simIndice} onValueChange={(v) => { setSimIndice(v); setSimPercEditado(false); }}>
                    <SelectTrigger id="sim-indice"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPCA">IPCA (inflação geral)</SelectItem>
                      <SelectItem value="INPC">INPC (mão de obra)</SelectItem>
                      <SelectItem value="IGP-M">IGP-M</SelectItem>
                      <SelectItem value="IGP-DI">IGP-DI</SelectItem>
                      <SelectItem value="INCC-DI">INCC-DI (construção civil)</SelectItem>
                      <SelectItem value="SINAPI">SINAPI (construção civil) — percentual manual</SelectItem>
                      <SelectItem value="CUB">CUB/m² (engenharia) — percentual manual</SelectItem>
                      <SelectItem value="CCT">CCT / dissídio coletivo — percentual manual</SelectItem>
                      <SelectItem value="SICRO">SICRO/DNIT (obras rodoviárias) — percentual manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-perc">Percentual de reajuste (%)</Label>
                  <Input
                    id="sim-perc"
                    inputMode="decimal"
                    placeholder={temSerieOficial(simIndice) ? 'preenche com a série oficial' : 'informe o percentual da tabela ou da CCT'}
                    value={simPerc}
                    onChange={(e) => { setSimPerc(e.target.value); setSimPercEditado(true); }}
                  />
                  {/* De onde o número veio — e como voltar ao oficial depois de editar. */}
                  {buscandoSerie ? (
                    <p className="g-meta flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Buscando a série oficial…</p>
                  ) : serieOficial ? (
                    <p className="g-meta text-muted-foreground" data-testid="serie-oficial">
                      {serieOficial.fonte}, {serieOficial.meses.length} mês(es) de {dataBr(serieOficial.data_base)} a {dataBr(serieOficial.data_alvo)}:{' '}
                      <b className="tabular-nums text-foreground">{percentualDaSerie(serieOficial)}%</b>
                      {!serieOficial.completo && <span className="text-warning-ink"> · série parcial até {serieOficial.serie_ate}</span>}
                      {simPercEditado && (
                        <>
                          {' '}· editado à mão —{' '}
                          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => { setSimPerc(percentualDaSerie(serieOficial)); setSimPercEditado(false); }}>
                            usar o oficial
                          </button>
                        </>
                      )}
                    </p>
                  ) : erroDaSerie ? (
                    <p className="g-meta text-warning-ink">{erroDaSerie}</p>
                  ) : temSerieOficial(simIndice) ? (
                    <p className="g-meta text-muted-foreground">Informe as duas datas: o percentual vem da série oficial do Banco Central (SGS).</p>
                  ) : (
                    <p className="g-meta text-muted-foreground">Índice sem série no SGS: digite o percentual publicado e anexe a fonte ao pedido.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-data-orig">Data-base (proposta/orçamento ou último reajuste)</Label>
                  <Input id="sim-data-orig" type="date" value={simDataOrig} onChange={(e) => { setSimDataOrig(e.target.value); setSimPercEditado(false); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-data-reaj">Data de incidência (aniversário)</Label>
                  <Input id="sim-data-reaj" type="date" value={simDataReaj} onChange={(e) => { setSimDataReaj(e.target.value); setSimPercEditado(false); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-tipo">Tipo de serviço</Label>
                  <Select value={simTipo} onValueChange={(v) => setSimTipo(v as TipoDeServico)}>
                    <SelectTrigger id="sim-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuado">Serviço contínuo (mão de obra) — repactuação</SelectItem>
                      <SelectItem value="engenharia">Obra ou serviço de engenharia</SelectItem>
                      <SelectItem value="fornecimento">Fornecimento contínuo</SelectItem>
                      <SelectItem value="comum">Serviço comum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={simular}>
                <Calculator aria-hidden="true" /> Calcular e montar o estudo
              </Button>
            </Card>

            {resultado && (
              <div className="space-y-4" data-testid="estudo-de-reajuste">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                    <p className="text-sm font-medium leading-5 text-muted-foreground">Base de cálculo</p>
                    <p className="break-normal text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">{fmtCur(resultado.entrada.valorBase)}</p>
                  </Card>
                  <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                    <p className="text-sm font-medium leading-5 text-muted-foreground">Valor reajustado</p>
                    <p className="break-normal text-[1.75rem] font-semibold leading-9 tabular-nums text-foreground">{fmtCur(resultado.estudo.valorReajustado)}</p>
                  </Card>
                  <Card className="flex min-h-[112px] flex-col justify-between gap-2 p-4">
                    <p className="text-sm font-medium leading-5 text-muted-foreground">Reajuste ({resultado.entrada.percentualAplicado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</p>
                    <p className="break-normal text-[1.75rem] font-semibold leading-9 tabular-nums text-success-ink">{fmtCur(resultado.estudo.diferenca)}</p>
                  </Card>
                </div>

                {/* O documento sai daqui: PDF pela impressão do navegador, Word como .doc. */}
                <div className="flex flex-wrap items-center gap-2 nao-imprime">
                  <Button onClick={imprimirEstudo}><Printer aria-hidden="true" /> Imprimir / salvar em PDF</Button>
                  <Button variant="outline" onClick={baixarEstudoWord}><Download aria-hidden="true" /> Baixar Word (.doc)</Button>
                  <span className="g-meta text-muted-foreground">Estudo técnico com identificação, fundamentação, memória de cálculo, parecer e aspectos contábeis.</span>
                </div>

                {resultado.estudo.alertas.length > 0 && (
                  <Alert variant="warning">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Pontos de atenção</p>
                      <ul className="space-y-1">
                        {resultado.estudo.alertas.map((a, i) => (
                          <li key={i} className="text-sm flex items-start gap-1">
                            <Minus className="w-3 h-3 mt-1 flex-shrink-0" aria-hidden="true" /> {a}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                    <Calculator className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Memória de cálculo
                  </h2>
                  {resultado.entrada.serie ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-xs font-semibold text-muted-foreground">
                          <tr><th className="px-3 py-2 text-left">Competência</th><th className="px-3 py-2 text-right">Variação mensal</th><th className="px-3 py-2 text-right">Fator (1 + i)</th></tr>
                        </thead>
                        <tbody>
                          {resultado.entrada.serie.meses.map((m) => (
                            <tr key={m.competencia} className="border-b border-border last:border-0">
                              <td className="px-3 py-1.5 tabular-nums">{m.competencia}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{m.variacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{m.fator.toFixed(6).replace('.', ',')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Percentual informado pelo requerente — sem série oficial carregada.</p>
                  )}
                  <div className="mt-3 space-y-1 text-sm">
                    {resultado.estudo.parecer.slice(0, 2).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </Card>

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                    <Scale className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Fundamentação jurídica
                  </h2>
                  <div className="space-y-2 text-sm">
                    {resultado.estudo.fundamentacao.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </Card>

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                    <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Parecer técnico
                  </h2>
                  <div className="space-y-2 text-sm">
                    {resultado.estudo.parecer.slice(2).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </Card>

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold leading-6 text-foreground">
                    <DollarSign className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Aspectos contábeis e orçamentários
                  </h2>
                  <div className="space-y-2 text-sm">
                    {resultado.estudo.contabil.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </Card>
              </div>
            )}

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-2">
                  <Scale className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-base font-semibold leading-6 text-foreground">Gerar pedido de reequilíbrio formal</p>
                    <p className="text-sm text-muted-foreground">Vá ao Apoio Jurídico para gerar documentos completos com estes índices e CCTs como fundamentação</p>
                  </div>
                </div>
                <Button onClick={() => navigate('/apoio-juridico')}>
                  Apoio Jurídico <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Button>
              </div>
            </Card>

            {/* As normas conferidas contra o texto de 2021 (auditoria de 31/08),
                pelo regime que o tipo de serviço escolhido impõe. */}
            <Alert variant="info">
              <Info className="w-4 h-4" aria-hidden="true" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Referências normativas — {simTipo === 'continuado' ? 'repactuação' : 'reajustamento em sentido estrito'}:</strong></p>
                  {referenciasDoRegime(simTipo === 'continuado' ? 'repactuacao' : 'reajuste').map((r) => (
                    <p key={r.norma}>• <b>{r.norma}</b> — {r.texto}</p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
