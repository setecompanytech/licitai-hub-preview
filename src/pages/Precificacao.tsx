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
  MapPin, Globe, ChevronRight, Tag, X, Truck, CheckSquare, Square, Store, Award,
  Building2, Upload, ShieldCheck, FileSearch, Clipboard, Sparkles, Calculator, FileSpreadsheet
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
// streamAIChat kept for potential fallback usage
import { streamAIChat, type ChatMessage } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { PesquisaResultML, type PesquisaMLResult } from '@/components/precificacao/ProdutoCardML';
import { useAuth } from '@/contexts/AuthContext';
import { extractTextFromFile } from '@/lib/pdf-text-extractor';
import { REGIOES_ESTADOS } from '@/data/regioes-brasil';
import PainelPrecosGov from '@/components/precificacao/PainelPrecosGov';
import CotacaoEditalAutoIA from '@/components/precificacao/CotacaoEditalAutoIA';
import CalculadoraUnificada from '@/components/precificacao/CalculadoraUnificada';
import CatalogoPrecificados from '@/components/precificacao/CatalogoPrecificados';
import FontesManager from '@/components/precificacao/FontesManager';
import CotacoesUnificado from '@/components/precificacao/CotacoesUnificado';
import InteligenciaUnificada from '@/components/precificacao/InteligenciaUnificada';
import RevisaoItensExtraidos, { type ItemExtraido } from '@/components/precificacao/RevisaoItensExtraidos';
import PlanilhaCustosEdital from '@/components/precificacao/PlanilhaCustosEdital';

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

