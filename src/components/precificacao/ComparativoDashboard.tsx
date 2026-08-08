import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
        Carregando dados comparativos...
      </div>
    );
  }

  const totalResults = marketplaceData.length + govbrData.length + fornecedorData.length;

  if (totalResults === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="w-14 h-14 mx-auto mb-4 opacity-20" />
        <p className="text-base font-medium mb-1">Nenhum dado para comparar ainda</p>
        <p className="text-sm">Faça pesquisas nos Marketplaces, consulte o Painel Gov.br ou envie cotações de fornecedores para gerar o comparativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total de Preços',
            value: totalResults.toString(),
            icon: Package,
            color: 'text-muted-foreground',
            bg: 'bg-muted',
          },
          {
            label: 'Marketplaces',
            value: marketplaceData.length.toString(),
            icon: ShoppingCart,
            color: 'text-warning',
            bg: 'bg-warning/10',
          },
          {
            label: 'Gov.br',
            value: govbrData.length.toString(),
            icon: Building2,
            color: 'text-info',
            bg: 'bg-info/10',
          },
          {
            label: 'Fornecedores',
            value: fornecedorData.length.toString(),
            icon: FileText,
            color: 'text-muted-foreground',
            bg: 'bg-muted',
          },
          {
            label: 'Economia Média',
            value: stats.avgEconomia > 0 ? `-${stats.avgEconomia.toFixed(1)}%` : '—',
            icon: TrendingDown,
            color: 'text-success',
            bg: 'bg-success/10',
          },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/40 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <div className={`p-1.5 rounded-md ${s.bg}`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar chart */}
          <div className="lg:col-span-2 bg-card border border-border/40 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Comparativo de Preços por Item
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Marketplace" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="Gov.br" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="Fornecedor" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar chart */}
          <div className="bg-card border border-border/40 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              Cobertura por Fonte
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={sourceDistribution}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar name="Qtd. Preços" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar itens..."
            value={filterTerm}
            onChange={e => setFilterTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="outline" className="text-xs">
          {filtered.length} itens
        </Badge>
      </div>

      {/* Comparison Table */}
      <div className="bg-card border border-border/40 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center justify-end gap-1"><ShoppingCart className="w-3 h-3" /> Marketplace</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center justify-end gap-1"><Building2 className="w-3 h-3" /> Gov.br</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center justify-end gap-1"><FileText className="w-3 h-3" /> Fornecedor</span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Melhor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Economia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filtered.slice(0, 30).map((item, idx) => {
                const sources = [item.marketplace, item.govbr, item.fornecedor].filter(Boolean) as number[];
                const minPrice = sources.length > 0 ? Math.min(...sources) : 0;

                return (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground max-w-[250px] truncate">
                      {item.descricao}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.marketplace ? (
                        <span className={item.marketplace === minPrice ? 'text-success font-semibold' : 'text-foreground'}>
                          {formatCurrency(item.marketplace)}
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.govbr ? (
                        <span className={item.govbr === minPrice ? 'text-success font-semibold' : 'text-foreground'}>
                          {formatCurrency(item.govbr)}
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.fornecedor ? (
                        <span className={item.fornecedor === minPrice ? 'text-success font-semibold' : 'text-foreground'}>
                          {formatCurrency(item.fornecedor)}
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {item.melhorFonte ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            item.melhorFonte === 'Marketplace' ? 'bg-warning/10 text-warning border-warning/20' :
                            item.melhorFonte === 'Gov.br' ? 'bg-info/10 text-info border-info/20' :
                            'bg-muted text-foreground border-border'
                          }`}
                        >
                          {item.melhorFonte === 'Marketplace' && <ShoppingCart className="w-2.5 h-2.5 mr-0.5" />}
                          {item.melhorFonte === 'Gov.br' && <Building2 className="w-2.5 h-2.5 mr-0.5" />}
                          {item.melhorFonte === 'Fornecedor' && <FileText className="w-2.5 h-2.5 mr-0.5" />}
                          {item.melhorFonte}
                        </Badge>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {(item.economia || 0) > 0 ? (
                        <span className="text-success font-semibold flex items-center justify-end gap-0.5 text-xs">
                          <ArrowDown className="w-3 h-3" />
                          {item.economia!.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum item encontrado com esse filtro.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-chart-1" /> Marketplace
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-chart-2" /> Painel Gov.br
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-chart-3" /> Fornecedor
        </span>
        <span className="ml-auto flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-success" />
          Valores em <span className="font-semibold text-success">verde</span> = melhor preço
        </span>
      </div>
    </div>
  );
}
