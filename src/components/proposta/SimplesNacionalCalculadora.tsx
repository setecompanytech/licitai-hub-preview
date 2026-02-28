import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calculator, Brain, Loader2, Info } from 'lucide-react';
import { streamAIChat } from '@/lib/ai-stream';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

// Tabela Simples Nacional – Anexo I – Comércio – 2026
const FAIXAS_ANEXO_I = [
  { faixa: '1ª Faixa', aliquota: 4.00, deducao: 0,       limiteInf: 0,          limiteSup: 180_000 },
  { faixa: '2ª Faixa', aliquota: 7.30, deducao: 5_940,    limiteInf: 180_000.01, limiteSup: 360_000 },
  { faixa: '3ª Faixa', aliquota: 9.50, deducao: 13_860,   limiteInf: 360_000.01, limiteSup: 720_000 },
  { faixa: '4ª Faixa', aliquota: 10.70, deducao: 22_500,  limiteInf: 720_000.01, limiteSup: 1_800_000 },
  { faixa: '5ª Faixa', aliquota: 14.30, deducao: 87_300,  limiteInf: 1_800_000.01, limiteSup: 3_600_000 },
  { faixa: '6ª Faixa', aliquota: 19.00, deducao: 378_000, limiteInf: 3_600_000.01, limiteSup: 4_800_000 },
];

