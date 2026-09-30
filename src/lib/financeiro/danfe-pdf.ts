/**
 * O DANFE gerado do XML (30/09/2026).
 *
 * O dono: "a função é extrair o XML e gerar o DANFE automaticamente". O
 * DANFE é a impressão do XML autorizado — quem tem o XML imprime o DANFE;
 * não depende de certificado nem do emissor. Aqui a folha A4 no traçado do
 * Manual de Orientação do Contribuinte (cabeçalho do emitente, quadro DANFE,
 * chave com código de barras Code 128 C, destinatário, cálculo do imposto,
 * produtos, dados adicionais), com o jsPDF já usado nas propostas.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { NFeData } from '@/lib/parseNFe';
import { larguras128C } from './code128';

const brl = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const cnpj = (v: string | null | undefined) => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v ?? '';
};
const data = (v: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v ?? '');
};
const chaveEmGrupos = (c: string) => c.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
const numeroNf = (n: number | string | null | undefined) => String(Number(n) || 0).padStart(9, '0').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');

type Caixa = { x: number; y: number; w: number; h: number };

function caixa(doc: jsPDF, c: Caixa, rotulo: string, valor: string, opts: { negrito?: boolean; tamanho?: number; alinhar?: 'left' | 'right' | 'center' } = {}) {
  doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(c.x, c.y, c.w, c.h);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(60);
  doc.text(rotulo.toUpperCase(), c.x + 1, c.y + 2.2);
  doc.setFont('helvetica', opts.negrito ? 'bold' : 'normal'); doc.setFontSize(opts.tamanho ?? 7.5); doc.setTextColor(0);
  const texto = doc.splitTextToSize(valor || '', c.w - 2) as string[];
  const x = opts.alinhar === 'right' ? c.x + c.w - 1 : opts.alinhar === 'center' ? c.x + c.w / 2 : c.x + 1;
  doc.text(texto.slice(0, Math.max(1, Math.floor((c.h - 3) / 3))), x, c.y + 5.6, { align: opts.alinhar ?? 'left' });
}

function codigoDeBarras(doc: jsPDF, chave: string, x: number, y: number, larguraMax: number, altura: number) {
  const larguras = larguras128C(chave);
  const total = larguras.reduce((a, b) => a + b, 0);
  const modulo = Math.min(0.33, larguraMax / total);
  const inicio = x + (larguraMax - total * modulo) / 2;
  let cursor = inicio;
  doc.setFillColor(0, 0, 0);
  larguras.forEach((w, i) => {
    if (i % 2 === 0) doc.rect(cursor, y, w * modulo, altura, 'F');
    cursor += w * modulo;
  });
}

/** A folha do DANFE como PDF (ArrayBuffer). */
export function gerarDanfePdf(nfe: NFeData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const M = 7; const W = 210 - 2 * M;
  const chave = String(nfe.chave_acesso ?? '').replace(/\D/g, '');
  const tipo = nfe.tipo_nf === 'entrada' ? '0' : '1';

  const cabecalho = () => {
    let y = M;
    // Emitente
    doc.setDrawColor(0); doc.setLineWidth(0.2);
    doc.rect(M, y, 82, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text((doc.splitTextToSize(nfe.nome_emitente || '', 78) as string[]).slice(0, 2), M + 41, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    const end = [
      [nfe.logradouro_emitente, nfe.numero_emitente].filter(Boolean).join(', '),
      [nfe.bairro_emitente, nfe.municipio_emitente ? `${nfe.municipio_emitente}/${nfe.uf_emitente ?? ''}` : '', nfe.cep_emitente ? `CEP ${nfe.cep_emitente}` : ''].filter(Boolean).join(' · '),
      [nfe.fone_emitente ? `Fone ${nfe.fone_emitente}` : '', nfe.cnpj_emitente ? `CNPJ ${cnpj(nfe.cnpj_emitente)}` : '', nfe.ie_emitente ? `IE ${nfe.ie_emitente}` : ''].filter(Boolean).join(' · '),
    ].filter(Boolean);
    end.forEach((l, i) => doc.text((doc.splitTextToSize(l, 78) as string[])[0] ?? '', M + 41, y + 14 + i * 3.6, { align: 'center' }));
    // Quadro DANFE
    doc.rect(M + 82, y, 40, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('DANFE', M + 102, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
    doc.text(['Documento Auxiliar da', 'Nota Fiscal Eletrônica'], M + 102, y + 9.5, { align: 'center' });
    doc.setFontSize(6); doc.text('0 - ENTRADA', M + 86, y + 17); doc.text('1 - SAÍDA', M + 86, y + 20);
    doc.rect(M + 108, y + 14.5, 8, 7); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(tipo, M + 112, y + 19.8, { align: 'center' });
    doc.setFontSize(7); doc.text(`Nº ${numeroNf(nfe.numero_nf)}`, M + 102, y + 25, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(`SÉRIE ${nfe.serie ?? 1}   FOLHA {pagina}`, M + 102, y + 28.2, { align: 'center' });
    // Chave + código de barras
    doc.rect(M + 122, y, W - 122, 30);
    if (chave.length === 44) codigoDeBarras(doc, chave, M + 124, y + 2, W - 126, 12);
    doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.text('CHAVE DE ACESSO', M + 123, y + 17.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.text(chaveEmGrupos(chave), M + 123, y + 20.8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2);
    doc.text(doc.splitTextToSize('Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da SEFAZ autorizadora', W - 126) as string[], M + 123, y + 24.2);
    y += 30;
    caixa(doc, { x: M, y, w: 130, h: 8 }, 'Natureza da operação', nfe.nat_op || '');
    caixa(doc, { x: M + 130, y, w: W - 130, h: 8 }, 'Protocolo de autorização de uso', nfe.protocolo_auth || '');
    y += 8;
    caixa(doc, { x: M, y, w: 65, h: 8 }, 'Inscrição estadual', nfe.ie_emitente || '');
    caixa(doc, { x: M + 65, y, w: 65, h: 8 }, 'Inscrição estadual do subst. tributário', '');
    caixa(doc, { x: M + 130, y, w: W - 130, h: 8 }, 'CNPJ', cnpj(nfe.cnpj_emitente));
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text('DESTINATÁRIO / REMETENTE', M, y + 3); y += 4;
    caixa(doc, { x: M, y, w: 110, h: 8 }, 'Nome / razão social', nfe.nome_dest || '');
    caixa(doc, { x: M + 110, y, w: 50, h: 8 }, 'CNPJ / CPF', cnpj(nfe.cnpj_dest || nfe.cpf_dest));
    caixa(doc, { x: M + 160, y, w: W - 160, h: 8 }, 'Data da emissão', data(nfe.data_emissao));
    y += 8;
    caixa(doc, { x: M, y, w: 110, h: 8 }, 'Inscrição estadual', nfe.ie_dest || '');
    caixa(doc, { x: M + 110, y, w: 50, h: 8 }, 'UF', nfe.uf_dest || '');
    caixa(doc, { x: M + 160, y, w: W - 160, h: 8 }, 'E-mail', nfe.email_dest || '');
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text('CÁLCULO DO IMPOSTO', M, y + 3); y += 4;
    const l1: Array<[string, string]> = [['Base de cálculo do ICMS', brl(nfe.v_bc)], ['Valor do ICMS', brl(nfe.v_icms)], ['Valor do PIS', brl(nfe.v_pis)], ['Valor da COFINS', brl(nfe.v_cofins)], ['Valor total dos produtos', brl(nfe.v_prod)]];
    l1.forEach(([r, v], i) => caixa(doc, { x: M + (W / 5) * i, y, w: W / 5, h: 8 }, r, v, { alinhar: 'right' }));
    y += 8;
    const l2: Array<[string, string]> = [['Valor do frete', brl(nfe.v_frete)], ['Valor do seguro', brl(nfe.v_seg)], ['Desconto', brl(nfe.v_desc)], ['Valor do IPI', brl(nfe.v_ipi)], ['Valor total da nota', brl(nfe.v_nf)]];
    l2.forEach(([r, v], i) => caixa(doc, { x: M + (W / 5) * i, y, w: W / 5, h: 8 }, r, v, { alinhar: 'right', negrito: i === 4 }));
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text('DADOS DO PRODUTO / SERVIÇO', M, y + 3);
    return y + 4;
  };

  const inicioTabela = cabecalho();
  autoTable(doc, {
    startY: inicioTabela,
    margin: { left: M, right: M, top: M },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 0.8, lineWidth: 0.15, lineColor: 0, textColor: 0, overflow: 'linebreak' },
    headStyles: { fillColor: [235, 235, 235], textColor: 0, fontStyle: 'bold', fontSize: 5.5 },
    columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 14 }, 3: { cellWidth: 9 }, 4: { cellWidth: 10 }, 5: { cellWidth: 11 }, 6: { cellWidth: 17, halign: 'right' }, 7: { cellWidth: 19, halign: 'right' }, 8: { cellWidth: 20, halign: 'right' } },
    head: [['CÓDIGO', 'DESCRIÇÃO DO PRODUTO / SERVIÇO', 'NCM/SH', 'CST', 'CFOP', 'UN', 'QUANT.', 'V. UNIT.', 'V. TOTAL']],
    body: (nfe.itens ?? []).map((i) => [i.c_prod ?? '', i.x_prod ?? '', i.ncm ?? '', i.cst_icms || i.csosn || '', i.cfop ?? '', i.u_com ?? '', qtd(i.q_com), brl(i.v_un_com), brl(i.v_prod)]),
    didDrawPage: (d) => {
      // Rodapé com a página; a folha 2+ repete só a faixa do topo.
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(90);
      doc.text(`DANFE impresso a partir do XML autorizado · chave ${chaveEmGrupos(chave)} · gerado pelo Praefectus`, M, 293);
      doc.text(`Folha ${d.pageNumber}`, 210 - M, 293, { align: 'right' });
      doc.setTextColor(0);
    },
  });
  // deno-lint-ignore no-explicit-any
  const fim = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? inicioTabela) + 3;
  if (fim < 260) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text('DADOS ADICIONAIS', M, fim + 3);
    caixa(doc, { x: M, y: fim + 4, w: W, h: Math.min(28, 285 - fim - 4) }, 'Informações complementares', nfe.inf_compl || '', { tamanho: 6.2 });
  }
  // Folha X/Y no cabeçalho, agora que se sabe o total.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(0);
    // cobre o marcador {pagina} com fundo branco e reescreve
    doc.setFillColor(255, 255, 255); doc.rect(M + 84, M + 25.6, 36, 3.4, 'F');
    doc.text(`SÉRIE ${nfe.serie ?? 1}   FOLHA ${p}/${total}`, M + 102, M + 28.2, { align: 'center' });
  }
  return doc.output('arraybuffer');
}

/** Abre o DANFE gerado numa aba nova (Blob URL). Falso quando o navegador bloqueou. */
export function abrirDanfe(nfe: NFeData): boolean {
  const url = URL.createObjectURL(new Blob([gerarDanfePdf(nfe)], { type: 'application/pdf' }));
  const janela = window.open(url, '_blank');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return !!janela;
}

/** O DANFE como arquivo, para o cofre: `DANFE-<chave>.pdf`. */
export function arquivoDanfe(nfe: NFeData): File {
  const chave = String(nfe.chave_acesso ?? '').replace(/\D/g, '');
  return new File([gerarDanfePdf(nfe)], `DANFE-${chave || nfe.numero_nf || 'nfe'}.pdf`, { type: 'application/pdf' });
}
