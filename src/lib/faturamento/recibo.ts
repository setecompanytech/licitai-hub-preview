/**
 * Recibo de quitação que acompanha a NF-e e as certidões.
 *
 * Segue o modelo real usado pelo financeiro (recibo da NF-e 000.150 / FMAE):
 * cabeçalho com a qualificação da empresa, o valor em destaque, o corpo que
 * amarra nota fiscal, empenho, remessa e contrato de origem, os dados
 * bancários e o bloco de assinatura do representante.
 *
 * Nada aqui é digitado duas vezes: empresa e representante saem de `empresas`,
 * a conta sai de `fin_contas`, e nota, valor e vínculos saem do próprio pedido.
 * Recibo é documento que vai ao órgão — um CNPJ redigitado errado volta como
 * pendência.
 */

import jsPDF from 'jspdf';
import { valorPorExtenso } from '@/lib/numero-extenso';

export type EmpresaDoRecibo = {
  razao_social: string;
  cnpj: string | null;
  inscricao_estadual?: string | null;
  endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
  rep_nome?: string | null;
  rep_cpf?: string | null;
  rep_cargo?: string | null;
};

export type ContaDoRecibo = {
  banco_nome?: string | null;
  agencia?: string | null;
  numero_conta?: string | null;
};

export type DadosDoRecibo = {
  /** Quem paga — órgão contratante. */
  orgao: string;
  valor: number;
  notaFiscal: string | null;
  /** Número do empenho, quando o pedido é nota de empenho. */
  empenho?: string | null;
  /** Ordinal do pedido dentro do contrato: "8ª remessa". */
  remessa?: number | null;
  numeroContrato: string | null;
  /** Licitação de origem: "PE nº 050/2021-FMAE/PMB". */
  origem?: string | null;
};

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Qualificação da empresa, como aparece no rodapé e no topo do modelo. */
export function qualificacaoDaEmpresa(e: EmpresaDoRecibo): string {
  const endereco = [e.endereco, e.complemento, e.bairro && `BAIRRO: ${e.bairro}`]
    .filter(Boolean).join(', ');
  const local = [e.cep && `CEP: ${e.cep}`, [e.municipio, e.uf].filter(Boolean).join('/')]
    .filter(Boolean).join('. ');
  return [
    `${e.razao_social}, INSCRITA SOB O CNPJ N° ${e.cnpj ?? '—'}`,
    e.inscricao_estadual ? ` E INSCRIÇÃO ESTADUAL N° ${e.inscricao_estadual}` : '',
    endereco ? `. SITUADA NA ${endereco}` : '',
    local ? `. ${local}` : '',
    e.telefone ? `. FONE: ${e.telefone}` : '',
    e.email ? `. E-MAIL: ${e.email}` : '',
  ].join('');
}

/**
 * Corpo do recibo. Cada trecho só entra se houver o dado — recibo que diz
 * "contrato nº null" desqualifica o documento inteiro aos olhos do órgão.
 */
export function corpoDoRecibo(d: DadosDoRecibo): string {
  const partes = [
    `Recebemos da ${d.orgao}, a importância supra de ${brl(d.valor)} `,
    `(${valorPorExtenso(d.valor)})`,
  ];
  const refs: string[] = [];
  if (d.notaFiscal) refs.push(`da NOTA FISCAL Nº ${d.notaFiscal}`);
  if (d.empenho) refs.push(`NOTA DE EMPENHO nº ${d.empenho}`);
  if (refs.length) partes.push(`, referente ao pagamento ${refs.join(' e ')}`);

  if (d.remessa && d.numeroContrato) {
    partes.push(` em atendimento a ${d.remessa}ª remessa do contrato nº ${d.numeroContrato}`);
  } else if (d.numeroContrato) {
    partes.push(` em atendimento ao contrato nº ${d.numeroContrato}`);
  }
  if (d.origem) partes.push(` oriundo do ${d.origem}`);

  return partes.join('') + '.';
}

/** Gera o PDF e devolve o blob, para anexar ao kit ou baixar sozinho. */
export function gerarReciboPdf(
  empresa: EmpresaDoRecibo,
  conta: ContaDoRecibo | null,
  dados: DadosDoRecibo,
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 20;                       // margem
  const L = 210 - M * 2;              // largura útil
  let y = M;

  // Cabeçalho: qualificação em corpo pequeno, sob um filete
  doc.setLineWidth(0.4);
  doc.line(M, y, M + L, y);
  y += 5;
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.text(doc.splitTextToSize(qualificacaoDaEmpresa(empresa), L), M, y);
  y += 14;

  doc.setFont('times', 'bold').setFontSize(16);
  doc.text('RECIBO', 105, y, { align: 'center' });
  // Sublinhado do título, como no modelo
  const larguraTitulo = doc.getTextWidth('RECIBO');
  doc.setLineWidth(0.3);
  doc.line(105 - larguraTitulo / 2, y + 1.2, 105 + larguraTitulo / 2, y + 1.2);
  y += 14;

  doc.setFont('times', 'normal').setFontSize(14);
  doc.text(brl(dados.valor), M + L, y, { align: 'right' });
  y += 16;

  doc.setFontSize(12);
  const corpo = doc.splitTextToSize(corpoDoRecibo(dados), L);
  doc.text(corpo, M, y, { align: 'justify', maxWidth: L });
  y += corpo.length * 7 + 12;

  if (conta && (conta.banco_nome || conta.agencia || conta.numero_conta)) {
    doc.setFontSize(11);
    doc.text('Dados Bancários:', M, y); y += 5.5;
    if (conta.banco_nome)   { doc.text(String(conta.banco_nome), M, y); y += 5.5; }
    if (conta.agencia)      { doc.text(`AG: ${conta.agencia}`, M, y); y += 5.5; }
    if (conta.numero_conta) { doc.text(`C/C: ${conta.numero_conta}`, M, y); y += 5.5; }
  }

  // Assinatura — bloco à direita, sobre a linha, como no modelo
  y = Math.max(y + 26, 200);
  doc.setLineWidth(0.3);
  doc.line(M + L - 110, y, M + L, y);
  y += 5;
  doc.setFontSize(10);
  const assinatura = [
    empresa.razao_social,
    `CNPJ: ${empresa.cnpj ?? '—'}`,
    empresa.rep_nome ?? '',
    (empresa.rep_cargo ?? '').toUpperCase(),
    empresa.rep_cpf ? `CPF: ${empresa.rep_cpf}` : '',
  ].filter(Boolean);
  assinatura.forEach((linha) => { doc.text(linha, M + L, y, { align: 'right' }); y += 5; });

  // Rodapé: a mesma qualificação, como no modelo
  const rodape = doc.splitTextToSize(qualificacaoDaEmpresa(empresa), L);
  const alturaRodape = rodape.length * 3.6;
  doc.setLineWidth(0.4);
  doc.line(M, 297 - M - alturaRodape - 4, M + L, 297 - M - alturaRodape - 4);
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.text(rodape, M, 297 - M - alturaRodape);

  return doc.output('blob');
}
