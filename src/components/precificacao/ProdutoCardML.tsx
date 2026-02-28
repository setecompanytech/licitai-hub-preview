import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ExternalLink, Star, Truck, ShieldCheck, Store, TrendingDown,
  Package, LayoutGrid, List, Percent, ArrowUpDown, ImageIcon, Loader2, Plus,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import FichaTecnicaProduto from './FichaTecnicaProduto';


export type FornecedorML = {
  loja: string;
  produto: string;
  marca: string;
  modelo: string;
  categoria?: string;
  preco: number;
  preco_original?: number;
  condicao: string;
  frete: string;
  url: string;
  image_url?: string;
  images?: string[];
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
  subcategorias?: string[];
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

/** Validates if an image URL looks real (not a fake/placeholder) */
function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  // Known good CDNs
  if (/http2\.mlstatic\.com\/D_/i.test(trimmed)) return true;
  if (/m\.media-amazon\.com\/images\/I\//i.test(trimmed)) return true;
  if (/images\.kabum\.com\.br/i.test(trimmed)) return true;
  if (/magazineluiza/i.test(trimmed) && /\.(jpg|png|webp)/i.test(trimmed)) return true;
  if (/gazinatacado/i.test(trimmed) && /\.(jpg|png|webp)/i.test(trimmed)) return true;
  // Reject known fakes, ads, banners, site assets
  if (/\/D_NQ_NP_ID-MLB/i.test(trimmed)) return false;
  if (/placeholder/i.test(trimmed)) return false;
  if (/logo|icon|sprite|banner|favicon|badge|selo|stamp|watermark/i.test(trimmed)) return false;
  if (/1x1|pixel|tracking|analytics|ad[s]?[_\-\/]|doubleclick|googlesyndication|adsense|adserver|pubmatic|criteo|taboola|outbrain/i.test(trimmed)) return false;
  if (/promo[çc]|campanha|oferta.*banner|slide.*banner|carousel.*ad|anuncio|hero[-_]?banner|og[_\-.]|social[-_]?share/i.test(trimmed)) return false;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\/|\/rating\/|\/stars\//i.test(trimmed)) return false;
  if (/vlibras|access_popup|shopee-pcmall-live-sg|kalunga\.jpg|og_tb\.png/i.test(trimmed)) return false;
  // Reject tiny images (likely icons/tracking)
  if (/[_\-\/](\d{1,2})x(\d{1,2})\./i.test(trimmed)) return false;
  if (/_AC_US\d{1,3}_/i.test(trimmed)) return false;
  // Accept any other image URL that ends with image extension
  if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(trimmed)) return true;
  return false;
}

/** Builds a real search URL for a store based on product name */
function buildRealStoreUrl(loja: string, produto: string): string {
  const q = encodeURIComponent(produto);
  const lojaLower = loja.toLowerCase().replace(/\s+/g, '');

  const storeSearchUrls: Record<string, string> = {
    'mercadolivre': `https://lista.mercadolivre.com.br/${q.replace(/%20/g, '-')}`,
    'amazon': `https://www.amazon.com.br/s?k=${q}`,
    'magazineluiza': `https://www.magazineluiza.com.br/busca/${q}/`,
    'magalu': `https://www.magazineluiza.com.br/busca/${q}/`,
    'kabum': `https://www.kabum.com.br/busca/${q}`,
    'pichau': `https://www.pichau.com.br/search?q=${q}`,
    'terabyte': `https://www.terabyteshop.com.br/busca?str=${q}`,
    'americanas': `https://www.americanas.com.br/busca/${q}`,
    'casasbahia': `https://www.casasbahia.com.br/busca/${q}`,
    'carrefour': `https://www.carrefour.com.br/s?q=${q}`,
    'shopee': `https://shopee.com.br/search?keyword=${q}`,
    'aliexpress': `https://pt.aliexpress.com/w/wholesale-${q.replace(/%20/g, '-')}.html`,
    'submarino': `https://www.submarino.com.br/busca/${q}`,
    'havan': `https://www.havan.com.br/busca?q=${q}`,
    'gazinatacado': `https://www.gazinatacado.com.br/catalogsearch/result/?q=${q}`,
    'leroymerlin': `https://www.leroymerlin.com.br/search?term=${q}`,
    'madeiramadeira': `https://www.madeiramadeira.com.br/busca?q=${q}`,
    'fastshop': `https://www.fastshop.com.br/web/s/${q}`,
    'colombo': `https://www.colombo.com.br/busca?q=${q}`,
    'centauro': `https://www.centauro.com.br/busca?q=${q}`,
    'dafiti': `https://www.dafiti.com.br/catalog/?q=${q}`,
    'netshoes': `https://www.netshoes.com.br/busca?q=${q}`,
    'zattini': `https://www.zattini.com.br/busca?q=${q}`,
  };

  for (const [key, url] of Object.entries(storeSearchUrls)) {
    if (lojaLower.includes(key)) return url;
  }

  return `https://www.google.com.br/search?tbm=shop&q=${encodeURIComponent(produto + ' ' + loja)}`;
}

