import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import CabecalhoPagina from '@/components/shared/CabecalhoPagina';
import ProcessoContextoBanner from '@/components/shared/ProcessoContextoBanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  DollarSign, Search, ShoppingCart, TrendingDown,
  ExternalLink, RefreshCw, Package, Plus, FileText, Loader2, Bot,
  Save, History, Trash2, Eye, CalendarIcon,
  MapPin, Globe, ChevronRight, Tag, X, Truck, CheckSquare, Square, Store, Award,
  Building2, Sparkles, Calculator, FileSpreadsheet, ChevronDown
} from 'lucide-react';
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
import { REGIOES_ESTADOS } from '@/data/regioes-brasil';
import PainelPrecosGov from '@/components/precificacao/PainelPrecosGov';
import CalculadoraUnificada from '@/components/precificacao/CalculadoraUnificada';
import CatalogoPrecificados from '@/components/precificacao/CatalogoPrecificados';
import FontesManager from '@/components/precificacao/FontesManager';
import CotacoesUnificado from '@/components/precificacao/CotacoesUnificado';
import InteligenciaUnificada from '@/components/precificacao/InteligenciaUnificada';
import RevisaoItensExtraidos, { type ItemExtraido } from '@/components/precificacao/RevisaoItensExtraidos';
import EditalItensViewer from '@/components/precificacao/EditalItensViewer';
import PlanilhaCustosEdital, { type EstatisticasPlanilha } from '@/components/precificacao/PlanilhaCustosEdital';
import PrecoGraficos from '@/components/precificacao/PrecoGraficos';

import { useProcessoAtivo } from '@/hooks/useProcessoAtivo';
import AureliaPrecificacaoChat from '@/components/precificacao/AureliaPrecificacaoChat';

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

const fonteVariant: Record<string, 'warning' | 'info' | 'success'> = {
  'Mercado Livre': 'warning',
  'Google Shopping': 'info',
  SINAPI: 'success',
};


/**
 * As abas do módulo, declaradas uma vez só.
 *
 * Os rótulos são os do registro (`lib/navegacao/paginas.ts`, rota
 * `/precificacao`): título, descrição, ícone e trilha da tela saem de lá pelo
 * CabecalhoPagina, e a fila de abas acompanha o mesmo vocabulário. O `id` de
 * cada aba NÃO muda — é ele que viaja no `?tab=` dos links do workspace.
 *
 * `subtitulo` é a linha de contexto da aba ativa, logo abaixo da fila; não
 * concorre com o h1, que é um só e vem do registro.
 *
 * `usaLocalizacao` marca as duas únicas abas onde os filtros de região/estado/
 * cidade significam alguma coisa. Eles ficavam sempre visíveis, inclusive nas
 * cinco abas que os ignoram — três seletores oferecendo um recorte que não
 * seria aplicado.
 */
const PLATAFORMAS = [
  { titulo: 'Marketplaces', itens: ['Mercado Livre', 'Amazon', 'Shopee', 'AliExpress', 'Magazine Luiza', 'Americanas'] },
  { titulo: 'Varejo & Eletrônicos', itens: ['KaBuM', 'Pichau', 'Terabyte', 'Fast Shop', 'Casas Bahia', 'Carrefour'] },
  { titulo: 'E-commerce', itens: ['Shopify', 'VTEX', 'Nuvemshop', 'Tray', 'Loja Integrada', 'WooCommerce'] },
  { titulo: 'Especializados', itens: ['Leroy Merlin', 'MadeiraMadeira', 'Centauro', 'Netshoes', 'Havan', 'Colombo'] },
] as const;

