import { useState, useCallback, useEffect, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EstadoVazio from '@/components/shared/EstadoVazio';
import { toast } from 'sonner';
import {
  Search, TrendingUp, TrendingDown, Minus, ExternalLink,
  Loader2, BarChart3, History, ShieldCheck, DollarSign,
} from 'lucide-react';

type VarianteStatus = 'success' | 'warning' | 'danger' | 'info' | 'muted';

// A fonte é dado (o portal de onde o preço veio), não estado: badge neutro para
// as externas e a tinta da marca para o que nasceu aqui dentro. A classe é
// necessária porque `info` e `muted` dividem o mesmo fundo no Badge — sem ela o
// destaque do histórico próprio só existiria no código; cor de status (success,
// warning) fica reservada a estado de verdade.
const FONTES_CONFIG: Record<string, { nome: string; variante: VarianteStatus; tipo: string; classe?: string }> = {
  pncp_ata: { nome: 'PNCP — Atas', variante: 'muted', tipo: 'oficial' },
  pncp_contratacao: { nome: 'PNCP — Contratos', variante: 'muted', tipo: 'oficial' },
  painel_mpog: { nome: 'Painel MPOG', variante: 'muted', tipo: 'oficial' },
  bps: { nome: 'BPS Saúde', variante: 'muted', tipo: 'oficial' },
  mercadolivre: { nome: 'Mercado Livre', variante: 'muted', tipo: 'marketplace' },
  amazon: { nome: 'Amazon', variante: 'muted', tipo: 'marketplace' },
  americanas: { nome: 'Americanas', variante: 'muted', tipo: 'marketplace' },
  magalu: { nome: 'Magazine Luiza', variante: 'muted', tipo: 'marketplace' },
  dental_cremer: { nome: 'Dental Cremer', variante: 'muted', tipo: 'nicho_saude' },
  cirurgica_fernandes: { nome: 'Cirúrgica Fernandes', variante: 'muted', tipo: 'nicho_saude' },
  kabum: { nome: 'KaBuM!', variante: 'muted', tipo: 'nicho_ti' },
  pichau: { nome: 'Pichau', variante: 'muted', tipo: 'nicho_ti' },
  leroy_merlin: { nome: 'Leroy Merlin', variante: 'muted', tipo: 'nicho_construcao' },
  marketplace: { nome: 'Marketplace', variante: 'muted', tipo: 'marketplace' },
  historico_proprio: {
    nome: 'Histórico próprio',
    variante: 'info',
    tipo: 'interno',
    classe: 'border-primary bg-primary-tint text-primary',
  },
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
  // O componente é reutilizável (aba do agente, diálogo de precificação): os
  // ids dos campos precisam ser únicos por instância para o label casar.
  const campoId = useId();

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
      {/* Busca */}
      <div className="space-y-3">
        {!compacto && (
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">
              Pesquisa de preços <span className="text-primary">AURÉLIA</span>
            </h3>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${campoId}-item`} className="mb-1 block text-sm font-medium text-foreground">
              Descrição do item
            </label>
            <Input
              id={`${campoId}-item`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Ex: Luva de procedimento não estéril tamanho M caixa com 100 unidades"
            />
          </div>
          <div className="md:w-40">
            <label htmlFor={`${campoId}-catmat`} className="mb-1 block text-sm font-medium text-foreground">
              CATMAT (opcional)
            </label>
            <Input
              id={`${campoId}-catmat`}
              value={catmat}
              onChange={(e) => setCatmat(e.target.value)}
              placeholder="Código"
            />
          </div>
          <Button onClick={buscar} disabled={buscando || !query.trim()} className="w-full md:w-auto">
            {buscando
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Search className="h-4 w-4" aria-hidden="true" />}
            {buscando ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>

        {/* Termos normalizados */}
        {resultados?.query_normalizada && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Termos:</span>
            {resultados.query_normalizada.termos_gerais?.map((t: string, i: number) => (
              <Badge key={i} variant="muted">{t}</Badge>
            ))}
            <Badge variant={resultados.cache ? 'muted' : 'info'}>
              {resultados.cache ? 'Cache' : 'Tempo real'}
            </Badge>
            {resultados.duracao_ms && (
              <span className="text-muted-foreground tabular-nums">{resultados.duracao_ms}ms</span>
            )}
          </div>
        )}
      </div>

      {/* Estatísticas Rápidas */}
      {resultados?.estatisticas && resultados.estatisticas.total_registros > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 [&>*]:min-w-0">
            <div className="rounded-lg border border-border bg-primary-tint p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Preço sugerido</p>
              <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-primary">
                {formatCurrency(resultados.estatisticas.preco_sugerido)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Mínimo</p>
              <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-success-ink">
                {formatCurrency(resultados.estatisticas.minimo)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Mediana</p>
              <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-foreground">
                {formatCurrency(resultados.estatisticas.mediana)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Máximo</p>
              <p className="mt-1 text-[2rem] leading-10 font-bold tabular-nums text-destructive-ink">
                {formatCurrency(resultados.estatisticas.maximo)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  resultados.estatisticas.confiabilidade === 'alta' ? 'success' :
                  resultados.estatisticas.confiabilidade === 'media' ? 'warning' : 'muted'
                }
                className="gap-1"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {resultados.estatisticas.confiabilidade === 'alta' ? 'Alta confiança' :
                 resultados.estatisticas.confiabilidade === 'media' ? 'Média confiança' : 'Baixa confiança'}
              </Badge>
              <span className="text-muted-foreground">
                {resultados.estatisticas.total_registros} registros •
                CV: {resultados.estatisticas.coeficiente_variacao}%
              </span>
            </div>

            {onPrecoSelecionado && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onPrecoSelecionado(resultados.estatisticas.preco_sugerido)}
                >
                  <DollarSign className="h-4 w-4" aria-hidden="true" />
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
          <TabsList>
            <TabsTrigger value="resultados">
              Resultados ({resultados.resultados?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="h-4 w-4" aria-hidden="true" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="gap-2">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Por fonte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resultados">
            {/* Filtro por fonte */}
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filtroFonte === null ? 'default' : 'outline'}
                aria-pressed={filtroFonte === null}
                onClick={() => setFiltroFonte(null)}
              >
                Todas
              </Button>
              {Object.entries(fontesCount).map(([fonte, count]) => (
                <Button
                  key={fonte}
                  size="sm"
                  variant={filtroFonte === fonte ? 'default' : 'outline'}
                  aria-pressed={filtroFonte === fonte}
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
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted"
                      >
                        <span className="w-6 text-xs text-muted-foreground tabular-nums">#{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{r.titulo}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant={fonteCfg.variante} className={fonteCfg.classe}>{fonteCfg.nome}</Badge>
                            <span className="text-xs text-muted-foreground">{r.vendedor}</span>
                            {r.orgao && (
                              <span className="text-xs text-muted-foreground">• {r.orgao} ({r.uf_orgao})</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums text-foreground">{formatCurrency(r.preco_unitario)}</p>
                          {onPrecoSelecionado && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1"
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
                            aria-label={`Abrir anúncio de ${r.titulo} em nova aba`}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
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
                  <Card key={fonte}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={fonteCfg.variante} className={fonteCfg.classe}>{fonteCfg.nome}</Badge>
                        <span className="text-sm text-muted-foreground">{count as number} resultados</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-muted-foreground">Mín: <strong className="tabular-nums text-success-ink">{formatCurrency(min)}</strong></span>
                        <span className="text-muted-foreground">Méd: <strong className="tabular-nums text-foreground">{formatCurrency(media)}</strong></span>
                        <span className="text-muted-foreground">Máx: <strong className="tabular-nums text-destructive-ink">{formatCurrency(max)}</strong></span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Nada pesquisado ainda — ou pesquisa sem resultado */}
      {!buscando && !(resultados?.estatisticas?.total_registros > 0) && (
        <Card>
          {resultados ? (
            <EstadoVazio
              icone={<Search />}
              tamanho="compacto"
              titulo="Nenhum preço encontrado para este item"
              descricao="Tente uma descrição mais curta, sem marca, ou informe o código CATMAT."
            />
          ) : (
            <EstadoVazio
              icone={<Search />}
              tamanho="compacto"
              titulo="Digite a descrição do item para pesquisar preços"
              descricao="A AURÉLIA busca em fontes oficiais, marketplaces e no seu histórico."
            />
          )}
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
      <div className="flex h-32 items-center justify-center" role="status" aria-label="Carregando histórico">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <Card>
        <EstadoVazio
          icone={<History />}
          tamanho="compacto"
          titulo="Histórico insuficiente para este item"
          descricao="A série temporal é construída a cada nova pesquisa."
        />
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-lg font-semibold text-foreground">Histórico de variação</h4>
        <span className={`text-sm font-medium tabular-nums ${
          variacaoTotal > 5 ? 'text-destructive-ink' : variacaoTotal < -5 ? 'text-success-ink' : 'text-muted-foreground'
        }`}>
          {variacaoTotal > 0 ? '+' : ''}{variacaoTotal.toFixed(1)}% no período
          {variacaoTotal > 5 ? <TrendingUp aria-hidden="true" className="ml-1 inline h-3 w-3" /> :
           variacaoTotal < -5 ? <TrendingDown aria-hidden="true" className="ml-1 inline h-3 w-3" /> :
           <Minus aria-hidden="true" className="ml-1 inline h-3 w-3" />}
        </span>
      </div>

      {/* Barras da mediana — a mesma série da tabela abaixo */}
      <div className="flex h-24 items-end gap-1">
        {historico.slice(-30).map((h, i) => {
          const maxPreco = Math.max(...historico.map(x => Number(x.preco_mediana)));
          const altura = (Number(h.preco_mediana) / maxPreco) * 100;
          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`min-w-1 flex-1 rounded-t transition-opacity hover:opacity-80 ${
                      h.tendencia === 'alta' ? 'bg-destructive' :
                      h.tendencia === 'queda' ? 'bg-success' : 'bg-primary'
                    }`}
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

      {/* Série por data */}
      <div className="max-h-[16rem] overflow-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Mediana</TableHead>
              <TableHead className="text-right">Máximo</TableHead>
              <TableHead className="text-right">Variação</TableHead>
              <TableHead>Tendência</TableHead>
              <TableHead className="text-right">Reg.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...historico].reverse().map((h, i) => (
              <TableRow key={i}>
                <TableCell nowrap className="text-foreground tabular-nums">{formatDate(h.data_coleta)}</TableCell>
                <TableCell nowrap className="text-right tabular-nums text-success-ink">{formatCurrency(h.preco_minimo)}</TableCell>
                <TableCell nowrap className="text-right font-medium tabular-nums text-foreground">{formatCurrency(h.preco_mediana)}</TableCell>
                <TableCell nowrap className="text-right tabular-nums text-destructive-ink">{formatCurrency(h.preco_maximo)}</TableCell>
                <TableCell nowrap className="text-right tabular-nums">
                  {h.variacao_pct ? (
                    <span className={Number(h.variacao_pct) > 0 ? 'text-destructive-ink' : 'text-success-ink'}>
                      {Number(h.variacao_pct) > 0 ? '+' : ''}{Number(h.variacao_pct).toFixed(1)}%
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell nowrap>
                  {h.tendencia === 'alta' && <Badge variant="danger" className="gap-1"><TrendingUp aria-hidden="true" className="h-3 w-3" />Alta</Badge>}
                  {h.tendencia === 'queda' && <Badge variant="success" className="gap-1"><TrendingDown aria-hidden="true" className="h-3 w-3" />Queda</Badge>}
                  {h.tendencia === 'estavel' && <Badge variant="muted" className="gap-1"><Minus aria-hidden="true" className="h-3 w-3" />Estável</Badge>}
                  {!h.tendencia && '—'}
                </TableCell>
                <TableCell nowrap className="text-right tabular-nums text-muted-foreground">{h.total_registros}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