/** Gets effective URL */
function getEffectiveUrl(item: FornecedorML): string {
  const url = item.url?.trim();
  if (url && url.startsWith('https://') && !url.includes('/produto-slug/') && !url.includes('/produto-i.') && url !== '#') {
    if (!/\/p\/MLB\d{5}$/i.test(url) && !/\/dp\/B0XXXXX/i.test(url) && !/\/produto\/\d{5}\/nome$/i.test(url)) {
      return url;
    }
  }
  return buildRealStoreUrl(item.loja, item.produto);
}

/** Hook for quick add to proposal */
function useQuickAddToProposta() {
  const { addItem, pendingItems } = usePropostaCart();
  
  return (item: FornecedorML) => {
    addItem({
      item: String(pendingItems.length + 1),
      descricao: item.produto.substring(0, 200),
      quantidade: '1',
      unidade: 'un',
      marca: item.marca || '',
      fabricante: item.marca || '',
      modelo: item.modelo || '',
      valorUnitario: item.preco.toFixed(2).replace('.', ','),
      valorUnitarioExtenso: valorPorExtenso(item.preco),
      valorTotal: item.preco.toFixed(2).replace('.', ','),
      valorTotalExtenso: valorPorExtenso(item.preco),
    });
    toast.success('Produto adicionado à proposta!');
  };
}

