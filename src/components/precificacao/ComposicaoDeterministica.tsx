import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import {
  Calculator, Download, AlertTriangle, CheckCircle, XCircle,
  FileText, FileSpreadsheet, Send, Info, RotateCcw, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePropostaCart } from '@/contexts/PropostaCartContext';
import { valorPorExtenso } from '@/lib/numero-extenso';
import {
  type ComposicaoResult, type ItemComposicaoResult, type AlertaItem,
  recalcularComOverride, calcularPrecoFromMargem, gerarAlertasItem,
} from '@/lib/composicao-engine';
import {
  exportComposicaoPDF, exportComposicaoExcel, exportComposicaoWord,
  type ComposicaoData,
} from '@/lib/composicao-export';

interface Props {
  result: ComposicaoResult;
  onResultChange: (r: ComposicaoResult) => void;
  regimeLabel: string;
  ufCalculo: string;
  ufNome: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number | null) => v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—';

const parseCurrencyInput = (formatted: string): number => {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const formatCurrencyInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  if (num <= 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ComposicaoDeterministica({ result, onResultChange, regimeLabel, ufCalculo, ufNome }: Props) {
  const { addItem } = usePropostaCart();
  const { empresaAtiva } = useEmpresa();
  const exportOpts = useMemo(() => ({
    timbradoUrl: empresaAtiva?.timbrado_url,
    empresaNome: empresaAtiva?.razao_social,
  }), [empresaAtiva]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingMargemIndex, setEditingMargemIndex] = useState<number | null>(null);
  const [editMargemValue, setEditMargemValue] = useState('');

  const { itens, resumo, parecer } = result;

  // Convert to export format
  const toExportData = useCallback((): ComposicaoData => ({
    itens: itens.map(i => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      componentes: i.componentes.map(c => ({
        componente: c.componente,
        baseCalculo: c.baseCalculo,
        aliquota: c.aliquota,
        valor: c.valor,
      })),
      custoUnitario: i.custoUnitario,
      precoUnitarioFormado: i.precoUnitarioFinal,
      precoTotal: i.precoTotal,
    })),
    resumo: {
      custoTotalMateriais: resumo.custoTotalMateriais,
      totalTributos: resumo.totalTributos,
      tributosPorImposto: resumo.tributosPorImposto.map(t => ({
        imposto: t.imposto,
        aliquota: t.aliquota,
        valor: t.valor,
      })),
      bdiTotal: resumo.bdiTotal,
      bdiPercentual: resumo.bdiPercentual,
      freteTotal: resumo.freteTotal,
      despesasAdm: resumo.despesasAdm,
      margemLucro: resumo.precoTotalFormado - resumo.custoTotalMateriais - resumo.totalTributos - resumo.freteTotal - resumo.despesasAdm,
      precoTotalFormado: resumo.precoTotalFormado,
      precoExtenso: valorPorExtenso(resumo.precoTotalFormado),
    },
    parecer: {
      viabilidade: parecer.viabilidade,
      margemLiquida: parecer.margemLiquida,
      alertaInexequibilidade: parecer.alertaInexequibilidade,
      observacoes: parecer.observacoes,
    },
  }), [itens, resumo, parecer]);

  const handleExportPDF = async () => { await exportComposicaoPDF(toExportData(), regimeLabel, ufCalculo, exportOpts); toast.success('PDF exportado!'); };
  const handleExportExcel = () => { exportComposicaoExcel(toExportData(), regimeLabel, ufCalculo, exportOpts); toast.success('Excel exportado!'); };
  const handleExportWord = () => { exportComposicaoWord(toExportData(), regimeLabel, ufCalculo, exportOpts); toast.success('Word exportado!'); };

  const enviarParaProposta = () => {
    itens.forEach((item, idx) => {
      addItem({
        item: String(idx + 1),
        descricao: item.descricao,
        quantidade: String(item.quantidade),
        unidade: item.unidade,
        marca: '', fabricante: '', modelo: '',
        valorUnitario: item.precoUnitarioFinal.toFixed(2).replace('.', ','),
        valorUnitarioExtenso: valorPorExtenso(item.precoUnitarioFinal),
        valorTotal: item.precoTotal.toFixed(2).replace('.', ','),
        valorTotalExtenso: valorPorExtenso(item.precoTotal),
      });
    });
    toast.success(`${itens.length} item(ns) enviado(s) para a Proposta Comercial!`);
  };

  const startEdit = (idx: number, currentPrice: number) => {
    setEditingIndex(idx);
    setEditValue(currentPrice.toFixed(2).replace('.', ','));
  };

  const confirmEdit = (idx: number) => {
    const novoPreco = parseCurrencyInput(editValue);
    if (novoPreco <= 0) {
      toast.error('Informe um preço válido.');
      return;
    }
    const updated = recalcularComOverride(result, idx, novoPreco);
    onResultChange(updated);
    setEditingIndex(null);
    setEditValue('');
    toast.success('Preço atualizado — margem recalculada automaticamente.');
  };

  const revertToSuggested = (idx: number) => {
    const updated = recalcularComOverride(result, idx, 0);
    onResultChange(updated);
    toast.info('Preço revertido ao valor sugerido.');
  };

  const startEditMargem = (idx: number, currentMargem: number) => {
    setEditingMargemIndex(idx);
    setEditMargemValue(currentMargem.toFixed(2).replace('.', ','));
  };

  const confirmEditMargem = (idx: number) => {
    const margem = parseFloat(editMargemValue.replace(',', '.'));
    if (isNaN(margem) || margem < -100 || margem > 99) {
      toast.error('Informe uma margem válida (ex: 10,00).');
      return;
    }
    const item = result.itens[idx];
    const novoPreco = calcularPrecoFromMargem(item.custoUnitario, result.parametros, margem);
    const updated = recalcularComOverride(result, idx, novoPreco);
    onResultChange(updated);
    setEditingMargemIndex(null);
    setEditMargemValue('');
    toast.success(`Margem definida para ${margem.toFixed(2)}% — preço recalculado.`);
  };

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
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-base font-semibold leading-6 text-foreground">Planilha de Composição de Custo — Motor Determinístico</h4>
          </div>
          <Badge variant="secondary">{regimeLabel} • {ufCalculo}</Badge>
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
            <Send aria-hidden="true" /> Enviar para Proposta
          </Button>
        </div>

        {/* Info banner about manual editing */}
        <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-secondary p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Preço e lucro editáveis:</strong> Clique no ícone <Pencil className="inline h-3.5 w-3.5" aria-hidden="true" /> ao lado do preço unitário <strong>ou da margem de lucro</strong> para ajustar manualmente. O sistema recalculará todos os valores automaticamente.
          </p>
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
              {item.modoPreco === 'manual' && (
                <Badge variant="secondary">
                  <Pencil className="h-3 w-3" aria-hidden="true" /> Preço Manual
                </Badge>
              )}
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
                  {item.componentes.map((comp) => (
                    <TableRow key={comp.id} className={comp.editavel && item.modoPreco === 'manual' ? 'bg-primary-tint/40' : ''}>
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {comp.componente}
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="font-mono text-xs">{comp.formula}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right tabular-nums" nowrap>
                        {fmt(comp.baseCalculo)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums" nowrap>
                        {comp.editavel ? (
                          <div className="flex items-center justify-end gap-1">
                            {editingMargemIndex === idx ? (
                              <>
                                <Input
                                  aria-label="Margem de lucro (%)"
                                  value={editMargemValue}
                                  onChange={e => setEditMargemValue(e.target.value.replace(/[^0-9,.-]/g, ''))}
                                  className="h-9 w-20 px-2 text-right tabular-nums"
                                  autoFocus
                                  placeholder="10,00"
                                  onKeyDown={e => { if (e.key === 'Enter') confirmEditMargem(idx); if (e.key === 'Escape') setEditingMargemIndex(null); }}
                                />
                                <span className="text-xs">%</span>
                                <Button variant="ghost" size="icon-sm" onClick={() => confirmEditMargem(idx)} className="text-primary hover:text-primary" aria-label="Confirmar margem">
                                  <CheckCircle aria-hidden="true" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span>{fmtPct(comp.aliquota)}</span>
                                <Button variant="ghost" size="icon-sm" onClick={() => startEditMargem(idx, comp.aliquota ?? 0)} className="text-muted-foreground hover:text-primary" title="Editar margem de lucro" aria-label="Editar margem de lucro">
                                  <Pencil aria-hidden="true" />
                                </Button>
                              </>
                            )}
                          </div>
                        ) : (
                          fmtPct(comp.aliquota)
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${comp.editavel && comp.valor < 0 ? 'text-destructive-ink' : ''}`} nowrap>
                        {fmt(comp.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  {/* Preço Sugerido */}
                  {item.modoPreco === 'manual' && (
                    <TableRow className="hover:bg-secondary">
                      <TableCell colSpan={3} className="font-normal text-muted-foreground">
                        Preço Sugerido (calculado)
                      </TableCell>
                      <TableCell className="text-right font-normal tabular-nums text-muted-foreground" nowrap>
                        {fmt(item.precoUnitarioSugerido)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Preço Unitário Final — EDITABLE */}
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={3} className="font-semibold">
                      Preço Unitário {item.modoPreco === 'manual' ? '(Manual)' : '(Sugerido)'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {editingIndex === idx ? (
                          <>
                            <Input
                              aria-label="Preço unitário"
                              value={editValue}
                              onChange={e => setEditValue(formatCurrencyInput(e.target.value))}
                              className="h-9 w-28 text-right tabular-nums"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') confirmEdit(idx); if (e.key === 'Escape') setEditingIndex(null); }}
                            />
                            <Button variant="ghost" size="icon-sm" onClick={() => confirmEdit(idx)} className="text-primary hover:text-primary" aria-label="Confirmar preço">
                              <CheckCircle aria-hidden="true" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold tabular-nums text-foreground">{fmt(item.precoUnitarioFinal)}</span>
                            <Button variant="ghost" size="icon-sm" onClick={() => startEdit(idx, item.precoUnitarioFinal)} className="text-muted-foreground hover:text-primary" aria-label="Editar preço unitário">
                              <Pencil aria-hidden="true" />
                            </Button>
                            {item.modoPreco === 'manual' && (
                              <Button variant="ghost" size="icon-sm" onClick={() => revertToSuggested(idx)} className="text-muted-foreground hover:text-primary" title="Reverter ao sugerido" aria-label="Reverter ao sugerido">
                                <RotateCcw aria-hidden="true" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Preço Total */}
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={3} className="font-semibold">
                      Preço Total ({item.quantidade} {item.unidade})
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>
                      {fmt(item.precoTotal)}
                    </TableCell>
                  </TableRow>

                  {/* BDI */}
                  <TableRow className="hover:bg-secondary">
                    <TableCell colSpan={3} className="font-normal text-muted-foreground">
                      BDI ({item.bdiPercentual.toFixed(2).replace('.', ',')}%)
                    </TableCell>
                    <TableCell className="text-right font-normal tabular-nums text-muted-foreground" nowrap>
                      {fmt(item.bdiValor)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Alertas inteligentes por item */}
            {(() => {
              const alertas = gerarAlertasItem(item, result.parametros);
              if (alertas.length === 0) return null;
              return (
                <div className="mt-2 space-y-1.5">
                  {alertas.map((al, ai) => (
                    <div
                      key={ai}
                      role="alert"
                      className={`flex items-start gap-2 rounded-lg border p-3 ${
                        al.tipo === 'erro'
                          ? 'border-destructive-line bg-destructive-tint'
                          : al.tipo === 'atencao'
                          ? 'border-warning-line bg-warning-tint'
                          : 'border-border bg-secondary'
                      }`}
                    >
                      {al.tipo === 'erro' ? (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive-ink" aria-hidden="true" />
                      ) : al.tipo === 'atencao' ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${
                          al.tipo === 'erro' ? 'text-destructive-ink' : al.tipo === 'atencao' ? 'text-warning-ink' : 'text-foreground'
                        }`}>
                          {al.titulo}
                        </p>
                        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{al.mensagem}</p>
                        <p className="mt-1 text-xs text-muted-foreground">📜 {al.fundamentacao}</p>
                      </div>
                    </div>
                  ))}
                  <p className="pl-1 text-xs text-muted-foreground">
                    ℹ Alertas informativos — a decisão final é de responsabilidade exclusiva do usuário.
                  </p>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Resumo Geral */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-3 text-base font-semibold leading-6 text-foreground">Resumo Geral da Formação de Preço</h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left: Summary */}
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
                  <TableCell>Custo Total dos Materiais</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.custoTotalMateriais)}</TableCell>
                </TableRow>
                {resumo.freteTotal > 0 && (
                  <TableRow>
                    <TableCell>Frete ({resumo.fretePercentual}%)</TableCell>
                    <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.freteTotal)}</TableCell>
                  </TableRow>
                )}
                {resumo.despesasAdm > 0 && (
                  <TableRow>
                    <TableCell>Despesas Administrativas ({resumo.despesasAdmPercentual}%)</TableCell>
                    <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.despesasAdm)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell>Total de Tributos</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-destructive-ink" nowrap>{fmt(resumo.totalTributos)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>BDI ({resumo.bdiPercentual.toFixed(2).replace('.', ',')}%)</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmt(resumo.bdiTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    Margem de Lucro Resultante ({resumo.margemLucroResultante.toFixed(2).replace('.', ',')}%)
                    {resumo.margemLucroResultante !== resumo.margemLucroSugerida && (
                      <span className="ml-1 text-xs text-muted-foreground">(sugerido: {resumo.margemLucroSugerida}%)</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${resumo.margemLucroResultante < 0 ? 'text-destructive-ink' : 'text-success-ink'}`} nowrap>
                    {fmt(resumo.precoTotalFormado - resumo.custoTotalMateriais - resumo.totalTributos - resumo.freteTotal - resumo.despesasAdm)}
                  </TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-secondary">
                  <TableCell className="font-semibold">PREÇO TOTAL FORMADO</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground" nowrap>{fmt(resumo.precoTotalFormado)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <div className="border-t border-border bg-secondary px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Por extenso: {valorPorExtenso(resumo.precoTotalFormado)}
              </p>
            </div>
          </div>

          {/* Right: Tributos + Parecer */}
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
                  {resumo.tributosPorImposto.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.imposto}</TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{t.info}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
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

            {/* Alertas Globais */}
            {parecer.alertasGlobais.length > 0 && (
              <div className="space-y-1.5">
                {parecer.alertasGlobais.map((al, ai) => (
                  <div
                    key={ai}
                    role="alert"
                    className={`flex items-start gap-2 rounded-lg border p-3 ${
                      al.tipo === 'erro'
                        ? 'border-destructive-line bg-destructive-tint'
                        : al.tipo === 'atencao'
                        ? 'border-warning-line bg-warning-tint'
                        : 'border-border bg-secondary'
                    }`}
                  >
                    {al.tipo === 'erro' ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive-ink" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${al.tipo === 'erro' ? 'text-destructive-ink' : 'text-warning-ink'}`}>{al.titulo}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{al.mensagem}</p>
                      <p className="mt-1 text-xs text-muted-foreground">📜 {al.fundamentacao}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Parecer */}
            <div className={`rounded-lg border p-3 ${viabilidadeColor}`} role="status">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {viabilidadeIcon}
                <span className="text-sm font-semibold">Parecer: {parecer.viabilidade}</span>
                <span className="ml-auto text-sm tabular-nums">
                  Margem Líquida: {parecer.margemLiquida.toFixed(2).replace('.', ',')}%
                </span>
              </div>
              {parecer.alertaInexequibilidade && (
                <p className="mb-1 text-sm font-semibold">
                  ⚠ ALERTA — Art. 59, Lei 14.133/2021: Proposta com indícios de inexequibilidade.
                </p>
              )}
              <p className="text-sm leading-5">{parecer.observacoes}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {parecer.fundamentacaoLegal.map((f, i) => (
                  <Badge key={i} variant="outline">{f}</Badge>
                ))}
              </div>
              <p className="mt-2 border-t border-border pt-1.5 text-xs text-muted-foreground">
                ⚖ Os alertas são informativos e baseados na legislação vigente. A decisão final sobre os valores é de responsabilidade exclusiva do usuário.
              </p>
            </div>

            {/* Methodology note */}
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Metodologia:</strong> Mark-up Divisor (cálculo "por dentro"). Fórmula: Preço = Custo ÷ (1 − Σ alíquotas%). Tributos, frete, despesas e margem são calculados sobre o preço final formado.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Motor determinístico com alíquotas reais para {ufCalculo} ({ufNome}). Consulta oficial:{' '}
        <a href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral" target="_blank" rel="noopener noreferrer" className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Calculadora da Receita Federal
        </a>.
      </p>
    </div>
  );
}
