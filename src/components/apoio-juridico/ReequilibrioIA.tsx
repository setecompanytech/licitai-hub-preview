import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { streamAIChat } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Newspaper, AlertTriangle, TrendingUp, Search, Sparkles,
  ExternalLink, CloudRain, Flame, Truck, MapPin, RefreshCw,
  FileText, Scale, Loader2, ArrowRight, DollarSign, Users, Building2
} from 'lucide-react';

type Indice = {
  id: string; nome: string; sigla: string; fonte: string; periodo: string;
  valor: number; variacao_mensal: number | null; variacao_anual: number | null;
  acumulado_12m: number | null; categoria: string;
};

type CCT = {
  id: string; categoria_profissional: string; sindicato_laboral: string | null;
  vigencia_inicio: string | null; vigencia_fim: string | null;
  piso_salarial: number | null; reajuste_percentual: number | null;
  indice_reajuste: string | null; abrangencia_uf: string | null; status: string;
};

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

const categoriaIcons: Record<string, typeof TrendingUp> = {
  'Calamidade Pública': CloudRain,
  'Caso Fortuito / Força Maior': Flame,
  'Fato Superveniente': Truck,
  'Índice Econômico': TrendingUp,
  'CCT / Dissídio': Users,
};

export default function ReequilibrioIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Generator
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);
  const [selectedCCTs, setSelectedCCTs] = useState<string[]>([]);
  const [contrato, setContrato] = useState('');
  const [orgao, setOrgao] = useState('');
  const [itensAfetados, setItensAfetados] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [generatingPedido, setGeneratingPedido] = useState(false);
  const [pedidoGerado, setPedidoGerado] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingData(true);
    const [indicesRes, cctsRes] = await Promise.all([
      supabase.from('indices_economicos').select('*').order('categoria').order('sigla'),
      supabase.from('convencoes_coletivas').select('*').eq('status', 'vigente').order('categoria_profissional'),
    ]);
    setIndices((indicesRes.data as Indice[]) || []);
    setCcts((cctsRes.data as CCT[]) || []);
    setLoadingData(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
    toast.success('Dados atualizados');
  };

  const toggleIndice = (id: string) =>
    setSelectedIndices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const toggleCCT = (id: string) =>
    setSelectedCCTs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const totalSelected = selectedIndices.length + selectedCCTs.length;

  const filteredIndices = indices.filter(i =>
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sigla.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCCTs = ccts.filter(c =>
    c.categoria_profissional.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.sindicato_laboral || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGerarPedido = async () => {
    if (totalSelected === 0) {
      toast.error('Selecione ao menos um índice ou CCT como fundamentação');
      return;
    }

    const indicesTexto = selectedIndices.map(id => {
      const i = indices.find(x => x.id === id);
      if (!i) return '';
      return `- ${i.nome} (${i.sigla}): Valor atual ${i.valor}, Variação mensal ${fmtPerc(i.variacao_mensal)}, Acumulado 12m ${fmtPerc(i.acumulado_12m)}, Fonte: ${i.fonte}, Período: ${i.periodo}`;
    }).filter(Boolean).join('\n');

    const cctsTexto = selectedCCTs.map(id => {
      const c = ccts.find(x => x.id === id);
      if (!c) return '';
      return `- CCT ${c.categoria_profissional}: Piso salarial ${c.piso_salarial ? fmtCur(c.piso_salarial) : 'N/I'}, Reajuste ${c.reajuste_percentual ? c.reajuste_percentual + '%' : 'N/I'}, Índice ${c.indice_reajuste || 'N/I'}, Vigência ${c.vigencia_inicio || '?'} a ${c.vigencia_fim || '?'}, Sindicato: ${c.sindicato_laboral || 'N/I'}, UF: ${c.abrangencia_uf || 'N/I'}`;
    }).filter(Boolean).join('\n');

    const prompt = `Gere um pedido formal de reequilíbrio econômico-financeiro com fundamentação técnica e jurídica conforme a Lei 14.133/2021.

DADOS DO CONTRATO:
Contrato: ${contrato || 'Não informado'}
Órgão Contratante: ${orgao || 'Não informado'}
Itens afetados: ${itensAfetados || 'Não informado'}
Observações: ${observacoes || 'Nenhuma'}

ÍNDICES ECONÔMICOS OFICIAIS SELECIONADOS:
${indicesTexto || 'Nenhum índice selecionado'}

CONVENÇÕES COLETIVAS / DISSÍDIOS SELECIONADOS:
${cctsTexto || 'Nenhuma CCT selecionada'}

INSTRUÇÕES:
- Utilize linguagem técnica, objetiva e impessoal, conforme padrão auditável para processos licitatórios.
- Fundamente com Art. 124, II, "d" da Lei 14.133/2021 e jurisprudência do TCU quando aplicável.
- Se houver CCTs selecionadas, aplique Art. 135, I da Lei 14.133/2021 (repactuação por dissídio).
- Estruture em: CABEÇALHO, DO OBJETO, DOS FATOS (com dados numéricos), DA FUNDAMENTAÇÃO LEGAL, DO CÁLCULO DO REAJUSTE, DO PEDIDO, CONCLUSÃO.
- Inclua demonstração numérica da onerosidade com os índices/CCTs fornecidos.`;

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pedidoGerado);
    toast.success('Copiado!');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Reequilíbrio Econômico-Financeiro com IA</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/indices-repactuacao')}>
            <TrendingUp className="w-3 h-3 mr-1" /> Painel de Índices
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {totalSelected > 0 && (
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowGenerator(true)}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Gerar Pedido ({totalSelected})
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar índice, CCT ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Info banner */}
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Dados sincronizados:</strong> Selecione os índices econômicos e/ou CCTs vigentes
          para fundamentar automaticamente o pedido de reequilíbrio com dados reais e fundamentação jurídica (Lei 14.133/2021).
        </p>
      </div>

      {loadingData ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Índices Econômicos Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Índices Econômicos ({filteredIndices.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredIndices.map(indice => {
                const isSelected = selectedIndices.includes(indice.id);
                const CatIcon = indice.categoria === 'construcao' ? Building2 :
                  indice.categoria === 'salario' ? Users :
                  indice.categoria === 'juros' ? DollarSign : TrendingUp;
                return (
                  <div
                    key={indice.id}
                    className={`bg-card rounded-xl border p-4 shadow-sm transition-all cursor-pointer ${
                      isSelected ? 'border-accent ring-1 ring-accent/30' : 'border-border/50 hover:border-accent/30'
                    }`}
                    onClick={() => toggleIndice(indice.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <CatIcon className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{indice.sigla}</p>
                          <Badge variant="outline" className="text-[10px]">{indice.fonte}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{indice.nome}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-medium">Valor: {indice.valor}</span>
                          <span className={`text-[11px] font-medium ${(indice.variacao_mensal || 0) >= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            Mensal: {fmtPerc(indice.variacao_mensal)}
                          </span>
                          <span className={`text-[11px] font-medium ${(indice.acumulado_12m || 0) >= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            12m: {fmtPerc(indice.acumulado_12m)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Período: {indice.periodo}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredIndices.length === 0 && (
                <div className="col-span-2 text-center py-6 text-sm text-muted-foreground">
                  Nenhum índice encontrado. <Button variant="link" size="sm" onClick={() => navigate('/indices-repactuacao')}>Atualizar no Painel de Índices</Button>
                </div>
              )}
            </div>
          </div>

          {/* CCTs Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> Convenções Coletivas Vigentes ({filteredCCTs.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCCTs.map(cct => {
                const isSelected = selectedCCTs.includes(cct.id);
                const vencida = cct.vigencia_fim && new Date(cct.vigencia_fim) < new Date();
                return (
                  <div
                    key={cct.id}
                    className={`bg-card rounded-xl border p-4 shadow-sm transition-all cursor-pointer ${
                      isSelected ? 'border-accent ring-1 ring-accent/30' : 'border-border/50 hover:border-accent/30'
                    }`}
                    onClick={() => toggleCCT(cct.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{cct.categoria_profissional}</p>
                          {vencida && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Vencida</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{cct.sindicato_laboral || 'Sindicato não informado'}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {cct.piso_salarial && <span className="text-xs font-medium">Piso: {fmtCur(cct.piso_salarial)}</span>}
                          {cct.reajuste_percentual && (
                            <span className="text-[11px] font-medium text-accent">
                              Reajuste: +{cct.reajuste_percentual}%
                            </span>
                          )}
                          {cct.abrangencia_uf && <Badge variant="outline" className="text-[10px]">{cct.abrangencia_uf}</Badge>}
                          {cct.indice_reajuste && <Badge variant="outline" className="text-[10px]">{cct.indice_reajuste}</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Vigência: {cct.vigencia_inicio || '?'} a {cct.vigencia_fim || '?'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredCCTs.length === 0 && (
                <div className="col-span-2 text-center py-6 text-sm text-muted-foreground">
                  Nenhuma CCT cadastrada. <Button variant="link" size="sm" onClick={() => navigate('/indices-repactuacao')}>Cadastrar no Painel de Índices</Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

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

          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong>{totalSelected}</strong> fundamentação(ões) selecionada(s):
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedIndices.map(id => {
                const i = indices.find(x => x.id === id);
                return i ? (
                  <Badge key={id} className="text-[10px] bg-accent/10 text-accent border-accent/30">
                    📊 {i.sigla} ({fmtPerc(i.acumulado_12m)} 12m)
                  </Badge>
                ) : null;
              })}
              {selectedCCTs.map(id => {
                const c = ccts.find(x => x.id === id);
                return c ? (
                  <Badge key={id} className="text-[10px] bg-accent/10 text-accent border-accent/30">
                    👷 {c.categoria_profissional} ({c.reajuste_percentual ? `+${c.reajuste_percentual}%` : 'N/I'})
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Nº do Contrato</label>
              <Input placeholder="CT-001/2026" className="mt-1" value={contrato} onChange={e => setContrato(e.target.value)} />
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
              Reestabelecimento do equilíbrio econômico-financeiro. {selectedCCTs.length > 0 && 'Art. 135, I – Repactuação por dissídio coletivo.'}
              {' '}Dados numéricos dos índices e CCTs serão incorporados automaticamente ao parecer.
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
            <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pedido Gerado pela IA</h4>
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  Copiar
                </Button>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                <ReactMarkdown>{pedidoGerado}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
