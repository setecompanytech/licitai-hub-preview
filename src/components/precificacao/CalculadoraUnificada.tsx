import { useState, useEffect, useCallback, useMemo } from 'react';
import { UNIDADES } from '@/lib/unidades';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useIndicadoresGerenciais } from '@/hooks/useIndicadoresGerenciais';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { formarPreco, precoEhPossivel, somaDasCamadas } from '@/lib/precificacao/formacao-preco';
import { montarPlanilhaComposicao, nomeDoArquivoComposicao } from '@/lib/precificacao/planilha-composicao';
import { buildExcelBlob } from '@/lib/excel-utils';
import { useProcessoWorkspace } from '@/hooks/useProcessoWorkspace';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EstadoVazio from '@/components/shared/EstadoVazio';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import {
  Calculator, Bot, Loader2, FileText, Plus, Download, ExternalLink, MapPin, Building2,
  ShieldCheck, Sparkles, TrendingUp, Info, BookOpen, Package, Wrench, HardHat, Save, Users,
  Lightbulb, ArrowRight, Trash2,
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import ComposicaoResultado from './ComposicaoResultado';
import ComposicaoDeterministica from './ComposicaoDeterministica';
import ServicoMDOCalculadora from './ServicoMDOCalculadora';
import ServicoEngenhariaCalculadora from './ServicoEngenhariaCalculadora';
import LicitacaoSelector, { type LicitacaoItemAutoFill } from './LicitacaoSelector';
import { useRascunho } from '@/hooks/useRascunho';
import {
  calcularComposicao,
  type ComposicaoResult,
  type ComposicaoItemInput,
  type ComposicaoParametros,
} from '@/lib/composicao-engine';
import AnaliseRegimeTributario from './AnaliseRegimeTributario';
import {
  ANEXOS_SIMPLES, getAnexoById,
  calcularSimplesNacional, getPartilhaSimplesReal, formatCurrencyShort,
  type AnexoSimples,
} from '@/data/simples-nacional-anexos';

// ── UF Database ──
const UF_ICMS: Record<string, { nome: string; icms_interno: number; iss_min: number; iss_max: number }> = {
  AC: { nome: 'Acre', icms_interno: 19, iss_min: 2, iss_max: 5 },
  AL: { nome: 'Alagoas', icms_interno: 19, iss_min: 2, iss_max: 5 },
  AP: { nome: 'Amapá', icms_interno: 18, iss_min: 2, iss_max: 5 },
  AM: { nome: 'Amazonas', icms_interno: 20, iss_min: 2, iss_max: 5 },
  BA: { nome: 'Bahia', icms_interno: 20.5, iss_min: 2, iss_max: 5 },
  CE: { nome: 'Ceará', icms_interno: 20, iss_min: 2, iss_max: 5 },
  DF: { nome: 'Distrito Federal', icms_interno: 20, iss_min: 2, iss_max: 5 },
  ES: { nome: 'Espírito Santo', icms_interno: 17, iss_min: 2, iss_max: 5 },
  GO: { nome: 'Goiás', icms_interno: 19, iss_min: 2, iss_max: 5 },
  MA: { nome: 'Maranhão', icms_interno: 22, iss_min: 2, iss_max: 5 },
  MT: { nome: 'Mato Grosso', icms_interno: 17, iss_min: 2, iss_max: 5 },
  MS: { nome: 'Mato Grosso do Sul', icms_interno: 17, iss_min: 2, iss_max: 5 },
  MG: { nome: 'Minas Gerais', icms_interno: 18, iss_min: 2, iss_max: 5 },
  PA: { nome: 'Pará', icms_interno: 19, iss_min: 2, iss_max: 5 },
  PB: { nome: 'Paraíba', icms_interno: 20, iss_min: 2, iss_max: 5 },
  PR: { nome: 'Paraná', icms_interno: 19.5, iss_min: 2, iss_max: 5 },
  PE: { nome: 'Pernambuco', icms_interno: 20.5, iss_min: 2, iss_max: 5 },
  PI: { nome: 'Piauí', icms_interno: 21, iss_min: 2, iss_max: 5 },
  RJ: { nome: 'Rio de Janeiro', icms_interno: 22, iss_min: 2, iss_max: 5 },
  RN: { nome: 'Rio Grande do Norte', icms_interno: 20, iss_min: 2, iss_max: 5 },
  RS: { nome: 'Rio Grande do Sul', icms_interno: 17, iss_min: 2, iss_max: 5 },
  RO: { nome: 'Rondônia', icms_interno: 19.5, iss_min: 2, iss_max: 5 },
  RR: { nome: 'Roraima', icms_interno: 20, iss_min: 2, iss_max: 5 },
  SC: { nome: 'Santa Catarina', icms_interno: 17, iss_min: 2, iss_max: 5 },
  SP: { nome: 'São Paulo', icms_interno: 18, iss_min: 2, iss_max: 5 },
  SE: { nome: 'Sergipe', icms_interno: 19, iss_min: 2, iss_max: 5 },
  TO: { nome: 'Tocantins', icms_interno: 20, iss_min: 2, iss_max: 5 },
};

// ── Regime Config ──
type RegimeConfig = {
  label: string;
  description: string;
  tributos: { nome: string; aliquota: number; base: 'receita' | 'lucro'; info: string }[];
};

const REGIMES: Record<string, RegimeConfig> = {
  simples_nacional: {
    label: 'Simples Nacional',
    description: 'Regime unificado para ME e EPP com faturamento até R$ 4,8 milhões/ano.',
    tributos: [
      { nome: 'IRPJ', aliquota: 0, base: 'receita', info: 'Incluído na alíquota efetiva do DAS' },
      { nome: 'CSLL', aliquota: 0, base: 'receita', info: 'Incluído na alíquota efetiva do DAS' },
      { nome: 'COFINS', aliquota: 0, base: 'receita', info: 'Incluído na alíquota efetiva do DAS' },
      { nome: 'PIS/PASEP', aliquota: 0, base: 'receita', info: 'Incluído na alíquota efetiva do DAS' },
      { nome: 'CPP', aliquota: 0, base: 'receita', info: 'Incluído na alíquota efetiva do DAS' },
      { nome: 'ICMS', aliquota: 0, base: 'receita', info: 'Incluído na alíquota efetiva do DAS' },
    ],
  },
  lucro_presumido: {
    label: 'Lucro Presumido',
    description: 'Regime para empresas com faturamento até R$ 78 milhões/ano.',
    tributos: [
      { nome: 'IRPJ', aliquota: 15, base: 'lucro', info: 'Base: 8% (comércio) ou 32% (serviços) da receita bruta.' },
      { nome: 'CSLL', aliquota: 9, base: 'lucro', info: 'Base: 12% (comércio) ou 32% (serviços) da receita bruta.' },
      { nome: 'COFINS', aliquota: 3, base: 'receita', info: 'Regime cumulativo sobre receita bruta.' },
      { nome: 'PIS/PASEP', aliquota: 0.65, base: 'receita', info: 'Regime cumulativo sobre receita bruta.' },
      { nome: 'ISS', aliquota: 5, base: 'receita', info: 'De 2% a 5% sobre serviços (varia por município).' },
      { nome: 'ICMS', aliquota: 18, base: 'receita', info: 'Varia por estado (7% a 25%).' },
    ],
  },
  lucro_real: {
    label: 'Lucro Real',
    description: 'Regime obrigatório para faturamento acima de R$ 78 milhões/ano.',
    tributos: [
      { nome: 'IRPJ', aliquota: 15, base: 'lucro', info: '15% sobre lucro real.' },
      { nome: 'CSLL', aliquota: 9, base: 'lucro', info: '9% sobre o lucro real apurado.' },
      { nome: 'COFINS', aliquota: 7.6, base: 'receita', info: 'Regime não-cumulativo.' },
      { nome: 'PIS/PASEP', aliquota: 1.65, base: 'receita', info: 'Regime não-cumulativo.' },
      { nome: 'ISS', aliquota: 5, base: 'receita', info: 'De 2% a 5% sobre serviços.' },
      { nome: 'ICMS', aliquota: 18, base: 'receita', info: 'Varia por estado.' },
    ],
  },
};

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCurrencyInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  if (num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrencyInput = (formatted: string): number => {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

type AtividadeType = 'comercio' | 'servicos' | 'industria';

type ItemCusto = {
  descricao: string;
  quantidade: string;
  unidade: string;
  custoUnitario: string;
  ncm: string;
};

interface CalculadoraUnificadaProps {
  licitacaoId?: string | null;
  licitacaoNumero?: string;
  licitacaoOrgao?: string;
}

export default function CalculadoraUnificada({
  licitacaoId = null,
  licitacaoNumero: licitacaoNumeroProp = '',
  licitacaoOrgao: licitacaoOrgaoProp = '',
}: CalculadoraUnificadaProps) {
  const { empresaAtiva } = useEmpresa();
  const { addItem } = usePropostaCart();
  const { user } = useAuth();
  const regime = empresaAtiva?.regime_tributario || '';
  const config = REGIMES[regime];
  const ufEmpresa = empresaAtiva?.uf || '';
  const cnae = empresaAtiva?.cnae_principal || '';

  // ── Auto-detection logic based on CNAE + regime ──
  const detectTipoCalculo = (): { tipo: 'produto_bdi' | 'servico_engenharia' | 'servico_mdo'; motivo: string } => {
    const cnaePrefix = cnae.substring(0, 2);
    const cnaeGroup = cnae.substring(0, 4);
    // Engenharia / Construção: CNAE 41-43
    if (['41', '42', '43'].includes(cnaePrefix)) {
      return { tipo: 'servico_engenharia', motivo: `CNAE ${cnae} indica atividade de construção/engenharia` };
    }
    // Serviços de limpeza, vigilância, manutenção predial: CNAE 81
    if (cnaePrefix === '81') {
      return { tipo: 'servico_mdo', motivo: `CNAE ${cnae} indica serviço com dedicação exclusiva de mão de obra` };
    }
    // Vigilância: CNAE 80
    if (cnaePrefix === '80') {
      return { tipo: 'servico_mdo', motivo: `CNAE ${cnae} indica serviço de vigilância/segurança (MDO contínua)` };
    }
    // Serviços administrativos terceirizados: CNAE 82
    if (cnaePrefix === '82') {
      return { tipo: 'servico_mdo', motivo: `CNAE ${cnae} indica serviço administrativo terceirizado` };
    }
    // TI / Consultoria: CNAE 62, 63
    if (['62', '63'].includes(cnaePrefix)) {
      return { tipo: 'servico_engenharia', motivo: `CNAE ${cnae} indica serviço de TI/consultoria (BDI de serviços comuns)` };
    }
    // Comércio: CNAE 45-47
    if (['45', '46', '47'].includes(cnaePrefix)) {
      return { tipo: 'produto_bdi', motivo: `CNAE ${cnae} indica atividade comercial (fornecimento de produtos)` };
    }
    // Indústria: CNAE 10-33
    const prefixNum = parseInt(cnaePrefix, 10);
    if (prefixNum >= 10 && prefixNum <= 33) {
      return { tipo: 'produto_bdi', motivo: `CNAE ${cnae} indica atividade industrial (fornecimento de produtos)` };
    }
    // Default: produtos
    return { tipo: 'produto_bdi', motivo: 'Tipo padrão — selecione manualmente conforme o objeto da licitação' };
  };

  const deteccao = cnae ? detectTipoCalculo() : null;

  // 3 tabs: produto_bdi, servico_engenharia, servico_mdo
  const [calcTab, setCalcTab] = useState<'produto_bdi' | 'servico_engenharia' | 'servico_mdo'>(
    deteccao?.tipo || 'produto_bdi'
  );
  const [usouSugestao, setUsouSugestao] = useState(deteccao ? calcTab === deteccao.tipo : false);

  // ── Shared state ──
  const [receitaBruta, setReceitaBruta] = useState('');
  const [rbt12, setRbt12] = useState('');
  const [atividade, setAtividade] = useState<AtividadeType>('comercio');
  const [margemLucro, setMargemLucro] = useState('15');
  const [ufCalculo, setUfCalculo] = useState(ufEmpresa || 'PA');
  const [resultado, setResultado] = useState<any>(null);
  const [anexoSelecionado, setAnexoSelecionado] = useState('anexo_i');
  const [showTabelaPartilha, setShowTabelaPartilha] = useState(false);

  // ── Produto/BDI state ──
  const [frete, setFrete] = useState('');
  const [despesasAdmin, setDespesasAdmin] = useState('');
  const [usarBDI, setUsarBDI] = useState(false);
  const [itens, setItens] = useState<ItemCusto[]>([
    { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '', ncm: '' },
  ]);
  const [iaResult, setIaResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviarProposta, setEnviarProposta] = useState(false);
  /**
   * O processo com que esta calculadora está trabalhando.
   *
   * Começa no que a página trouxe (o Processo Ativo) e passa a seguir o que o
   * seletor escolher. Antes, escolher no seletor mudava só o texto do número e
   * do órgão: a tela dizia "vinculado ao processo X" e mandava os itens para o
   * lugar de Y — ou para lugar nenhum.
   */
  const [licitacaoIdSel, setLicitacaoIdSel] = useState<string | null>(licitacaoId);
  const { uploadAnexo } = useProcessoWorkspace(licitacaoIdSel);
  const [composicaoResult, setComposicaoResult] = useState<ComposicaoResult | null>(null);

  // (Serviços MDO state moved to ServicoMDOCalculadora component)

  // ── Catálogo / Licitação ──
  const [licitacaoNumero, setLicitacaoNumero] = useState('');
  const [licitacaoOrgao, setLicitacaoOrgao] = useState('');
  const [savingCatalogo, setSavingCatalogo] = useState(false);
  const [engItensAutoFill, setEngItensAutoFill] = useState<{ descricao: string; quantidade: number; unidade: string; custoUnitario: number }[]>([]);

  // ── Rascunho (Draft) ──
  const { loadRascunho, autoSave, saving, lastSaved, markLoaded } = useRascunho<any>({
    modulo: 'precificacao',
    licitacaoId: licitacaoId || null,
    debounceMs: 3000,
  });

  useEffect(() => {
    setLicitacaoNumero(licitacaoNumeroProp || '');
    setLicitacaoOrgao(licitacaoOrgaoProp || '');
    setLicitacaoIdSel(licitacaoId);
  }, [licitacaoId, licitacaoNumeroProp, licitacaoOrgaoProp]);

  const collectCalcData = useCallback(() => ({
    calcTab, receitaBruta, rbt12, atividade, margemLucro, ufCalculo,
    anexoSelecionado, frete, despesasAdmin, usarBDI, itens,
    licitacaoNumero, licitacaoOrgao,
  }), [
    calcTab, receitaBruta, rbt12, atividade, margemLucro, ufCalculo,
    anexoSelecionado, frete, despesasAdmin, usarBDI, itens,
    licitacaoNumero, licitacaoOrgao,
  ]);

  // Restore draft on mount
  useEffect(() => {
    loadRascunho().then(data => {
      if (data) {
        if (data.calcTab) setCalcTab(data.calcTab);
        if (data.receitaBruta) setReceitaBruta(data.receitaBruta);
        if (data.rbt12) setRbt12(data.rbt12);
        if (data.atividade) setAtividade(data.atividade);
        if (data.margemLucro) setMargemLucro(data.margemLucro);
        if (data.ufCalculo) setUfCalculo(data.ufCalculo);
        if (data.anexoSelecionado) setAnexoSelecionado(data.anexoSelecionado);
        if (data.frete) setFrete(data.frete);
        if (data.despesasAdmin) setDespesasAdmin(data.despesasAdmin);
        if (typeof data.usarBDI === 'boolean') setUsarBDI(data.usarBDI);
        if (data.itens?.length > 0) setItens(data.itens);
        if (data.licitacaoNumero) setLicitacaoNumero(data.licitacaoNumero);
        if (data.licitacaoOrgao) setLicitacaoOrgao(data.licitacaoOrgao);
        toast.info('Rascunho da calculadora restaurado.');
      }
      markLoaded();
    });
  }, [loadRascunho, markLoaded]);

  // Auto-fill RBT12 from faturamento_mensal (Configurações → Regime Tributário)
  const [rbt12Auto, setRbt12Auto] = useState<number | null>(null);
  // A ponte com o Financeiro (ver useIndicadoresGerenciais).
  const { indicadores, adotado } = useIndicadoresGerenciais(12);
  useEffect(() => {
    if (!empresaAtiva?.id) return;
    supabase
      .from('faturamento_mensal' as any)
      .select('valor_faturamento')
      .eq('empresa_id', empresaAtiva.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const total = (data as any[]).reduce((s: number, r: any) => s + (Number(r.valor_faturamento) || 0), 0);
          if (total > 0) {
            setRbt12Auto(total);
            // Only auto-fill if user hasn't manually set a value
            setRbt12(prev => {
              if (!prev || parseCurrencyInput(prev) === 0) {
                return total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
              return prev;
            });
            // A receita mensal é OUTRA coisa que o RBT12 — é a base sobre a
            // qual a alíquota incide, e o RBT12 é quem define a alíquota. Mas
            // digitá-la à mão a cada cálculo, tendo os doze meses cadastrados,
            // é trabalho sem propósito: a média mensal é o melhor palpite, e
            // continua editável para o mês atípico.
            setReceitaBruta(prev => {
              if (!prev || parseCurrencyInput(prev) === 0) {
                return (total / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
              return prev;
            });
          }
        }
      });
  }, [empresaAtiva?.id]);

  // Auto-save on form changes
  useEffect(() => {
    const data = collectCalcData();
    const titulo = licitacaoNumero ? `Precificação — ${licitacaoNumero}` : 'Precificação (sem licitação)';
    autoSave(data, titulo);
  }, [collectCalcData, autoSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hooks ANTES de qualquer return condicional. Eu havia posto os dois abaixo
  // no meio do componente, depois do `return` deste `if` — `rules-of-hooks`
  // violado derruba a tela em branco, e foi assim que a página de contrato
  // caiu nesta semana.
  /**
   * As camadas que saem do preço, do jeito que a tela as tem.
   *
   * `pctImpostos` vem do resultado do simulador quando ele já rodou — é a
   * alíquota EFETIVA do regime, não a nominal. Sem simulação, fica zero e o
   * aviso abaixo cobra o cálculo: preço formado sem imposto é preço errado
   * para baixo, e em licitação isso não se perde, se ganha.
   */
  const camadasDoPreco = useMemo(() => ({
    pctImpostos: resultado
      ? (regime === 'simples_nacional'
          ? Number(resultado.aliquotaEfetiva) || 0
          : (Number(resultado.receita) > 0
              ? (Number(resultado.totalTributos) / Number(resultado.receita)) * 100
              : 0))
      : 0,
    pctDespesasAdmin: parseFloat(despesasAdmin) || 0,
    pctDespesasOperacionais: parseFloat(frete) || 0,
    pctMargem: parseFloat(margemLucro) || 15,
  }), [resultado, regime, despesasAdmin, frete, margemLucro]);
  const [anexandoPlanilha, setAnexandoPlanilha] = useState(false);

  if (!regime || !config) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <EstadoVazio
          tamanho="compacto"
          icone={<Calculator />}
          titulo="Regime tributário não definido"
          descricao="Defina o regime tributário no cadastro da empresa (Empresas → Editar) para usar a calculadora."
          acao={<Badge variant="outline">Simples Nacional • Lucro Presumido • Lucro Real</Badge>}
        />
      </div>
    );
  }

  const ufInfo = UF_ICMS[ufCalculo];
  const regimeLabel = config.label;
  const icmsUF = ufInfo?.icms_interno || 18;
  const anexoAtual = getAnexoById(anexoSelecionado) || ANEXOS_SIMPLES[0];

  const getTributosComAliquotas = () => {
    if (regime === 'simples_nacional') {
      const faturamento12 = parseCurrencyInput(rbt12);
      if (faturamento12 > 0) {
        const partilha = getPartilhaSimplesReal(faturamento12, anexoAtual, icmsUF, ufInfo?.iss_max || 5);
        if (partilha) return partilha;
      }
      return config.tributos.map(t => ({ nome: t.nome, aliquota: t.aliquota, percentPartilha: 0, info: t.info }));
    }
    if (regime === 'lucro_presumido') {
      const baseIRPJ = atividade === 'servicos' ? 32 : 8;
      const baseCSLL = atividade === 'servicos' ? 32 : 12;
      const irpjEfetivo = Math.round(15 * baseIRPJ) / 100; // ex: 1.2% comércio, 4.8% serviços
      const csllEfetivo = Math.round(9 * baseCSLL) / 100;   // ex: 1.08% comércio, 2.88% serviços
      return [
        { nome: 'IRPJ', aliquota: irpjEfetivo, percentPartilha: 0, info: `15% × base presumida ${baseIRPJ}% = ${irpjEfetivo}% efetivo s/ receita` },
        { nome: 'CSLL', aliquota: csllEfetivo, percentPartilha: 0, info: `9% × base presumida ${baseCSLL}% = ${csllEfetivo}% efetivo s/ receita` },
        { nome: 'COFINS', aliquota: 3, percentPartilha: 0, info: 'Cumulativo: 3%' },
        { nome: 'PIS/PASEP', aliquota: 0.65, percentPartilha: 0, info: 'Cumulativo: 0,65%' },
        ...(atividade === 'servicos' ? [{ nome: 'ISS', aliquota: ufInfo?.iss_max || 5, percentPartilha: 0, info: 'ISS municipal' }] : []),
        ...(atividade !== 'servicos' ? [{ nome: 'ICMS', aliquota: icmsUF, percentPartilha: 0, info: `ICMS ${ufCalculo}: ${icmsUF}%` }] : []),
      ];
    }
    // Lucro Real: IRPJ/CSLL incidem sobre lucro, não receita. Estimativa efetiva com base na margem informada.
    const margemPctLR = parseFloat(margemLucro) || 15;
    const irpjEfetivoLR = Math.round(15 * margemPctLR) / 100;    // ex: 15% × 15% margem = 2.25%
    const csllEfetivoLR = Math.round(9 * margemPctLR) / 100;     // ex: 9% × 15% margem = 1.35%
    // Adicional de 10% sobre lucro acima de R$20k/mês (estimativa)
    const receitaEstimada = parseCurrencyInput(receitaBruta) || 100000;
    const lucroEstimado = receitaEstimada * (margemPctLR / 100);
    const adicionalIRPJ = lucroEstimado > 20000 ? Math.round(10 * ((lucroEstimado - 20000) / receitaEstimada) * 100) / 100 : 0;
    return [
      { nome: 'IRPJ', aliquota: irpjEfetivoLR + adicionalIRPJ, percentPartilha: 0, info: `15% × margem ${margemPctLR}% = ${irpjEfetivoLR}% efetivo${adicionalIRPJ > 0 ? ` + ${adicionalIRPJ}% adicional (lucro > R$20mil)` : ''}` },
      { nome: 'CSLL', aliquota: csllEfetivoLR, percentPartilha: 0, info: `9% × margem ${margemPctLR}% = ${csllEfetivoLR}% efetivo s/ receita` },
      { nome: 'COFINS', aliquota: 7.6, percentPartilha: 0, info: 'Não-cumulativo: 7,6%' },
      { nome: 'PIS/PASEP', aliquota: 1.65, percentPartilha: 0, info: 'Não-cumulativo: 1,65%' },
      ...(atividade === 'servicos' ? [{ nome: 'ISS', aliquota: ufInfo?.iss_max || 5, percentPartilha: 0, info: 'ISS municipal' }] : []),
      ...(atividade !== 'servicos' ? [{ nome: 'ICMS', aliquota: icmsUF, percentPartilha: 0, info: `ICMS ${ufCalculo}: ${icmsUF}%` }] : []),
    ];
  };

  const tributosAtivos = getTributosComAliquotas();

  // ── Calcular tributos + lucro ──
  const calcular = () => {
    const receita = parseCurrencyInput(receitaBruta);
    if (!receita || receita <= 0) {
      toast.error('Informe a receita bruta mensal.');
      return;
    }

    const margemPct = parseFloat(margemLucro) || 15;
    const margem = margemPct / 100;
    const fretePerc = parseFloat(frete) || 0;
    const despAdmPerc = parseFloat(despesasAdmin) || 0;

    // Custos operacionais
    const custoFrete = receita * (fretePerc / 100);
    const custoDespAdm = receita * (despAdmPerc / 100);
    const totalCustosOp = custoFrete + custoDespAdm;

    if (regime === 'simples_nacional') {
      const faturamento12 = parseCurrencyInput(rbt12) || receita * 12;
      const simples = calcularSimplesNacional(faturamento12, anexoAtual);
      const totalTributos = simples.valorDAS;
      const lucroBruto = receita - totalTributos;
      const lucroLiquido = lucroBruto - totalCustosOp;
      const margemLiquidaPct = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
      const pontoEquilibrio = margemLiquidaPct > 0 ? totalTributos / (margemLiquidaPct / 100) : 0;

      setResultado({
        regime: 'simples_nacional', receita, rbt12: faturamento12,
        aliquotaEfetiva: simples.aliquotaEfetiva, valorDAS: simples.valorDAS, faixa: simples.faixa,
        tributos: [{ nome: 'DAS (Unificado)', valor: simples.valorDAS, aliquota: simples.aliquotaEfetiva }],
        totalTributos, anexo: anexoAtual.nome,
        // Profit fields
        lucroBruto, lucroLiquido, margemLiquidaPct,
        custoFrete, custoDespAdm, totalCustosOp,
        margemLucroPct: margemPct, pontoEquilibrio,
      });
    } else {
      const lucro = receita * margem;
      const basePresuncaoIRPJ = atividade === 'servicos' ? 0.32 : 0.08;
      const basePresuncaoCSLL = atividade === 'servicos' ? 0.32 : 0.12;
      const tributos = config.tributos.map(t => {
        let valor = 0;
        if (regime === 'lucro_presumido') {
          if (t.nome === 'IRPJ') { const base = receita * basePresuncaoIRPJ; valor = base * (t.aliquota / 100); }
          else if (t.nome === 'CSLL') { valor = receita * basePresuncaoCSLL * (t.aliquota / 100); }
          else if (t.nome === 'ISS' && atividade !== 'servicos') valor = 0;
          else if (t.nome === 'ICMS' && atividade === 'servicos') valor = 0;
          else if (t.nome === 'ICMS') valor = receita * (icmsUF / 100);
          else valor = receita * (t.aliquota / 100);
        } else {
          if (t.base === 'lucro') { valor = lucro * (t.aliquota / 100); if (t.nome === 'IRPJ' && lucro > 20000) valor += (lucro - 20000) * 0.1; }
          else if (t.nome === 'ISS' && atividade !== 'servicos') valor = 0;
          else if (t.nome === 'ICMS' && atividade === 'servicos') valor = 0;
          else if (t.nome === 'ICMS') valor = receita * (icmsUF / 100);
          else valor = receita * (t.aliquota / 100);
        }
        return { nome: t.nome, valor, aliquota: t.nome === 'ICMS' ? icmsUF : t.aliquota, info: t.info };
      });
      const filtrados = tributos.filter(t => t.valor > 0);
      const totalTributos = filtrados.reduce((s, t) => s + t.valor, 0);
      const lucroBruto = receita - totalTributos;
      const lucroLiquido = lucroBruto - totalCustosOp;
      const margemLiquidaPct = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
      const cargaEfetiva = (totalTributos / receita) * 100;
      const pontoEquilibrio = margemLiquidaPct > 0 ? (totalTributos + totalCustosOp) / (margemLiquidaPct / 100) : 0;

      setResultado({
        regime, receita, lucro, margem: margem * 100,
        tributos: filtrados, totalTributos, cargaEfetiva,
        // Profit fields
        lucroBruto, lucroLiquido, margemLiquidaPct,
        custoFrete, custoDespAdm, totalCustosOp,
        margemLucroPct: margemPct, pontoEquilibrio,
      });
    }
  };

  // ── Composição Determinística ──
  const gerarComposicaoDeterministica = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Informe pelo menos um item.'); return; }

    const inputs: ComposicaoItemInput[] = validItens.map(item => ({
      descricao: item.descricao,
      quantidade: parseFloat(item.quantidade) || 1,
      unidade: item.unidade,
      custoUnitario: parseCurrencyInput(item.custoUnitario),
    }));

    const params: ComposicaoParametros = {
      regime: regime as 'simples_nacional' | 'lucro_presumido' | 'lucro_real',
      uf: ufCalculo,
      icmsInterno: icmsUF,
      issRate: ufInfo?.iss_max || 5,
      atividade,
      margemLucroPerc: parseFloat(margemLucro) || 15,
      fretePerc: parseFloat(frete) || 0,
      despesasAdmPerc: parseFloat(despesasAdmin) || 0,
      rbt12: parseCurrencyInput(rbt12) || undefined,
      anexoId: anexoSelecionado,
    };

    const result = calcularComposicao(inputs, params);
    setComposicaoResult(result);
    toast.success('Composição de custo calculada com sucesso!');
  };

  // ── Composição BDI via IA (enrichment) ──
  const gerarComposicaoBDI = async () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Informe pelo menos um item.'); return; }
    setLoading(true);
    setIaResult('');
    const itensTexto = validItens.map((item, idx) => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      return `Item ${idx + 1}: ${item.descricao}${item.ncm ? ` (NCM: ${item.ncm})` : ''} | Qtd: ${qtd} ${item.unidade} | Custo Unitário: R$ ${custo.toFixed(2)}`;
    }).join('\n');
    const freteVal = parseFloat(frete) || 0;
    const despAdm = parseFloat(despesasAdmin) || 0;
    const margem = parseFloat(margemLucro) || 15;
    const tributosSummary = tributosAtivos.map(t => `   - ${t.nome}: ${t.aliquota}%`).join('\n');
    const prompt = `Gere a PLANILHA DE COMPOSIÇÃO DE CUSTO E FORMAÇÃO DE PREÇO conforme Lei nº 14.133/2021.
DADOS: Regime: ${regimeLabel}, UF: ${ufCalculo}, ICMS: ${icmsUF}%, Atividade: ${atividade}, Margem: ${margem}%, Frete: ${freteVal}%, Desp. Adm: ${despAdm}%
ALÍQUOTAS:\n${tributosSummary}\nITENS:\n${itensTexto}
Responda EXCLUSIVAMENTE em JSON com: itens[{descricao,quantidade,unidade,componentes[{componente,baseCalculo,aliquota,valor}],custoUnitario,precoUnitarioFormado,precoTotal}], resumo{custoTotalMateriais,totalTributos,bdiTotal,bdiPercentual,freteTotal,despesasAdm,margemLucro,precoTotalFormado,precoExtenso}, parecer{viabilidade,margemLiquida,alertaInexequibilidade,observacoes}`;
    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'composicao_custo',
        onDelta: (d) => setIaResult(prev => prev + d),
        onDone: () => { setLoading(false); toast.success('Composição BDI gerada pela IA!'); },
        onError: (err) => { toast.error('Erro: ' + err); setLoading(false); },
      });
    } catch { setLoading(false); toast.error('Erro ao conectar com a IA.'); }
  };
  // ── Item management ──
  const addItemRow = () => setItens(prev => [...prev, { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '', ncm: '' }]);
  const updateItem = (i: number, field: keyof ItemCusto, value: string) => setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const removeItem = (i: number) => { if (itens.length > 1) setItens(prev => prev.filter((_, idx) => idx !== i)); };


  /**
   * A composição de preços vira peça do processo.
   *
   * Calcular a composição e deixá-la na tela não serve: ela é o documento que
   * a Administração pede quando a proposta chega abaixo do que ela orçou, e
   * sem ele a proposta é desclassificada por não comprovar o que afirma
   * (Lei 14.133/2021, art. 59, §§ 3º e 4º). O lugar dela é a pasta do
   * processo, junto do edital e da habilitação — não a pasta de downloads de
   * quem calculou.
   */

  const anexarComposicaoAoProcesso = async () => {
    if (!licitacaoIdSel) {
      toast.error('Vincule a licitação antes de anexar.', {
        description: 'A planilha precisa saber a que processo pertence.',
      });
      return;
    }
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Nenhum item válido para compor.'); return; }
    if (!precoEhPossivel(camadasDoPreco)) {
      toast.error('Não existe preço possível com esses percentuais.');
      return;
    }

    setAnexandoPlanilha(true);
    try {
      const { linhas, larguras, total } = montarPlanilhaComposicao(
        validItens.map((i) => ({
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: parseFloat(i.quantidade) || 1,
          custoUnitario: parseCurrencyInput(i.custoUnitario),
        })),
        camadasDoPreco,
        {
          empresa: empresaAtiva?.razao_social ?? '—',
          cnpj: empresaAtiva?.cnpj ?? null,
          processo: licitacaoNumero || null,
          orgao: licitacaoOrgao || null,
          regime: regime || null,
          emitidoEm: new Date().toLocaleDateString('pt-BR'),
        },
      );
      const blob = await buildExcelBlob([
        { name: 'Composição de Preços', data: linhas, colWidths: larguras },
      ]);
      const nome = nomeDoArquivoComposicao(licitacaoNumero);
      const arquivo = new File([blob], nome, { type: blob.type });

      const anexo = await uploadAnexo(arquivo, 'proposta',
        `Composição analítica de preços — total ${formatCurrency(total)}`,
        { origem: 'calculadora_precificacao', total, camadas: camadasDoPreco },
      );
      if (anexo) {
        toast.success('Planilha anexada ao processo', {
          description: `${nome} · pasta do processo, aba Proposta.`,
        });
      }
    } catch (e) {
      toast.error('Não foi possível gerar a planilha.', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setAnexandoPlanilha(false);
    }
  };

  const enviarParaProposta = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Nenhum item válido.'); return; }

    // Sem processo, os itens iriam para um carrinho solto e ninguém saberia de
    // qual licitação eles são. O vínculo lá de cima passa a valer aqui embaixo.
    if (!licitacaoIdSel) {
      toast.error('Vincule a licitação antes de enviar.', {
        description: 'Sem o processo, os itens não têm para onde ir — use "Vincular à Licitação" no topo da página.',
      });
      return;
    }

    /**
     * O preço enviado é o preço FORMADO, não custo × margem.
     *
     * A conta anterior tratava a margem como se incidisse sobre o custo e
     * ignorava imposto, frete e despesa administrativa por completo. Com
     * imposto de 19%, despesa de 7%, frete de 3% e margem de 15%, ela mandava
     * R$ 115,00 onde o preço é R$ 178,57 — e vender a R$ 115,00 dá prejuízo de
     * R$ 18,35 por unidade numa proposta apresentada como 15% de lucro.
     * Ver src/lib/precificacao/formacao-preco.ts.
     */
    if (!precoEhPossivel(camadasDoPreco)) {
      toast.error('Não existe preço possível com esses percentuais.', {
        description: `Impostos, despesas e margem somam ${somaDasCamadas(camadasDoPreco).toFixed(2)}% do preço.`,
      });
      return;
    }
    if (!resultado) {
      toast.warning('Calcule os tributos antes de enviar.', {
        description: 'Sem a alíquota efetiva do regime, o preço sai sem imposto — baixo demais.',
      });
      return;
    }

    validItens.forEach((item, idx) => {
      const p = formarPreco(
        parseCurrencyInput(item.custoUnitario),
        parseFloat(item.quantidade) || 1,
        camadasDoPreco,
      );
      addItem({
        item: String(idx + 1), descricao: item.descricao, quantidade: String(p.quantidade), unidade: item.unidade,
        marca: '', fabricante: '', modelo: '',
        valorUnitario: p.precoUnitario.toFixed(2).replace('.', ','), valorUnitarioExtenso: valorPorExtenso(p.precoUnitario),
        valorTotal: p.precoTotal.toFixed(2).replace('.', ','), valorTotalExtenso: valorPorExtenso(p.precoTotal),
      });
    });
    toast.success(`${validItens.length} item(ns) enviado(s) à proposta`, {
      description: `Processo ${licitacaoNumero || licitacaoIdSel} · preço formado com ${somaDasCamadas(camadasDoPreco).toFixed(1)}% de impostos, despesas e margem.`,
    });
  };

  const salvarNoCatalogo = async () => {
    if (!user) { toast.error('Faça login para salvar no catálogo'); return; }
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Nenhum item válido para salvar.'); return; }
    setSavingCatalogo(true);
    const margem = parseFloat(margemLucro) || 15;
    const markup = 1 + margem / 100;
    const freteVal = parseFloat(frete) || 0;
    const bdiVal = parseFloat(despesasAdmin) || 0;
    const rows = validItens.map(item => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      const precoUnit = custo * markup;
      return {
        user_id: user.id, tipo_calculo: usarBDI ? 'produto_bdi' : 'produto',
        descricao: item.descricao, quantidade: qtd, unidade: item.unidade,
        custo_unitario: custo, preco_unitario: Math.round(precoUnit * 100) / 100,
        preco_total: Math.round(precoUnit * qtd * 100) / 100,
        licitacao_id: licitacaoId || null,
        margem_lucro: margem, tributos_total: resultado?.totalTributos || 0,
        frete_percentual: freteVal, bdi_percentual: bdiVal, regime_tributario: regime,
        licitacao_numero: licitacaoNumero || null, licitacao_orgao: licitacaoOrgao || null,
      };
    });
    const { error } = await supabase.from('catalogo_itens_precificados').insert(rows);
    if (error) { toast.error('Erro ao salvar no catálogo'); console.error(error); }
    else { toast.success(`${rows.length} item(ns) salvo(s) no catálogo!`); }
    setSavingCatalogo(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-base font-semibold leading-6 text-foreground">
              Calculadoras de Precificação — {regimeLabel}
            </h3>
          </div>
          {/* Recurso de IA: o selo "Praefectus IA" no lugar do chip "IA Contábil". */}
          <div className="flex flex-wrap items-center gap-2">
            {lastSaved && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {saving ? 'Salvando...' : `Salvo ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            <SeloPraefectusIA />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>

        {/* 2 Calculator Tabs — fila sublinhada da ui, rolável no celular. */}
        <div className="mt-4">
          <Tabs value={calcTab} onValueChange={(v) => { setCalcTab(v as any); setUsouSugestao(false); }}>
            <TabsList className="flex-nowrap overflow-x-auto [scrollbar-width:thin]">
              <TabsTrigger value="produto_bdi" className="shrink-0">
                <Package className="h-4 w-4" aria-hidden="true" /> Produtos / BDI
              </TabsTrigger>
              <TabsTrigger value="servico_engenharia" className="shrink-0">
                <HardHat className="h-4 w-4" aria-hidden="true" /> Engenharia / BDI
              </TabsTrigger>
              <TabsTrigger value="servico_mdo" className="shrink-0">
                <Users className="h-4 w-4" aria-hidden="true" /> Mão de Obra (IN 5)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ── Auto-detection recommendation banner ── */}
        {deteccao && calcTab !== deteccao.tipo && (
          <div className="mt-3 flex flex-wrap items-start gap-2 rounded-md border border-border bg-secondary p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Sugestão automática com base no CNAE da empresa</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{deteccao.motivo}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => { setCalcTab(deteccao.tipo); setUsouSugestao(true); }}
            >
              Aplicar <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        )}
        {deteccao && calcTab === deteccao.tipo && usouSugestao && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-secondary p-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Tipo selecionado automaticamente: <strong className="text-foreground">{deteccao.motivo}</strong>
            </p>
          </div>
        )}

        {/* ── Regime filter badges ── */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">
            <Building2 className="h-3 w-3" aria-hidden="true" /> {regimeLabel}
          </Badge>
          <Badge variant="secondary">
            <MapPin className="h-3 w-3" aria-hidden="true" /> {ufCalculo} — ICMS {icmsUF}%
          </Badge>
          {cnae && (
            <Badge variant="secondary">
              CNAE: {cnae}
            </Badge>
          )}
          {regime === 'simples_nacional' && (
            <Badge variant="secondary">
              <BookOpen className="h-3 w-3" aria-hidden="true" /> {anexoAtual.nome}
            </Badge>
          )}
          {empresaAtiva && (
            <Badge variant="outline">{empresaAtiva.razao_social}</Badge>
          )}
        </div>

        {/* Tab descriptions */}
        <div className="mt-3 rounded-md bg-secondary p-3">
          {calcTab === 'produto_bdi' && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Fornecimento de Produtos:</strong> Calcule custo, margem, impostos, frete e BDI para produtos/mercadorias. Ative "Composição BDI" para planilha detalhada conforme Lei 14.133/2021.
            </p>
          )}
          {calcTab === 'servico_engenharia' && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Serviços de Engenharia:</strong> Composição de BDI conforme Acórdão TCU 2622/2013 com encargos sociais, tributos "por dentro" e fórmula oficial. Para obras e serviços comuns de engenharia.
            </p>
          )}
          {calcTab === 'servico_mdo' && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Mão de Obra Contínua:</strong> Planilha de Custos conforme Anexo VII-D da IN nº 5/2017 (SEGES/MP). Estrutura com os 6 módulos obrigatórios para serviços continuados com dedicação exclusiva de mão de obra.
            </p>
          )}
        </div>
      </div>

      {/* ── Vinculação com Licitação (Smart Selector) ── */}
      <LicitacaoSelector
        licitacaoId={licitacaoIdSel}
        onLicitacaoSelecionada={(id) => setLicitacaoIdSel(id)}
        licitacaoNumero={licitacaoNumero}
        setLicitacaoNumero={setLicitacaoNumero}
        licitacaoOrgao={licitacaoOrgao}
        setLicitacaoOrgao={setLicitacaoOrgao}
        onItensLoaded={(loadedItens: LicitacaoItemAutoFill[]) => {
          const newItens: ItemCusto[] = loadedItens.map((li) => ({
            descricao: li.descricao,
            quantidade: String(li.quantidade),
            unidade: li.unidade,
            custoUnitario: li.valorUnitario > 0
              ? li.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '',
            ncm: '',
          }));

          setItens(
            newItens.length > 0
              ? newItens
              : [{ descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '', ncm: '' }]
          );

          setEngItensAutoFill(loadedItens.map((li) => ({
            descricao: li.descricao,
            quantidade: li.quantidade,
            unidade: li.unidade,
            custoUnitario: li.valorUnitario,
          })));
        }}
      />

      {/* ── Seletor de Anexo (só Simples Nacional) ── */}
      {regime === 'simples_nacional' && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Anexo do Simples Nacional
            </h4>
            <Badge variant="outline">Resolução CGSN nº 140/2018</Badge>
          </div>
          <Select value={anexoSelecionado} onValueChange={setAnexoSelecionado}>
            <SelectTrigger aria-label="Anexo do Simples Nacional"><SelectValue placeholder="Selecione o Anexo" /></SelectTrigger>
            <SelectContent>
              {ANEXOS_SIMPLES.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{anexoAtual.descricao}</p>
          <div className="flex items-center gap-3">
            <Switch id="calc-tabela-partilha" checked={showTabelaPartilha} onCheckedChange={setShowTabelaPartilha} />
            <Label htmlFor="calc-tabela-partilha" className="font-normal text-muted-foreground">Exibir tabela oficial de faixas e partilha</Label>
          </div>
          {showTabelaPartilha && (
            <div className="overflow-hidden rounded-md border border-border">
              {/* Faixa em vigor = linha selecionada da `ui/table` (tinta verde),
                  em vez de bordas cinzentas desenhadas à mão. */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa</TableHead>
                    <TableHead className="text-right">Alíquota</TableHead>
                    <TableHead className="text-right">Dedução</TableHead>
                    <TableHead>RBT12</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anexoAtual.faixas.map(f => {
                    const rbt12Val = parseCurrencyInput(rbt12);
                    const isActive = rbt12Val >= f.min && rbt12Val <= f.max;
                    return (
                      <TableRow
                        key={f.faixaNum}
                        data-state={isActive ? 'selected' : undefined}
                        className={isActive ? 'font-semibold' : ''}
                      >
                        <TableCell nowrap>{f.faixaNum}ª Faixa</TableCell>
                        <TableCell className="text-right tabular-nums">{f.aliquota.toFixed(2)}%</TableCell>
                        <TableCell className="text-right tabular-nums">{f.deducao > 0 ? formatCurrency(f.deducao) : '—'}</TableCell>
                        <TableCell className="tabular-nums">{f.min === 0 ? 'Até' : `De ${formatCurrency(f.min)} a`} {formatCurrency(f.max)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Parâmetros do Cálculo (shared) ── */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
          <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Parâmetros do Cálculo
        </h4>
        {/* Rótulo acima do campo (13/500), campos de 40px, grade que colapsa
            numa coluna no celular. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="calc-receita-bruta">Receita Bruta Mensal (R$) *</Label>
            <Input id="calc-receita-bruta" value={receitaBruta} onChange={e => setReceitaBruta(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" />
            {rbt12Auto && rbt12Auto > 0 && (
              <p className="flex items-start gap-1 text-xs text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  Média dos 12 meses cadastrados. É a base sobre a qual a alíquota
                  incide — quem define a alíquota é o RBT12 ao lado.
                </span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-uf">UF para Cálculo *</Label>
            <Select value={ufCalculo} onValueChange={setUfCalculo}>
              <SelectTrigger id="calc-uf"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(UF_ICMS).sort((a, b) => a[1].nome.localeCompare(b[1].nome)).map(([uf, info]) => (
                  <SelectItem key={uf} value={uf}>{uf} — {info.nome} (ICMS {info.icms_interno}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {regime === 'simples_nacional' ? (
            <div className="space-y-1.5">
              <Label htmlFor="calc-rbt12">RBT12 (Faturamento 12m)</Label>
              <Input id="calc-rbt12" value={rbt12} onChange={e => setRbt12(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" />
              {rbt12Auto && rbt12Auto > 0 && (
                <p className="flex items-start gap-1 text-xs text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Preenchido automaticamente via Configurações ({rbt12Auto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="calc-margem">Margem de Lucro (%)</Label>
              <Input id="calc-margem" type="number" value={margemLucro} onChange={e => setMargemLucro(e.target.value)} placeholder="15" min={0} max={100} />
            </div>
          )}
          {regime !== 'simples_nacional' && (
            <div className="space-y-1.5">
              <Label htmlFor="calc-atividade">Atividade Principal</Label>
              <Select value={atividade} onValueChange={(v: AtividadeType) => setAtividade(v)}>
                <SelectTrigger id="calc-atividade"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercio">Comércio</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="industria">Indústria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={calcular} className="w-full sm:w-auto">
            <Calculator aria-hidden="true" /> Calcular Tributos
          </Button>
        </div>
      </div>

      {/* ── Alíquotas ── */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-3 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Alíquotas Tributárias — {regimeLabel} / {ufCalculo}
        </h4>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {tributosAtivos.map((t: any) => (
            <div key={t.nome} className="space-y-1 rounded-md border border-border bg-secondary p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{t.nome}</span>
                  <TooltipProvider><Tooltip><TooltipTrigger aria-label={`Sobre ${t.nome}`} className="inline-flex shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /></TooltipTrigger><TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{t.info}</p></TooltipContent></Tooltip></TooltipProvider>
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground">{t.aliquota.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Resultado Tributos + Lucro ── */}
      {resultado && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Resultado da Simulação — Tributos & Lucro
          </h4>

          {/* KPI Cards - Row 1: Receita, Tributos, Carga — anatomia do cartão
              KPI (rótulo 13/500, valor 24/600 tabular, alinhado à esquerda). */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{formatCurrency(resultado.receita)}</p>
            </div>
            <div className="rounded-lg border border-destructive-line bg-destructive-tint p-4">
              <p className="text-sm font-medium text-muted-foreground">Total Tributos</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-destructive-ink">{formatCurrency(resultado.totalTributos)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Carga Efetiva</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">
                {regime === 'simples_nacional' ? `${resultado.aliquotaEfetiva.toFixed(2)}%` : `${resultado.cargaEfetiva.toFixed(2)}%`}
              </p>
            </div>
          </div>

          {/* KPI Cards - Row 2: Lucro */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Lucro Bruto</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{formatCurrency(resultado.lucroBruto)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Receita − Tributos</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">Custos Operacionais</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{formatCurrency(resultado.totalCustosOp)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Frete + Desp. Adm.</p>
            </div>
            <div className={`rounded-lg border p-4 ${resultado.lucroLiquido >= 0 ? 'border-success-line bg-success-tint' : 'border-destructive-line bg-destructive-tint'}`}>
              <p className="text-sm font-medium text-muted-foreground">Lucro Líquido</p>
              <p className={`mt-1 text-2xl font-semibold leading-8 tabular-nums ${resultado.lucroLiquido >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
                {formatCurrency(resultado.lucroLiquido)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">L. Bruto − Custos Op.</p>
            </div>
            <div className={`rounded-lg border p-4 ${resultado.margemLiquidaPct >= 5 ? 'border-success-line bg-success-tint' : resultado.margemLiquidaPct >= 0 ? 'border-warning-line bg-warning-tint' : 'border-destructive-line bg-destructive-tint'}`}>
              <p className="text-sm font-medium text-muted-foreground">Margem Líquida</p>
              <p className={`mt-1 text-2xl font-semibold leading-8 tabular-nums ${resultado.margemLiquidaPct >= 5 ? 'text-success-ink' : resultado.margemLiquidaPct >= 0 ? 'text-warning-ink' : 'text-destructive-ink'}`}>
                {resultado.margemLiquidaPct.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {resultado.margemLiquidaPct < 5 && resultado.margemLiquidaPct >= 0 ? '⚠ Risco inexequibilidade' : resultado.margemLiquidaPct < 0 ? '🚫 Prejuízo' : '✓ Saudável'}
              </p>
            </div>
          </div>

          {/* Detalhamento dos Tributos */}
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-muted-foreground">Detalhamento dos Tributos</h5>
            {resultado.tributos.map((t: any) => (
              <div key={t.nome} className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2">
                <span className="text-sm font-medium text-foreground">{t.nome} <span className="text-muted-foreground">({t.aliquota.toFixed(2)}%)</span></span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(t.valor)}</span>
              </div>
            ))}
          </div>

          {/* Detalhamento dos Custos Operacionais */}
          {resultado.totalCustosOp > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-muted-foreground">Custos Operacionais</h5>
              {resultado.custoFrete > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2">
                  <span className="text-sm font-medium text-foreground">Frete <span className="text-muted-foreground">({parseFloat(frete) || 0}%)</span></span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(resultado.custoFrete)}</span>
                </div>
              )}
              {resultado.custoDespAdm > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2">
                  <span className="text-sm font-medium text-foreground">Despesas Administrativas <span className="text-muted-foreground">({parseFloat(despesasAdmin) || 0}%)</span></span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(resultado.custoDespAdm)}</span>
                </div>
              )}
            </div>
          )}

          {/* Demonstração de Resultado — totais na superfície rebaixada,
              dígitos tabulares (Inter, não mono). */}
          <div className="space-y-2 rounded-md border border-border bg-secondary p-4">
            <h5 className="mb-2 text-sm font-semibold text-foreground">DRE Simplificada (Demonstração do Resultado)</h5>
            <div className="flex justify-between gap-3 text-sm">
              <span>Receita Bruta</span>
              <span className="font-semibold tabular-nums">{formatCurrency(resultado.receita)}</span>
            </div>
            <div className="flex justify-between gap-3 text-sm text-destructive-ink">
              <span>(−) Tributos</span>
              <span className="font-semibold tabular-nums">({formatCurrency(resultado.totalTributos)})</span>
            </div>
            <div className="my-1 border-t border-border" />
            <div className="flex justify-between gap-3 text-sm font-semibold">
              <span>= Lucro Bruto</span>
              <span className="tabular-nums text-foreground">{formatCurrency(resultado.lucroBruto)}</span>
            </div>
            {resultado.totalCustosOp > 0 && (
              <>
                <div className="flex justify-between gap-3 text-sm text-muted-foreground">
                  <span>(−) Custos Operacionais</span>
                  <span className="tabular-nums">({formatCurrency(resultado.totalCustosOp)})</span>
                </div>
                <div className="my-1 border-t border-border" />
              </>
            )}
            <div className={`flex justify-between gap-3 text-sm font-semibold ${resultado.lucroLiquido >= 0 ? 'text-success-ink' : 'text-destructive-ink'}`}>
              <span>= Lucro Líquido</span>
              <span className="tabular-nums">{formatCurrency(resultado.lucroLiquido)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3 text-sm text-muted-foreground">
              <span>Margem Líquida</span>
              <span className="tabular-nums">{resultado.margemLiquidaPct.toFixed(2)}%</span>
            </div>
          </div>

          {/* Alerta de inexequibilidade */}
          {resultado.margemLiquidaPct < 5 && resultado.margemLiquidaPct >= 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning-line bg-warning-tint p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-warning-ink">Alerta de Inexequibilidade — Art. 59, Lei 14.133/2021</p>
                <p className="mt-0.5 text-sm text-warning-ink/90">
                  Margem líquida abaixo de 5% pode configurar proposta inexequível. Revise os custos ou aumente a margem de lucro.
                </p>
              </div>
            </div>
          )}
          {resultado.lucroLiquido < 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive-line bg-destructive-tint p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive-ink" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-destructive-ink">⚠ Operação com Prejuízo</p>
                <p className="mt-0.5 text-sm text-destructive-ink/90">
                  Os tributos e custos operacionais excedem a receita. Essa operação gera prejuízo de {formatCurrency(Math.abs(resultado.lucroLiquido))}.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: PRODUTOS E COMPOSIÇÃO BDI ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {calcTab === 'produto_bdi' && (
        <>
          {/* BDI toggle */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Switch id="calc-usar-bdi" checked={usarBDI} onCheckedChange={setUsarBDI} className="mt-0.5" />
              <div>
                <Label htmlFor="calc-usar-bdi" className="text-base font-medium leading-5">Ativar Composição BDI (Lei 14.133/2021)</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gera planilha detalhada de composição de custos com BDI, encargos, frete e despesas administrativas via IA.
                </p>
              </div>
            </div>
            {usarBDI && (
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="calc-frete">Frete Estimado (%)</Label>
                  <Input id="calc-frete" type="number" value={frete} onChange={e => setFrete(e.target.value)} placeholder="0" min={0} max={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="calc-desp-adm">Despesas Administrativas (%)</Label>
                  <Input id="calc-desp-adm" type="number" value={despesasAdmin} onChange={e => setDespesasAdmin(e.target.value)} placeholder="0" min={0} max={100} />
                  {/* A ponte com o Financeiro: o percentual que a estrutura da
                      empresa realmente consome, apurado dos lançamentos
                      conciliados. Continua EDITÁVEL — preço é decisão
                      comercial, e um certame pode justificar apertar a
                      estrutura; o que não pode é o número ser inventado por
                      falta de referência. */}
                  {/* A versão ADOTADA manda sobre a apuração do momento: preço
                      não pode oscilar conforme a hora em que a proposta foi
                      montada. O apurado só aparece como referência, e quando
                      diverge da adotada, a tela diz — é o sinal de revisar. */}
                  {adotado?.pct_despesa_administrativa != null ? (
                    <p className="flex items-start gap-1 text-xs">
                      <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="text-muted-foreground">
                        Em vigor:{' '}
                        <button
                          type="button"
                          onClick={() => setDespesasAdmin(String(adotado.pct_despesa_administrativa))}
                          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {adotado.pct_despesa_administrativa.toLocaleString('pt-BR')}%
                        </button>{' '}
                        (adotado em {new Date(adotado.adotado_em).toLocaleDateString('pt-BR')}, base de {adotado.meses} meses).
                        {indicadores?.pct_despesa_administrativa != null
                          && Math.abs(indicadores.pct_despesa_administrativa - adotado.pct_despesa_administrativa) >= 0.5 && (
                          <span className="text-warning-ink">
                            {' '}O Financeiro apura hoje {indicadores.pct_despesa_administrativa.toLocaleString('pt-BR')}% —
                            revise em Configurações → Regime Tributário.
                          </span>
                        )}
                      </span>
                    </p>
                  ) : indicadores?.pct_despesa_administrativa != null && (
                    <p className="flex items-start gap-1 text-xs">
                      <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="text-muted-foreground">
                        O Financeiro apurou{' '}
                        <button
                          type="button"
                          onClick={() => setDespesasAdmin(String(indicadores.pct_despesa_administrativa))}
                          className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {indicadores.pct_despesa_administrativa.toLocaleString('pt-BR')}%
                        </button>{' '}
                        nos últimos {indicadores.periodo.meses} meses
                        {' '}({indicadores.media_mensal.despesa_operacional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                        {' '}sobre {indicadores.media_mensal.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de receita).
                        {!indicadores.confiavel && (
                          <span className="text-warning-ink">
                            {' '}Atenção: {indicadores.cobertura.despesa?.toLocaleString('pt-BR') ?? 0}% das despesas
                            têm categoria — classifique o resto na Conciliação para o número fechar.
                          </span>
                        )}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Itens de Produto
              </h4>
              <Button variant="outline" size="sm" onClick={addItemRow}>
                <Plus aria-hidden="true" /> Adicionar Item
              </Button>
            </div>
            {/* Doze colunas só a partir de `sm`; no celular a linha do item vira
                duas colunas, com descrição em largura cheia. */}
            {itens.map((item, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-3 sm:grid-cols-12 sm:items-end">
                <div className="col-span-2 space-y-1.5 sm:col-span-4">
                  <Label htmlFor={`calc-item-${idx}-descricao`}>Descrição *</Label>
                  <Input id={`calc-item-${idx}-descricao`} value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Ex: Notebook Dell Inspiron 15" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`calc-item-${idx}-ncm`}>NCM</Label>
                  <Input id={`calc-item-${idx}-ncm`} value={item.ncm} onChange={e => updateItem(idx, 'ncm', e.target.value)} placeholder="0000.00.00" />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor={`calc-item-${idx}-qtd`}>Qtd</Label>
                  <Input id={`calc-item-${idx}-qtd`} className="tabular-nums" value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} placeholder="1" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`calc-item-${idx}-unidade`}>Unidade</Label>
                  <Select value={item.unidade} onValueChange={v => updateItem(idx, 'unidade', v)}>
                    <SelectTrigger id={`calc-item-${idx}-unidade`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map(u => u.codigo).map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`calc-item-${idx}-custo`}>Custo Unit. (R$) *</Label>
                  <Input id={`calc-item-${idx}-custo`} className="tabular-nums" value={item.custoUnitario} onChange={e => updateItem(idx, 'custoUnitario', formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" />
                </div>
                <div className="flex justify-end sm:col-span-1 sm:justify-start">
                  {itens.length > 1 && (
                    <Button variant="ghost-destructive" size="icon-sm" onClick={() => removeItem(idx)} aria-label={`Remover item ${idx + 1}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <Switch id="calc-enviar-proposta" checked={enviarProposta} onCheckedChange={setEnviarProposta} className="mt-0.5" />
                <div>
                  <Label htmlFor="calc-enviar-proposta" className="text-base font-medium leading-5">Integrar à Proposta Comercial</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Enviar preços formados à proposta</p>
                </div>
              </div>
              {enviarProposta && (
                <Button variant="outline" onClick={enviarParaProposta}>
                  <FileText aria-hidden="true" /> Enviar à Proposta
                </Button>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <Button variant="outline" onClick={salvarNoCatalogo} disabled={savingCatalogo} className="w-full">
                {savingCatalogo ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Salvar no Catálogo de Itens Precificados
              </Button>
            </div>
          </div>

          {/* ── Análise de Regime Tributário ── */}
          <AnaliseRegimeTributario
            ufCalculo={ufCalculo}
            ufNome={ufInfo?.nome || ''}
            regime={regime}
            regimeLabel={regimeLabel}
            itens={itens.map(i => ({ descricao: i.descricao, ncm: i.ncm }))}
            onNcmUpdate={(idx, ncm) => updateItem(idx, 'ncm', ncm)}
          />

          {usarBDI ? (
            <div className="space-y-3">
              {/* Uma ação principal por contexto: o motor determinístico é a
                  primária (44px); IA e anexo são secundárias em contorno. */}
              <Button onClick={gerarComposicaoDeterministica} className="w-full" size="lg">
                <Calculator aria-hidden="true" />
                Calcular Composição de Custo (Motor Determinístico)
              </Button>
              <Button onClick={gerarComposicaoBDI} disabled={loading} variant="outline" className="w-full">
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                Gerar Composição via IA Contábil (alternativo)
              </Button>

              {/* A composição é peça do processo, não relatório de tela.
                  Quando a proposta chega abaixo do que a Administração orçou,
                  é esta planilha que demonstra a exequibilidade — e sem ela a
                  proposta é desclassificada por não comprovar o que afirma
                  (Lei 14.133/2021, art. 59, §§ 3º e 4º). */}
              <Button
                onClick={anexarComposicaoAoProcesso}
                disabled={anexandoPlanilha || !licitacaoIdSel}
                variant="outline"
                className="w-full"
              >
                {anexandoPlanilha
                  ? <Loader2 className="animate-spin" aria-hidden="true" />
                  : <FileText aria-hidden="true" />}
                {licitacaoIdSel
                  ? `Anexar planilha à pasta do processo${licitacaoNumero ? ` ${licitacaoNumero}` : ''}`
                  : 'Vincule a licitação para anexar a planilha ao processo'}
              </Button>
            </div>
          ) : (
            <Button onClick={calcular} disabled={!receitaBruta} className="w-full" size="lg">
              <Calculator aria-hidden="true" /> Calcular Preço do Produto
            </Button>
          )}

          {composicaoResult && (
            <ComposicaoDeterministica
              result={composicaoResult}
              onResultChange={setComposicaoResult}
              regimeLabel={regimeLabel}
              ufCalculo={ufCalculo}
              ufNome={ufInfo?.nome || ''}
            />
          )}

          {iaResult && !composicaoResult && <ComposicaoResultado iaResult={iaResult} regimeLabel={regimeLabel} ufCalculo={ufCalculo} ufNome={ufInfo?.nome || ''} />}
        </>
      )}

      {/* ── TAB: SERVIÇOS DE ENGENHARIA ── */}
      {calcTab === 'servico_engenharia' && (
        <ServicoEngenhariaCalculadora
          key={engItensAutoFill.length > 0 ? `eng-${engItensAutoFill.length}` : 'eng-default'}
          regimeLabel={regimeLabel}
          regime={regime}
          ufCalculo={ufCalculo}
          ufNome={ufInfo?.nome || ''}
          licitacaoNumero={licitacaoNumero}
          licitacaoOrgao={licitacaoOrgao}
          initialItens={engItensAutoFill.length > 0 ? engItensAutoFill : undefined}
        />
      )}

      {/* ── TAB: SERVIÇOS COM MÃO DE OBRA ── */}
      {calcTab === 'servico_mdo' && (
        <ServicoMDOCalculadora
          licitacaoId={licitacaoId}
          regimeLabel={regimeLabel}
          regime={regime}
          ufCalculo={ufCalculo}
          ufNome={ufInfo?.nome || ''}
          licitacaoNumero={licitacaoNumero}
          licitacaoOrgao={licitacaoOrgao}
        />
      )}
    </div>
  );
}
