/**
 * Exportação dos relatórios de metas.
 *
 * As duas saídas leem a MESMA estrutura vinda de `montarRelatorio`, então PDF e
 * planilha nunca contam histórias diferentes. Nada de regra de negócio aqui:
 * este arquivo só formata.
 */

import jsPDF from 'jspdf';
import { writeExcelFromJson } from '@/lib/excel-utils';
import type { Relatorio } from './relatorio';

const MARGEM = 15;
const LARGURA_UTIL = 180; // A4 (210mm) menos as duas margens

function nomeArquivo(rel: Relatorio, extensao: string): string {
  const colaborador = rel.colaborador
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
  return `metas-${rel.tipo.toLowerCase()}-${colaborador}-${rel.periodo.fim}.${extensao}`;
}

export function exportarRelatorioPdf(rel: Relatorio): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = MARGEM;

  /** Quebra de página antes de escrever, para nada sair cortado no rodapé. */
  const garantirEspaco = (altura: number) => {
    if (y + altura > 280) { doc.addPage(); y = MARGEM; }
  };

  const titulo = (texto: string) => {
    garantirEspaco(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(texto, MARGEM, y);
    y += 6;
    doc.setDrawColor(200);
    doc.line(MARGEM, y, MARGEM + LARGURA_UTIL, y);
    y += 5;
  };

  const linha = (rotulo: string, valor: string) => {
    garantirEspaco(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(rotulo, MARGEM, y);
    doc.setFont('helvetica', 'bold');
    doc.text(valor, MARGEM + LARGURA_UTIL, y, { align: 'right' });
    y += 6;
  };

  const paragrafo = (texto: string, tamanho = 9) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(tamanho);
    for (const l of doc.splitTextToSize(texto, LARGURA_UTIL) as string[]) {
      garantirEspaco(5);
      doc.text(l, MARGEM, y);
      y += 4.5;
    }
  };

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Metas — Comercial', MARGEM, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${rel.colaborador} — ${rel.periodo.rotulo}`, MARGEM, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    rel.parcial
      ? 'Período em curso — números parciais até a data de emissão.'
      : 'Período encerrado — números definitivos.',
    MARGEM, y,
  );
  doc.setTextColor(0);
  y += 8;

  titulo('Indicadores do período');
  rel.indicadores.forEach((i) => linha(i.rotulo, i.valor));
  y += 3;

  titulo(rel.tipo === 'MES' ? 'Situação de fechamento' : 'Caminho até a meta');
  rel.sugestoes.forEach((s) => linha(s.rotulo, s.valor));
  y += 3;

  if (rel.riscos.length > 0) {
    titulo('Riscos identificados');
    for (const r of rel.riscos) {
      garantirEspaco(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`[${r.severidade.toUpperCase()}] ${r.descricao}`, MARGEM, y);
      y += 4.5;
      if (r.acao) paragrafo(`→ ${r.acao}`, 9);
      y += 2;
    }
    y += 1;
  }

  if (rel.atividades.length > 0) {
    titulo('Trabalhos registrados no sistema');
    rel.atividades.forEach((a) => linha(a.modulo, `${a.quantidade} registro(s)`));
    y += 3;
  }

  titulo('Premissas do cálculo');
  paragrafo(
    'Números usados pelo motor de projeção nesta emissão. Ficam registrados para o '
    + 'relatório continuar reproduzível caso as taxas mudem depois.',
  );
  y += 2;
  rel.premissas.forEach((p) => linha(p.rotulo, p.valor));

  doc.save(nomeArquivo(rel, 'pdf'));
}

export async function exportarRelatorioPlanilha(rel: Relatorio): Promise<void> {
  const linhas: Record<string, string>[] = [
    { Seção: 'Relatório', Item: 'Colaborador', Valor: rel.colaborador },
    { Seção: 'Relatório', Item: 'Período', Valor: rel.periodo.rotulo },
    { Seção: 'Relatório', Item: 'Situação', Valor: rel.parcial ? 'Parcial' : 'Encerrado' },
    ...rel.indicadores.map((i) => ({ Seção: 'Indicadores', Item: i.rotulo, Valor: i.valor })),
    ...rel.sugestoes.map((s) => ({ Seção: 'Sugestões', Item: s.rotulo, Valor: s.valor })),
    ...rel.riscos.map((r) => ({
      Seção: 'Riscos',
      Item: `[${r.severidade}] ${r.descricao}`,
      Valor: r.acao ?? '',
    })),
    ...rel.atividades.map((a) => ({
      Seção: 'Atividades',
      Item: a.modulo,
      Valor: String(a.quantidade),
    })),
    ...rel.premissas.map((p) => ({ Seção: 'Premissas', Item: p.rotulo, Valor: p.valor })),
  ];

  await writeExcelFromJson(nomeArquivo(rel, 'xlsx'), 'Relatório de Metas', linhas, [16, 46, 38]);
}
