import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { MDOResult, MDOInputs, LineItem, SubModuloResult } from './mdo-engine';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ═══════════════ XLSX EXPORT (Estruturado) ═══════════════
export function exportMDOXLSX(result: MDOResult, inputs: MDOInputs) {
  const wb = XLSX.utils.book_new();

  // ── Helper: create styled header row ──
  const HEADER_FILL = { fgColor: { rgb: '2980B9' } };
  const HEADER_FONT = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
  const TITLE_FONT = { bold: true, sz: 12 };
  const SUBTITLE_FONT = { bold: true, sz: 10 };
  const SUBTOTAL_FILL = { fgColor: { rgb: 'EBF5FB' } };
  const TOTAL_FILL = { fgColor: { rgb: 'D4E6F1' } };
  const BOLD = { bold: true };
  const NUM_FMT = '#,##0.00';
  const PERC_FMT = '0.00%';
  const BORDER_THIN = {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  };

  // ── Aba 1: Detalhamento por Trabalhador ──
  const rows: any[][] = [];
  let rowIdx = 0;
  const merges: XLSX.Range[] = [];
  const cellStyles: Record<string, any> = {};

  const pushRow = (...cells: any[]) => {
    rows.push(cells);
    rowIdx++;
  };
  const pushBlank = () => { rows.push([]); rowIdx++; };

  // Title
  pushRow('PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS');
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
  pushRow('Lei 14.133/2021 | IN SEGES/ME nº 5/2017 (Anexo VII-D) | Acórdãos TCU');
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
  pushBlank();

  // Contract data block
  pushRow('DADOS DA CONTRATAÇÃO');
  merges.push({ s: { r: rowIdx - 1, c: 0 }, e: { r: rowIdx - 1, c: 3 } });
  pushRow('Campo', 'Valor');
  const contratoFields = [
    ['Nº Processo', inputs.contrato.nrProcesso],
    ['Nº Contratação', inputs.contrato.nrContratacao],
    ['Órgão Contratante', inputs.contrato.orgao],
    ['Descrição do Serviço', inputs.contrato.descricaoServico],
    ['Unidade de Medida', inputs.contrato.unidadeMedida],
    ['Data da Proposta', inputs.contrato.dataProposta],
    ['Município/UF', inputs.contrato.municipioUf],
    ['Convenção Coletiva', inputs.contrato.convencaoColetiva],
    ['Nº Registro CCT/MTE', inputs.contrato.nrRegistroCCT],
    ['Vigência CCT', inputs.contrato.vigenciaCCT],
    ['Vigência do Contrato (meses)', inputs.contrato.vigenciaMeses],
  ];
  contratoFields.forEach(([k, v]) => { if (v) pushRow(k, v); });
  pushBlank();

  // Cargo data
  pushRow('DADOS DO CARGO / POSTO DE TRABALHO');
  merges.push({ s: { r: rowIdx - 1, c: 0 }, e: { r: rowIdx - 1, c: 3 } });
  pushRow('Campo', 'Valor');
  pushRow('Cargo', inputs.cargo.nome);
  pushRow('Salário Base (R$)', inputs.cargo.salarioBase);
  pushRow('Quantidade de Postos', inputs.cargo.quantidadePostos);
  pushRow('Jornada', inputs.cargo.jornadaTipo === '44h' ? '44h semanais' : inputs.cargo.jornadaTipo === '12x36_diurno' ? '12x36 Diurno' : '12x36 Noturno');
  pushBlank();

  // Module rendering helper
  const addModuloSheet = (mod: { titulo: string; itens?: LineItem[]; submodulos?: Record<string, SubModuloResult>; subtotal: number }) => {
    // Module title
    pushRow(mod.titulo);
    merges.push({ s: { r: rowIdx - 1, c: 0 }, e: { r: rowIdx - 1, c: 3 } });

    // Column headers
    pushRow('ID', 'Descrição', 'Percentual (%)', 'Valor (R$)');

    if (mod.submodulos) {
      Object.values(mod.submodulos).forEach(sub => {
        // Submodule title
        pushRow(sub.titulo);
        merges.push({ s: { r: rowIdx - 1, c: 0 }, e: { r: rowIdx - 1, c: 3 } });

        // Items
        sub.itens.forEach(i => {
          pushRow(
            i.id,
            i.descricao,
            i.percentual != null && i.percentual !== 0 ? i.percentual / 100 : '',
            i.valor
          );
        });

        // Subtotal
        pushRow('', `Subtotal – ${sub.titulo.split('–')[1]?.trim() || sub.titulo}`, '', sub.subtotal);
      });
    }

    if (mod.itens) {
      mod.itens.forEach(i => {
        pushRow(
          i.id,
          i.descricao,
          i.percentual != null && i.percentual !== 0 ? i.percentual / 100 : '',
          i.valor
        );
      });
    }

    // Module total
    pushRow('', 'TOTAL', '', mod.subtotal);
    pushBlank();
  };

  addModuloSheet(result.modulo1);
  addModuloSheet(result.modulo2);
  addModuloSheet(result.modulo3);
  addModuloSheet(result.modulo4);
  addModuloSheet(result.modulo5);
  addModuloSheet(result.modulo6);

  // Quadro-Resumo
  pushRow('QUADRO-RESUMO DO CUSTO POR EMPREGADO');
  merges.push({ s: { r: rowIdx - 1, c: 0 }, e: { r: rowIdx - 1, c: 3 } });
  pushRow('Módulo', 'Descrição', '', 'Valor Mensal (R$)');
  pushRow('1', 'Composição da Remuneração', '', result.quadroResumo.modulo1);
  pushRow('2', 'Encargos e Benefícios Mensais e Diários', '', result.quadroResumo.modulo2);
  pushRow('3', 'Provisão para Rescisão', '', result.quadroResumo.modulo3);
  pushRow('4', 'Custo de Reposição do Profissional Ausente', '', result.quadroResumo.modulo4);
  pushRow('5', 'Insumos Diversos', '', result.quadroResumo.modulo5);
  pushRow('', 'SUBTOTAL (Módulos 1 a 5)', '', result.quadroResumo.subtotalMod1a5);
  pushRow('6', 'Custos Indiretos, Tributos e Lucro', '', result.quadroResumo.modulo6);
  pushBlank();
  pushRow('', 'VALOR MENSAL POR EMPREGADO', '', result.quadroResumo.valorMensalEmpregado);
  pushRow('', 'Quantidade de Profissionais (Postos)', '', result.quadroResumo.qtdProfissionais);
  pushRow('', 'VALOR MENSAL TOTAL (Todos os Postos)', '', result.quadroResumo.valorMensalTotal);
  pushRow('', 'VALOR ANUAL TOTAL', '', result.quadroResumo.valorAnualTotal);
  pushRow('', `VALOR TOTAL DO CONTRATO (${result.quadroResumo.vigenciaMeses} meses)`, '', result.quadroResumo.valorContratoTotal);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!cols'] = [{ wch: 10 }, { wch: 52 }, { wch: 16 }, { wch: 22 }];
  ws1['!merges'] = merges;

  // Apply number formatting to value column (D)
  const range = XLSX.utils.decode_range(ws1['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    const cellAddr = XLSX.utils.encode_cell({ r: R, c: 3 });
    const cell = ws1[cellAddr];
    if (cell && typeof cell.v === 'number') {
      cell.z = '#,##0.00';
    }
    // Percentage column
    const percAddr = XLSX.utils.encode_cell({ r: R, c: 2 });
    const percCell = ws1[percAddr];
    if (percCell && typeof percCell.v === 'number' && percCell.v < 1) {
      percCell.z = '0.00%';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws1, 'Custo por Trabalhador');

  // ── Aba 2: Planilha Consolidada ──
  const rows2: any[][] = [];
  const merges2: XLSX.Range[] = [];

  rows2.push(['PLANILHA DE CUSTOS E FORMAÇÃO DE PREÇOS — CONSOLIDAÇÃO']);
  merges2.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });
  rows2.push([`Cargo: ${inputs.cargo.nome}`, `Salário: ${fmtNum(inputs.cargo.salarioBase)}`, `Postos: ${inputs.cargo.quantidadePostos}`]);
  rows2.push([]);

  rows2.push(['Módulo', 'Descrição', 'Valor Mensal (R$)']);
  rows2.push(['1', 'Composição da Remuneração', result.quadroResumo.modulo1]);
  rows2.push(['2', 'Encargos e Benefícios Mensais e Diários', result.quadroResumo.modulo2]);
  rows2.push(['3', 'Provisão para Rescisão', result.quadroResumo.modulo3]);
  rows2.push(['4', 'Custo de Reposição do Profissional Ausente', result.quadroResumo.modulo4]);
  rows2.push(['5', 'Insumos Diversos', result.quadroResumo.modulo5]);
  rows2.push(['', 'SUBTOTAL (Módulos 1 a 5)', result.quadroResumo.subtotalMod1a5]);
  rows2.push(['6', 'Custos Indiretos, Tributos e Lucro', result.quadroResumo.modulo6]);
  rows2.push([]);
  rows2.push(['', 'VALOR MENSAL POR EMPREGADO', result.quadroResumo.valorMensalEmpregado]);
  rows2.push(['', 'Quantidade de Profissionais', result.quadroResumo.qtdProfissionais]);
  rows2.push(['', 'VALOR MENSAL TOTAL', result.quadroResumo.valorMensalTotal]);
  rows2.push(['', 'VALOR ANUAL TOTAL', result.quadroResumo.valorAnualTotal]);
  rows2.push([`VALOR DO CONTRATO (${result.quadroResumo.vigenciaMeses} meses)`, '', result.quadroResumo.valorContratoTotal]);

  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2['!cols'] = [{ wch: 12 }, { wch: 48 }, { wch: 24 }];
  ws2['!merges'] = merges2;

  // Format numbers
  const range2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1');
  for (let R = range2.s.r; R <= range2.e.r; R++) {
    const cellAddr = XLSX.utils.encode_cell({ r: R, c: 2 });
    const cell = ws2[cellAddr];
    if (cell && typeof cell.v === 'number') {
      cell.z = '#,##0.00';
    }
  }

  XLSX.utils.book_append_sheet(wb, ws2, 'Planilha de Custos');

  // ── Aba 3: Detalhamento de cada Módulo (formato analítico) ──
  const addDetalheSheet = (mod: { titulo: string; itens?: LineItem[]; submodulos?: Record<string, SubModuloResult>; subtotal: number }, sheetName: string) => {
    const r: any[][] = [];
    const m: XLSX.Range[] = [];

    r.push([mod.titulo]);
    m.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
    r.push([`Cargo: ${inputs.cargo.nome}`, '', 'Salário Base:', inputs.cargo.salarioBase]);
    r.push([]);
    r.push(['ID', 'Descrição', 'Percentual (%)', 'Valor (R$)']);

    if (mod.submodulos) {
      Object.values(mod.submodulos).forEach(sub => {
        r.push([sub.titulo]);
        m.push({ s: { r: r.length - 1, c: 0 }, e: { r: r.length - 1, c: 3 } });
        sub.itens.forEach(i => {
          r.push([i.id, i.descricao, i.percentual != null ? i.percentual / 100 : '', i.valor]);
        });
        r.push(['', `Subtotal`, '', sub.subtotal]);
      });
    }

    if (mod.itens) {
      mod.itens.forEach(i => {
        r.push([i.id, i.descricao, i.percentual != null ? i.percentual / 100 : '', i.valor]);
      });
    }

    r.push([]);
    r.push(['', 'TOTAL DO MÓDULO', '', mod.subtotal]);

    const ws = XLSX.utils.aoa_to_sheet(r);
    ws['!cols'] = [{ wch: 10 }, { wch: 50 }, { wch: 16 }, { wch: 20 }];
    ws['!merges'] = m;

    // Format
    const rng = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = rng.s.r; R <= rng.e.r; R++) {
      const vCell = ws[XLSX.utils.encode_cell({ r: R, c: 3 })];
      if (vCell && typeof vCell.v === 'number') vCell.z = '#,##0.00';
      const pCell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (pCell && typeof pCell.v === 'number' && pCell.v < 1) pCell.z = '0.00%';
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  addDetalheSheet(result.modulo1, 'M1 Remuneração');
  addDetalheSheet(result.modulo2, 'M2 Encargos');
  addDetalheSheet(result.modulo3, 'M3 Rescisão');
  addDetalheSheet(result.modulo4, 'M4 Reposição');
  addDetalheSheet(result.modulo5, 'M5 Insumos');
  addDetalheSheet(result.modulo6, 'M6 Custos Ind.');

  XLSX.writeFile(wb, `planilha-custos-mdo-${inputs.cargo.nome.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
}