const itensPesquisa: ItemPesquisa[] = [];

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
  const [filterFreteGratis, setFilterFreteGratis] = useState(false);
  const [filterCondicao, setFilterCondicao] = useState<'todos' | 'Novo' | 'Usado' | 'Recondicionado'>('todos');
  const [filterPrecoMin, setFilterPrecoMin] = useState('');
  const [filterPrecoMax, setFilterPrecoMax] = useState('');
  const [filterLojas, setFilterLojas] = useState<string[]>([]);
  const [filterMarcas, setFilterMarcas] = useState<string[]>([]);
  const navigate = useNavigate();
  const { addItem, hasPending, pendingItems } = usePropostaCart();
  const abortRef = useRef(false);
  const { user } = useAuth();

  // Spec-based search state
  const [searchMode, setSearchMode] = useState<'simple' | 'spec' | 'edital'>('simple');
  const [specText, setSpecText] = useState('');
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [isExtractingSpec, setIsExtractingSpec] = useState(false);
  const [extractedTerms, setExtractedTerms] = useState<string[]>([]);
  const specFileRef = useRef<HTMLInputElement>(null);

  const handleSpecFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSpecFile(file);
  };

  const handleSpecSearch = async () => {
    let textToAnalyze = specText.trim();

    // If file uploaded, extract text using proper PDF/DOCX parser
    if (specFile && !textToAnalyze) {
      setIsExtractingSpec(true);
      try {
        textToAnalyze = await extractTextFromFile(specFile);
        if (!textToAnalyze || textToAnalyze.trim().length < 30) {
          toast.error('Não foi possível extrair texto do documento. Verifique se o arquivo não está protegido.');
          setIsExtractingSpec(false);
          return;
        }
      } catch {
        toast.error('Erro ao ler o arquivo. Tente colar o texto diretamente.');
        setIsExtractingSpec(false);
        return;
      }
    }

    if (!textToAnalyze) {
      toast.error('Cole a especificação técnica ou faça upload de um documento.');
      return;
    }

    setIsExtractingSpec(true);

    try {
      // Use AI to extract searchable product terms from the spec
      let extracted = '';
      await streamAIChat({
        messages: [{ role: 'user', content: textToAnalyze }],
        action: 'extrair-spec',
        context: `Você é um especialista em especificações técnicas de produtos para licitações públicas.
Analise a especificação técnica abaixo e extraia os termos de busca mais precisos para encontrar o produto EXATO nos marketplaces.

REGRAS:
1. Identifique: marca, modelo, capacidade, dimensões, voltagem, cor e quaisquer características técnicas distintivas
2. Gere de 1 a 3 termos de busca otimizados, do mais específico ao mais genérico
3. O primeiro termo deve incluir marca + modelo exatos (se disponíveis)
4. O segundo pode ser marca + tipo + capacidade principal
5. O terceiro pode ser tipo genérico + características-chave

Responda APENAS em JSON, sem markdown:
{"termos": ["termo1 mais específico", "termo2 intermediário", "termo3 genérico"], "produto_identificado": "nome resumido do produto"}`,
        onDelta: (d) => { extracted += d; },
        onDone: () => {},
        onError: (err) => { toast.error('Erro na extração: ' + err); },
      });

      // Parse the AI response
      let cleanJson = extracted.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(cleanJson);
      const termos: string[] = parsed.termos || [];
      const produtoId = parsed.produto_identificado || termos[0] || '';

      if (termos.length === 0) {
        toast.error('Não foi possível identificar o produto na especificação.');
        setIsExtractingSpec(false);
        return;
      }

      setExtractedTerms(termos);
      toast.success(`Produto identificado: ${produtoId}. Buscando nos marketplaces...`);

      // Now search with the most specific term first
      setSearch(termos[0]);
      setIsExtractingSpec(false);
      setIsSearchingAI(true);
      setCurrentSearchTerm(termos[0]);
      resetAllFilters();
      setAiResult('');
      setAiParsedData(null);

      // Search with multiple terms in parallel for better coverage
      const allResults: any[] = [];
      const searchPromises = termos.slice(0, 2).map(async (termo) => {
        const { data, error } = await supabase.functions.invoke('pesquisa-preco-real', {
          body: { termo },
        });
        if (!error && data?.success && data.data?.fornecedores) {
          return data.data.fornecedores;
        }
        return [];
      });

      const results = await Promise.allSettled(searchPromises);
      const seenUrls = new Set<string>();
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const f of r.value) {
            const key = (f.url || '').split('?')[0];
            if (!seenUrls.has(key)) {
              seenUrls.add(key);
              allResults.push(f);
            }
          }
        }
      }

      allResults.sort((a: any, b: any) => a.preco - b.preco);

      if (allResults.length > 0) {
        const precos = allResults.map((f: any) => f.preco);
        const min = Math.min(...precos);
        const max = Math.max(...precos);
        const avg = precos.reduce((a: number, b: number) => a + b, 0) / precos.length;
        const minF = allResults.find((f: any) => f.preco === min);
        const maxF = allResults.find((f: any) => f.preco === max);

        const result: PesquisaMLResult = {
          produto: produtoId,
          data_pesquisa: new Date().toLocaleDateString('pt-BR'),
          categoria: 'Especificação Técnica',
          fornecedores: allResults,
          resumo: {
            menor_preco: min,
            maior_preco: max,
            preco_medio: Math.round(avg * 100) / 100,
            variacao: min > 0 ? `${(((max - min) / min) * 100).toFixed(1)}%` : '0%',
            fornecedor_menor: minF?.loja || '',
            fornecedor_maior: maxF?.loja || '',
            recomendacao: `Busca por especificação técnica: ${allResults.length} produtos encontrados para "${produtoId}".`,
          },
        };

        setAiParsedData(result);
        setAiResult(JSON.stringify(result));
        toast.success(`${allResults.length} produtos encontrados fiéis à especificação!`);
      } else {
        toast.warning('Nenhum produto compatível encontrado. Tente outra especificação.');
      }

      setIsSearchingAI(false);
    } catch (e) {
      console.error('Erro spec search:', e);
      toast.error('Erro ao processar especificação técnica.');
      setIsExtractingSpec(false);
      setIsSearchingAI(false);
    }
  };
  

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

  // Combined filter for all sidebar options
  const applyAllFilters = (fornecedores: any[]) => {
    return fornecedores.filter((f: any) => {
      // Category
      if (selectedCategory !== 'todos' && (f?.categoria || 'Outros') !== selectedCategory) return false;
      // Lojas
      if (filterLojas.length > 0 && !filterLojas.includes(f?.loja || '')) return false;
      // Marcas
      if (filterMarcas.length > 0 && !filterMarcas.includes(f?.marca || '')) return false;
      // Frete grátis
      if (filterFreteGratis) {
        const frete = (f?.frete || '').toLowerCase();
        const isFree = frete.includes('grátis') || frete.includes('gratis') || frete === '0' || frete === 'r$ 0,00';
        if (!isFree) return false;
      }
      // Condição
      if (filterCondicao !== 'todos' && (f?.condicao || 'Novo') !== filterCondicao) return false;
      // Preço mínimo
      const pMin = parseFloat(filterPrecoMin);
      if (!isNaN(pMin) && f?.preco < pMin) return false;
      // Preço máximo
      const pMax = parseFloat(filterPrecoMax);
      if (!isNaN(pMax) && f?.preco > pMax) return false;
      return true;
    });
  };

  // Derived: unique conditions from results
  const availableConditions = (() => {
    if (!aiParsedData) return [];
    const conds = new Set<string>();
    const results = Array.isArray(aiParsedData) ? aiParsedData : [aiParsedData];
    results.forEach((r: any) => r?.fornecedores?.forEach((f: any) => conds.add(f?.condicao || 'Novo')));
    return Array.from(conds).sort();
  })();

  // Derived: unique stores from results
  const availableLojas = (() => {
    if (!aiParsedData) return [] as { name: string; count: number }[];
    const counts: Record<string, number> = {};
    const results = Array.isArray(aiParsedData) ? aiParsedData : [aiParsedData];
    results.forEach((r: any) => r?.fornecedores?.forEach((f: any) => {
      const loja = f?.loja || 'Outros';
      counts[loja] = (counts[loja] || 0) + 1;
    }));
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();

  // Derived: unique brands from results
  const availableMarcas = (() => {
    if (!aiParsedData) return [] as { name: string; count: number }[];
    const counts: Record<string, number> = {};
    const results = Array.isArray(aiParsedData) ? aiParsedData : [aiParsedData];
    results.forEach((r: any) => r?.fornecedores?.forEach((f: any) => {
      const marca = f?.marca || 'Sem marca';
      counts[marca] = (counts[marca] || 0) + 1;
    }));
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();

  // Price range from results
  const priceRange = (() => {
    if (!aiParsedData) return { min: 0, max: 0 };
    const results = Array.isArray(aiParsedData) ? aiParsedData : [aiParsedData];
    const prices: number[] = [];
    results.forEach((r: any) => r?.fornecedores?.forEach((f: any) => { if (f?.preco) prices.push(f.preco); }));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  })();

  const resetAllFilters = () => {
    setSelectedCategory('todos');
    setFilterFreteGratis(false);
    setFilterCondicao('todos');
    setFilterPrecoMin('');
    setFilterPrecoMax('');
    setFilterLojas([]);
    setFilterMarcas([]);
  };

  const hasActiveFilters = selectedCategory !== 'todos' || filterFreteGratis || filterCondicao !== 'todos' || filterPrecoMin !== '' || filterPrecoMax !== '' || filterLojas.length > 0 || filterMarcas.length > 0;

  const toggleLojaFilter = (loja: string) => {
    setFilterLojas(prev => prev.includes(loja) ? prev.filter(l => l !== loja) : [...prev, loja]);
  };

  const toggleMarcaFilter = (marca: string) => {
    setFilterMarcas(prev => prev.includes(marca) ? prev.filter(m => m !== marca) : [...prev, marca]);
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

  // No longer needed - images come directly from real scraping

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
    resetAllFilters();
    setAiResult('');
    setAiParsedData(null);
    
    abortRef.current = false;

    try {
      // Use real marketplace scraping via Firecrawl
      const { data, error } = await supabase.functions.invoke('pesquisa-preco-real', {
        body: { termo: search },
      });

      if (error || !data?.success) {
        const errMsg = error?.message || data?.error || 'Erro na pesquisa';
        toast.error(errMsg);
        console.error('Erro pesquisa real:', error || data?.error);
        setIsSearchingAI(false);
        return;
      }

      const result = data.data as PesquisaMLResult;
      if (result && result.fornecedores?.length > 0) {
        setAiParsedData(result);
        setAiResult(JSON.stringify(result));
        toast.success(`${result.fornecedores.length} produtos encontrados em ${Object.keys(data.data.fontes_consultadas || {}).length} marketplaces!`);
      } else {
        toast.warning('Nenhum produto encontrado nos marketplaces. Tente outro termo.');
        setAiResult('');
      }
    } catch (e) {
      console.error('Erro pesquisa:', e);
      toast.error('Erro ao pesquisar nos marketplaces.');
    }

    setIsSearchingAI(false);
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

  const filtered = itensPesquisa.filter((item) =>
    item.descricao.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" />
              Precificação de Preços
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Pesquisa integrada com Mercado Livre, Google Shopping, Painel de Preços Gov.br e cotações de fornecedores
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto flex-shrink-0">
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar Preços
            </Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" size="sm">
              <BarChart3 className="w-4 h-4 mr-1" /> Gerar Relatório
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Itens Pesquisados', value: '0', icon: Package },
            { label: 'Fontes Consultadas', value: '0', icon: ShoppingCart },
            { label: 'Economia Potencial', value: '-', icon: TrendingDown, color: 'text-success' },
            { label: 'Última Atualização', value: '-', icon: RefreshCw },
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

        {/* Source Tabs */}
        <Tabs defaultValue="marketplaces" className="space-y-4">
          <TabsList className="bg-muted/50 flex-wrap h-auto">
            <TabsTrigger value="marketplaces" className="gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" /> Pesquisa de Preços
            </TabsTrigger>
            <TabsTrigger value="govbr" className="gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Painel Gov.br
            </TabsTrigger>
            <TabsTrigger value="cotacoes-listas" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Cotações & Listas
            </TabsTrigger>
            <TabsTrigger value="calculadora" className="gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Calculadoras
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="gap-1.5">
              <Package className="w-3.5 h-3.5" /> Catálogo
            </TabsTrigger>
            <TabsTrigger value="inteligencia" className="gap-1.5">
              <Bot className="w-3.5 h-3.5" /> Inteligência de Preços
            </TabsTrigger>
            <TabsTrigger value="extracao-itens" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Extração de Itens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marketplaces" className="space-y-4">
        {/* Integrated Platforms Banner */}
        {!aiParsedData && !isSearchingAI && !showHistory && (
          <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-success/5 border border-primary/15 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Plataformas e Marketplaces Integrados</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">+30 fontes</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Pesquisa em tempo real nos principais marketplaces e plataformas de e-commerce do Brasil.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: 'Marketplaces', items: ['Mercado Livre', 'Amazon', 'Shopee', 'AliExpress', 'Magazine Luiza', 'Americanas'], icon: ShoppingCart },
                { title: 'Varejo & Eletrônicos', items: ['KaBuM', 'Pichau', 'Terabyte', 'Fast Shop', 'Casas Bahia', 'Carrefour'], icon: Store },
                { title: 'E-commerce Platforms', items: ['Shopify', 'VTEX', 'Nuvemshop', 'Tray', 'Loja Integrada', 'WooCommerce'], icon: Globe },
                { title: 'Especializados', items: ['Leroy Merlin', 'MadeiraMadeira', 'Centauro', 'Netshoes', 'Havan', 'Colombo'], icon: Package },
              ].map((group) => (
                <div key={group.title} className="bg-card/80 rounded-lg border border-border/30 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <group.icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-semibold text-foreground">{group.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item) => (
                      <Badge key={item} variant="secondary" className="text-[9px] px-1.5 py-0.5 font-normal">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              <span>Preços reais extraídos via scraping • Cadastro unificado • Estoque sincronizado • Conformidade Lei 14.133/2021</span>
            </div>
          </div>
        )}

        {/* Simple Search */}
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
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Pesquisando...</>
            ) : (
              <><Search className="w-4 h-4 mr-1" /> BUSCAR</>
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

        {/* Planilha de Custos — Extração por IA */}
        <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Planilha de Custos — Extração por IA</h3>
            <Badge variant="outline" className="text-[10px] ml-auto">Upload + Extração + Cotação</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Envie o Edital, Termo de Referência ou Anexo e a IA extrairá automaticamente todos os itens em uma planilha editável. Use "Cotar Todos" para preencher valores automaticamente.
          </p>
          <PlanilhaCustosEdital />
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
            {/* Left Sidebar – ML Filters */}
            {aiParsedData && !isSearchingAI && (
              <div className="w-[230px] flex-shrink-0 hidden md:block">
                <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                  {/* Active filters summary */}
                  {hasActiveFilters && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center justify-between">
                      <span className="text-[11px] text-primary font-medium">Filtros ativos</span>
                      <button onClick={resetAllFilters} className="text-[10px] text-primary hover:underline">Limpar todos</button>
                    </div>
                  )}

                  {/* Categories */}
                  {categoryTree.subs.length > 0 && (
                    <div className="bg-card border border-border/40 rounded-lg p-3">
                      <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-primary" />
                        {categoryTree.main || 'Categorias'}
                      </h4>
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
                  )}

                  {/* Price Range */}
                  <div className="bg-card border border-border/40 rounded-lg p-3">
                    <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3 text-primary" />
                      Faixa de preço
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        placeholder={priceRange.min > 0 ? `${Math.floor(priceRange.min)}` : 'Mín'}
                        value={filterPrecoMin}
                        onChange={(e) => setFilterPrecoMin(e.target.value)}
                        className="h-7 text-xs px-2"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="number"
                        placeholder={priceRange.max > 0 ? `${Math.ceil(priceRange.max)}` : 'Máx'}
                        value={filterPrecoMax}
                        onChange={(e) => setFilterPrecoMax(e.target.value)}
                        className="h-7 text-xs px-2"
                      />
                    </div>
                    {(filterPrecoMin || filterPrecoMax) && (
                      <button onClick={() => { setFilterPrecoMin(''); setFilterPrecoMax(''); }} className="text-[10px] text-primary hover:underline mt-1.5">
                        Limpar preço
                      </button>
                    )}
                  </div>

                  {/* Condição */}
                  {availableConditions.length > 0 && (
                    <div className="bg-card border border-border/40 rounded-lg p-3">
                      <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-primary" />
                        Condição
                      </h4>
                      <ul className="space-y-0.5">
                        <li>
                          <button
                            onClick={() => setFilterCondicao('todos')}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                              filterCondicao === 'todos'
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted"
                            )}
                          >
                            {filterCondicao === 'todos' ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                            Todos
                          </button>
                        </li>
                        {availableConditions.map((cond) => (
                          <li key={cond}>
                            <button
                              onClick={() => setFilterCondicao(cond as any)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                                filterCondicao === cond
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-foreground hover:bg-muted"
                              )}
                            >
                              {filterCondicao === cond ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                              {cond}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Frete Grátis */}
                  <div className="bg-card border border-border/40 rounded-lg p-3">
                    <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-primary" />
                      Envio
                    </h4>
                    <button
                      onClick={() => setFilterFreteGratis(!filterFreteGratis)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                        filterFreteGratis
                          ? "bg-success/10 text-success font-semibold"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {filterFreteGratis ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                      Frete grátis
                    </button>
                  </div>

                  {/* Lojas */}
                  {availableLojas.length > 0 && (
                    <div className="bg-card border border-border/40 rounded-lg p-3">
                      <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Store className="w-3 h-3 text-primary" />
                        Lojas
                      </h4>
                      <ul className="space-y-0.5 max-h-[180px] overflow-y-auto">
                        {availableLojas.map((loja) => (
                          <li key={loja.name}>
                            <button
                              onClick={() => toggleLojaFilter(loja.name)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                                filterLojas.includes(loja.name)
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-foreground hover:bg-muted"
                              )}
                            >
                              {filterLojas.includes(loja.name) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                              <span className="truncate flex-1 text-left">{loja.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">({loja.count})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {filterLojas.length > 0 && (
                        <button onClick={() => setFilterLojas([])} className="text-[10px] text-primary hover:underline mt-1.5">
                          Limpar lojas
                        </button>
                      )}
                    </div>
                  )}

                  {/* Marcas */}
                  {availableMarcas.length > 0 && (
                    <div className="bg-card border border-border/40 rounded-lg p-3">
                      <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Award className="w-3 h-3 text-primary" />
                        Marcas
                      </h4>
                      <ul className="space-y-0.5 max-h-[180px] overflow-y-auto">
                        {availableMarcas.map((marca) => (
                          <li key={marca.name}>
                            <button
                              onClick={() => toggleMarcaFilter(marca.name)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                                filterMarcas.includes(marca.name)
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-foreground hover:bg-muted"
                              )}
                            >
                              {filterMarcas.includes(marca.name) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                              <span className="truncate flex-1 text-left">{marca.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">({marca.count})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {filterMarcas.length > 0 && (
                        <button onClick={() => setFilterMarcas([])} className="text-[10px] text-primary hover:underline mt-1.5">
                          Limpar marcas
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-sm">Resultados dos Marketplaces</h3>
                    {isSearchingAI && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
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
                    fornecedores: applyAllFilters(aiParsedData.fornecedores),
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
              <FileText className="w-4 h-4 mr-1" /> Ir para Proposta Comercial
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

          {/* Fontes de Pesquisa - integrado na aba de Pesquisa */}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Ver todas as fontes de pesquisa ({'>'}80 fontes cadastradas)
            </summary>
            <div className="mt-3">
              <FontesManager />
            </div>
          </details>
          </TabsContent>

          <TabsContent value="govbr">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
              <PainelPrecosGov />
            </div>
          </TabsContent>




          <TabsContent value="cotacoes-listas">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
              <CotacoesUnificado />
            </div>
          </TabsContent>

          <TabsContent value="calculadora">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
              <CalculadoraUnificada />
            </div>
          </TabsContent>

          <TabsContent value="catalogo">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
              <CatalogoPrecificados />
            </div>
          </TabsContent>

          <TabsContent value="inteligencia">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
              <InteligenciaUnificada />
            </div>
          </TabsContent>

          <TabsContent value="extracao-itens">
            <RevisaoItensExtraidos
              onAprovado={(itensAprovados) => {
                toast.success(`${itensAprovados.length} itens prontos para precificação!`);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
