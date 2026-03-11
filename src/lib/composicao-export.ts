import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { writeExcelFile } from './excel-utils';

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

export type ComposicaoData = {
  itens: ItemComposicao[];
  resumo: Resumo;
  parecer: Parecer;
};

export type ExportOptions = {
  timbradoUrl?: string | null;
  empresaNome?: string | null;
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number | null) => v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—';

export function parseComposicao(iaResult: string): ComposicaoData | null {
  try {
    let jsonStr = iaResult.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    const data = JSON.parse(jsonStr);
    if (data?.itens && data?.resumo && data?.parecer) return data as ComposicaoData;
    return null;
  } catch {
    return null;
  }
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportComposicaoPDF(data: ComposicaoData, regimeLabel: string, uf: string, opts?: ExportOptions) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 12;

  if (opts?.timbradoUrl) {
    const imgData = await loadImageAsBase64(opts.timbradoUrl);
    if (imgData) {
      try {
        const imgW = pageWidth - 28;
        const imgH = 22;
        doc.addImage(imgData, 'PNG', 14, y, imgW, imgH);
        y += imgH + 4;
      } catch {
        // image failed, continue without
      }
    }
  }

  doc.setFontSize(14);
  doc.text('Planilha de Composição de Custo e Formação de Preço', pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(9);
  doc.text(`Regime: ${regimeLabel} | UF: ${uf} | Lei nº 14.133/2021`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  (data.itens || []).forEach((item, idx) => {
    doc.setFontSize(10);
    doc.text(`Item ${idx + 1}: ${item.descricao} — ${item.quantidade} ${item.unidade}`, 14, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [['Componente', 'Base de Cálculo', 'Alíquota (%)', 'Valor (R$)']],
      body: [
        ...(item.componentes || []).map(c => [
          c.componente,
          c.baseCalculo != null ? fmt(c.baseCalculo) : '—',
          fmtPct(c.aliquota),
          fmt(c.valor),
        ]),
        ['Preço Unitário Formado', '', '', fmt(item.precoUnitarioFormado)],
        [`Preço Total (${item.quantidade} ${item.unidade})`, '', '', fmt(item.precoTotal)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 15; }
  });

  doc.setFontSize(11);
  doc.text('Resumo Geral', 14, y);
  y += 5;

  const resumo = data.resumo || {} as Resumo;
  autoTable(doc, {
    startY: y,
    head: [['Componente', 'Valor (R$)']],
    body: [
      ['Custo Total Materiais/Serviços', fmt(resumo.custoTotalMateriais || 0)],
      ['Frete e Logística', fmt(resumo.freteTotal || 0)],
      ['Despesas Administrativas', fmt(resumo.despesasAdm || 0)],
      ['Total de Tributos', fmt(resumo.totalTributos || 0)],
      [`BDI (${(resumo.bdiPercentual ?? 0).toFixed(2)}%)`, fmt(resumo.bdiTotal || 0)],
      ['Margem de Lucro', fmt(resumo.margemLucro || 0)],
      ['PREÇO TOTAL FORMADO', fmt(resumo.precoTotalFormado || 0)],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if ((resumo.tributosPorImposto || []).length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Tributo', 'Alíquota', 'Valor (R$)']],
      body: (resumo.tributosPorImposto || []).map(t => [t.imposto, fmtPct(t.aliquota), fmt(t.valor)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [192, 57, 43] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const parecer = data.parecer || {} as Parecer;
  if (y > 260) { doc.addPage(); y = 15; }
  doc.setFontSize(10);
  doc.text(`Parecer: ${parecer.viabilidade || 'N/A'} | Margem Líquida: ${Number(parecer.margemLiquida || 0).toFixed(2)}%`, 14, y);
  y += 5;
  if (parecer.observacoes) {
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(parecer.observacoes, pageWidth - 28);
    doc.text(lines, 14, y);
  }

  doc.save('composicao-custo.pdf');
}

// ── Excel Export ──
export async function exportComposicaoExcel(data: ComposicaoData, regimeLabel: string, uf: string, opts?: ExportOptions) {
  const empresaHeader = opts?.empresaNome ? `Empresa: ${opts.empresaNome}` : '';

  // Sheet 1 - Itens
  const itensRows: any[][] = [
    ['Planilha de Composição de Custo', '', '', '', `Regime: ${regimeLabel} | UF: ${uf}`],
    empresaHeader ? [empresaHeader] : [],
    [],
  ];

  (data.itens || []).forEach((item, idx) => {
    itensRows.push([`Item ${idx + 1}: ${item.descricao}`, `Qtd: ${item.quantidade}`, item.unidade, '', '']);
    itensRows.push(['Componente', 'Base de Cálculo', 'Alíquota (%)', 'Valor (R$)', '']);
    (item.componentes || []).forEach(c => {
      itensRows.push([c.componente, c.baseCalculo ?? '', c.aliquota != null ? `${c.aliquota}%` : '', c.valor, '']);
    });
    itensRows.push(['Preço Unitário Formado', '', '', item.precoUnitarioFormado, '']);
    itensRows.push([`Preço Total (${item.quantidade} ${item.unidade})`, '', '', item.precoTotal, '']);
    itensRows.push([]);
  });

  // Sheet 2 - Resumo
  const resumo = data.resumo || {} as Resumo;
  const resumoRows: any[][] = [
    ['Resumo Geral'],
    ['Componente', 'Valor (R$)'],
    ['Custo Total Materiais/Serviços', resumo.custoTotalMateriais || 0],
    ['Frete e Logística', resumo.freteTotal || 0],
    ['Despesas Administrativas', resumo.despesasAdm || 0],
    ['Total de Tributos', resumo.totalTributos || 0],
    [`BDI (${(resumo.bdiPercentual ?? 0).toFixed(2)}%)`, resumo.bdiTotal || 0],
    ['Margem de Lucro', resumo.margemLucro || 0],
    ['PREÇO TOTAL FORMADO', resumo.precoTotalFormado || 0],
    [],
    ['Tributos Detalhados'],
    ['Tributo', 'Alíquota (%)', 'Valor (R$)'],
    ...(resumo.tributosPorImposto || []).map(t => [t.imposto, t.aliquota, t.valor]),
  ];

  // Sheet 3 - Parecer
  const parecer = data.parecer || {} as Parecer;
  const parecerRows: any[][] = [
    ['Parecer de Viabilidade'],
    ['Viabilidade', parecer.viabilidade || 'N/A'],
    ['Margem Líquida', `${Number(parecer.margemLiquida || 0).toFixed(2)}%`],
    ['Alerta Inexequibilidade', parecer.alertaInexequibilidade ? 'SIM' : 'NÃO'],
    ['Observações', parecer.observacoes || ''],
  ];

  await writeExcelFile('composicao-custo.xlsx', [
    { name: 'Composição', data: itensRows, colWidths: [40, 18, 14, 18, 30] },
    { name: 'Resumo', data: resumoRows, colWidths: [35, 18, 18] },
    { name: 'Parecer', data: parecerRows, colWidths: [25, 60] },
  ]);
}

// ── Word (HTML-based) Export ──
export function exportComposicaoWord(data: ComposicaoData, regimeLabel: string, uf: string, opts?: ExportOptions) {
  const resumo = data.resumo || {} as Resumo;
  const parecer = data.parecer || {} as Parecer;

  const timbradoHtml = opts?.timbradoUrl
    ? `<div style="text-align:center;margin-bottom:12px"><img src="${opts.timbradoUrl}" style="max-width:100%;max-height:100px" /></div>`
    : '';

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><style>
body{font-family:Arial;font-size:11pt;margin:30mm 20mm 20mm 30mm}
table{border-collapse:collapse;width:100%;margin:8px 0}
th,td{border:1px solid #999;padding:4px 8px;font-size:10pt}
th{background:#2980b9;color:#fff;text-align:left}
.total{background:#eaf6ff;font-weight:bold}
h1{font-size:14pt;text-align:center}
h2{font-size:12pt;margin-top:16px}
.parecer{background:#f0f0f0;padding:8px;border-radius:4px;margin-top:12px}
</style></head><body>
${timbradoHtml}
<h1>Planilha de Composição de Custo e Formação de Preço</h1>
<p style="text-align:center;font-size:9pt">Regime: ${regimeLabel} | UF: ${uf} | Lei nº 14.133/2021</p>`;

  (data.itens || []).forEach((item, idx) => {
    html += `<h2>Item ${idx + 1}: ${item.descricao} — ${item.quantidade} ${item.unidade}</h2>
<table><tr><th>Componente</th><th>Base de Cálculo</th><th>Alíquota (%)</th><th>Valor (R$)</th></tr>`;
    (item.componentes || []).forEach(c => {
      html += `<tr><td>${c.componente}</td><td>${c.baseCalculo != null ? fmt(c.baseCalculo) : '—'}</td><td>${fmtPct(c.aliquota)}</td><td>${fmt(c.valor)}</td></tr>`;
    });
    html += `<tr class="total"><td colspan="3">Preço Unitário Formado</td><td>${fmt(item.precoUnitarioFormado)}</td></tr>`;
    html += `<tr class="total"><td colspan="3">Preço Total (${item.quantidade} ${item.unidade})</td><td>${fmt(item.precoTotal)}</td></tr></table>`;
  });

  html += `<h2>Resumo Geral</h2><table>
<tr><th>Componente</th><th>Valor (R$)</th></tr>
<tr><td>Custo Total Materiais/Serviços</td><td>${fmt(resumo.custoTotalMateriais || 0)}</td></tr>
<tr><td>Frete e Logística</td><td>${fmt(resumo.freteTotal || 0)}</td></tr>
<tr><td>Despesas Administrativas</td><td>${fmt(resumo.despesasAdm || 0)}</td></tr>
<tr><td>Total de Tributos</td><td>${fmt(resumo.totalTributos || 0)}</td></tr>
<tr><td>BDI (${(resumo.bdiPercentual ?? 0).toFixed(2)}%)</td><td>${fmt(resumo.bdiTotal || 0)}</td></tr>
<tr><td>Margem de Lucro</td><td>${fmt(resumo.margemLucro || 0)}</td></tr>
<tr class="total"><td>PREÇO TOTAL FORMADO</td><td>${fmt(resumo.precoTotalFormado || 0)}</td></tr>
</table>`;

  if ((resumo.tributosPorImposto || []).length > 0) {
    html += `<h2>Tributos Detalhados</h2><table><tr><th>Tributo</th><th>Alíquota</th><th>Valor (R$)</th></tr>`;
    (resumo.tributosPorImposto || []).forEach(t => {
      html += `<tr><td>${t.imposto}</td><td>${fmtPct(t.aliquota)}</td><td>${fmt(t.valor)}</td></tr>`;
    });
    html += `</table>`;
  }

  html += `<div class="parecer"><strong>Parecer: ${parecer.viabilidade || 'N/A'}</strong> | Margem Líquida: ${Number(parecer.margemLiquida || 0).toFixed(2)}%<br/>${parecer.observacoes || ''}</div>`;
  html += `</body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composicao-custo.doc';
  a.click();
  URL.revokeObjectURL(url);
}
