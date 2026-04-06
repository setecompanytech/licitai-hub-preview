import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ExternalLink, Plus, Loader2, Package, Star, Store, Truck,
  ShieldCheck, ClipboardList, Image as ImageIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import type { FornecedorML } from './ProdutoCardML';

interface FichaTecnicaData {
  titulo: string;
  imagens: string[];
  especificacoes: { chave: string; valor: string }[];
  preco: number | null;
  preco_original: number | null;
  descricao_resumida: string;
  url: string;
  fonte: string;
}

interface FichaTecnicaProdutoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: FornecedorML;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FichaTecnicaProduto({ open, onOpenChange, produto }: FichaTecnicaProdutoProps) {
  const [ficha, setFicha] = useState<FichaTecnicaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const { addItem, pendingItems } = usePropostaCart();

  const loadFicha = async () => {
    if (ficha) return;
    setLoading(true);
    try {
      const effectiveUrl = produto.url?.startsWith('https://') ? produto.url : undefined;
      const { data, error } = await supabase.functions.invoke('ficha-tecnica-produto', {
        body: { url: effectiveUrl, produto_nome: produto.produto },
      });

      if (error || !data?.success) {
        toast.error('Não foi possível carregar a ficha técnica.');
        console.error('Ficha error:', error || data?.error);
      } else {
        setFicha(data.data);
      }
    } catch (e) {
      console.error('Ficha error:', e);
      toast.error('Erro ao carregar ficha técnica.');
    }
    setLoading(false);
  };

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !ficha && !loading) {
      loadFicha();
    }
  };

  const handleAddToProposta = () => {
    const preco = ficha?.preco || produto.preco;
    addItem({
      item: String(pendingItems.length + 1),
      descricao: (ficha?.titulo || produto.produto).substring(0, 200),
      quantidade: '1',
      unidade: 'un',
      marca: produto.marca || '',
      fabricante: produto.marca || '',
      modelo: produto.modelo || '',
      valorUnitario: preco.toFixed(2).replace('.', ','),
      valorUnitarioExtenso: valorPorExtenso(preco),
      valorTotal: preco.toFixed(2).replace('.', ','),
      valorTotalExtenso: valorPorExtenso(preco),
      custoAquisicao: preco, // preço cotado = custo de aquisição
    });
    toast.success('Produto adicionado à proposta com sugestão tributária!');
  };

  const images = ficha?.imagens?.length ? ficha.imagens : (produto.image_url ? [produto.image_url] : []);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Extraindo ficha técnica do produto...</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[90vh]">
            <div className="p-6 space-y-5">
              {/* Header */}
              <DialogHeader>
                <DialogTitle className="text-base font-semibold leading-snug pr-8">
                  {ficha?.titulo || produto.produto}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Image gallery */}
                <div className="md:w-[320px] flex-shrink-0 space-y-3">
                  <div className="relative aspect-square bg-muted/10 rounded-lg border border-border/30 flex items-center justify-center overflow-hidden">
                    {images.length > 0 ? (
                      <img
                        src={images[imgIndex]}
                        alt="Produto"
                        className="w-full h-full object-contain p-2"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <Package className="w-16 h-16 text-muted-foreground/20" />
                    )}
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                          className="absolute left-1 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1 hover:bg-background"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setImgIndex(i => (i + 1) % images.length)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1 hover:bg-background"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="absolute bottom-2 right-2 text-[10px] bg-background/80 rounded px-1.5 py-0.5">
                          {imgIndex + 1}/{images.length}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Thumbnails */}
                  {images.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {images.slice(0, 8).map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setImgIndex(i)}
                          className={`w-14 h-14 flex-shrink-0 rounded border overflow-hidden ${
                            i === imgIndex ? 'border-primary ring-1 ring-primary' : 'border-border/30'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain p-0.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Price + badges */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="text-[10px]">{produto.condicao || 'Novo'}</Badge>
                      <div className="flex items-center gap-1">
                        <Store className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{produto.loja}</span>
                      </div>
                      {produto.vendedor_qualificado && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                          <ShieldCheck className="w-3 h-3 mr-0.5" /> Vendedor Qualificado
                        </Badge>
                      )}
                    </div>
                    {(ficha?.preco_original || produto.preco_original) && (
                      <p className="text-sm text-muted-foreground line-through">
                        {formatCurrency(ficha?.preco_original || produto.preco_original!)}
                      </p>
                    )}
                    <p className="text-3xl font-bold text-foreground">
                      {formatCurrency(ficha?.preco || produto.preco)}
                    </p>
                    {produto.parcelas && (
                      <p className="text-xs text-success font-medium mt-0.5">em {produto.parcelas}</p>
                    )}
                    {produto.frete && (
                      <div className="flex items-center gap-1 mt-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span className={`text-xs ${produto.frete.toLowerCase().includes('grátis') ? 'text-success font-semibold' : 'text-muted-foreground'}`}>
                          {produto.frete}
                        </span>
                      </div>
                    )}
                    {produto.avaliacao && (
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.floor(produto.avaliacao!) ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">{produto.avaliacao.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Brand/Model */}
                  {(produto.marca || produto.modelo) && (
                    <div className="flex gap-4 text-sm">
                      {produto.marca && (
                        <div>
                          <span className="text-muted-foreground text-xs">Marca:</span>
                          <p className="font-medium">{produto.marca}</p>
                        </div>
                      )}
                      {produto.modelo && (
                        <div>
                          <span className="text-muted-foreground text-xs">Modelo:</span>
                          <p className="font-medium">{produto.modelo}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleAddToProposta}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Adicionar à Proposta
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(ficha?.url || produto.url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" /> Ver no Site
                    </Button>
                  </div>
                </div>
              </div>

              {/* Specifications Table */}
              {ficha?.especificacoes && ficha.especificacoes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    Especificações Técnicas
                  </h4>
                  <div className="border border-border/40 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {ficha.especificacoes.map((spec, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : 'bg-card'}>
                            <td className="px-3 py-2 font-medium text-muted-foreground w-[40%] border-r border-border/20">
                              {spec.chave}
                            </td>
                            <td className="px-3 py-2 text-foreground">{spec.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Images gallery section */}
              {images.length > 2 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Galeria de Imagens ({images.length})
                  </h4>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setImgIndex(i)}
                        className={`aspect-square rounded-md border overflow-hidden ${
                          i === imgIndex ? 'border-primary ring-2 ring-primary/30' : 'border-border/30 hover:border-primary/50'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-contain p-1" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
