import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, TrendingUp, TrendingDown, DollarSign, Search, Loader2,
  AlertTriangle, CheckCircle, BarChart3, RefreshCw, Sparkles,
  ArrowUpRight, ArrowDownRight, Minus, ShoppingCart, Building2, Eye,
  Target, Zap, Shield, MapPin
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import EstadoVazio from '@/components/shared/EstadoVazio';
import LinhaKpis from '@/components/shared/LinhaKpis';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type CatalogItem = {
  id: string;
  descricao: string;
  preco_unitario: number;
  custo_unitario: number;
  margem_lucro: number | null;
  tipo_calculo: string;
  created_at: string;
};

type PriceComparison = {
  descricao: string;
  meuPreco: number;
  menorMercado: number;
  mediaMercado: number;
  maiorMercado: number;
  precoGov: number | null;
  diferenca: number; // percentage vs market avg
  oportunidade: 'aumentar' | 'manter' | 'reduzir';
  margemAtual: number;
  margemSugerida: number;
  economia: number;
};

type AIRecommendation = {
  item: string;
  acao: string;
  justificativa: string;
  impacto: string;
  prioridade: 'alta' | 'media' | 'baixa';
};

const CHART_COLORS = ['hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))'];

export default function InteligenciaPrecos() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOportunidade, setFilterOportunidade] = useState<string>('todos');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [manualTerms, setManualTerms] = useState('');
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');

  // Load catalog items
  useEffect(() => {
    if (!user) return;
    loadCatalogItems();
  }, [user]);

  const loadCatalogItems = async () => {
    const { data, error } = await supabase
      .from('catalogo_itens_precificados')
      .select('id, descricao, preco_unitario, custo_unitario, margem_lucro, tipo_calculo, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setCatalogItems(data);
      // Auto-switch to manual mode if no catalog items
      if (data.length === 0) setMode('manual');
    }
  };

  // Run price comparison analysis
  const handleAnalyze = async () => {
    const isManual = mode === 'manual' || catalogItems.length === 0;

    if (isManual && !manualTerms.trim()) {
      toast.error('Informe pelo menos um produto para pesquisar.');
      return;
    }
    if (!isManual && catalogItems.length === 0) {
      toast.error('Nenhum item no catálogo. Use a busca manual ou precifique itens primeiro.');
      return;
    }

    setLoading(true);
    setComparisons([]);
    setRecommendations([]);

    try {
      const results: PriceComparison[] = [];
      const isManual = mode === 'manual' || catalogItems.length === 0;

      if (isManual) {
        // Manual mode: parse comma/newline-separated terms
        const terms = manualTerms.split(/[,;\n]+/).map(t => t.trim()).filter(t => t.length > 2);
        const batchSize = 5;

        for (let i = 0; i < terms.length; i += batchSize) {
          const batch = terms.slice(i, i + batchSize);
          const promises = batch.map(async (termo) => {
            try {
              const { data: mkData } = await supabase.functions.invoke('pesquisa-preco-real', {
                body: { termo },
              });

              const { data: govData } = await supabase.functions.invoke('consulta-painel-precos', {
                body: { termo },
              });

              const mkPrices = mkData?.data?.fornecedores?.map((f: any) => f.preco).filter((p: number) => p > 0) || [];
              const govPrices = govData?.resultados?.map((r: any) => r.preco_unitario).filter((p: number) => p > 0) || [];
              const allPrices = [...mkPrices, ...govPrices];
              if (allPrices.length === 0) return null;

              const menorMercado = Math.min(...allPrices);
              const maiorMercado = Math.max(...allPrices);
              const mediaMercado = allPrices.reduce((a: number, b: number) => a + b, 0) / allPrices.length;
              const precoGov = govPrices.length > 0 ? govPrices.reduce((a: number, b: number) => a + b, 0) / govPrices.length : null;

              return {
                descricao: termo,
                meuPreco: mediaMercado,
                menorMercado,
                mediaMercado: Math.round(mediaMercado * 100) / 100,
                maiorMercado,
                precoGov,
                diferenca: 0,
                oportunidade: 'manter' as const,
                margemAtual: 0,
                margemSugerida: 0,
                economia: 0,
              } as PriceComparison;
            } catch { return null; }
          });

          const batchResults = await Promise.allSettled(promises);
          for (const r of batchResults) {
            if (r.status === 'fulfilled' && r.value) results.push(r.value);
          }
        }
      } else {
        // Catalog mode (original)
        const itemsToAnalyze = catalogItems.slice(0, 20);
        const batchSize = 5;

      for (let i = 0; i < itemsToAnalyze.length; i += batchSize) {
        const batch = itemsToAnalyze.slice(i, i + batchSize);

        const promises = batch.map(async (item) => {
          try {
            // Search marketplace prices
            const { data: mkData } = await supabase.functions.invoke('pesquisa-preco-real', {
              body: { termo: item.descricao },
            });

            // Search Gov prices
            const { data: govData } = await supabase.functions.invoke('consulta-painel-precos', {
              body: { termo: item.descricao },
            });

            const mkPrices = mkData?.data?.fornecedores?.map((f: any) => f.preco).filter((p: number) => p > 0) || [];
            const govPrices = govData?.resultados?.map((r: any) => r.preco_unitario).filter((p: number) => p > 0) || [];

            const allPrices = [...mkPrices, ...govPrices];
            if (allPrices.length === 0) return null;

            const menorMercado = Math.min(...allPrices);
            const maiorMercado = Math.max(...allPrices);
            const mediaMercado = allPrices.reduce((a: number, b: number) => a + b, 0) / allPrices.length;
            const precoGov = govPrices.length > 0
              ? govPrices.reduce((a: number, b: number) => a + b, 0) / govPrices.length
              : null;

            const diferenca = mediaMercado > 0
              ? ((item.preco_unitario - mediaMercado) / mediaMercado) * 100
              : 0;

            const margemAtual = item.custo_unitario > 0
              ? ((item.preco_unitario - item.custo_unitario) / item.preco_unitario) * 100
              : (item.margem_lucro || 0);

            let oportunidade: 'aumentar' | 'manter' | 'reduzir' = 'manter';
            let margemSugerida = margemAtual;

            if (diferenca < -10) {
              // Our price is 10%+ below market → opportunity to increase
              oportunidade = 'aumentar';
              margemSugerida = Math.min(margemAtual + Math.abs(diferenca) * 0.5, 35);
            } else if (diferenca > 15) {
              // Our price is 15%+ above market → need to reduce
              oportunidade = 'reduzir';
              margemSugerida = Math.max(margemAtual - diferenca * 0.3, 5);
            }

            const economia = Math.abs(
              (margemSugerida - margemAtual) / 100 * item.preco_unitario
            );

            return {
              descricao: item.descricao,
              meuPreco: item.preco_unitario,
              menorMercado,
              mediaMercado: Math.round(mediaMercado * 100) / 100,
              maiorMercado,
              precoGov,
              diferenca: Math.round(diferenca * 10) / 10,
              oportunidade,
              margemAtual: Math.round(margemAtual * 10) / 10,
              margemSugerida: Math.round(margemSugerida * 10) / 10,
              economia: Math.round(economia * 100) / 100,
            } as PriceComparison;
          } catch {
            return null;
          }
        });

        const batchResults = await Promise.allSettled(promises);
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) {
            results.push(r.value);
          }
        }
      }
      } // close else (catalog mode)

      setLastUpdate(new Date().toLocaleString('pt-BR'));

      if (results.length > 0) {
        toast.success(`Análise concluída: ${results.length} itens comparados com o mercado.`);
        // Generate AI recommendations
        generateAIRecommendations(results);
      } else {
        toast.warning('Não foi possível obter comparativos de preço. Verifique sua conexão.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro na análise de mercado.');
    }

    setLoading(false);
  };

  const generateAIRecommendations = async (data: PriceComparison[]) => {
    setLoadingAI(true);

    const context = data.map(d =>
      `${d.descricao}: Meu preço=${formatCurrency(d.meuPreco)}, Média mercado=${formatCurrency(d.mediaMercado)}, ` +
      `Diferença=${d.diferenca}%, Margem atual=${d.margemAtual}%, Oportunidade=${d.oportunidade}`
    ).join('\n');

    let aiText = '';
    await streamAIChat({
      messages: [{ role: 'user', content: context }],
      action: 'inteligencia-precos',
      context: `Você é um consultor especialista em precificação estratégica para licitações públicas brasileiras.
Analise os dados de comparação de preços abaixo e gere recomendações acionáveis.

REGRAS:
1. Para itens com oportunidade "aumentar": sugira ajuste de margem mantendo competitividade
2. Para itens com oportunidade "reduzir": alerte sobre risco de perder competitividade
3. Para itens "manter": confirme posicionamento adequado
4. Considere a Lei 14.133/2021 e riscos de inexequibilidade (margem < 5%)
5. Priorize recomendações por impacto financeiro

Responda APENAS em JSON válido:
{"recomendacoes": [{"item": "nome", "acao": "Aumentar/Reduzir/Manter margem", "justificativa": "razão", "impacto": "R$ X,XX potencial", "prioridade": "alta|media|baixa"}]}`,
      onDelta: (d) => { aiText += d; },
      onDone: () => {},
      onError: (err) => toast.error('Erro IA: ' + err),
    });

    try {
      let clean = aiText.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(clean);
      setRecommendations(parsed.recomendacoes || []);
    } catch {
      console.error('Erro ao parsear recomendações IA');
    }

    setLoadingAI(false);
  };

  // KPIs
  const kpis = useMemo(() => {
    if (comparisons.length === 0) return null;
    const aumentar = comparisons.filter(c => c.oportunidade === 'aumentar');
    const reduzir = comparisons.filter(c => c.oportunidade === 'reduzir');
    const manter = comparisons.filter(c => c.oportunidade === 'manter');
    const ganhosPotenciais = aumentar.reduce((acc, c) => acc + c.economia, 0);
    const margemMedia = comparisons.reduce((acc, c) => acc + c.margemAtual, 0) / comparisons.length;

    return {
      total: comparisons.length,
      aumentar: aumentar.length,
      reduzir: reduzir.length,
      manter: manter.length,
      ganhosPotenciais,
      margemMedia: Math.round(margemMedia * 10) / 10,
    };
  }, [comparisons]);

  // Chart data
  const chartData = useMemo(() =>
    comparisons.slice(0, 10).map(c => ({
      name: c.descricao.length > 20 ? c.descricao.slice(0, 20) + '…' : c.descricao,
      'Meu Preço': c.meuPreco,
      'Média Mercado': c.mediaMercado,
      'Gov.br': c.precoGov || 0,
    })),
    [comparisons]
  );

  const oportunidadeChart = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: 'Aumentar Margem', value: kpis.aumentar, fill: 'hsl(var(--success))' },
      /* `--accent` é o mesmo verde do sucesso: "Manter" e "Aumentar" saíam da
         mesma cor na pizza. Azul informativo para a fatia neutra. */
      { name: 'Manter', value: kpis.manter, fill: 'hsl(var(--info))' },
      { name: 'Reduzir Preço', value: kpis.reduzir, fill: 'hsl(var(--destructive))' },
    ].filter(d => d.value > 0);
  }, [kpis]);

  // Filter
  const filtered = comparisons.filter(c => {
    if (searchTerm && !c.descricao.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterOportunidade !== 'todos' && c.oportunidade !== filterOportunidade) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header — cartão neutro (sem gradiente); recurso de IA leva o selo. */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <Brain className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              Inteligência de Preços com IA
              <SeloPraefectusIA />
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitora preços da concorrência e identifica oportunidades para aumentar margens sem perder competitividade
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {lastUpdate && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">Atualizado: {lastUpdate}</span>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={loading || (mode === 'manual' && !manualTerms.trim())}
            >
              {loading ? (
                <><Loader2 className="animate-spin" aria-hidden="true" /> Analisando...</>
              ) : (
                <><Zap aria-hidden="true" /> Analisar Mercado</>
              )}
            </Button>
          </div>
        </div>

        {/* Mode selector + manual input — controle segmentado sóbrio. */}
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1" role="group" aria-label="Origem dos itens">
              <Button
                type="button"
                size="sm"
                variant={mode === 'catalog' ? 'outline' : 'ghost'}
                aria-pressed={mode === 'catalog'}
                onClick={() => setMode('catalog')}
              >
                Catálogo ({catalogItems.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'manual' ? 'outline' : 'ghost'}
                aria-pressed={mode === 'manual'}
                onClick={() => setMode('manual')}
              >
                Busca Manual
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4">
              <span className="flex items-center gap-1 whitespace-nowrap"><ShoppingCart className="h-3 w-3" aria-hidden="true" /> Mercado Livre (API)</span>
              <span className="flex items-center gap-1 whitespace-nowrap"><ShoppingCart className="h-3 w-3" aria-hidden="true" /> Marketplaces</span>
              <span className="flex items-center gap-1 whitespace-nowrap"><Building2 className="h-3 w-3" aria-hidden="true" /> Gov.br (PNCP)</span>
            </div>
          </div>

          {mode === 'manual' && (
            <div className="flex gap-2">
              <Input
                aria-label="Produtos a pesquisar"
                placeholder="Digite os produtos separados por vírgula. Ex: papel A4 500 folhas, toner HP 83A, notebook Dell"
                value={manualTerms}
                onChange={(e) => setManualTerms(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
              />
            </div>
          )}
        </div>
      </div>

      {/* KPIs — cartões do DS (`LinhaKpis`), os mesmos seis números. */}
      {kpis && (
        <LinhaKpis
          itens={[
            { rotulo: 'Itens Analisados', valor: String(kpis.total), icone: BarChart3 },
            { rotulo: 'Aumentar Margem', valor: String(kpis.aumentar), icone: TrendingUp, tom: 'ok' },
            { rotulo: 'Manter Preço', valor: String(kpis.manter), icone: Shield, tom: 'info' },
            { rotulo: 'Reduzir Preço', valor: String(kpis.reduzir), icone: TrendingDown, tom: 'critico' },
            { rotulo: 'Ganhos Potenciais', valor: formatCurrency(kpis.ganhosPotenciais), icone: DollarSign, tom: 'ok' },
            { rotulo: 'Margem Média', valor: `${kpis.margemMedia}%`, icone: Target },
          ]}
        />
      )}

      {/* Charts — séries nas cores de gráfico do DS; legendas 12px. */}
      {comparisons.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <h4 className="mb-3 text-base font-semibold leading-6 text-foreground">Comparativo: Meu Preço vs. Mercado</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Meu Preço" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Média Mercado" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gov.br" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h4 className="mb-3 text-base font-semibold leading-6 text-foreground">Distribuição de Oportunidades</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={oportunidadeChart}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {oportunidadeChart.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* AI Recommendations — bloco de IA: selo e superfícies do trio tinta/linha. */}
      {(loadingAI || recommendations.length > 0) && (
        <Card className="p-5">
          <h4 className="mb-3 flex flex-wrap items-center gap-2 text-base font-semibold leading-6 text-foreground">
            <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Recomendações da IA
            <SeloPraefectusIA />
            {loadingAI && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className={`rounded-lg border p-3 ${
                rec.prioridade === 'alta' ? 'border-destructive-line bg-destructive-tint' :
                rec.prioridade === 'media' ? 'border-warning-line bg-warning-tint' :
                'border-border bg-secondary'
              }`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{rec.item}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{rec.justificativa}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge variant={
                      rec.prioridade === 'alta' ? 'danger' :
                      rec.prioridade === 'media' ? 'warning' : 'muted'
                    }>
                      {rec.prioridade}
                    </Badge>
                    <span className="whitespace-nowrap text-xs font-semibold text-foreground tabular-nums">{rec.impacto}</span>
                  </div>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                  {rec.acao.toLowerCase().includes('aumentar') ? (
                    <ArrowUpRight className="h-4 w-4 text-success-ink" aria-hidden="true" />
                  ) : rec.acao.toLowerCase().includes('reduzir') ? (
                    <ArrowDownRight className="h-4 w-4 text-destructive-ink" aria-hidden="true" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  {rec.acao}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      {comparisons.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Filtrar itens"
              placeholder="Filtrar itens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterOportunidade} onValueChange={setFilterOportunidade}>
            <SelectTrigger aria-label="Oportunidade" className="w-full sm:w-[200px]">
              <SelectValue placeholder="Oportunidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="aumentar">Aumentar Margem</SelectItem>
              <SelectItem value="manter">Manter</SelectItem>
              <SelectItem value="reduzir">Reduzir Preço</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Items table — cartões compactos do DS, selos semânticos. */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{item.descricao}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>Meu: <b className="text-foreground">{formatCurrency(item.meuPreco)}</b></span>
                  <span>Média: <b className="text-foreground">{formatCurrency(item.mediaMercado)}</b></span>
                  {item.precoGov && <span>Gov: <b className="text-foreground">{formatCurrency(item.precoGov)}</b></span>}
                  <span>Margem: <b className="text-foreground">{item.margemAtual}%</b></span>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className={`flex items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
                    item.diferenca < -5 ? 'text-success-ink' : item.diferenca > 10 ? 'text-destructive-ink' : 'text-foreground'
                  }`}>
                    {item.diferenca < -5 ? <ArrowDownRight className="h-4 w-4" aria-hidden="true" /> :
                     item.diferenca > 10 ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> :
                     <Minus className="h-4 w-4" aria-hidden="true" />}
                    {item.diferenca > 0 ? '+' : ''}{item.diferenca}%
                  </div>
                  <p className="text-xs text-muted-foreground">vs. mercado</p>
                </div>
                <Badge variant={
                  item.oportunidade === 'aumentar' ? 'success' :
                  item.oportunidade === 'reduzir' ? 'danger' :
                  'muted'
                }>
                  {item.oportunidade === 'aumentar' ? '↑ Aumentar' :
                   item.oportunidade === 'reduzir' ? '↓ Reduzir' : '= Manter'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {comparisons.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-border">
          <EstadoVazio
            icone={<Brain />}
            titulo="Inteligência de Preços"
            descricao={
              <>
                {mode === 'manual'
                  ? 'Digite os produtos acima e clique em Analisar Mercado para comparar preços em marketplaces e Gov.br.'
                  : 'Clique em Analisar Mercado para comparar automaticamente seus preços do catálogo com marketplaces e o Painel de Preços Gov.br.'
                }
                {mode === 'catalog' && catalogItems.length === 0 && (
                  <span className="mt-3 block">
                    Catálogo vazio — use a aba <b>Busca Manual</b> para pesquisar produtos diretamente.
                  </span>
                )}
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
