import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from 'sonner';
import {
  Newspaper, AlertTriangle, TrendingUp, Search, Sparkles,
  ExternalLink, CloudRain, Flame, Truck, MapPin, RefreshCw,
  FileText, Scale, Loader2
} from 'lucide-react';

type NewsItem = {
  id: string;
  titulo: string;
  fonte: string;
  data: string;
  resumo: string;
  impacto: 'alto' | 'medio' | 'baixo';
  categoria: string;
  url: string;
  produtosAfetados: string[];
  variacaoPreco: string;
};

const mockNews: NewsItem[] = [];
const impactoConfig = {
  alto: { color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
  medio: { color: 'bg-warning/15 text-warning border-warning/30', icon: TrendingUp },
  baixo: { color: 'bg-info/15 text-info border-info/30', icon: TrendingUp },
};

const categoriaIcons: Record<string, typeof CloudRain> = {
  'Calamidade Pública': CloudRain,
  'Caso Fortuito / Força Maior': Flame,
  'Fato Superveniente': Truck,
  'Índice Econômico': TrendingUp,
};

export default function ReequilibrioIA() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedNews, setSelectedNews] = useState<string[]>([]);
  const [contrato, setContrato] = useState('');
  const [orgao, setOrgao] = useState('');
  const [itensAfetados, setItensAfetados] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [generatingPedido, setGeneratingPedido] = useState(false);
  const [pedidoGerado, setPedidoGerado] = useState('');

  const filtered = mockNews.filter(
    (n) =>
      n.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.produtosAfetados.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleSelect = (id: string) =>
    setSelectedNews((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const handleGerarPedido = async () => {
    const eventosTexto = selectedNews.map(id => {
      const n = mockNews.find(m => m.id === id);
      return n ? `- ${n.titulo} (${n.categoria}, Impacto: ${n.impacto}, Variação: ${n.variacaoPreco}): ${n.resumo}` : '';
    }).join('\n');

    const prompt = `Gere um pedido formal de reequilíbrio econômico-financeiro com os seguintes dados:
Contrato: ${contrato || 'Não informado'}
Órgão Contratante: ${orgao || 'Não informado'}
Itens afetados: ${itensAfetados || 'Não informado'}
Observações: ${observacoes || 'Nenhuma'}

Eventos de fundamentação:
${eventosTexto}

Gere o documento completo com: cabeçalho, fundamentação legal (Lei 14.133/2021), demonstração da onerosidade, pedido e conclusão.`;

    setGeneratingPedido(true);
    setPedidoGerado('');

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'reequilibrio',
      onDelta: (chunk) => setPedidoGerado(prev => prev + chunk),
      onDone: () => setGeneratingPedido(false),
      onError: (error) => { toast.error(error); setGeneratingPedido(false); },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Monitoramento IA – Eventos de Força Maior</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Buscando...' : 'Atualizar'}
          </Button>
          {selectedNews.length > 0 && (
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowGenerator(true)}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Gerar Pedido ({selectedNews.length})
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por evento, produto ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Info banner */}
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">IA ativa:</strong> Monitorando portais de notícias, decretos governamentais e índices econômicos em tempo real.
          Selecione as notícias relevantes para gerar automaticamente o pedido de reequilíbrio com fundamentação jurídica.
        </p>
      </div>

      {/* News list */}
      <div className="space-y-3">
        {filtered.map((news) => {
          const impCfg = impactoConfig[news.impacto];
          const CatIcon = categoriaIcons[news.categoria] || Newspaper;
          const isSelected = selectedNews.includes(news.id);
          return (
            <div
              key={news.id}
              className={`bg-card rounded-xl border p-4 shadow-sm transition-all cursor-pointer ${
                isSelected ? 'border-accent ring-1 ring-accent/30' : 'border-border/50 hover:border-accent/30'
              }`}
              onClick={() => toggleSelect(news.id)}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <CatIcon className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{news.titulo}</p>
                    <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${impCfg.color}`}>
                      Impacto {news.impacto}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted-foreground">{news.fonte}</span>
                    <span className="text-[11px] text-muted-foreground">•</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(news.data).toLocaleDateString('pt-BR')}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{news.categoria}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{news.resumo}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        Produtos: {news.produtosAfetados.slice(0, 3).join(', ')}
                        {news.produtosAfetados.length > 3 && ` +${news.produtosAfetados.length - 3}`}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                      {news.variacaoPreco}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Generator panel */}
      {showGenerator && (
        <div className="bg-card rounded-xl border border-accent/30 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-semibold">Gerador de Pedido de Reequilíbrio</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowGenerator(false)}>✕</Button>
          </div>

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">
              <strong>{selectedNews.length}</strong> evento(s) selecionado(s) como fundamentação:
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedNews.map((id) => {
                const n = mockNews.find((m) => m.id === id);
                return n ? (
                  <Badge key={id} variant="outline" className="text-[10px]">
                    {n.titulo.slice(0, 50)}...
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Nº do Contrato</label>
              <Input placeholder="CT-001/2025" className="mt-1" value={contrato} onChange={e => setContrato(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Órgão Contratante</label>
              <Input placeholder="Prefeitura de Belém" className="mt-1" value={orgao} onChange={e => setOrgao(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Itens afetados e variação de preço</label>
            <Textarea
              placeholder="Ex: Cimento CP-II: de R$ 32,00 para R$ 40,00/saco (+25%)..."
              className="mt-1 min-h-[80px]"
              value={itensAfetados}
              onChange={e => setItensAfetados(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Observações adicionais</label>
            <Textarea
              placeholder="Informações complementares sobre o impacto no contrato..."
              className="mt-1 min-h-[60px]"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Fundamentação automática:</strong> Art. 124, II, "d" da Lei 14.133/2021 –
              Reestabelecimento do equilíbrio econômico-financeiro em decorrência de caso fortuito ou força maior,
              com comprovação de onerosidade excessiva por fatos supervenientes imprevisíveis.
            </p>
          </div>

          <Button
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={handleGerarPedido}
            disabled={generatingPedido}
          >
            {generatingPedido ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {generatingPedido ? 'Gerando...' : 'Gerar Pedido Completo com IA'}
          </Button>

          {pedidoGerado && (
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Pedido Gerado pela IA:</h4>
              <div className="text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">{pedidoGerado}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
