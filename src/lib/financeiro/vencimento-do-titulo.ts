import { dataLocal, deDataLocal, hojeLocal } from './data-local';

/**
 * Todo título nasce com vencimento.
 *
 * A RPC `vincular_lancamento_a_pedido` (Extração de Documentos) gravava
 * `data_vencimento` nula quando a NF-e não trazia duplicata — a NF 736 da
 * ETHOS, R$ 2.145.439,42, ficou assim. Sem vencimento, o título não entra
 * no fluxo de caixa (a view agrupa por `data_vencimento`), o cartão "Em
 * atraso" o ignora e o Kanban o chamava de "Vencido" pela competência
 * (auditoria de 21/09/2026, defeito 1).
 *
 * A precedência, do mais forte ao mais fraco:
 *   1. o vencimento INFORMADO (duplicata da NF-e, linha digitável do boleto,
 *      o que a pessoa digitou);
 *   2. emissão + prazo do cadastro da pessoa (`financeiro_pessoas.
 *      prazo_padrao_dias`), quando os dois existem;
 *   3. a data de emissão — o documento não trouxe prazo, e "à vista" é a
 *      única leitura que não inventa um prazo em nome de ninguém;
 *   4. a competência; 5. hoje.
 *
 * O que foi ASSUMIDO (2 a 5) é dito nas observações do título: um vencimento
 * inventado em silêncio é pior do que nenhum, porque ninguém vai corrigi-lo.
 * A mesma escada vive na RPC, para quem chamar sem passar pelo front.
 */
export type OrigemDoVencimento = 'informado' | 'emissao_mais_prazo' | 'emissao' | 'competencia' | 'hoje';

export type VencimentoDoTitulo = {
  data: string;
  origem: OrigemDoVencimento;
  /** A linha para as observações do título; `null` quando o vencimento foi informado. */
  nota: string | null;
};

export function somarDias(iso: string, dias: number): string {
  const d = deDataLocal(iso.slice(0, 10));
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

const limpa = (v: string | null | undefined): string | null => {
  const s = (v ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export function vencimentoDoTitulo(entrada: {
  informado?: string | null;
  emissao?: string | null;
  competencia?: string | null;
  /** Prazo em dias do cadastro da pessoa; `null` quando não há pessoa ou prazo. */
  prazoDias?: number | null;
  hoje?: string;
}): VencimentoDoTitulo {
  const informado = limpa(entrada.informado);
  if (informado) return { data: informado, origem: 'informado', nota: null };

  const emissao = limpa(entrada.emissao);
  const prazo = entrada.prazoDias;
  if (emissao && typeof prazo === 'number' && Number.isInteger(prazo) && prazo >= 0) {
    return {
      data: somarDias(emissao, prazo),
      origem: 'emissao_mais_prazo',
      nota: `Vencimento assumido: emissão + ${prazo} dia(s), prazo do cadastro da pessoa. Confira.`,
    };
  }
  if (emissao) {
    return {
      data: emissao,
      origem: 'emissao',
      nota: 'Vencimento assumido pela data de emissão: o documento não trouxe prazo. Confira e corrija.',
    };
  }
  const competencia = limpa(entrada.competencia);
  if (competencia) {
    return {
      data: competencia,
      origem: 'competencia',
      nota: 'Vencimento assumido pela competência: o documento não trouxe prazo nem emissão. Confira e corrija.',
    };
  }
  return {
    data: entrada.hoje ?? hojeLocal(),
    origem: 'hoje',
    nota: 'Vencimento assumido pela data do lançamento: o documento não trouxe datas. Confira e corrija.',
  };
}
