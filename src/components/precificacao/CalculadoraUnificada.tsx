import { useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calculator, Bot, Loader2, FileText, Plus, Download, ExternalLink, MapPin, Building2,
  ShieldCheck, Sparkles, TrendingUp, Info
} from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

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
      { nome: 'IRPJ', aliquota: 15, base: 'lucro', info: 'Base: 8% (comércio) ou 32% (serviços) da receita bruta. Adicional de 10% sobre excedente de R$60mil/trimestre.' },
      { nome: 'CSLL', aliquota: 9, base: 'lucro', info: 'Base: 12% (comércio) ou 32% (serviços) da receita bruta.' },
      { nome: 'COFINS', aliquota: 3, base: 'receita', info: 'Regime cumulativo sobre receita bruta.' },
      { nome: 'PIS/PASEP', aliquota: 0.65, base: 'receita', info: 'Regime cumulativo sobre receita bruta.' },
      { nome: 'ISS', aliquota: 5, base: 'receita', info: 'De 2% a 5% sobre serviços (varia por município).' },
      { nome: 'ICMS', aliquota: 18, base: 'receita', info: 'Varia por estado (7% a 25%). Alíquota média 18%.' },
    ],
  },
  lucro_real: {
    label: 'Lucro Real',
    description: 'Regime obrigatório para faturamento acima de R$ 78 milhões/ano.',
    tributos: [
      { nome: 'IRPJ', aliquota: 15, base: 'lucro', info: '15% sobre lucro real. Adicional de 10% sobre excedente de R$20mil/mês.' },
      { nome: 'CSLL', aliquota: 9, base: 'lucro', info: '9% sobre o lucro real apurado.' },
      { nome: 'COFINS', aliquota: 7.6, base: 'receita', info: 'Regime não-cumulativo com créditos sobre insumos.' },
      { nome: 'PIS/PASEP', aliquota: 1.65, base: 'receita', info: 'Regime não-cumulativo com créditos sobre insumos.' },
      { nome: 'ISS', aliquota: 5, base: 'receita', info: 'De 2% a 5% sobre serviços (varia por município).' },
      { nome: 'ICMS', aliquota: 18, base: 'receita', info: 'Varia por estado. Direito a créditos sobre aquisições.' },
    ],
  },
};

// ── Simples Nacional Faixas (Anexo I) ──
const SIMPLES_FAIXAS = [
  { min: 0, max: 180000, aliquota: 4.0, deducao: 0 },
  { min: 180000.01, max: 360000, aliquota: 7.3, deducao: 5940 },
  { min: 360000.01, max: 720000, aliquota: 9.5, deducao: 13860 },
  { min: 720000.01, max: 1800000, aliquota: 10.7, deducao: 22500 },
  { min: 1800000.01, max: 3600000, aliquota: 14.3, deducao: 87300 },
  { min: 3600000.01, max: 4800000, aliquota: 19.0, deducao: 378000 },
];

