/**
 * O documento autoriza, ou consome?
 *
 * A mesma tela recebe os dois, e tratá-los igual foi o defeito que pôs o
 * contrato 008/2026 em 100% consumido sem nenhuma entrega:
 *
 *   NOTA DE EMPENHO        autoriza. Cria o empenho, não move saldo nenhum.
 *                          O órgão reservou o dinheiro; ninguém entregou nada.
 *
 *   ORDEM DE FORNECIMENTO  consome. Cria o pedido, que sai de um empenho e
 *                          abate o saldo dele, o do item e o do contrato.
 *
 * Empenhar não é entregar. Enquanto o upload da nota criava pedidos, o saldo
 * do contrato caía no instante em que o dinheiro era reservado — e a primeira
 * entrega de verdade o punha acima de 100%.
 */

import { tipoDeEmpenho, type TipoDeEmpenho, type OrigemDaEspecie } from './empenho';

/** O que o upload deste documento deve criar. */
export function oQueODocumentoCria(tipoDocumento: unknown): 'empenho' | 'pedido' {
  const t = String(tipoDocumento ?? '').trim().toLowerCase();
  if (t.startsWith('empenho') || t === 'nota_empenho' || t === 'nota_de_empenho') return 'empenho';
  return 'pedido';
}

/**
 * A espécie do empenho, e de onde ela veio.
 *
 * `documento` só quando a IA achou o campo ROTULADO na nota; sem rótulo ela
 * devolve nulo e quem tem o papel na mão escolhe — e aí é `manual`. A diferença
 * não é burocrática: o mesmo excesso de R$ 5.000 é irregularidade num ordinário
 * e rotina que pede reforço num estimativo, então quem confere precisa saber se
 * está apoiado no documento ou na memória de quem preencheu.
 *
 * `nao_informada` não é estado gravável: significa que falta escolher.
 */
export function especieComOrigem(e: {
  especieDoDocumento?: unknown;
  trecho?: string | null;
  escolhaManual?: unknown;
}): { tipo: TipoDeEmpenho | null; origem: OrigemDaEspecie; trecho: string | null } {
  const doDocumento = tipoDeEmpenho(e.especieDoDocumento);
  if (doDocumento) {
    return { tipo: doDocumento, origem: 'documento', trecho: e.trecho?.trim() || null };
  }
  const daMao = tipoDeEmpenho(e.escolhaManual);
  if (daMao) return { tipo: daMao, origem: 'manual', trecho: null };
  return { tipo: null, origem: 'nao_informada', trecho: null };
}

// ── Cotas ────────────────────────────────────────────────────────────────────

export type Cota = 'principal' | 'reservada';

export type ItemParaCota = {
  descricao?: string | null;
  /** O que o documento disse, se disse. */
  cota?: string | null;
  valorTotal: number;
};

export type CotaAtribuida = {
  cota: Cota | null;
  origem: 'documento' | 'proporcao' | 'indefinida';
};

/** Teto da cota reservada no art. 48, III da LC 123/2006, com folga de arredondamento. */
const TETO_DA_RESERVADA = 0.2505;

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Mesmo produto escrito de dois jeitos — é o que a divisão em cotas produz. */
function mesmoProduto(a: string, b: string): boolean {
  const x = normalizar(a), y = normalizar(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const menor = x.length <= y.length ? x : y;
  const maior = x.length <= y.length ? y : x;
  return menor.length >= 8 && maior.includes(menor.slice(0, Math.min(24, menor.length)));
}

/**
 * Descobre a cota de cada linha do empenho.
 *
 * Duas fontes, nesta ordem:
 *
 *   DOCUMENTO   a nota rotula a linha ("COTA PRINCIPAL", "COTA RESERVADA").
 *               É fato, e manda.
 *
 *   PROPORÇÃO   a nota traz duas linhas do MESMO produto e não rotula
 *               nenhuma. Aí a divisão do art. 48, III se reconhece pela
 *               forma: a menor é a reservada, e ela não passa de 25%.
 *
 * Fora desses dois casos, `null`. Duas linhas em 50/50 não são cota — são duas
 * entregas; três linhas sem rótulo não são divisíveis em duas cotas. Chutar
 * aqui grava no dossiê uma classificação que ninguém leu, e foi assim que as
 * duas linhas do 008/2026 viraram ambas "reservada".
 */
export function atribuirCotas(itens: ItemParaCota[]): CotaAtribuida[] {
  const rotulada = (v: unknown): Cota | null => {
    const t = String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (t.includes('reserv')) return 'reservada';
    if (t.includes('princip') || t.includes('ampla')) return 'principal';
    return null;
  };

  const doDocumento = itens.map(i => rotulada(i.cota));
  if (doDocumento.some(Boolean)) {
    // Rótulo achado: respeita o que está escrito e não completa o resto. Uma
    // linha sem rótulo num documento que rotula as outras é uma linha sobre a
    // qual o documento se calou.
    return doDocumento.map(c => c
      ? { cota: c, origem: 'documento' as const }
      : { cota: null, origem: 'indefinida' as const });
  }

  const indefinidas = (): CotaAtribuida[] =>
    itens.map(() => ({ cota: null, origem: 'indefinida' }));

  if (itens.length !== 2) return indefinidas();
  if (!mesmoProduto(itens[0].descricao ?? '', itens[1].descricao ?? '')) return indefinidas();

  const total = itens[0].valorTotal + itens[1].valorTotal;
  if (!(total > 0)) return indefinidas();

  const menorIdx = itens[0].valorTotal <= itens[1].valorTotal ? 0 : 1;
  const fracaoMenor = itens[menorIdx].valorTotal / total;
  if (fracaoMenor <= 0 || fracaoMenor > TETO_DA_RESERVADA) return indefinidas();

  return itens.map((_, i) => ({
    cota: i === menorIdx ? ('reservada' as const) : ('principal' as const),
    origem: 'proporcao' as const,
  }));
}

export const ROTULO_DA_COTA: Record<Cota, string> = {
  principal: 'Cota principal (ampla concorrência)',
  reservada: 'Cota reservada (ME/EPP/MEI)',
};

export const ROTULO_DA_ORIGEM_DA_COTA: Record<CotaAtribuida['origem'], string> = {
  documento: 'rotulada no empenho',
  proporcao: 'deduzida da proporção 75/25 — confira',
  indefinida: 'não identificada',
};
