import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DollarSign, Search, ShoppingCart, TrendingUp, TrendingDown,
  ExternalLink, RefreshCw, BarChart3, Package, Plus, FileText
} from 'lucide-react';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';

type FontePreco = {
  fonte: string;
  url: string;
  preco: number;
  frete?: number;
  vendedor: string;
  atualizado: string;
};

type ItemPesquisa = {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoMedio: number;
  precoMin: number;
  precoMax: number;
  fontes: FontePreco[];
};

const itensMock: ItemPesquisa[] = [
  {
    id: '1',
    descricao: 'Cimento Portland CP-II 50kg',
    unidade: 'Saco',
    quantidade: 500,
    precoMedio: 38.90,
    precoMin: 32.50,
    precoMax: 45.90,
    fontes: [
      { fonte: 'Mercado Livre', url: '#', preco: 34.90, frete: 0, vendedor: 'Material Express', atualizado: '2026-02-15' },
      { fonte: 'Google Shopping', url: '#', preco: 36.50, vendedor: 'Leroy Merlin', atualizado: '2026-02-16' },
      { fonte: 'Atacadão Material', url: '#', preco: 32.50, frete: 150, vendedor: 'Direto Fábrica', atualizado: '2026-02-14' },
      { fonte: 'SINAPI', url: '#', preco: 38.90, vendedor: 'Referência SINAPI', atualizado: '2026-02-01' },
    ],
  },
  {
    id: '2',
    descricao: 'Vergalhão CA-50 10mm (12m)',
    unidade: 'Barra',
    quantidade: 200,
    precoMedio: 52.30,
    precoMin: 45.00,
    precoMax: 62.00,
    fontes: [
      { fonte: 'Mercado Livre', url: '#', preco: 48.90, frete: 0, vendedor: 'Aço Brasil', atualizado: '2026-02-15' },
      { fonte: 'Google Shopping', url: '#', preco: 52.30, vendedor: 'C&C', atualizado: '2026-02-16' },
      { fonte: 'Distribuidora Norte', url: '#', preco: 45.00, frete: 200, vendedor: 'Ferro Norte PA', atualizado: '2026-02-13' },
    ],
  },
  {
    id: '3',
    descricao: 'Tinta Acrílica Premium 18L Branco',
    unidade: 'Lata',
    quantidade: 50,
    precoMedio: 289.00,
    precoMin: 249.90,
    precoMax: 339.90,
    fontes: [
      { fonte: 'Mercado Livre', url: '#', preco: 269.90, frete: 0, vendedor: 'Tintas Belém', atualizado: '2026-02-15' },
      { fonte: 'Google Shopping', url: '#', preco: 289.00, vendedor: 'Telhanorte', atualizado: '2026-02-16' },
      { fonte: 'Atacadista Cores', url: '#', preco: 249.90, frete: 80, vendedor: 'Atacado Tintas', atualizado: '2026-02-14' },
    ],
  },
];

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fonteColors: Record<string, string> = {
  'Mercado Livre': 'bg-warning/15 text-warning',
  'Google Shopping': 'bg-info/15 text-info',
  SINAPI: 'bg-accent/15 text-accent',
};

export default function Precificacao() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { addItem, hasPending, pendingItems } = usePropostaCart();

  const handleAddToProposta = (item: ItemPesquisa, preco: number) => {
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
    });
    toast.success(`"${item.descricao}" adicionado à proposta!`);
  };

  const filtered = itensMock.filter((item) =>
    item.descricao.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-accent" />
              Precificação de Preços
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pesquisa integrada com Mercado Livre, Google Shopping, SINAPI e atacadistas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar Preços
            </Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" size="sm">
              <BarChart3 className="w-4 h-4 mr-1" /> Gerar Relatório
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Itens Pesquisados', value: '3', icon: Package },
            { label: 'Fontes Consultadas', value: '4', icon: ShoppingCart },
            { label: 'Economia Potencial', value: '-12.4%', icon: TrendingDown, color: 'text-success' },
            { label: 'Última Atualização', value: 'Hoje', icon: RefreshCw },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`w-4 h-4 ${s.color || 'text-accent'}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Pending items banner */}
        {hasPending && (
          <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-accent" />
              <span><strong>{pendingItems.length}</strong> {pendingItems.length === 1 ? 'item adicionado' : 'itens adicionados'} à proposta</span>
            </div>
            <Button size="sm" onClick={() => navigate('/proposta-tecnica')} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <FileText className="w-4 h-4 mr-1" /> Ir para Proposta Técnica
            </Button>
          </div>
        )}
        {/* Items */}
        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
              {/* Item header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <div>
                  <p className="font-semibold text-sm">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantidade} {item.unidade}(s) · Preço médio: {formatCurrency(item.precoMedio)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <p className="text-muted-foreground">Mínimo</p>
                    <p className="font-semibold text-success">{formatCurrency(item.precoMin)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Máximo</p>
                    <p className="font-semibold text-destructive">{formatCurrency(item.precoMax)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Total Estimado</p>
                    <p className="font-bold">{formatCurrency(item.precoMedio * item.quantidade)}</p>
                  </div>
                </div>
              </div>

              {/* Fontes */}
              <div className="divide-y divide-border/20">
                {item.fontes.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={fonteColors[f.fonte] || 'bg-muted text-muted-foreground'}>
                        {f.fonte}
                      </Badge>
                      <span className="text-sm">{f.vendedor}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold">{formatCurrency(f.preco)}</span>
                      {f.frete !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          Frete: {f.frete === 0 ? 'Grátis' : formatCurrency(f.frete)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.atualizado).toLocaleDateString('pt-BR')}
                      </span>
                      {f.preco === item.precoMin && (
                        <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                          Menor preço
                        </Badge>
                      )}
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddToProposta(item, f.preco)} title="Adicionar à Proposta Técnica">
                        <Plus className="w-3 h-3 mr-1" /> Proposta
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
