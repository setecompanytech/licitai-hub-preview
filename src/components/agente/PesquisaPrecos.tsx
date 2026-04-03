import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Search, TrendingUp, TrendingDown, Minus, ExternalLink,
  Loader2, BarChart3, History, ShieldCheck, AlertTriangle,
  DollarSign, Filter, Bell,
} from 'lucide-react';

const FONTES_CONFIG: Record<string, { nome: string; cor: string; tipo: string }> = {
  pncp_ata: { nome: 'PNCP — Atas', cor: 'bg-blue-500/20 text-blue-400', tipo: 'oficial' },
  pncp_contratacao: { nome: 'PNCP — Contratos', cor: 'bg-indigo-500/20 text-indigo-400', tipo: 'oficial' },
  painel_mpog: { nome: 'Painel MPOG', cor: 'bg-violet-500/20 text-violet-400', tipo: 'oficial' },
  bps: { nome: 'BPS Saúde', cor: 'bg-pink-500/20 text-pink-400', tipo: 'oficial' },
  mercadolivre: { nome: 'Mercado Livre', cor: 'bg-yellow-500/20 text-yellow-400', tipo: 'marketplace' },
  amazon: { nome: 'Amazon', cor: 'bg-orange-500/20 text-orange-400', tipo: 'marketplace' },
  americanas: { nome: 'Americanas', cor: 'bg-red-500/20 text-red-400', tipo: 'marketplace' },
  magalu: { nome: 'Magazine Luiza', cor: 'bg-blue-500/20 text-blue-400', tipo: 'marketplace' },
  dental_cremer: { nome: 'Dental Cremer', cor: 'bg-emerald-500/20 text-emerald-400', tipo: 'nicho_saude' },
  cirurgica_fernandes: { nome: 'Cirúrgica Fernandes', cor: 'bg-teal-500/20 text-teal-400', tipo: 'nicho_saude' },
  kabum: { nome: 'KaBuM!', cor: 'bg-orange-500/20 text-orange-400', tipo: 'nicho_ti' },
  pichau: { nome: 'Pichau', cor: 'bg-violet-500/20 text-violet-400', tipo: 'nicho_ti' },
  leroy_merlin: { nome: 'Leroy Merlin', cor: 'bg-green-500/20 text-green-400', tipo: 'nicho_construcao' },
  marketplace: { nome: 'Marketplace', cor: 'bg-muted text-muted-foreground', tipo: 'marketplace' },
  historico_proprio: { nome: 'Histórico Próprio', cor: 'bg-primary/20 text-primary', tipo: 'interno' },
};

interface PesquisaPrecosProps {
  itemInicial?: string;
  catmatInicial?: string;
  onPrecoSelecionado?: (preco: number) => void;
  compacto?: boolean;
}

