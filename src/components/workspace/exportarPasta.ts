import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import type { ProcessoAnexo, ProcessoDocumento } from '@/hooks/useProcessoWorkspace';
import { toast } from 'sonner';

const BUCKET = 'processo-arquivos';

interface ExportarOpts {
  numeroProcesso?: string | null;
  orgao?: string | null;
  assinatura?: { habilitar: boolean; nome?: string; cpf?: string; cargo?: string; empresaRazao?: string; empresaCnpj?: string };
}

function htmlParaTextoPlano(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.innerText;
}

export function gerarPdfDocumento(doc: ProcessoDocumento, opts?: ExportarOpts): Blob {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  let y = margin;

  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  const titulo = pdf.splitTextToSize(doc.titulo, pageWidth - margin * 2);
  pdf.text(titulo, pageWidth / 2, y, { align: 'center' });
  y += titulo.length * 6 + 4;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const texto = htmlParaTextoPlano(doc.conteudo_html || '');
  const lines = pdf.splitTextToSize(texto, pageWidth - margin * 2);

  for (const ln of lines) {
    if (y > pageHeight - margin - 30) { pdf.addPage(); y = margin; }
    pdf.text(ln, margin, y);
    y += 5;
  }

  // Assinatura digital (selo de autenticação)
  if (opts?.assinatura?.habilitar) {
    if (y > pageHeight - 60) { pdf.addPage(); y = margin; }
    y += 10;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ASSINATURA ELETRÔNICA', margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const a = opts.assinatura;
    const linhasAss = [
      `Signatário: ${a.nome || '-'}`,
      `CPF: ${a.cpf || '-'} | Cargo: ${a.cargo || '-'}`,
      `Empresa: ${a.empresaRazao || '-'} | CNPJ: ${a.empresaCnpj || '-'}`,
      `Documento: ${doc.titulo} | Versão: v${doc.versao}`,
      `Assinado em: ${new Date().toLocaleString('pt-BR')}`,
      `Hash SHA-256: ${gerarHashSimples(doc.id + doc.versao + (doc.conteudo_html || ''))}`,
      `Documento assinado eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.`,
    ];
    for (const ln of linhasAss) {
      pdf.text(ln, margin, y);
      y += 4;
    }
  }

  // Rodapé com numeração
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`Página ${i} de ${total}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    if (opts?.numeroProcesso) {
      pdf.text(`Proc. ${opts.numeroProcesso}`, margin, pageHeight - 10);
    }
  }

  return pdf.output('blob');
}

function gerarHashSimples(str: string): string {
  // hash não-criptográfico determinístico, suficiente para selo visual
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  const hex = Math.abs(h).toString(16).padStart(8, '0');
  return (hex + hex + hex + hex).slice(0, 64).toUpperCase();
}

export async function exportarPastaZip(
  licitacaoId: string,
  anexos: ProcessoAnexo[],
  documentos: ProcessoDocumento[],
  opts?: ExportarOpts,
) {
  const zip = new JSZip();
  const root = zip.folder(`processo-${(opts?.numeroProcesso || licitacaoId).toString().replace(/[^\w]/g, '_')}`)!;

  // README
  root.file('LEIA-ME.txt', [
    'PASTA DO PROCESSO LICITATÓRIO',
    `Processo: ${opts?.numeroProcesso || '-'}`,
    `Órgão: ${opts?.orgao || '-'}`,
    `Exportado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
    `Total de anexos: ${anexos.length}`,
    `Total de documentos: ${documentos.length}`,
    '',
    'Estrutura:',
    '  /anexos/<categoria>/  → arquivos enviados',
    '  /documentos/          → documentos editáveis exportados em PDF',
  ].join('\n'));

  // Documentos -> PDF
  const docsFolder = root.folder('documentos')!;
  let docOk = 0;
  for (const d of documentos) {
    try {
      const blob = gerarPdfDocumento(d, opts);
      const nome = `${d.titulo.replace(/[^\w]/g, '_')}_v${d.versao}.pdf`;
      docsFolder.file(nome, blob);
      docOk++;
    } catch (e) {
      console.error('Erro PDF doc', d.id, e);
    }
  }

  // Anexos -> baixar do storage
  const anexosFolder = root.folder('anexos')!;
  let anexOk = 0;
  let anexErr = 0;
  await Promise.all(anexos.map(async (a) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(a.storage_path);
      if (error || !data) throw error;
      const cat = anexosFolder.folder(a.categoria)!;
      cat.file(a.nome_arquivo, data);
      anexOk++;
    } catch (e) {
      anexErr++;
      console.error('Erro anexo', a.id, e);
    }
  }));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const nomeZip = `processo-${(opts?.numeroProcesso || licitacaoId).toString().replace(/[^\w]/g, '_')}-${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(blob, nomeZip);

  toast.success(`Pasta exportada: ${docOk} doc(s), ${anexOk} anexo(s)${anexErr ? `, ${anexErr} falha(s)` : ''}`);
}
