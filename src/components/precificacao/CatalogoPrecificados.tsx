import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, Search, Trash2, FileText, Filter, Loader2, ShoppingCart, Plus, Sparkles, Globe, Upload, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { streamAIChat } from '@/lib/ai-stream';
import CatalogoDocGenerator from './CatalogoDocGenerator';

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_LABELS: Record<string, string> = {
  produto: 'Produto',
  produto_bdi: 'Produto + BDI',
  servico_simples: 'Serviço Simples',
  servico_composicao: 'Composição BDI',
  servico_mdo: 'Serviço MDO',
};

interface CatalogoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  custo_unitario: number;
  preco_unitario: number;
  preco_total: number;
  margem_lucro: number | null;
  tributos_total: number | null;
  bdi_percentual: number | null;
  tipo_calculo: string;
  regime_tributario: string | null;
  licitacao_id: string | null;
  licitacao_numero: string | null;
  licitacao_orgao: string | null;
  created_at: string;
}

export default function CatalogoPrecificados() {
  const { user } = useAuth();
  const { addItem } = usePropostaCart();
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterLicitacao, setFilterLicitacao] = useState('todos');
  const [licitacoes, setLicitacoes] = useState<{ id: string; numero: string; orgao: string }[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDocGenerator, setShowDocGenerator] = useState(false);

  // ── Consulta Inteligente (AI search) ──
  const [showConsulta, setShowConsulta] = useState(false);
  const [consultaTexto, setConsultaTexto] = useState('');
  const [consultaFile, setConsultaFile] = useState<File | null>(null);
  const [isConsulting, setIsConsulting] = useState(false);
  const [consultaResults, setConsultaResults] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('catalogo_itens_precificados')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar catálogo');
    } else {
      setItems((data || []) as CatalogoItem[]);
      const lics = new Map<string, { id: string; numero: string; orgao: string }>();
      (data || []).forEach((item: any) => {
        if (item.licitacao_numero) {
          const key = item.licitacao_numero;
          if (!lics.has(key)) {
            lics.set(key, { id: item.licitacao_id || '', numero: item.licitacao_numero, orgao: item.licitacao_orgao || '' });
          }
        }
      });
      setLicitacoes(Array.from(lics.values()));
    }
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, [user]);

  const filteredItems = items.filter(item => {
    if (searchTerm && !item.descricao.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterTipo !== 'todos' && item.tipo_calculo !== filterTipo) return false;
    if (filterLicitacao !== 'todos' && item.licitacao_numero !== filterLicitacao) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('catalogo_itens_precificados').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Item removido do catálogo');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(filteredItems.map(i => i.id)));
  };

  const enviarSelecionados = () => {
    const selected = filteredItems.filter(i => selectedItems.has(i.id));
    if (selected.length === 0) { toast.error('Selecione ao menos um item'); return; }
    selected.forEach((item, idx) => {
      addItem({
        item: String(idx + 1), descricao: item.descricao,
        quantidade: String(item.quantidade), unidade: item.unidade,
        marca: item.marca || '', fabricante: item.fabricante || '', modelo: item.modelo || '',
        valorUnitario: item.preco_unitario.toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(item.preco_unitario),
        valorTotal: item.preco_total.toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(item.preco_total),
      });
    });
    toast.success(`${selected.length} item(ns) enviado(s) para a Proposta Comercial!`);
    setSelectedItems(new Set());
  };

  // ── Consulta Inteligente: extract items from edital and search internet ──
  const handleConsultaInteligente = async () => {
    let textoBase = consultaTexto.trim();

    if (consultaFile && !textoBase) {
      try {
        const reader = new FileReader();
        textoBase = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(consultaFile);
        });
      } catch {
        toast.error('Erro ao ler arquivo.');
        return;
      }
    }

    if (!textoBase) {
      toast.error('Cole o objeto do edital ou faça upload do documento.');
      return;
    }

    setIsConsulting(true);
    setConsultaResults([]);

    try {
      // Step 1: Extract items from edital text via AI
      let extractedJson = '';
      await streamAIChat({
        messages: [{ role: 'user', content: textoBase }],
        action: 'extrair-itens-edital-catalogo',
        context: `Você é especialista em licitações públicas. Analise o texto do edital/objeto abaixo e extraia TODOS os itens/produtos/serviços mencionados.

Para CADA item, gere um termo de busca otimizado para pesquisa em marketplaces.

Responda APENAS em JSON:
{
  "itens": [
    {
      "item": 1,
      "descricao": "descrição original do edital",
      "quantidade": 1,
      "unidade": "UN",
      "termo_busca": "termo otimizado para pesquisa de mercado",
      "categoria": "categoria do produto/serviço"
    }
  ],
  "orgao": "nome do órgão se identificável",
  "numero_licitacao": "número do processo se identificável"
}`,
        onDelta: (d) => { extractedJson += d; },
        onDone: () => {},
        onError: (err) => { toast.error('Erro na extração: ' + err); },
      });

      let clean = extractedJson.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      const parsed = JSON.parse(clean);
      const itensExtraidos = parsed.itens || [];

      if (itensExtraidos.length === 0) {
        toast.error('Nenhum item identificado no texto.');
        setIsConsulting(false);
        return;
      }

      toast.success(`${itensExtraidos.length} itens identificados. Pesquisando preços...`);

      // Step 2: Search prices for each item (max 5 in parallel)
      const searchPromises = itensExtraidos.slice(0, 10).map(async (item: any) => {
        try {
          const { data, error } = await supabase.functions.invoke('pesquisa-preco-real', {
            body: { termo: item.termo_busca },
          });
          if (!error && data?.success && data.data?.fornecedores?.length > 0) {
            const fornecedores = data.data.fornecedores;
            const precos = fornecedores.map((f: any) => f.preco).filter((p: number) => p > 0);
            const precoMedio = precos.length > 0 ? precos.reduce((a: number, b: number) => a + b, 0) / precos.length : 0;
            const precoMin = precos.length > 0 ? Math.min(...precos) : 0;
            return {
              ...item,
              preco_medio: Math.round(precoMedio * 100) / 100,
              preco_min: Math.round(precoMin * 100) / 100,
              preco_max: precos.length > 0 ? Math.round(Math.max(...precos) * 100) / 100 : 0,
              fontes: fornecedores.length,
              found: true,
              orgao: parsed.orgao || '',
              numero_licitacao: parsed.numero_licitacao || '',
            };
          }
          return { ...item, preco_medio: 0, preco_min: 0, preco_max: 0, fontes: 0, found: false };
        } catch {
          return { ...item, preco_medio: 0, preco_min: 0, preco_max: 0, fontes: 0, found: false };
        }
      });

      const results = await Promise.allSettled(searchPromises);
      const finalResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      setConsultaResults(finalResults);
      const found = finalResults.filter(r => r.found).length;
      toast.success(`Pesquisa concluída: ${found}/${finalResults.length} itens cotados.`);
    } catch (e) {
      console.error('Erro consulta inteligente:', e);
      toast.error('Erro ao processar consulta.');
    }

    setIsConsulting(false);
  };

  const salvarResultadosNoCatalogo = async () => {
    if (!user) { toast.error('Faça login'); return; }
    const cotados = consultaResults.filter(r => r.found && r.preco_medio > 0);
    if (cotados.length === 0) { toast.error('Nenhum item cotado para salvar'); return; }

    const rows = cotados.map(r => ({
      user_id: user.id,
      tipo_calculo: 'produto',
      descricao: r.descricao,
      quantidade: r.quantidade || 1,
      unidade: r.unidade || 'UN',
      custo_unitario: r.preco_min || r.preco_medio,
      preco_unitario: r.preco_medio,
      preco_total: r.preco_medio * (r.quantidade || 1),
      licitacao_numero: r.numero_licitacao || null,
      licitacao_orgao: r.orgao || null,
    }));

    const { error } = await supabase.from('catalogo_itens_precificados').insert(rows);
    if (error) {
      toast.error('Erro ao salvar no catálogo');
      console.error(error);
    } else {
      toast.success(`${rows.length} itens salvos no catálogo!`);
      setConsultaResults([]);
      setShowConsulta(false);
      loadItems();
    }
  };

  const totalSelecionado = filteredItems
    .filter(i => selectedItems.has(i.id))
    .reduce((s, i) => s + i.preco_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-5 h-5 text-accent flex-shrink-0" />
          <h3 className="font-semibold text-xs sm:text-sm whitespace-nowrap">Catálogo de Itens Precificados</h3>
          <Badge variant="outline" className="text-[10px]">{items.length} itens</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => {
            const sel = filteredItems.filter(i => selectedItems.has(i.id));
            if (sel.length === 0 && items.length > 0) {
              setShowDocGenerator(true);
            } else if (sel.length > 0) {
              setShowDocGenerator(true);
            } else {
              toast.error('Nenhum item no catálogo.');
            }
          }} variant="outline" className="border-accent/30 text-accent hover:bg-accent/10 text-xs">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Ficha / Folder
          </Button>
          <Button size="sm" onClick={() => setShowConsulta(!showConsulta)} variant={showConsulta ? 'default' : 'outline'}
            className={showConsulta ? 'bg-accent hover:bg-accent/90 text-accent-foreground text-xs' : 'text-xs'}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Consulta IA
          </Button>
          <Button size="sm" onClick={loadItems} variant="outline" disabled={loading} className="text-xs">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span className="ml-1">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* ── Consulta Inteligente Panel ── */}
      {showConsulta && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent" />
            <h4 className="font-semibold text-sm">Consulta Inteligente — Extração de Itens do Edital</h4>
            <Badge variant="outline" className="text-[10px] ml-auto">IA + Pesquisa Real</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole o objeto do edital ou faça upload do documento. A IA extrairá os itens e pesquisará preços reais na internet para montar seu catálogo de referência.
          </p>

          <Textarea
            placeholder="Cole aqui o objeto da licitação ou lista de itens do edital...&#10;&#10;Ex: Aquisição de material de expediente, incluindo 500 resmas de papel A4 75g, 200 canetas esferográficas azuis..."
            value={consultaTexto}
            onChange={e => setConsultaTexto(e.target.value)}
            className="min-h-[100px] text-sm"
          />

          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => setConsultaFile(e.target.files?.[0] || null)} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" />
              {consultaFile ? consultaFile.name : 'Upload Edital'}
            </Button>
            {consultaFile && (
              <Button variant="ghost" size="sm" onClick={() => { setConsultaFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                ✕ Remover
              </Button>
            )}
            <div className="ml-auto">
              <Button
                onClick={handleConsultaInteligente}
                disabled={isConsulting || (!consultaTexto.trim() && !consultaFile)}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isConsulting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Pesquisando...</> : <><Search className="w-4 h-4 mr-1" /> Extrair e Cotar</>}
              </Button>
            </div>
          </div>

          {/* Results */}
          {consultaResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{consultaResults.filter(r => r.found).length} de {consultaResults.length} itens cotados</span>
                <Button size="sm" onClick={salvarResultadosNoCatalogo} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Salvar Todos no Catálogo
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold h-8">Item</TableHead>
                      <TableHead className="text-[10px] font-semibold h-8">Descrição</TableHead>
                      <TableHead className="text-[10px] font-semibold h-8 text-center">Qtd</TableHead>
                      <TableHead className="text-[10px] font-semibold h-8 text-right">Preço Mín.</TableHead>
                      <TableHead className="text-[10px] font-semibold h-8 text-right">Preço Médio</TableHead>
                      <TableHead className="text-[10px] font-semibold h-8 text-right">Preço Máx.</TableHead>
                      <TableHead className="text-[10px] font-semibold h-8 text-center">Fontes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultaResults.map((r, i) => (
                      <TableRow key={i} className={r.found ? '' : 'opacity-50'}>
                        <TableCell className="text-xs py-1.5">{r.item}</TableCell>
                        <TableCell className="text-xs py-1.5 max-w-[250px] truncate">{r.descricao}</TableCell>
                        <TableCell className="text-xs py-1.5 text-center">{r.quantidade}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right">{r.found ? formatCurrency(r.preco_min) : '—'}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right font-medium">{r.found ? formatCurrency(r.preco_medio) : '—'}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right">{r.found ? formatCurrency(r.preco_max) : '—'}</TableCell>
                        <TableCell className="text-xs py-1.5 text-center">
                          <Badge variant={r.found ? 'default' : 'outline'} className="text-[9px]">
                            {r.fontes}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar no catálogo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px] h-9">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="produto">Produtos</SelectItem>
            <SelectItem value="produto_bdi">Produtos + BDI</SelectItem>
            <SelectItem value="servico_mdo">Serviços MDO</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLicitacao} onValueChange={setFilterLicitacao}>
          <SelectTrigger className="w-[220px] h-9">
            <FileText className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="Licitação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as licitações</SelectItem>
            {licitacoes.map(l => (
              <SelectItem key={l.numero} value={l.numero}>
                {l.numero} — {l.orgao?.slice(0, 30) || 'S/N'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selection actions */}
      {selectedItems.size > 0 && (
        <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-lg px-4 py-2.5">
          <span className="text-xs font-medium">
            {selectedItems.size} item(ns) selecionado(s) · Total: {formatCurrency(totalSelecionado)}
          </span>
          <Button size="sm" onClick={enviarSelecionados} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta Comercial
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum item no catálogo.</p>
          <p className="text-xs mt-1">Use as calculadoras ou a Consulta Inteligente para adicionar itens.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <input type="checkbox" checked={selectedItems.size === filteredItems.length && filteredItems.length > 0} onChange={selectAll} className="rounded border-border" />
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Descrição</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-center">Qtd</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-center">Und</TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Marca</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-right">Custo Unit.</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-right">Preço Unit.</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 text-right">Total</TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Tipo</TableHead>
                <TableHead className="text-[10px] font-semibold h-8">Licitação</TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map(item => (
                <TableRow key={item.id} className={selectedItems.has(item.id) ? 'bg-accent/5' : ''}>
                  <TableCell className="py-1.5">
                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded border-border" />
                  </TableCell>
                  <TableCell className="text-xs py-1.5 max-w-[250px]">
                    <div className="flex items-center gap-2">
                      {(item as any).detalhes?.image_url && (
                        <img
                          src={(item as any).detalhes.image_url}
                          alt=""
                          className="w-10 h-10 object-contain rounded border border-border/30 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <span className="truncate">{item.descricao}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-center">{item.quantidade}</TableCell>
                  <TableCell className="text-xs py-1.5 text-center">{item.unidade}</TableCell>
                  <TableCell className="text-xs py-1.5">{item.marca || '—'}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">{formatCurrency(item.custo_unitario)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-medium">{formatCurrency(item.preco_unitario)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-semibold text-accent">{formatCurrency(item.preco_total)}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className="text-[9px]">
                      {TIPO_LABELS[item.tipo_calculo] || item.tipo_calculo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] py-1.5 max-w-[120px] truncate text-muted-foreground">
                    {item.licitacao_numero || '—'}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredItems.length} itens exibidos</span>
          <span className="font-medium text-foreground">
            Total: {formatCurrency(filteredItems.reduce((s, i) => s + i.preco_total, 0))}
          </span>
        </div>
      )}

      {/* Doc Generator Dialog */}
      <CatalogoDocGenerator
        open={showDocGenerator}
        onOpenChange={setShowDocGenerator}
        items={(() => {
          const sel = filteredItems.filter(i => selectedItems.has(i.id));
          return (sel.length > 0 ? sel : filteredItems).map(i => ({
            id: i.id,
            descricao: i.descricao,
            marca: i.marca,
            fabricante: i.fabricante,
            modelo: i.modelo,
            unidade: i.unidade,
            quantidade: i.quantidade,
          }));
        })()}
      />
    </div>
  );
}
