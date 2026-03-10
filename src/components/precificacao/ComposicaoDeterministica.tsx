import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
      margemLucro: resumo.margemLucroResultante,
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

  const handleExportPDF = () => { exportComposicaoPDF(toExportData(), regimeLabel, ufCalculo); toast.success('PDF exportado!'); };
  const handleExportExcel = () => { exportComposicaoExcel(toExportData(), regimeLabel, ufCalculo); toast.success('Excel exportado!'); };
  const handleExportWord = () => { exportComposicaoWord(toExportData(), regimeLabel, ufCalculo); toast.success('Word exportado!'); };

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
            <Calculator className="w-5 h-5 text-accent" />
            <h4 className="font-semibold text-sm">Planilha de Composição de Custo — Motor Determinístico</h4>
          </div>
          <Badge className="bg-accent/10 text-accent text-[10px]">{regimeLabel} • {ufCalculo}</Badge>
        </div>

        {/* Export & Sync Buttons */}
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/30 rounded-lg border border-border/30">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-xs">
            <FileText className="w-3.5 h-3.5 mr-1 text-destructive" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportWord} className="text-xs">
            <FileText className="w-3.5 h-3.5 mr-1 text-primary" /> Word
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-accent" /> Excel
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={enviarParaProposta} className="bg-accent hover:bg-accent/90 text-accent-foreground text-xs">
            <Send className="w-3.5 h-3.5 mr-1" /> Enviar para Proposta
          </Button>
        </div>

        {/* Info banner about manual editing */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2 mb-4">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            <strong className="text-foreground">Preço e lucro editáveis:</strong> Clique no ícone <Pencil className="w-3 h-3 inline" /> ao lado do preço unitário <strong>ou da margem de lucro</strong> para ajustar manualmente. O sistema recalculará todos os valores automaticamente.
          </p>
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
              {item.modoPreco === 'manual' && (
                <Badge className="bg-primary/10 text-primary text-[9px] border-primary/20">
                  <Pencil className="w-2.5 h-2.5 mr-0.5" /> Preço Manual
                </Badge>
              )}
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
                  {item.componentes.map((comp) => (
                    <TableRow key={comp.id} className={`hover:bg-muted/30 ${comp.editavel && item.modoPreco === 'manual' ? 'bg-primary/5' : ''}`}>
                      <TableCell className="text-[11px] py-2 font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-left">
                              {comp.componente}
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="text-[10px] font-mono">{comp.formula}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono">
                        {fmt(comp.baseCalculo)}
                      </TableCell>
                      <TableCell className="text-[11px] py-2 text-right font-mono">
                        {comp.editavel ? (
                          <div className="flex items-center justify-end gap-1">
                            {editingMargemIndex === idx ? (
                              <>
                                <Input
                                  value={editMargemValue}
                                  onChange={e => setEditMargemValue(e.target.value.replace(/[^0-9,.-]/g, ''))}
                                  className="h-6 w-16 text-right text-[11px] font-mono px-1"
                                  autoFocus
                                  placeholder="10,00"
                                  onKeyDown={e => { if (e.key === 'Enter') confirmEditMargem(idx); if (e.key === 'Escape') setEditingMargemIndex(null); }}
                                />
                                <span className="text-[10px]">%</span>
                                <Button variant="ghost" size="sm" onClick={() => confirmEditMargem(idx)} className="h-5 w-5 p-0 text-accent">
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span>{fmtPct(comp.aliquota)}</span>
                                <Button variant="ghost" size="sm" onClick={() => startEditMargem(idx, comp.aliquota ?? 0)} className="h-5 w-5 p-0 text-muted-foreground hover:text-primary" title="Editar margem de lucro">
                                  <Pencil className="w-2.5 h-2.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        ) : (
                          fmtPct(comp.aliquota)
                        )}
                      </TableCell>
                      <TableCell className={`text-[11px] py-2 text-right font-mono font-semibold ${comp.editavel && comp.valor < 0 ? 'text-destructive' : ''}`}>
                        {fmt(comp.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  {/* Preço Sugerido */}
                  {item.modoPreco === 'manual' && (
                    <TableRow className="bg-muted/30 border-t border-border">
                      <TableCell colSpan={3} className="text-[10px] py-1.5 text-muted-foreground italic">
                        Preço Sugerido (calculado)
                      </TableCell>
                      <TableCell className="text-[10px] py-1.5 text-right font-mono text-muted-foreground italic">
                        {fmt(item.precoUnitarioSugerido)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Preço Unitário Final — EDITABLE */}
                  <TableRow className="bg-accent/5 border-t-2 border-accent/20">
                    <TableCell colSpan={3} className="text-[11px] py-2 font-bold">
                      Preço Unitário {item.modoPreco === 'manual' ? '(Manual)' : '(Sugerido)'}
                    </TableCell>
                    <TableCell className="text-[11px] py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {editingIndex === idx ? (
                          <>
                            <Input
                              value={editValue}
                              onChange={e => setEditValue(formatCurrencyInput(e.target.value))}
                              className="h-7 w-28 text-right text-[11px] font-mono"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') confirmEdit(idx); if (e.key === 'Escape') setEditingIndex(null); }}
                            />
                            <Button variant="ghost" size="sm" onClick={() => confirmEdit(idx)} className="h-6 w-6 p-0 text-accent">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="font-mono font-bold text-accent">{fmt(item.precoUnitarioFinal)}</span>
                            <Button variant="ghost" size="sm" onClick={() => startEdit(idx, item.precoUnitarioFinal)} className="h-6 w-6 p-0 text-muted-foreground hover:text-primary">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            {item.modoPreco === 'manual' && (
                              <Button variant="ghost" size="sm" onClick={() => revertToSuggested(idx)} className="h-6 w-6 p-0 text-muted-foreground hover:text-accent" title="Reverter ao sugerido">
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Preço Total */}
                  <TableRow className="bg-accent/10">
                    <TableCell colSpan={3} className="text-[11px] py-2 font-bold">
                      Preço Total ({item.quantidade} {item.unidade})
                    </TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono font-bold text-accent">
                      {fmt(item.precoTotal)}
                    </TableCell>
                  </TableRow>

                  {/* BDI */}
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={3} className="text-[10px] py-1.5 text-muted-foreground">
                      BDI ({item.bdiPercentual.toFixed(2).replace('.', ',')}%)
                    </TableCell>
                    <TableCell className="text-[10px] py-1.5 text-right font-mono text-muted-foreground">
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
                      className={`rounded-lg border p-2.5 flex items-start gap-2 ${
                        al.tipo === 'erro'
                          ? 'bg-destructive/10 border-destructive/20'
                          : al.tipo === 'atencao'
                          ? 'bg-primary/10 border-primary/20'
                          : 'bg-muted/50 border-border/50'
                      }`}
                    >
                      {al.tipo === 'erro' ? (
                        <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      ) : al.tipo === 'atencao' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold ${
                          al.tipo === 'erro' ? 'text-destructive' : al.tipo === 'atencao' ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {al.titulo}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{al.mensagem}</p>
                        <p className="text-[9px] text-muted-foreground/70 italic mt-1">📜 {al.fundamentacao}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[9px] text-muted-foreground/60 italic pl-1">
                    ℹ Alertas informativos — a decisão final é de responsabilidade exclusiva do usuário.
                  </p>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Resumo Geral */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <h4 className="font-semibold text-sm mb-3">Resumo Geral da Formação de Preço</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Summary */}
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
                  <TableCell className="text-[11px] py-2">Custo Total dos Materiais</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.custoTotalMateriais)}</TableCell>
                </TableRow>
                {resumo.freteTotal > 0 && (
                  <TableRow>
                    <TableCell className="text-[11px] py-2">Frete ({resumo.fretePercentual}%)</TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.freteTotal)}</TableCell>
                  </TableRow>
                )}
                {resumo.despesasAdm > 0 && (
                  <TableRow>
                    <TableCell className="text-[11px] py-2">Despesas Administrativas ({resumo.despesasAdmPercentual}%)</TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.despesasAdm)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="text-[11px] py-2">Total de Tributos</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono text-destructive font-semibold">{fmt(resumo.totalTributos)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">BDI ({resumo.bdiPercentual.toFixed(2).replace('.', ',')}%)</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono">{fmt(resumo.bdiTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-[11px] py-2">
                    Margem de Lucro Resultante ({resumo.margemLucroResultante.toFixed(2).replace('.', ',')}%)
                    {resumo.margemLucroResultante !== resumo.margemLucroSugerida && (
                      <span className="text-[9px] text-primary ml-1">(sugerido: {resumo.margemLucroSugerida}%)</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-[11px] py-2 text-right font-mono font-semibold ${resumo.margemLucroResultante < 0 ? 'text-destructive' : 'text-accent'}`}>
                    {fmt(resumo.precoTotalFormado - resumo.custoTotalMateriais - resumo.totalTributos - resumo.freteTotal - resumo.despesasAdm)}
                  </TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow className="bg-accent/10 border-t-2 border-accent/20">
                  <TableCell className="text-[12px] py-2.5 font-bold">PREÇO TOTAL FORMADO</TableCell>
                  <TableCell className="text-[12px] py-2.5 text-right font-mono font-bold text-accent">{fmt(resumo.precoTotalFormado)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <div className="px-3 py-2 bg-muted/30 border-t border-border">
              <p className="text-[10px] text-muted-foreground italic">
                Por extenso: {valorPorExtenso(resumo.precoTotalFormado)}
              </p>
            </div>
          </div>

          {/* Right: Tributos + Parecer */}
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
                  {resumo.tributosPorImposto.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[11px] py-2 font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-left">{t.imposto}</TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs"><p className="text-[10px]">{t.info}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
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

            {/* Alertas Globais */}
            {parecer.alertasGlobais.length > 0 && (
              <div className="space-y-1.5">
                {parecer.alertasGlobais.map((al, ai) => (
                  <div
                    key={ai}
                    className={`rounded-lg border p-3 flex items-start gap-2 ${
                      al.tipo === 'erro'
                        ? 'bg-destructive/10 border-destructive/20'
                        : al.tipo === 'atencao'
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-muted/50 border-border/50'
                    }`}
                  >
                    {al.tipo === 'erro' ? (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-[11px] font-bold ${al.tipo === 'erro' ? 'text-destructive' : 'text-primary'}`}>{al.titulo}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{al.mensagem}</p>
                      <p className="text-[9px] text-muted-foreground/70 italic mt-1">📜 {al.fundamentacao}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Parecer */}
            <div className={`rounded-lg border p-3 ${viabilidadeColor}`}>
              <div className="flex items-center gap-2 mb-1.5">
                {viabilidadeIcon}
                <span className="text-xs font-bold">Parecer: {parecer.viabilidade}</span>
                <span className="text-[10px] ml-auto font-mono">
                  Margem Líquida: {parecer.margemLiquida.toFixed(2).replace('.', ',')}%
                </span>
              </div>
              {parecer.alertaInexequibilidade && (
                <p className="text-[10px] font-semibold mb-1">
                  ⚠ ALERTA — Art. 59, Lei 14.133/2021: Proposta com indícios de inexequibilidade.
                </p>
              )}
              <p className="text-[10px] leading-relaxed">{parecer.observacoes}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {parecer.fundamentacaoLegal.map((f, i) => (
                  <Badge key={i} variant="outline" className="text-[8px] px-1.5 py-0.5">{f}</Badge>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground/60 italic mt-2 border-t border-current/10 pt-1.5">
                ⚖ Os alertas são informativos e baseados na legislação vigente. A decisão final sobre os valores é de responsabilidade exclusiva do usuário.
              </p>
            </div>

            {/* Methodology note */}
            <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] text-muted-foreground">
                <strong className="text-foreground">Metodologia:</strong> Mark-up Divisor (cálculo "por dentro"). Fórmula: Preço = Custo ÷ (1 − Σ alíquotas%). Tributos, frete, despesas e margem são calculados sobre o preço final formado.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Motor determinístico com alíquotas reais para {ufCalculo} ({ufNome}). Consulta oficial:{' '}
        <a href="https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/regime-geral" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Calculadora da Receita Federal
        </a>.
      </p>
    </div>
  );
}
