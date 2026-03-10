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
    }
  };

  // Run price comparison analysis
  const handleAnalyze = async () => {
    if (catalogItems.length === 0) {
      toast.error('Nenhum item no catálogo. Precifique itens primeiro na aba Calculadoras.');
      return;
    }

    setLoading(true);
    setComparisons([]);
    setRecommendations([]);

    try {
      const results: PriceComparison[] = [];

      // Analyze up to 20 items from catalog
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

      setComparisons(results);
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
      { name: 'Manter', value: kpis.manter, fill: 'hsl(var(--accent))' },
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
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-success/5 border border-primary/15 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Brain className="w-5 h-5 text-primary" />
              Inteligência de Preços com IA
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Monitora preços da concorrência e identifica oportunidades para aumentar margens sem perder competitividade
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-muted-foreground">Atualizado: {lastUpdate}</span>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={loading || catalogItems.length === 0}
              className="bg-primary hover:bg-primary/90"
              size="sm"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analisando...</>
              ) : (
                <><Zap className="w-4 h-4 mr-1" /> Analisar Mercado</>
              )}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Marketplaces</span>
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Gov.br (PNCP)</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Catálogo interno ({catalogItems.length} itens)</span>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Itens Analisados', value: kpis.total, icon: BarChart3, color: 'hsl(var(--accent))' },
            { label: 'Aumentar Margem', value: kpis.aumentar, icon: TrendingUp, color: 'hsl(142, 71%, 45%)' },
            { label: 'Manter Preço', value: kpis.manter, icon: Shield, color: 'hsl(var(--info))' },
            { label: 'Reduzir Preço', value: kpis.reduzir, icon: TrendingDown, color: 'hsl(0, 72%, 51%)' },
            { label: 'Ganhos Potenciais', value: formatCurrency(kpis.ganhosPotenciais), icon: DollarSign, color: 'hsl(142, 71%, 45%)' },
            { label: 'Margem Média', value: `${kpis.margemMedia}%`, icon: Target, color: 'hsl(var(--accent))' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="stat-card">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">{card.label}</p>
                    <p className="text-lg font-bold mt-0.5">{card.value}</p>
                  </div>
                  <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${card.color}15` }}>
                    <Icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      {comparisons.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 col-span-2">
            <h4 className="text-sm font-semibold mb-3">Comparativo: Meu Preço vs. Mercado</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Meu Preço" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Média Mercado" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gov.br" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Distribuição de Oportunidades</h4>
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* AI Recommendations */}
      {(loadingAI || recommendations.length > 0) && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            Recomendações da IA
            {loadingAI && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className={`p-3 rounded-lg border ${
                rec.prioridade === 'alta' ? 'border-destructive/30 bg-destructive/5' :
                rec.prioridade === 'media' ? 'border-warning/30 bg-warning/5' :
                'border-border/30 bg-muted/20'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{rec.item}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.justificativa}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={
                      rec.prioridade === 'alta' ? 'destructive' :
                      rec.prioridade === 'media' ? 'default' : 'secondary'
                    } className="text-[10px]">
                      {rec.prioridade}
                    </Badge>
                    <span className="text-xs font-semibold text-primary whitespace-nowrap">{rec.impacto}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground mt-1.5 flex items-center gap-1">
                  {rec.acao.toLowerCase().includes('aumentar') ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                  ) : rec.acao.toLowerCase().includes('reduzir') ? (
                    <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
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
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar itens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filterOportunidade} onValueChange={setFilterOportunidade}>
            <SelectTrigger className="w-[200px] h-9">
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

      {/* Items table */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-card border border-border/40 rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.descricao}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Meu: <b className="text-foreground">{formatCurrency(item.meuPreco)}</b></span>
                  <span>Média: <b className="text-foreground">{formatCurrency(item.mediaMercado)}</b></span>
                  {item.precoGov && <span>Gov: <b className="text-foreground">{formatCurrency(item.precoGov)}</b></span>}
                  <span>Margem: <b className="text-foreground">{item.margemAtual}%</b></span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                <div className="text-right">
                  <div className={`flex items-center gap-1 text-sm font-semibold ${
                    item.diferenca < -5 ? 'text-success' : item.diferenca > 10 ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {item.diferenca < -5 ? <ArrowDownRight className="w-4 h-4" /> :
                     item.diferenca > 10 ? <ArrowUpRight className="w-4 h-4" /> :
                     <Minus className="w-4 h-4" />}
                    {item.diferenca > 0 ? '+' : ''}{item.diferenca}%
                  </div>
                  <p className="text-[10px] text-muted-foreground">vs. mercado</p>
                </div>
                <Badge className={`text-[10px] ${
                  item.oportunidade === 'aumentar' ? 'bg-success/10 text-success border-success/20' :
                  item.oportunidade === 'reduzir' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                  'bg-accent/10 text-accent border-accent/20'
                }`}>
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
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-sm font-semibold mb-1">Inteligência de Preços</h3>
          <p className="text-xs max-w-md mx-auto">
            Clique em <b>Analisar Mercado</b> para comparar automaticamente seus preços do catálogo com
            marketplaces e o Painel de Preços Gov.br, identificando oportunidades de margem.
          </p>
          {catalogItems.length === 0 && (
            <p className="text-xs text-warning mt-3 flex items-center gap-1 justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
              Nenhum item no catálogo. Precifique itens na aba Calculadoras primeiro.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
