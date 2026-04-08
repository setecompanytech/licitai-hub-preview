import { Button } from '@/components/ui/button';
import { FileText, File, Sheet } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { writeExcelFromJson } from '@/lib/excel-utils';
import { withErrorAlert } from '@/lib/error-alert';
import { valorPorExtenso } from '@/lib/numero-extenso';

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
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    nome_fantasia?: string;
    inscricao_estadual?: string;
    inscricao_municipal?: string;
    certificado_nome?: string | null;
    certificado_tipo?: string | null;
    certificado_path?: string | null;
  } | null;
  repData?: {
    nome?: string;
    cpf?: string;
    rg?: string;
    orgaoExp?: string;
    cargo?: string;
    naturalidade?: string;
    nacionalidade?: string;
    estadoCivil?: string;
    endereco?: string;
  };
  bancData?: {
    banco?: string;
    agencia?: string;
    conta?: string;
    tipoConta?: string;
    pix?: string;
  };
  itens?: EditalItem[];
  licitacaoData?: {
    orgao?: string;
    modalidade?: string;
    objeto?: string;
    valorEstimado?: string;
    prazoValidade?: string;
    prazoPagamento?: string;
    prazoEntrega?: string;
    localEntrega?: string;
    liquidacaoNfe?: string;
    garantia?: string;
    condicoesEntrega?: string;
  };
  telefone?: string;
  email?: string;
  inscEstadual?: string;
  inscMunicipal?: string;
  pageOrientation?: 'portrait' | 'landscape';
  declaracoesAtivas?: string[];
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  return numero?.trim() ? `Proposta_${numero.replace(/[\s/\\]/g, '_')}` : 'Proposta_Comercial';
}

const DECLARACOES_TEXTO = [
  'Nos comprometemos a fornecer os produtos e serviços deste Edital, nas condições e exigências estabelecidas no Edital;',
  'Declaramos que o(s) objeto(s) será(ão) entregue(s) estritamente de acordo com as especificações, condições, exigências constantes no Edital;',
  'Que estamos de pleno acordo com todas as condições e exigências estabelecidas no Edital e seus Anexos, bem como aceitamos todas as obrigações e responsabilidades especificadas no Edital, Termo de Referência e instrumento de Contrato;',
  'Estar cientes da responsabilidade administrativa, civil e penal, bem como ter tomado conhecimento de todas as informações e condições necessárias à correta cotação do objeto licitado;',
  'Que os preços propostos estão incluídos todos os custos e despesas, frete, taxas e impostos, tributos, encargos fiscais, comerciais, sociais e trabalhistas, transporte, inclusive desembaraço alfandegário e outros inerentes ao objeto relativo a este procedimento licitatório, inclusive despesas necessárias ao cumprimento integral do objeto, não sendo considerados pleitos de acréscimos a esse ou a qualquer título posteriormente, observadas ainda as isenções previstas na legislação;',
  'Que cumpriremos todos os prazos estabelecidos no Edital e seus Anexos;',
  'Que os valores ofertados na proposta serão fixos e irreajustáveis;',
];

