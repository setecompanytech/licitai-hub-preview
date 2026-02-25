import { Button } from '@/components/ui/button';
import { Download, FileText, Sheet, File } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface PropostaDownloadProps {
  proposal: string;
  numeroLicitacao: string;
  timbradoUrl?: string | null;
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

export default function PropostaDownload({ proposal, numeroLicitacao, timbradoUrl }: PropostaDownloadProps) {

  const handlePDF = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    try {
      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      // ABNT margins: 3cm top/left, 2cm bottom/right
      const marginLeft = 30;
      const marginRight = 20;
      const marginTop = 30;
      const marginBottom = 20;
      const maxWidth = pageWidth - marginLeft - marginRight;
      const lineHeight = 6.35; // ~1.5 spacing at 12pt ≈ 18pt ≈ 6.35mm
      let y = marginTop;

      // Header centered
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('PROPOSTA COMERCIAL / TÉCNICA', pageWidth / 2, y, { align: 'center' });
      y += lineHeight * 2;

      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      doc.setTextColor(120);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, marginLeft, y);
      doc.setTextColor(0);
      y += lineHeight * 1.5;

      // Content – Times New Roman 12pt, 1.5 spacing
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(proposal, maxWidth);

      for (const line of lines) {
        if (y > pageHeight - marginBottom) {
          doc.addPage();
          y = marginTop;
        }
        const trimmed = (line as string).trim();
        const isHeader = /^(#{1,3}\s|[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÇ\s]{10,}$|\d+[\.\)]\s)/.test(trimmed);
        if (isHeader) {
          doc.setFont('times', 'bold');
          doc.setFontSize(12);
        } else {
          doc.setFont('times', 'normal');
          doc.setFontSize(12);
        }
        doc.text(trimmed, marginLeft, y);
        y += lineHeight;
      }

      doc.save(`${getFilename(numeroLicitacao)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleWord = (landscape = false) => {
    try {
      const pageSize = landscape
        ? 'width:297mm;height:210mm;'
        : 'width:210mm;height:297mm;';
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
          <style>
            @page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 30mm 20mm 20mm 30mm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; ${pageSize} margin: 30mm 20mm 20mm 30mm; }
            h1 { font-family: 'Times New Roman', Times, serif; font-size: 14pt; text-align: center; margin-bottom: 18pt; font-weight: bold; }
            h2 { font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin-top: 12pt; font-weight: bold; }
            p { margin: 0 0 0 0; text-align: justify; text-indent: 0; }
            .header-info { font-size: 9pt; color: #666; text-align: right; margin-bottom: 12pt; }
          </style>
        </head>
        <body>
          <h1>PROPOSTA COMERCIAL / TÉCNICA</h1>
          <p class="header-info">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          ${proposal
            .split('\n')
            .map(line => {
              const trimmed = line.trim();
              if (!trimmed) return '<br/>';
              if (/^#{1,3}\s/.test(trimmed)) {
                return `<h2>${trimmed.replace(/^#+\s*/, '')}</h2>`;
              }
              if (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÇ\s]{10,}$/.test(trimmed)) {
                return `<p><strong>${trimmed}</strong></p>`;
              }
              return `<p>${trimmed}</p>`;
            })
            .join('\n')}
        </body>
        </html>
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
      const lines = proposal.split('\n').filter(l => l.trim());
      const data = lines.map((line, idx) => ({
        'Linha': idx + 1,
        'Conteúdo': line.trim(),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      // Set column widths
      ws['!cols'] = [{ wch: 8 }, { wch: 120 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Proposta');

      XLSX.writeFile(wb, `${getFilename(numeroLicitacao)}.xlsx`);
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
