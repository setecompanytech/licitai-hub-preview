/**
 * O dossiê do contrato — o que o sistema entrega à IA antes de a pessoa
 * digitar qualquer coisa (27/09/2026).
 *
 * Até aqui a geração recebia só o tipo da peça, o nº do edital e o "contexto"
 * digitado. O Praefectus sabe muito mais do caso: termos, itens, índice,
 * data-base, série oficial, saldo, prazos lidos do PDF. Este módulo monta
 * esse conhecimento num texto estruturado, determinístico e conferível, que
 * vai para o prompt e aparece na tela para a pessoa confirmar.
 */
import { situacaoDoReajuste } from '@/lib/contratos/reajuste';
import type { SerieOficial } from '@/lib/contratos/estudo-de-reajuste';
import { TIPOS_REAJUSTE } from '@/lib/contratos/instrumentos';

export type ContratoDoDossie = {
  numero_contrato: string | null;
  orgao_contratante: string | null;
  objeto: string | null;
  modalidade: string | null;
  tipo_documento: string | null;
  status: string | null;
  data_assinatura: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_global: number | null;
  valor_global_original: number | null;
  saldo_remanescente: number | null;
  valor_consumido: number | null;
  indice_reajuste: string | null;
  data_base_reajuste: string | null;
  reajuste_clausula: string | null;
  fiscal_nome: string | null;
  prazo_pagamento_dias: number | null;
  prazo_entrega_dias: number | null;
  forma_fornecimento: string | null;
};

export type AditivoDoDossie = {
  numero_aditivo: string | null;
  tipo: string | null;
  data_assinatura: string | null;
  data_base_reajuste?: string | null;
  valor_aditivo: number | null;
  nova_data_fim: string | null;
  fundamento_legal?: string | null;
};

export type EntradaDoDossie = {
  contrato: ContratoDoDossie;
  aditivos: AditivoDoDossie[];
  itens: { quantidade: number; valorTotal: number };
  serie?: SerieOficial | null;
  hoje: string;
};

export type Dossie = {
  texto: string;
  numero: string;
  orgao: string;
  /** Aniversário do reajuste e meses devidos, quando há data-base. */
  reajuste: { marco: string; aniversario: string; devido: boolean; meses: number } | null;
};

const TIPOS_DE_REAJUSTE = new Set(TIPOS_REAJUSTE);
const dataBr = (iso: string | null | undefined) =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : 'não informada';
const moeda = (v: number | null | undefined) =>
  v === null || v === undefined ? 'não informado' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function montarDossieDoContrato(e: EntradaDoDossie): Dossie {
  const c = e.contrato;
  const linhas: string[] = [];
  const ehAta = c.tipo_documento === 'ata_srp';
  linhas.push(`${ehAta ? 'Ata de registro de preços' : 'Contrato'}: ${c.numero_contrato ?? 'sem número'}`);
  linhas.push(`Órgão contratante: ${c.orgao_contratante ?? 'não informado'}`);
  if (c.modalidade) linhas.push(`Modalidade: ${c.modalidade}`);
  if (c.objeto) linhas.push(`Objeto: ${c.objeto.slice(0, 600)}`);
  linhas.push(`Assinatura: ${dataBr(c.data_assinatura)} · Vigência: ${dataBr(c.data_inicio)} a ${dataBr(c.data_fim)} · Situação: ${c.status ?? 'não informada'}`);
  linhas.push(`Valor original: ${moeda(c.valor_global_original ?? c.valor_global)} · Valor global vigente: ${moeda(c.valor_global)} · Consumido: ${moeda(c.valor_consumido ?? 0)} · Saldo a executar: ${moeda(c.saldo_remanescente)}`);
  if (e.itens.quantidade > 0) linhas.push(`Itens cadastrados: ${e.itens.quantidade}, somando ${moeda(e.itens.valorTotal)}`);
  if (c.fiscal_nome) linhas.push(`Fiscal do contrato: ${c.fiscal_nome}`);
  if (c.prazo_entrega_dias || c.prazo_pagamento_dias) {
    linhas.push(`Prazos: entrega em ${c.prazo_entrega_dias ?? '—'} dias · pagamento em ${c.prazo_pagamento_dias ?? '—'} dias${c.forma_fornecimento ? ` · fornecimento ${c.forma_fornecimento}` : ''}`);
  }

  if (e.aditivos.length > 0) {
    linhas.push('');
    linhas.push('Termos aditivos e apostilamentos registrados:');
    for (const a of e.aditivos) {
      linhas.push(`- ${a.numero_aditivo ?? 'Termo'} (${a.tipo ?? 'tipo não informado'}), assinado em ${dataBr(a.data_assinatura)}${a.valor_aditivo ? `, valor ${moeda(a.valor_aditivo)}` : ''}${a.nova_data_fim ? `, nova vigência até ${dataBr(a.nova_data_fim)}` : ''}${a.fundamento_legal ? ` — ${a.fundamento_legal}` : ''}`);
    }
  }

  let reajuste: Dossie['reajuste'] = null;
  if (c.data_base_reajuste) {
    const registrados = e.aditivos.filter((a) => a.tipo && TIPOS_DE_REAJUSTE.has(a.tipo)).map((a) => a.data_base_reajuste ?? a.data_assinatura);
    const s = situacaoDoReajuste({ dataBase: c.data_base_reajuste, reajustesRegistrados: registrados, hoje: e.hoje });
    if (s) {
      reajuste = { marco: s.marco, aniversario: s.aniversario, devido: s.devido, meses: s.mesesDesdeAniversario };
      linhas.push('');
      linhas.push(`Cláusula de reajuste: índice ${c.indice_reajuste ?? 'não informado'}, data-base ${dataBr(c.data_base_reajuste)}${c.reajuste_clausula ? ` — "${c.reajuste_clausula.slice(0, 400)}"` : ''}`);
      linhas.push(`${s.marcoEhReajusteAnterior ? 'Marco (último reajuste registrado)' : 'Marco (data-base)'}: ${dataBr(s.marco)} · Aniversário: ${dataBr(s.aniversario)} · ${s.devido ? `Reajuste DEVIDO há ${s.mesesDesdeAniversario} mês(es)` : 'Interregno anual ainda não cumprido'}`);
      if (e.serie) {
        const pct = (Math.round(e.serie.percentual * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const base = c.saldo_remanescente ?? c.valor_global ?? 0;
        linhas.push(`Série oficial ${e.serie.fonte} de ${dataBr(e.serie.data_base)} a ${dataBr(e.serie.data_alvo)}: ${e.serie.meses.length} mês(es), fator ${e.serie.fator.toFixed(6).replace('.', ',')} → ${pct}%${e.serie.completo ? '' : ` (série PARCIAL, divulgada até ${e.serie.serie_ate ?? '—'})`}`);
        linhas.push(`Sobre o saldo a executar de ${moeda(base)}: reajuste de ${moeda(base * (e.serie.fator - 1))}, valor reajustado ${moeda(base * e.serie.fator)}`);
      }
    }
  }

  linhas.push('');
  linhas.push(`Dados lidos do Praefectus em ${dataBr(e.hoje)}. Use-os como fatos do caso; não invente valores, datas ou cláusulas que não estejam aqui ou nos documentos anexados.`);

  return {
    texto: linhas.join('\n'),
    numero: c.numero_contrato ?? '',
    orgao: c.orgao_contratante ?? '',
    reajuste,
  };
}
