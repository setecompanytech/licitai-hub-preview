import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { MDOResult, MDOInputs, LineItem, SubModuloResult } from './mdo-engine';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPerc = (v?: number) => v != null && v !== 0 ? `${v.toFixed(2)}%` : '';

function lineRows(items: LineItem[]): string[][] {
  return items.map(i => [i.id, i.descricao, fmtPerc(i.percentual), fmt(i.valor)]);
}

function subRows(sub: SubModuloResult): string[][] {
  const rows = lineRows(sub.itens);
  rows.push(['', `Subtotal – ${sub.titulo.split('–')[1]?.trim() || ''}`, '', fmt(sub.subtotal)]);
  return rows;
}

// ═══════════════ PDF EXPORT ═══════════════
export function exportMDOPDF(result: MDOResult, inputs: MDOInputs) {
  const doc = new jsPDF({ orientation: 'portrait' });
  const w = doc.internal.pageSize.getWidth();
  let y = 14;

  // Title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS', w / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Lei nº 14.133/2021 • IN SEGES/ME nº 5/2017 (Anexo VII-D) • Acórdãos TCU 1.753/2008 e 786/2006', w / 2, y, { align: 'center' });
  y += 6;

  // Contract data
  const contrato = inputs.contrato;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA CONTRATAÇÃO', 14, y); y += 4;
  doc.setFont('helvetica', 'normal');
  const dados = [
    ['Nº Processo', contrato.nrProcesso], ['Nº Contratação', contrato.nrContratacao],
    ['Órgão', contrato.orgao], ['Serviço', contrato.descricaoServico],
    ['CCT', contrato.convencaoColetiva], ['Vigência', `${contrato.vigenciaMeses} meses`],
  ].filter(([, v]) => v);
  dados.forEach(([k, v]) => { doc.text(`${k}: ${v}`, 14, y); y += 3.5; });
  y += 2;

  // Cargo
  doc.setFont('helvetica', 'bold');
  doc.text(`CARGO: ${inputs.cargo.nome} | Salário Base: ${fmt(inputs.cargo.salarioBase)} | Postos: ${inputs.cargo.quantidadePostos}`, 14, y);
  y += 6;

  const addModuloTable = (title: string, head: string[][], body: string[][], subtotalLabel: string, subtotalVal: number) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, y); y += 1;
    autoTable(doc, {
      head, body: [...body, [{ content: subtotalLabel, colSpan: 3, styles: { fontStyle: 'bold' } }, { content: fmt(subtotalVal), styles: { fontStyle: 'bold', halign: 'right' } }]],
      startY: y, styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 12 }, 3: { halign: 'right', cellWidth: 28 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  };

  const headers = [['ID', 'Descrição', '%', 'Valor (R$)']];

  // M1
  addModuloTable(result.modulo1.titulo, headers, lineRows(result.modulo1.itens!), 'TOTAL MÓDULO 1', result.modulo1.subtotal);

  // M2
  const m2body: string[][] = [];
  if (result.modulo2.submodulos) {
    Object.values(result.modulo2.submodulos).forEach(sub => { m2body.push(...subRows(sub)); });
  }
  addModuloTable(result.modulo2.titulo, headers, m2body, 'TOTAL MÓDULO 2', result.modulo2.subtotal);

  // M3
  addModuloTable(result.modulo3.titulo, headers, lineRows(result.modulo3.itens!), 'TOTAL MÓDULO 3', result.modulo3.subtotal);

  // Check page
  if (y > 240) { doc.addPage(); y = 14; }

  // M4
  const m4body: string[][] = [];
  if (result.modulo4.submodulos) {
    Object.values(result.modulo4.submodulos).forEach(sub => { m4body.push(...subRows(sub)); });
  }
  if (result.modulo4.itens) m4body.push(...lineRows(result.modulo4.itens));
  addModuloTable(result.modulo4.titulo, headers, m4body, 'TOTAL MÓDULO 4', result.modulo4.subtotal);

  // M5
  addModuloTable(result.modulo5.titulo, headers, lineRows(result.modulo5.itens!), 'TOTAL MÓDULO 5', result.modulo5.subtotal);

  if (y > 220) { doc.addPage(); y = 14; }

  // M6
  const m6body: string[][] = [];
  if (result.modulo6.submodulos) {
    Object.values(result.modulo6.submodulos).forEach(sub => { m6body.push(...subRows(sub)); });
  }
  addModuloTable(result.modulo6.titulo, headers, m6body, 'TOTAL MÓDULO 6', result.modulo6.subtotal);

  // Quadro Resumo
  if (y > 220) { doc.addPage(); y = 14; }
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('QUADRO-RESUMO DO CUSTO POR EMPREGADO', 14, y); y += 1;
  const qr = result.quadroResumo;
  autoTable(doc, {
    head: [['Módulo', 'Valor (R$)']],
    body: [
      ['Módulo 1 – Remuneração', fmt(qr.modulo1)],
      ['Módulo 2 – Encargos e Benefícios', fmt(qr.modulo2)],
      ['Módulo 3 – Provisão para Rescisão', fmt(qr.modulo3)],
      ['Módulo 4 – Custo de Reposição', fmt(qr.modulo4)],
      ['Módulo 5 – Insumos', fmt(qr.modulo5)],
      [{ content: 'Subtotal (Módulos 1 a 5)', styles: { fontStyle: 'bold' } }, { content: fmt(qr.subtotalMod1a5), styles: { fontStyle: 'bold' } }],
      ['Módulo 6 – Custos Indiretos, Tributos e Lucro', fmt(qr.modulo6)],
      [{ content: 'VALOR MENSAL POR EMPREGADO', styles: { fontStyle: 'bold', fillColor: [230, 245, 255] } }, { content: fmt(qr.valorMensalEmpregado), styles: { fontStyle: 'bold', fillColor: [230, 245, 255] } }],
      [`Qtd. Profissionais: ${qr.qtdProfissionais}`, fmt(qr.valorMensalTotal)],
      [`Valor Contrato (${qr.vigenciaMeses} meses)`, fmt(qr.valorContratoTotal)],
    ],
    startY: y, styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: { 1: { halign: 'right', cellWidth: 35 } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Footer
  doc.setFontSize(6); doc.setTextColor(120);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | LicitIA — Sistema de Precificação para Licitações`, 14, y);

  doc.save(`planilha-custos-mdo-${inputs.cargo.nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ═══════════════ XLSX EXPORT ═══════════════
export function exportMDOXLSX(result: MDOResult, inputs: MDOInputs) {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Custo por Trabalhador ──
  const rows: (string | number)[][] = [];
  const push = (...args: (string | number)[]) => rows.push(args);
  const blank = () => rows.push([]);

  push('PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS');
  push('Lei 14.133/2021 | IN SEGES/ME nº 5/2017 | TCU');
  blank();
  push('DADOS DA CONTRATAÇÃO');
  push('Nº Processo', inputs.contrato.nrProcesso);
  push('Nº Contratação', inputs.contrato.nrContratacao);
  push('Órgão', inputs.contrato.orgao);
  push('Serviço', inputs.contrato.descricaoServico);
  push('CCT', inputs.contrato.convencaoColetiva);
  push('Vigência (meses)', inputs.contrato.vigenciaMeses);
  blank();
  push('CARGO', inputs.cargo.nome);
  push('Salário Base', inputs.cargo.salarioBase);
  push('Quantidade de Postos', inputs.cargo.quantidadePostos);
  push('Jornada', inputs.cargo.jornadaTipo);
  blank();

  const addModulo = (mod: { titulo: string; itens?: LineItem[]; submodulos?: Record<string, SubModuloResult>; subtotal: number }) => {
    push(mod.titulo);
    push('ID', 'Descrição', '%', 'Valor (R$)');
    if (mod.submodulos) {
      Object.values(mod.submodulos).forEach(sub => {
        push(sub.titulo);
        sub.itens.forEach(i => push(i.id, i.descricao, i.percentual ?? '', i.valor));
        push('', `Subtotal`, '', sub.subtotal);
      });
    }
    if (mod.itens) {
      mod.itens.forEach(i => push(i.id, i.descricao, i.percentual ?? '', i.valor));
    }
    push('', 'TOTAL', '', mod.subtotal);
    blank();
  };

  addModulo(result.modulo1);
  addModulo(result.modulo2);
  addModulo(result.modulo3);
  addModulo(result.modulo4);
  addModulo(result.modulo5);
  addModulo(result.modulo6);

  // Quadro Resumo
  push('QUADRO-RESUMO');
  push('Módulo 1', result.quadroResumo.modulo1);
  push('Módulo 2', result.quadroResumo.modulo2);
  push('Módulo 3', result.quadroResumo.modulo3);
  push('Módulo 4', result.quadroResumo.modulo4);
  push('Módulo 5', result.quadroResumo.modulo5);
  push('Subtotal 1-5', result.quadroResumo.subtotalMod1a5);
  push('Módulo 6', result.quadroResumo.modulo6);
  push('VALOR MENSAL/EMPREGADO', result.quadroResumo.valorMensalEmpregado);
  push('Qtd Profissionais', result.quadroResumo.qtdProfissionais);
  push('VALOR MENSAL TOTAL', result.quadroResumo.valorMensalTotal);
  push(`VALOR CONTRATO (${result.quadroResumo.vigenciaMeses}m)`, result.quadroResumo.valorContratoTotal);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!cols'] = [{ wch: 8 }, { wch: 50 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Custo por Trabalhador');

  // ── Aba 2: Planilha de Custos (Consolidação) ──
  const rows2: (string | number)[][] = [];
  rows2.push(['PLANILHA DE CUSTOS - CONSOLIDAÇÃO']);
  rows2.push([]);
  rows2.push(['Módulo', 'Descrição', 'Valor Mensal (R$)']);
  rows2.push(['1', 'Composição da Remuneração', result.quadroResumo.modulo1]);
  rows2.push(['2', 'Encargos e Benefícios', result.quadroResumo.modulo2]);
  rows2.push(['3', 'Provisão para Rescisão', result.quadroResumo.modulo3]);
  rows2.push(['4', 'Custo de Reposição', result.quadroResumo.modulo4]);
  rows2.push(['5', 'Insumos Diversos', result.quadroResumo.modulo5]);
  rows2.push(['', 'SUBTOTAL (1 a 5)', result.quadroResumo.subtotalMod1a5]);
  rows2.push(['6', 'Custos Indiretos, Tributos e Lucro', result.quadroResumo.modulo6]);
  rows2.push(['', 'VALOR MENSAL POR EMPREGADO', result.quadroResumo.valorMensalEmpregado]);
  rows2.push([]);
  rows2.push(['Qtd. Postos', result.quadroResumo.qtdProfissionais]);
  rows2.push(['Valor Mensal Total', '', result.quadroResumo.valorMensalTotal]);
  rows2.push(['Valor Anual Total', '', result.quadroResumo.valorAnualTotal]);
  rows2.push([`Valor Contrato (${result.quadroResumo.vigenciaMeses}m)`, '', result.quadroResumo.valorContratoTotal]);

  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2['!cols'] = [{ wch: 10 }, { wch: 45 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Planilha de Custos');

  XLSX.writeFile(wb, `planilha-custos-mdo-${inputs.cargo.nome.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
}
