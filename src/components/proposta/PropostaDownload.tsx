import { Button } from '@/components/ui/button';
import { Download, FileText, Sheet, File } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EditalItem {
  item: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  marca: string;
  fabricante?: string;
  modelo: string;
  valorUnitario: string;
  valorUnitarioExtenso: string;
  valorTotal: string;
  valorTotalExtenso: string;
}

export interface PropostaDownloadProps {
  proposal: string;
  numeroLicitacao: string;
  timbradoUrl?: string | null;
  empresaData?: {
    razao_social?: string;
    cnpj?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
    nome_fantasia?: string;
    inscricao_estadual?: string;
    inscricao_municipal?: string;
  } | null;
  repData?: {
    nome?: string;
    cpf?: string;
    rg?: string;
    orgaoExp?: string;
    cargo?: string;
    naturalidade?: string;
    nacionalidade?: string;
  };
  bancData?: {
    banco?: string;
    agencia?: string;
    conta?: string;
  };
  itens?: EditalItem[];
  licitacaoData?: {
    orgao?: string;
    modalidade?: string;
    objeto?: string;
    valorEstimado?: string;
    prazoValidade?: string;
    localEntrega?: string;
    liquidacaoNfe?: string;
  };
  telefone?: string;
  email?: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getFilename(numero: string) {
  const base = numero?.trim() ? `Proposta_${numero.replace(/[\s/\\]/g, '_')}` : 'Proposta_Tecnica';
  return base;
}

/** Parse AI markdown into sections for PDF */
function parseSections(text: string) {
  const sections: { title: string; lines: string[] }[] = [];
  const parts = text.split(/^(#{1,3}\s+.+)$/gm);
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const part of parts) {
    const headerMatch = part.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      if (currentTitle || currentLines.length > 0) {
        sections.push({ title: currentTitle, lines: currentLines });
      }
      currentTitle = headerMatch[1].trim().replace(/\*\*/g, '');
      currentLines = [];
    } else {
      const lines = part.split('\n').map(l => l.trim()).filter(l => l && !l.match(/^\|[-\s|:]+\|$/));
      currentLines.push(...lines);
    }
  }
  if (currentTitle || currentLines.length > 0) {
    sections.push({ title: currentTitle, lines: currentLines });
  }
  return sections;
}

function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const tableLines = lines.filter(l => l.startsWith('|'));
  if (tableLines.length < 2) return null;
  const parseRow = (line: string) => line.split('|').slice(1, -1).map(c => c.trim().replace(/\*\*/g, ''));
  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(1).filter(l => !l.match(/^\|[-\s|:]+\|$/)).map(parseRow);
  return { headers, rows };
}

