import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, FileText, Loader2, X, CheckCircle, Sparkles, ExternalLink,
  ShoppingCart, TrendingDown, Package, AlertCircle, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { useEditalExtraction } from '@/hooks/useEditalExtraction';

type EditalItemExtracted = {
  item: string;
  descricao: string;
  quantidade: number;
  unidade: string;
};

type FornecedorCotado = {
  titulo: string;
  preco: number;
  loja: string;
  url: string;
  image_url?: string;
};

type ItemCotado = EditalItemExtracted & {
  status: 'pendente' | 'cotando' | 'cotado' | 'erro';
  fornecedores: FornecedorCotado[];
  menorPreco?: number;
  maiorPreco?: number;
  precoMedio?: number;
  erro?: string;
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CotacaoEditalAutoIA() {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCotando, setIsCotando] = useState(false);
  const [itens, setItens] = useState<ItemCotado[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { addItem, pendingItems } = usePropostaCart();
  const { extrairItensDoTexto } = useEditalExtraction();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      return;
    }
    setFile(f);
    setItens([]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setItens([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExtractItems = async () => {
    if (!file || isExtracting) return;

    setIsExtracting(true);
    setItens([]);

    try {
      const text = await extractTextFromFile(file, 150, true);
      if (!text || text.trim().length < 20) {
        toast.error('Não foi possível ler conteúdo suficiente do documento.');
        return;
      }

      const parsed = await extrairItensDoTexto(text, { skipValidation: true });
      if (parsed.length === 0) {
        return;
      }

      const itemsCotados: ItemCotado[] = parsed
        .map<ItemCotado>((item, index) => {
          const quantidade = Number(item.quantidade ?? 1);

          return {
            item: String(item.item ?? index + 1),
            descricao: item.descricao?.trim() || '',
            quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
            unidade: item.unidade?.trim() || 'UN',
            status: 'pendente',
            fornecedores: [],
          };
        })
        .filter((item) => item.descricao.length > 0);

      if (itemsCotados.length === 0) {
        toast.warning('Nenhum item encontrado no documento.');
        return;
      }

      setItens(itemsCotados);
      toast.success(`${itemsCotados.length} itens extraídos do edital!`);
    } catch (error) {
      console.error('Erro ao extrair itens da precificação:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao ler o arquivo.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Step 2: Auto-quote all items
  const handleCotarTodos = async () => {
    if (itens.length === 0) return;
    setIsCotando(true);
    setProgressPercent(0);

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      setCurrentItem(item.descricao.slice(0, 60));
      setProgressPercent(Math.round(((i) / itens.length) * 100));

      // Update status to "cotando"
      setItens(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'cotando' } : it));

      try {
        const { data, error } = await supabase.functions.invoke('pesquisa-preco-real', {
          body: { termo: item.descricao.slice(0, 120) },
        });

        if (error || !data?.success || !data.data?.fornecedores?.length) {
          setItens(prev => prev.map((it, idx) => idx === i ? {
            ...it,
            status: 'erro',
            erro: 'Nenhum resultado encontrado',
          } : it));
          continue;
        }

        const fornecedores: FornecedorCotado[] = data.data.fornecedores
          .slice(0, 8)
          .map((f: any) => ({
            titulo: f.titulo || f.nome || '',
            preco: f.preco || 0,
            loja: f.loja || '',
            url: f.url || '',
            image_url: f.image_url || '',
          }));

        const precos = fornecedores.map(f => f.preco).filter(p => p > 0);
        const menorPreco = precos.length > 0 ? Math.min(...precos) : 0;
        const maiorPreco = precos.length > 0 ? Math.max(...precos) : 0;
        const precoMedio = precos.length > 0
          ? Math.round((precos.reduce((a, b) => a + b, 0) / precos.length) * 100) / 100
          : 0;

        setItens(prev => prev.map((it, idx) => idx === i ? {
          ...it,
          status: 'cotado',
          fornecedores,
          menorPreco,
          maiorPreco,
          precoMedio,
        } : it));
      } catch {
        setItens(prev => prev.map((it, idx) => idx === i ? {
          ...it,
          status: 'erro',
          erro: 'Erro na pesquisa',
        } : it));
      }
    }

    setProgressPercent(100);
    setCurrentItem('');
    setIsCotando(false);
    toast.success('Cotação automática finalizada!');
  };

  const handleAddToProposta = (item: ItemCotado, preco: number) => {
    const valorTotal = preco * item.quantidade;
    addItem({
      item: String(pendingItems.length + 1),
      descricao: item.descricao,
      quantidade: String(item.quantidade),
      unidade: item.unidade,
      marca: '',
      fabricante: '',
      modelo: '',
      valorUnitario: preco.toFixed(2).replace('.', ','),
      valorUnitarioExtenso: valorPorExtenso(preco),
      valorTotal: valorTotal.toFixed(2).replace('.', ','),
      valorTotalExtenso: valorPorExtenso(valorTotal),
      custoAquisicao: preco, // preço cotado = custo de aquisição
    });
    toast.success(`Item "${item.descricao.slice(0, 40)}..." adicionado à proposta com sugestão tributária!`);
  };

  const cotados = itens.filter(i => i.status === 'cotado');
  const erros = itens.filter(i => i.status === 'erro');
  const totalMenor = cotados.reduce((sum, i) => sum + (i.menorPreco || 0) * i.quantidade, 0);
  const totalMedio = cotados.reduce((sum, i) => sum + (i.precoMedio || 0) * i.quantidade, 0);

  return (
    <div className="space-y-4">
      {/* Upload */}
      {!file ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-accent/50 hover:bg-muted/30 transition-colors"
        >
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Upload className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <span className="text-sm font-semibold text-foreground block">
              Envie o Edital ou Termo de Referência
            </span>
            <span className="text-xs text-muted-foreground block mt-1">
              A IA extrairá todos os itens e cotará automaticamente nos marketplaces integrados
            </span>
            <span className="text-xs text-muted-foreground block mt-1">
              PDF, DOC, DOCX, TXT — Máx. 15MB
            </span>
          </div>
        </button>
      ) : (
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
                {itens.length > 0 && <span className="text-success ml-2">✓ {itens.length} itens extraídos</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {itens.length === 0 && (
                <Button onClick={handleExtractItems} disabled={isExtracting}>
                  {isExtracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Extraindo itens...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1" /> Extrair Itens</>
                  )}
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={handleRemoveFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileChange} />

      {/* Extracted items + cotação controls */}
      {itens.length > 0 && (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between bg-card border border-border/40 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-muted-foreground" />
              <div>
                <span className="text-sm font-semibold">{itens.length} itens</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {cotados.length} cotados · {erros.length} erros
                </span>
              </div>
            </div>
            <Button
              onClick={handleCotarTodos}
              disabled={isCotando || cotados.length === itens.length}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isCotando ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Cotando...</>
              ) : cotados.length === itens.length ? (
                <><CheckCircle className="w-4 h-4 mr-1" /> Cotação Completa</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-1" /> Cotar Todos Automaticamente</>
              )}
            </Button>
          </div>

          {/* Progress bar */}
          {isCotando && (
            <div className="space-y-1.5">
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Cotando: {currentItem}...
              </p>
            </div>
          )}

          {/* Summary when done */}
          {cotados.length > 0 && !isCotando && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
                <TrendingDown className="w-5 h-5 text-success mx-auto mb-1" />
                <p className="text-lg font-bold text-success">{formatCurrency(totalMenor)}</p>
                <p className="text-xs text-muted-foreground">Total (Menor Preço)</p>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-3 text-center">
                <ShoppingCart className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{formatCurrency(totalMedio)}</p>
                <p className="text-xs text-muted-foreground">Total (Preço Médio)</p>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-3 text-center">
                <Package className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{cotados.length}/{itens.length}</p>
                <p className="text-xs text-muted-foreground">Itens Cotados</p>
              </div>
            </div>
          )}

          {/* Items list */}
          <div className="space-y-2">
            {itens.map((item, idx) => (
              <div key={idx} className="bg-card border border-border/40 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <Badge variant="outline" className="text-xs shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold">
                    {item.item}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantidade} {item.unidade}
                      {item.status === 'cotado' && item.menorPreco && (
                        <span className="text-success ml-2 font-medium">
                          Menor: {formatCurrency(item.menorPreco)} · Médio: {formatCurrency(item.precoMedio || 0)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'pendente' && (
                      <Badge variant="secondary" className="text-xs">Pendente</Badge>
                    )}
                    {item.status === 'cotando' && (
                      <Badge className="text-xs bg-info/15 text-info border-info/20">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" /> Cotando
                      </Badge>
                    )}
                    {item.status === 'cotado' && (
                      <>
                        <Badge className="text-xs bg-success/20 text-success">
                          <CheckCircle className="w-3 h-3 mr-1" /> {item.fornecedores.length} fontes
                        </Badge>
                        {item.menorPreco && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => handleAddToProposta(item, item.menorPreco!)}
                            title="Adicionar menor preço à proposta"
                          >
                            <Plus className="w-3 h-3 mr-0.5" /> Proposta
                          </Button>
                        )}
                      </>
                    )}
                    {item.status === 'erro' && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" /> {item.erro}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expanded supplier list */}
                {item.status === 'cotado' && item.fornecedores.length > 0 && (
                  <div className="border-t border-border/30 divide-y divide-border/20">
                    {item.fornecedores.map((f, j) => (
                      <div key={j} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/20">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {f.image_url && (
                            <img
                              src={f.image_url}
                              alt=""
                              className="w-8 h-8 object-contain rounded border border-border/30 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{f.titulo}</p>
                            <p className="text-xs text-muted-foreground">{f.loja}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-semibold text-sm ${f.preco === item.menorPreco ? 'text-success' : ''}`}>
                            {formatCurrency(f.preco)}
                          </span>
                          {f.url && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleAddToProposta(item, f.preco)}
                            title="Usar este preço na proposta"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!file && itens.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Envie um edital e a IA cotará todos os itens automaticamente nos +30 marketplaces integrados</p>
        </div>
      )}
    </div>
  );
}
