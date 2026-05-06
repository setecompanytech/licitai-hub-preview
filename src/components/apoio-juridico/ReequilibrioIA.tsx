import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { streamAIChat } from '@/lib/ai-stream';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { exportLegalPDF, exportLegalWord } from '@/lib/legal-document-export';
import {
  TrendingUp, Search, Sparkles, RefreshCw, Scale, Loader2, ArrowRight,
  DollarSign, Users, Building2, FileText, AlertTriangle, CloudRain, Flame,
  FileDown, Plus, Trash2, Receipt, Quote, Paperclip, BookOpen,
} from 'lucide-react';

/* ── Tipo de instrumento contratual ── */
type Instrumento = 'edital' | 'ata_srp' | 'contrato' | 'aditivo';
const INSTRUMENTOS: Record<Instrumento, { label: string; desc: string; fundamento: string }> = {
  edital: {
    label: 'Edital de Licitação',
    desc: 'Pleito ainda na fase pré-contratual (ex.: pedido fundamentado de adequação de preços antes da homologação).',
    fundamento: 'Art. 81 e Art. 164 da Lei 14.133/2021 (impugnação/esclarecimentos).',
  },
  ata_srp: {
    label: 'Ata de Registro de Preços (SRP)',
    desc: 'Reequilíbrio de preços registrados em ATA SRP. Requer comprovação de fato superveniente que rompa a equação econômico-financeira do registro.',
    fundamento: 'Art. 26 do Decreto 11.462/2023 e Art. 124, II, "d" da Lei 14.133/2021. Súmula TCU 247.',
  },
  contrato: {
    label: 'Contrato Administrativo',
    desc: 'Pleito de reequilíbrio formulado durante a execução de contrato administrativo (objeto principal do pedido formal).',
    fundamento: 'Art. 124, II, "d", Art. 134 e Art. 135 da Lei 14.133/2021.',
  },
  aditivo: {
    label: 'Termo Aditivo Contratual',
    desc: 'Reequilíbrio em razão de fatos surgidos após aditivo contratual (qualitativo, quantitativo ou de prazo).',
    fundamento: 'Arts. 124-125 c/c Art. 134 da Lei 14.133/2021.',
  },
};

/* ── Item comparativo NF/cotação (antes vs depois) ── */
type ItemComparativo = {
  id: string;
  descricao: string;     // descrição do item/insumo
  unidade: string;       // un, kg, m, sc, l...
  quantidade: number;    // por mês/contrato
  precoAntes: number;    // R$ unitário à época da proposta (NF de entrada)
  precoAtual: number;    // R$ unitário atual (NF/cotação posterior)
  fonteAntes: string;    // NF nº..., fornecedor, data
  fonteAtual: string;    // NF nº..., fornecedor, data
};

const novoItemComp = (): ItemComparativo => ({
  id: crypto.randomUUID(),
  descricao: '', unidade: 'un', quantidade: 0,
  precoAntes: 0, precoAtual: 0,
  fonteAntes: '', fonteAtual: '',
});

const calcVariacao = (antes: number, atual: number): number => {
  if (!antes) return 0;
  return ((atual - antes) / antes) * 100;
};

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

