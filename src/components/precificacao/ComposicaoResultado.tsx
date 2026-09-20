import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { Bot, Download, AlertTriangle, CheckCircle, XCircle, FileText, FileSpreadsheet, Send } from 'lucide-react';
import SeloPraefectusIA from '@/components/shared/SeloPraefectusIA';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import {
  parseComposicao, exportComposicaoPDF, exportComposicaoExcel, exportComposicaoWord,
  type ComposicaoData,
} from '@/lib/composicao-export';

interface ComposicaoResultadoProps {
  iaResult: string;
  regimeLabel: string;
  ufCalculo: string;
  ufNome: string;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (v: number | null) =>
  v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—';

export default function ComposicaoResultado({ iaResult, regimeLabel, ufCalculo, ufNome }: ComposicaoResultadoProps) {
  const { addItem } = usePropostaCart();
  const { empresaAtiva } = useEmpresa();
  const parsed = useMemo<ComposicaoData | null>(() => parseComposicao(iaResult), [iaResult]);
  const exportOpts = useMemo(() => ({
    timbradoUrl: empresaAtiva?.timbrado_url,
    empresaNome: empresaAtiva?.razao_social,
  }), [empresaAtiva]);

  const copyResult = () => {
    navigator.clipboard.writeText(iaResult);
    toast.success('Composição copiada!');
  };

  const handleExportPDF = async () => {
    if (!parsed) return;
    await exportComposicaoPDF(parsed, regimeLabel, ufCalculo, exportOpts);
    toast.success('PDF exportado!');
  };

  const handleExportExcel = () => {
    if (!parsed) return;
    exportComposicaoExcel(parsed, regimeLabel, ufCalculo, exportOpts);
    toast.success('Excel exportado!');
  };

  const handleExportWord = () => {
    if (!parsed) return;
    exportComposicaoWord(parsed, regimeLabel, ufCalculo, exportOpts);
    toast.success('Word exportado!');
  };

  const enviarParaProposta = () => {
    if (!parsed) return;
    const itens = parsed.itens || [];
    if (itens.length === 0) { toast.error('Nenhum item na composição.'); return; }
    itens.forEach((item, idx) => {
      addItem({
        item: String(idx + 1),
        descricao: item.descricao,
        quantidade: String(item.quantidade),
        unidade: item.unidade,
        marca: '',
        fabricante: '',
        modelo: '',
        valorUnitario: item.precoUnitarioFormado.toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(item.precoUnitarioFormado),
        valorTotal: item.precoTotal.toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(item.precoTotal),
      });
    });
    toast.success(`${itens.length} item(ns) da composição enviado(s) para a Proposta Comercial!`);
  };

  // Fallback: if AI didn't return valid JSON, show markdown
  if (!parsed) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-base font-semibold leading-6 text-foreground">Composição de Custo Gerada</h4>
            <SeloPraefectusIA />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{regimeLabel} • {ufCalculo}</Badge>
            <Button variant="outline" onClick={copyResult}>
              <Download aria-hidden="true" /> Copiar
            </Button>
          </div>
        </div>
        <div className="prose prose-sm max-w-none overflow-auto rounded-md bg-secondary p-4 text-sm dark:prose-invert">
          <ReactMarkdown>{iaResult}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const itens = parsed.itens || [];
  const resumo = parsed.resumo || { custoTotalMateriais: 0, totalTributos: 0, tributosPorImposto: [], bdiTotal: 0, bdiPercentual: 0, freteTotal: 0, despesasAdm: 0, margemLucro: 0, precoTotalFormado: 0, precoExtenso: '' };
  const parecer = parsed.parecer || { viabilidade: 'N/A', margemLiquida: 0, alertaInexequibilidade: false, observacoes: '' };

  const viabilidadeIcon = parecer.viabilidade === 'VIÁVEL'
    ? <CheckCircle className="h-4 w-4 text-success-ink" aria-hidden="true" />
    : parecer.viabilidade === 'INVIÁVEL'
    ? <XCircle className="h-4 w-4 text-destructive-ink" aria-hidden="true" />
    : <AlertTriangle className="h-4 w-4 text-warning-ink" aria-hidden="true" />;

  // Trio tinta/tinta-escura/linha do estado (Design System v3).
  const viabilidadeColor = parecer.viabilidade === 'VIÁVEL'
    ? 'border-success-line bg-success-tint text-success-ink'
    : parecer.viabilidade === 'INVIÁVEL'
    ? 'border-destructive-line bg-destructive-tint text-destructive-ink'
    : 'border-warning-line bg-warning-tint text-warning-ink';

  return (
    <div className="space-y-4">
      {/* Header — resultado de IA: leva o selo "Praefectus IA". */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-base font-semibold leading-6 text-foreground">Planilha de Composição de Custo — IA Contábil</h4>
            <SeloPraefectusIA />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{regimeLabel} • {ufCalculo}</Badge>
            <Button variant="outline" size="sm" onClick={copyResult}>
              <Download aria-hidden="true" /> Copiar
            </Button>
          </div>
        </div>

        {/* Export & Sync Buttons — uma ação principal (Enviar), o resto em contorno. */}
        <div className="mb-4 flex flex-wrap gap-2 rounded-md border border-border bg-secondary p-3">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText aria-hidden="true" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportWord}>
            <FileText aria-hidden="true" /> Word
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet aria-hidden="true" /> Excel
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={enviarParaProposta}>
            <Send aria-hidden="true" /> Enviar para Proposta Comercial
          </Button>
        </div>

        {/* Itens Tables */}
        {itens.map((item, idx) => (
          <div key={idx} className="mb-6 last:mb-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="tabular-nums">Item {idx + 1}</Badge>
              <span className="text-sm font-semibold text-foreground">{item.descricao}</span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {item.quantidade} {item.unidade}
              </span>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Componente</TableHead>
                    <TableHead className="w-[20%] text-right">Base de Cálculo</TableHead>
                    <TableHead className="w-[15%] text-right">Alíquota (%)</TableHead>
                    <TableHead className="w-[25%] text-right">Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(item.componentes || []).map((comp, ci) => (
                    <TableRow key={ci}>
                      <TableCell className="font-medium">{comp.componente}</TableCell>
                      <TableCell className="text-right tabular-nums" nowrap>
                        {comp.baseCalculo != null ? fmt(comp.baseCalculo) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums" nowrap>
                        {fmtPct(comp.aliquota)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums" nowrap>
                        {fmt(comp.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={3} className="font-semibold">
                      Preço Unitário Formado
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>
                      {fmt(item.precoUnitarioFormado)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={3} className="font-semibold">
                      Preço Total ({item.quantidade} {item.unidade})
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>
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
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-3 text-base font-semibold leading-6 text-foreground">Resumo Geral da Formação de Preço</h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left: Resumo Table */}
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Componente</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Custo Total dos Materiais/Serviços</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.custoTotalMateriais)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Frete e Logística</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.freteTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Despesas Administrativas</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.despesasAdm)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Total de Tributos</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-destructive-ink" nowrap>{fmt(resumo.totalTributos)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>BDI ({(resumo.bdiPercentual ?? 0).toFixed(2).replace('.', ',')}%)</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.bdiTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Margem de Lucro</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.margemLucro)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-secondary">
                  <TableCell className="font-semibold">PREÇO TOTAL FORMADO</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>{fmt(resumo.precoTotalFormado)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            {resumo.precoExtenso && (
              <div className="border-t border-border bg-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Por extenso: {resumo.precoExtenso}
                </p>
              </div>
            )}
          </div>

          {/* Right: Tributos Detalhados */}
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tributo</TableHead>
                    <TableHead className="text-right">Alíquota</TableHead>
                    <TableHead className="text-right">Valor (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(resumo.tributosPorImposto || []).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{t.imposto}</TableCell>
                      <TableCell className="text-right tabular-nums" nowrap>{fmtPct(t.aliquota)}</TableCell>
                      <TableCell className="text-right tabular-nums" nowrap>{fmt(t.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={2} className="font-semibold">Total Tributos</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-destructive-ink" nowrap>{fmt(resumo.totalTributos)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Parecer */}
            <div className={`rounded-lg border p-3 ${viabilidadeColor}`} role="status">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {viabilidadeIcon}
                <span className="text-sm font-semibold">Parecer: {parecer.viabilidade}</span>
                <span className="ml-auto text-sm tabular-nums">
                  Margem Líquida: {Number(parecer.margemLiquida || 0).toFixed(2).replace('.', ',')}%
                </span>
              </div>
              {parecer.alertaInexequibilidade && (
                <p className="mb-1 text-sm font-semibold">
                  ⚠ ALERTA — Art. 59, Lei 14.133/2021: Proposta com indícios de inexequibilidade.
                </p>
              )}
              <p className="text-sm leading-5">{parecer.observacoes}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Composição gerada por IA Contábil com alíquotas reais para {ufCalculo} ({ufNome}). Consulta oficial:{' '}
        <a href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral" target="_blank" rel="noopener noreferrer" className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Calculadora da Receita Federal
        </a>.
      </p>
    </div>
  );
}