export default function PesquisaPrecos({
  itemInicial,
  catmatInicial,
  onPrecoSelecionado,
  compacto = false,
}: PesquisaPrecosProps) {
  const [query, setQuery] = useState(itemInicial ?? '');
  const [catmat, setCatmat] = useState(catmatInicial ?? '');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<any>(null);
  const [filtroFonte, setFiltroFonte] = useState<string | null>(null);
  const [abaSelecionada, setAbaSelecionada] = useState<'resultados' | 'historico' | 'estatisticas'>('resultados');

  const buscar = useCallback(async () => {
    if (!query.trim()) return;
    setBuscando(true);
    setResultados(null);

    try {
      const { data, error } = await supabase.functions.invoke('price-search', {
        body: {
          descricao: query,
          codigoCatmat: catmat || undefined,
          modo: 'manual',
        },
      });

      if (error) throw error;
      setResultados(data);

      if (data?.estatisticas?.total_registros > 0) {
        toast.success(`${data.estatisticas.total_registros} resultados em ${data.duracao_ms}ms`);
      } else {
        toast.info('Nenhum resultado encontrado');
      }
    } catch (e) {
      console.error('Erro na pesquisa:', e);
      toast.error('Erro ao pesquisar preços');
    } finally {
      setBuscando(false);
    }
  }, [query, catmat]);

  const formatCurrency = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const resultadosFiltrados = resultados?.resultados?.filter((r: any) =>
    !filtroFonte || r.fonte === filtroFonte
  ) ?? [];

  const fontesCount = resultados?.resultados?.reduce((acc: any, r: any) => {
    acc[r.fonte] = (acc[r.fonte] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="space-y-3">
        {!compacto && (
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              Pesquisa de Preços <span className="text-primary">AURÉLIA</span>
            </h3>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Ex: Luva de procedimento não estéril tamanho M caixa com 100 unidades"
            className="flex-1"
          />
          <Input
            value={catmat}
            onChange={(e) => setCatmat(e.target.value)}
            placeholder="CATMAT (opt.)"
            className="w-32"
          />
          <Button onClick={buscar} disabled={buscando || !query.trim()}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {!compacto && (buscando ? ' Buscando...' : ' Buscar')}
          </Button>
        </div>

        {/* Termos normalizados */}
        {resultados?.query_normalizada && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">Termos:</span>
            {resultados.query_normalizada.termos_gerais?.map((t: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
            ))}
            <Badge variant={resultados.cache ? 'secondary' : 'default'} className="text-xs">
              {resultados.cache ? 'Cache' : 'Tempo real'}
            </Badge>
            {resultados.duracao_ms && (
              <span className="text-muted-foreground">{resultados.duracao_ms}ms</span>
            )}
          </div>
        )}
      </div>

      {/* Estatísticas Rápidas */}
      {resultados?.estatisticas && resultados.estatisticas.total_registros > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Preço Sugerido</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(resultados.estatisticas.preco_sugerido)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Mínimo</p>
                <p className="text-lg font-bold text-emerald-400">
                  {formatCurrency(resultados.estatisticas.minimo)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Mediana</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(resultados.estatisticas.mediana)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Máximo</p>
                <p className="text-lg font-bold text-red-400">
                  {formatCurrency(resultados.estatisticas.maximo)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={
                resultados.estatisticas.confiabilidade === 'alta' ? 'default' :
                resultados.estatisticas.confiabilidade === 'media' ? 'secondary' : 'outline'
              }>
                <ShieldCheck className="h-3 w-3 mr-1" />
                {resultados.estatisticas.confiabilidade === 'alta' ? 'Alta confiança' :
                 resultados.estatisticas.confiabilidade === 'media' ? 'Média confiança' : 'Baixa confiança'}
              </Badge>
              <span className="text-muted-foreground">
                {resultados.estatisticas.total_registros} registros •
                CV: {resultados.estatisticas.coeficiente_variacao}%
              </span>
            </div>

            {onPrecoSelecionado && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onPrecoSelecionado(resultados.estatisticas.preco_sugerido)}
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Usar sugerido ({formatCurrency(resultados.estatisticas.preco_sugerido)})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPrecoSelecionado(resultados.estatisticas.mediana)}
                >
                  Usar mediana ({formatCurrency(resultados.estatisticas.mediana)})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs de resultados */}
      {resultados && resultados.estatisticas?.total_registros > 0 && (
        <Tabs value={abaSelecionada} onValueChange={(v) => setAbaSelecionada(v as any)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="resultados">
              Resultados ({resultados.resultados?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-3 w-3 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="estatisticas">
              <BarChart3 className="h-3 w-3 mr-1" />
              Por Fonte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resultados">
            {/* Filtro por fonte */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              <Button
                size="sm"
                variant={filtroFonte === null ? 'default' : 'outline'}
                className="text-xs h-7"
                onClick={() => setFiltroFonte(null)}
              >
                Todas
              </Button>
              {Object.entries(fontesCount).map(([fonte, count]) => (
                <Button
                  key={fonte}
                  size="sm"
                  variant={filtroFonte === fonte ? 'default' : 'outline'}
                  className="text-xs h-7"
                  onClick={() => setFiltroFonte(filtroFonte === fonte ? null : fonte)}
                >
                  {FONTES_CONFIG[fonte]?.nome ?? fonte} ({count as number})
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {resultadosFiltrados
                  .sort((a: any, b: any) => a.preco_unitario - b.preco_unitario)
                  .map((r: any, i: number) => {
                    const fonteCfg = FONTES_CONFIG[r.fonte] ?? FONTES_CONFIG.marketplace;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.titulo}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`text-xs ${fonteCfg.cor}`}>
                              {fonteCfg.nome}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{r.vendedor}</span>
                            {r.orgao && (
                              <span className="text-xs text-muted-foreground">• {r.orgao} ({r.uf_orgao})</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-foreground">{formatCurrency(r.preco_unitario)}</p>
                          {onPrecoSelecionado && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-6 mt-1"
                              onClick={() => onPrecoSelecionado(r.preco_unitario)}
                            >
                              Usar
                            </Button>
                          )}
                        </div>
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="historico">
            <HistoricoVariacao descricao={query} codigoCatmat={catmat || undefined} />
          </TabsContent>

          <TabsContent value="estatisticas">
            <div className="space-y-3">
              {Object.entries(fontesCount).map(([fonte, count]) => {
                const fonteCfg = FONTES_CONFIG[fonte] ?? FONTES_CONFIG.marketplace;
                const precosFonte = resultados.resultados
                  .filter((r: any) => r.fonte === fonte)
                  .map((r: any) => r.preco_unitario);
                const min = Math.min(...precosFonte);
                const max = Math.max(...precosFonte);
                const media = precosFonte.reduce((a: number, b: number) => a + b, 0) / precosFonte.length;

                return (
                  <Card key={fonte} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${fonteCfg.cor}`}>{fonteCfg.nome}</Badge>
                          <span className="text-xs text-muted-foreground">{count as number} resultados</span>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-muted-foreground">Mín: <strong className="text-emerald-400">{formatCurrency(min)}</strong></span>
                          <span className="text-muted-foreground">Méd: <strong className="text-foreground">{formatCurrency(media)}</strong></span>
                          <span className="text-muted-foreground">Máx: <strong className="text-red-400">{formatCurrency(max)}</strong></span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state */}
      {!resultados && !buscando && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Digite a descrição do item para pesquisar preços.</p>
            <p className="text-sm text-muted-foreground mt-1">
              AURÉLIA busca automaticamente em fontes oficiais, marketplaces e histórico.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Sub-componente: Histórico de Variação
function HistoricoVariacao({ descricao, codigoCatmat }: { descricao: string; codigoCatmat?: string }) {
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      const query = supabase
        .from('price_historico')
        .select('*')
        .order('data_coleta', { ascending: true })
        .limit(90);

      if (codigoCatmat) {
        query.eq('codigo_catmat', codigoCatmat);
      } else {
        query.ilike('descricao', `%${descricao.split(' ')[0]}%`);
      }

      const { data } = await query;
      setHistorico(data ?? []);
      setLoading(false);
    };
    carregar();
  }, [descricao, codigoCatmat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center">
          <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Histórico insuficiente para este item. A série temporal será construída a cada nova pesquisa.
          </p>
        </CardContent>
      </Card>
    );
  }

  const variacaoTotal = historico.length >= 2
    ? ((historico[historico.length - 1].preco_mediana - historico[0].preco_mediana) / historico[0].preco_mediana * 100)
    : 0;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const formatCurrency = (val: number) =>
    `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Histórico de Variação</h4>
        <span className={`text-sm font-medium ${
          variacaoTotal > 5 ? 'text-red-400' : variacaoTotal < -5 ? 'text-emerald-400' : 'text-muted-foreground'
        }`}>
          {variacaoTotal > 0 ? '+' : ''}{variacaoTotal.toFixed(1)}% no período
          {variacaoTotal > 5 ? <TrendingUp className="h-3 w-3 inline ml-1" /> :
           variacaoTotal < -5 ? <TrendingDown className="h-3 w-3 inline ml-1" /> :
           <Minus className="h-3 w-3 inline ml-1" />}
        </span>
      </div>

      {/* Simple bar chart */}
      <div className="flex items-end gap-1 h-24">
        {historico.slice(-30).map((h, i) => {
          const maxPreco = Math.max(...historico.map(x => Number(x.preco_mediana)));
          const altura = (Number(h.preco_mediana) / maxPreco) * 100;
          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 min-w-1 rounded-t transition-colors ${
                      h.tendencia === 'alta' ? 'bg-red-400/60' :
                      h.tendencia === 'queda' ? 'bg-emerald-400/60' : 'bg-primary/40'
                    } hover:opacity-80`}
                    style={{ height: `${altura}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p>{formatDate(h.data_coleta)}</p>
                    <p>Mediana: {formatCurrency(h.preco_mediana)}</p>
                    {h.variacao_pct && <p>Variação: {Number(h.variacao_pct).toFixed(1)}%</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* Table */}
      <ScrollArea className="h-[200px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left p-2">Data</th>
              <th className="text-right p-2">Mínimo</th>
              <th className="text-right p-2">Mediana</th>
              <th className="text-right p-2">Máximo</th>
              <th className="text-right p-2">Variação</th>
              <th className="text-center p-2">Tendência</th>
              <th className="text-right p-2">Reg.</th>
            </tr>
          </thead>
          <tbody>
            {[...historico].reverse().map((h, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-2 text-foreground">{formatDate(h.data_coleta)}</td>
                <td className="p-2 text-right text-emerald-400">{formatCurrency(h.preco_minimo)}</td>
                <td className="p-2 text-right font-medium text-foreground">{formatCurrency(h.preco_mediana)}</td>
                <td className="p-2 text-right text-red-400">{formatCurrency(h.preco_maximo)}</td>
                <td className="p-2 text-right">
                  {h.variacao_pct ? (
                    <span className={Number(h.variacao_pct) > 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {Number(h.variacao_pct) > 0 ? '+' : ''}{Number(h.variacao_pct).toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="p-2 text-center">
                  {h.tendencia === 'alta' && <TrendingUp className="h-3 w-3 text-red-400 inline" />}
                  {h.tendencia === 'queda' && <TrendingDown className="h-3 w-3 text-emerald-400 inline" />}
                  {h.tendencia === 'estavel' && <Minus className="h-3 w-3 text-muted-foreground inline" />}
                  {!h.tendencia && '—'}
                </td>
                <td className="p-2 text-right text-muted-foreground">{h.total_registros}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
