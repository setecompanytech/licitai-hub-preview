import { useState, useMemo } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Calculator, Loader2, Download, Info, Save, HardHat, Plus, Trash2, FileText, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { valorPorExtenso } from '@/lib/numero-extenso';
import { writeExcelFile } from '@/lib/excel-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── BDI Ranges per TCU Acórdão 2622/2013 ──
const BDI_RANGES = {
  obras: {
    label: 'Obras e Serviços de Engenharia',
    ref: 'Acórdão TCU 2622/2013',
    componentes: [
      { id: 'ac', nome: 'Administração Central', min: 3.0, max: 5.5, padrao: 4.0, info: 'Custos da sede: aluguel, pessoal administrativo, etc.' },
      { id: 'sg', nome: 'Seguro + Garantia', min: 0.8, max: 1.0, padrao: 0.8, info: 'Seguro de obra e garantia contratual (Art. 96 Lei 14.133)' },
      { id: 'risco', nome: 'Risco', min: 0.97, max: 1.27, padrao: 1.0, info: 'Contingências e imprevistos de execução' },
      { id: 'df', nome: 'Despesas Financeiras', min: 0.59, max: 1.39, padrao: 1.0, info: 'Custo do capital empregado durante a execução' },
      { id: 'lucro', nome: 'Lucro', min: 6.16, max: 8.96, padrao: 7.4, info: 'Remuneração do empresário (Acórdão TCU 325/2007)' },
    ],
  },
  servicos_comuns: {
    label: 'Serviços Comuns de Engenharia',
    ref: 'Acórdão TCU 2622/2013 + IN 5/2017',
    componentes: [
      { id: 'ac', nome: 'Administração Central', min: 3.0, max: 5.0, padrao: 4.0, info: 'Custos da sede' },
      { id: 'sg', nome: 'Seguro + Garantia', min: 0.5, max: 1.0, padrao: 0.8, info: 'Seguro e garantia' },
      { id: 'risco', nome: 'Risco', min: 0.5, max: 1.5, padrao: 1.0, info: 'Contingências' },
      { id: 'df', nome: 'Despesas Financeiras', min: 0.5, max: 1.5, padrao: 1.0, info: 'Custo do capital' },
      { id: 'lucro', nome: 'Lucro', min: 5.0, max: 8.0, padrao: 6.5, info: 'Remuneração do empresário' },
    ],
  },
};

// ── Tributos por regime ──
function getTributosPorRegime(regime: string, tipo: 'obras' | 'servicos_comuns') {
  if (regime === 'simples_nacional') {
    return [
      { id: 'das', nome: 'DAS (Unificado)', aliquota: 0, editavel: true, info: 'Alíquota efetiva do Simples Nacional conforme faixa de faturamento' },
    ];
  }
  if (regime === 'lucro_presumido') {
    return [
      { id: 'pis', nome: 'PIS', aliquota: 0.65, editavel: false, info: 'Cumulativo: 0,65%' },
      { id: 'cofins', nome: 'COFINS', aliquota: 3.0, editavel: false, info: 'Cumulativo: 3,00%' },
      { id: 'iss', nome: 'ISS', aliquota: 5.0, editavel: true, info: 'ISS municipal: 2% a 5%' },
      { id: 'cprb', nome: 'CPRB', aliquota: 4.5, editavel: true, info: 'Contribuição Previdenciária sobre Receita Bruta (desoneração)' },
    ];
  }
  // Lucro Real
  return [
    { id: 'pis', nome: 'PIS', aliquota: 1.65, editavel: false, info: 'Não-cumulativo: 1,65%' },
    { id: 'cofins', nome: 'COFINS', aliquota: 7.6, editavel: false, info: 'Não-cumulativo: 7,60%' },
    { id: 'iss', nome: 'ISS', aliquota: 5.0, editavel: true, info: 'ISS municipal: 2% a 5%' },
    { id: 'cprb', nome: 'CPRB', aliquota: 4.5, editavel: true, info: 'Contribuição Previdenciária sobre Receita Bruta' },
  ];
}