/* ─── Image Gallery with auto-slide ─── */
function ImageGallery({ item, className, onClick }: { item: FornecedorML; className?: string; onClick?: () => void }) {
  const allImages = (item.images?.length ? item.images : (item.image_url ? [item.image_url] : [])).filter(isValidImageUrl);
  const [idx, setIdx] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validImages = allImages.filter(url => !failedUrls.has(url));
  const hasMultiple = validImages.length > 1;
  const safeIdx = validImages.length > 0 ? idx % validImages.length : 0;
  const currentImg = validImages[safeIdx];

  // Auto-slide every 3 seconds
  useEffect(() => {
    if (!hasMultiple || paused) return;
    intervalRef.current = setInterval(() => {
      setIdx(i => (i + 1) % validImages.length);
    }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hasMultiple, paused, validImages.length]);

  const handleError = useCallback((url: string) => {
    setFailedUrls(prev => new Set(prev).add(url));
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${className || ''}`}
      onClick={onClick}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {currentImg ? (
        <img
          src={currentImg}
          alt={item.produto}
          className="w-full h-full object-contain p-2 transition-opacity duration-300"
          onError={() => handleError(currentImg)}
        />
      ) : (
        <Package className="w-16 h-16 text-muted-foreground/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      )}
      {hasMultiple && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
          {validImages.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === safeIdx ? 'bg-primary w-3' : 'bg-foreground/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Google Shopping Grid Card ─── */
function GoogleShoppingCard({ item, isCheapest, onOpenFicha, onQuickAdd }: { item: FornecedorML; isCheapest: boolean; onOpenFicha: () => void; onQuickAdd: () => void }) {
  const desconto = getDiscountPercent(item);

  return (
    <div className="group relative flex flex-col bg-card border border-border/40 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200">
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

      {/* Add to proposal - floating button */}
      <button
        onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
        className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-full w-7 h-7 flex items-center justify-center shadow-md hover:scale-110"
        title="Adicionar à Proposta"
        style={{ right: isCheapest ? '70px' : '8px' }}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Image area - sliding gallery */}
      <ImageGallery
        item={item}
        className="w-full aspect-square bg-muted/10 flex items-center justify-center border-b border-border/20 cursor-pointer"
        onClick={onOpenFicha}
      />

      {/* Content - clickable */}
      <div className="flex flex-col flex-1 p-3 gap-1.5 cursor-pointer" onClick={onOpenFicha}>
        <h3 className="text-xs font-normal text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
          {item.produto}
        </h3>

        {item.avaliacao ? (
          <RatingStars rating={item.avaliacao} />
        ) : (
          <div className="h-4" />
        )}

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

        <div className="flex items-center gap-1 mt-1">
          <Store className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground truncate">{item.loja}</span>
          {item.vendedor_qualificado && (
            <ShieldCheck className="w-3 h-3 text-primary ml-auto flex-shrink-0" />
          )}
        </div>

        {isFreteGratis(item.frete) ? (
          <div className="flex items-center gap-1 text-success">
            <Truck className="w-3 h-3" />
            <span className="text-[10px] font-semibold">Frete grátis</span>
          </div>
        ) : item.frete ? (
          <span className="text-[10px] text-muted-foreground">Frete: {item.frete}</span>
        ) : null}
      </div>

      {/* Footer actions */}
      <div className="border-t border-border/20 px-3 py-2 flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-primary hover:text-primary hover:bg-primary/10 text-xs h-7"
          onClick={onOpenFicha}
        >
          <ImageIcon className="w-3 h-3 mr-1" />
          Ficha Técnica
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-accent hover:text-accent hover:bg-accent/10 text-xs h-7 px-2"
          onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
          title="Adicionar à Proposta"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Mercado Livre List Card ─── */
function MercadoLivreCard({ item, isCheapest, onOpenFicha, onQuickAdd }: { item: FornecedorML; isCheapest: boolean; onOpenFicha: () => void; onQuickAdd: () => void }) {
  const desconto = getDiscountPercent(item);

  return (
    <div className="group flex gap-4 p-4 bg-card border border-border/40 rounded-lg hover:shadow-md hover:border-primary/30 transition-all duration-200 relative">
      {/* Image - sliding gallery */}
      <ImageGallery
        item={item}
        className="flex-shrink-0 w-[160px] h-[160px] bg-muted/10 rounded-md flex items-center justify-center border border-border/20 cursor-pointer"
        onClick={onOpenFicha}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h3
            className="text-sm font-normal text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
            onClick={onOpenFicha}
          >
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

      {/* Right actions */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <Badge variant="outline" className="text-[10px]">
          {item.condicao || 'Novo'}
        </Badge>
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs"
            onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Proposta
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary hover:bg-primary/10"
            onClick={onOpenFicha}
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">Ficha</span>
          </Button>
        </div>
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
  isLoadingImages,
  rawMarkdown,
}: {
  data: PesquisaMLResult | null;
  isLoading: boolean;
  isLoadingImages?: boolean;
  rawMarkdown?: string;
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'relevante' | 'menor' | 'maior'>('relevante');
  const [fichaItem, setFichaItem] = useState<FornecedorML | null>(null);
  const quickAdd = useQuickAddToProposta();

  if (isLoading) return <LoadingSkeleton />;
  if (!data && !rawMarkdown) return null;

  if (data) {
    const sorted = [...data.fornecedores].sort((a, b) => {
      if (sortMode === 'menor') return a.preco - b.preco;
      if (sortMode === 'maior') return b.preco - a.preco;
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
              {isLoadingImages && (
                <span className="ml-2 inline-flex items-center gap-1 text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Buscando imagens reais...
                </span>
              )}
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
                onOpenFicha={() => setFichaItem(item)}
                onQuickAdd={() => quickAdd(item)}
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
                onOpenFicha={() => setFichaItem(item)}
                onQuickAdd={() => quickAdd(item)}
              />
            ))}
          </div>
        )}

        {/* Summary */}
        {data.resumo && <ResumoPrecos resumo={data.resumo} />}

        {/* Ficha Técnica Dialog */}
        {fichaItem && (
          <FichaTecnicaProduto
            open={!!fichaItem}
            onOpenChange={(open) => { if (!open) setFichaItem(null); }}
            produto={fichaItem}
          />
        )}
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