export default function PropostaDownload({
  proposal, numeroLicitacao, timbradoUrl,
  empresaData, repData, bancData, itens, licitacaoData, telefone, email,
  inscEstadual, inscMunicipal,
  pageOrientation = 'portrait', declaracoesAtivas,
}: PropostaDownloadProps) {

  const validItens = (itens || []).filter(i => i.descricao.trim());

  const enderecoCompleto = [
    empresaData?.endereco,
    empresaData?.complemento,
    empresaData?.bairro,
    empresaData?.municipio && empresaData?.uf ? `${empresaData.municipio}/${empresaData.uf}` : empresaData?.municipio,
    empresaData?.cep ? `CEP: ${empresaData.cep}` : null,
  ].filter(Boolean).join(', ');

  const valorGlobal = validItens.reduce((s, i) => s + (parseFloat(i.valorTotal?.replace(',', '.') || '0') || 0), 0);
  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ==================== PDF ====================
  const handlePDF = async (orientation: 'portrait' | 'landscape' = 'portrait') => {
    await withErrorAlert(async () => {
      const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const mL = 30, mR = 20, mB = 20;
      const maxW = pageWidth - mL - mR;
      const lh = 6;

      // Load timbrado
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

      const drawTimbrado = () => {
        if (!timbradoImg) return;
        // Constrain to max 60mm wide, centered
        const maxImgW = Math.min(60, maxW * 0.4);
        const imgH = maxImgW / timbradoAspect;
        const finalH = Math.min(imgH, 18);
        const finalW = finalH * timbradoAspect;
        const imgX = mL + (maxW - finalW) / 2;
        doc.addImage(timbradoImg, 'PNG', imgX, 8, finalW, finalH);
      };

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
        y += lh * 0.5;
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(text.toUpperCase(), mL, y);
        y += 2;
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.5);
        doc.line(mL, y, mL + maxW, y);
        y += lh;
      };

      const addText = (text: string, bold = false, indent = 0, fontSize = 11) => {
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

      const addKV = (key: string, value: string, fontSize = 11) => {
        if (!value) return;
        checkPage();
        doc.setFont('times', 'bold');
        doc.setFontSize(fontSize);
        doc.text(`${key}: `, mL, y);
        const kw = doc.getTextWidth(`${key}: `);
        doc.setFont('times', 'normal');
        const lines = doc.splitTextToSize(value, maxW - kw);
        doc.text(lines[0], mL + kw, y);
        y += lh;
        for (let i = 1; i < lines.length; i++) {
          checkPage();
          doc.text(lines[i], mL + kw, y);
          y += lh;
        }
      };

      // ── DESTINATÁRIO ──
      if (licitacaoData?.orgao) {
        doc.setFont('times', 'italic');
        doc.setFontSize(14);
        doc.text('A', mL, y);
        y += lh;
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.text(licitacaoData.orgao, mL, y);
        y += lh * 1.5;
      }

      // ── CABEÇALHO ──
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setDrawColor(0);
      doc.setLineWidth(0.8);
      const titleText = 'PROPOSTA COMERCIAL';
      const tw = doc.getTextWidth(titleText);
      const tx = (pageWidth - tw) / 2;
      doc.rect(tx - 4, y - 5, tw + 8, 8);
      doc.text(titleText, tx, y);
      y += lh;
      if (numeroLicitacao) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const refText = `Ref.: ${numeroLicitacao}${licitacaoData?.modalidade ? ` - ${licitacaoData.modalidade}` : ''}`;
        doc.text(refText, pageWidth / 2, y, { align: 'center' });
        y += lh * 1.5;
      }

      // ── APRESENTAÇÃO ──
      if (empresaData?.razao_social) {
        let apresentacao = `A empresa ${empresaData.razao_social}, devidamente inscrita no Ministério da Fazenda sob o CNPJ nº. ${empresaData.cnpj || ''}`;
        if (enderecoCompleto) apresentacao += `, com sede na ${enderecoCompleto}`;
        apresentacao += ', por intermédio de seu representante legal, infra-assinado, apresenta a seguinte PROPOSTA COMERCIAL:';
        addText(apresentacao, false, 0, 11);
        y += lh * 0.5;
      }

      // ── TABELA DE ITENS ──
      if (validItens.length > 0) {
        const tableHead = [['ITEM', 'UNID', 'QTDE', 'ESPECIFICAÇÃO TÉCNICA', 'MARCA', 'VL. UNIT.', 'EXTENSO', 'VL. TOTAL', 'EXTENSO']];
        const tableBody = validItens.map(item => {
          const vlUnit = parseFloat(item.valorUnitario?.replace(',', '.') || '0') || 0;
          const vlTotal = parseFloat(item.valorTotal?.replace(',', '.') || '0') || 0;
          return [
            item.item,
            item.unidade,
            item.quantidade,
            item.descricao,
            item.marca || '-',
            `R$ ${item.valorUnitario}`,
            vlUnit > 0 ? valorPorExtenso(vlUnit) : '-',
            `R$ ${item.valorTotal}`,
            vlTotal > 0 ? valorPorExtenso(vlTotal) : '-',
          ];
        });

        // Total row
        tableBody.push([
          { content: valorGlobal > 0 ? valorPorExtenso(valorGlobal) : '...', colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fontSize: 9 } } as any,
          { content: formatCurrency(valorGlobal), colSpan: 2, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 10 } } as any,
        ]);

        autoTable(doc, {
          startY: y,
          head: tableHead,
          body: tableBody,
          margin: { left: mL, right: mR },
          styles: { font: 'times', fontSize: 7, cellPadding: 1.5, halign: 'center', valign: 'middle', lineWidth: 0.3, lineColor: [0, 0, 0] },
          headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold', fontSize: 7 },
          columnStyles: {
            3: { halign: 'left', cellWidth: orientation === 'landscape' ? 80 : 40 },
            5: { halign: 'right' },
            7: { halign: 'right', fontStyle: 'bold' },
          },
          didDrawPage: () => { drawTimbrado(); },
        });
        y = (doc as any).lastAutoTable?.finalY + lh || y + lh * 4;

        // Encargos
        checkPage(lh * 4);
        addText('Nos valores propostos acima, estão inclusos todos e quaisquer encargos inerentes ao fornecimento do objeto desta proposta, tais como: tributos, taxas, transportes, carregamento, descarregamento, encargos sociais, trabalhistas, frete, seguro, e outros que, direta e indiretamente, incidam sobre o perfeito e integral cumprimento da proposta apresentada.', false, 0, 10);
        y += lh * 0.5;
      }

      // ── CONDIÇÕES ──
      if (licitacaoData?.prazoPagamento) {
        addTitle('Condições de Pagamento');
        addText(licitacaoData.prazoPagamento, false, 0, 10);
      }
      if (licitacaoData?.prazoEntrega) {
        addTitle('Condições de Entrega');
        addText(licitacaoData.prazoEntrega, false, 0, 10);
      }
      if (licitacaoData?.localEntrega) {
        addTitle('Local de Entrega');
        addText(licitacaoData.localEntrega, false, 0, 10);
      }
      if (licitacaoData?.condicoesEntrega) {
        addTitle('Condições Especiais');
        addText(licitacaoData.condicoesEntrega, false, 0, 10);
      }
      if (licitacaoData?.liquidacaoNfe) {
        addTitle('Liquidação / Nota Fiscal');
        addText(licitacaoData.liquidacaoNfe, false, 0, 10);
      }
      if (licitacaoData?.garantia) {
        addTitle('Garantia');
        addText(licitacaoData.garantia, false, 0, 10);
      }
      if (licitacaoData?.prazoValidade) {
        addTitle('Prazo de Validade desta Proposta');
        addText(`O prazo de validade da proposta não será inferior a ${licitacaoData.prazoValidade}, a contar da data de sua apresentação.`, false, 0, 10);
      }

      // ── DECLARAÇÕES ──
      checkPage(lh * 6);
      addTitle('Declarações Legais');
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text('DECLARAMOS AINDA, SOB AS PENAS DA LEI:', mL, y);
      y += lh;
      for (const decl of DECLARACOES_TEXTO) {
        checkPage(lh * 3);
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const bullet = `  • ${decl}`;
        const wrapped = doc.splitTextToSize(bullet, maxW - 4);
        for (const wl of wrapped) {
          checkPage();
          doc.text(wl, mL + 2, y);
          y += lh * 0.9;
        }
        y += lh * 0.2;
      }
      y += lh * 0.5;
      addText('Caso nos seja adjudicado o objeto da licitação, comprometemos a assinar o contrato no prazo determinado no documento de convocação, e para esse fim fornecemos os seguintes dados:', false, 0, 10);

      // ── IDENTIFICAÇÃO DA EMPRESA ──
      if (empresaData?.razao_social) {
        checkPage(lh * 8);
        y += lh;
        doc.setDrawColor(150);
        doc.setLineWidth(0.3);
        doc.line(mL, y - 2, mL + maxW, y - 2);
        addKV('Razão Social', `${empresaData.razao_social}. CNPJ/MF: ${empresaData.cnpj || ''}`, 10);
        if (enderecoCompleto) addKV('Endereço', enderecoCompleto, 10);
        if (telefone) addKV('Telefone/WhatsApp', telefone, 10);
        if (email) addKV('E-mail', email, 10);
        if (inscEstadual) addKV('IE', inscEstadual, 10);
        if (inscMunicipal) addKV('IM', inscMunicipal, 10);
        if (bancData?.banco) {
          let bancStr = bancData.banco;
          if (bancData.agencia) bancStr += ` · Agência: ${bancData.agencia}`;
          if (bancData.conta) bancStr += `. ${bancData.tipoConta || 'Conta'}: ${bancData.conta}`;
          if (bancData.pix) bancStr += ` | PIX: ${bancData.pix}`;
          addKV('Dados Bancários', bancStr, 10);
        }
      }

      // ── RESPONSÁVEL ──
      if (repData?.nome) {
        checkPage(lh * 6);
        y += lh * 0.5;
        addTitle('Responsável pela Assinatura do Contrato');
        addKV('Nome', repData.nome, 10);
        if (repData.estadoCivil) {
          let line = `Estado Civil: ${repData.estadoCivil}`;
          if (repData.cargo) line += `. Cargo/Função: ${repData.cargo}`;
          addText(line, false, 0, 10);
        }
        if (repData.cpf) {
          let line = `CPF: ${repData.cpf}`;
          if (repData.rg) line += ` · RG: ${repData.rg}`;
          if (repData.orgaoExp) line += ` — ${repData.orgaoExp}`;
          addText(line, false, 0, 10);
        }
        if (repData.endereco) addKV('Endereço', repData.endereco, 10);
      }

      // ── ASSINATURA ──
      checkPage(lh * 10);
      y += lh * 2;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      const localData = `${empresaData?.municipio || '________'}/${empresaData?.uf || '__'}, ${dataAtual}.`;
      doc.text(localData, pageWidth - mR, y, { align: 'right' });
      y += lh * 4;

      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      const sigX = pageWidth / 2 - 40;
      doc.line(sigX, y, sigX + 80, y);
      y += lh * 0.8;
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text((empresaData?.razao_social || '(Razão Social)').toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += lh * 0.7;
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.text(`CNPJ: ${empresaData?.cnpj || ''}`, pageWidth / 2, y, { align: 'center' });
      if (repData?.nome) {
        y += lh;
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text(repData.nome.toUpperCase(), pageWidth / 2, y, { align: 'center' });
        y += lh * 0.7;
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        if (repData.cpf) doc.text(`CPF: ${repData.cpf}`, pageWidth / 2, y, { align: 'center' });
        if (repData.cargo) {
          y += lh * 0.7;
          doc.text(repData.cargo.toUpperCase(), pageWidth / 2, y, { align: 'center' });
        }
      }

      // ── CERTIFICADO DIGITAL ──
      if (empresaData && (empresaData as any).certificado_nome) {
        y += lh * 2;
        checkPage(lh * 6);
        const boxX = mL + 15;
        const boxW = maxW - 30;
        const boxH = lh * 4;
        doc.setDrawColor(0, 128, 80);
        doc.setLineWidth(0.5);
        doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'S');
        y += lh * 0.8;
        doc.setFont('times', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 100, 60);
        doc.text('✓ DOCUMENTO ASSINADO DIGITALMENTE', pageWidth / 2, y + 2, { align: 'center' });
        y += lh;
        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        const certTipo = (empresaData as any).certificado_tipo === 'e-cnpj' ? 'e-CNPJ' : 'e-CPF';
        doc.text(`Certificado: ${certTipo} — ${(empresaData as any).certificado_nome}`, pageWidth / 2, y + 2, { align: 'center' });
        y += lh * 0.8;
        doc.text(`Assinante: ${repData?.nome || ''} | CPF: ${repData?.cpf || ''}`, pageWidth / 2, y + 2, { align: 'center' });
        y += lh * 0.8;
        doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y + 2, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }

      // Timbrado on all pages
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawTimbrado();
      }

      doc.save(`${getFilename(numeroLicitacao)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    }, 'Geração do PDF da Proposta');
  };

  // ==================== WORD ====================
  const handleWord = (landscape = false) => {
    withErrorAlert(async () => {
      let body = '';

      // Timbrado
      const timbradoHeader = timbradoUrl && /\.(png|jpe?g|webp)(\?|$)/i.test(timbradoUrl)
        ? `<div style="text-align:center;margin-bottom:12pt"><img src="${timbradoUrl}" style="max-height:50pt;max-width:180pt" /></div>`
        : '';

      // Destinatário
      if (licitacaoData?.orgao) {
        body += `<p style="font-style:italic;font-size:14pt">A</p>`;
        body += `<p style="font-weight:bold">${licitacaoData.orgao}</p>`;
      }

      // Cabeçalho
      body += `<p style="text-align:center;margin-top:12pt"><span style="font-weight:bold;font-size:12pt;border:2px solid #000;padding:4pt 16pt">PROPOSTA COMERCIAL</span></p>`;
      if (numeroLicitacao) {
        body += `<p style="text-align:center;font-size:10pt">Ref.: ${numeroLicitacao}${licitacaoData?.modalidade ? ` - ${licitacaoData.modalidade}` : ''}</p>`;
      }

      // Apresentação
      if (empresaData?.razao_social) {
        let txt = `A empresa <b>${empresaData.razao_social}</b>, devidamente inscrita no Ministério da Fazenda sob o CNPJ nº. <b>${empresaData.cnpj || ''}</b>`;
        if (enderecoCompleto) txt += `, com sede na ${enderecoCompleto}`;
        txt += ', por intermédio de seu representante legal, infra-assinado, apresenta a seguinte <b>PROPOSTA COMERCIAL:</b>';
        body += `<p style="text-align:justify;margin-top:12pt">${txt}</p>`;
      }

      // Tabela de itens
      if (validItens.length > 0) {
        const headers = ['ITEM', 'UNID', 'QTDE', 'ESPECIFICAÇÃO TÉCNICA', 'MARCA', 'VL. UNIT.', 'EXTENSO', 'VL. TOTAL', 'EXTENSO'];
        const ths = headers.map(h => `<th style="background:#333;color:white;padding:3pt 4pt;border:1px solid #000;font-size:8pt">${h}</th>`).join('');
        const rows = validItens.map(item => {
          const vlUnit = parseFloat(item.valorUnitario?.replace(',', '.') || '0') || 0;
          const vlTotal = parseFloat(item.valorTotal?.replace(',', '.') || '0') || 0;
          return `<tr>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-size:8pt;font-weight:bold">${item.item}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-size:8pt">${item.unidade}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-size:8pt">${item.quantidade}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:left;font-size:8pt">${item.descricao}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-size:8pt">${item.marca || '-'}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:right;font-size:8pt">R$ ${item.valorUnitario}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-size:7pt;font-style:italic;color:#555">${vlUnit > 0 ? valorPorExtenso(vlUnit) : '-'}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:right;font-size:8pt;font-weight:bold">R$ ${item.valorTotal}</td>
            <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-size:7pt;font-style:italic;color:#555">${vlTotal > 0 ? valorPorExtenso(vlTotal) : '-'}</td>
          </tr>`;
        }).join('');
        // Total row
        const totalRow = `<tr style="background:#f0f0f0">
          <td colspan="7" style="border:2px solid #000;padding:3pt 6pt;text-align:right;font-weight:bold;font-style:italic;font-size:8pt">${valorGlobal > 0 ? valorPorExtenso(valorGlobal) : '...'}</td>
          <td colspan="2" style="border:2px solid #000;padding:3pt 6pt;text-align:center;font-weight:bold;font-size:9pt">${formatCurrency(valorGlobal)}</td>
        </tr>`;
        body += `<table style="width:100%;border-collapse:collapse;margin:12pt 0"><tr>${ths}</tr>${rows}${totalRow}</table>`;

        body += `<p style="text-align:justify;font-size:10pt;margin-top:6pt">Nos valores propostos acima, estão inclusos todos e quaisquer encargos inerentes ao fornecimento do objeto desta proposta, tais como: tributos, taxas, transportes, carregamento, descarregamento, encargos sociais, trabalhistas, frete, seguro, e outros que, direta e indiretamente, incidam sobre o perfeito e integral cumprimento da proposta apresentada.</p>`;
      }

      // Condições
      const addSection = (title: string, content: string) => {
        if (!content) return;
        body += `<h2 style="font-size:11pt;margin-top:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase">${title}</h2>`;
        body += `<p style="text-align:justify;font-size:10pt">${content}</p>`;
      };
      addSection('Condições de Pagamento', licitacaoData?.prazoPagamento || '');
      addSection('Condições de Entrega', licitacaoData?.prazoEntrega || '');
      addSection('Local de Entrega', licitacaoData?.localEntrega || '');
      addSection('Condições Especiais', licitacaoData?.condicoesEntrega || '');
      addSection('Liquidação / Nota Fiscal', licitacaoData?.liquidacaoNfe || '');
      addSection('Garantia', licitacaoData?.garantia || '');
      if (licitacaoData?.prazoValidade) {
        addSection('Prazo de Validade desta Proposta', `O prazo de validade da proposta não será inferior a <b>${licitacaoData.prazoValidade}</b>, a contar da data de sua apresentação.`);
      }

      // Declarações
      body += `<h2 style="font-size:11pt;margin-top:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase">Declarações Legais</h2>`;
      body += `<p style="font-weight:bold;font-size:10pt">DECLARAMOS AINDA, SOB AS PENAS DA LEI:</p>`;
      for (const decl of DECLARACOES_TEXTO) {
        body += `<p style="margin-left:12pt;font-size:10pt;text-align:justify">• ${decl}</p>`;
      }
      body += `<p style="text-align:justify;font-size:10pt;margin-top:6pt">Caso nos seja adjudicado o objeto da licitação, comprometemos a assinar o contrato no prazo determinado no documento de convocação, e para esse fim fornecemos os seguintes dados:</p>`;

      // Identificação
      if (empresaData?.razao_social) {
        body += `<hr style="margin-top:12pt;border-color:#aaa" />`;
        body += `<p style="font-size:10pt"><b>Razão Social:</b> ${empresaData.razao_social}. <b>CNPJ/MF:</b> ${empresaData.cnpj || ''}</p>`;
        if (enderecoCompleto) body += `<p style="font-size:10pt"><b>Endereço:</b> ${enderecoCompleto}</p>`;
        if (telefone) body += `<p style="font-size:10pt"><b>Telefone/WhatsApp:</b> ${telefone}</p>`;
        if (email) body += `<p style="font-size:10pt"><b>E-mail:</b> ${email}</p>`;
        if (inscEstadual) body += `<p style="font-size:10pt"><b>IE:</b> ${inscEstadual}</p>`;
        if (inscMunicipal) body += `<p style="font-size:10pt"><b>IM:</b> ${inscMunicipal}</p>`;
        if (bancData?.banco) {
          let b = `<b>Banco:</b> ${bancData.banco}`;
          if (bancData.agencia) b += ` · <b>Agência:</b> ${bancData.agencia}`;
          if (bancData.conta) b += `. <b>${bancData.tipoConta || 'Conta'}:</b> ${bancData.conta}`;
          if (bancData.pix) b += ` | <b>PIX:</b> ${bancData.pix}`;
          body += `<p style="font-size:10pt">${b}</p>`;
        }
      }

      // Responsável
      if (repData?.nome) {
        body += `<h2 style="font-size:11pt;margin-top:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase">Responsável pela Assinatura do Contrato</h2>`;
        body += `<p style="font-size:10pt"><b>Nome:</b> ${repData.nome}</p>`;
        if (repData.estadoCivil) {
          let l = `<b>Estado Civil:</b> ${repData.estadoCivil}`;
          if (repData.cargo) l += `. <b>Cargo/Função:</b> ${repData.cargo}`;
          body += `<p style="font-size:10pt">${l}</p>`;
        }
        if (repData.cpf) {
          let l = `<b>CPF:</b> ${repData.cpf}`;
          if (repData.rg) l += ` · <b>RG:</b> ${repData.rg}`;
          if (repData.orgaoExp) l += ` — ${repData.orgaoExp}`;
          body += `<p style="font-size:10pt">${l}</p>`;
        }
        if (repData.endereco) body += `<p style="font-size:10pt"><b>Endereço:</b> ${repData.endereco}</p>`;
      }

      // Assinatura
      body += `<p style="text-align:right;margin-top:24pt;font-size:10pt">${empresaData?.municipio || '________'}/${empresaData?.uf || '__'}, ${dataAtual}.</p>`;
      body += `<div style="text-align:center;margin-top:36pt">
        <div style="width:200pt;border-bottom:2px solid #333;margin:0 auto 6pt auto"></div>
        <p style="font-weight:bold;text-indent:0">${(empresaData?.razao_social || '(Razão Social)').toUpperCase()}</p>
        <p style="font-size:9pt;text-indent:0">CNPJ: ${empresaData?.cnpj || ''}</p>
        ${repData?.nome ? `<p style="font-weight:bold;margin-top:4pt;text-indent:0">${repData.nome.toUpperCase()}</p>` : ''}
        ${repData?.cpf ? `<p style="font-size:9pt;text-indent:0">CPF: ${repData.cpf}</p>` : ''}
        ${repData?.cargo ? `<p style="font-size:9pt;text-indent:0">${repData.cargo.toUpperCase()}</p>` : ''}
      </div>`;

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        <style>
          @page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 30mm 20mm 20mm 30mm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; margin: 30mm 20mm 20mm 30mm; }
          h2 { font-size: 11pt; margin-top: 14pt; margin-bottom: 4pt; font-weight: bold; }
          p { margin: 0 0 3pt 0; text-align: justify; }
          table { page-break-inside: avoid; }
        </style></head>
        <body>${timbradoHeader}${body}</body></html>`;

      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
      triggerDownload(blob, `${getFilename(numeroLicitacao)}.doc`);
      toast.success('Documento Word gerado com sucesso!');
    }, 'Geração do Word da Proposta');
  };

  // ==================== EXCEL ====================
  const handleExcel = () => {
    withErrorAlert(async () => {
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
        await writeExcelFromJson(`${getFilename(numeroLicitacao)}.xlsx`, 'Planilha de Preços', data,
          [6, 6, 6, 40, 15, 15, 14, 30, 14, 30]);
      } else {
        const lines = proposal.split('\n').filter(l => l.trim());
        const data = lines.map((line, idx) => ({ 'Linha': idx + 1, 'Conteúdo': line.trim() }));
        await writeExcelFromJson(`${getFilename(numeroLicitacao)}.xlsx`, 'Proposta', data, [8, 120]);
      }
      toast.success('Excel gerado com sucesso!');
    }, 'Geração do Excel da Proposta');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={() => handlePDF(pageOrientation)}>
        <FileText className="w-4 h-4 mr-1 text-destructive" />
        PDF {pageOrientation === 'landscape' ? 'Paisagem' : 'Retrato'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => handlePDF(pageOrientation === 'portrait' ? 'landscape' : 'portrait')}>
        <FileText className="w-4 h-4 mr-1 text-destructive" />
        PDF {pageOrientation === 'portrait' ? 'Paisagem' : 'Retrato'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleWord(pageOrientation === 'landscape')}>
        <File className="w-4 h-4 mr-1 text-blue-500" />
        Word {pageOrientation === 'landscape' ? 'Paisagem' : 'Retrato'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleWord(pageOrientation !== 'landscape')}>
        <File className="w-4 h-4 mr-1 text-blue-500" />
        Word {pageOrientation === 'portrait' ? 'Paisagem' : 'Retrato'}
      </Button>
      <Button variant="outline" size="sm" onClick={handleExcel}>
        <Sheet className="w-4 h-4 mr-1 text-green-500" />
        Excel
      </Button>
    </div>
  );
}
