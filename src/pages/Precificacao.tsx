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
  Filter, Save, History, Trash2, Eye, CalendarIcon,
  MapPin, Globe, ChevronRight, Tag, X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { PesquisaResultML, type PesquisaMLResult } from '@/components/precificacao/ProdutoCardML';
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

const REGIOES_ESTADOS: Record<string, { label: string; estados: { uf: string; nome: string; cidades: string[] }[] }> = {
  norte: {
    label: 'Norte',
    estados: [
      { uf: 'PA', nome: 'Pará', cidades: ['Belém', 'Ananindeua', 'Santarém', 'Marabá', 'Castanhal', 'Parauapebas'] },
      { uf: 'AM', nome: 'Amazonas', cidades: ['Manaus', 'Parintins', 'Itacoatiara'] },
      { uf: 'TO', nome: 'Tocantins', cidades: ['Palmas', 'Araguaína', 'Gurupi'] },
      { uf: 'RO', nome: 'Rondônia', cidades: ['Porto Velho', 'Ji-Paraná'] },
      { uf: 'AC', nome: 'Acre', cidades: ['Rio Branco', 'Cruzeiro do Sul'] },
      { uf: 'AP', nome: 'Amapá', cidades: ['Macapá', 'Santana'] },
      { uf: 'RR', nome: 'Roraima', cidades: ['Boa Vista'] },
    ],
  },
  nordeste: {
    label: 'Nordeste',
    estados: [
      { uf: 'BA', nome: 'Bahia', cidades: ['Salvador', 'Feira de Santana', 'Vitória da Conquista'] },
      { uf: 'CE', nome: 'Ceará', cidades: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte'] },
      { uf: 'PE', nome: 'Pernambuco', cidades: ['Recife', 'Jaboatão dos Guararapes', 'Olinda'] },
      { uf: 'MA', nome: 'Maranhão', cidades: ['São Luís', 'Imperatriz'] },
      { uf: 'PB', nome: 'Paraíba', cidades: ['João Pessoa', 'Campina Grande'] },
      { uf: 'RN', nome: 'Rio Grande do Norte', cidades: ['Natal', 'Mossoró'] },
      { uf: 'AL', nome: 'Alagoas', cidades: ['Maceió', 'Arapiraca'] },
      { uf: 'PI', nome: 'Piauí', cidades: ['Teresina', 'Parnaíba'] },
      { uf: 'SE', nome: 'Sergipe', cidades: ['Aracaju'] },
    ],
  },
  sudeste: {
    label: 'Sudeste',
    estados: [
      { uf: 'SP', nome: 'São Paulo', cidades: ['São Paulo', 'Campinas', 'Guarulhos', 'Santos'] },
      { uf: 'RJ', nome: 'Rio de Janeiro', cidades: ['Rio de Janeiro', 'Niterói', 'São Gonçalo'] },
      { uf: 'MG', nome: 'Minas Gerais', cidades: ['Belo Horizonte', 'Uberlândia', 'Contagem'] },
      { uf: 'ES', nome: 'Espírito Santo', cidades: ['Vitória', 'Vila Velha', 'Serra'] },
    ],
  },
  sul: {
    label: 'Sul',
    estados: [
      { uf: 'PR', nome: 'Paraná', cidades: ['Curitiba', 'Londrina', 'Maringá'] },
      { uf: 'SC', nome: 'Santa Catarina', cidades: ['Florianópolis', 'Joinville', 'Blumenau'] },
      { uf: 'RS', nome: 'Rio Grande do Sul', cidades: ['Porto Alegre', 'Caxias do Sul', 'Pelotas'] },
    ],
  },
  centro_oeste: {
    label: 'Centro-Oeste',
    estados: [
      { uf: 'GO', nome: 'Goiás', cidades: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis'] },
      { uf: 'MT', nome: 'Mato Grosso', cidades: ['Cuiabá', 'Várzea Grande', 'Rondonópolis'] },
      { uf: 'MS', nome: 'Mato Grosso do Sul', cidades: ['Campo Grande', 'Dourados'] },
      { uf: 'DF', nome: 'Distrito Federal', cidades: ['Brasília'] },
    ],
  },
};

export default function Precificacao() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [aiResult, setAiResult] = useState('');
  const [aiParsedData, setAiParsedData] = useState<PesquisaMLResult | null>(null);
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedRegiao, setSelectedRegiao] = useState('todos');
  const [selectedEstado, setSelectedEstado] = useState('todos');
  const [selectedCidade, setSelectedCidade] = useState('todos');
  const navigate = useNavigate();
  const { addItem, hasPending, pendingItems } = usePropostaCart();
  const abortRef = useRef(false);
  const { user } = useAuth();

  const availableEstados = selectedRegiao !== 'todos'
    ? REGIOES_ESTADOS[selectedRegiao]?.estados || []
    : Object.values(REGIOES_ESTADOS).flatMap(r => r.estados);

  const availableCidades = selectedEstado !== 'todos'
    ? availableEstados.find(e => e.uf === selectedEstado)?.cidades || []
    : availableEstados.flatMap(e => e.cidades);

  const handleRegiaoChange = (val: string) => {
    setSelectedRegiao(val);
    setSelectedEstado('todos');
    setSelectedCidade('todos');
  };

  const handleEstadoChange = (val: string) => {
    setSelectedEstado(val);
    setSelectedCidade('todos');
  };

  // Dynamic category tree extracted from AI search results
  const categoryTree = (() => {
    if (!aiParsedData) return { main: '', subs: [] as { name: string; count: number }[], total: 0 };
    const results = Array.isArray(aiParsedData) ? aiParsedData : [aiParsedData];
    const mainCat = results[0]?.categoria || '';
    const subCounts: Record<string, number> = {};
    let total = 0;
    results.forEach((r: any) => {
      r?.fornecedores?.forEach((f: any) => {
        total++;
        const cat = f?.categoria || 'Outros';
        subCounts[cat] = (subCounts[cat] || 0) + 1;
      });
      // Also use top-level subcategorias if available
      if (r?.subcategorias) {
        r.subcategorias.forEach((s: string) => {
          if (!subCounts[s]) subCounts[s] = 0;
        });
      }
    });
    const subs = Object.entries(subCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return { main: mainCat, subs, total };
  })();

  // Filter fornecedores by selected category
  const filteredByCategory = (fornecedores: any[]) => {
    if (selectedCategory === 'todos') return fornecedores;
    return fornecedores.filter((f: any) => (f?.categoria || 'Outros') === selectedCategory);
  };


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
    // Try to parse old saved searches as JSON too
    tryParseAiResult(item.resultado);
  };

  const tryParseAiResult = (text: string) => {
    try {
      // Clean up: remove markdown code fences if present
      let clean = text.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(clean);
      if (parsed.fornecedores) {
        setAiParsedData(parsed as PesquisaMLResult);
      } else if (Array.isArray(parsed) && parsed[0]?.fornecedores) {
        setAiParsedData(parsed[0] as PesquisaMLResult);
      }
    } catch {
      setAiParsedData(null);
    }
  };

  // Parse AI result when streaming finishes
  useEffect(() => {
    if (!isSearchingAI && aiResult) {
      tryParseAiResult(aiResult);
    }
  }, [isSearchingAI, aiResult]);

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
    setSelectedCategory('todos');
    setAiResult('');
    setAiParsedData(null);
    abortRef.current = false;

    const catInstLabel = selectedCategory !== 'todos' ? selectedCategory : null;
    const categoryInstruction = catInstLabel
      ? `\nCATEGORIA SELECIONADA: ${catInstLabel}. Foque a pesquisa nesta categoria.`
      : '';

    // Build location instruction
    const locationParts: string[] = [];
    if (selectedCidade !== 'todos') locationParts.push(`cidade: ${selectedCidade}`);
    if (selectedEstado !== 'todos') {
      const estadoNome = availableEstados.find(e => e.uf === selectedEstado)?.nome || selectedEstado;
      locationParts.push(`estado: ${estadoNome} (${selectedEstado})`);
    }
    if (selectedRegiao !== 'todos') locationParts.push(`região: ${REGIOES_ESTADOS[selectedRegiao]?.label}`);
    const locationInstruction = locationParts.length > 0
      ? `\nLOCALIZAÇÃO: Priorize fornecedores e preços com entrega para ${locationParts.join(', ')}. Considere frete para essa região.`
      : '';

    await streamAIChat({
      messages: [{ role: 'user', content: `Realize pesquisa de mercado para: "${search}".${categoryInstruction}${locationInstruction}

Retorne APENAS JSON puro, sem markdown, sem crases, sem texto adicional. Mínimo 5 fornecedores.` }],
      action: 'pesquisa_mercado',
      onDelta: (text) => {
        if (!abortRef.current) setAiResult((prev) => prev + text);
      },
      onDone: () => {
        setIsSearchingAI(false);
      },
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

        {/* ML-style Category Breadcrumb */}
        {categoryTree.subs.length > 0 && selectedCategory !== 'todos' && (
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => setSelectedCategory('todos')} className="text-primary hover:underline">
              {categoryTree.main || 'Resultados'}
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">{selectedCategory}</span>
            <button onClick={() => setSelectedCategory('todos')} className="ml-2 p-0.5 rounded-full hover:bg-muted">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Geographic Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">Localização:</span>
          </div>
          <Select value={selectedRegiao} onValueChange={handleRegiaoChange}>
            <SelectTrigger className="w-[150px] h-9">
              <Globe className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as regiões</SelectItem>
              {Object.entries(REGIOES_ESTADOS).map(([key, r]) => (
                <SelectItem key={key} value={key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedEstado} onValueChange={handleEstadoChange}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              {availableEstados.map((e) => (
                <SelectItem key={e.uf} value={e.uf}>{e.nome} ({e.uf})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCidade} onValueChange={setSelectedCidade}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as cidades</SelectItem>
              {availableCidades.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(selectedRegiao !== 'todos' || selectedEstado !== 'todos' || selectedCidade !== 'todos') && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedRegiao('todos'); setSelectedEstado('todos'); setSelectedCidade('todos'); }}>
              Limpar
            </Button>
          )}
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

        {/* AI Results with ML-style sidebar */}
        {(aiResult || isSearchingAI) && (
          <div className="flex gap-5">
            {/* Left Sidebar – ML Category Filter */}
            {categoryTree.subs.length > 1 && !isSearchingAI && (
              <div className="w-[220px] flex-shrink-0">
                <div className="sticky top-4 bg-card border border-border/40 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {categoryTree.main || 'Categorias'}
                    </h4>
                  </div>
                  <ul className="space-y-0.5">
                    <li>
                      <button
                        onClick={() => setSelectedCategory('todos')}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors",
                          selectedCategory === 'todos'
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <span>Todas</span>
                        <span className="text-[10px] text-muted-foreground">({categoryTree.total})</span>
                      </button>
                    </li>
                    {categoryTree.subs.map((sub) => (
                      <li key={sub.name}>
                        <button
                          onClick={() => setSelectedCategory(sub.name)}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors",
                            selectedCategory === sub.name
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span className="truncate">{sub.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">({sub.count})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Results Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-[#3483fa]" />
                    <h3 className="font-semibold text-sm">Resultado da Pesquisa de Mercado</h3>
                    {isSearchingAI && <Loader2 className="w-4 h-4 animate-spin text-[#3483fa]" />}
                  </div>
                  {aiResult && !isSearchingAI && (
                    <Button size="sm" variant="outline" onClick={handleSaveSearch}>
                      <Save className="w-4 h-4 mr-1" /> Salvar Pesquisa
                    </Button>
                  )}
                </div>
                <PesquisaResultML
                  data={aiParsedData ? {
                    ...aiParsedData,
                    fornecedores: filteredByCategory(aiParsedData.fornecedores),
                  } : null}
                  isLoading={isSearchingAI}
                  rawMarkdown={!aiParsedData && !isSearchingAI ? aiResult : undefined}
                />
              </div>
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
