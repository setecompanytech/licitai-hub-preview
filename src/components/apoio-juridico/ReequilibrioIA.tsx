import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Newspaper, AlertTriangle, TrendingUp, Search, Sparkles,
  ExternalLink, CloudRain, Flame, Truck, MapPin, RefreshCw,
  FileText, Scale
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

const mockNews: NewsItem[] = [
  {
    id: '1',
    titulo: 'Enchentes no RS causam interrupção na cadeia de suprimentos de aço e cimento',
    fonte: 'G1 / Economia',
    data: '2026-02-20',
    resumo: 'As enchentes que atingiram o Rio Grande do Sul nas últimas semanas provocaram a paralisação de 3 siderúrgicas e 5 fábricas de cimento. O impacto na oferta deve durar pelo menos 60 dias, com alta estimada de 15-25% nos preços regionais.',
    impacto: 'alto',
    categoria: 'Calamidade Pública',
    url: '#',
    produtosAfetados: ['Aço CA-50', 'Cimento CP-II', 'Vergalhão', 'Areia lavada'],
    variacaoPreco: '+18% a +25%',
  },
  {
    id: '2',
    titulo: 'Decreto de calamidade pública no Pará após alagamentos em Belém e região',
    fonte: 'Agência Brasil',
    data: '2026-02-18',
    resumo: 'O governador do Pará decretou estado de calamidade pública em 12 municípios após chuvas recordes. A infraestrutura logística foi severamente comprometida, elevando custos de transporte em até 40%.',
    impacto: 'alto',
    categoria: 'Caso Fortuito / Força Maior',
    url: '#',
    produtosAfetados: ['Transporte rodoviário', 'Brita', 'Madeira', 'Combustível diesel'],
    variacaoPreco: '+30% a +40%',
  },
  {
    id: '3',
    titulo: 'Crise energética eleva custos de produção industrial em 12%',
    fonte: 'Valor Econômico',
    data: '2026-02-15',
    resumo: 'A bandeira vermelha na tarifa de energia elétrica, mantida pelo terceiro mês consecutivo, tem impactado diretamente os custos de fabricação de materiais de construção e equipamentos industriais.',
    impacto: 'medio',
    categoria: 'Fato Superveniente',
    url: '#',
    produtosAfetados: ['Materiais industrializados', 'Tubulações PVC', 'Fiação elétrica'],
    variacaoPreco: '+10% a +15%',
  },
  {
    id: '4',
    titulo: 'Greve dos caminhoneiros afeta distribuição de insumos na região Norte',
    fonte: 'Folha de S.Paulo',
    data: '2026-02-12',
    resumo: 'A paralisação de caminhoneiros autônomos na BR-010 e BR-316 está causando desabastecimento de materiais de construção em Belém e municípios vizinhos há 5 dias.',
    impacto: 'alto',
    categoria: 'Caso Fortuito / Força Maior',
    url: '#',
    produtosAfetados: ['Todos os insumos via rodovia', 'Combustíveis', 'Alimentos'],
    variacaoPreco: '+20% a +35%',
  },
  {
    id: '5',
    titulo: 'IBGE: INCC acumula alta de 8,7% nos últimos 12 meses',
    fonte: 'IBGE / Indicadores',
    data: '2026-02-10',
    resumo: 'O Índice Nacional de Custo da Construção superou as projeções do mercado, evidenciando pressão inflacionária persistente no setor, especialmente em mão de obra especializada.',
    impacto: 'medio',
    categoria: 'Índice Econômico',
    url: '#',
    produtosAfetados: ['Mão de obra', 'Materiais em geral'],
    variacaoPreco: '+8,7% acumulado',
  },
];

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
              <Input placeholder="CT-001/2025" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Órgão Contratante</label>
              <Input placeholder="Prefeitura de Belém" className="mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Itens afetados e variação de preço</label>
            <Textarea
              placeholder="Ex: Cimento CP-II: de R$ 32,00 para R$ 40,00/saco (+25%)..."
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Observações adicionais</label>
            <Textarea
              placeholder="Informações complementares sobre o impacto no contrato..."
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Fundamentação automática:</strong> Art. 124, II, "d" da Lei 14.133/2021 –
              Reestabelecimento do equilíbrio econômico-financeiro em decorrência de caso fortuito ou força maior,
              com comprovação de onerosidade excessiva por fatos supervenientes imprevisíveis.
            </p>
          </div>

          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <Sparkles className="w-4 h-4 mr-1" /> Gerar Pedido Completo com IA
          </Button>
        </div>
      )}
    </div>
  );
}