function calcularSimplesNacional(rbt12: number) {
  const faixa = SIMPLES_FAIXAS.find(f => rbt12 >= f.min && rbt12 <= f.max);
  if (!faixa) return { aliquotaEfetiva: 0, valorDAS: 0, faixa: null };
  const aliquotaEfetiva = ((rbt12 * faixa.aliquota / 100) - faixa.deducao) / rbt12 * 100;
  const receitaMensal = rbt12 / 12;
  const valorDAS = receitaMensal * (aliquotaEfetiva / 100);
  return { aliquotaEfetiva: Math.max(0, aliquotaEfetiva), valorDAS, faixa };
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  const regime = empresaAtiva?.regime_tributario || '';
  const config = REGIMES[regime];
  const ufEmpresa = empresaAtiva?.uf || '';

  // ── Shared state ──
  const [receitaBruta, setReceitaBruta] = useState('');
  const [rbt12, setRbt12] = useState('');
  const [atividade, setAtividade] = useState<AtividadeType>('comercio');
  const [margemLucro, setMargemLucro] = useState('15');
  const [ufCalculo, setUfCalculo] = useState(ufEmpresa || 'PA');
  const [resultado, setResultado] = useState<any>(null);

  // ── Composição state ──
  const [frete, setFrete] = useState('');
  const [despesasAdmin, setDespesasAdmin] = useState('');
  const [itens, setItens] = useState<ItemCusto[]>([
    { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '' },
  ]);
  const [iaResult, setIaResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviarProposta, setEnviarProposta] = useState(false);

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

  // ── Get effective ICMS for the selected UF ──
  const icmsUF = ufInfo?.icms_interno || 18;

  // ── Build tributos with real percentages based on regime + UF ──
  const getTributosComAliquotas = () => {
    if (regime === 'simples_nacional') {
      const faturamento12 = parseFloat(rbt12.replace(/\D/g, '')) / 100 || 0;
      if (faturamento12 > 0) {
        const simples = calcularSimplesNacional(faturamento12);
        // Simples Nacional distribui a alíquota efetiva entre os tributos (proporções aproximadas Anexo I)
        const ae = simples.aliquotaEfetiva;
        return [
          { nome: 'IRPJ', aliquota: +(ae * 0.055).toFixed(2), info: `${(ae * 0.055).toFixed(2)}% da alíquota efetiva do DAS (${ae.toFixed(2)}%)` },
          { nome: 'CSLL', aliquota: +(ae * 0.035).toFixed(2), info: `${(ae * 0.035).toFixed(2)}% da alíquota efetiva do DAS (${ae.toFixed(2)}%)` },
          { nome: 'COFINS', aliquota: +(ae * 0.128).toFixed(2), info: `${(ae * 0.128).toFixed(2)}% da alíquota efetiva do DAS (${ae.toFixed(2)}%)` },
          { nome: 'PIS/PASEP', aliquota: +(ae * 0.028).toFixed(2), info: `${(ae * 0.028).toFixed(2)}% da alíquota efetiva do DAS (${ae.toFixed(2)}%)` },
          { nome: 'CPP', aliquota: +(ae * 0.435).toFixed(2), info: `${(ae * 0.435).toFixed(2)}% da alíquota efetiva do DAS (${ae.toFixed(2)}%)` },
          { nome: 'ICMS', aliquota: +(ae * 0.319).toFixed(2), info: `${(ae * 0.319).toFixed(2)}% da alíquota efetiva do DAS (${ae.toFixed(2)}%)` },
          { nome: 'DAS Total', aliquota: +ae.toFixed(2), info: `Alíquota efetiva total do DAS para RBT12 informado` },
        ];
      }
      return config.tributos.map(t => ({ nome: t.nome, aliquota: t.aliquota, info: t.info }));
    }

    if (regime === 'lucro_presumido') {
      const baseIRPJ = atividade === 'servicos' ? 32 : 8;
      const baseCSLL = atividade === 'servicos' ? 32 : 12;
      return [
        { nome: 'IRPJ', aliquota: 15, info: `15% sobre base presumida de ${baseIRPJ}% da receita. Adicional 10% acima de R$60mil/trim.` },
        { nome: 'CSLL', aliquota: 9, info: `9% sobre base presumida de ${baseCSLL}% da receita.` },
        { nome: 'COFINS', aliquota: 3, info: 'Regime cumulativo sobre receita bruta.' },
        { nome: 'PIS/PASEP', aliquota: 0.65, info: 'Regime cumulativo sobre receita bruta.' },
        ...(atividade === 'servicos' ? [{ nome: 'ISS', aliquota: ufInfo?.iss_max || 5, info: `ISS municipal: ${ufInfo?.iss_min || 2}% a ${ufInfo?.iss_max || 5}%` }] : []),
        ...(atividade !== 'servicos' ? [{ nome: 'ICMS', aliquota: icmsUF, info: `ICMS interno de ${ufCalculo}: ${icmsUF}%` }] : []),
      ];
    }

    // Lucro Real
    return [
      { nome: 'IRPJ', aliquota: 15, info: '15% sobre lucro real. Adicional 10% acima de R$20mil/mês.' },
      { nome: 'CSLL', aliquota: 9, info: '9% sobre lucro real apurado.' },
      { nome: 'COFINS', aliquota: 7.6, info: 'Regime não-cumulativo (7,6%). Direito a créditos.' },
      { nome: 'PIS/PASEP', aliquota: 1.65, info: 'Regime não-cumulativo (1,65%). Direito a créditos.' },
      ...(atividade === 'servicos' ? [{ nome: 'ISS', aliquota: ufInfo?.iss_max || 5, info: `ISS municipal: ${ufInfo?.iss_min || 2}% a ${ufInfo?.iss_max || 5}%` }] : []),
      ...(atividade !== 'servicos' ? [{ nome: 'ICMS', aliquota: icmsUF, info: `ICMS interno de ${ufCalculo}: ${icmsUF}%. Direito a créditos.` }] : []),
    ];
  };

  const tributosAtivos = getTributosComAliquotas();

  // ── Calcular tributos ──
  const calcular = () => {
    const receita = parseFloat(receitaBruta.replace(/\D/g, '')) / 100;
    if (!receita || receita <= 0) {
      toast.error('Informe a receita bruta mensal.');
      return;
    }

    if (regime === 'simples_nacional') {
      const faturamento12 = parseFloat(rbt12.replace(/\D/g, '')) / 100 || receita * 12;
      const simples = calcularSimplesNacional(faturamento12);
      setResultado({
        regime: 'simples_nacional',
        receita,
        rbt12: faturamento12,
        aliquotaEfetiva: simples.aliquotaEfetiva,
        valorDAS: simples.valorDAS,
        faixa: simples.faixa,
        tributos: [{ nome: 'DAS (Unificado)', valor: simples.valorDAS, aliquota: simples.aliquotaEfetiva }],
        totalTributos: simples.valorDAS,
      });
    } else {
      const margem = parseFloat(margemLucro) / 100 || 0.15;
      const lucro = receita * margem;
      const basePresuncaoIRPJ = atividade === 'servicos' ? 0.32 : 0.08;
      const basePresuncaoCSLL = atividade === 'servicos' ? 0.32 : 0.12;

      const tributos = config.tributos.map(t => {
        let valor = 0;
        const aliquotaReal = t.nome === 'ICMS' ? icmsUF : t.aliquota;

        if (regime === 'lucro_presumido') {
          if (t.nome === 'IRPJ') {
            const base = receita * basePresuncaoIRPJ;
            valor = base * (t.aliquota / 100);
            if (base > 60000 / 3) valor += Math.max(0, base - 20000) * 0.1;
          } else if (t.nome === 'CSLL') {
            valor = receita * basePresuncaoCSLL * (t.aliquota / 100);
          } else if (t.nome === 'ISS' && atividade !== 'servicos') {
            valor = 0;
          } else if (t.nome === 'ICMS' && atividade === 'servicos') {
            valor = 0;
          } else if (t.nome === 'ICMS') {
            valor = receita * (icmsUF / 100);
          } else {
            valor = receita * (t.aliquota / 100);
          }
        } else {
          // Lucro Real
          if (t.base === 'lucro') {
            valor = lucro * (t.aliquota / 100);
            if (t.nome === 'IRPJ' && lucro > 20000) valor += (lucro - 20000) * 0.1;
          } else if (t.nome === 'ISS' && atividade !== 'servicos') {
            valor = 0;
          } else if (t.nome === 'ICMS' && atividade === 'servicos') {
            valor = 0;
          } else if (t.nome === 'ICMS') {
            valor = receita * (icmsUF / 100);
          } else {
            valor = receita * (t.aliquota / 100);
          }
        }
        return { nome: t.nome, valor, aliquota: aliquotaReal, info: t.info };
      });

      const filtrados = tributos.filter(t => t.valor > 0);
      const totalTributos = filtrados.reduce((s, t) => s + t.valor, 0);
      const cargaEfetiva = (totalTributos / receita) * 100;

      setResultado({
        regime,
        receita,
        lucro: receita * margem,
        margem: margem * 100,
        tributos: filtrados,
        totalTributos,
        cargaEfetiva,
      });
    }
  };

  // ── Composição ──
  const addItemRow = () => setItens(prev => [...prev, { descricao: '', quantidade: '1', unidade: 'UN', custoUnitario: '' }]);
  const updateItem = (i: number, field: keyof ItemCusto, value: string) => setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const removeItem = (i: number) => { if (itens.length > 1) setItens(prev => prev.filter((_, idx) => idx !== i)); };

  const gerarComposicao = async () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) {
      toast.error('Informe pelo menos um item com descrição e custo unitário.');
      return;
    }
    setLoading(true);
    setIaResult('');

    const itensTexto = validItens.map((item, idx) => {
      const custo = parseFloat(item.custoUnitario.replace(',', '.')) || 0;
      const qtd = parseFloat(item.quantidade) || 1;
      return `Item ${idx + 1}: ${item.descricao} | Qtd: ${qtd} ${item.unidade} | Custo Unitário: R$ ${custo.toFixed(2)}`;
    }).join('\n');

    const freteVal = parseFloat(frete.replace(',', '.')) || 0;
    const despAdm = parseFloat(despesasAdmin.replace(',', '.')) || 0;
    const margem = parseFloat(margemLucro) || 15;
    const rbt = parseFloat(rbt12.replace(/\D/g, '')) / 100 || 0;

    // Include calculated percentages in prompt
    const tributosSummary = tributosAtivos.map(t => `   - ${t.nome}: ${t.aliquota}%`).join('\n');

    const prompt = `Gere a PLANILHA DE COMPOSIÇÃO DE CUSTO E FORMAÇÃO DE PREÇO conforme Lei nº 14.133/2021.

DADOS DA EMPRESA:
- Regime Tributário: ${regimeLabel}
- UF: ${ufCalculo} (${ufInfo?.nome || ''})
- ICMS interno: ${icmsUF}%
- ISS municipal: ${ufInfo?.iss_min || 2}% a ${ufInfo?.iss_max || 5}%
- Atividade: ${atividade}
${regime === 'simples_nacional' && rbt > 0 ? `- RBT12: R$ ${rbt.toFixed(2)}` : ''}
- Margem de lucro: ${margem}%
- Frete: R$ ${freteVal.toFixed(2)}
- Despesas administrativas: R$ ${despAdm.toFixed(2)}

ALÍQUOTAS CALCULADAS (usar estas exatamente):
${tributosSummary}

ITENS:
${itensTexto}

INSTRUÇÕES:
1. Para CADA item, monte a composição detalhada usando as ALÍQUOTAS ACIMA.
2. Apresente em TABELA MARKDOWN: | Componente | Base de Cálculo | Alíquota (%) | Valor (R$) |
3. Apresente RESUMO FINAL com totais, BDI e preço formado.
4. Emita parecer sobre viabilidade e alerta de inexequibilidade se margem < 5% (Art. 59).
5. Use APENAS as alíquotas informadas acima — não invente valores.`;

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: prompt }],
        action: 'composicao_custo',
        onDelta: (d) => setIaResult(prev => prev + d),
        onDone: () => { setLoading(false); toast.success('Composição gerada!'); },
        onError: (err) => { toast.error('Erro: ' + err); setLoading(false); },
      });
    } catch {
      setLoading(false);
      toast.error('Erro ao conectar com a IA contábil.');
    }
  };

  const enviarParaProposta = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) { toast.error('Nenhum item válido.'); return; }
    validItens.forEach((item, idx) => {
      const custo = parseFloat(item.custoUnitario.replace(',', '.')) || 0;
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
    toast.success(`${validItens.length} item(ns) enviado(s) para a Proposta Técnica!`);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">
              Calculadora Tributária & Composição de Custo — {regimeLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <ShieldCheck className="w-3 h-3 mr-1" /> IA Contábil
            </Badge>
            <a
              href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral"
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              Calculadora Gov.br <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge className="bg-accent/10 text-accent border-accent/20">
            <Building2 className="w-3 h-3 mr-1" /> {regimeLabel}
          </Badge>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <MapPin className="w-3 h-3 mr-1" /> {ufCalculo} — ICMS {icmsUF}%
          </Badge>
          {empresaAtiva && (
            <Badge variant="outline" className="text-[10px]">{empresaAtiva.razao_social}</Badge>
          )}
        </div>
      </div>

      {/* ── Alíquotas por tributo (ALWAYS VISIBLE) ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Alíquotas Tributárias Aplicadas — {regimeLabel} / {ufCalculo}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tributosAtivos.map((t) => (
            <div key={t.nome} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{t.nome}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">{t.info}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-sm font-bold text-accent">{t.aliquota.toFixed(2)}%</span>
            </div>
          ))}
        </div>
        {regime === 'simples_nacional' && (!rbt12 || parseFloat(rbt12.replace(/\D/g, '')) === 0) && (
          <p className="text-[10px] text-muted-foreground mt-2">
            ⚠ Informe o RBT12 (faturamento 12 meses) abaixo para calcular as alíquotas reais do Simples Nacional.
          </p>
        )}
      </div>

      {/* ── Parâmetros do Cálculo ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-accent" />
          Parâmetros do Cálculo
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">Receita Bruta Mensal (R$) *</Label>
            <Input
              value={receitaBruta}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '');
                const num = parseInt(v || '0') / 100;
                setReceitaBruta(num > 0 ? num.toFixed(2).replace('.', ',') : '');
              }}
              placeholder="0,00" className="mt-1"
            />
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
              <Input
                value={rbt12}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  const num = parseInt(v || '0') / 100;
                  setRbt12(num > 0 ? num.toFixed(2).replace('.', ',') : '');
                }}
                placeholder="Automático se vazio" className="mt-1"
              />
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Frete Estimado (R$)</Label>
            <Input value={frete} onChange={e => setFrete(e.target.value)} placeholder="0,00" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Despesas Administrativas (R$)</Label>
            <Input value={despesasAdmin} onChange={e => setDespesasAdmin(e.target.value)} placeholder="0,00" className="mt-1" />
          </div>
        </div>

        <Button onClick={calcular} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Calculator className="w-4 h-4 mr-2" /> Calcular Tributos
        </Button>
      </div>

      {/* ── Resultado dos Tributos ── */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h4 className="font-semibold text-sm">Resultado da Simulação Tributária</h4>
          </div>

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

          {regime === 'simples_nacional' && resultado.faixa && (
            <div className="bg-accent/5 rounded-lg p-3 text-xs">
              <p><strong>Faixa:</strong> RBT12 de {formatCurrency(resultado.faixa.min)} a {formatCurrency(resultado.faixa.max)}</p>
              <p><strong>Alíquota nominal:</strong> {resultado.faixa.aliquota}% | <strong>Dedução:</strong> {formatCurrency(resultado.faixa.deducao)}</p>
              <p><strong>Alíquota efetiva:</strong> {resultado.aliquotaEfetiva.toFixed(2)}%</p>
            </div>
          )}

          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-muted-foreground">Detalhamento dos Tributos</h5>
            {resultado.tributos.map((t: any) => (
              <div key={t.nome} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{t.nome}</span>
                  <span className="text-xs text-accent font-semibold">({t.aliquota.toFixed(2)}%)</span>
                </div>
                <span className="text-xs font-bold">{formatCurrency(t.valor)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-accent/10 rounded-lg px-3 py-2">
            <span className="text-xs font-bold">Líquido após tributos</span>
            <span className="text-sm font-bold text-accent">{formatCurrency(resultado.receita - resultado.totalTributos)}</span>
          </div>
        </div>
      )}

      {/* ── Itens para Composição de Custo ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            Itens para Composição de Custo — Lei 14.133/2021
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
              <Input value={item.custoUnitario} onChange={e => updateItem(idx, 'custoUnitario', e.target.value)} placeholder="0,00" className="mt-0.5" />
            </div>
            <div className="col-span-1">
              {itens.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive h-8 w-8 p-0">×</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Integração Proposta ── */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={enviarProposta} onCheckedChange={setEnviarProposta} />
            <div>
              <p className="text-sm font-medium">Integrar à Proposta Técnica/Comercial</p>
              <p className="text-[10px] text-muted-foreground">Opcional — enviar preços formados à proposta na finalização</p>
            </div>
          </div>
          {enviarProposta && (
            <Button variant="outline" size="sm" onClick={enviarParaProposta}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Enviar à Proposta
            </Button>
          )}
        </div>
      </div>

      {/* ── Gerar Composição ── */}
      <Button onClick={gerarComposicao} disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-12" size="lg">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
        Gerar Composição de Custo com IA Contábil
      </Button>

      {/* ── Resultado IA ── */}
      {iaResult && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              <h4 className="font-semibold text-sm">Composição de Custo Gerada</h4>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-accent/10 text-accent text-[10px]">{regimeLabel} • {ufCalculo}</Badge>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(iaResult); toast.success('Copiado!'); }}>
                <Download className="w-3.5 h-3.5 mr-1" /> Copiar
              </Button>
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert text-xs overflow-auto">
            <ReactMarkdown>{iaResult}</ReactMarkdown>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Cálculo por IA Contábil com alíquotas reais para {ufCalculo} ({ufInfo?.nome}). Consulta oficial:{' '}
            <a href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Calculadora da Receita Federal
            </a>.
          </p>
        </div>
      )}
    </div>
  );
}
