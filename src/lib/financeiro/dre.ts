/**
 * A montagem do DRE, fora do hook — para poder ser testada.
 *
 * Estava embutida no `queryFn` de `useDRE`, e por isso nenhum teste a
 * alcançava. Enquanto isso ela carregava três defeitos que só apareceram
 * quando alguém conferiu o banco em 27/08/2026:
 *
 *   1. A chave do grupo era só `grupo_dre`. Receita e despesa do mesmo grupo
 *      somavam num total único, e o sinal do grupo vinha da PRIMEIRA linha
 *      que chegasse — numa ordem que o PostgREST não garante. Em agosto/2026,
 *      no grupo sem classificação, isso juntava R$ 126.727,41 de despesa com
 *      R$ 61.044,72 de receita num número só.
 *
 *   2. `sumGrupo("custos")` e `sumGrupo("despesas_operacionais")` procuravam
 *      nomes que não existem. Os valores gravados são `cmv_cps` e
 *      `desp_operacional`. Como `custos` não tinha atalho de reserva, o CMV
 *      nunca entrou: o Lucro Bruto sempre foi igual à Receita Líquida.
 *
 *   3. O atalho "se não achar o grupo, soma tudo que tem esta natureza"
 *      varria para dentro do resultado as categorias sem `grupo_dre` — 445
 *      das 603 na base. O relatório parecia completo exatamente onde estava
 *      mais incompleto.
 *
 * A regra agora: cada grupo soma só o que é dele, o que não tem grupo fica
 * fora e é declarado, e movimentação patrimonial sai por definição.
 */

export type DRELinhaRaw = {
  empresa_id: string;
  competencia: string;
  grupo_dre: string | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  // O enum `financeiro_natureza` tem TRÊS valores. Declarar dois não impedia o
  // terceiro de chegar — só impedia de ser tratado.
  natureza: "receita" | "despesa" | "movimentacao";
  total: number;
};

export type DREGrupo = {
  /** Grupo e natureza juntos: duas naturezas do mesmo grupo não se fundem. */
  chave: string;
  grupo: string;
  rotulo: string;
  natureza: "receita" | "despesa";
  total: number;
  itens: { categoria: string; total: number }[];
};

export type DREResumo = {
  competencia: string;
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custos: number;
  lucroBruto: number;
  despesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  outrosResultados: number;
  resultadoLiquido: number;
  margemLiquida: number;
  grupos: DREGrupo[];
  semClassificacao: { receita: number; despesa: number; linhas: number };
  movimentacaoExcluida: { total: number; linhas: number };
};

/** Os valores que `financeiro_categorias.grupo_dre` realmente assume. */
export const ROTULO_GRUPO_DRE: Record<string, string> = {
  receita_bruta: "Receita bruta",
  deducoes: "Deduções da receita",
  cmv_cps: "Custo das mercadorias e serviços",
  desp_operacional: "Despesas operacionais",
  desp_financeira: "Despesas financeiras",
  receita_financeira: "Receitas financeiras",
  outros: "Sem classificação",
};

export function montarDRE(linhas: DRELinhaRaw[], competencia: string): DREResumo {
  const gruposMap = new Map<string, DREGrupo>();
  const movimentacaoExcluida = { total: 0, linhas: 0 };

  for (const l of linhas) {
    const valor = Number(l.total ?? 0);

    // Movimentação patrimonial não é resultado — transferência, aporte,
    // empréstimo de sócio, distribuição de lucro. Sai pelos DOIS lados, porque
    // as duas marcações existem e nem sempre concordam: o grupo da categoria e
    // a natureza do lançamento.
    //
    // Não é descartada em silêncio: vai para `movimentacaoExcluida`, que a
    // tela mostra. Número que some sem explicação é o que faz ninguém confiar
    // no relatório.
    if (l.grupo_dre === "movimentacao" || l.natureza === "movimentacao") {
      movimentacaoExcluida.total += valor;
      movimentacaoExcluida.linhas += 1;
      continue;
    }

    const grupo = l.grupo_dre ?? "outros";
    const chave = `${grupo}::${l.natureza}`;
    if (!gruposMap.has(chave)) {
      gruposMap.set(chave, {
        chave,
        grupo,
        rotulo: ROTULO_GRUPO_DRE[grupo] ?? grupo,
        natureza: l.natureza,
        total: 0,
        itens: [],
      });
    }
    const g = gruposMap.get(chave)!;
    g.total += valor;
    g.itens.push({ categoria: l.categoria_nome ?? "Sem categoria", total: valor });
  }

  const grupos = Array.from(gruposMap.values()).sort((a, b) => b.total - a.total);
  const sumGrupo = (nome: string) =>
    grupos.filter((g) => g.grupo === nome).reduce((s, g) => s + g.total, 0);

  const receitaBruta = sumGrupo("receita_bruta");
  const deducoes = sumGrupo("deducoes");
  const receitaLiquida = receitaBruta - deducoes;
  const custos = sumGrupo("cmv_cps");
  const lucroBruto = receitaLiquida - custos;
  const despesasOperacionais = sumGrupo("desp_operacional");
  const resultadoOperacional = lucroBruto - despesasOperacionais;
  const resultadoFinanceiro = sumGrupo("receita_financeira") - sumGrupo("desp_financeira");
  const outrosResultados = resultadoFinanceiro;
  const resultadoLiquido = resultadoOperacional + outrosResultados;
  const margemLiquida = receitaLiquida > 0 ? resultadoLiquido / receitaLiquida : 0;

  // O que não tem grupo fica FORA das linhas do resultado e é declarado à
  // parte, para a tela poder dizer quanto ficou de fora e por quê.
  const semGrupo = grupos.filter((g) => g.grupo === "outros");
  const semClassificacao = {
    receita: semGrupo.filter((g) => g.natureza === "receita").reduce((s, g) => s + g.total, 0),
    despesa: semGrupo.filter((g) => g.natureza === "despesa").reduce((s, g) => s + g.total, 0),
    linhas: semGrupo.reduce((s, g) => s + g.itens.length, 0),
  };

  return {
    competencia,
    receitaBruta,
    deducoes,
    receitaLiquida,
    custos,
    lucroBruto,
    despesasOperacionais,
    resultadoOperacional,
    resultadoFinanceiro,
    outrosResultados,
    resultadoLiquido,
    margemLiquida,
    grupos,
    semClassificacao,
    movimentacaoExcluida,
  };
}