// ── Encargos Sociais padrão ──
const ENCARGOS_SOCIAIS = [
  { id: 'inss', nome: 'INSS Patronal', aliquota: 20.0, info: 'Art. 22 Lei 8.212/91' },
  { id: 'fgts', nome: 'FGTS', aliquota: 8.0, info: 'Lei 8.036/90' },
  { id: 'rat', nome: 'RAT/SAT', aliquota: 3.0, info: 'Risco de Acidente de Trabalho' },
  { id: 'terceiros', nome: 'Terceiros (S/SESI/SENAI)', aliquota: 5.8, info: 'Sistema S' },
  { id: 'ferias', nome: 'Férias + 1/3', aliquota: 11.11, info: '8,33% + 2,78% (1/3 constitucional)' },
  { id: '13o', nome: '13º Salário', aliquota: 8.33, info: 'Provisão mensal' },
  { id: 'multa_fgts', nome: 'Multa FGTS (rescisão)', aliquota: 4.0, info: '40% sobre FGTS' },
];

type ItemCusto = {
  descricao: string;
  quantidade: string;
  unidade: string;
  custoUnitario: string;
};

interface Props {
  regimeLabel: string;
  regime: string;
  ufCalculo: string;
  ufNome: string;
  licitacaoNumero: string;
  licitacaoOrgao: string;
  initialItens?: { descricao: string; quantidade: number; unidade: string; custoUnitario: number }[];
}

const fmtCur = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPerc = (v: number) => `${v.toFixed(2)}%`;

const formatCurrencyInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num > 0 ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
};
const parseCurrencyInput = (f: string): number => {
  const d = f.replace(/\D/g, '');
  return d ? parseInt(d, 10) / 100 : 0;
};