export default function PropostaDownload({
  proposal, numeroLicitacao, timbradoUrl,
  empresaData, repData, bancData, itens, licitacaoData, telefone, email
}: PropostaDownloadProps) {

  const handlePDF = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    try {
      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const mL = 30, mR = 20, mT = 30, mB = 20;
      const maxW = pageWidth - mL - mR;
      const lh = 6.35;
      let y = mT;

      const checkPage = (needed: number = lh * 2) => {
        if (y + needed > pageHeight - mB) {
          doc.addPage();
          y = mT;
        }
      };

      const addTitle = (text: string) => {
        checkPage(lh * 3);
        y += lh;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(text.toUpperCase(), mL, y);
        y += 2;
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.5);
        doc.line(mL, y, mL + maxW, y);
        y += lh;
      };

      const addLine = (text: string, bold = false, indent = 0) => {
        checkPage();
        doc.setFont('times', bold ? 'bold' : 'normal');
        doc.setFontSize(12);
        doc.setTextColor(0);
        const wrapped = doc.splitTextToSize(text, maxW - indent);
        for (const wl of wrapped) {
          checkPage();
          doc.text(wl, mL + indent, y);
          y += lh;
        }
      };

      const addKeyValue = (key: string, value: string) => {
        if (!value) return;
        checkPage();
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(`${key}: `, mL, y);
        const keyW = doc.getTextWidth(`${key}: `);
        doc.setFont('times', 'normal');
        const valLines = doc.splitTextToSize(value, maxW - keyW);
        doc.text(valLines[0], mL + keyW, y);
        y += lh;
        for (let i = 1; i < valLines.length; i++) {
          checkPage();
          doc.text(valLines[i], mL + keyW, y);
          y += lh;
        }
      };

      // ========== HEADER ==========
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('PROPOSTA COMERCIAL / TÉCNICA', pageWidth / 2, y, { align: 'center' });
      y += lh * 2;
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += lh * 2;

      // ========== DADOS DA EMPRESA ==========
      if (empresaData?.razao_social) {
        addTitle('Dados para Contratação');
        addKeyValue('Razão Social', empresaData.razao_social || '');
        if (empresaData.nome_fantasia) addKeyValue('Nome Fantasia', empresaData.nome_fantasia);
        addKeyValue('CNPJ', empresaData.cnpj || '');
        if (empresaData.inscricao_estadual) addKeyValue('Inscrição Estadual', empresaData.inscricao_estadual);
        if (empresaData.inscricao_municipal) addKeyValue('Inscrição Municipal', empresaData.inscricao_municipal);
        if (empresaData.endereco) addKeyValue('Endereço', empresaData.endereco);
        if (empresaData.municipio || empresaData.uf) addKeyValue('Cidade/UF', `${empresaData.municipio || ''}/${empresaData.uf || ''}`);
        if (telefone) addKeyValue('Telefone', telefone);
        if (email) addKeyValue('E-mail', email);
        y += lh;
      }

      // ========== REPRESENTANTE LEGAL ==========
      if (repData?.nome) {
        addTitle('Representante Legal');
        addKeyValue('Nome', repData.nome || '');
        if (repData.cpf) addKeyValue('CPF', repData.cpf);
        if (repData.rg) addKeyValue('RG', `${repData.rg}${repData.orgaoExp ? ` — ${repData.orgaoExp}` : ''}`);
        if (repData.cargo) addKeyValue('Cargo/Função', repData.cargo);
        if (repData.naturalidade) addKeyValue('Naturalidade', repData.naturalidade);
        if (repData.nacionalidade) addKeyValue('Nacionalidade', repData.nacionalidade);
        y += lh;
      }

      // ========== DADOS BANCÁRIOS ==========
      if (bancData?.banco) {
        addTitle('Dados Bancários');
        addKeyValue('Banco', bancData.banco || '');
        if (bancData.agencia) addKeyValue('Agência', bancData.agencia);
        if (bancData.conta) addKeyValue('Conta Corrente', bancData.conta);
        y += lh;
      }

      // ========== DADOS DA LICITAÇÃO ==========
      if (licitacaoData?.orgao || numeroLicitacao) {
        addTitle('Dados da Licitação');
        if (numeroLicitacao) addKeyValue('Número', numeroLicitacao);
        if (licitacaoData?.orgao) addKeyValue('Órgão', licitacaoData.orgao);
        if (licitacaoData?.modalidade) addKeyValue('Modalidade', licitacaoData.modalidade);
        if (licitacaoData?.objeto) addKeyValue('Objeto', licitacaoData.objeto);
        if (licitacaoData?.valorEstimado) addKeyValue('Valor Estimado', `R$ ${licitacaoData.valorEstimado}`);
        if (licitacaoData?.prazoValidade) addKeyValue('Prazo de Validade', licitacaoData.prazoValidade);
        if (licitacaoData?.localEntrega) addKeyValue('Local de Entrega', licitacaoData.localEntrega);
        if (licitacaoData?.liquidacaoNfe) addKeyValue('Liquidação NFe', licitacaoData.liquidacaoNfe);
        y += lh;
      }

      // ========== PLANILHA DE PREÇOS ==========
      const validItens = itens?.filter(i => i.descricao.trim()) || [];
      if (validItens.length > 0) {
        addTitle('Planilha de Preços');
        
        const tableHead = [['Item', 'Qtd', 'Unid', 'Descrição', 'Marca', 'Modelo', 'Vl. Unit.', 'Vl. Unit. Extenso', 'Vl. Total', 'Vl. Total Extenso']];
        const tableBody = validItens.map(i => [
          i.item, i.quantidade, i.unidade, i.descricao,
          i.marca || '-', i.modelo || '-',
          `R$ ${i.valorUnitario}`, i.valorUnitarioExtenso || '-',
          `R$ ${i.valorTotal}`, i.valorTotalExtenso || '-',
        ]);

        autoTable(doc, {
          startY: y,
          head: tableHead,
          body: tableBody,
          margin: { left: mL, right: mR },
          styles: { font: 'times', fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            3: { halign: 'left', cellWidth: 'auto' },
            7: { halign: 'left', fontSize: 7 },
            9: { halign: 'left', fontSize: 7 },
          },
          didDrawPage: () => { y = mT; },
        });

        y = (doc as any).lastAutoTable?.finalY + lh || y + lh * 4;

        const total = validItens.reduce((s, i) => s + (parseFloat(i.valorTotal.replace(/\./g, '').replace(',', '.')) || 0), 0);
        if (total > 0) {
          checkPage(lh * 2);
          doc.setFont('times', 'bold');
          doc.setFontSize(12);
          doc.text(`Valor Global: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, mL, y);
          y += lh * 2;
        }
      }

      // ========== CONTEÚDO IA (declarações e demais seções) ==========
      const sections = parseSections(proposal);
      const skipTitles = ['planilha', 'preço', 'contratação', 'empresa', 'representante', 'bancário', 'banco', 'licitação'];

      for (const section of sections) {
        const tLower = section.title.toLowerCase();
        // Skip sections we already rendered from real data
        if (skipTitles.some(s => tLower.includes(s))) continue;

        if (section.title) {
          addTitle(section.title);
        }

        // Check for tables in lines
        const tableLines = section.lines.filter(l => l.startsWith('|'));
        const textLines = section.lines.filter(l => !l.startsWith('|'));

        if (tableLines.length >= 2) {
          const table = parseMarkdownTable(tableLines);
          if (table) {
            autoTable(doc, {
              startY: y,
              head: [table.headers],
              body: table.rows,
              margin: { left: mL, right: mR },
              styles: { font: 'times', fontSize: 9, cellPadding: 2 },
              headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [245, 245, 245] },
            });
            y = (doc as any).lastAutoTable?.finalY + lh || y + lh * 4;
          }
        }

        for (const line of textLines) {
          const clean = line.replace(/\*\*/g, '').replace(/^[-•]\s*/, '').trim();
          if (!clean) continue;
          const isBold = line.includes('**') || /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÇ\s]{10,}$/.test(clean);
          const isBullet = line.startsWith('- ') || line.startsWith('• ');
          addLine(isBullet ? `  • ${clean}` : clean, isBold);
        }
      }

      // ========== ASSINATURA ==========
      checkPage(lh * 8);
      y += lh * 2;
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      const sigX = pageWidth / 2 - 40;
      doc.line(sigX, y, sigX + 80, y);
      y += lh;

      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.text(empresaData?.razao_social || '', pageWidth / 2, y, { align: 'center' });
      y += lh * 0.8;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(`CNPJ: ${empresaData?.cnpj || ''}`, pageWidth / 2, y, { align: 'center' });
      y += lh;
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.text(repData?.nome || '', pageWidth / 2, y, { align: 'center' });
      y += lh * 0.8;
      doc.setFontSize(10);
      doc.text(`CPF: ${repData?.cpf || ''} — ${repData?.cargo || ''}`, pageWidth / 2, y, { align: 'center' });
      y += lh * 2;

      // Local e data
      const cidade = empresaData?.municipio || '';
      const uf = empresaData?.uf || '';
      const dataHoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      doc.text(`${cidade}${uf ? `/${uf}` : ''}, ${dataHoje}.`, pageWidth / 2, y, { align: 'center' });

      doc.save(`${getFilename(numeroLicitacao)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      console.error('PDF error:', e);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleWord = (landscape = false) => {
    try {
      const emp = empresaData;
      const rep = repData;
      const banc = bancData;
      const lic = licitacaoData;
      const validItens = itens?.filter(i => i.descricao.trim()) || [];

      const kvRow = (k: string, v: string) => v ? `<tr><td style="font-weight:bold;padding:4pt 8pt;border:1px solid #ccc;width:35%">${k}</td><td style="padding:4pt 8pt;border:1px solid #ccc">${v}</td></tr>` : '';

      let empresaTable = '';
      if (emp?.razao_social) {
        empresaTable = `<h2>DADOS PARA CONTRATAÇÃO</h2><table style="width:100%;border-collapse:collapse;margin-bottom:12pt">${kvRow('Razão Social', emp.razao_social || '')}${kvRow('Nome Fantasia', emp.nome_fantasia || '')}${kvRow('CNPJ', emp.cnpj || '')}${kvRow('Inscrição Estadual', emp.inscricao_estadual || '')}${kvRow('Endereço', emp.endereco || '')}${kvRow('Cidade/UF', `${emp.municipio || ''}/${emp.uf || ''}`)}${kvRow('Telefone', telefone || '')}${kvRow('E-mail', email || '')}</table>`;
      }

      let repTable = '';
      if (rep?.nome) {
        repTable = `<h2>REPRESENTANTE LEGAL</h2><table style="width:100%;border-collapse:collapse;margin-bottom:12pt">${kvRow('Nome', rep.nome || '')}${kvRow('CPF', rep.cpf || '')}${kvRow('RG', `${rep.rg || ''}${rep.orgaoExp ? ` — ${rep.orgaoExp}` : ''}`)}${kvRow('Cargo', rep.cargo || '')}${kvRow('Naturalidade', rep.naturalidade || '')}${kvRow('Nacionalidade', rep.nacionalidade || '')}</table>`;
      }

      let bancTable = '';
      if (banc?.banco) {
        bancTable = `<h2>DADOS BANCÁRIOS</h2><table style="width:100%;border-collapse:collapse;margin-bottom:12pt">${kvRow('Banco', banc.banco || '')}${kvRow('Agência', banc.agencia || '')}${kvRow('Conta Corrente', banc.conta || '')}</table>`;
      }

      let licTable = '';
      if (lic?.orgao || numeroLicitacao) {
        licTable = `<h2>DADOS DA LICITAÇÃO</h2><table style="width:100%;border-collapse:collapse;margin-bottom:12pt">${kvRow('Número', numeroLicitacao)}${kvRow('Órgão', lic?.orgao || '')}${kvRow('Modalidade', lic?.modalidade || '')}${kvRow('Objeto', lic?.objeto || '')}${kvRow('Valor Estimado', lic?.valorEstimado ? `R$ ${lic.valorEstimado}` : '')}${kvRow('Prazo de Validade', lic?.prazoValidade || '')}${kvRow('Local de Entrega', lic?.localEntrega || '')}${kvRow('Liquidação NFe', lic?.liquidacaoNfe || '')}</table>`;
      }

      let planilhaHtml = '';
      if (validItens.length > 0) {
        const headers = ['Item', 'Qtd', 'Unid', 'Descrição', 'Marca', 'Modelo', 'Vl. Unit.', 'Vl. Unit. Extenso', 'Vl. Total', 'Vl. Total Extenso'];
        const thCells = headers.map(h => `<th style="background:#404040;color:white;padding:4pt 6pt;border:1px solid #ccc;font-size:9pt">${h}</th>`).join('');
        const rows = validItens.map((it, i) => {
          const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
          return `<tr style="background:${bg}"><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">${it.item}</td><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">${it.quantidade}</td><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">${it.unidade}</td><td style="border:1px solid #ccc;padding:3pt;font-size:9pt">${it.descricao}</td><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">${it.marca || '-'}</td><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">${it.modelo || '-'}</td><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">R$ ${it.valorUnitario}</td><td style="border:1px solid #ccc;padding:3pt;font-size:8pt">${it.valorUnitarioExtenso || '-'}</td><td style="border:1px solid #ccc;padding:3pt;text-align:center;font-size:9pt">R$ ${it.valorTotal}</td><td style="border:1px solid #ccc;padding:3pt;font-size:8pt">${it.valorTotalExtenso || '-'}</td></tr>`;
        }).join('');
        const total = validItens.reduce((s, i) => s + (parseFloat(i.valorTotal.replace(/\./g, '').replace(',', '.')) || 0), 0);
        planilhaHtml = `<h2>PLANILHA DE PREÇOS</h2><table style="width:100%;border-collapse:collapse;margin-bottom:6pt"><tr>${thCells}</tr>${rows}</table><p style="font-weight:bold;margin-top:6pt">Valor Global: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>`;
      }

      // AI content (skip already rendered sections)
      const sections = parseSections(proposal);
      const skipTitles = ['planilha', 'preço', 'contratação', 'empresa', 'representante', 'bancário', 'banco', 'licitação'];
      let aiContent = '';
      for (const section of sections) {
        const tLower = section.title.toLowerCase();
        if (skipTitles.some(s => tLower.includes(s))) continue;
        if (section.title) aiContent += `<h2>${section.title.toUpperCase()}</h2>`;
        for (const line of section.lines) {
          const trimmed = line.replace(/\*\*/g, '').trim();
          if (!trimmed) continue;
          if (line.startsWith('|')) continue; // skip table lines in AI for now
          if (line.startsWith('- ') || line.startsWith('• ')) {
            aiContent += `<p style="margin-left:12pt">• ${trimmed.replace(/^[-•]\s*/, '')}</p>`;
          } else {
            aiContent += `<p>${trimmed}</p>`;
          }
        }
      }

      // Signature
      const dataHoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      const signature = `
        <div style="text-align:center;margin-top:36pt">
          <div style="width:200pt;border-bottom:2px solid #333;margin:0 auto 6pt auto"></div>
          <p style="font-weight:bold">${emp?.razao_social || ''}</p>
          <p style="font-size:10pt;color:#666">CNPJ: ${emp?.cnpj || ''}</p>
          <p>${rep?.nome || ''}</p>
          <p style="font-size:10pt;color:#666">CPF: ${rep?.cpf || ''} — ${rep?.cargo || ''}</p>
          <p style="margin-top:12pt">${emp?.municipio || ''}${emp?.uf ? `/${emp.uf}` : ''}, ${dataHoje}.</p>
        </div>
      `;

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        <style>
          @page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 30mm 20mm 20mm 30mm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; margin: 30mm 20mm 20mm 30mm; }
          h1 { font-size: 14pt; text-align: center; margin-bottom: 18pt; font-weight: bold; }
          h2 { font-size: 12pt; margin-top: 18pt; margin-bottom: 6pt; font-weight: bold; border-bottom: 1px solid #999; padding-bottom: 3pt; }
          p { margin: 0 0 3pt 0; text-align: justify; }
          table { page-break-inside: avoid; }
        </style></head>
        <body>
          <h1>PROPOSTA COMERCIAL / TÉCNICA</h1>
          <p style="text-align:center;font-size:9pt;color:#666;margin-bottom:18pt">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          ${empresaTable}${repTable}${bancTable}${licTable}${planilhaHtml}${aiContent}${signature}
        </body></html>
      `;

      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
      triggerDownload(blob, `${getFilename(numeroLicitacao)}.doc`);
      toast.success('Documento Word gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar Word');
    }
  };

  const handleExcel = () => {
    try {
      const validItens = itens?.filter(i => i.descricao.trim()) || [];
      if (validItens.length > 0) {
        const data = validItens.map(i => ({
          'Item': i.item,
          'Qtd': i.quantidade,
          'Unidade': i.unidade,
          'Descrição': i.descricao,
          'Marca': i.marca || '-',
          'Modelo': i.modelo || '-',
          'Vl. Unitário': `R$ ${i.valorUnitario}`,
          'Vl. Unit. Extenso': i.valorUnitarioExtenso || '-',
          'Vl. Total': `R$ ${i.valorTotal}`,
          'Vl. Total Extenso': i.valorTotalExtenso || '-',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Planilha de Preços');
        XLSX.writeFile(wb, `${getFilename(numeroLicitacao)}.xlsx`);
      } else {
        // Fallback: export raw proposal
        const lines = proposal.split('\n').filter(l => l.trim());
        const data = lines.map((line, idx) => ({ 'Linha': idx + 1, 'Conteúdo': line.trim() }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 8 }, { wch: 120 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Proposta');
        XLSX.writeFile(wb, `${getFilename(numeroLicitacao)}.xlsx`);
      }
      toast.success('Excel gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar Excel');
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={() => handlePDF('portrait')}>
        <FileText className="w-4 h-4 mr-1 text-destructive" />
        PDF Retrato
      </Button>
      <Button variant="outline" size="sm" onClick={() => handlePDF('landscape')}>
        <FileText className="w-4 h-4 mr-1 text-destructive" />
        PDF Paisagem
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleWord(false)}>
        <File className="w-4 h-4 mr-1 text-blue-500" />
        Word Retrato
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleWord(true)}>
        <File className="w-4 h-4 mr-1 text-blue-500" />
        Word Paisagem
      </Button>
      <Button variant="outline" size="sm" onClick={handleExcel}>
        <Sheet className="w-4 h-4 mr-1 text-green-500" />
        Excel
      </Button>
    </div>
  );
}
