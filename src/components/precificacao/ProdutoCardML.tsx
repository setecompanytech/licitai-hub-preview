import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Star, Truck, ShieldCheck, Store, TrendingDown, Package } from 'lucide-react';

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
          className={`w-3 h-3 ${s <= Math.floor(rating) ? 'fill-[#3483fa] text-[#3483fa]' : 'text-muted-foreground/30'}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function ProdutoCard({ item, isCheapest }: { item: FornecedorML; isCheapest: boolean }) {
  const desconto = item.preco_original
    ? Math.round(((item.preco_original - item.preco) / item.preco_original) * 100)
    : 0;
  const freteGratis = item.frete?.toLowerCase().includes('grátis') || item.frete?.toLowerCase().includes('gratis') || item.frete === '0' || item.frete === 'R$ 0,00';

  return (
    <div className="group flex gap-4 p-4 bg-card border border-border/40 rounded-lg hover:shadow-md hover:border-[#3483fa]/30 transition-all duration-200 relative">
      {/* Image placeholder */}
      <div className="flex-shrink-0 w-[160px] h-[160px] bg-muted/50 rounded-md flex items-center justify-center border border-border/20">
        <Package className="w-12 h-12 text-muted-foreground/30" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        {/* Top: Title + badges */}
        <div>
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-sm font-normal text-foreground leading-snug line-clamp-2 group-hover:text-[#3483fa] transition-colors cursor-pointer">
              {item.produto}
            </h3>
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
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

        {/* Middle: Price */}
        <div className="my-2">
          {item.preco_original && item.preco_original > item.preco && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(item.preco_original)}
              </span>
              <Badge className="bg-[#00a650]/10 text-[#00a650] border-[#00a650]/20 text-[10px] px-1.5">
                {desconto}% OFF
              </Badge>
            </div>
          )}
          <p className="text-2xl font-light text-foreground tracking-tight">
            {formatCurrency(item.preco)}
          </p>
          {item.parcelas && (
            <p className="text-xs text-[#00a650] font-medium mt-0.5">
              em {item.parcelas}
            </p>
          )}
        </div>

        {/* Bottom: Shipping + store */}
        <div className="flex items-center gap-3 flex-wrap">
          {freteGratis ? (
            <div className="flex items-center gap-1 text-[#00a650]">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Frete grátis</span>
            </div>
          ) : (
            item.frete && (
              <span className="text-xs text-muted-foreground">
                Frete: {item.frete}
              </span>
            )
          )}

          <div className="flex items-center gap-1 text-muted-foreground">
            <Store className="w-3 h-3" />
            <span className="text-xs">{item.loja}</span>
          </div>

          {item.vendedor_qualificado && (
            <div className="flex items-center gap-1 text-[#3483fa]">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[10px] font-medium">MercadoLíder</span>
            </div>
          )}

          {isCheapest && (
            <Badge className="bg-[#00a650]/10 text-[#00a650] border-[#00a650]/20 text-[10px]">
              <TrendingDown className="w-3 h-3 mr-0.5" /> Menor preço
            </Badge>
          )}
        </div>
      </div>

      {/* Right: action */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <Badge variant="outline" className="text-[10px]">
          {item.condicao || 'Novo'}
        </Badge>

        {item.url && item.url !== '#' && (
          <Button
            size="sm"
            variant="ghost"
            className="text-[#3483fa] hover:text-[#3483fa] hover:bg-[#3483fa]/10"
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

function ResumoPrecos({ resumo }: { resumo: PesquisaMLResult['resumo'] }) {
  return (
    <div className="bg-gradient-to-r from-[#3483fa]/5 to-[#00a650]/5 border border-[#3483fa]/20 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        📊 Resumo de Preços
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center p-2 bg-card rounded-md border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Menor Preço</p>
          <p className="text-lg font-bold text-[#00a650]">{formatCurrency(resumo.menor_preco)}</p>
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
          <p className="text-lg font-bold text-[#3483fa]">{resumo.variacao}</p>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 p-4 bg-card border border-border/40 rounded-lg">
          <div className="w-[160px] h-[160px] bg-muted rounded-md" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-1/3 mt-4" />
            <div className="h-3 bg-muted rounded w-1/4" />
            <div className="h-3 bg-muted rounded w-2/5 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PesquisaResultML({
  data,
  isLoading,
  rawMarkdown,
}: {
  data: PesquisaMLResult | null;
  isLoading: boolean;
  rawMarkdown?: string;
}) {
  if (isLoading) return <LoadingSkeleton />;
  if (!data && !rawMarkdown) return null;

  // If we have structured data, render ML-style
  if (data) {
    const cheapestPrice = Math.min(...data.fornecedores.map((f) => f.preco));

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Resultados para "<span className="text-[#3483fa]">{data.produto}</span>"
            </h3>
            <p className="text-xs text-muted-foreground">
              {data.fornecedores.length} fornecedores encontrados · Pesquisa em {data.data_pesquisa}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Ordenar: </span>
            <Badge variant="outline" className="text-[10px] cursor-default">Menor preço</Badge>
          </div>
        </div>

        {/* Products list */}
        <div className="space-y-2">
          {data.fornecedores
            .sort((a, b) => a.preco - b.preco)
            .map((item, i) => (
              <ProdutoCard
                key={i}
                item={item}
                isCheapest={item.preco === cheapestPrice}
              />
            ))}
        </div>

        {/* Summary */}
        {data.resumo && <ResumoPrecos resumo={data.resumo} />}
      </div>
    );
  }

  // Fallback: render raw markdown (for old saved searches)
  if (rawMarkdown) {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert overflow-x-auto">
        <ReactMarkdown>{rawMarkdown}</ReactMarkdown>
      </div>
    );
  }

  return null;
}
