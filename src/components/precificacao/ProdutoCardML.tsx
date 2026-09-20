import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ExternalLink, Star, Truck, ShieldCheck, Store, TrendingDown,
  Package, LayoutGrid, List, Percent, ArrowUpDown, ImageIcon, Loader2, Plus,
  ChevronLeft, ChevronRight, Save
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import FichaTecnicaProduto from './FichaTecnicaProduto';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';


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

type SaveCatalogContext = {
  licitacaoId?: string | null;
  licitacaoNumero?: string;
  licitacaoOrgao?: string;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          aria-hidden="true"
          className={`h-3 w-3 ${s <= Math.floor(rating) ? 'fill-warning text-warning' : 'text-border'}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground tabular-nums">{rating.toFixed(1)}</span>
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
export function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  // Known good CDNs
  // Miniaturas do Google Shopping (o que o Serper devolve): URL SEM extensão
  // de arquivo — a regra "só aceita se termina em .jpg/.png" derrubava todas
  // e a grade inteira virava caixinha de placeholder (visto em 12/09).
  if (/encrypted-tbn\d\.gstatic\.com\/(shopping|images)/i.test(trimmed)) return true;
  if (/lh\d\.googleusercontent\.com\//i.test(trimmed)) return true;
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

/** Save item to catalog with real image */
async function saveItemToCatalog(item: FornecedorML, userId: string, contexto?: SaveCatalogContext) {
  const allImages = (item.images?.length ? item.images : (item.image_url ? [item.image_url] : [])).filter(isValidImageUrl);
  
  const { error } = await supabase.from('catalogo_itens_precificados').insert({
    user_id: userId,
    tipo_calculo: 'produto',
    descricao: item.produto.substring(0, 300),
    quantidade: 1,
    unidade: 'UN',
    marca: item.marca || null,
    fabricante: item.marca || null,
    modelo: item.modelo || null,
    custo_unitario: item.preco,
    preco_unitario: item.preco,
    preco_total: item.preco,
    licitacao_id: contexto?.licitacaoId || null,
    licitacao_numero: contexto?.licitacaoNumero || null,
    licitacao_orgao: contexto?.licitacaoOrgao || null,
    detalhes: {
      image_url: allImages[0] || null,
      images: allImages.slice(0, 6),
      loja: item.loja,
      url: getEffectiveUrl(item),
      condicao: item.condicao,
      frete: item.frete,
      avaliacao: item.avaliacao,
      preco_original: item.preco_original,
    },
  });
  
  if (error) {
    toast.error('Erro ao salvar no catálogo');
    console.error(error);
  } else {
    toast.success('Produto salvo no catálogo com imagem!');
  }
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
        <Package className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-foreground-tertiary" aria-hidden="true" />
      )}
      {hasMultiple && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden="true">
          {validImages.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all ${
                i === safeIdx ? 'w-3 bg-primary' : 'bg-foreground-tertiary'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Google Shopping Grid Card ─── */
function GoogleShoppingCard({ item, isCheapest, onOpenFicha, onQuickAdd, onSaveToCatalog }: { item: FornecedorML; isCheapest: boolean; onOpenFicha: () => void; onQuickAdd: () => void; onSaveToCatalog: () => void }) {
  const desconto = getDiscountPercent(item);

  return (
    /* Cartão compacto do DS: raio 10px, borda de 1px, sombra discreta; hover
       clicável na borda verde. Selos suaves (tinta/linha) no lugar dos sólidos. */
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md">
      {/* Discount badge */}
      {desconto > 0 && (
        <div className="absolute left-2 top-2 z-10">
          <Badge variant="danger" className="tabular-nums">
            {desconto}% OFF
          </Badge>
        </div>
      )}
      {isCheapest && (
        <div className="absolute right-2 top-2 z-10">
          <Badge variant="success">
            <TrendingDown className="h-3 w-3" aria-hidden="true" /> Menor
          </Badge>
        </div>
      )}

      {/* Add to proposal - floating button (aparece no hover e no foco). */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
        className="absolute top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity duration-150 hover:bg-primary-hover focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        title="Adicionar à Proposta"
        aria-label="Adicionar à Proposta"
        style={{ right: isCheapest ? '70px' : '8px' }}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Image area - sliding gallery */}
      <ImageGallery
        item={item}
        className="flex aspect-square w-full cursor-pointer items-center justify-center border-b border-border bg-secondary"
        onClick={onOpenFicha}
      />

      {/* Content - clickable */}
      <div className="flex flex-1 cursor-pointer flex-col gap-1.5 p-3" onClick={onOpenFicha}>
        <h3 className="line-clamp-2 min-h-[2.25rem] text-sm font-medium leading-[1.125rem] text-foreground transition-colors group-hover:text-primary">
          {item.produto}
        </h3>

        {item.avaliacao ? (
          <RatingStars rating={item.avaliacao} />
        ) : (
          <div className="h-4" />
        )}

        <div className="mt-auto">
          {item.preco_original && item.preco_original > item.preco && (
            <p className="text-xs leading-none text-muted-foreground line-through tabular-nums">
              {formatCurrency(item.preco_original)}
            </p>
          )}
          <p className="text-lg font-semibold leading-tight text-foreground tabular-nums">
            {formatCurrency(item.preco)}
          </p>
          {item.parcelas && (
            <p className="mt-0.5 text-xs font-medium text-success-ink">
              em {item.parcelas}
            </p>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1">
          <Store className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-xs text-muted-foreground">{item.loja}</span>
          {item.vendedor_qualificado && (
            <ShieldCheck className="ml-auto h-3 w-3 flex-shrink-0 text-success-ink" aria-label="Vendedor qualificado" />
          )}
        </div>

        {isFreteGratis(item.frete) ? (
          <div className="flex items-center gap-1 text-success-ink">
            <Truck className="h-3 w-3" aria-hidden="true" />
            <span className="text-xs font-semibold">Frete grátis</span>
          </div>
        ) : item.frete ? (
          <span className="text-xs text-muted-foreground">Frete: {item.frete}</span>
        ) : null}
      </div>

      {/* Footer actions */}
      <div className="flex gap-1 border-t border-border px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-primary hover:bg-primary-tint hover:text-primary"
          onClick={onOpenFicha}
        >
          <ImageIcon aria-hidden="true" />
          Ficha Técnica
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onSaveToCatalog(); }}
          title="Salvar no Catálogo"
          aria-label="Salvar no Catálogo"
        >
          <Save aria-hidden="true" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-primary hover:bg-primary-tint hover:text-primary"
          onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
          title="Adicionar à Proposta"
          aria-label="Adicionar à Proposta"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Mercado Livre List Card ─── */
function MercadoLivreCard({ item, isCheapest, onOpenFicha, onQuickAdd, onSaveToCatalog }: { item: FornecedorML; isCheapest: boolean; onOpenFicha: () => void; onQuickAdd: () => void; onSaveToCatalog: () => void }) {
  const desconto = getDiscountPercent(item);

  return (
    /* No celular a imagem sobe e as ações descem em fila; a partir de `sm`
       volta a ser imagem · conteúdo · ações lado a lado. */
    <div className="group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-primary/40 hover:shadow-md sm:flex-row">
      {/* Image - sliding gallery */}
      <ImageGallery
        item={item}
        className="flex h-[160px] w-[160px] flex-shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-secondary"
        onClick={onOpenFicha}
      />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3
            className="line-clamp-2 cursor-pointer text-base font-medium leading-5 text-foreground transition-colors group-hover:text-primary"
            onClick={onOpenFicha}
          >
            {item.produto}
          </h3>
          <div className="mb-2 mt-1 flex flex-wrap items-center gap-2">
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
              <span className="text-xs text-muted-foreground line-through tabular-nums">
                {formatCurrency(item.preco_original)}
              </span>
              <Badge variant="success" className="tabular-nums">
                {desconto}% OFF
              </Badge>
            </div>
          )}
          <p className="text-2xl font-semibold leading-8 tabular-nums text-foreground">
            {formatCurrency(item.preco)}
          </p>
          {item.parcelas && (
            <p className="mt-0.5 text-xs font-medium text-success-ink">
              em {item.parcelas}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isFreteGratis(item.frete) ? (
            <div className="flex items-center gap-1 text-success-ink">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs font-semibold">Frete grátis</span>
            </div>
          ) : (
            item.frete && (
              <span className="text-xs text-muted-foreground">Frete: {item.frete}</span>
            )
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Store className="h-3 w-3" aria-hidden="true" />
            <span className="text-xs">{item.loja}</span>
          </div>
          {item.vendedor_qualificado && (
            <div className="flex items-center gap-1 text-success-ink">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              <span className="text-xs font-medium">MercadoLíder</span>
            </div>
          )}
          {isCheapest && (
            <Badge variant="success">
              <TrendingDown className="h-3 w-3" aria-hidden="true" /> Menor preço
            </Badge>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex flex-shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
        <Badge variant="outline">
          {item.condicao || 'Novo'}
        </Badge>
        <div className="flex flex-wrap gap-1 sm:flex-col">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
          >
            <Plus aria-hidden="true" />
            Proposta
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onSaveToCatalog(); }}
          >
            <Save aria-hidden="true" />
            Catálogo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary hover:bg-primary-tint hover:text-primary"
            onClick={onOpenFicha}
          >
            <ImageIcon aria-hidden="true" />
            Ficha
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Resumo de Preços ─── */
function ResumoPrecos({ resumo }: { resumo: PesquisaMLResult['resumo'] }) {
  return (
    /* Sem gradiente: cartão neutro com quatro KPIs (rótulo 13/500, valor
       24/600 tabular, tinta `*-ink`) alinhados à esquerda. */
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
        Resumo de Preços
      </h4>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-secondary p-3">
          <p className="text-sm font-medium text-muted-foreground">Menor Preço</p>
          <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-success-ink">{formatCurrency(resumo.menor_preco)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{resumo.fornecedor_menor}</p>
        </div>
        <div className="rounded-md border border-border bg-secondary p-3">
          <p className="text-sm font-medium text-muted-foreground">Maior Preço</p>
          <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-destructive-ink">{formatCurrency(resumo.maior_preco)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{resumo.fornecedor_maior}</p>
        </div>
        <div className="rounded-md border border-border bg-secondary p-3">
          <p className="text-sm font-medium text-muted-foreground">Preço Médio</p>
          <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{formatCurrency(resumo.preco_medio)}</p>
        </div>
        <div className="rounded-md border border-border bg-secondary p-3">
          <p className="text-sm font-medium text-muted-foreground">Variação</p>
          <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{resumo.variacao}</p>
        </div>
      </div>
      {resumo.recomendacao && (
        <div className="rounded-md border border-border bg-secondary p-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Recomendação:</span> {resumo.recomendacao}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Loading Skeleton — na forma do cartão da grade ─── */
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" role="status" aria-live="polite" aria-label="Pesquisando nos marketplaces">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="mt-3 h-5 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
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
  licitacaoId,
  licitacaoNumero,
  licitacaoOrgao,
}: {
  data: PesquisaMLResult | null;
  isLoading: boolean;
  isLoadingImages?: boolean;
  rawMarkdown?: string;
  licitacaoId?: string | null;
  licitacaoNumero?: string;
  licitacaoOrgao?: string;
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'relevante' | 'menor' | 'maior'>('relevante');
  const [fichaItem, setFichaItem] = useState<FornecedorML | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const quickAdd = useQuickAddToProposta();
  const { user } = useAuth();

  const handleSaveToCatalog = (item: FornecedorML) => {
    if (!user) {
      toast.error('Faça login para salvar no catálogo');
      return;
    }
    void saveItemToCatalog(item, user.id, { licitacaoId, licitacaoNumero, licitacaoOrgao });
  };

  const handleSaveAllToCatalog = async () => {
    if (!user || !data?.fornecedores?.length) return;
    setSavingAll(true);
    try {
      const rows = data.fornecedores.map((item) => {
        const allImages = (item.images?.length ? item.images : (item.image_url ? [item.image_url] : [])).filter(isValidImageUrl);
        return {
          user_id: user.id,
          tipo_calculo: 'produto',
          descricao: item.produto.substring(0, 300),
          quantidade: 1,
          unidade: 'UN',
          marca: item.marca || null,
          fabricante: item.marca || null,
          modelo: item.modelo || null,
          custo_unitario: item.preco,
          preco_unitario: item.preco,
          preco_total: item.preco,
          licitacao_id: licitacaoId || null,
          licitacao_numero: licitacaoNumero || null,
          licitacao_orgao: licitacaoOrgao || null,
          detalhes: {
            image_url: allImages[0] || null,
            images: allImages.slice(0, 6),
            loja: item.loja,
            url: getEffectiveUrl(item),
            condicao: item.condicao,
            frete: item.frete,
            avaliacao: item.avaliacao,
            preco_original: item.preco_original,
          },
        };
      });

      const { error } = await supabase.from('catalogo_itens_precificados').insert(rows);
      if (error) {
        toast.error('Erro ao salvar no catálogo');
        console.error(error);
      } else {
        toast.success(`${rows.length} produto(s) arquivado(s) no catálogo! Disponível na Proposta Comercial.`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar no catálogo');
    }
    setSavingAll(false);
  };

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-6 text-foreground">
              Resultados para "<span className="text-foreground">{data.produto}</span>"
            </h3>
            <p className="text-sm text-muted-foreground">
              {data.fornecedores.length} fornecedores encontrados · Pesquisa em {data.data_pesquisa}
              {isLoadingImages && (
                <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Buscando imagens reais...
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveAllToCatalog}
              disabled={savingAll}
            >
              {savingAll ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Arquivar Cotação
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as any)}>
                <SelectTrigger aria-label="Ordenar resultados" className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevante">Mais relevantes</SelectItem>
                  <SelectItem value="menor">Menor preço</SelectItem>
                  <SelectItem value="maior">Maior preço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* View toggle — controle segmentado sóbrio (o mesmo do Financeiro):
                a opção ativa é o segmento branco em relevo, o verde fica para a
                ação principal. */}
            <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1" role="group" aria-label="Modo de exibição dos resultados">
              <Button
                type="button"
                size="sm"
                variant={viewMode === 'grid' ? 'outline' : 'ghost'}
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                title="Google Shopping"
              >
                <LayoutGrid aria-hidden="true" />
                Grid
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === 'list' ? 'outline' : 'ghost'}
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                title="Mercado Livre"
              >
                <List aria-hidden="true" />
                Lista
              </Button>
            </div>
          </div>
        </div>

        {/* Products */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sorted.map((item, i) => (
              <GoogleShoppingCard
                key={i}
                item={item}
                isCheapest={item.preco === cheapestPrice}
                onOpenFicha={() => setFichaItem(item)}
                onQuickAdd={() => quickAdd(item)}
                onSaveToCatalog={() => handleSaveToCatalog(item)}
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
                onSaveToCatalog={() => handleSaveToCatalog(item)}
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
