import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import {
  Search, BookOpen, FileText, Download, Copy, Sparkles, Loader2,
  MessageSquare, FileWarning, Gavel, ArrowUpDown, ShieldQuestion,
  Calculator, Filter, X, TrendingUp, Users, ChevronDown, ChevronUp,
  Scale, SlidersHorizontal
} from 'lucide-react';

/* ── Types ── */
type Modelo = {
  id: string; titulo: string; categoria: string; descricao: string;
  icon: typeof FileText; fundamentacao: string;
  requisitosFiltro: ('indices' | 'ccts' | 'base_juridica' | 'contrato')[];
};

type DocRef = { id: string; titulo: string; tipo: string; ementa: string | null; texto_integral: string | null };
type Indice = { id: string; nome: string; sigla: string; valor: number; variacao_mensal: number | null; acumulado_12m: number | null; periodo: string; fonte: string };
type CCT = { id: string; categoria_profissional: string; piso_salarial: number | null; reajuste_percentual: number | null; indice_reajuste: string | null; vigencia_inicio: string | null; vigencia_fim: string | null; sindicato_laboral: string | null; abrangencia_uf: string | null };

/* ── Data ── */
const modelos: Modelo[] = [
  { id: '1', titulo: 'Pedido de Esclarecimento', categoria: 'Esclarecimentos', descricao: 'Solicitar esclarecimentos sobre termos ambíguos do edital', icon: MessageSquare, fundamentacao: 'Art. 164 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '2', titulo: 'Impugnação ao Edital', categoria: 'Impugnações', descricao: 'Contestar cláusulas restritivas ou ilegais do edital', icon: FileWarning, fundamentacao: 'Art. 164 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '3', titulo: 'Recurso Administrativo', categoria: 'Recursos', descricao: 'Recurso contra decisão de habilitação ou julgamento', icon: Gavel, fundamentacao: 'Art. 165 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '4', titulo: 'Contrarrazões de Recurso', categoria: 'Recursos', descricao: 'Resposta ao recurso interposto por outro licitante', icon: ArrowUpDown, fundamentacao: 'Art. 165, §3º da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '5', titulo: 'Pedido de Reconsideração', categoria: 'Recursos', descricao: 'Reconsideração de penalidades aplicadas', icon: ShieldQuestion, fundamentacao: 'Art. 166 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '6', titulo: 'Recurso Hierárquico', categoria: 'Recursos', descricao: 'Recurso à autoridade superior quando pedido de reconsideração indeferido', icon: ArrowUpDown, fundamentacao: 'Art. 167 da Lei 14.133/2021', requisitosFiltro: ['base_juridica'] },
  { id: '7', titulo: 'Reajuste Contratual (Índice)', categoria: 'Reequilíbrio', descricao: 'Aplicação de índice de preços previsto no contrato para recomposição inflacionária', icon: TrendingUp, fundamentacao: 'Art. 92, §3º e Art. 135, I da Lei 14.133/2021', requisitosFiltro: ['indices', 'contrato', 'base_juridica'] },
  { id: '8', titulo: 'Repactuação (MO/CCT)', categoria: 'Reequilíbrio', descricao: 'Revisão de custos de mão de obra por dissídio coletivo', icon: Users, fundamentacao: 'Art. 135, I da Lei 14.133/2021', requisitosFiltro: ['ccts', 'indices', 'contrato', 'base_juridica'] },
  { id: '9', titulo: 'Revisão / Reequilíbrio Stricto Sensu', categoria: 'Reequilíbrio', descricao: 'Reequilíbrio por fatos imprevisíveis (caso fortuito, força maior, fato do príncipe)', icon: Scale, fundamentacao: 'Art. 124, II, "d" da Lei 14.133/2021', requisitosFiltro: ['indices', 'contrato', 'base_juridica'] },
  { id: '10', titulo: 'Planilha de Composição de Custos', categoria: 'Propostas', descricao: 'Modelo de planilha analítica de custos e formação de preços', icon: Calculator, fundamentacao: 'Art. 58 da Lei 14.133/2021', requisitosFiltro: ['indices'] },
  { id: '11', titulo: 'Declaração de ME/EPP', categoria: 'Declarações', descricao: 'Declaração de enquadramento como microempresa ou EPP', icon: FileText, fundamentacao: 'LC 123/2006, Art. 3º', requisitosFiltro: [] },
  { id: '12', titulo: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', descricao: 'Declaração de que não existem fatos impeditivos à habilitação', icon: FileText, fundamentacao: 'Art. 63, §1º da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '13', titulo: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', descricao: 'Cumprimento ao disposto no Art. 7º, XXXIII da CF', icon: FileText, fundamentacao: 'Art. 68, VI da Lei 14.133/2021', requisitosFiltro: [] },
  { id: '14', titulo: 'Declaração de Reserva de Cargos (PCD)', categoria: 'Declarações', descricao: 'Cumprimento da reserva de cargos para PCD e reabilitados', icon: FileText, fundamentacao: 'Art. 63, IV da Lei 14.133/2021', requisitosFiltro: [] },
];

const categorias = [...new Set(modelos.map(m => m.categoria))];
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

export default function ModelosTemplatesTab() {
  const { user } = useAuth();

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Research data
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [docsBase, setDocsBase] = useState<DocRef[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Generation state
  const [activeModeloId, setActiveModeloId] = useState<string | null>(null);
  const [contexto, setContexto] = useState('');
  const [editalNum, setEditalNum] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);
  const [selectedCCTs, setSelectedCCTs] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [resultado, setResultado] = useState('');
  const [gerando, setGerando] = useState(false);

  // Load all research data on mount
  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    Promise.all([
      supabase.from('indices_economicos').select('id, nome, sigla, valor, variacao_mensal, acumulado_12m, periodo, fonte').order('sigla'),
      supabase.from('convencoes_coletivas').select('id, categoria_profissional, piso_salarial, reajuste_percentual, indice_reajuste, vigencia_inicio, vigencia_fim, sindicato_laboral, abrangencia_uf').eq('status', 'vigente'),
      supabase.from('base_juridica').select('id, titulo, tipo, ementa, texto_integral').order('created_at', { ascending: false }).limit(50),
    ]).then(([indRes, cctRes, docRes]) => {
      setIndices((indRes.data as Indice[]) || []);
      setCcts((cctRes.data as CCT[]) || []);
      setDocsBase((docRes.data as DocRef[]) || []);
      setLoadingData(false);
    });
  }, [user]);

  // Filtered models
  const filteredModelos = useMemo(() => {
    return modelos.filter(m => {
      const matchSearch = !search ||
        m.titulo.toLowerCase().includes(search.toLowerCase()) ||
        m.categoria.toLowerCase().includes(search.toLowerCase()) ||
        m.descricao.toLowerCase().includes(search.toLowerCase()) ||
        m.fundamentacao.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || m.categoria === catFilter;
      return matchSearch && matchCat;
    });
  }, [search, catFilter]);

  const activeModelo = modelos.find(m => m.id === activeModeloId);

  // Toggle helpers
  const toggle = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  // Build AI context and generate
  const handleGerar = async () => {
    if (!activeModelo) return;
    if (!contexto.trim()) {
      toast.error('Descreva o contexto e fundamentação do pedido');
      return;
    }
    setGerando(true);
    setResultado('');

    let fullContext = '';

    // Attach selected indices
    if (selectedIndices.length > 0) {
      fullContext += '\n\n--- ÍNDICES ECONÔMICOS SELECIONADOS ---\n';
      for (const idx of indices.filter(i => selectedIndices.includes(i.id))) {
        fullContext += `- ${idx.sigla} (${idx.nome}): Valor ${idx.valor}, Variação mensal ${fmtPerc(idx.variacao_mensal)}, Acumulado 12m ${fmtPerc(idx.acumulado_12m)}, Período: ${idx.periodo}, Fonte: ${idx.fonte}\n`;
      }
    }

    // Attach selected CCTs
    if (selectedCCTs.length > 0) {
      fullContext += '\n\n--- CONVENÇÕES COLETIVAS SELECIONADAS ---\n';
      for (const c of ccts.filter(ct => selectedCCTs.includes(ct.id))) {
        fullContext += `- ${c.categoria_profissional}: Piso ${c.piso_salarial ? `R$ ${c.piso_salarial}` : 'N/I'}, Reajuste ${c.reajuste_percentual ? `${c.reajuste_percentual}%` : 'N/I'}, Índice ${c.indice_reajuste || 'N/I'}, Vigência ${c.vigencia_inicio || '?'} a ${c.vigencia_fim || '?'}\n`;
      }
    }

    // Attach selected base jurídica docs
    if (selectedDocs.length > 0) {
      fullContext += '\n\n--- DOCUMENTOS DA BASE JURÍDICA ---\n';
      for (const doc of docsBase.filter(d => selectedDocs.includes(d.id))) {
        fullContext += `\n### ${doc.titulo} (${doc.tipo})\n`;
        if (doc.ementa) fullContext += `Ementa: ${doc.ementa}\n`;
        if (doc.texto_integral) fullContext += `Texto: ${doc.texto_integral.slice(0, 4000)}\n`;
      }
    }

    // Type-specific instructions
    let instrucao = '';
    if (activeModelo.categoria === 'Reequilíbrio') {
      if (activeModelo.id === '7') {
        instrucao = 'Gere pedido de REAJUSTE CONTRATUAL por índice (Art. 92, §3º e Art. 135, I da Lei 14.133/2021). Automático, anual, por apostilamento. Demonstre cálculo com índice selecionado.';
      } else if (activeModelo.id === '8') {
        instrucao = 'Gere pedido de REPACTUAÇÃO por dissídio/CCT (Art. 135, I da Lei 14.133/2021). Exclusivo para serviços com dedicação exclusiva de MO. Demonstre variação via planilha de custos (antes/depois).';
      } else if (activeModelo.id === '9') {
        instrucao = 'Gere pedido de REVISÃO/REEQUILÍBRIO STRICTO SENSU (Art. 124, II, "d" da Lei 14.133/2021). Aplique Teoria da Imprevisão. Demonstre nexo causal e onerosidade excessiva.';
      }
    } else if (activeModelo.categoria === 'Recursos') {
      instrucao = `Gere ${activeModelo.titulo} com fundamentação na ${activeModelo.fundamentacao}. Estruture com: I) Tempestividade; II) Fatos; III) Fundamentos jurídicos; IV) Pedido. Linguagem técnica, objetiva e impessoal.`;
    } else if (activeModelo.categoria === 'Impugnações') {
      instrucao = `Gere Impugnação ao Edital com fundamentação no ${activeModelo.fundamentacao}. Estruture com: I) Legitimidade; II) Tempestividade; III) Cláusulas impugnadas; IV) Fundamentação legal; V) Pedido.`;
    } else {
      instrucao = `Gere ${activeModelo.titulo} conforme ${activeModelo.fundamentacao}. Formato técnico-jurídico, linguagem impessoal e objetiva.`;
    }

    fullContext += `\n\nINSTRUÇÃO: ${instrucao}\nLinguagem técnica, objetiva, impessoal e auditável. Cite fontes e períodos dos dados numéricos quando disponíveis.\n`;

    const prompt = `Tipo de Documento: ${activeModelo.titulo}\nCategoria: ${activeModelo.categoria}\nFundamentação Legal: ${activeModelo.fundamentacao}\nEdital/Contrato: ${editalNum || 'Não informado'}\n\nContexto do Usuário:\n${contexto}`;

    await streamAIChat({
      messages: [{ role: 'user', content: prompt }],
      action: 'gerador_juridico',
      context: fullContext,
      onDelta: (text) => setResultado(prev => prev + text),
      onDone: () => setGerando(false),
      onError: (err) => { toast.error(err); setGerando(false); },
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultado);
    toast.success('Documento copiado!');
  };

  const resetGeneration = () => {
    setActiveModeloId(null);
    setContexto('');
    setEditalNum('');
    setSelectedIndices([]);
    setSelectedCCTs([]);
    setSelectedDocs([]);
    setResultado('');
  };

  return (
    <div className="space-y-4">
      {/* ── Search & Filters Bar ── */}
      <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo, categoria ou fundamentação..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
            <Badge
              variant={catFilter === null ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setCatFilter(null)}
            >
              Todos ({modelos.length})
            </Badge>
            {categorias.map(cat => {
              const count = modelos.filter(m => m.categoria === cat).length;
              return (
                <Badge
                  key={cat}
                  variant={catFilter === cat ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                >
                  {cat} ({count})
                </Badge>
              );
            })}
          </div>
        )}

        {(search || catFilter) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="w-3 h-3" />
            {filteredModelos.length} modelo(s) encontrado(s)
            <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => { setSearch(''); setCatFilter(null); }}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        )}
      </div>

      {/* ── Active Generation Panel ── */}
      {activeModelo && (
        <div className="bg-card rounded-xl border-2 border-accent/30 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-semibold">Gerar: {activeModelo.titulo}</h3>
              <Badge variant="outline" className="text-[10px]">{activeModelo.fundamentacao}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={resetGeneration}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Nº do Edital / Contrato</label>
              <Input value={editalNum} onChange={e => setEditalNum(e.target.value)} placeholder="PE-001/2026 ou CT-001/2026" className="mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Contexto / Fatos / Fundamentação</label>
            <Textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder={
                activeModelo.categoria === 'Reequilíbrio'
                  ? 'Descreva o contrato, itens afetados, valores originais vs. atuais, e impacto financeiro...'
                  : activeModelo.categoria === 'Recursos'
                    ? 'Descreva a decisão contestada, os fatos e fundamentos jurídicos...'
                    : 'Descreva o contexto, fatos relevantes e objetivo do documento...'
              }
              className="mt-1 min-h-[100px]"
            />
          </div>

          {/* ── Dynamic data selectors based on model requirements ── */}
          {activeModelo.requisitosFiltro.includes('indices') && (
            <DataSelector
              label="Índices Econômicos"
              icon={<TrendingUp className="w-3 h-3" />}
              loading={loadingData}
              items={indices}
              selected={selectedIndices}
              onToggle={id => toggle(selectedIndices, id, setSelectedIndices)}
              renderItem={i => `${i.sigla}: ${fmtPerc(i.acumulado_12m)} (12m)`}
              getId={i => i.id}
            />
          )}

          {activeModelo.requisitosFiltro.includes('ccts') && (
            <DataSelector
              label="Convenções Coletivas (CCTs)"
              icon={<Users className="w-3 h-3" />}
              loading={loadingData}
              items={ccts}
              selected={selectedCCTs}
              onToggle={id => toggle(selectedCCTs, id, setSelectedCCTs)}
              renderItem={c => `${c.categoria_profissional}: ${c.reajuste_percentual ? `+${c.reajuste_percentual}%` : 'N/I'}`}
              getId={c => c.id}
            />
          )}

          {activeModelo.requisitosFiltro.includes('base_juridica') && docsBase.length > 0 && (
            <DataSelector
              label="Base Jurídica (Jurisprudência/Doutrina)"
              icon={<BookOpen className="w-3 h-3" />}
              loading={loadingData}
              items={docsBase}
              selected={selectedDocs}
              onToggle={id => toggle(selectedDocs, id, setSelectedDocs)}
              renderItem={d => d.titulo.length > 50 ? d.titulo.slice(0, 50) + '...' : d.titulo}
              getId={d => d.id}
            />
          )}

          <div className="flex gap-2">
            <Button onClick={handleGerar} disabled={gerando} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
              Gerar Documento
            </Button>
            <Button variant="outline" onClick={resetGeneration}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Documento Gerado — {activeModelo?.titulo}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const blob = new Blob([resultado], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${activeModelo?.titulo || 'documento'}.md`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Download iniciado!');
              }}>
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            </div>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ── Template Cards Grid ── */}
      {!activeModeloId && categorias.map(cat => {
        const items = filteredModelos.filter(m => m.categoria === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <BookOpen className="w-4 h-4" /> {cat}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map(m => (
                <div key={m.id} className="bg-card rounded-xl border border-border/50 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <m.icon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{m.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.descricao}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-[10px]">{m.fundamentacao}</Badge>
                        {m.requisitosFiltro.includes('indices') && (
                          <Badge variant="secondary" className="text-[10px]">📊 Índices</Badge>
                        )}
                        {m.requisitosFiltro.includes('ccts') && (
                          <Badge variant="secondary" className="text-[10px]">👷 CCTs</Badge>
                        )}
                        {m.requisitosFiltro.includes('base_juridica') && (
                          <Badge variant="secondary" className="text-[10px]">📚 Base Jurídica</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(`${m.titulo}\n${m.descricao}\nFundamentação: ${m.fundamentacao}`);
                      toast.success('Modelo copiado!');
                    }}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground flex-1"
                      onClick={() => {
                        setActiveModeloId(m.id);
                        setResultado('');
                        setContexto('');
                        setEditalNum('');
                        setSelectedIndices([]);
                        setSelectedCCTs([]);
                        setSelectedDocs([]);
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" /> Gerar com IA
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Reusable data selector component ── */
function DataSelector<T>({
  label, icon, loading, items, selected, onToggle, renderItem, getId,
}: {
  label: string; icon: React.ReactNode; loading: boolean;
  items: T[]; selected: string[]; onToggle: (id: string) => void;
  renderItem: (item: T) => string; getId: (item: T) => string;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = items.filter(item =>
    renderItem(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        {icon} {label} ({selected.length} selecionado{selected.length !== 1 ? 's' : ''})
      </label>
      {items.length > 5 && (
        <Input
          placeholder={`Buscar ${label.toLowerCase()}...`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="h-7 text-xs"
        />
      )}
      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-2 rounded-md bg-muted/30">
        {loading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item encontrado</p>
        ) : (
          filtered.map(item => {
            const id = getId(item);
            return (
              <Badge
                key={id}
                variant={selected.includes(id) ? 'default' : 'outline'}
                className="cursor-pointer text-[11px] transition-colors"
                onClick={() => onToggle(id)}
              >
                {renderItem(item)}
              </Badge>
            );
          })
        )}
      </div>
    </div>
  );
}
