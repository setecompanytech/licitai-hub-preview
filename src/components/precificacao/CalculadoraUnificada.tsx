import { useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
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
import {
  Calculator, Bot, Loader2, FileText, Plus, Download, ExternalLink, MapPin, Building2,
  ShieldCheck, Sparkles, TrendingUp, Info, BookOpen, Package, Wrench, HardHat, Save, Users
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import ComposicaoResultado from './ComposicaoResultado';
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
};

export default function CalculadoraUnificada() {
  const { empresaAtiva } = useEmpresa();
  const { addItem } = usePropostaCart();
  const { user } = useAuth();
  const regime = empresaAtiva?.regime_tributario || '';
  const config = REGIMES[regime];
  const ufEmpresa = empresaAtiva?.uf || '';

  // 2 tabs: produto_bdi (unified) and servico_mdo (labor services IN 5/2017)
  const [calcTab, setCalcTab] = useState<'produto_bdi' | 'servico_mdo'>('produto_bdi');

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
    { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '' },
  ]);
  const [iaResult, setIaResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviarProposta, setEnviarProposta] = useState(false);

  // ── Serviços MDO (IN 5/2017) state ──
  const [salarioBase, setSalarioBase] = useState('');
  const [adicPericulosidade, setAdicPericulosidade] = useState('0');
  const [adicInsalubridade, setAdicInsalubridade] = useState('0');
  const [adicNoturno, setAdicNoturno] = useState('0');
  const [qtdProfissionais, setQtdProfissionais] = useState('1');
  const [cargaHoraria, setCargaHoraria] = useState('44');
  const [valeTransporte, setValeTransporte] = useState('');
  const [valeAlimentacao, setValeAlimentacao] = useState('');
  const [uniformes, setUniformes] = useState('');
  const [epiMateriais, setEpiMateriais] = useState('');
  const [equipamentos, setEquipamentos] = useState('');
  const [custoIndiretoPerc, setCustoIndiretoPerc] = useState('5');
  const [lucroPerc, setLucroPerc] = useState('10');
  const [mdoIaResult, setMdoIaResult] = useState('');
  const [mdoLoading, setMdoLoading] = useState(false);

  // ── Catálogo / Licitação ──
  const [licitacaoNumero, setLicitacaoNumero] = useState('');
  const [licitacaoOrgao, setLicitacaoOrgao] = useState('');
  const [savingCatalogo, setSavingCatalogo] = useState(false);

  if (!regime || !config) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-6 text-center">
        <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-1">Regime tributário não definido</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Defina o regime tributário no cadastro da empresa (Empresas → Editar) para usar a calculadora.
        </p>
        <Badge variant="outline">Simples Nacional • Lucro Presumido • Lucro Real</Badge>
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
      return [
        { nome: 'IRPJ', aliquota: 15, percentPartilha: 0, info: `15% sobre base presumida de ${baseIRPJ}%` },
        { nome: 'CSLL', aliquota: 9, percentPartilha: 0, info: `9% sobre base presumida de ${baseCSLL}%` },
        { nome: 'COFINS', aliquota: 3, percentPartilha: 0, info: 'Cumulativo: 3%' },
        { nome: 'PIS/PASEP', aliquota: 0.65, percentPartilha: 0, info: 'Cumulativo: 0,65%' },
        ...(atividade === 'servicos' ? [{ nome: 'ISS', aliquota: ufInfo?.iss_max || 5, percentPartilha: 0, info: 'ISS municipal' }] : []),
        ...(atividade !== 'servicos' ? [{ nome: 'ICMS', aliquota: icmsUF, percentPartilha: 0, info: `ICMS ${ufCalculo}: ${icmsUF}%` }] : []),
      ];
    }
    return [
      { nome: 'IRPJ', aliquota: 15, percentPartilha: 0, info: '15% sobre lucro real' },
      { nome: 'CSLL', aliquota: 9, percentPartilha: 0, info: '9% sobre lucro real' },
      { nome: 'COFINS', aliquota: 7.6, percentPartilha: 0, info: 'Não-cumulativo: 7,6%' },
      { nome: 'PIS/PASEP', aliquota: 1.65, percentPartilha: 0, info: 'Não-cumulativo: 1,65%' },
      ...(atividade === 'servicos' ? [{ nome: 'ISS', aliquota: ufInfo?.iss_max || 5, percentPartilha: 0, info: 'ISS municipal' }] : []),
      ...(atividade !== 'servicos' ? [{ nome: 'ICMS', aliquota: icmsUF, percentPartilha: 0, info: `ICMS ${ufCalculo}: ${icmsUF}%` }] : []),
    ];
  };

  const tributosAtivos = getTributosComAliquotas();

  // ── Calcular tributos ──
  const calcular = () => {
    const receita = parseCurrencyInput(receitaBruta);
    if (!receita || receita <= 0) {
      toast.error('Informe a receita bruta mensal.');
      return;
    }
    if (regime === 'simples_nacional') {
      const faturamento12 = parseCurrencyInput(rbt12) || receita * 12;
      const simples = calcularSimplesNacional(faturamento12, anexoAtual);
      setResultado({
        regime: 'simples_nacional', receita, rbt12: faturamento12,
        aliquotaEfetiva: simples.aliquotaEfetiva, valorDAS: simples.valorDAS, faixa: simples.faixa,
        tributos: [{ nome: 'DAS (Unificado)', valor: simples.valorDAS, aliquota: simples.aliquotaEfetiva }],
        totalTributos: simples.valorDAS, anexo: anexoAtual.nome,
      });
    } else {
      const margem = parseFloat(margemLucro) / 100 || 0.15;
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
      setResultado({
        regime, receita, lucro: receita * margem, margem: margem * 100,
        tributos: filtrados, totalTributos, cargaEfetiva: (totalTributos / receita) * 100,
      });
    }
  };

  // ── Composição BDI via IA ──
  const gerarComposicaoBDI = async () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Informe pelo menos um item.'); return; }
    setLoading(true);
    setIaResult('');
    const itensTexto = validItens.map((item, idx) => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      return `Item ${idx + 1}: ${item.descricao} | Qtd: ${qtd} ${item.unidade} | Custo Unitário: R$ ${custo.toFixed(2)}`;
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
        onDone: () => { setLoading(false); toast.success('Composição BDI gerada!'); },
        onError: (err) => { toast.error('Erro: ' + err); setLoading(false); },
      });
    } catch { setLoading(false); toast.error('Erro ao conectar com a IA.'); }
  };

  // ── Gerar Planilha de Custos MDO (IN 5/2017) ──
  const gerarPlanilhaMDO = async () => {
    const sal = parseCurrencyInput(salarioBase);
    if (!sal || sal <= 0) { toast.error('Informe o salário-base.'); return; }
    setMdoLoading(true);
    setMdoIaResult('');

    const vt = parseCurrencyInput(valeTransporte);
    const va = parseCurrencyInput(valeAlimentacao);
    const uni = parseCurrencyInput(uniformes);
    const epi = parseCurrencyInput(epiMateriais);
    const equip = parseCurrencyInput(equipamentos);
    const qtd = parseInt(qtdProfissionais) || 1;
    const ch = parseInt(cargaHoraria) || 44;
    const adPerc = parseFloat(adicPericulosidade) || 0;
    const aiPerc = parseFloat(adicInsalubridade) || 0;
    const anPerc = parseFloat(adicNoturno) || 0;
    const ciPerc = parseFloat(custoIndiretoPerc) || 5;
    const luPerc = parseFloat(lucroPerc) || 10;

    const prompt = `Gere a PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS conforme Anexo VII-D da IN nº 5/2017 (SEGES/MP) para serviços com dedicação exclusiva de mão de obra.

DADOS DO SERVIÇO:
- Quantidade de profissionais: ${qtd}
- Carga horária semanal: ${ch}h
- Salário-base mensal: R$ ${sal.toFixed(2)}
- Adicional de periculosidade: ${adPerc}%
- Adicional de insalubridade: ${aiPerc}%
- Adicional noturno: ${anPerc}%
- Vale-transporte mensal: R$ ${vt.toFixed(2)}
- Vale-alimentação/refeição mensal: R$ ${va.toFixed(2)}
- Uniformes (anualizado): R$ ${uni.toFixed(2)}
- EPI/Materiais: R$ ${epi.toFixed(2)}
- Equipamentos: R$ ${equip.toFixed(2)}
- Custos indiretos: ${ciPerc}%
- Lucro: ${luPerc}%

REGIME TRIBUTÁRIO: ${regimeLabel}
UF: ${ufCalculo} (${ufInfo?.nome})

INSTRUÇÕES - Gere em JSON seguindo RIGOROSAMENTE esta estrutura dos 6 módulos:
{
  "modulo1_remuneracao": {
    "titulo": "Módulo 1 – Composição da Remuneração",
    "itens": [
      {"descricao": "Salário-base", "valor": 0.00},
      {"descricao": "Adicional de periculosidade", "percentual": 0, "valor": 0.00},
      {"descricao": "Adicional de insalubridade", "percentual": 0, "valor": 0.00},
      {"descricao": "Adicional noturno", "percentual": 0, "valor": 0.00},
      {"descricao": "Outros (hora extra, etc.)", "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo2_encargos": {
    "titulo": "Módulo 2 – Encargos e Benefícios Anuais, Mensais e Diários",
    "submA_encargos_sociais": {
      "titulo": "Submódulo 2.1 – 13º Salário, Férias e Adicional de Férias",
      "itens": [
        {"descricao": "13º Salário", "percentual": 8.33, "valor": 0.00},
        {"descricao": "Férias e Adicional de Férias", "percentual": 12.10, "valor": 0.00}
      ],
      "subtotal": 0.00
    },
    "submB_encargos_previdenciarios": {
      "titulo": "Submódulo 2.2 – GPS, FGTS e Outras Contribuições",
      "itens": [
        {"descricao": "INSS Patronal", "percentual": 20, "valor": 0.00},
        {"descricao": "SESI/SESC", "percentual": 1.5, "valor": 0.00},
        {"descricao": "SENAI/SENAC", "percentual": 1.0, "valor": 0.00},
        {"descricao": "INCRA", "percentual": 0.2, "valor": 0.00},
        {"descricao": "Salário Educação", "percentual": 2.5, "valor": 0.00},
        {"descricao": "FGTS", "percentual": 8.0, "valor": 0.00},
        {"descricao": "SAT/RAT (ajustar FAP)", "percentual": 3.0, "valor": 0.00},
        {"descricao": "SEBRAE", "percentual": 0.6, "valor": 0.00}
      ],
      "subtotal": 0.00
    },
    "submC_beneficios": {
      "titulo": "Submódulo 2.3 – Benefícios Mensais e Diários",
      "itens": [
        {"descricao": "Vale-Transporte", "valor": 0.00},
        {"descricao": "Vale-Alimentação/Refeição", "valor": 0.00},
        {"descricao": "Assistência médica e familiar", "valor": 0.00},
        {"descricao": "Seguro de vida, invalidez e funeral", "valor": 0.00}
      ],
      "subtotal": 0.00
    },
    "subtotal_modulo2": 0.00
  },
  "modulo3_provisao_rescisao": {
    "titulo": "Módulo 3 – Provisão para Rescisão",
    "itens": [
      {"descricao": "Aviso prévio indenizado", "percentual": 0.42, "valor": 0.00},
      {"descricao": "Incidência FGTS sobre aviso prévio indenizado", "percentual": 0.04, "valor": 0.00},
      {"descricao": "Multa do FGTS (40%) sobre aviso prévio indenizado", "percentual": 0.00, "valor": 0.00},
      {"descricao": "Aviso prévio trabalhado", "percentual": 1.94, "valor": 0.00},
      {"descricao": "Incidência do Submódulo 2.2 sobre aviso prévio trabalhado", "percentual": 0.00, "valor": 0.00},
      {"descricao": "Multa do FGTS do aviso prévio trabalhado", "percentual": 0.00, "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo4_custo_reposicao": {
    "titulo": "Módulo 4 – Custo de Reposição do Profissional Ausente",
    "itens": [
      {"descricao": "Férias", "percentual": 8.33, "valor": 0.00},
      {"descricao": "Ausências legais", "percentual": 2.96, "valor": 0.00},
      {"descricao": "Licença-paternidade", "percentual": 0.02, "valor": 0.00},
      {"descricao": "Ausência por acidente de trabalho", "percentual": 0.03, "valor": 0.00},
      {"descricao": "Afastamento maternidade", "percentual": 0.00, "valor": 0.00},
      {"descricao": "Incidência do Submódulo 2.2 sobre custo de reposição", "percentual": 0.00, "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo5_insumos": {
    "titulo": "Módulo 5 – Insumos Diversos",
    "itens": [
      {"descricao": "Uniformes", "valor": 0.00},
      {"descricao": "Materiais e EPIs", "valor": 0.00},
      {"descricao": "Equipamentos", "valor": 0.00},
      {"descricao": "Outros insumos", "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "modulo6_custos_indiretos_tributos_lucro": {
    "titulo": "Módulo 6 – Custos Indiretos, Tributos e Lucro",
    "itens": [
      {"descricao": "Custos indiretos", "percentual": ${ciPerc}, "valor": 0.00},
      {"descricao": "Lucro", "percentual": ${luPerc}, "valor": 0.00},
      {"descricao": "PIS", "percentual": 0.65, "valor": 0.00},
      {"descricao": "COFINS", "percentual": 3.0, "valor": 0.00},
      {"descricao": "ISS", "percentual": 5.0, "valor": 0.00}
    ],
    "subtotal": 0.00
  },
  "resumo": {
    "subtotal_modulos_1a5": 0.00,
    "subtotal_modulo_6": 0.00,
    "valor_mensal_por_empregado": 0.00,
    "qtd_profissionais": ${qtd},
    "valor_mensal_total": 0.00,
    "valor_anual_total": 0.00,
    "valor_extenso": ""
  },
  "parecer": {
    "viabilidade": "VIÁVEL ou ATENÇÃO ou INVIÁVEL",
    "observacoes": "Análise curta"
  }
}

REGRAS:
1. Calcule TODOS os valores com base no salário-base e percentuais informados.
2. Os encargos previdenciários (Submódulo 2.2) incidem sobre Módulo 1 + Submódulo 2.1.
3. O Módulo 6 (custos indiretos + lucro + tributos) incide sobre a soma dos módulos 1 a 5.
4. Todos os valores monetários com 2 casas decimais.
5. Responda APENAS o JSON sem markdown.`;

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'planilha_mdo_in5',
        onDelta: (d) => setMdoIaResult(prev => prev + d),
        onDone: () => { setMdoLoading(false); toast.success('Planilha de custos gerada conforme IN 5/2017!'); },
        onError: (err) => { toast.error('Erro: ' + err); setMdoLoading(false); },
      });
    } catch { setMdoLoading(false); toast.error('Erro ao conectar com a IA.'); }
  };

  // ── Item management ──
  const addItemRow = () => setItens(prev => [...prev, { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '' }]);
  const updateItem = (i: number, field: keyof ItemCusto, value: string) => setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const removeItem = (i: number) => { if (itens.length > 1) setItens(prev => prev.filter((_, idx) => idx !== i)); };

  const enviarParaProposta = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Nenhum item válido.'); return; }
    validItens.forEach((item, idx) => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      const markup = 1 + (parseFloat(margemLucro) || 15) / 100;
      const precoUnit = custo * markup;
      const total = precoUnit * qtd;
      addItem({
        item: String(idx + 1), descricao: item.descricao, quantidade: String(qtd), unidade: item.unidade,
        marca: '', fabricante: '', modelo: '',
        valorUnitario: precoUnit.toFixed(2).replace('.', ','), valorUnitarioExtenso: valorPorExtenso(precoUnit),
        valorTotal: total.toFixed(2).replace('.', ','), valorTotalExtenso: valorPorExtenso(total),
      });
    });
    toast.success(`${validItens.length} item(ns) enviado(s) para a Proposta Comercial!`);
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

  const salvarServicoNoCatalogo = async () => {
    if (!user) { toast.error('Faça login'); return; }
    const sal = parseCurrencyInput(salarioBase);
    if (!sal) { toast.error('Informe o salário-base'); return; }
    setSavingCatalogo(true);
    const qtd = parseInt(qtdProfissionais) || 1;
    const row = {
      user_id: user.id, tipo_calculo: 'servico_mdo',
      descricao: `Serviço com dedicação de mão de obra (${qtd} profissional(is))`,
      quantidade: qtd, unidade: 'MÊS', custo_unitario: sal,
      preco_unitario: sal, preco_total: sal * qtd,
      margem_lucro: parseFloat(lucroPerc) || 10,
      regime_tributario: regime,
      licitacao_numero: licitacaoNumero || null, licitacao_orgao: licitacaoOrgao || null,
    };
    const { error } = await supabase.from('catalogo_itens_precificados').insert(row);
    if (error) { toast.error('Erro ao salvar'); } else { toast.success('Serviço salvo no catálogo!'); }
    setSavingCatalogo(false);
  };

  // ── Parse MDO result for rendering ──
  const parsedMDO = (() => {
    if (!mdoIaResult) return null;
    try {
      let clean = mdoIaResult.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      return JSON.parse(clean);
    } catch { return null; }
  })();

  const renderModulo = (modulo: any) => {
    if (!modulo?.itens) return null;
    return (
      <div className="bg-muted/20 rounded-lg p-3 space-y-1.5">
        <h5 className="text-xs font-semibold text-accent">{modulo.titulo}</h5>
        {modulo.itens.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.descricao}{item.percentual ? ` (${item.percentual}%)` : ''}</span>
            <span className="font-medium">{formatCurrency(item.valor || 0)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1">
          <span>Subtotal</span>
          <span className="text-accent">{formatCurrency(modulo.subtotal || 0)}</span>
        </div>
      </div>
    );
  };

  const renderSubmodulo = (sub: any) => {
    if (!sub?.itens) return null;
    return (
      <div className="bg-muted/10 rounded-lg p-2.5 space-y-1 ml-3">
        <h6 className="text-[11px] font-medium text-foreground">{sub.titulo}</h6>
        {sub.itens.map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{item.descricao}{item.percentual ? ` (${item.percentual}%)` : ''}</span>
            <span className="font-medium">{formatCurrency(item.valor || 0)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-[11px] font-semibold border-t border-border/20 pt-0.5">
          <span>Subtotal</span>
          <span>{formatCurrency(sub.subtotal || 0)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">
              Calculadoras de Precificação — {regimeLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <ShieldCheck className="w-3 h-3 mr-1" /> IA Contábil
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>

        {/* 2 Calculator Tabs */}
        <div className="mt-4">
          <Tabs value={calcTab} onValueChange={(v) => setCalcTab(v as any)}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="produto_bdi" className="gap-1.5 text-xs">
                <Package className="w-3.5 h-3.5" /> Produtos e Composição BDI
              </TabsTrigger>
              <TabsTrigger value="servico_mdo" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" /> Serviços com Mão de Obra
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge className="bg-accent/10 text-accent border-accent/20">
            <Building2 className="w-3 h-3 mr-1" /> {regimeLabel}
          </Badge>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <MapPin className="w-3 h-3 mr-1" /> {ufCalculo} — ICMS {icmsUF}%
          </Badge>
          {regime === 'simples_nacional' && (
            <Badge className="bg-secondary/50 text-secondary-foreground border-border/30">
              <BookOpen className="w-3 h-3 mr-1" /> {anexoAtual.nome}
            </Badge>
          )}
          {empresaAtiva && (
            <Badge variant="outline" className="text-[10px]">{empresaAtiva.razao_social}</Badge>
          )}
        </div>

        {/* Tab descriptions */}
        <div className="mt-3 bg-muted/30 rounded-lg p-3">
          {calcTab === 'produto_bdi' && (
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Produtos e Composição BDI:</strong> Calcule custo, margem, impostos, frete e BDI para produtos/mercadorias. Ative a opção "Composição BDI" para gerar planilha detalhada de composição de custos conforme Lei 14.133/2021.
            </p>
          )}
          {calcTab === 'servico_mdo' && (
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Serviços com Dedicação de Mão de Obra:</strong> Planilha de Custos e Formação de Preços conforme Anexo VII-D da IN nº 5/2017 (SEGES/MP). Estrutura completa com os 6 módulos obrigatórios para serviços continuados com dedicação exclusiva de mão de obra.
            </p>
          )}
        </div>
      </div>

      {/* ── Vinculação com Licitação ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          Vincular à Licitação (opcional)
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nº da Licitação</Label>
            <Input value={licitacaoNumero} onChange={e => setLicitacaoNumero(e.target.value)} placeholder="Ex: PE 001/2026" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Órgão</Label>
            <Input value={licitacaoOrgao} onChange={e => setLicitacaoOrgao(e.target.value)} placeholder="Ex: Prefeitura de Belém" className="mt-1" />
          </div>
        </div>
      </div>

      {/* ── Seletor de Anexo (só Simples Nacional) ── */}
      {regime === 'simples_nacional' && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent" /> Anexo do Simples Nacional
            </h4>
            <Badge variant="outline" className="text-[10px]">Resolução CGSN nº 140/2018</Badge>
          </div>
          <Select value={anexoSelecionado} onValueChange={setAnexoSelecionado}>
            <SelectTrigger><SelectValue placeholder="Selecione o Anexo" /></SelectTrigger>
            <SelectContent>
              {ANEXOS_SIMPLES.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">{anexoAtual.descricao}</p>
          <div className="flex items-center gap-3">
            <Switch checked={showTabelaPartilha} onCheckedChange={setShowTabelaPartilha} />
            <span className="text-xs text-muted-foreground">Exibir tabela oficial de faixas e partilha</span>
          </div>
          {showTabelaPartilha && (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-semibold h-8">Faixa</TableHead>
                    <TableHead className="text-[10px] font-semibold h-8 text-right">Alíquota</TableHead>
                    <TableHead className="text-[10px] font-semibold h-8 text-right">Dedução</TableHead>
                    <TableHead className="text-[10px] font-semibold h-8">RBT12</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anexoAtual.faixas.map(f => {
                    const rbt12Val = parseCurrencyInput(rbt12);
                    const isActive = rbt12Val >= f.min && rbt12Val <= f.max;
                    return (
                      <TableRow key={f.faixaNum} className={isActive ? 'bg-accent/10 font-semibold' : ''}>
                        <TableCell className="text-[10px] py-1.5">{f.faixaNum}ª Faixa</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right">{f.aliquota.toFixed(2)}%</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right">{f.deducao > 0 ? formatCurrency(f.deducao) : '—'}</TableCell>
                        <TableCell className="text-[10px] py-1.5">{f.min === 0 ? 'Até' : `De ${formatCurrency(f.min)} a`} {formatCurrency(f.max)}</TableCell>
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
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-accent" /> Parâmetros do Cálculo
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">Receita Bruta Mensal (R$) *</Label>
            <Input value={receitaBruta} onChange={e => setReceitaBruta(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">UF para Cálculo *</Label>
            <Select value={ufCalculo} onValueChange={setUfCalculo}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(UF_ICMS).sort((a, b) => a[1].nome.localeCompare(b[1].nome)).map(([uf, info]) => (
                  <SelectItem key={uf} value={uf}>{uf} — {info.nome} (ICMS {info.icms_interno}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {regime === 'simples_nacional' ? (
            <div>
              <Label className="text-xs">RBT12 (Faturamento 12m)</Label>
              <Input value={rbt12} onChange={e => setRbt12(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Margem de Lucro (%)</Label>
              <Input type="number" value={margemLucro} onChange={e => setMargemLucro(e.target.value)} placeholder="15" className="mt-1" min={0} max={100} />
            </div>
          )}
          {regime !== 'simples_nacional' && (
            <div>
              <Label className="text-xs">Atividade Principal</Label>
              <Select value={atividade} onValueChange={(v: AtividadeType) => setAtividade(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercio">Comércio</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="industria">Indústria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={calcular} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Calculator className="w-4 h-4 mr-2" /> Calcular Tributos
        </Button>
      </div>

      {/* ── Alíquotas ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-accent" /> Alíquotas Tributárias — {regimeLabel} / {ufCalculo}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tributosAtivos.map((t: any) => (
            <div key={t.nome} className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{t.nome}</span>
                  <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger><TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{t.info}</p></TooltipContent></Tooltip></TooltipProvider>
                </div>
                <span className="text-sm font-bold text-accent">{t.aliquota.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Resultado Tributos ── */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" /> Resultado da Simulação Tributária
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Receita Bruta</p>
              <p className="text-sm font-bold">{formatCurrency(resultado.receita)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Tributos</p>
              <p className="text-sm font-bold text-destructive">{formatCurrency(resultado.totalTributos)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Carga Efetiva</p>
              <p className="text-sm font-bold text-accent">
                {regime === 'simples_nacional' ? `${resultado.aliquotaEfetiva.toFixed(2)}%` : `${resultado.cargaEfetiva.toFixed(2)}%`}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {resultado.tributos.map((t: any) => (
              <div key={t.nome} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                <span className="text-xs font-medium">{t.nome} <span className="text-accent">({t.aliquota.toFixed(2)}%)</span></span>
                <span className="text-xs font-bold">{formatCurrency(t.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: PRODUTOS E COMPOSIÇÃO BDI ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {calcTab === 'produto_bdi' && (
        <>
          {/* BDI toggle */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={usarBDI} onCheckedChange={setUsarBDI} />
              <div>
                <p className="text-sm font-medium">Ativar Composição BDI (Lei 14.133/2021)</p>
                <p className="text-[10px] text-muted-foreground">
                  Gera planilha detalhada de composição de custos com BDI, encargos, frete e despesas administrativas via IA.
                </p>
              </div>
            </div>
            {usarBDI && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className="text-xs">Frete Estimado (%)</Label>
                  <Input type="number" value={frete} onChange={e => setFrete(e.target.value)} placeholder="0" className="mt-1" min={0} max={100} />
                </div>
                <div>
                  <Label className="text-xs">Despesas Administrativas (%)</Label>
                  <Input type="number" value={despesasAdmin} onChange={e => setDespesasAdmin(e.target.value)} placeholder="0" className="mt-1" min={0} max={100} />
                </div>
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" /> Itens de Produto
              </h4>
              <Button variant="outline" size="sm" onClick={addItemRow}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Item
              </Button>
            </div>
            {itens.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Label className="text-[10px]">Descrição *</Label>
                  <Input value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Ex: Notebook Dell Inspiron 15" className="mt-0.5" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">Qtd</Label>
                  <Input value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} placeholder="1" className="mt-0.5" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">Unidade</Label>
                  <Select value={item.unidade} onValueChange={v => updateItem(idx, 'unidade', v)}>
                    <SelectTrigger className="mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['UN', 'KG', 'M', 'M²', 'M³', 'L', 'CX', 'PCT', 'PAR', 'JG', 'GL', 'SC', 'TB', 'RL', 'FD', 'BL'].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px]">Custo Unit. (R$) *</Label>
                  <Input value={item.custoUnitario} onChange={e => updateItem(idx, 'custoUnitario', formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-0.5" />
                </div>
                <div className="col-span-1">
                  {itens.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive h-8 w-8 p-0">×</Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch checked={enviarProposta} onCheckedChange={setEnviarProposta} />
                <div>
                  <p className="text-sm font-medium">Integrar à Proposta Comercial</p>
                  <p className="text-[10px] text-muted-foreground">Enviar preços formados à proposta</p>
                </div>
              </div>
              {enviarProposta && (
                <Button variant="outline" size="sm" onClick={enviarParaProposta}>
                  <FileText className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta
                </Button>
              )}
            </div>
            <div className="border-t border-border/30 pt-3">
              <Button variant="outline" size="sm" onClick={salvarNoCatalogo} disabled={savingCatalogo} className="w-full">
                {savingCatalogo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar no Catálogo de Itens Precificados
              </Button>
            </div>
          </div>

          {usarBDI ? (
            <Button onClick={gerarComposicaoBDI} disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12" size="lg">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
              Gerar Composição BDI com IA Contábil
            </Button>
          ) : (
            <Button onClick={calcular} disabled={!receitaBruta} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12" size="lg">
              <Calculator className="w-5 h-5 mr-2" /> Calcular Preço do Produto
            </Button>
          )}

          {iaResult && <ComposicaoResultado iaResult={iaResult} regimeLabel={regimeLabel} ufCalculo={ufCalculo} ufNome={ufInfo?.nome || ''} />}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: SERVIÇOS COM MÃO DE OBRA (IN 5/2017) ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {calcTab === 'servico_mdo' && (
        <>
          {/* Reference banner */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold">Referência Normativa</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Planilha conforme <strong>Anexo VII-D da Instrução Normativa nº 5/2017 (SEGES/MP)</strong> — Modelo de Planilha de Custos e Formação de Preços para contratação de serviços com dedicação exclusiva de mão de obra. Estrutura com os 6 módulos obrigatórios.
            </p>
            <a
              href="https://www.gov.br/compras/pt-br/agente-publico/orientacoes-e-procedimentos/11-orientacoes-gerais-para-planilha-de-custos-e-formacao-de-precos"
              target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-accent hover:underline flex items-center gap-1 mt-1"
            >
              Ver orientações do Gov.br <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Módulo 1 – Remuneração */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
              Módulo 1 — Composição da Remuneração
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Salário-base Mensal (R$) *</Label>
                <Input value={salarioBase} onChange={e => setSalarioBase(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Qtd de Profissionais</Label>
                <Input type="number" value={qtdProfissionais} onChange={e => setQtdProfissionais(e.target.value)} placeholder="1" className="mt-1" min={1} />
              </div>
              <div>
                <Label className="text-xs">Carga Horária Semanal (h)</Label>
                <Input type="number" value={cargaHoraria} onChange={e => setCargaHoraria(e.target.value)} placeholder="44" className="mt-1" min={1} max={44} />
              </div>
              <div>
                <Label className="text-xs">Adicional Periculosidade (%)</Label>
                <Input type="number" value={adicPericulosidade} onChange={e => setAdicPericulosidade(e.target.value)} placeholder="0" className="mt-1" min={0} max={30} />
                <p className="text-[9px] text-muted-foreground mt-0.5">30% sobre salário-base (NR-16)</p>
              </div>
              <div>
                <Label className="text-xs">Adicional Insalubridade (%)</Label>
                <Input type="number" value={adicInsalubridade} onChange={e => setAdicInsalubridade(e.target.value)} placeholder="0" className="mt-1" min={0} max={40} />
                <p className="text-[9px] text-muted-foreground mt-0.5">10%, 20% ou 40% sobre salário mínimo (NR-15)</p>
              </div>
              <div>
                <Label className="text-xs">Adicional Noturno (%)</Label>
                <Input type="number" value={adicNoturno} onChange={e => setAdicNoturno(e.target.value)} placeholder="0" className="mt-1" min={0} max={20} />
                <p className="text-[9px] text-muted-foreground mt-0.5">Mín. 20% (Art. 73, CLT)</p>
              </div>
            </div>
          </div>

          {/* Módulo 2 – Benefícios */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</span>
              Módulo 2 — Benefícios Mensais e Diários
            </h4>
            <p className="text-[10px] text-muted-foreground">
              Encargos sociais (13º, férias, FGTS, INSS patronal) serão calculados automaticamente pela IA. Informe apenas os benefícios de valor variável.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Vale-Transporte Mensal (R$)</Label>
                <Input value={valeTransporte} onChange={e => setValeTransporte(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
                <p className="text-[9px] text-muted-foreground mt-0.5">Desconto de até 6% do salário (Lei 7.418/85)</p>
              </div>
              <div>
                <Label className="text-xs">Vale-Alimentação/Refeição Mensal (R$)</Label>
                <Input value={valeAlimentacao} onChange={e => setValeAlimentacao(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Módulo 5 – Insumos */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">5</span>
              Módulo 5 — Insumos Diversos
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Uniformes (mensal/R$)</Label>
                <Input value={uniformes} onChange={e => setUniformes(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">EPIs e Materiais (mensal/R$)</Label>
                <Input value={epiMateriais} onChange={e => setEpiMateriais(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Equipamentos (mensal/R$)</Label>
                <Input value={equipamentos} onChange={e => setEquipamentos(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Módulo 6 – Custos Indiretos, Tributos e Lucro */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">6</span>
              Módulo 6 — Custos Indiretos, Tributos e Lucro
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Custos Indiretos (%)</Label>
                <Input type="number" value={custoIndiretoPerc} onChange={e => setCustoIndiretoPerc(e.target.value)} placeholder="5" className="mt-1" min={0} max={30} />
              </div>
              <div>
                <Label className="text-xs">Lucro (%)</Label>
                <Input type="number" value={lucroPerc} onChange={e => setLucroPerc(e.target.value)} placeholder="10" className="mt-1" min={0} max={30} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tributos (PIS, COFINS, ISS) serão calculados automaticamente conforme o regime tributário selecionado.
            </p>
          </div>

          {/* Actions */}
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
            <Button variant="outline" size="sm" onClick={salvarServicoNoCatalogo} disabled={savingCatalogo} className="w-full">
              {savingCatalogo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Salvar no Catálogo
            </Button>
          </div>

          <Button onClick={gerarPlanilhaMDO} disabled={mdoLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12" size="lg">
            {mdoLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
            Gerar Planilha de Custos IN 5/2017 com IA
          </Button>

          {/* Resultado MDO */}
          {parsedMDO && (
            <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h4 className="font-semibold text-sm">Planilha de Custos — Anexo VII-D IN 5/2017</h4>
              </div>

              {renderModulo(parsedMDO.modulo1_remuneracao)}

              {parsedMDO.modulo2_encargos && (
                <div className="bg-muted/20 rounded-lg p-3 space-y-2">
                  <h5 className="text-xs font-semibold text-accent">{parsedMDO.modulo2_encargos.titulo}</h5>
                  {renderSubmodulo(parsedMDO.modulo2_encargos.submA_encargos_sociais)}
                  {renderSubmodulo(parsedMDO.modulo2_encargos.submB_encargos_previdenciarios)}
                  {renderSubmodulo(parsedMDO.modulo2_encargos.submC_beneficios)}
                  <div className="flex items-center justify-between text-xs font-bold border-t border-border/30 pt-1 px-1">
                    <span>Total Módulo 2</span>
                    <span className="text-accent">{formatCurrency(parsedMDO.modulo2_encargos.subtotal_modulo2 || 0)}</span>
                  </div>
                </div>
              )}

              {renderModulo(parsedMDO.modulo3_provisao_rescisao)}
              {renderModulo(parsedMDO.modulo4_custo_reposicao)}
              {renderModulo(parsedMDO.modulo5_insumos)}
              {renderModulo(parsedMDO.modulo6_custos_indiretos_tributos_lucro)}

              {parsedMDO.resumo && (
                <div className="bg-accent/10 rounded-lg p-4 space-y-2">
                  <h5 className="text-xs font-bold text-accent">RESUMO</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Módulos 1-5</p>
                      <p className="text-sm font-bold">{formatCurrency(parsedMDO.resumo.subtotal_modulos_1a5 || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Módulo 6</p>
                      <p className="text-sm font-bold">{formatCurrency(parsedMDO.resumo.subtotal_modulo_6 || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Valor Mensal/Empregado</p>
                      <p className="text-sm font-bold text-accent">{formatCurrency(parsedMDO.resumo.valor_mensal_por_empregado || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Qtd. Profissionais</p>
                      <p className="text-sm font-bold">{parsedMDO.resumo.qtd_profissionais}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Valor Mensal Total</p>
                      <p className="text-lg font-bold text-accent">{formatCurrency(parsedMDO.resumo.valor_mensal_total || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground">Valor Anual Total</p>
                      <p className="text-sm font-bold">{formatCurrency(parsedMDO.resumo.valor_anual_total || 0)}</p>
                    </div>
                  </div>
                  {parsedMDO.resumo.valor_extenso && (
                    <p className="text-[11px] text-muted-foreground text-center italic mt-2">
                      {parsedMDO.resumo.valor_extenso}
                    </p>
                  )}
                </div>
              )}

              {parsedMDO.parecer && (
                <div className={`rounded-lg p-3 text-xs ${parsedMDO.parecer.viabilidade === 'VIÁVEL' ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20'}`}>
                  <span className="font-bold">{parsedMDO.parecer.viabilidade}:</span> {parsedMDO.parecer.observacoes}
                </div>
              )}
            </div>
          )}

          {mdoIaResult && !parsedMDO && (
            <div className="bg-card rounded-xl border border-border/50 p-5">
              <p className="text-xs text-muted-foreground mb-2">Processando resultado...</p>
              <pre className="text-[10px] bg-muted/30 rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap">{mdoIaResult}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
