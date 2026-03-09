import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { Bot, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ComposicaoResultadoProps {
  iaResult: string;
  regimeLabel: string;
  ufCalculo: string;
  ufNome: string;
}

type Componente = {
  componente: string;
  baseCalculo: number | null;
  aliquota: number | null;
  valor: number;
};

type ItemComposicao = {
  descricao: string;
  quantidade: number;
  unidade: string;
  componentes: Componente[];
  custoUnitario: number;
  precoUnitarioFormado: number;
  precoTotal: number;
};

type TributoPorImposto = {
  imposto: string;
  aliquota: number;
  valor: number;
};

type Resumo = {
  custoTotalMateriais: number;
  totalTributos: number;
  tributosPorImposto: TributoPorImposto[];
  bdiTotal: number;
  bdiPercentual: number;
  freteTotal: number;
  despesasAdm: number;
  margemLucro: number;
  precoTotalFormado: number;
  precoExtenso: string;
};

type Parecer = {
  viabilidade: string;
  margemLiquida: number;
  alertaInexequibilidade: boolean;
  observacoes: string;
};

type ComposicaoData = {
  itens: ItemComposicao[];
  resumo: Resumo;
  parecer: Parecer;
};

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number | null) =>
  v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—';

export default function ComposicaoResultado({ iaResult, regimeLabel, ufCalculo, ufNome }: ComposicaoResultadoProps) {
  const parsed = useMemo<ComposicaoData | null>(() => {
    try {
      // Try to extract JSON from the response (may have ```json wrapper or text around it)
      let jsonStr = iaResult.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const data = JSON.parse(jsonStr);
      if (data?.itens && data?.resumo && data?.parecer) return data as ComposicaoData;
      return null;
    } catch {
      return null;
    }
  }, [iaResult]);

  const copyResult = () => {
    navigator.clipboard.writeText(iaResult);
    toast.success('Composição copiada!');
  };

  // Fallback: if AI didn't return valid JSON, show markdown
  if (!parsed) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            <h4 className="font-semibold text-sm">Composição de Custo Gerada</h4>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-accent/10 text-accent text-[10px]">{regimeLabel} • {ufCalculo}</Badge>
            <Button variant="outline" size="sm" onClick={copyResult}>
              <Download className="w-3.5 h-3.5 mr-1" /> Copiar
            </Button>
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert text-xs overflow-auto">
          <ReactMarkdown>{iaResult}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const itens = parsed.itens || [];
  const resumo = parsed.resumo || { custoTotalMateriais: 0, totalTributos: 0, tributosPorImposto: [], bdiTotal: 0, bdiPercentual: 0, freteTotal: 0, despesasAdm: 0, margemLucro: 0, precoTotalFormado: 0, precoExtenso: '' };
  const parecer = parsed.parecer || { viabilidade: 'N/A', margemLiquida: 0, alertaInexequibilidade: false, observacoes: '' };

  const viabilidadeIcon = parecer.viabilidade === 'VIÁVEL'
    ? <CheckCircle className="w-4 h-4 text-accent" />
    : parecer.viabilidade === 'INVIÁVEL'
    ? <XCircle className="w-4 h-4 text-destructive" />
    : <AlertTriangle className="w-4 h-4 text-primary" />;

  const viabilidadeColor = parecer.viabilidade === 'VIÁVEL'
    ? 'bg-accent/10 text-accent border-accent/20'
    : parecer.viabilidade === 'INVIÁVEL'
    ? 'bg-destructive/10 text-destructive border-destructive/20'
    : 'bg-primary/10 text-primary border-primary/20';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent" />
            <h4 className="font-semibold text-sm">Planilha de Composição de Custo — IA Contábil</h4>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-accent/10 text-accent text-[10px]">{regimeLabel} • {ufCalculo}</Badge>
            <Button variant="outline" size="sm" onClick={copyResult}>
              <Download className="w-3.5 h-3.5 mr-1" /> Copiar
            </Button>
          </div>
        </div>

        {/* Itens Tables */}
        {itens.map((item, idx) => (
          <div key={idx} className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] font-mono">Item {idx + 1}</Badge>
              <span className="text-sm font-semibold">{item.descricao}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {item.quantidade} {item.unidade}
              </span>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="text-[11px] font-bold h-9 w-[40%]">Componente</TableHead>
                    <TableHead className="text-[11px] font-bold h-9 text-right w-[20%]">Base de Cálculo</TableHead>
                    <TableHead className="text-[11px] font-bold h-9 text-right w-[15%]">Alíquota (%)</TableHead>
                    <TableHead className="text-[11px] font-bold h-9 text-right w-[25%]">Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(item.componentes || []).map((comp, ci) => (
                    <TableRow key={ci} className="hover:bg-muted/30">
                      <TableCell className="text-[11px] py-2 font-medium">{comp.componente}</TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono">
                        {comp.baseCalculo != null ? fmt(comp.baseCalculo) : '—'}
                      </TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono">
                        {fmtPct(comp.aliquota)}
                      </TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono font-semibold">
                        {fmt(comp.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-accent/5 border-t-2 border-accent/20">
                    <TableCell colSpan={3} className="text-[11px] py-2 font-bold">
                      Preço Unitário Formado
                    </TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono font-bold text-accent">
                      {fmt(item.precoUnitarioFormado)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-accent/10">
                    <TableCell colSpan={3} className="text-[11px] py-2 font-bold">
                      Preço Total ({item.quantidade} {item.unidade})
                    </TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono font-bold text-accent">
                      {fmt(item.precoTotal)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        ))}
      </div>

      {/* Resumo Geral */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <h4 className="font-semibold text-sm mb-3">Resumo Geral da Formação de Preço</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Resumo Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="text-[11px] font-bold h-9">Componente</TableHead>
                  <TableHead className="text-[11px] font-bold h-9 text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-[11px] py-2">Custo Total dos Materiais/Serviços</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.custoTotalMateriais)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">Frete e Logística</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.freteTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">Despesas Administrativas</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.despesasAdm)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">Total de Tributos</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono text-destructive font-semibold">{fmt(resumo.totalTributos)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">BDI ({(resumo.bdiPercentual ?? 0).toFixed(2).replace('.', ',')}%)</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.bdiTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">Margem de Lucro</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.margemLucro)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="bg-accent/10 border-t-2 border-accent/20">
                  <TableCell className="text-[12px] py-2.5 font-bold">PREÇO TOTAL FORMADO</TableCell>
                  <TableCell className="text-[12px] py-2.5 text-right font-mono font-bold text-accent">{fmt(resumo.precoTotalFormado)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            {resumo.precoExtenso && (
              <div className="px-3 py-2 bg-muted/30 border-t border-border">
                <p className="text-[10px] text-muted-foreground italic">
                  Por extenso: {resumo.precoExtenso}
                </p>
              </div>
            )}
          </div>

          {/* Right: Tributos Detalhados */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="text-[11px] font-bold h-9">Tributo</TableHead>
                    <TableHead className="text-[11px] font-bold h-9 text-right">Alíquota</TableHead>
                    <TableHead className="text-[11px] font-bold h-9 text-right">Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(resumo.tributosPorImposto || []).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[11px] py-2 font-medium">{t.imposto}</TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono">{fmtPct(t.aliquota)}</TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(t.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-destructive/5">
                    <TableCell colSpan={2} className="text-[11px] py-2 font-bold">Total Tributos</TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono font-bold text-destructive">{fmt(resumo.totalTributos)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Parecer */}
            <div className={`rounded-lg border p-3 ${viabilidadeColor}`}>
              <div className="flex items-center gap-2 mb-1.5">
                {viabilidadeIcon}
                <span className="text-xs font-bold">Parecer: {parecer.viabilidade}</span>
                <span className="text-[10px] ml-auto font-mono">
                  Margem Líquida: {(parecer.margemLiquida ?? 0).toFixed(2).replace('.', ',')}%
                </span>
              </div>
              {parecer.alertaInexequibilidade && (
                <p className="text-[10px] font-semibold mb-1">
                  ⚠ ALERTA — Art. 59, Lei 14.133/2021: Proposta com indícios de inexequibilidade.
                </p>
              )}
              <p className="text-[10px] leading-relaxed">{parecer.observacoes}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Composição gerada por IA Contábil com alíquotas reais para {ufCalculo} ({ufNome}). Consulta oficial:{' '}
        <a href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Calculadora da Receita Federal
        </a>.
      </p>
    </div>
  );
}