type Mecanismo = 'reajuste' | 'repactuacao' | 'revisao';

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPerc = (v: number | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';

const MECANISMOS: Record<Mecanismo, {
  titulo: string; descricao: string; icone: typeof TrendingUp;
  fundamento: string; periodicidade: string; cor: string;
}> = {
  reajuste: {
    titulo: 'Reajuste (Índice Contratual)',
    descricao: 'Aplicação automática de índice de preços previsto no contrato (IPCA, IGP-M, etc.) para recomposição inflacionária. Anual, por apostilamento.',
    icone: TrendingUp,
    fundamento: 'Art. 92, §3º e Art. 135, I da Lei 14.133/2021. Anualidade: 1 ano da proposta ou último reajuste.',
    periodicidade: 'Anual (após 12 meses da proposta)',
    cor: 'text-emerald-600',
  },
  repactuacao: {
    titulo: 'Repactuação (Custos de MO)',
    descricao: 'Exclusiva para serviços com dedicação exclusiva de mão de obra. Demonstração da variação real dos custos via planilha. Não automática, respeita anualidade.',
    icone: Users,
    fundamento: 'Art. 135, I da Lei 14.133/2021. Baseada em CCT/Dissídio Coletivo ou variação de insumos demonstrada.',
    periodicidade: 'Anual (vinculada a CCT/Dissídio)',
    cor: 'text-accent',
  },
  revisao: {
    titulo: 'Revisão / Reequilíbrio (Stricto Sensu)',
    descricao: 'Fatos imprevisíveis ou previsíveis de consequências incalculáveis: caso fortuito, força maior, fato do príncipe. A qualquer tempo, sem periodicidade mínima.',
    icone: Scale,
    fundamento: 'Art. 124, II, "d" da Lei 14.133/2021 e Art. 134, §§2º e 4º. Teoria da Imprevisão. Jurisprudência TCU.',
    periodicidade: 'A qualquer tempo (fato gerador distinto)',
    cor: 'text-destructive',
  },
};

export default function ReequilibrioIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mecanismo, setMecanismo] = useState<Mecanismo>('reajuste');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [indices, setIndices] = useState<Indice[]>([]);
  const [ccts, setCcts] = useState<CCT[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<string[]>([]);
  const [selectedCCTs, setSelectedCCTs] = useState<string[]>([]);
  const [contrato, setContrato] = useState('');
  const [orgao, setOrgao] = useState('');
  const [itensAfetados, setItensAfetados] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [generatingPedido, setGeneratingPedido] = useState(false);
  const [pedidoGerado, setPedidoGerado] = useState('');

  // Tipo de instrumento contratual (Edital / ATA SRP / Contrato / Aditivo)
  const [instrumento, setInstrumento] = useState<Instrumento>('contrato');
  // Identificação do processo
  const [processoAdm, setProcessoAdm] = useState('');
  const [pregaoNum, setPregaoNum] = useState('');
  const [aditivoNum, setAditivoNum] = useState('');
  const [ataNum, setAtaNum] = useState('');
  // Tabela comparativa de preços (NF antes / NF depois / cotações)
  const [itensComp, setItensComp] = useState<ItemComparativo[]>([novoItemComp()]);
  // Anexos probatórios (descrição livre — uploads ficam no DocumentosManager do processo)
  const [anexos, setAnexos] = useState('');
  // Empresa atual (para timbrado e dados)
  const { empresas, empresaAtual } = useEmpresa();
  const empresaSel = empresaAtual || empresas[0]?.empresa || null;
  // Export
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);

  // Revisão-specific fields
  const [fatoGerador, setFatoGerador] = useState('');
  const [tipoFato, setTipoFato] = useState<'caso_fortuito' | 'forca_maior' | 'fato_principe' | 'fato_superveniente'>('fato_superveniente');

  useEffect(() => { fetchData(); }, []);

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
  const info = MECANISMOS[mecanismo];
  const MecIcon = info.icone;

  const filteredIndices = indices.filter(i =>
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sigla.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredCCTs = ccts.filter(c =>
    c.categoria_profissional.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.sindicato_laboral || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const buildPrompt = () => {
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

    const mecanismoLabels: Record<Mecanismo, string> = {
      reajuste: 'REAJUSTE CONTRATUAL (Sentido Estrito)',
      repactuacao: 'REPACTUAÇÃO POR DISSÍDIO / CCT',
      revisao: 'REVISÃO / REEQUILÍBRIO ECONÔMICO-FINANCEIRO (Stricto Sensu)',
    };

    const tipoFatoLabels: Record<string, string> = {
      caso_fortuito: 'Caso Fortuito',
      forca_maior: 'Força Maior',
      fato_principe: 'Fato do Príncipe (ação da Administração)',
      fato_superveniente: 'Fato Superveniente Imprevisível',
    };

    let instrucoes = '';
    if (mecanismo === 'reajuste') {
      instrucoes = `
INSTRUÇÕES PARA REAJUSTE:
- Tipo: Reajuste por índice contratual (sentido estrito).
- Fundamente com Art. 92, §3º e Art. 135, I da Lei 14.133/2021.
- O reajuste é automático, por apostilamento, após 12 meses da proposta ou último reajuste.
- Demonstre a variação do índice contratual no período (utilize os índices selecionados).
- Estruture: CABEÇALHO, DO OBJETO, DO ÍNDICE CONTRATUAL, DA DEMONSTRAÇÃO DO REAJUSTE (cálculo numérico), DO APOSTILAMENTO, CONCLUSÃO.
- Linguagem técnica, objetiva, impessoal. Formato auditável.`;
    } else if (mecanismo === 'repactuacao') {
      instrucoes = `
INSTRUÇÕES PARA REPACTUAÇÃO:
- Tipo: Repactuação por variação de custos de mão de obra.
- Fundamente com Art. 135, I da Lei 14.133/2021.
- Exclusiva para serviços com dedicação exclusiva de MO.
- Não é automática: requer demonstração da variação real dos custos via planilha.
- Respeita anualidade vinculada à CCT/Dissídio Coletivo.
- Utilize os dados das CCTs selecionadas como fundamentação.
- Estruture: CABEÇALHO, DO OBJETO DO CONTRATO, DA CONVENÇÃO COLETIVA APLICÁVEL, DA DEMONSTRAÇÃO DA VARIAÇÃO DE CUSTOS (planilha antes/depois), DO CÁLCULO DA REPACTUAÇÃO, DO PEDIDO, CONCLUSÃO.
- Inclua comparativo de planilha de custos (valores antigos x novos).`;
    } else {
      instrucoes = `
INSTRUÇÕES PARA REVISÃO (REEQUILÍBRIO STRICTO SENSU):
- Tipo: Revisão contratual por fato extraordinário.
- Fato gerador: ${tipoFatoLabels[tipoFato]}.
- Descrição do fato: ${fatoGerador || 'Não informado'}
- Fundamente com Art. 124, II, "d" e Art. 134, §§2º e 4º da Lei 14.133/2021.
- Aplique a Teoria da Imprevisão e cite jurisprudência do TCU quando cabível.
- Pode ocorrer a qualquer tempo, sem periodicidade mínima, mesmo que já tenha havido reajuste no mesmo período (fatos geradores distintos).
- Estruture: CABEÇALHO, DO OBJETO, DOS FATOS (narrativa detalhada com dados numéricos), DA FUNDAMENTAÇÃO LEGAL (imprevisibilidade/álea extraordinária), DA DEMONSTRAÇÃO DO IMPACTO ECONÔMICO, DO NEXO CAUSAL, DO PEDIDO, CONCLUSÃO.
- Demonstre o nexo entre o fato e a onerosidade excessiva.`;
    }

    return `Gere um pedido formal de ${mecanismoLabels[mecanismo]} com fundamentação técnica e jurídica conforme a Lei 14.133/2021.

MECANISMO JURÍDICO: ${mecanismoLabels[mecanismo]}

DADOS DO CONTRATO:
Contrato: ${contrato || 'Não informado'}
Órgão Contratante: ${orgao || 'Não informado'}
Itens afetados: ${itensAfetados || 'Não informado'}
Observações: ${observacoes || 'Nenhuma'}

ÍNDICES ECONÔMICOS OFICIAIS SELECIONADOS:
${indicesTexto || 'Nenhum índice selecionado'}

CONVENÇÕES COLETIVAS / DISSÍDIOS SELECIONADOS:
${cctsTexto || 'Nenhuma CCT selecionada'}

${instrucoes}

IMPORTANTE: Utilize linguagem técnica, objetiva e impessoal, conforme padrão auditável para processos licitatórios. Inclua demonstração numérica.`;
  };

  const handleGerarPedido = async () => {
    if (mecanismo === 'reajuste' && selectedIndices.length === 0) {
      toast.error('Selecione ao menos um índice econômico para o reajuste');
      return;
    }
    if (mecanismo === 'repactuacao' && selectedCCTs.length === 0) {
      toast.error('Selecione ao menos uma CCT para a repactuação');
      return;
    }
    if (mecanismo === 'revisao' && !fatoGerador) {
      toast.error('Descreva o fato gerador da revisão');
      return;
    }

    setGeneratingPedido(true);
    setPedidoGerado('');

    await streamAIChat({
      messages: [{ role: 'user', content: buildPrompt() }],
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

  const renderIndicesGrid = () => (
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
  );

  const renderCCTsGrid = () => (
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
                    <span className="text-[11px] font-medium text-accent">Reajuste: +{cct.reajuste_percentual}%</span>
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
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-semibold">Reajuste, Repactuação e Revisão com IA</h3>
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
        </div>
      </div>

      {/* Tabs for 3 mechanisms */}
      <Tabs value={mecanismo} onValueChange={(v) => { setMecanismo(v as Mecanismo); setShowGenerator(false); setPedidoGerado(''); }}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="reajuste" className="text-xs gap-1">
            <TrendingUp className="w-3 h-3" /> Reajuste
          </TabsTrigger>
          <TabsTrigger value="repactuacao" className="text-xs gap-1">
            <Users className="w-3 h-3" /> Repactuação
          </TabsTrigger>
          <TabsTrigger value="revisao" className="text-xs gap-1">
            <Scale className="w-3 h-3" /> Revisão
          </TabsTrigger>
        </TabsList>

        {/* Mechanism info banner */}
        <div className={`bg-accent/10 border border-accent/20 rounded-lg p-3 mt-3 space-y-1`}>
          <div className="flex items-center gap-2">
            <MecIcon className={`w-4 h-4 ${info.cor}`} />
            <span className="text-xs font-semibold text-foreground">{info.titulo}</span>
          </div>
          <p className="text-xs text-muted-foreground">{info.descricao}</p>
          <p className="text-[10px] text-muted-foreground"><strong>Fundamento:</strong> {info.fundamento}</p>
          <p className="text-[10px] text-muted-foreground"><strong>Periodicidade:</strong> {info.periodicidade}</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={
                mecanismo === 'reajuste'
                  ? 'Buscar índice econômico (IPCA, IGP-M, INPC...)'
                  : mecanismo === 'repactuacao'
                  ? 'Buscar CCT, dissídio ou categoria profissional...'
                  : 'Buscar índice para comprovação de impacto...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="sm" variant="default" onClick={() => {}}>
            <Search className="w-3 h-3 mr-1" />
            {mecanismo === 'reajuste'
              ? 'Buscar Índice'
              : mecanismo === 'repactuacao'
              ? 'Buscar CCT/Dissídio'
              : 'Buscar Comprovação'}
          </Button>
          {searchTerm && (
            <Button size="sm" variant="ghost" onClick={() => setSearchTerm('')}>
              Limpar
            </Button>
          )}
          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
            {mecanismo === 'repactuacao'
              ? `${filteredIndices.length} índices · ${filteredCCTs.length} CCTs`
              : mecanismo === 'revisao'
              ? `${filteredIndices.length} índices de comprovação`
              : `${filteredIndices.length} índices contratuais`}
          </Badge>
        </div>

        {loadingData ? (
          <div className="space-y-3 mt-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* REAJUSTE TAB */}
            <TabsContent value="reajuste" className="space-y-4 mt-0">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Selecione o índice contratual ({filteredIndices.length})
                </h4>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Selecione o índice previsto no contrato para cálculo automático do reajuste anual por apostilamento.
                </p>
                {renderIndicesGrid()}
              </div>
            </TabsContent>

            {/* REPACTUAÇÃO TAB */}
            <TabsContent value="repactuacao" className="space-y-4 mt-0">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> CCTs / Dissídios Coletivos ({filteredCCTs.length})
                </h4>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Selecione as convenções coletivas para demonstrar a variação dos custos de mão de obra (planilha antes/depois).
                </p>
                {renderCCTsGrid()}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Índices complementares (opcional)
                </h4>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Índices de insumos podem complementar a repactuação (ex: SINAPI para materiais).
                </p>
                {renderIndicesGrid()}
              </div>
            </TabsContent>

            {/* REVISÃO TAB */}
            <TabsContent value="revisao" className="space-y-4 mt-0">
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-semibold">Fato Gerador da Revisão</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tipo do fato</label>
                  <select
                    value={tipoFato}
                    onChange={e => setTipoFato(e.target.value as typeof tipoFato)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="caso_fortuito">☁️ Caso Fortuito (evento natural imprevisível)</option>
                    <option value="forca_maior">🔥 Força Maior (evento humano irresistível)</option>
                    <option value="fato_principe">🏛️ Fato do Príncipe (ação da Administração)</option>
                    <option value="fato_superveniente">📋 Fato Superveniente Imprevisível</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Descrição detalhada do fato gerador</label>
                  <Textarea
                    placeholder="Descreva detalhadamente o fato que causou a onerosidade excessiva, quando ocorreu, e como impactou os custos do contrato..."
                    className="mt-1 min-h-[100px]"
                    value={fatoGerador}
                    onChange={e => setFatoGerador(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Índices para comprovação do impacto ({filteredIndices.length})
                </h4>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Selecione índices que comprovem numericamente o impacto econômico do fato gerador.
                </p>
                {renderIndicesGrid()}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Generate button (floating) */}
      {(mecanismo === 'reajuste' && selectedIndices.length > 0) ||
       (mecanismo === 'repactuacao' && selectedCCTs.length > 0) ||
       (mecanismo === 'revisao' && fatoGerador) ? (
        <div className="sticky bottom-4 z-10">
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
            onClick={() => setShowGenerator(true)}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Gerar Pedido de {info.titulo.split('(')[0].trim()} ({totalSelected > 0 ? `${totalSelected} dados` : 'Revisão'})
          </Button>
        </div>
      ) : null}

      {/* Generator panel */}
      {showGenerator && (
        <div className="bg-card rounded-xl border border-accent/30 p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MecIcon className={`w-5 h-5 ${info.cor}`} />
              <h3 className="text-sm font-semibold">Gerador: {info.titulo}</h3>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowGenerator(false)}>✕</Button>
          </div>

          {/* Selected data summary */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong>Fundamentação selecionada:</strong>
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
              {mecanismo === 'revisao' && fatoGerador && (
                <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                  ⚠️ {tipoFato.replace('_', ' ')}
                </Badge>
              )}
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
            <label className="text-xs text-muted-foreground">
              {mecanismo === 'repactuacao' ? 'Itens de MO afetados e valores da planilha' : 'Itens afetados e variação de preço'}
            </label>
            <Textarea
              placeholder={
                mecanismo === 'reajuste' ? 'Ex: Valor mensal do contrato: R$ 50.000,00. Índice contratual: IPCA...' :
                mecanismo === 'repactuacao' ? 'Ex: Servente: de R$ 1.780,00 para R$ 1.920,00 (CCT 2026). Encarregado: ...' :
                'Ex: Cimento CP-II: de R$ 32,00 para R$ 40,00/saco (+25%) devido a...'
              }
              className="mt-1 min-h-[80px]"
              value={itensAfetados}
              onChange={e => setItensAfetados(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Observações adicionais</label>
            <Textarea placeholder="Informações complementares..." className="mt-1 min-h-[60px]" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Fundamentação automática:</strong> {info.fundamento}
            </p>
          </div>

          <Button
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={handleGerarPedido}
            disabled={generatingPedido}
          >
            {generatingPedido ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {generatingPedido ? 'Gerando...' : `Gerar Pedido de ${info.titulo.split('(')[0].trim()}`}
          </Button>

          {pedidoGerado && (
            <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pedido Gerado pela IA</h4>
                <Button size="sm" variant="outline" onClick={copyToClipboard}>Copiar</Button>
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
