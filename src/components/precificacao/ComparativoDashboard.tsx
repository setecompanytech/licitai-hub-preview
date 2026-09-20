import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import LinhaKpis from '@/components/shared/LinhaKpis';
import {
  BarChart3, Search, TrendingDown, TrendingUp, ShoppingCart,
  Building2, FileText, AlertTriangle, CheckCircle, ArrowDown, ArrowUp, Minus,
  DollarSign, Package, Percent
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from 'recharts';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type FonteResumo = {
  fonte: 'marketplace' | 'govbr' | 'fornecedor';
  label: string;
  icon: typeof ShoppingCart;
  color: string;
  chartColor: string;
  items: { descricao: string; preco: number; origem: string }[];
};

type ItemComparativo = {
  descricao: string;
  marketplace?: number;
  govbr?: number;
  fornecedor?: number;
  melhorFonte?: string;
  melhorPreco?: number;
  economia?: number;
};

export default function ComparativoDashboard() {
  const { user } = useAuth();
  const [filterTerm, setFilterTerm] = useState('');
  const [marketplaceData, setMarketplaceData] = useState<any[]>([]);
  const [govbrData, setGovbrData] = useState<any[]>([]);
  const [fornecedorData, setFornecedorData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    const [mpRes, fornRes] = await Promise.all([
      supabase
        .from('pesquisas_preco')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('cotacoes_fornecedor')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    // Parse marketplace data
    const mpItems: { descricao: string; preco: number; origem: string }[] = [];
    (mpRes.data || []).forEach((row: any) => {
      try {
        let parsed = JSON.parse(row.resultado);
        if (Array.isArray(parsed)) parsed = parsed[0];
        (parsed?.fornecedores || []).forEach((f: any) => {
          if (f?.preco && f?.nome) {
            mpItems.push({
              descricao: (f.nome || '').slice(0, 60),
              preco: Number(f.preco),
              origem: f.loja || 'Marketplace',
            });
          }
        });
      } catch { /* skip */ }
    });
    setMarketplaceData(mpItems);

    // Parse fornecedor data
    const fornItems: { descricao: string; preco: number; origem: string }[] = [];
    (fornRes.data || []).forEach((row: any) => {
      const itens = (row.itens as any[]) || [];
      itens.forEach((item: any) => {
        if (item?.preco_unitario && item?.descricao) {
          fornItems.push({
            descricao: item.descricao.slice(0, 60),
            preco: Number(item.preco_unitario),
            origem: row.nome_fornecedor || 'Fornecedor',
          });
        }
      });
    });
    setFornecedorData(fornItems);
    setLoading(false);
  };

  // Build comparison items by trying to match similar descriptions
  const comparativeItems = useMemo(() => {
    const allItems: ItemComparativo[] = [];
    const descMap = new Map<string, ItemComparativo>();

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

    marketplaceData.forEach(item => {
      const key = normalize(item.descricao);
      if (!descMap.has(key)) {
        descMap.set(key, { descricao: item.descricao });
      }
      const existing = descMap.get(key)!;
      if (!existing.marketplace || item.preco < existing.marketplace) {
        existing.marketplace = item.preco;
      }
    });

    fornecedorData.forEach(item => {
      const key = normalize(item.descricao);
      if (!descMap.has(key)) {
        descMap.set(key, { descricao: item.descricao });
      }
      const existing = descMap.get(key)!;
      if (!existing.fornecedor || item.preco < existing.fornecedor) {
        existing.fornecedor = item.preco;
      }
    });

    descMap.forEach(item => {
      const prices = [
        item.marketplace && { fonte: 'Marketplace', preco: item.marketplace },
        item.govbr && { fonte: 'Gov.br', preco: item.govbr },
        item.fornecedor && { fonte: 'Fornecedor', preco: item.fornecedor },
      ].filter(Boolean) as { fonte: string; preco: number }[];

      if (prices.length > 0) {
        const best = prices.reduce((a, b) => a.preco < b.preco ? a : b);
        const worst = prices.reduce((a, b) => a.preco > b.preco ? a : b);
        item.melhorFonte = best.fonte;
        item.melhorPreco = best.preco;
        item.economia = prices.length > 1
          ? ((worst.preco - best.preco) / worst.preco) * 100
          : 0;
      }
      allItems.push(item);
    });

    return allItems;
  }, [marketplaceData, govbrData, fornecedorData]);

  const filtered = filterTerm
    ? comparativeItems.filter(i => i.descricao.toLowerCase().includes(filterTerm.toLowerCase()))
    : comparativeItems;

  // Stats
  const stats = useMemo(() => {
    const mpAvg = marketplaceData.length > 0
      ? marketplaceData.reduce((s, i) => s + i.preco, 0) / marketplaceData.length : 0;
    const fornAvg = fornecedorData.length > 0
      ? fornecedorData.reduce((s, i) => s + i.preco, 0) / fornecedorData.length : 0;
    const totalItems = comparativeItems.length;
    const withMultiple = comparativeItems.filter(i =>
      [i.marketplace, i.govbr, i.fornecedor].filter(Boolean).length > 1
    ).length;
    const avgEconomia = comparativeItems.filter(i => (i.economia || 0) > 0).length > 0
      ? comparativeItems.filter(i => (i.economia || 0) > 0).reduce((s, i) => s + (i.economia || 0), 0) /
        comparativeItems.filter(i => (i.economia || 0) > 0).length
      : 0;

    return { mpAvg, fornAvg, totalItems, withMultiple, avgEconomia };
  }, [comparativeItems, marketplaceData, fornecedorData]);

  // Chart data: Top items with prices from multiple sources
  const chartData = useMemo(() => {
    return filtered
      .filter(i => [i.marketplace, i.fornecedor].filter(Boolean).length >= 1)
      .slice(0, 8)
      .map(i => ({
        name: i.descricao.length > 25 ? i.descricao.slice(0, 25) + '…' : i.descricao,
        Marketplace: i.marketplace || 0,
        'Gov.br': i.govbr || 0,
        Fornecedor: i.fornecedor || 0,
      }));
  }, [filtered]);

  // Source distribution
  const sourceDistribution = useMemo(() => {
    return [
      { subject: 'Marketplaces', value: marketplaceData.length, fullMark: Math.max(marketplaceData.length, fornecedorData.length, 1) },
      { subject: 'Gov.br', value: govbrData.length, fullMark: Math.max(marketplaceData.length, fornecedorData.length, 1) },
      { subject: 'Fornecedores', value: fornecedorData.length, fullMark: Math.max(marketplaceData.length, fornecedorData.length, 1) },
    ];
  }, [marketplaceData, govbrData, fornecedorData]);

  if (loading) {
    return (
      /* Esqueleto na forma do conteúdo: régua de KPIs, dois gráficos, tabela. */
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[112px] w-full" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-[320px] w-full lg:col-span-2" />
          <Skeleton className="h-[320px] w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
        <p className="text-sm text-muted-foreground">Carregando dados comparativos...</p>
      </div>
    );
  }

  const totalResults = marketplaceData.length + govbrData.length + fornecedorData.length;

  if (totalResults === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border">
        <EstadoVazio
          icone={<BarChart3 />}
          titulo="Nenhum dado para comparar ainda"
          descricao="Faça pesquisas nos Marketplaces, consulte o Painel Gov.br ou envie cotações de fornecedores para gerar o comparativo."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards — cartões KPI do DS (`LinhaKpis`), os mesmos números. */}
      <LinhaKpis
        itens={[
          { rotulo: 'Total de Preços', valor: totalResults.toString(), icone: Package },
          { rotulo: 'Marketplaces', valor: marketplaceData.length.toString(), icone: ShoppingCart, tom: 'aviso' },
          { rotulo: 'Gov.br', valor: govbrData.length.toString(), icone: Building2, tom: 'info' },
          { rotulo: 'Fornecedores', valor: fornecedorData.length.toString(), icone: FileText },
          { rotulo: 'Economia Média', valor: stats.avgEconomia > 0 ? `-${stats.avgEconomia.toFixed(1)}%` : '—', icone: TrendingDown, tom: 'ok' },
        ]}
      />

      {/* Charts Row — cores de gráfico do DS, legendas 12px, cartões p-5. */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Bar chart */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
            <h4 className="mb-3 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Comparativo de Preços por Item
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Marketplace" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="Gov.br" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="Fornecedor" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar chart */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h4 className="mb-3 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <Percent className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Cobertura por Fonte
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={sourceDistribution}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar name="Qtd. Preços" dataKey="value" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Filtrar itens"
            placeholder="Filtrar itens..."
            value={filterTerm}
            onChange={e => setFilterTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="tabular-nums">
          {filtered.length} itens
        </Badge>
      </div>

      {/* Comparison Table — `ui/table`: cabeçalho rebaixado sem caixa alta,
          linhas de 48px, números à direita, menor preço na tinta verde. */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1"><ShoppingCart className="h-3 w-3" aria-hidden="true" /> Marketplace</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1"><Building2 className="h-3 w-3" aria-hidden="true" /> Gov.br</span>
              </TableHead>
              <TableHead className="text-right">
                <span className="flex items-center justify-end gap-1"><FileText className="h-3 w-3" aria-hidden="true" /> Fornecedor</span>
              </TableHead>
              <TableHead>Melhor</TableHead>
              <TableHead className="text-right">Economia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 30).map((item, idx) => {
              const sources = [item.marketplace, item.govbr, item.fornecedor].filter(Boolean) as number[];
              const minPrice = sources.length > 0 ? Math.min(...sources) : 0;

              return (
                <TableRow key={idx}>
                  <TableCell className="max-w-[250px] font-medium text-foreground" truncate>
                    {item.descricao}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>
                    {item.marketplace ? (
                      <span className={item.marketplace === minPrice ? 'font-semibold text-success-ink' : 'text-foreground'}>
                        {formatCurrency(item.marketplace)}
                      </span>
                    ) : <span className="text-foreground-tertiary">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>
                    {item.govbr ? (
                      <span className={item.govbr === minPrice ? 'font-semibold text-success-ink' : 'text-foreground'}>
                        {formatCurrency(item.govbr)}
                      </span>
                    ) : <span className="text-foreground-tertiary">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>
                    {item.fornecedor ? (
                      <span className={item.fornecedor === minPrice ? 'font-semibold text-success-ink' : 'text-foreground'}>
                        {formatCurrency(item.fornecedor)}
                      </span>
                    ) : <span className="text-foreground-tertiary">—</span>}
                  </TableCell>
                  <TableCell>
                    {item.melhorFonte ? (
                      <Badge
                        variant={
                          item.melhorFonte === 'Marketplace' ? 'warning' :
                          item.melhorFonte === 'Gov.br' ? 'info' :
                          'muted'
                        }
                      >
                        {item.melhorFonte === 'Marketplace' && <ShoppingCart className="h-3 w-3" aria-hidden="true" />}
                        {item.melhorFonte === 'Gov.br' && <Building2 className="h-3 w-3" aria-hidden="true" />}
                        {item.melhorFonte === 'Fornecedor' && <FileText className="h-3 w-3" aria-hidden="true" />}
                        {item.melhorFonte}
                      </Badge>
                    ) : <span className="text-foreground-tertiary">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {(item.economia || 0) > 0 ? (
                      <span className="flex items-center justify-end gap-0.5 text-sm font-semibold tabular-nums text-success-ink">
                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        {item.economia!.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-foreground-tertiary">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <EstadoVazio tamanho="compacto" titulo="Nenhum item encontrado com esse filtro." />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-chart-1" aria-hidden="true" /> Marketplace
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-chart-2" aria-hidden="true" /> Painel Gov.br
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-chart-3" aria-hidden="true" /> Fornecedor
        </span>
        <span className="ml-auto flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-success-ink" aria-hidden="true" />
          Valores em <span className="font-semibold text-success-ink">verde</span> = melhor preço
        </span>
      </div>
    </div>
  );
}
