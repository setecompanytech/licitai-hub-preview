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
  // Percentual 0–100 transcrito de tabela legal — só formata, nunca converte.
  const formatPercentual = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

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
- Alíquota Nominal: ${formatPercentual(resultado.aliquotaNominal)}
- Valor a Deduzir: ${formatCurrency(resultado.deducao)}
- Alíquota Efetiva Calculada: ${formatPercentual(resultado.aliquotaEfetiva)}

## Repartição dos Tributos (sobre a alíquota efetiva)
- CPP: ${formatPercentual(resultado.reparticao.cpp)}
- CSLL: ${formatPercentual(resultado.reparticao.csll)}
- ICMS: ${resultado.reparticao.icms > 0 ? formatPercentual(resultado.reparticao.icms) : 'Recolhido à parte (ICMS-ST ou fora do Simples)'}
- IRPJ: ${formatPercentual(resultado.reparticao.irpj)}
- COFINS: ${formatPercentual(resultado.reparticao.cofins)}
- PIS/PASEP: ${formatPercentual(resultado.reparticao.pis)}

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
          <Label htmlFor="rbt12" className="flex items-center gap-1">
            <Calculator className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            Receita bruta em 12 meses (RBT12)
          </Label>
          <Input
            id="rbt12"
            placeholder="Ex: 500000.00"
            value={rbt12}
            onChange={e => setRbt12(e.target.value)}
            className="tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Informe a receita bruta acumulada nos últimos 12 meses para calcular a alíquota efetiva do Simples Nacional.
          </p>
        </div>
        {resultado && (
          <Card className="border-border bg-muted p-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{resultado.faixa}</Badge>
                <span className="text-xs text-muted-foreground">Anexo I – Comércio</span>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Alíq. nominal</p>
                  <p className="font-semibold tabular-nums">{formatPercentual(resultado.aliquotaNominal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Alíq. efetiva</p>
                  <p className="font-bold text-foreground tabular-nums">{formatPercentual(resultado.aliquotaEfetiva)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dedução</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(resultado.deducao)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RBT12</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(rbt12Num)}</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Tabela do Anexo I */}
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Info className="w-4 h-4" aria-hidden="true" /> Ver tabela completa do Anexo I – Simples Nacional (Comércio) 2026
        </summary>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">Faixa</th>
                <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">Alíquota</th>
                <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">Valor a deduzir</th>
                <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">Receita bruta 12 meses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FAIXAS_ANEXO_I.map((f, i) => (
                <tr key={i} className={resultado?.faixa === f.faixa ? 'bg-primary-tint font-semibold' : undefined}>
                  <td className="px-3 py-2">{f.faixa}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(f.aliquota)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.deducao > 0 ? formatCurrency(f.deducao) : '–'}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {f.limiteInf === 0 ? 'Até' : 'De ' + formatCurrency(f.limiteInf) + ' a'} {formatCurrency(f.limiteSup)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tabela repartição */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Percentual de repartição dos tributos</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th scope="col" className="px-3 py-2 text-left text-sm font-semibold text-foreground">Faixa</th>
                  <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">CPP</th>
                  <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">CSLL</th>
                  <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">ICMS</th>
                  <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">IRPJ</th>
                  <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">COFINS</th>
                  <th scope="col" className="px-3 py-2 text-right text-sm font-semibold text-foreground">PIS/PASEP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {REPARTICAO.map((r, i) => (
                  <tr key={i} className={resultado?.faixa.startsWith(r.faixa) ? 'bg-primary-tint font-semibold' : undefined}>
                    <td className="px-3 py-2">{r.faixa}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(r.cpp)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(r.csll)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.icms > 0 ? formatPercentual(r.icms) : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(r.irpj)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(r.cofins)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPercentual(r.pis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {/* Resumo impacto na proposta */}
      {resultado && valorGlobal > 0 && (
        <Card className="border-border p-6">
          <p className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Calculator className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Impacto tributário na proposta
          </p>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor bruto</p>
              <p className="font-bold text-foreground tabular-nums">{formatCurrency(valorGlobal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alíq. efetiva</p>
              <p className="font-bold text-warning-ink tabular-nums">{formatPercentual(resultado.aliquotaEfetiva)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Imposto estimado</p>
              <p className="font-bold text-destructive tabular-nums">{formatCurrency(impostoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor líquido</p>
              <p className="font-bold text-success-ink tabular-nums">{formatCurrency(valorLiquido)}</p>
            </div>
          </div>

          {/* Detalhamento por tributo */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Detalhamento por tributo (valores estimados)</p>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 md:grid-cols-6">
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
                    <p className="font-semibold text-foreground tabular-nums">{t.pct > 0 ? formatCurrency(valorTrib) : '–'}</p>
                    <p className="text-muted-foreground tabular-nums">{t.pct > 0 ? formatPercentual(t.pct) : 'Fora SN'}</p>
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
        className="w-full"
        onClick={handleAnaliseIA}
        disabled={isAnalysing}
      >
        {isAnalysing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Analisando tributos...</>
        ) : (
          <><Brain className="w-4 h-4 text-primary" /> Análise tributária com IA (PhD em Contabilidade Fiscal)</>
        )}
      </Button>

      {/* Resultado IA */}
      {analiseIA && (
        <Card className="border-border bg-muted p-6">
          <p className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Brain className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            Parecer da IA contábil tributária
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
            <ReactMarkdown>{analiseIA}</ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