// Percentual de repartição dos tributos por faixa
const REPARTICAO = [
  { faixa: '1ª', cpp: 41.50, csll: 3.50, icms: 34.00, irpj: 5.50, cofins: 12.74, pis: 2.76 },
  { faixa: '2ª', cpp: 41.50, csll: 3.50, icms: 34.00, irpj: 5.50, cofins: 12.74, pis: 2.76 },
  { faixa: '3ª', cpp: 42.00, csll: 3.50, icms: 33.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
  { faixa: '4ª', cpp: 42.00, csll: 3.50, icms: 33.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
  { faixa: '5ª', cpp: 42.00, csll: 3.50, icms: 33.50, irpj: 5.50, cofins: 12.74, pis: 2.76 },
  { faixa: '6ª', cpp: 42.10, csll: 10.00, icms: 0,     irpj: 13.50, cofins: 28.27, pis: 6.13 },
];

function calcularAliquotaEfetiva(rbt12: number) {
  const faixa = FAIXAS_ANEXO_I.find(f => rbt12 >= f.limiteInf && rbt12 <= f.limiteSup);
  if (!faixa) return null;

  const aliquotaEfetiva = ((rbt12 * (faixa.aliquota / 100)) - faixa.deducao) / rbt12 * 100;
  const idx = FAIXAS_ANEXO_I.indexOf(faixa);
  const rep = REPARTICAO[idx];

  return {
    faixa: faixa.faixa,
    aliquotaNominal: faixa.aliquota,
    deducao: faixa.deducao,
    aliquotaEfetiva: Math.max(aliquotaEfetiva, 0),
    reparticao: rep,
  };
}

interface Props {
  valorGlobal: number;
  itensResumo: string;
}

export default function SimplesNacionalCalculadora({ valorGlobal, itensResumo }: Props) {
  const [rbt12, setRbt12] = useState('');
  const [analiseIA, setAnaliseIA] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);

  const rbt12Num = parseFloat(rbt12.replace(/\./g, '').replace(',', '.')) || 0;
  const resultado = rbt12Num > 0 ? calcularAliquotaEfetiva(rbt12Num) : null;

  const impostoTotal = resultado ? (valorGlobal * resultado.aliquotaEfetiva / 100) : 0;
  const valorLiquido = valorGlobal - impostoTotal;

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPercent = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

  const handleAnaliseIA = async () => {
    if (!resultado) {
      toast.error('Informe a Receita Bruta dos últimos 12 meses');
      return;
    }
    if (valorGlobal <= 0) {
      toast.error('A planilha de preços precisa ter itens com valores');
      return;
    }

    setIsAnalysing(true);
    setAnaliseIA('');
    let content = '';

    const context = `
## Dados Tributários do Simples Nacional – Anexo I (Comércio)
- Receita Bruta em 12 meses (RBT12): ${formatCurrency(rbt12Num)}
- Faixa: ${resultado.faixa}
- Alíquota Nominal: ${formatPercent(resultado.aliquotaNominal)}
- Valor a Deduzir: ${formatCurrency(resultado.deducao)}
- Alíquota Efetiva Calculada: ${formatPercent(resultado.aliquotaEfetiva)}

## Repartição dos Tributos (sobre a alíquota efetiva)
- CPP: ${formatPercent(resultado.reparticao.cpp)}
- CSLL: ${formatPercent(resultado.reparticao.csll)}
- ICMS: ${resultado.reparticao.icms > 0 ? formatPercent(resultado.reparticao.icms) : 'Recolhido à parte (ICMS-ST ou fora do Simples)'}
- IRPJ: ${formatPercent(resultado.reparticao.irpj)}
- COFINS: ${formatPercent(resultado.reparticao.cofins)}
- PIS/PASEP: ${formatPercent(resultado.reparticao.pis)}

## Dados da Proposta Comercial
- Valor Global da Proposta: ${formatCurrency(valorGlobal)}
- Imposto Estimado (Simples): ${formatCurrency(impostoTotal)}
- Valor Líquido Estimado: ${formatCurrency(valorLiquido)}

## Itens da Proposta
${itensResumo}
`;

    await streamAIChat({
      messages: [{ role: 'user', content: 'Analise a precificação tributária desta proposta comercial considerando o regime do Simples Nacional Anexo I (Comércio). Verifique se a margem é viável, detalhe a carga tributária efetiva por tributo em valores absolutos, alerte sobre riscos de ICMS-ST quando aplicável, e sugira ajustes de preço se necessário para manter competitividade e viabilidade econômica.' }],
      action: 'contabilidade_tributaria',
      context,
      onDelta: (chunk) => { content += chunk; setAnaliseIA(content); },
      onDone: () => { setIsAnalysing(false); toast.success('Análise tributária concluída!'); },
      onError: (error) => { toast.error(error); setIsAnalysing(false); },
    });
  };

  return (
    <div className="space-y-4">
      {/* Entrada RBT12 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Calculator className="w-4 h-4 text-accent" />
            Receita Bruta em 12 meses (RBT12)
          </Label>
          <Input
            placeholder="Ex: 500000.00"
            value={rbt12}
            onChange={e => setRbt12(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Informe a receita bruta acumulada nos últimos 12 meses para calcular a alíquota efetiva do Simples Nacional.
          </p>
        </div>
        {resultado && (
          <Card className="p-4 bg-accent/5 border-accent/20">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30 text-xs">
                  {resultado.faixa}
                </Badge>
                <span className="text-xs text-muted-foreground">Anexo I – Comércio</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Alíq. Nominal</p>
                  <p className="font-semibold">{formatPercent(resultado.aliquotaNominal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Alíq. Efetiva</p>
                  <p className="font-bold text-accent">{formatPercent(resultado.aliquotaEfetiva)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dedução</p>
                  <p className="font-semibold">{formatCurrency(resultado.deducao)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RBT12</p>
                  <p className="font-semibold">{formatCurrency(rbt12Num)}</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Tabela do Anexo I */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Info className="w-3 h-3" /> Ver Tabela Completa do Anexo I – Simples Nacional (Comércio) 2026
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs border border-border rounded">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-2 py-1.5 text-left">Faixa</th>
                <th className="px-2 py-1.5 text-right">Alíquota</th>
                <th className="px-2 py-1.5 text-right">Valor a Deduzir</th>
                <th className="px-2 py-1.5 text-left">Receita Bruta 12 Meses</th>
              </tr>
            </thead>
            <tbody>
              {FAIXAS_ANEXO_I.map((f, i) => (
                <tr key={i} className={`border-t border-border/50 ${resultado?.faixa === f.faixa ? 'bg-accent/10 font-semibold' : ''}`}>
                  <td className="px-2 py-1">{f.faixa}</td>
                  <td className="px-2 py-1 text-right">{formatPercent(f.aliquota)}</td>
                  <td className="px-2 py-1 text-right">{f.deducao > 0 ? formatCurrency(f.deducao) : '–'}</td>
                  <td className="px-2 py-1">
                    {f.limiteInf === 0 ? 'Até' : 'De ' + formatCurrency(f.limiteInf) + ' a'} {formatCurrency(f.limiteSup)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tabela repartição */}
        <div className="mt-2 overflow-x-auto">
          <p className="text-xs font-medium text-muted-foreground mb-1">Percentual de Repartição dos Tributos</p>
          <table className="w-full text-xs border border-border rounded">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-2 py-1.5 text-left">Faixa</th>
                <th className="px-2 py-1.5 text-right">CPP</th>
                <th className="px-2 py-1.5 text-right">CSLL</th>
                <th className="px-2 py-1.5 text-right">ICMS</th>
                <th className="px-2 py-1.5 text-right">IRPJ</th>
                <th className="px-2 py-1.5 text-right">COFINS</th>
                <th className="px-2 py-1.5 text-right">PIS/PASEP</th>
              </tr>
            </thead>
            <tbody>
              {REPARTICAO.map((r, i) => (
                <tr key={i} className={`border-t border-border/50 ${resultado?.faixa.startsWith(r.faixa) ? 'bg-accent/10 font-semibold' : ''}`}>
                  <td className="px-2 py-1">{r.faixa}</td>
                  <td className="px-2 py-1 text-right">{formatPercent(r.cpp)}</td>
                  <td className="px-2 py-1 text-right">{formatPercent(r.csll)}</td>
                  <td className="px-2 py-1 text-right">{r.icms > 0 ? formatPercent(r.icms) : '–'}</td>
                  <td className="px-2 py-1 text-right">{formatPercent(r.irpj)}</td>
                  <td className="px-2 py-1 text-right">{formatPercent(r.cofins)}</td>
                  <td className="px-2 py-1 text-right">{formatPercent(r.pis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Resumo impacto na proposta */}
      {resultado && valorGlobal > 0 && (
        <Card className="p-4 border-border/50">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-accent" />
            Impacto Tributário na Proposta
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Valor Bruto</p>
              <p className="font-bold">{formatCurrency(valorGlobal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alíq. Efetiva</p>
              <p className="font-bold text-warning">{formatPercent(resultado.aliquotaEfetiva)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Imposto Estimado</p>
              <p className="font-bold text-destructive">{formatCurrency(impostoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Líquido</p>
              <p className="font-bold text-success">{formatCurrency(valorLiquido)}</p>
            </div>
          </div>

          {/* Detalhamento por tributo */}
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground mb-2">Detalhamento por Tributo (valores estimados)</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              {[
                { label: 'CPP', pct: resultado.reparticao.cpp },
                { label: 'CSLL', pct: resultado.reparticao.csll },
                { label: 'ICMS', pct: resultado.reparticao.icms },
                { label: 'IRPJ', pct: resultado.reparticao.irpj },
                { label: 'COFINS', pct: resultado.reparticao.cofins },
                { label: 'PIS/PASEP', pct: resultado.reparticao.pis },
              ].map(t => {
                const valorTrib = t.pct > 0 ? (impostoTotal * t.pct / 100) : 0;
                return (
                  <div key={t.label} className="text-center">
                    <p className="text-muted-foreground">{t.label}</p>
                    <p className="font-semibold">{t.pct > 0 ? formatCurrency(valorTrib) : '–'}</p>
                    <p className="text-muted-foreground">{t.pct > 0 ? formatPercent(t.pct) : 'Fora SN'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Botão IA Tributária */}
      <Button
        variant="outline"
        className="w-full border-accent/30 hover:bg-accent/10"
        onClick={handleAnaliseIA}
        disabled={isAnalysing}
      >
        {isAnalysing ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analisando tributos...</>
        ) : (
          <><Brain className="w-4 h-4 mr-2 text-accent" /> Análise Tributária com IA (PhD em Contabilidade Fiscal)</>
        )}
      </Button>

      {/* Resultado IA */}
      {analiseIA && (
        <Card className="p-4 border-accent/20 bg-accent/5">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" />
            Parecer da IA Contábil Tributária
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{analiseIA}</ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
