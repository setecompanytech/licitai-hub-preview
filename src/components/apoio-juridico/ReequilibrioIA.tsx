import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useJuridicoPedidos, type JuridicoPedido } from '@/hooks/useJuridicoPedidos';
import PedidosJuridicosList from './PedidosJuridicosList';
import { ChecklistFatoGerador } from './ChecklistFatoGerador';
import {
  TrendingUp, Search, Sparkles, RefreshCw, Scale, Loader2, ArrowRight,
  DollarSign, Users, Building2, FileText, AlertTriangle, CloudRain, Flame,
  FileDown, Plus, Trash2, Receipt, Quote, Paperclip, BookOpen, FolderOpen, Hash, X,
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
    cor: 'text-success',
  },
  repactuacao: {
    titulo: 'Repactuação (Custos de MO)',
    descricao: 'Exclusiva para serviços com dedicação exclusiva de mão de obra. Demonstração da variação real dos custos via planilha. Não automática, respeita anualidade.',
    icone: Users,
    fundamento: 'Art. 135, I da Lei 14.133/2021. Baseada em CCT/Dissídio Coletivo ou variação de insumos demonstrada.',
    periodicidade: 'Anual (vinculada a CCT/Dissídio)',
    cor: 'text-warning',
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
  const { empresas, empresaAtiva } = useEmpresa();
  const empresaSel = empresaAtiva || empresas[0]?.empresa || null;
  // Export
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);

  // Pedido jurídico ativo (cabeçalho persistido) e hook
  const { criarPedido, salvarVersao } = useJuridicoPedidos();
  const [pedidoAtivo, setPedidoAtivo] = useState<JuridicoPedido | null>(null);
  const [showLista, setShowLista] = useState(true);

  // Revisão-specific fields
  const [fatoGerador, setFatoGerador] = useState('');
  const [tipoFato, setTipoFato] = useState<'caso_fortuito' | 'forca_maior' | 'fato_principe' | 'fato_superveniente'>('fato_superveniente');
  const [showChecklist, setShowChecklist] = useState(false);
  const [enquadramentoValidado, setEnquadramentoValidado] = useState(false);

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

  /* ─────────── Tabela comparativa helpers ─────────── */
  const addItemComp = () => setItensComp(p => [...p, novoItemComp()]);
  const rmItemComp = (id: string) => setItensComp(p => p.filter(i => i.id !== id));
  const updItemComp = (id: string, patch: Partial<ItemComparativo>) =>
    setItensComp(p => p.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const itensCompValidos = itensComp.filter(i => i.descricao && (i.precoAntes > 0 || i.precoAtual > 0));

  const tabelaComparativaMd = () => {
    if (itensCompValidos.length === 0) return '';
    const linhas = itensCompValidos.map(i => {
      const v = calcVariacao(i.precoAntes, i.precoAtual);
      const dif = (i.precoAtual - i.precoAntes) * (i.quantidade || 1);
      return `| ${i.descricao} | ${i.unidade} | ${i.quantidade || '—'} | ${fmtCur(i.precoAntes)} | ${fmtCur(i.precoAtual)} | ${v >= 0 ? '+' : ''}${v.toFixed(2)}% | ${fmtCur(dif)} | ${i.fonteAntes || '—'} | ${i.fonteAtual || '—'} |`;
    });
    return [
      '| Item / Insumo | Un. | Qtd. | Preço à época | Preço atual | Var. % | Impacto financeiro | NF/Cotação à época | NF/Cotação atual |',
      '|---|---|---|---|---|---|---|---|---|',
      ...linhas,
    ].join('\n');
  };

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
      caso_fortuito: 'Caso Fortuito (evento imprevisível, em regra de origem humana ou interna — ex.: greves, atos de terceiros, falhas operacionais — CC art. 393)',
      forca_maior: 'Força Maior (evento irresistível, em regra de origem natural ou externa — ex.: enchentes, pandemias, desastres naturais — CC art. 393)',
      fato_principe: 'Fato do Príncipe (ato geral e extracontratual do Poder Público que repercute indiretamente sobre o contrato — ex.: nova tributação, embargo geral)',
      fato_superveniente: 'Álea Econômica Extraordinária / Fato Superveniente Imprevisível (Teoria da Imprevisão — Lei 14.133/2021, art. 124, II, "d")',
    };

    const instrumentoInfo = INSTRUMENTOS[instrumento];

    const dadosInstrumento = (() => {
      switch (instrumento) {
        case 'edital':
          return `Edital/Pregão: ${pregaoNum || 'Não informado'}\nProcesso Administrativo: ${processoAdm || 'Não informado'}`;
        case 'ata_srp':
          return `ATA SRP nº: ${ataNum || 'Não informado'}\nPregão: ${pregaoNum || 'Não informado'}\nProcesso Administrativo: ${processoAdm || 'Não informado'}`;
        case 'contrato':
          return `Contrato Administrativo nº: ${contrato || 'Não informado'}\nPregão: ${pregaoNum || 'Não informado'}\nProcesso Administrativo: ${processoAdm || 'Não informado'}`;
        case 'aditivo':
          return `Termo Aditivo nº: ${aditivoNum || 'Não informado'}\nContrato Administrativo originário nº: ${contrato || 'Não informado'}\nPregão: ${pregaoNum || 'Não informado'}\nProcesso Administrativo: ${processoAdm || 'Não informado'}`;
      }
    })();

    let instrucoes = '';
    if (mecanismo === 'reajuste') {
      instrucoes = `
INSTRUÇÕES PARA REAJUSTE:
- Tipo: Reajuste por índice contratual (sentido estrito).
- Fundamente com Art. 92, §3º e Art. 135, I da Lei 14.133/2021.
- O reajuste é automático, por apostilamento, após 12 meses da proposta ou último reajuste (anualidade).
- Demonstre matematicamente a variação do índice contratual no período.
- Cite, se cabível, Acórdãos do TCU sobre apostilamento (ex.: Acórdão 1.563/2004-Plenário).`;
    } else if (mecanismo === 'repactuacao') {
      instrucoes = `
INSTRUÇÕES PARA REPACTUAÇÃO:
- Tipo: Repactuação por variação de custos de mão de obra (Art. 135, I da Lei 14.133/2021).
- Exclusiva para serviços com dedicação exclusiva de MO; demonstração analítica obrigatória (planilha antes/depois).
- Vinculação à CCT/Dissídio Coletivo registrado no MTE.
- Cite Súmula TCU 277 (limitação a custos efetivamente impactados) quando aplicável.`;
    } else {
      instrucoes = `
INSTRUÇÕES PARA REVISÃO (REEQUILÍBRIO STRICTO SENSU):
- Tipo: Revisão por fato extraordinário e imprevisível.
- Fato gerador qualificado: ${tipoFatoLabels[tipoFato]}.
- Descrição: ${fatoGerador || 'Não informado'}
- Fundamentação obrigatória: Art. 124, II, "d", Art. 134, §§ 2º e 4º, e Art. 135 da Lei 14.133/2021; arts. 317 e 478 do Código Civil (teoria da imprevisão e onerosidade excessiva).
- Doutrina: Marçal Justen Filho ("Comentários à Lei de Licitações"); Maria Sylvia Z. Di Pietro ("Direito Administrativo"); Jessé Torres Pereira Junior.
- Jurisprudência TCU: Acórdãos 1.595/2006-Plenário, 2.495/2018-Plenário, 1.431/2017-Plenário (necessidade de demonstração do nexo causal e da imprevisibilidade).
- Demonstre nexo causal entre o fato e a onerosidade excessiva, com prova documental (NF antes/depois, cotações).`;
    }

    return `Gere um PEDIDO FORMAL ESCRITO segundo o padrão jurídico-técnico brasileiro de petições administrativas em licitações, com a estrutura ABAIXO RIGOROSAMENTE OBSERVADA, em linguagem culta, formal, impessoal e auditável, conforme padrão da Lei 14.133/2021.

INSTRUMENTO CONTRATUAL: ${instrumentoInfo.label.toUpperCase()}
Fundamento do instrumento: ${instrumentoInfo.fundamento}

MECANISMO JURÍDICO: ${mecanismoLabels[mecanismo]}

DADOS DA EMPRESA REQUERENTE:
${empresaSel ? `Razão Social: ${empresaSel.razao_social || empresaSel.nome_fantasia || ''}\nCNPJ: ${empresaSel.cnpj || 'N/I'}\nEndereço: ${empresaSel.endereco || 'N/I'}` : 'A preencher pelo usuário.'}

DADOS DO INSTRUMENTO ATACADO:
${dadosInstrumento}
Órgão Contratante: ${orgao || 'Não informado'}

ÍNDICES ECONÔMICOS OFICIAIS SELECIONADOS:
${indicesTexto || 'Nenhum índice selecionado'}

CONVENÇÕES COLETIVAS / DISSÍDIOS SELECIONADOS:
${cctsTexto || 'Nenhuma CCT selecionada'}

ITENS AFETADOS (descrição livre):
${itensAfetados || 'Não informado'}

DEMONSTRAÇÃO COMPARATIVA DE PREÇOS (NF/Cotações antes vs atual):
${tabelaComparativaMd() || 'Não informado'}

ANEXOS PROBATÓRIOS RELACIONADOS (descrição):
${anexos || 'Não há descrição adicional de anexos.'}

OBSERVAÇÕES ADICIONAIS:
${observacoes || 'Nenhuma'}

${instrucoes}

ESTRUTURA OBRIGATÓRIA DO DOCUMENTO (siga RIGOROSAMENTE os títulos, na ordem):

1. CABEÇALHO (com endereçamento ao órgão, identificação do instrumento, do processo administrativo e do interessado)
2. SUMÁRIO (lista de seções com numeração romana)
3. I — PRELIMINARMENTE (qualificação da requerente, eventuais alterações cadastrais/societárias se houver)
4. II — SÍNTESE DOS FATOS (narrativa cronológica objetiva)
5. III — DO DESEQUILÍBRIO ECONÔMICO-FINANCEIRO E SEUS EFEITOS PRÁTICOS
   3.1. Da teoria da imprevisão e da garantia de exequibilidade dos contratos
   3.2. Do caso fortuito, força maior e fato do príncipe (quando aplicável)
   3.3. Das mudanças mercadológicas (quando aplicável)
   3.4. Da recomposição do equilíbrio econômico-financeiro
6. IV — DO DIREITO AO REEQUILÍBRIO (fundamentação legal, doutrinária e jurisprudencial — Lei 14.133/2021, CC/2002, TCU, doutrina)
7. V — DO ITEM PRECIFICADO E SUA DESATUALIZAÇÃO (apresentar a tabela comparativa fornecida acima em formato de tabela markdown, com cabeçalho explicativo)
8. VI — DO PEDIDO (deferimento expresso, com indicação do percentual de recomposição e/ou dos novos preços unitários requeridos)
9. REFERÊNCIAS (legislação, doutrina e jurisprudência citadas)
10. ANEXOS — relação dos atos probatórios (NFs, cotações, alterações contratuais, etc.)

REGRAS DE REDAÇÃO ABSOLUTAS:
- NÃO use emojis, ícones, figurinhas ou qualquer caractere decorativo.
- Linguagem formal, impessoal, técnica, em conformidade com o padrão de petições administrativas brasileiras.
- Numeração romana (I, II, III...) para seções principais; arábica para subitens.
- Ao apresentar a tabela comparativa, reproduza-a em sintaxe markdown e logo após faça a análise quantitativa do impacto.
- Cite expressamente os artigos da Lei 14.133/2021 e, quando cabível, do Código Civil (arts. 317, 393 e 478) e Acórdãos do TCU.
- Conclua com pedido de deferimento, em forma de capítulo "VI — DO PEDIDO", e fórmula final "Nestes termos, pede deferimento."`;
  };

  /* ─────────── Export PDF/Word ─────────── */
  const docTitle = () => {
    const mecLabel = mecanismo === 'reajuste' ? 'Reajuste Contratual' :
      mecanismo === 'repactuacao' ? 'Repactuação' : 'Reequilíbrio Econômico-Financeiro';
    return `Pedido de ${mecLabel}`;
  };

  const exportarPDF = async () => {
    if (!pedidoGerado) return;
    setExporting('pdf');
    try {
      await exportLegalPDF(pedidoGerado, docTitle(), {
        empresa: empresaSel?.razao_social || empresaSel?.nome_fantasia || undefined,
        cnpj: empresaSel?.cnpj || undefined,
        edital: instrumento === 'contrato' ? contrato : instrumento === 'ata_srp' ? ataNum : pregaoNum,
        modalidade: INSTRUMENTOS[instrumento].label,
        fundamentacao: info.fundamento,
        timbradoUrl: (empresaSel as any)?.timbrado_url || null,
      });
      toast.success('PDF gerado com sucesso');
    } catch (e: any) {
      toast.error('Falha ao gerar PDF: ' + (e?.message || ''));
    } finally {
      setExporting(null);
    }
  };

  const exportarWord = () => {
    if (!pedidoGerado) return;
    setExporting('word');
    try {
      exportLegalWord(pedidoGerado, docTitle(), {
        empresa: empresaSel?.razao_social || empresaSel?.nome_fantasia || undefined,
        cnpj: empresaSel?.cnpj || undefined,
        edital: instrumento === 'contrato' ? contrato : instrumento === 'ata_srp' ? ataNum : pregaoNum,
        modalidade: INSTRUMENTOS[instrumento].label,
        fundamentacao: info.fundamento,
        timbradoUrl: (empresaSel as any)?.timbrado_url || null,
      });
      toast.success('Word gerado com sucesso');
    } catch (e: any) {
      toast.error('Falha ao gerar Word: ' + (e?.message || ''));
    } finally {
      setExporting(null);
    }
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
    if (mecanismo === 'revisao' && !enquadramentoValidado) {
      toast.error('Valide o enquadramento jurídico do fato gerador antes de gerar o pedido');
      setShowChecklist(true);
      return;
    }

    setGeneratingPedido(true);
    setPedidoGerado('');

    // Garante existência de um pedido jurídico (cabeçalho persistido)
    let pedido = pedidoAtivo;
    const dadosCaso = {
      indices: selectedIndices, ccts: selectedCCTs,
      itensComp: itensCompValidos, itensAfetados, observacoes,
      fatoGerador, tipoFato, anexos,
    };
    if (!pedido || pedido.tipo !== mecanismo) {
      pedido = await criarPedido({
        tipo: mecanismo,
        instrumento,
        processo_administrativo: processoAdm || undefined,
        pregao_numero: pregaoNum || undefined,
        ata_numero: ataNum || undefined,
        contrato_numero: contrato || undefined,
        aditivo_numero: aditivoNum || undefined,
        orgao_contratante: orgao || undefined,
        dados_caso: dadosCaso,
      });
      if (!pedido) { setGeneratingPedido(false); return; }
      setPedidoAtivo(pedido);
    }

    let conteudoFinal = '';
    await streamAIChat({
      messages: [{ role: 'user', content: buildPrompt() }],
      action: 'reequilibrio',
      onDelta: (chunk) => {
        conteudoFinal += chunk;
        setPedidoGerado(prev => prev + chunk);
      },
      onDone: async () => {
        if (pedido && conteudoFinal.trim()) {
          const proximaVersao = (pedido.versoes_count ?? 0) + 1;
          const v = await salvarVersao(
            pedido,
            conteudoFinal,
            `v${proximaVersao} — geração automática (${mecanismo})`,
            'gemini-2.5-flash'
          );
          if (v) {
            toast.success(`Versão v${v.versao} salva no pedido ${pedido.numero_formatado}`);
            setPedidoAtivo({ ...pedido, versoes_count: v.versao, versao_atual_id: v.id, status: 'gerado' });
          }
        }
        setGeneratingPedido(false);
      },
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
          <Button
            type="button"
            key={indice.id}
            variant="outline"
            aria-pressed={isSelected}
            className={`h-auto w-full justify-start whitespace-normal rounded-lg p-4 text-left font-normal shadow-sm [&_svg]:size-5 ${
              isSelected ? 'border-primary bg-primary-tint' : 'border-border bg-card'
            }`}
            onClick={() => toggleIndice(indice.id)}
          >
            <div className="flex w-full items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <CatIcon className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{indice.sigla}</p>
                  <Badge variant="info">{indice.fonte}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{indice.nome}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap tabular-nums">
                  <span className="text-xs font-medium">Valor: {indice.valor}</span>
                  <span className={`text-xs font-medium ${(indice.variacao_mensal || 0) >= 0 ? 'text-destructive' : 'text-success'}`}>
                    Mensal: {fmtPerc(indice.variacao_mensal)}
                  </span>
                  <span className={`text-xs font-medium ${(indice.acumulado_12m || 0) >= 0 ? 'text-destructive' : 'text-success'}`}>
                    12m: {fmtPerc(indice.acumulado_12m)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Período: {indice.periodo}</p>
              </div>
            </div>
          </Button>
        );
      })}
      {filteredIndices.length === 0 && (
        <div className="md:col-span-2 flex flex-col items-center text-center py-8 gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
            <TrendingUp className="w-6 h-6" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold">Nenhum índice encontrado</p>
          <Button variant="outline" onClick={() => navigate('/indices-repactuacao')}>Atualizar no Painel de Índices</Button>
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
          <Button
            type="button"
            key={cct.id}
            variant="outline"
            aria-pressed={isSelected}
            className={`h-auto w-full justify-start whitespace-normal rounded-lg p-4 text-left font-normal shadow-sm [&_svg]:size-5 ${
              isSelected ? 'border-primary bg-primary-tint' : 'border-border bg-card'
            }`}
            onClick={() => toggleCCT(cct.id)}
          >
            <div className="flex w-full items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">{cct.categoria_profissional}</p>
                  {vencida && <Badge variant="danger">Vencida</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{cct.sindicato_laboral || 'Sindicato não informado'}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap tabular-nums">
                  {cct.piso_salarial && <span className="text-xs font-medium">Piso: {fmtCur(cct.piso_salarial)}</span>}
                  {cct.reajuste_percentual && (
                    <span className="text-xs font-medium text-foreground">Reajuste: +{cct.reajuste_percentual}%</span>
                  )}
                  {cct.abrangencia_uf && <Badge variant="info">{cct.abrangencia_uf}</Badge>}
                  {cct.indice_reajuste && <Badge variant="info">{cct.indice_reajuste}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Vigência: {cct.vigencia_inicio || '?'} a {cct.vigencia_fim || '?'}
                </p>
              </div>
            </div>
          </Button>
        );
      })}
      {filteredCCTs.length === 0 && (
        <div className="md:col-span-2 flex flex-col items-center text-center py-8 gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
            <Users className="w-6 h-6" aria-hidden="true" />
          </span>
          <p className="text-base font-semibold">Nenhuma CCT cadastrada</p>
          <Button variant="outline" onClick={() => navigate('/indices-repactuacao')}>Cadastrar no Painel de Índices</Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Reajuste, Repactuação e Revisão com IA</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showLista ? 'default' : 'outline'}
            aria-pressed={showLista}
            onClick={() => setShowLista(s => !s)}
          >
            <FolderOpen aria-hidden="true" /> Meus Pedidos
          </Button>
          <Button variant="outline" onClick={() => {
            setPedidoAtivo(null); setPedidoGerado(''); setShowGenerator(false);
            toast.info('Novo pedido em branco — preencha os dados e gere');
          }}>
            <Plus aria-hidden="true" /> Novo Pedido
          </Button>
          <Button variant="outline" onClick={() => navigate('/indices-repactuacao')}>
            <TrendingUp aria-hidden="true" /> Painel de Índices
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Indicador de pedido ativo */}
      {pedidoAtivo && (
        <div className="rounded-md border border-border bg-muted p-3 flex items-center gap-3 flex-wrap">
          <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold whitespace-nowrap tabular-nums">{pedidoAtivo.numero_formatado}</span>
          <Badge variant="info" className="whitespace-nowrap tabular-nums">
            v{pedidoAtivo.versoes_count} · {pedidoAtivo.status}
          </Badge>
          <span className="text-sm text-muted-foreground truncate flex-1 min-w-[120px]">
            Cada nova geração cria automaticamente uma nova versão deste pedido.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPedidoAtivo(null)}>
            Desvincular
          </Button>
        </div>
      )}

      {/* Lista de pedidos existentes */}
      {showLista && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-lg font-semibold">Pedidos Jurídicos da Empresa</h4>
          </div>
          <PedidosJuridicosList
            onSelecionar={(p) => {
              setPedidoAtivo(p);
              if (p.tipo !== 'outros') setMecanismo(p.tipo);
              if (p.instrumento) setInstrumento(p.instrumento as Instrumento);
              if (p.processo_administrativo) setProcessoAdm(p.processo_administrativo);
              if (p.pregao_numero) setPregaoNum(p.pregao_numero);
              if (p.ata_numero) setAtaNum(p.ata_numero);
              if (p.contrato_numero) setContrato(p.contrato_numero);
              if (p.aditivo_numero) setAditivoNum(p.aditivo_numero);
              if (p.orgao_contratante) setOrgao(p.orgao_contratante);
              setShowGenerator(true);
              toast.success(`Pedido ${p.numero_formatado} carregado`);
            }}
          />
        </div>
      )}

      {/* Tabs for 3 mechanisms */}
      <Tabs value={mecanismo} onValueChange={(v) => { setMecanismo(v as Mecanismo); setShowGenerator(false); setPedidoGerado(''); }}>
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger value="reajuste" className="gap-1">
            <TrendingUp className="w-4 h-4" aria-hidden="true" /> Reajuste
          </TabsTrigger>
          <TabsTrigger value="repactuacao" className="gap-1">
            <Users className="w-4 h-4" aria-hidden="true" /> Repactuação
          </TabsTrigger>
          <TabsTrigger value="revisao" className="gap-1">
            <Scale className="w-4 h-4" aria-hidden="true" /> Revisão
          </TabsTrigger>
        </TabsList>

        {/* Mechanism info banner */}
        <div className="rounded-md border border-border bg-muted p-4 mt-4 space-y-1">
          <div className="flex items-center gap-2">
            <MecIcon className={`w-4 h-4 ${info.cor}`} aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">{info.titulo}</span>
          </div>
          <p className="text-sm text-muted-foreground">{info.descricao}</p>
          <p className="text-sm text-muted-foreground"><strong>Fundamento:</strong> {info.fundamento}</p>
          <p className="text-sm text-muted-foreground"><strong>Periodicidade:</strong> {info.periodicidade}</p>
        </div>

        {/* Search */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label htmlFor="reeq-busca" className="sr-only">Buscar</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="reeq-busca"
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
          <Button variant="default" onClick={() => {}}>
            <Search aria-hidden="true" />
            {mecanismo === 'reajuste'
              ? 'Buscar Índice'
              : mecanismo === 'repactuacao'
              ? 'Buscar CCT/Dissídio'
              : 'Buscar Comprovação'}
          </Button>
          {searchTerm && (
            <Button variant="ghost" onClick={() => setSearchTerm('')}>
              Limpar
            </Button>
          )}
          <Badge variant="info" className="whitespace-nowrap tabular-nums">
            {mecanismo === 'repactuacao'
              ? `${filteredIndices.length} índices · ${filteredCCTs.length} CCTs`
              : mecanismo === 'revisao'
              ? `${filteredIndices.length} índices de comprovação`
              : `${filteredIndices.length} índices contratuais`}
          </Badge>
        </div>

        {loadingData ? (
          <div className="space-y-3 mt-4" role="status" aria-label="Carregando índices e convenções">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* REAJUSTE TAB */}
            <TabsContent value="reajuste" className="space-y-4 mt-4">
              <div>
                <h4 className="text-base font-semibold mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Selecione o índice contratual ({filteredIndices.length})
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione o índice previsto no contrato para cálculo automático do reajuste anual por apostilamento.
                </p>
                {renderIndicesGrid()}
              </div>
            </TabsContent>

            {/* REPACTUAÇÃO TAB */}
            <TabsContent value="repactuacao" className="space-y-4 mt-4">
              <div>
                <h4 className="text-base font-semibold mb-1 flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> CCTs / Dissídios Coletivos ({filteredCCTs.length})
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione as convenções coletivas para demonstrar a variação dos custos de mão de obra (planilha antes/depois).
                </p>
                {renderCCTsGrid()}
              </div>
              <div>
                <h4 className="text-base font-semibold mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Índices complementares (opcional)
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Índices de insumos podem complementar a repactuação (ex: SINAPI para materiais).
                </p>
                {renderIndicesGrid()}
              </div>
            </TabsContent>

            {/* REVISÃO TAB */}
            <TabsContent value="revisao" className="space-y-4 mt-4">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" aria-hidden="true" />
                  <h4 className="text-lg font-semibold">Fato Gerador da Revisão</h4>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reeq-tipo-fato">Tipo do fato</Label>
                  <Select
                    value={tipoFato}
                    onValueChange={v => {
                      setTipoFato(v as typeof tipoFato);
                      setEnquadramentoValidado(false);
                      setShowChecklist(false);
                    }}
                  >
                    <SelectTrigger id="reeq-tipo-fato" className="h-auto min-h-11 whitespace-normal text-left [&>span]:line-clamp-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="caso_fortuito">Caso Fortuito (evento imprevisível — origem humana/interna: greves, atos de terceiros)</SelectItem>
                      <SelectItem value="forca_maior">Força Maior (evento irresistível — origem natural/externa: enchentes, pandemias)</SelectItem>
                      <SelectItem value="fato_principe">Fato do Príncipe (ato geral do Poder Público que onera indiretamente o contrato)</SelectItem>
                      <SelectItem value="fato_superveniente">Álea Econômica Extraordinária (Teoria da Imprevisão — art. 124, II, "d")</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Validação jurídica do enquadramento */}
                <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-border bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm" role="status">
                    {enquadramentoValidado ? (
                      <>
                        <Scale className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                        <span className="text-success font-medium">Enquadramento jurídico validado</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
                        <span className="text-muted-foreground">Valide o enquadramento antes de aceitar a classificação</span>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={enquadramentoValidado ? 'ghost' : 'outline'}
                    onClick={() => setShowChecklist(s => !s)}
                    className="shrink-0"
                  >
                    {showChecklist ? 'Ocultar checklist' : enquadramentoValidado ? 'Revisar checklist' : 'Validar enquadramento'}
                  </Button>
                </div>

                {showChecklist && (
                  <ChecklistFatoGerador
                    tipoFato={tipoFato}
                    onConfirm={() => {
                      setEnquadramentoValidado(true);
                      setShowChecklist(false);
                      toast.success('Enquadramento jurídico aceito.');
                    }}
                    onCancel={() => setShowChecklist(false)}
                  />
                )}

                <div className="space-y-2">
                  <Label htmlFor="reeq-fato-gerador">Descrição detalhada do fato gerador</Label>
                  <Textarea
                    id="reeq-fato-gerador"
                    placeholder="Descreva detalhadamente o fato que causou a onerosidade excessiva, quando ocorreu, e como impactou os custos do contrato..."
                    className="min-h-[100px]"
                    value={fatoGerador}
                    onChange={e => setFatoGerador(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-base font-semibold mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Índices para comprovação do impacto ({filteredIndices.length})
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
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
            className="w-full shadow-md"
            onClick={() => setShowGenerator(true)}
          >
            <Sparkles aria-hidden="true" />
            Gerar Pedido de {info.titulo.split('(')[0].trim()} ({totalSelected > 0 ? `${totalSelected} dados` : 'Revisão'})
          </Button>
        </div>
      ) : null}

      {/* Generator panel */}
      {showGenerator && (
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MecIcon className={`w-5 h-5 ${info.cor}`} aria-hidden="true" />
              <h3 className="text-lg font-semibold">Gerador: {info.titulo}</h3>
            </div>
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setShowGenerator(false)} aria-label="Fechar gerador">
              <X aria-hidden="true" />
            </Button>
          </div>

          {/* Selected data summary */}
          <div className="rounded-md border border-border bg-muted/50 p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Fundamentação selecionada:</strong>
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedIndices.map(id => {
                const i = indices.find(x => x.id === id);
                return i ? (
                  <Badge key={id} variant="info" className="tabular-nums">
                    {i.sigla} ({fmtPerc(i.acumulado_12m)} 12m)
                  </Badge>
                ) : null;
              })}
              {selectedCCTs.map(id => {
                const c = ccts.find(x => x.id === id);
                return c ? (
                  <Badge key={id} variant="info" className="tabular-nums">
                    CCT {c.categoria_profissional} ({c.reajuste_percentual ? `+${c.reajuste_percentual}%` : 'N/I'})
                  </Badge>
                ) : null;
              })}
              {mecanismo === 'revisao' && fatoGerador && (
                <Badge variant="warning">
                  Fato gerador: {tipoFato.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>

          {/* Tipo de instrumento contratual */}
          <div className="rounded-md border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Label htmlFor="reeq-instrumento" className="text-sm font-semibold">Instrumento atacado</Label>
            </div>
            <Select value={instrumento} onValueChange={(v) => setInstrumento(v as Instrumento)}>
              <SelectTrigger id="reeq-instrumento" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INSTRUMENTOS) as Instrumento[]).map(k => (
                  <SelectItem key={k} value={k}>{INSTRUMENTOS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{INSTRUMENTOS[instrumento].desc}</p>
            <p className="text-sm text-muted-foreground">
              <strong>Fundamento:</strong> {INSTRUMENTOS[instrumento].fundamento}
            </p>
          </div>

          {/* Identificação do processo (campos dinâmicos por instrumento) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reeq-orgao">Órgão Contratante</Label>
              <Input id="reeq-orgao" placeholder="Ex.: SEDUC/PA — Núcleo de Contratações" value={orgao} onChange={e => setOrgao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reeq-processo">Processo Administrativo nº</Label>
              <Input id="reeq-processo" placeholder="Ex.: E-2025/2821674" value={processoAdm} onChange={e => setProcessoAdm(e.target.value)} />
            </div>
            {(instrumento === 'edital' || instrumento === 'ata_srp' || instrumento === 'contrato' || instrumento === 'aditivo') && (
              <div className="space-y-2">
                <Label htmlFor="reeq-pregao">
                  {instrumento === 'edital' ? 'Edital/Pregão nº' : 'Pregão de origem nº'}
                </Label>
                <Input id="reeq-pregao" placeholder="Ex.: 90003/2024/SEDUC" value={pregaoNum} onChange={e => setPregaoNum(e.target.value)} />
              </div>
            )}
            {instrumento === 'ata_srp' && (
              <div className="space-y-2">
                <Label htmlFor="reeq-ata">ATA SRP nº</Label>
                <Input id="reeq-ata" placeholder="Ex.: ATA 045/2025" value={ataNum} onChange={e => setAtaNum(e.target.value)} />
              </div>
            )}
            {(instrumento === 'contrato' || instrumento === 'aditivo') && (
              <div className="space-y-2">
                <Label htmlFor="reeq-contrato">Contrato Administrativo nº</Label>
                <Input id="reeq-contrato" placeholder="Ex.: 068/2025" value={contrato} onChange={e => setContrato(e.target.value)} />
              </div>
            )}
            {instrumento === 'aditivo' && (
              <div className="space-y-2">
                <Label htmlFor="reeq-aditivo">Termo Aditivo nº</Label>
                <Input id="reeq-aditivo" placeholder="Ex.: 1º TA / 2026" value={aditivoNum} onChange={e => setAditivoNum(e.target.value)} />
              </div>
            )}
          </div>

          {/* Itens afetados — narrativa */}
          <div className="space-y-2">
            <Label htmlFor="reeq-itens-afetados">
              {mecanismo === 'repactuacao' ? 'Itens de MO afetados (narrativa)' : 'Itens afetados (narrativa)'}
            </Label>
            <Textarea
              id="reeq-itens-afetados"
              placeholder={
                mecanismo === 'reajuste' ? 'Ex.: Valor mensal do contrato R$ 50.000,00. Índice contratual: IPCA...' :
                mecanismo === 'repactuacao' ? 'Ex.: Servente: de R$ 1.780 para R$ 1.920 (CCT 2026)...' :
                'Ex.: Insumo X impactado por choque de oferta entre [data] e [data]...'
              }
              className="min-h-[70px]"
              value={itensAfetados}
              onChange={e => setItensAfetados(e.target.value)}
            />
          </div>

          {/* Tabela comparativa de preços — NF/cotação antes vs atual */}
          <div className="rounded-md border border-border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Receipt className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-semibold">Demonstração comparativa de preços</span>
                <Badge variant="info" className="tabular-nums">{itensCompValidos.length} válidos</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={addItemComp}>
                <Plus aria-hidden="true" /> Adicionar item
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Informe NFs de entrada e/ou cotações para comprovar a variação de preço entre a época do certame e o momento atual. Esta tabela será reproduzida no pedido como prova documental do desequilíbrio.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="text-left p-2 text-sm font-semibold whitespace-nowrap">Descrição</th>
                    <th scope="col" className="text-left p-2 text-sm font-semibold whitespace-nowrap">Un.</th>
                    <th scope="col" className="text-right p-2 text-sm font-semibold whitespace-nowrap">Qtd.</th>
                    <th scope="col" className="text-right p-2 text-sm font-semibold whitespace-nowrap">Preço à época</th>
                    <th scope="col" className="text-right p-2 text-sm font-semibold whitespace-nowrap">Preço atual</th>
                    <th scope="col" className="text-right p-2 text-sm font-semibold whitespace-nowrap">Var. %</th>
                    <th scope="col" className="text-left p-2 text-sm font-semibold whitespace-nowrap">NF/Cotação à época</th>
                    <th scope="col" className="text-left p-2 text-sm font-semibold whitespace-nowrap">NF/Cotação atual</th>
                    <th scope="col" className="p-2"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {itensComp.map(it => {
                    const v = calcVariacao(it.precoAntes, it.precoAtual);
                    return (
                      <tr key={it.id} className="border-b border-border">
                        <td className="p-1"><Input aria-label="Descrição do item" className="min-w-[160px]" value={it.descricao} onChange={e => updItemComp(it.id, { descricao: e.target.value })} placeholder="Ex.: Cimento CP-II" /></td>
                        <td className="p-1"><Input aria-label="Unidade" className="w-20" value={it.unidade} onChange={e => updItemComp(it.id, { unidade: e.target.value })} /></td>
                        <td className="p-1"><Input aria-label="Quantidade" className="w-24 text-right tabular-nums" type="number" value={it.quantidade || ''} onChange={e => updItemComp(it.id, { quantidade: parseFloat(e.target.value) || 0 })} /></td>
                        <td className="p-1"><Input aria-label="Preço à época" className="w-28 text-right tabular-nums" type="number" step="0.01" value={it.precoAntes || ''} onChange={e => updItemComp(it.id, { precoAntes: parseFloat(e.target.value) || 0 })} /></td>
                        <td className="p-1"><Input aria-label="Preço atual" className="w-28 text-right tabular-nums" type="number" step="0.01" value={it.precoAtual || ''} onChange={e => updItemComp(it.id, { precoAtual: parseFloat(e.target.value) || 0 })} /></td>
                        <td className={`p-1 text-right font-semibold whitespace-nowrap tabular-nums ${v >= 0 ? 'text-destructive' : 'text-success'}`}>
                          {it.precoAntes > 0 ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '—'}
                        </td>
                        <td className="p-1"><Input aria-label="NF ou cotação à época" className="min-w-[160px]" value={it.fonteAntes} onChange={e => updItemComp(it.id, { fonteAntes: e.target.value })} placeholder="NF nº / Fornecedor / data" /></td>
                        <td className="p-1"><Input aria-label="NF ou cotação atual" className="min-w-[160px]" value={it.fonteAtual} onChange={e => updItemComp(it.id, { fonteAtual: e.target.value })} placeholder="NF nº / Fornecedor / data" /></td>
                        <td className="p-1">
                          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive-tint" onClick={() => rmItemComp(it.id)} disabled={itensComp.length === 1} aria-label="Remover item">
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anexos probatórios (descrição) */}
          <div className="space-y-2">
            <Label htmlFor="reeq-anexos" className="flex items-center gap-1">
              <Paperclip className="w-4 h-4 text-muted-foreground" aria-hidden="true" /> Relação de anexos probatórios
            </Label>
            <Textarea
              id="reeq-anexos"
              placeholder="Ex.: NFs de entrada à época do certame (págs. 99-106); Cotações mercadológicas — duas propostas (págs. 107-111); NFs atuais (págs. 112-118); 5ª alteração contratual; Carteira de Identidade da representante legal."
              className="min-h-[70px]"
              value={anexos}
              onChange={e => setAnexos(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Os arquivos físicos podem ser anexados na aba "Anexos" da Pasta do Processo (workspace).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reeq-observacoes">Observações adicionais</Label>
            <Textarea id="reeq-observacoes" placeholder="Informações complementares..." className="min-h-[60px]" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          <div className="rounded-md border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Fundamentação automática:</strong> {info.fundamento}
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleGerarPedido}
            disabled={generatingPedido}
          >
            {generatingPedido ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {generatingPedido ? 'Gerando...' : `Gerar Pedido de ${info.titulo.split('(')[0].trim()}`}
          </Button>

          {pedidoGerado && (
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h4 className="text-lg font-semibold">Pedido Gerado pela IA</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={copyToClipboard}>Copiar</Button>
                  <Button variant="outline" onClick={exportarWord} disabled={!!exporting}>
                    {exporting === 'word' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
                    Word (.doc)
                  </Button>
                  <Button onClick={exportarPDF} disabled={!!exporting}>
                    {exporting === 'pdf' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
                    PDF (ABNT)
                  </Button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                <ReactMarkdown>{pedidoGerado}</ReactMarkdown>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
