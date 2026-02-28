import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  DollarSign, Search, ShoppingCart, TrendingUp, TrendingDown,
  ExternalLink, RefreshCw, BarChart3, Package, Plus, FileText, Loader2, Bot,
  Monitor, Briefcase, SprayCan, UtensilsCrossed, Filter, Save, History, Trash2, Eye, CalendarIcon
} from 'lucide-react';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [aiResult, setAiResult] = useState('');
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const navigate = useNavigate();
  const { addItem, hasPending, pendingItems } = usePropostaCart();
  const abortRef = useRef(false);
  const { user } = useAuth();

  const categories = [
    { id: 'todos', label: 'Todos', icon: Filter },
    { id: 'informatica', label: 'Informática e Tecnologia', icon: Monitor },
    { id: 'escritorio', label: 'Escritório e Papelaria', icon: Briefcase },
    { id: 'limpeza', label: 'Higiene e Limpeza', icon: SprayCan },
    { id: 'alimenticios', label: 'Gêneros Alimentícios', icon: UtensilsCrossed },
  ];

  const loadSavedSearches = async () => {
    if (!user) return;
    setLoadingHistory(true);
    let query = supabase
      .from('pesquisas_preco')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (dateFrom) {
      query = query.gte('created_at', dateFrom.toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao carregar histórico.');
    } else {
      setSavedSearches(data || []);
    }
    setLoadingHistory(false);
  };

  const handleSaveSearch = async () => {
    if (!user || !aiResult.trim()) return;
    const { error } = await supabase.from('pesquisas_preco').insert({
      user_id: user.id,
      termo_busca: currentSearchTerm,
      categoria: selectedCategory,
      resultado: aiResult,
    });
    if (error) {
      toast.error('Erro ao salvar pesquisa.');
    } else {
      toast.success('Pesquisa salva com sucesso!');
      if (showHistory) loadSavedSearches();
    }
  };

  const handleDeleteSearch = async (id: string) => {
    const { error } = await supabase.from('pesquisas_preco').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir pesquisa.');
    } else {
      toast.success('Pesquisa excluída.');
      setSavedSearches(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleViewSearch = (item: any) => {
    setAiResult(item.resultado);
    setCurrentSearchTerm(item.termo_busca);
    setSearch(item.termo_busca);
    setSelectedCategory(item.categoria || 'todos');
    setShowHistory(false);
  };

  useEffect(() => {
    if (showHistory) loadSavedSearches();
  }, [showHistory, dateFrom, dateTo]);

  const handleAISearch = async () => {
    if (!search.trim()) {
      toast.error('Digite um produto para buscar.');
      return;
    }
    setIsSearchingAI(true);
    setCurrentSearchTerm(search);
    setAiResult('');
    abortRef.current = false;

    const categoryLabel = selectedCategory !== 'todos'
      ? categories.find(c => c.id === selectedCategory)?.label
      : null;
    const categoryInstruction = categoryLabel
      ? `\nCATEGORIA SELECIONADA: ${categoryLabel}. Foque a pesquisa nesta categoria.`
      : '';

    await streamAIChat({
      messages: [{ role: 'user', content: `Realize pesquisa de mercado para: "${search}".${categoryInstruction}

Siga RIGOROSAMENTE o formato padronizado: blocos por fornecedor (com produto, marca, modelo, preço, site, telefone, email), tabela comparativa consolidada, resumo de preços e recomendação. Mínimo 3 fornecedores.` }],
      action: 'pesquisa_mercado',
      onDelta: (text) => {
        if (!abortRef.current) setAiResult((prev) => prev + text);
      },
      onDone: () => setIsSearchingAI(false),
      onError: (err) => {
        toast.error(err);
        setIsSearchingAI(false);
      },
    });
  };

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

        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <Button
                key={cat.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className={isActive ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''}
              >
                <Icon className="w-4 h-4 mr-1" />
                {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex gap-2 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ex: Notebook Dell i7, Monitor 24'', Toner HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleAISearch}
            disabled={isSearchingAI}
            className="bg-accent hover:bg-accent/90 text-accent-foreground min-w-[120px]"
          >
            {isSearchingAI ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Buscando...</>
            ) : (
              <><Bot className="w-4 h-4 mr-1" /> BUSCAR</>
            )}
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowHistory(!showHistory)}
            className="min-w-[120px]"
          >
            <History className="w-4 h-4 mr-1" /> Histórico
          </Button>
        </div>

        {/* Saved Searches History */}
        {showHistory && (
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-sm">Pesquisas Salvas</h3>
              {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  Limpar datas
                </Button>
              )}
            </div>
            {savedSearches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma pesquisa salva ainda.</p>
            ) : (
              <div className="space-y-2">
                {savedSearches.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.termo_busca}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.categoria !== 'todos' && <Badge variant="outline" className="mr-2 text-[10px]">{item.categoria}</Badge>}
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="ghost" onClick={() => handleViewSearch(item)} title="Visualizar">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteSearch(item.id)} title="Excluir" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Results */}
        {(aiResult || isSearchingAI) && (
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-accent" />
                <h3 className="font-semibold text-sm">Resultado da Pesquisa de Mercado (IA)</h3>
                {isSearchingAI && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
              </div>
              {aiResult && !isSearchingAI && (
                <Button size="sm" variant="outline" onClick={handleSaveSearch}>
                  <Save className="w-4 h-4 mr-1" /> Salvar Pesquisa
                </Button>
              )}
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert overflow-x-auto">
              <ReactMarkdown>{aiResult}</ReactMarkdown>
            </div>
          </div>
        )}

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
