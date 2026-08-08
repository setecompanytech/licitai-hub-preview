import { useState } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, ExternalLink, Info, TrendingUp, Bot, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { streamAIChat } from '@/lib/ai-stream';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type RegimeConfig = {
  label: string;
  description: string;
  tributos: {
    nome: string;
    aliquota: number;
    base: 'receita' | 'lucro';
    info: string;
  }[];
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

// Simples Nacional - Anexo I (Comércio) faixas
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

export default function CalculadoraTributaria() {
  const { empresaAtiva } = useEmpresa();
  const regime = empresaAtiva?.regime_tributario || '';
  const config = REGIMES[regime];

  const [receitaBruta, setReceitaBruta] = useState('');
  const [rbt12, setRbt12] = useState('');
  const [atividade, setAtividade] = useState<AtividadeType>('comercio');
  const [margemLucro, setMargemLucro] = useState('20');
  const [resultado, setResultado] = useState<any>(null);

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

  const calcular = () => {
    const receita = parseCurrencyInput(receitaBruta);
    if (!receita || receita <= 0) return;

    if (regime === 'simples_nacional') {
      const faturamento12 = parseCurrencyInput(rbt12) || receita * 12;
      const simples = calcularSimplesNacional(faturamento12);
      const totalTributos = simples.valorDAS;
      const lucroBruto = receita - totalTributos;
      const lucroLiquido = lucroBruto;
      const margemLiquidaPct = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

      setResultado({
        regime: 'simples_nacional', receita, rbt12: faturamento12,
        aliquotaEfetiva: simples.aliquotaEfetiva, valorDAS: simples.valorDAS, faixa: simples.faixa,
        tributos: [{ nome: 'DAS (Unificado)', valor: simples.valorDAS, aliquota: simples.aliquotaEfetiva }],
        totalTributos, lucroBruto, lucroLiquido, margemLiquidaPct,
      });
    } else {
      const margem = parseFloat(margemLucro) / 100 || 0.2;
      const lucro = receita * margem;
      const basePresuncaoIRPJ = atividade === 'servicos' ? 0.32 : 0.08;
      const basePresuncaoCSLL = atividade === 'servicos' ? 0.32 : 0.12;

      const tributos = config.tributos.map(t => {
        let valor = 0;
        if (regime === 'lucro_presumido') {
          if (t.nome === 'IRPJ') {
            const base = receita * basePresuncaoIRPJ;
            valor = base * (t.aliquota / 100);
            if (base > 60000 / 3) valor += Math.max(0, base - 20000) * 0.1;
          } else if (t.nome === 'CSLL') {
            valor = receita * basePresuncaoCSLL * (t.aliquota / 100);
          } else if (t.nome === 'ISS' && atividade !== 'servicos') valor = 0;
          else if (t.nome === 'ICMS' && atividade === 'servicos') valor = 0;
          else valor = receita * (t.aliquota / 100);
        } else {
          if (t.base === 'lucro') {
            valor = lucro * (t.aliquota / 100);
            if (t.nome === 'IRPJ' && lucro > 20000) valor += (lucro - 20000) * 0.1;
          } else if (t.nome === 'ISS' && atividade !== 'servicos') valor = 0;
          else if (t.nome === 'ICMS' && atividade === 'servicos') valor = 0;
          else valor = receita * (t.aliquota / 100);
        }
        return { nome: t.nome, valor, aliquota: t.aliquota, info: t.info };
      });

      const totalTributos = tributos.reduce((s, t) => s + t.valor, 0);
      const cargaEfetiva = (totalTributos / receita) * 100;
      const lucroBruto = receita - totalTributos;
      const lucroLiquido = lucroBruto;
      const margemLiquidaPct = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

      setResultado({
        regime, receita, lucro, margem: margem * 100,
        tributos: tributos.filter(t => t.valor > 0), totalTributos, cargaEfetiva,
        lucroBruto, lucroLiquido, margemLiquidaPct,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Calculadora Tributária — {config.label}</h3>
          </div>
          <a
            href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            Calculadora Gov.br <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {config.tributos.map(t => (
            <TooltipProvider key={t.nome}>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs cursor-help">
                    {t.nome} {t.aliquota > 0 ? `${t.aliquota}%` : ''}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{t.info}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Receita Bruta Mensal (R$) *</Label>
            <Input
              value={receitaBruta}
              onChange={e => setReceitaBruta(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="mt-1"
            />
          </div>
          {regime === 'simples_nacional' ? (
            <div>
              <Label className="text-xs">Faturamento 12 meses (RBT12)</Label>
              <Input
                value={rbt12}
                onChange={e => setRbt12(formatCurrencyInput(e.target.value))}
                placeholder="R$ 0,00"
                className="mt-1"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Margem de Lucro (%)</Label>
              <Input
                type="number"
                value={margemLucro}
                onChange={e => setMargemLucro(e.target.value)}
                placeholder="20"
                className="mt-1"
                min={0}
                max={100}
              />
            </div>
          )}
        </div>

        {regime !== 'simples_nacional' && (
          <div>
            <Label className="text-xs">Atividade Principal</Label>
            <Select value={atividade} onValueChange={(v: AtividadeType) => setAtividade(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="servicos">Serviços</SelectItem>
                <SelectItem value="industria">Indústria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={calcular} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Calculator className="w-4 h-4 mr-2" />
          Calcular Tributos
        </Button>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Resultado da Simulação — Tributos & Lucro</h4>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Receita Bruta</p>
              <p className="text-sm font-bold">{formatCurrency(resultado.receita)}</p>
            </div>
            <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
              <p className="text-xs text-muted-foreground">Total Tributos</p>
              <p className="text-sm font-bold text-destructive">{formatCurrency(resultado.totalTributos)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Carga Efetiva</p>
              <p className="text-sm font-bold text-foreground">
                {regime === 'simples_nacional'
                  ? `${resultado.aliquotaEfetiva.toFixed(2)}%`
                  : `${resultado.cargaEfetiva.toFixed(2)}%`}
              </p>
            </div>
          </div>

          {/* Lucro KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50">
              <p className="text-xs text-muted-foreground">Lucro Bruto</p>
              <p className="text-sm font-bold text-foreground">{formatCurrency(resultado.lucroBruto)}</p>
              <p className="text-xs text-muted-foreground">Receita − Tributos</p>
            </div>
            <div className={`rounded-lg p-3 text-center border ${resultado.lucroLiquido >= 0 ? 'bg-success/15 border-success/30' : 'bg-destructive/15 border-destructive/30'}`}>
              <p className="text-xs text-muted-foreground">Lucro Líquido</p>
              <p className={`text-sm font-bold ${resultado.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(resultado.lucroLiquido)}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center border ${resultado.margemLiquidaPct >= 5 ? 'bg-success/15 border-success/30' : resultado.margemLiquidaPct >= 0 ? 'bg-warning/15 border-warning/30' : 'bg-destructive/15 border-destructive/30'}`}>
              <p className="text-xs text-muted-foreground">Margem Líquida</p>
              <p className={`text-sm font-bold ${resultado.margemLiquidaPct >= 5 ? 'text-success' : resultado.margemLiquidaPct >= 0 ? 'text-warning' : 'text-destructive'}`}>
                {resultado.margemLiquidaPct.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {resultado.margemLiquidaPct < 5 && resultado.margemLiquidaPct >= 0 ? '⚠ Risco' : resultado.margemLiquidaPct < 0 ? '🚫 Prejuízo' : '✓ Saudável'}
              </p>
            </div>
          </div>

          {regime === 'simples_nacional' && resultado.faixa && (
            <div className="bg-muted/40 rounded-lg p-3 text-xs">
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
                  {t.info && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-xs">{t.info}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold">{formatCurrency(t.valor)}</span>
                  <span className="text-xs text-muted-foreground ml-2">({t.aliquota.toFixed(2)}%)</span>
                </div>
              </div>
            ))}
          </div>

          {/* DRE Simplificada */}
          <div className="bg-muted/20 rounded-lg p-4 space-y-2 border border-border/30">
            <h5 className="text-xs font-bold text-foreground mb-2">📊 DRE Simplificada</h5>
            <div className="flex justify-between text-xs">
              <span>Receita Bruta</span>
              <span className="font-mono font-semibold">{formatCurrency(resultado.receita)}</span>
            </div>
            <div className="flex justify-between text-xs text-destructive">
              <span>(−) Tributos</span>
              <span className="font-mono font-semibold">({formatCurrency(resultado.totalTributos)})</span>
            </div>
            <div className="border-t border-border/30 my-1" />
            <div className={`flex justify-between text-xs font-bold ${resultado.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
              <span>= Lucro Líquido</span>
              <span className="font-mono">{formatCurrency(resultado.lucroLiquido)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Margem Líquida</span>
              <span className="font-mono">{resultado.margemLiquidaPct.toFixed(2)}%</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Simulação baseada nas alíquotas vigentes. Para cálculos oficiais CBS/IBS, consulte a{' '}
            <a
              href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Calculadora da Receita Federal (Regime Geral)
            </a>.
          </p>
        </div>
      )}

      {/* AI Tax Analysis */}
      <SimulacaoIAReceita regime={regime} config={config} />
    </div>
  );
}

function SimulacaoIAReceita({ regime, config }: { regime: string; config: RegimeConfig }) {
  const [valorOperacao, setValorOperacao] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState<'venda_mercadoria' | 'prestacao_servico' | 'importacao'>('venda_mercadoria');
  const [iaResult, setIaResult] = useState('');
  const [loading, setLoading] = useState(false);

  const simularIA = async () => {
    const valor = parseCurrencyInput(valorOperacao);
    if (!valor || valor <= 0) {
      toast.error('Informe o valor da operação.');
      return;
    }

    setLoading(true);
    setIaResult('');

    const tipoLabel = {
      venda_mercadoria: 'Venda de Mercadoria',
      prestacao_servico: 'Prestação de Serviço',
      importacao: 'Importação',
    }[tipoOperacao];

    try {
      await streamAIChat({
        messages: [{ role: 'user', content: `Valor: R$ ${valor.toFixed(2)}, Tipo: ${tipoLabel}, Regime: ${config.label}` }],
        action: 'calculadora_tributaria',
        context: `Você é um contador tributarista especializado na reforma tributária brasileira (CBS/IBS).
Use como referência as regras da calculadora oficial da Receita Federal disponível em:
https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral

Com base no valor e tipo de operação informados, calcule e apresente:

1. **CBS (Contribuição sobre Bens e Serviços)** - alíquota federal estimada de 8,8%
2. **IBS (Imposto sobre Bens e Serviços)** - alíquota estadual/municipal estimada de 17,7%
3. **Alíquota total estimada** (CBS + IBS ≈ 26,5%)
4. **Valor do tributo** sobre a operação
5. **Valor líquido** após tributação
6. **Créditos tributários** possíveis (regime não-cumulativo)

Considere o regime tributário da empresa (${config.label}) e suas particularidades:
- Simples Nacional: possível isenção parcial na transição
- Lucro Presumido: regime cumulativo, sem créditos
- Lucro Real: regime não-cumulativo, com direito a créditos

Formate em Markdown com tabelas quando adequado. Seja preciso e objetivo.
Ao final, adicione nota de que os valores são estimativas baseadas nas alíquotas-teste do piloto CBS/IBS.`,
        onDelta: (d) => setIaResult(prev => prev + d),
        onDone: () => setLoading(false),
        onError: (err) => {
          toast.error('Erro na simulação IA: ' + err);
          setLoading(false);
        },
      });
    } catch {
      setLoading(false);
      toast.error('Erro ao conectar com a IA.');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Simulação IA — CBS/IBS (Reforma Tributária)</h4>
        </div>
        <a
          href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          Calculadora Receita Federal <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Simulação baseada nas alíquotas-teste do piloto CBS/IBS da Receita Federal para o {config.label}.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Valor da Operação (R$) *</Label>
          <Input
            value={valorOperacao}
            onChange={e => setValorOperacao(formatCurrencyInput(e.target.value))}
            placeholder="R$ 0,00"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Tipo de Operação</Label>
          <Select value={tipoOperacao} onValueChange={(v: any) => setTipoOperacao(v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venda_mercadoria">Venda de Mercadoria</SelectItem>
              <SelectItem value="prestacao_servico">Prestação de Serviço</SelectItem>
              <SelectItem value="importacao">Importação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={simularIA} disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
        Simular com IA (CBS/IBS)
      </Button>

      {iaResult && (
        <div className="bg-muted/30 rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert text-xs">
          <ReactMarkdown>{iaResult}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