const ABAS = [
  {
    id: 'extracao-itens',
    label: 'Itens do edital',
    icone: FileText,
    subtitulo: 'Itens extraídos do edital — lote, descrição, quantidade, unidade e valor — e a planilha de custos que nasce deles',
    usaLocalizacao: false,
  },
  {
    id: 'marketplaces',
    label: 'Marketplaces',
    icone: ShoppingCart,
    subtitulo: 'Preços praticados no varejo e em marketplaces, para sustentar a estimativa',
    usaLocalizacao: true,
  },
  {
    id: 'govbr',
    label: 'Preços gov',
    icone: Building2,
    subtitulo: 'Preços homologados em compras públicas — a referência que o pregoeiro consulta',
    usaLocalizacao: true,
  },
  {
    id: 'cotacoes-listas',
    label: 'Cotações',
    icone: FileSpreadsheet,
    subtitulo: 'Cotações formais de fornecedores, listas de compras e importação de planilhas',
    usaLocalizacao: false,
  },
  {
    id: 'calculadora',
    label: 'Calculadora',
    icone: Calculator,
    subtitulo: 'Produto com BDI, serviço de engenharia e serviço com mão de obra',
    usaLocalizacao: false,
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    icone: Package,
    subtitulo: 'O que já foi precificado, pronto para reaproveitar no próximo processo',
    usaLocalizacao: false,
  },
  {
    id: 'inteligencia',
    label: 'Inteligência',
    icone: Bot,
    subtitulo: 'Comparativo entre fontes e recomendações de precificação por IA',
    usaLocalizacao: false,
  },
  {
    // Fora do registro (ver relatório de migração): a precificação
    // conversacional com a AURÉLIA não tem aba declarada em paginas.ts.
    id: 'aurelia-cotar',
    label: 'Nova precificação',
    icone: Sparkles,
    subtitulo: 'Descreva o item do edital e a AURÉLIA busca cotações comparadas em tempo real',
    usaLocalizacao: false,
  },
] as const;

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
  const [searchParams] = useSearchParams();
  /**
   * Onde a tela abre: sempre na pesquisa de preços, salvo `?tab=` explícito.
   *
   * Cheguei a abrir em "Itens & Planilha" quando havia processo ativo. Por
   * decisão do dono do produto, a entrada é fixa — a porta do módulo não muda
   * de lugar conforme o contexto, e quem quer os itens tem o link direto do
   * workspace ("Edital / Itens", que traz o `?tab=`).
   */
  const tabInicial = ABAS.some((a) => a.id === searchParams.get('tab'))
    ? (searchParams.get('tab') as string)
    : 'marketplaces';
  const [abaAtiva, setAbaAtiva] = useState(tabInicial);
  const AbaAtual = ABAS.find((a) => a.id === abaAtiva) ?? ABAS[0];
  const { addItem, hasPending, pendingItems } = usePropostaCart();
  const abortRef = useRef(false);
  const { user } = useAuth();
  const { processoId } = useProcessoAtivo();
  const [processoMeta, setProcessoMeta] = useState({ numero: '', orgao: '' });
  // Números reais da planilha: alimentam os cartões do topo e decidem se as
  // entradas de extração aparecem (itens já vindos do processo as dispensam).
  const [statsPlanilha, setStatsPlanilha] = useState<EstatisticasPlanilha | null>(null);
  const itensNaPlanilha = statsPlanilha?.totalItens ?? 0;

  useEffect(() => {
    let ativo = true;

    if (!processoId || !user) {
      setProcessoMeta({ numero: '', orgao: '' });
      return;
    }

    supabase
      .from('licitacoes')
      .select('numero, orgao')
      .eq('id', processoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setProcessoMeta({
          numero: data?.numero || '',
          orgao: data?.orgao || '',
        });
      });

    return () => {
      ativo = false;
    };
  }, [processoId, user]);



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
        const resultJson = JSON.stringify(result);
        setAiResult(resultJson);
        toast.success(`${result.fornecedores.length} produtos encontrados em ${Object.keys(data.data.fontes_consultadas || {}).length} marketplaces!`);

        // Auto-arquivar pesquisa no histórico
        if (user) {
          supabase.from('pesquisas_preco').insert({
            user_id: user.id,
            termo_busca: search,
            categoria: 'todos',
            resultado: resultJson,
          }).then(({ error: saveErr }) => {
            if (!saveErr) console.log('Pesquisa auto-arquivada');
          });
        }
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
        {/* Declara SOBRE QUAL processo as ações desta tela agem */}
        <ProcessoContextoBanner />
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
        {/* ── Cabeçalho do módulo (identidade 12/09) ──
            Substitui a faixa navy com foto. Título, descrição, ícone e trilha
            vêm do registro (`lib/navegacao/paginas.ts`, rota /precificacao) —
            a tela não reescreve o que já está padronizado. A fila de abas fica
            no corpo do cabeçalho e, logo abaixo dela, a linha que diz o que a
            aba ativa faz: o contexto muda sem que a página ganhe um segundo h1.

            A barra de LOCALIZAÇÃO mora nos `filtros` do cabeçalho: só duas das
            abas recortam por região, e ficando dentro do bloco que muda
            com a aba o vínculo fica visível — quando a aba não usa
            localização, a barra some junto com o resto do contexto dela. */}
        <CabecalhoPagina
          acoes={
            <Button onClick={() => setAbaAtiva('calculadora')}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Nova composição
            </Button>
          }
          filtros={AbaAtual.usaLocalizacao ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                <span className="font-medium">Localização:</span>
              </div>
              <Select value={selectedRegiao} onValueChange={handleRegiaoChange}>
                <SelectTrigger aria-label="Região" className="w-full sm:w-[180px]">
                  <Globe className="w-4 h-4 mr-1 text-muted-foreground" aria-hidden="true" />
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
                <SelectTrigger aria-label="Estado" className="w-full sm:w-[200px]">
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
                <SelectTrigger aria-label="Cidade" className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as cidades</SelectItem>
                  {availableCidades.map((c, i) => (
                    <SelectItem key={`${i}-${c}`} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(selectedRegiao !== 'todos' || selectedEstado !== 'todos' || selectedCidade !== 'todos') && (
                <Button
                  variant="ghost"
                  onClick={() => { setSelectedRegiao('todos'); setSelectedEstado('todos'); setSelectedCidade('todos'); }}
                >
                  Limpar
                </Button>
              )}
            </>
          ) : undefined}
        >
          <div className="space-y-2">
            <TabsList>
              {ABAS.map((aba) => (
                <TabsTrigger key={aba.id} value={aba.id} className="gap-2">
                  <aba.icone className="w-4 h-4" aria-hidden="true" /> {aba.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="text-sm leading-5 text-muted-foreground">{AbaAtual.subtitulo}</p>
          </div>
        </CabecalhoPagina>

          <TabsContent value="marketplaces" className="space-y-4">
        {/* ML-style Category Breadcrumb */}
        {categoryTree.subs.length > 0 && selectedCategory !== 'todos' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSelectedCategory('todos')}>
              {categoryTree.main || 'Resultados'}
            </Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-foreground font-medium">{selectedCategory}</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" aria-label="Remover filtro de categoria" onClick={() => setSelectedCategory('todos')}>
              <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          </div>
        )}

        {/* As trinta marcas viravam um mural: quatro cartões, trinta etiquetas e
            um selo de conformidade ocupando a primeira tela inteira, todo dia,
            para dizer algo que só se lê uma vez. Vira uma linha; quem quiser a
            lista abre. */}
        {!aiParsedData && !isSearchingAI && !showHistory && (
          <details className="group rounded-lg border border-border bg-muted px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground">
              <Globe className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Pesquisa em tempo real em <strong className="font-semibold text-foreground">+30 marketplaces e varejistas</strong></span>
              <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 border-t border-border pt-3">
              {PLATAFORMAS.map((grupo) => (
                <div key={grupo.titulo}>
                  <p className="text-xs font-semibold text-foreground mb-0.5">{grupo.titulo}</p>
                  <p className="text-xs text-muted-foreground">{grupo.itens.join(' · ')}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Simple Search */}
        <div className="flex flex-wrap gap-2 w-full max-w-2xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label="Produto a pesquisar"
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
            className="min-w-[120px]"
          >
            {isSearchingAI ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Pesquisando...</>
            ) : (
              <><Search className="w-4 h-4" aria-hidden="true" /> Buscar</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="min-w-[120px]"
            aria-expanded={showHistory}
          >
            <History className="w-4 h-4" aria-hidden="true" /> Histórico
          </Button>
        </div>


        {/* Saved Searches History */}
        {showHistory && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Pesquisas Salvas</h3>
              {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />}
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
                  <div key={item.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border hover:bg-muted transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.termo_busca}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.categoria !== 'todos' && <Badge variant="muted" className="mr-2">{item.categoria}</Badge>}
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="ghost" onClick={() => handleViewSearch(item)} title="Visualizar" aria-label={`Visualizar pesquisa ${item.termo_busca}`}>
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteSearch(item.id)} title="Excluir" aria-label={`Excluir pesquisa ${item.termo_busca}`} className="text-destructive hover:text-destructive hover:bg-destructive-tint">
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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
          <div className="flex gap-6">
            {/* Left Sidebar – ML Filters */}
            {aiParsedData && !isSearchingAI && (
              <div className="w-[230px] flex-shrink-0 hidden md:block">
                <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                  {/* Active filters summary */}
                  {hasActiveFilters && (
                    <div className="bg-muted border border-border rounded-lg p-3 flex items-center justify-between">
                      <span className="text-xs text-foreground font-medium">Filtros ativos</span>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={resetAllFilters}>Limpar todos</Button>
                    </div>
                  )}

                  {/* Categories */}
                  {categoryTree.subs.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                        {categoryTree.main || 'Categorias'}
                      </h4>
                      <ul className="space-y-0.5">
                        <li>
                          <Button variant="ghost" type="button"
                            onClick={() => setSelectedCategory('todos')}
                            className={cn(
                              "h-auto w-full justify-between px-2 py-1.5 text-xs font-normal",
                              selectedCategory === 'todos'
                                ? "bg-primary-tint text-primary font-semibold hover:bg-primary-tint hover:text-primary"
                                : "text-foreground"
                            )}
                          >
                            <span>Todas</span>
                            <span className="text-xs text-muted-foreground">({categoryTree.total})</span>
                          </Button>
                        </li>
                        {categoryTree.subs.map((sub) => (
                          <li key={sub.name}>
                            <Button variant="ghost" type="button"
                              onClick={() => setSelectedCategory(sub.name)}
                              className={cn(
                                "h-auto w-full justify-between px-2 py-1.5 text-xs font-normal",
                                selectedCategory === sub.name
                                  ? "bg-primary-tint text-primary font-semibold hover:bg-primary-tint hover:text-primary"
                                  : "text-foreground"
                              )}
                            >
                              <span className="truncate">{sub.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({sub.count})</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Price Range */}
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      Faixa de preço
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        placeholder={priceRange.min > 0 ? `${Math.floor(priceRange.min)}` : 'Mín'}
                        value={filterPrecoMin}
                        onChange={(e) => setFilterPrecoMin(e.target.value)}
                        className="h-9 text-sm px-2 tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="number"
                        placeholder={priceRange.max > 0 ? `${Math.ceil(priceRange.max)}` : 'Máx'}
                        value={filterPrecoMax}
                        onChange={(e) => setFilterPrecoMax(e.target.value)}
                        className="h-9 text-sm px-2 tabular-nums"
                      />
                    </div>
                    {(filterPrecoMin || filterPrecoMax) && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-2" onClick={() => { setFilterPrecoMin(''); setFilterPrecoMax(''); }}>
                        Limpar preço
                      </Button>
                    )}
                  </div>

                  {/* Condição */}
                  {availableConditions.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        Condição
                      </h4>
                      <ul className="space-y-0.5">
                        <li>
                          <Button variant="ghost" type="button"
                            onClick={() => setFilterCondicao('todos')}
                            className={cn(
                              "h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs font-normal",
                              filterCondicao === 'todos'
                                ? "bg-primary-tint text-primary font-semibold hover:bg-primary-tint hover:text-primary"
                                : "text-foreground"
                            )}
                          >
                            {filterCondicao === 'todos' ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                            Todos
                          </Button>
                        </li>
                        {availableConditions.map((cond) => (
                          <li key={cond}>
                            <Button variant="ghost" type="button"
                              onClick={() => setFilterCondicao(cond as any)}
                              className={cn(
                                "h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs font-normal",
                                filterCondicao === cond
                                  ? "bg-primary-tint text-primary font-semibold hover:bg-primary-tint hover:text-primary"
                                  : "text-foreground"
                              )}
                            >
                              {filterCondicao === cond ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                              {cond}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Frete Grátis */}
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-muted-foreground" />
                      Envio
                    </h4>
                    <Button variant="ghost" type="button"
                      onClick={() => setFilterFreteGratis(!filterFreteGratis)}
                      className={cn(
                        "h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs font-normal",
                        filterFreteGratis
                          ? "bg-success-tint text-success-ink font-semibold hover:bg-success-tint hover:text-success-ink"
                          : "text-foreground"
                      )}
                    >
                      {filterFreteGratis ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                      Frete grátis
                    </Button>
                  </div>

                  {/* Lojas */}
                  {availableLojas.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Store className="w-3 h-3 text-muted-foreground" />
                        Lojas
                      </h4>
                      <ul className="space-y-0.5 max-h-[180px] overflow-y-auto">
                        {availableLojas.map((loja) => (
                          <li key={loja.name}>
                            <Button variant="ghost" type="button"
                              onClick={() => toggleLojaFilter(loja.name)}
                              className={cn(
                                "h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs font-normal",
                                filterLojas.includes(loja.name)
                                  ? "bg-primary-tint text-primary font-semibold hover:bg-primary-tint hover:text-primary"
                                  : "text-foreground"
                              )}
                            >
                              {filterLojas.includes(loja.name) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                              <span className="truncate flex-1 text-left">{loja.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({loja.count})</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                      {filterLojas.length > 0 && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-2" onClick={() => setFilterLojas([])}>
                          Limpar lojas
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Marcas */}
                  {availableMarcas.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Award className="w-3 h-3 text-muted-foreground" />
                        Marcas
                      </h4>
                      <ul className="space-y-0.5 max-h-[180px] overflow-y-auto">
                        {availableMarcas.map((marca) => (
                          <li key={marca.name}>
                            <Button variant="ghost" type="button"
                              onClick={() => toggleMarcaFilter(marca.name)}
                              className={cn(
                                "h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs font-normal",
                                filterMarcas.includes(marca.name)
                                  ? "bg-primary-tint text-primary font-semibold hover:bg-primary-tint hover:text-primary"
                                  : "text-foreground"
                              )}
                            >
                              {filterMarcas.includes(marca.name) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-muted-foreground" />}
                              <span className="truncate flex-1 text-left">{marca.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({marca.count})</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                      {filterMarcas.length > 0 && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-2" onClick={() => setFilterMarcas([])}>
                          Limpar marcas
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results Content */}
            <div className="flex-1 min-w-0">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-lg font-semibold">Resultados dos Marketplaces</h3>
                    {isSearchingAI && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                  </div>
                  {aiResult && !isSearchingAI && (
                    <Button variant="outline" onClick={handleSaveSearch}>
                      <Save className="w-4 h-4" aria-hidden="true" /> Salvar Pesquisa
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
                  licitacaoId={processoId}
                  licitacaoNumero={processoMeta.numero}
                  licitacaoOrgao={processoMeta.orgao}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pending items banner */}
        {hasPending && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-primary-tint border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-primary" aria-hidden="true" />
              <span><strong>{pendingItems.length}</strong> {pendingItems.length === 1 ? 'item adicionado' : 'itens adicionados'} à proposta</span>
            </div>
            <Button onClick={() => navigate('/proposta-tecnica')}>
              <FileText className="w-4 h-4" aria-hidden="true" /> Ir para Proposta Comercial
            </Button>
          </div>
        )}
        {/* Items */}
        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              {/* Item header */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border">
                <div>
                  <p className="font-semibold text-sm">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantidade} {item.unidade}(s) · Preço médio: {formatCurrency(item.precoMedio)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right tabular-nums">
                    <p className="text-muted-foreground">Mínimo</p>
                    <p className="font-semibold text-success">{formatCurrency(item.precoMin)}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-muted-foreground">Máximo</p>
                    <p className="font-semibold text-destructive">{formatCurrency(item.precoMax)}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-muted-foreground">Total Estimado</p>
                    <p className="font-bold">{formatCurrency(item.precoMedio * item.quantidade)}</p>
                  </div>
                </div>
              </div>

              {/* Fontes */}
              <div className="divide-y divide-border">
                {item.fontes.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={fonteVariant[f.fonte] || 'muted'}>
                        {f.fonte}
                      </Badge>
                      <span className="text-sm">{f.vendedor}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(f.preco)}</span>
                      {f.frete !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          Frete: {f.frete === 0 ? 'Grátis' : formatCurrency(f.frete)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.atualizado).toLocaleDateString('pt-BR')}
                      </span>
                      {f.preco === item.precoMin && (
                        <Badge variant="success">
                          Menor preço
                        </Badge>
                      )}
                      <Button size="sm" variant="ghost" aria-label={`Abrir anúncio em ${f.fonte}`}>
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddToProposta(item, f.preco)} title="Adicionar à Proposta Técnica">
                        <Plus className="w-4 h-4" aria-hidden="true" /> Proposta
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
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Globe className="w-4 h-4" aria-hidden="true" />
              Ver todas as fontes de pesquisa ({'>'}80 fontes cadastradas)
            </summary>
            <div className="mt-3">
              <FontesManager />
            </div>
          </details>
          </TabsContent>

          <TabsContent value="govbr">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <PainelPrecosGov ufInicial={selectedEstado} municipioInicial={selectedCidade} />
            </div>
          </TabsContent>




          <TabsContent value="cotacoes-listas">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <CotacoesUnificado />
            </div>
          </TabsContent>

          <TabsContent value="calculadora">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <CalculadoraUnificada
                licitacaoId={processoId}
                licitacaoNumero={processoMeta.numero}
                licitacaoOrgao={processoMeta.orgao}
              />
            </div>
          </TabsContent>

          <TabsContent value="catalogo">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <CatalogoPrecificados
                licitacaoId={processoId}
                licitacaoNumero={processoMeta.numero}
                licitacaoOrgao={processoMeta.orgao}
              />
            </div>
          </TabsContent>

          <TabsContent value="inteligencia">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <InteligenciaUnificada />
            </div>
          </TabsContent>

          <TabsContent value="aurelia-cotar" className="flex-1 min-h-0">
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: 500 }}>
              <AureliaPrecificacaoChat />
            </div>
          </TabsContent>

          {/* Itens & Planilha: uma aba só para `licitacao_itens`.
              A planilha morava dentro de "Pesquisa de Preços" e lia a MESMA
              tabela que o visualizador de itens desta aba — duas telas, dois
              formatos, um dado só. Quem editava numa não via a outra mudar. */}
          <TabsContent value="extracao-itens" className="space-y-4">
            {/* Os quatro cartões só existem quando há o que contar.
                Vazios eles liam "0 / 0 / — / 09:56" — três nadas e um relógio. E o
                relógio era o pior: mostrava a hora de uma cotação que nunca houve,
                dando ao usuário a impressão de que o sistema acabara de atualizar
                preços. Os números nascem da planilha, então vivem na aba dela. */}
            {itensNaPlanilha > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Itens Pesquisados',
                    value: statsPlanilha ? `${statsPlanilha.itensPesquisados}${statsPlanilha.totalItens ? `/${statsPlanilha.totalItens}` : ''}` : '—',
                    icon: Package,
                  },
                  {
                    label: 'Fontes Consultadas',
                    value: statsPlanilha ? String(statsPlanilha.fontesConsultadas) : '—',
                    icon: ShoppingCart,
                  },
                  {
                    label: 'Economia Potencial',
                    value: statsPlanilha && statsPlanilha.economia > 0
                      ? statsPlanilha.economia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                      : '—',
                    icon: TrendingDown,
                    color: 'text-success',
                  },
                  {
                    label: 'Última Atualização',
                    value: statsPlanilha?.atualizadoEm
                      ? statsPlanilha.atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '—',
                    icon: RefreshCw,
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <s.icon className={cn('w-4 h-4', s.color || 'text-muted-foreground')} aria-hidden="true" />
                    </div>
                    <p className="text-[2rem] leading-10 font-bold whitespace-nowrap tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* REBRAND — os dois gráficos do protótipo. Mesma condição dos cartões
                acima: só existem quando há planilha com o que medir. Leem o detalhe
                que a varredura da planilha já produzia e ninguém via. */}
            {itensNaPlanilha > 0 && statsPlanilha && (
              <PrecoGraficos stats={statsPlanilha} />
            )}

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <EditalItensViewer licitacaoId={processoId ?? null} />
            </div>
          {/* Planilha de Custos — Extração por IA */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Planilha de Custos — Extração por IA</h3>
              <Badge variant="muted" className="ml-auto">Upload + Extração + Cotação</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Preencha os custos e use "Cotar Todos" para buscar valores automaticamente nas fontes de pesquisa.
            </p>
            {/* O convite a extrair saía daqui e do vazio do EditalItensViewer logo
                acima — dois botões "extrair automaticamente" empilhados na mesma
                tela, disputando o mesmo clique. Fica o de cima, que é quem manda
                na lista de itens. */}
            <PlanilhaCustosEdital
              onItensStatus={setStatsPlanilha}
              licitacaoId={processoId}
              licitacaoNumero={processoMeta.numero}
              licitacaoOrgao={processoMeta.orgao}
            />
          </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
