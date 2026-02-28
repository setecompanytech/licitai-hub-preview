import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ExternalLink, Star, Truck, ShieldCheck, Store, TrendingDown,
  Package, LayoutGrid, List, Percent, ArrowUpDown
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FornecedorML = {
  loja: string;
  produto: string;
  marca: string;
  modelo: string;
  preco: number;
  preco_original?: number;
  condicao: string;
  frete: string;
  url: string;
  parcelas?: string;
  avaliacao?: number;
  vendedor_qualificado?: boolean;
  observacoes?: string;
  telefone?: string;
  email?: string;
};

export type PesquisaMLResult = {
  produto: string;
  data_pesquisa: string;
  categoria: string;
  fornecedores: FornecedorML[];
  resumo: {
    menor_preco: number;
    maior_preco: number;
    preco_medio: number;
    variacao: string;
    fornecedor_menor: string;
    fornecedor_maior: string;
    recomendacao: string;
  };
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3 h-3 ${s <= Math.floor(rating) ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function getDiscountPercent(item: FornecedorML) {
  if (!item.preco_original || item.preco_original <= item.preco) return 0;
  return Math.round(((item.preco_original - item.preco) / item.preco_original) * 100);
}

function isFreteGratis(frete?: string) {
  if (!frete) return false;
  const f = frete.toLowerCase();
  return f.includes('grátis') || f.includes('gratis') || frete === '0' || frete === 'R$ 0,00';
}

/* ─── Google Shopping Grid Card ─── */
function GoogleShoppingCard({ item, isCheapest }: { item: FornecedorML; isCheapest: boolean }) {
  const desconto = getDiscountPercent(item);

  return (
    <div className="group relative flex flex-col bg-card border border-border/40 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer">
      {/* Discount badge */}
      {desconto > 0 && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-destructive/90 text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5">
            {desconto}% OFF
          </Badge>
        </div>
      )}
      {isCheapest && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-success/90 text-success-foreground text-[10px] font-bold px-1.5 py-0.5">
            <TrendingDown className="w-3 h-3 mr-0.5" /> Menor
          </Badge>
        </div>
      )}

      {/* Image area */}
      <div className="relative w-full aspect-square bg-muted/30 flex items-center justify-center p-6 border-b border-border/20">
        <Package className="w-16 h-16 text-muted-foreground/20" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        {/* Title */}
        <h3 className="text-xs font-normal text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
          {item.produto}
        </h3>

        {/* Rating */}
        {item.avaliacao ? (
          <RatingStars rating={item.avaliacao} />
        ) : (
          <div className="h-4" />
        )}

        {/* Price */}
        <div className="mt-auto">
          {item.preco_original && item.preco_original > item.preco && (
            <p className="text-[11px] text-muted-foreground line-through leading-none">
              {formatCurrency(item.preco_original)}
            </p>
          )}
          <p className="text-lg font-semibold text-foreground leading-tight">
            {formatCurrency(item.preco)}
          </p>
          {item.parcelas && (
            <p className="text-[10px] text-success font-medium mt-0.5">
              em {item.parcelas}
            </p>
          )}
        </div>

        {/* Store + Shipping */}
        <div className="flex items-center gap-1 mt-1">
          <Store className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground truncate">{item.loja}</span>
          {item.vendedor_qualificado && (
            <ShieldCheck className="w-3 h-3 text-primary ml-auto flex-shrink-0" />
          )}
        </div>

        {isFreteGratis(item.frete) && (
          <div className="flex items-center gap-1 text-success">
            <Truck className="w-3 h-3" />
            <span className="text-[10px] font-semibold">Frete grátis</span>
          </div>
        )}
      </div>

      {/* Footer action */}
      {item.url && item.url !== '#' && (
        <div className="border-t border-border/20 px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-primary hover:text-primary hover:bg-primary/10 text-xs h-7"
            onClick={() => window.open(item.url, '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Ver oferta
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Mercado Livre List Card ─── */
function MercadoLivreCard({ item, isCheapest }: { item: FornecedorML; isCheapest: boolean }) {
  const desconto = getDiscountPercent(item);

  return (
    <div className="group flex gap-4 p-4 bg-card border border-border/40 rounded-lg hover:shadow-md hover:border-primary/30 transition-all duration-200 relative">
      {/* Image placeholder */}
      <div className="flex-shrink-0 w-[160px] h-[160px] bg-muted/30 rounded-md flex items-center justify-center border border-border/20">
        <Package className="w-12 h-12 text-muted-foreground/20" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-normal text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors cursor-pointer">
            {item.produto}
          </h3>
          <div className="flex items-center gap-2 mb-2 flex-wrap mt-1">
            {item.marca && (
              <span className="text-xs text-muted-foreground">
                por <span className="font-medium">{item.marca}</span>
              </span>
            )}
            {item.modelo && (
              <span className="text-xs text-muted-foreground">· {item.modelo}</span>
            )}
          </div>
          {item.avaliacao && <RatingStars rating={item.avaliacao} />}
        </div>

        <div className="my-2">
          {item.preco_original && item.preco_original > item.preco && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(item.preco_original)}
              </span>
              <Badge className="bg-success/10 text-success border-success/20 text-[10px] px-1.5">
                {desconto}% OFF
              </Badge>
            </div>
          )}
          <p className="text-2xl font-light text-foreground tracking-tight">
            {formatCurrency(item.preco)}
          </p>
          {item.parcelas && (
            <p className="text-xs text-success font-medium mt-0.5">
              em {item.parcelas}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isFreteGratis(item.frete) ? (
            <div className="flex items-center gap-1 text-success">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Frete grátis</span>
            </div>
          ) : (
            item.frete && (
              <span className="text-xs text-muted-foreground">Frete: {item.frete}</span>
            )
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Store className="w-3 h-3" />
            <span className="text-xs">{item.loja}</span>
          </div>
          {item.vendedor_qualificado && (
            <div className="flex items-center gap-1 text-primary">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[10px] font-medium">MercadoLíder</span>
            </div>
          )}
          {isCheapest && (
            <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
              <TrendingDown className="w-3 h-3 mr-0.5" /> Menor preço
            </Badge>
          )}
        </div>
      </div>

      {/* Right action */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <Badge variant="outline" className="text-[10px]">
          {item.condicao || 'Novo'}
        </Badge>
        {item.url && item.url !== '#' && (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => window.open(item.url, '_blank')}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">Ver</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Resumo de Preços ─── */
function ResumoPrecos({ resumo }: { resumo: PesquisaMLResult['resumo'] }) {
  return (
    <div className="bg-gradient-to-r from-primary/5 to-success/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        📊 Resumo de Preços
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center p-2 bg-card rounded-md border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Menor Preço</p>
          <p className="text-lg font-bold text-success">{formatCurrency(resumo.menor_preco)}</p>
          <p className="text-[10px] text-muted-foreground">{resumo.fornecedor_menor}</p>
        </div>
        <div className="text-center p-2 bg-card rounded-md border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Maior Preço</p>
          <p className="text-lg font-bold text-destructive">{formatCurrency(resumo.maior_preco)}</p>
          <p className="text-[10px] text-muted-foreground">{resumo.fornecedor_maior}</p>
        </div>
        <div className="text-center p-2 bg-card rounded-md border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço Médio</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(resumo.preco_medio)}</p>
        </div>
        <div className="text-center p-2 bg-card rounded-md border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Variação</p>
          <p className="text-lg font-bold text-primary">{resumo.variacao}</p>
        </div>
      </div>
      {resumo.recomendacao && (
        <div className="bg-card rounded-md border border-border/30 p-3">
          <p className="text-xs text-muted-foreground">
            💡 <span className="font-medium text-foreground">Recomendação:</span> {resumo.recomendacao}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-card border border-border/40 rounded-xl overflow-hidden">
          <div className="w-full aspect-square bg-muted" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-5 bg-muted rounded w-1/2 mt-3" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function PesquisaResultML({
  data,
  isLoading,
  rawMarkdown,
}: {
  data: PesquisaMLResult | null;
  isLoading: boolean;
  rawMarkdown?: string;
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'relevante' | 'menor' | 'maior'>('relevante');

  if (isLoading) return <LoadingSkeleton />;
  if (!data && !rawMarkdown) return null;

  if (data) {
    const sorted = [...data.fornecedores].sort((a, b) => {
      if (sortMode === 'menor') return a.preco - b.preco;
      if (sortMode === 'maior') return b.preco - a.preco;
      // relevante: qualified first, then by rating desc, then price asc
      const scoreA = (a.vendedor_qualificado ? 100 : 0) + (a.avaliacao || 0) * 10 - a.preco * 0.001;
      const scoreB = (b.vendedor_qualificado ? 100 : 0) + (b.avaliacao || 0) * 10 - b.preco * 0.001;
      return scoreB - scoreA;
    });
    const cheapestPrice = Math.min(...data.fornecedores.map(f => f.preco));

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Resultados para "<span className="text-primary">{data.produto}</span>"
            </h3>
            <p className="text-xs text-muted-foreground">
              {data.fornecedores.length} fornecedores encontrados · Pesquisa em {data.data_pesquisa}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as any)}>
                <SelectTrigger className="w-[170px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevante">Mais relevantes</SelectItem>
                  <SelectItem value="menor">Menor preço</SelectItem>
                  <SelectItem value="maior">Maior preço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* View toggle */}
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
                title="Google Shopping"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
                title="Mercado Livre"
              >
                <List className="w-3.5 h-3.5" />
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* Products */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sorted.map((item, i) => (
              <GoogleShoppingCard
                key={i}
                item={item}
                isCheapest={item.preco === cheapestPrice}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((item, i) => (
              <MercadoLivreCard
                key={i}
                item={item}
                isCheapest={item.preco === cheapestPrice}
              />
            ))}
          </div>
        )}

        {/* Summary */}
        {data.resumo && <ResumoPrecos resumo={data.resumo} />}
      </div>
    );
  }

  if (rawMarkdown) {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert overflow-x-auto">
        <ReactMarkdown>{rawMarkdown}</ReactMarkdown>
      </div>
    );
  }

  return null;
}
