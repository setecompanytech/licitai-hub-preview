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

  const handlePDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      // Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PROPOSTA COMERCIAL / TÉCNICA', pageWidth / 2, y, { align: 'center' });
      y += 10;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, y);
      doc.setTextColor(0);
      y += 8;

      // Content
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(proposal, maxWidth);

      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        // Bold for lines that look like headers (all caps or starting with ## or numbered sections)
        const isHeader = /^(#{1,3}\s|[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÇ\s]{10,}$|\d+[\.\)]\s)/.test(line.trim());
        if (isHeader) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
        }
        doc.text(line, margin, y);
        y += isHeader ? 6 : 5;
      }

      doc.save(`${getFilename(numeroLicitacao)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleWord = () => {
    try {
      // Generate .doc HTML format (compatible with Word)
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Calibri', sans-serif; font-size: 12pt; line-height: 1.6; margin: 2cm; }
            h1 { font-size: 16pt; text-align: center; margin-bottom: 20pt; }
            p { margin: 4pt 0; text-align: justify; }
            .header-info { font-size: 9pt; color: #666; text-align: right; margin-bottom: 10pt; }
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
                return `<h2 style="font-size:13pt;margin-top:12pt;">${trimmed.replace(/^#+\s*/, '')}</h2>`;
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
      <Button variant="outline" size="sm" onClick={handlePDF}>
        <FileText className="w-4 h-4 mr-1 text-destructive" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleWord}>
        <File className="w-4 h-4 mr-1 text-blue-500" />
        Word
      </Button>
      <Button variant="outline" size="sm" onClick={handleExcel}>
        <Sheet className="w-4 h-4 mr-1 text-green-500" />
        Excel
      </Button>
    </div>
  );
}