export default function ServicoEngenhariaCalculadora({ regimeLabel, regime, ufCalculo, ufNome, licitacaoNumero, licitacaoOrgao, initialItens }: Props) {
  const { empresaAtiva } = useEmpresa();
  const { user } = useAuth();

  const [tipoServico, setTipoServico] = useState<'obras' | 'servicos_comuns'>('obras');
  const bdiConfig = BDI_RANGES[tipoServico];

  // BDI components
  const [bdiValues, setBdiValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    bdiConfig.componentes.forEach(c => { initial[c.id] = c.padrao; });
    return initial;
  });

  // Tributos
  const tributosPadrao = getTributosPorRegime(regime, tipoServico);
  const [tributoValues, setTributoValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    tributosPadrao.forEach(t => { initial[t.id] = t.aliquota; });
    return initial;
  });

  // Encargos
  const [encargosValues, setEncargosValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    ENCARGOS_SOCIAIS.forEach(e => { initial[e.id] = e.aliquota; });
    return initial;
  });

  // Itens de custo
  const [itens, setItens] = useState<ItemCusto[]>(
    initialItens && initialItens.length > 0
      ? initialItens.map(i => ({
          descricao: i.descricao,
          quantidade: String(i.quantidade),
          unidade: i.unidade,
          custoUnitario: i.custoUnitario > 0
            ? i.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '',
        }))
      : [{ descricao: '', quantidade: '1', unidade: 'M²', custoUnitario: '' }]
  );

  const [calculado, setCalculado] = useState(false);

  // Update BDI when type changes
  const handleTipoChange = (tipo: 'obras' | 'servicos_comuns') => {
    setTipoServico(tipo);
    const newConfig = BDI_RANGES[tipo];
    const newBdi: Record<string, number> = {};
    newConfig.componentes.forEach(c => { newBdi[c.id] = c.padrao; });
    setBdiValues(newBdi);
    setCalculado(false);
  };

  // ── BDI Calculation (TCU formula) ──
  const bdiCalc = useMemo(() => {
    const ac = (bdiValues.ac || 0) / 100;
    const sg = (bdiValues.sg || 0) / 100;
    const risco = (bdiValues.risco || 0) / 100;
    const df = (bdiValues.df || 0) / 100;
    const lucro = (bdiValues.lucro || 0) / 100;

    const totalTributos = Object.values(tributoValues).reduce((sum, v) => sum + v, 0) / 100;
    const totalEncargos = Object.values(encargosValues).reduce((sum, v) => sum + v, 0);

    // BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 - I)] - 1
    const numerador = (1 + ac + sg + risco) * (1 + df) * (1 + lucro);
    const denominador = 1 - totalTributos;
    const bdiPerc = denominador > 0 ? (numerador / denominador - 1) * 100 : 0;

    return {
      bdiPercentual: bdiPerc,
      totalTributosPerc: totalTributos * 100,
      totalEncargosPerc: totalEncargos,
      ac: ac * 100,
      sg: sg * 100,
      risco: risco * 100,
      df: df * 100,
      lucro: lucro * 100,
    };
  }, [bdiValues, tributoValues, encargosValues]);

  // ── Resultado ──
  const resultado = useMemo(() => {
    if (!calculado) return null;

    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) return null;

    const bdi = bdiCalc.bdiPercentual / 100;
    const encargos = bdiCalc.totalEncargosPerc / 100;

    const itensCalculados = validItens.map(item => {
      const custo = parseCurrencyInput(item.custoUnitario);
      const qtd = parseFloat(item.quantidade) || 1;
      const custoComEncargos = custo * (1 + encargos);
      const precoUnitario = custoComEncargos * (1 + bdi);
      const precoTotal = precoUnitario * qtd;
      return {
        descricao: item.descricao,
        quantidade: qtd,
        unidade: item.unidade,
        custoUnitario: custo,
        custoComEncargos,
        encargosValor: custo * encargos,
        bdiValor: custoComEncargos * bdi,
        precoUnitario,
        precoTotal,
      };
    });

    const totalCusto = itensCalculados.reduce((s, i) => s + i.custoUnitario * i.quantidade, 0);
    const totalEncargos = itensCalculados.reduce((s, i) => s + i.encargosValor * i.quantidade, 0);
    const totalBDI = itensCalculados.reduce((s, i) => s + i.bdiValor * i.quantidade, 0);
    const totalPreco = itensCalculados.reduce((s, i) => s + i.precoTotal, 0);

    return {
      itens: itensCalculados,
      totalCusto,
      totalEncargos,
      totalBDI,
      totalPreco,
      bdiPerc: bdiCalc.bdiPercentual,
      encargosPerc: bdiCalc.totalEncargosPerc,
      tributosPerc: bdiCalc.totalTributosPerc,
    };
  }, [calculado, itens, bdiCalc]);

  const calcular = () => {
    const validItens = itens.filter(i => i.descricao.trim() && i.custoUnitario.trim());
    if (validItens.length === 0) {
      toast.error('Informe pelo menos um item com descrição e custo.');
      return;
    }
    setCalculado(true);
    toast.success('Composição de custos calculada!');
  };

  // ── Item management ──
  const addItem = () => setItens(prev => [...prev, { descricao: '', quantidade: '1', unidade: 'M²', custoUnitario: '' }]);
  const updateItem = (i: number, field: keyof ItemCusto, value: string) => setItens(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  const removeItem = (i: number) => { if (itens.length > 1) setItens(prev => prev.filter((_, idx) => idx !== i)); };

  // ── Export XLSX ──
  const exportXLSX = async () => {
    if (!resultado) return;

    // Sheet 1: Composição BDI
    const bdiRows: any[][] = [
      ['COMPOSIÇÃO DE BDI — ' + bdiConfig.label.toUpperCase()],
      [`Referência: ${bdiConfig.ref} | Lei 14.133/2021`],
      [`Regime Tributário: ${regimeLabel} | UF: ${ufCalculo}`],
      [],
      ['COMPONENTES DO BDI'],
      ['Componente', 'Percentual (%)', 'Referência TCU (Min)', 'Referência TCU (Max)'],
    ];
    bdiConfig.componentes.forEach(c => {
      bdiRows.push([c.nome, `${bdiValues[c.id].toFixed(2)}%`, `${c.min.toFixed(2)}%`, `${c.max.toFixed(2)}%`]);
    });
    bdiRows.push([]);
    bdiRows.push(['TRIBUTOS "POR DENTRO"']);
    bdiRows.push(['Tributo', 'Alíquota (%)']);
    tributosPadrao.forEach(t => {
      bdiRows.push([t.nome, `${tributoValues[t.id].toFixed(2)}%`]);
    });
    bdiRows.push([]);
    bdiRows.push(['BDI CALCULADO', `${bdiCalc.bdiPercentual.toFixed(2)}%`]);
    bdiRows.push(['Fórmula: BDI = [(1+AC+S+R)×(1+DF)×(1+L)/(1-I)] - 1']);

    // Sheet 2: Encargos Sociais
    const encRows: any[][] = [
      ['ENCARGOS SOCIAIS E TRABALHISTAS'],
      [],
      ['Componente', 'Alíquota (%)', 'Fundamentação'],
    ];
    ENCARGOS_SOCIAIS.forEach(e => {
      encRows.push([e.nome, `${encargosValues[e.id].toFixed(2)}%`, e.info]);
    });
    encRows.push([]);
    encRows.push(['TOTAL ENCARGOS SOCIAIS', `${bdiCalc.totalEncargosPerc.toFixed(2)}%`]);

    // Sheet 3: Planilha de Custos
    const custRows: any[][] = [
      ['PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS'],
      [`${bdiConfig.label} | ${regimeLabel} | UF: ${ufCalculo}`],
      [`Licitação: ${licitacaoNumero || 'N/I'} | Órgão: ${licitacaoOrgao || 'N/I'}`],
      [],
      ['Item', 'Descrição', 'Qtd', 'Und', 'Custo Unit. (R$)', 'Encargos (R$)', 'BDI (R$)', 'Preço Unit. (R$)', 'Preço Total (R$)'],
    ];
    resultado.itens.forEach((item, idx) => {
      custRows.push([idx + 1, item.descricao, item.quantidade, item.unidade, item.custoUnitario, item.encargosValor, item.bdiValor, item.precoUnitario, item.precoTotal]);
    });
    custRows.push([]);
    custRows.push(['', 'TOTAIS', '', '', resultado.totalCusto, resultado.totalEncargos, resultado.totalBDI, '', resultado.totalPreco]);
    custRows.push([]);
    custRows.push(['', 'BDI Aplicado:', '', '', `${bdiCalc.bdiPercentual.toFixed(2)}%`]);
    custRows.push(['', 'Encargos Sociais:', '', '', `${bdiCalc.totalEncargosPerc.toFixed(2)}%`]);
    custRows.push(['', 'Tributos (por dentro):', '', '', `${bdiCalc.totalTributosPerc.toFixed(2)}%`]);
    custRows.push([]);
    custRows.push([`Valor Total: ${fmtCur(resultado.totalPreco)} (${valorPorExtenso(resultado.totalPreco)})`]);

    await writeExcelFile(`composicao-custos-engenharia-${tipoServico}.xlsx`, [
      { name: 'Composição BDI', data: bdiRows, colWidths: [40, 18, 18, 18] },
      { name: 'Encargos Sociais', data: encRows, colWidths: [35, 16, 45] },
      { name: 'Planilha de Custos', data: custRows, colWidths: [6, 40, 8, 6, 16, 16, 16, 16, 18] },
    ]);
    toast.success('Planilha Excel exportada com sucesso!');
  };

  // ── Export PDF ──
  const exportPDF = () => {
    if (!resultado) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const w = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS — ' + bdiConfig.label.toUpperCase(), w / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${bdiConfig.ref} | Lei 14.133/2021 | Regime: ${regimeLabel} | UF: ${ufCalculo}`, w / 2, y, { align: 'center' });
    y += 8;

    // BDI Summary
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`BDI: ${fmtPerc(bdiCalc.bdiPercentual)} | Encargos Sociais: ${fmtPerc(bdiCalc.totalEncargosPerc)} | Tributos: ${fmtPerc(bdiCalc.totalTributosPerc)}`, 14, y);
    y += 6;

    // Items table
    autoTable(doc, {
      head: [['Item', 'Descrição', 'Qtd', 'Und', 'Custo Unit.', 'Encargos', 'BDI', 'Preço Unit.', 'Preço Total']],
      body: resultado.itens.map((item, idx) => [
        String(idx + 1),
        item.descricao,
        String(item.quantidade),
        item.unidade,
        fmtCur(item.custoUnitario),
        fmtCur(item.encargosValor),
        fmtCur(item.bdiValor),
        fmtCur(item.precoUnitario),
        fmtCur(item.precoTotal),
      ]),
      startY: y,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Totals
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`VALOR TOTAL: ${fmtCur(resultado.totalPreco)}`, 14, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`(${valorPorExtenso(resultado.totalPreco)})`, 14, y);
    y += 8;

    // BDI composition table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('COMPOSIÇÃO DO BDI', 14, y);
    y += 1;
    autoTable(doc, {
      head: [['Componente', '%', 'Ref. Mín.', 'Ref. Máx.']],
      body: [
        ...bdiConfig.componentes.map(c => [c.nome, fmtPerc(bdiValues[c.id]), fmtPerc(c.min), fmtPerc(c.max)]),
        ...tributosPadrao.map(t => [t.nome + ' (tributo)', fmtPerc(tributoValues[t.id]), '', '']),
        [{ content: 'BDI TOTAL', styles: { fontStyle: 'bold' } }, { content: fmtPerc(bdiCalc.bdiPercentual), styles: { fontStyle: 'bold' } }, '', ''],
      ],
      startY: y,
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    doc.setFontSize(6);
    doc.setTextColor(120);
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | PRAEFECTUS — Sistema de Precificação`, 14, finalY);

    doc.save(`composicao-custos-engenharia-${tipoServico}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  return (
    <div className="space-y-5">
      {/* Tipo de Serviço */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <HardHat className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-semibold leading-6 text-foreground">Serviços de Engenharia — Composição BDI</h3>
          <Badge variant="outline" className="ml-auto">{bdiConfig.ref}</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="eng-tipo-servico">Tipo de Serviço</Label>
            <Select value={tipoServico} onValueChange={(v) => handleTipoChange(v as any)}>
              <SelectTrigger id="eng-tipo-servico"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="obras">Obras e Serviços de Engenharia</SelectItem>
                <SelectItem value="servicos_comuns">Serviços Comuns de Engenharia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Badge variant="secondary" className="mb-2 tabular-nums">
              BDI Calculado: {fmtPerc(bdiCalc.bdiPercentual)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Componentes do BDI — tabela editável (campos de 40px em célula px-2 py-1.5) */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
        <h4 className="text-base font-semibold leading-6 text-foreground">Componentes do BDI</h4>
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead className="w-28 text-right">% Adotado</TableHead>
                <TableHead className="w-24 text-right">Mín. TCU</TableHead>
                <TableHead className="w-24 text-right">Máx. TCU</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bdiConfig.componentes.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="px-2 py-1.5 font-medium" nowrap>{c.nome}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    <Input
                      aria-label={`Percentual adotado de ${c.nome}`}
                      type="number"
                      value={bdiValues[c.id] || ''}
                      onChange={e => {
                        setBdiValues(prev => ({ ...prev, [c.id]: parseFloat(e.target.value) || 0 }));
                        setCalculado(false);
                      }}
                      className="ml-auto w-24 text-right tabular-nums"
                      step="0.01"
                      min={0}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPerc(c.min)}</TableCell>
                  <TableCell className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPerc(c.max)}</TableCell>
                  <TableCell className="px-2 py-1.5 text-muted-foreground">{c.info}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Tributos */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h4 className="text-base font-semibold leading-6 text-foreground">Tributos "Por Dentro" — {regimeLabel}</h4>
          <Badge variant="outline" className="tabular-nums">Total: {fmtPerc(bdiCalc.totalTributosPerc)}</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {tributosPadrao.map(t => (
            <div key={t.id} className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor={`eng-tributo-${t.id}`}>{t.nome}</Label>
                <TooltipProvider><Tooltip><TooltipTrigger aria-label={`Sobre ${t.nome}`} className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /></TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-xs">{t.info}</p></TooltipContent></Tooltip></TooltipProvider>
              </div>
              <Input
                id={`eng-tributo-${t.id}`}
                type="number"
                value={tributoValues[t.id] || ''}
                onChange={e => {
                  setTributoValues(prev => ({ ...prev, [t.id]: parseFloat(e.target.value) || 0 }));
                  setCalculado(false);
                }}
                className="tabular-nums"
                step="0.01"
                min={0}
                disabled={!t.editavel}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Encargos Sociais */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h4 className="text-base font-semibold leading-6 text-foreground">Encargos Sociais e Trabalhistas</h4>
          <Badge variant="outline" className="tabular-nums">Total: {fmtPerc(bdiCalc.totalEncargosPerc)}</Badge>
        </div>
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead className="w-28 text-right">% Adotado</TableHead>
                <TableHead>Fundamentação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENCARGOS_SOCIAIS.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="px-2 py-1.5 font-medium" nowrap>{e.nome}</TableCell>
                  <TableCell className="px-2 py-1.5">
                    <Input
                      aria-label={`Percentual adotado de ${e.nome}`}
                      type="number"
                      value={encargosValues[e.id] || ''}
                      onChange={ev => {
                        setEncargosValues(prev => ({ ...prev, [e.id]: parseFloat(ev.target.value) || 0 }));
                        setCalculado(false);
                      }}
                      className="ml-auto w-24 text-right tabular-nums"
                      step="0.01"
                    />
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-muted-foreground">{e.info}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Itens de Custo */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h4 className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Itens de Custo Direto
          </h4>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus aria-hidden="true" /> Adicionar Item
          </Button>
        </div>
        {/* Doze colunas só a partir de `sm`; no celular a linha vira duas colunas. */}
        {itens.map((item, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-3 sm:grid-cols-12 sm:items-end">
            <div className="col-span-2 space-y-1.5 sm:col-span-5">
              <Label htmlFor={`eng-item-${idx}-descricao`}>Descrição *</Label>
              <Input id={`eng-item-${idx}-descricao`} value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="Ex: Concreto fck 30 MPa" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`eng-item-${idx}-qtd`}>Qtd</Label>
              <Input id={`eng-item-${idx}-qtd`} value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} placeholder="1" className="tabular-nums" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`eng-item-${idx}-unidade`}>Unidade</Label>
              <Select value={item.unidade} onValueChange={v => updateItem(idx, 'unidade', v)}>
                <SelectTrigger id={`eng-item-${idx}-unidade`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['UN', 'M', 'M²', 'M³', 'KG', 'T', 'L', 'H', 'MÊS', 'VB', 'CJ', 'GL'].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`eng-item-${idx}-custo`}>Custo Unit. (R$) *</Label>
              <Input id={`eng-item-${idx}-custo`} value={item.custoUnitario} onChange={e => updateItem(idx, 'custoUnitario', formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" className="tabular-nums" />
            </div>
            <div className="col-span-2 flex justify-end sm:col-span-1 sm:justify-start">
              {itens.length > 1 && (
                <Button variant="ghost-destructive" size="icon-sm" onClick={() => removeItem(idx)} aria-label={`Remover item ${idx + 1}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Calcular */}
      <Button onClick={calcular} className="w-full" size="lg">
        <Calculator aria-hidden="true" /> Calcular Composição de Custos
      </Button>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h4 className="text-base font-semibold leading-6 text-foreground">Resultado da Composição</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportXLSX}>
                <Download aria-hidden="true" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <Download aria-hidden="true" /> PDF
              </Button>
            </div>
          </div>

          {/* Summary cards — KPIs à esquerda, valor 24/600 tabular, tinta ink;
              o total na tinta da ação. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">Custo Direto</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmtCur(resultado.totalCusto)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">Encargos ({fmtPerc(resultado.encargosPerc)})</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-info-ink">{fmtCur(resultado.totalEncargos)}</p>
            </div>
            <div className="rounded-md border border-border bg-secondary p-3">
              <p className="text-sm font-medium text-muted-foreground">BDI ({fmtPerc(resultado.bdiPerc)})</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-warning-ink">{fmtCur(resultado.totalBDI)}</p>
            </div>
            <div className="rounded-md border border-primary-line bg-primary-tint p-3">
              <p className="text-sm font-medium text-muted-foreground">PREÇO TOTAL</p>
              <p className="mt-1 text-2xl font-semibold leading-8 tabular-nums text-foreground">{fmtCur(resultado.totalPreco)}</p>
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Und</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead className="text-right">Encargos</TableHead>
                  <TableHead className="text-right">BDI</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Preço Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.itens.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="tabular-nums">{idx + 1}</TableCell>
                    <TableCell>{item.descricao}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                    <TableCell>{item.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums" nowrap>{fmtCur(item.custoUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums text-info-ink" nowrap>{fmtCur(item.encargosValor)}</TableCell>
                    <TableCell className="text-right tabular-nums text-warning-ink" nowrap>{fmtCur(item.bdiValor)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums" nowrap>{fmtCur(item.precoUnitario)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums" nowrap>{fmtCur(item.precoTotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-secondary font-semibold hover:bg-secondary">
                  <TableCell colSpan={4}>TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums" nowrap>{fmtCur(resultado.totalCusto)}</TableCell>
                  <TableCell className="text-right tabular-nums text-info-ink" nowrap>{fmtCur(resultado.totalEncargos)}</TableCell>
                  <TableCell className="text-right tabular-nums text-warning-ink" nowrap>{fmtCur(resultado.totalBDI)}</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right tabular-nums text-foreground" nowrap>{fmtCur(resultado.totalPreco)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Valor por extenso */}
          <p className="text-sm text-muted-foreground">
            Valor Global: {fmtCur(resultado.totalPreco)} ({valorPorExtenso(resultado.totalPreco)})
          </p>

          {/* BDI formula explanation */}
          <div className="space-y-1 rounded-md border border-border bg-secondary p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MEMÓRIA DE CÁLCULO DO BDI</p>
            <p className="font-mono text-xs text-muted-foreground">
              BDI = [(1 + {fmtPerc(bdiCalc.ac)} + {fmtPerc(bdiCalc.sg)} + {fmtPerc(bdiCalc.risco)}) × (1 + {fmtPerc(bdiCalc.df)}) × (1 + {fmtPerc(bdiCalc.lucro)})] / (1 - {fmtPerc(bdiCalc.totalTributosPerc)}) - 1
            </p>
            <p className="text-sm font-semibold tabular-nums text-foreground">BDI = {fmtPerc(bdiCalc.bdiPercentual)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
