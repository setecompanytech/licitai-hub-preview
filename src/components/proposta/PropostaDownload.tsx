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
  const base = numero?.trim() ? `Proposta_${numero.replace(/[\s/\\]/g, '_')}` : 'Proposta_Comercial';
  return base;
}

/** Parse AI markdown into sections */
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

  const handlePDF = async (orientation: 'portrait' | 'landscape' = 'portrait') => {
    try {
      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const mL = 30, mR = 20, mB = 20;
      const maxW = pageWidth - mL - mR;
      const lh = 6.35;

      // Load timbrado image if available
      let timbradoImg: HTMLImageElement | null = null;
      let timbradoAspect = 1;
      if (timbradoUrl && /\.(png|jpe?g|webp)(\?|$)/i.test(timbradoUrl)) {
        try {
          timbradoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = timbradoUrl;
          });
          timbradoAspect = timbradoImg.width / timbradoImg.height;
        } catch { timbradoImg = null; }
      }

      const headerH = timbradoImg ? 22 : 0;
      const mT = 30 + headerH;
      let y = mT;

      // Function to draw timbrado header on current page
      const drawTimbrado = () => {
        if (!timbradoImg) return;
        const imgW = maxW;
        const imgH = imgW / timbradoAspect;
        const finalH = Math.min(imgH, 20);
        const finalW = finalH * timbradoAspect;
        doc.addImage(timbradoImg, 'PNG', mL, 8, finalW, finalH);
      };

      // Draw on first page
      drawTimbrado();

      const checkPage = (needed: number = lh * 2) => {
        if (y + needed > pageHeight - mB) {
          doc.addPage();
          drawTimbrado();
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

      const addLine = (text: string, bold = false, indent = 0, fontSize = 12) => {
        checkPage();
        doc.setFont('times', bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
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

      // Follow the AI-generated structure: render all sections from the AI output in order
      const sections = parseSections(proposal);

      for (const section of sections) {
        if (section.title) {
          addTitle(section.title);
        }

        // Check for tables
        const tableLines = section.lines.filter(l => l.startsWith('|'));
        const textLines = section.lines.filter(l => !l.startsWith('|'));

        if (tableLines.length >= 2) {
          const table = parseMarkdownTable(tableLines);
          if (table) {
            const isKeyValue = table.headers.length === 2;
            autoTable(doc, {
              startY: y,
              head: isKeyValue ? undefined : [table.headers],
              body: isKeyValue
                ? table.rows.map(r => [{ content: r[0], styles: { fontStyle: 'bold' as const } }, r[1] || '—'])
                : table.rows,
              margin: { left: mL, right: mR },
              styles: { font: 'times', fontSize: isKeyValue ? 10 : 8, cellPadding: 2, halign: isKeyValue ? 'left' : 'center', valign: 'middle' },
              headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold', fontSize: 8 },
              alternateRowStyles: { fillColor: [245, 245, 245] },
              columnStyles: isKeyValue
                ? { 0: { cellWidth: 50, fontStyle: 'bold' as const } }
                : { 3: { halign: 'left', cellWidth: 'auto' } },
              didDrawPage: () => { y = mT; },
            });
            y = (doc as any).lastAutoTable?.finalY + lh || y + lh * 4;
          }
        }

        for (const line of textLines) {
          const clean = line.replace(/\*\*/g, '').replace(/^[-•]\s*/, '').trim();
          if (!clean) continue;
          const isBold = line.includes('**') || /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÇ\s:]{10,}$/.test(clean);
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
      doc.text((empresaData?.razao_social || '').toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += lh * 0.8;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text(`CNPJ: ${empresaData?.cnpj || ''}`, pageWidth / 2, y, { align: 'center' });
      y += lh;
      doc.text((repData?.nome || '').toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += lh * 0.8;
      doc.text(`CPF: ${repData?.cpf || ''}`, pageWidth / 2, y, { align: 'center' });
      y += lh * 0.8;
      doc.text((repData?.cargo || '').toUpperCase(), pageWidth / 2, y, { align: 'center' });

      doc.save(`${getFilename(numeroLicitacao)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      console.error('PDF error:', e);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleWord = (landscape = false) => {
    try {
      // Render all AI content faithfully
      const sections = parseSections(proposal);
      let bodyHtml = '';

      for (const section of sections) {
        if (section.title) {
          bodyHtml += `<h2>${section.title.toUpperCase()}</h2>`;
        }

        const tableLines = section.lines.filter(l => l.startsWith('|'));
        const textLines = section.lines.filter(l => !l.startsWith('|'));

        if (tableLines.length >= 2) {
          const table = parseMarkdownTable(tableLines);
          if (table) {
            const thCells = table.headers.map(h => `<th style="background:#404040;color:white;padding:4pt 6pt;border:1px solid #ccc;font-size:9pt">${h}</th>`).join('');
            const rows = table.rows.map((row, i) => {
              const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
              return `<tr style="background:${bg}">${row.map(c => `<td style="border:1px solid #ccc;padding:3pt 6pt;font-size:9pt">${c || '—'}</td>`).join('')}</tr>`;
            }).join('');
            bodyHtml += `<table style="width:100%;border-collapse:collapse;margin:6pt 0"><tr>${thCells}</tr>${rows}</table>`;
          }
        }

        for (const line of textLines) {
          const trimmed = line.replace(/\*\*/g, '').trim();
          if (!trimmed) continue;
          if (line.startsWith('|')) continue;
          if (line.startsWith('- ') || line.startsWith('• ')) {
            bodyHtml += `<p style="margin-left:12pt">• ${trimmed.replace(/^[-•]\s*/, '')}</p>`;
          } else {
            const isBold = line.includes('**');
            bodyHtml += `<p${isBold ? ' style="font-weight:bold"' : ''}>${trimmed}</p>`;
          }
        }
      }

      // Signature
      const signature = `
        <div style="text-align:center;margin-top:36pt">
          <div style="width:200pt;border-bottom:2px solid #333;margin:0 auto 6pt auto"></div>
          <p style="font-weight:bold">${(empresaData?.razao_social || '').toUpperCase()}</p>
          <p style="font-size:10pt">CNPJ: ${empresaData?.cnpj || ''}</p>
          <p>${(repData?.nome || '').toUpperCase()}</p>
          <p style="font-size:10pt">CPF: ${repData?.cpf || ''}</p>
          <p style="font-size:10pt">${(repData?.cargo || '').toUpperCase()}</p>
        </div>
      `;

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        <style>
          @page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 30mm 20mm 20mm 30mm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; margin: 30mm 20mm 20mm 30mm; }
          h2 { font-size: 12pt; margin-top: 18pt; margin-bottom: 6pt; font-weight: bold; border-bottom: 1px solid #999; padding-bottom: 3pt; }
          p { margin: 0 0 3pt 0; text-align: justify; }
          table { page-break-inside: avoid; }
        </style></head>
        <body>
          ${bodyHtml}${signature}
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
