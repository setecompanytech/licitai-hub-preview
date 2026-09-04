import jsPDF from 'jspdf';
import { aplicarTimbrado, aplicarTimbradoEmTodasAsPaginas, type Timbrado } from '@/lib/timbrado/timbrado';
import autoTable from 'jspdf-autotable';

export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF';
  const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';'))].join('\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${filename}.json`);
}

export function downloadTextReport(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  triggerDownload(blob, `${filename}.txt`);
}

export function downloadPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: string[][],
  timbrado?: Timbrado | null,
) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 5 ? 'landscape' : 'portrait' });

  // Com timbrado, o conteúdo vive entre topo e rodapé da identidade da
  // empresa — retrato ou paisagem, as fronteiras vêm da própria página.
  const molde = timbrado ? aplicarTimbrado(doc, timbrado) : null;
  const yTitulo = molde ? molde.topoY + 2 : 18;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(title, 14, yTitulo);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, yTitulo + 6);

  const alturaPagina = doc.internal.pageSize.getHeight();
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: yTitulo + 12,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: {
      left: 14,
      right: 14,
      top: molde ? molde.topoY : 14,
      bottom: molde ? alturaPagina - molde.rodapeY + 2 : 14,
    },
  });

  // As páginas que o autoTable criou depois da primeira também são timbradas.
  if (timbrado) aplicarTimbradoEmTodasAsPaginas(doc, timbrado);

  doc.save(`${filename}.pdf`);
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
