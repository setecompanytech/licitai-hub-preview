import { formarPreco, somaDasCamadas, type CamadasPreco } from './formacao-preco';

/**
 * A planilha de Composição de Preços, montada para virar peça do processo.
 *
 * Não é um relatório interno. É o documento que a Administração pede quando a
 * proposta chega abaixo do que ela orçou, e a empresa precisa demonstrar que
 * consegue entregar por aquele valor — Lei 14.133/2021, art. 59: o §4º presume
 * inexequível a proposta abaixo de 75% do orçado em obras e serviços de
 * engenharia, e o §3º faculta à Administração exigir a demonstração nos demais
 * objetos. Sem a planilha, a proposta é desclassificada por não comprovar o
 * que afirma.
 *
 * Por isso ela abre as CINCO camadas item a item, em reais e em percentual: o
 * que se demonstra não é o preço, é como ele se forma. Uma tabela com preço
 * final e nada mais não demonstra nada.
 *
 * As linhas saem daqui em array-of-arrays porque é isso que `buildExcelBlob`
 * consome — e porque assim a montagem fica testável sem abrir Excel.
 */

export type ItemParaComposicao = {
  descricao: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
};

export type CabecalhoComposicao = {
  empresa: string;
  cnpj?: string | null;
  processo?: string | null;
  orgao?: string | null;
  regime?: string | null;
  emitidoEm: string;
};

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** As linhas da planilha. Devolve também o total, para quem precisa dele. */
export function montarPlanilhaComposicao(
  itens: ItemParaComposicao[],
  camadas: CamadasPreco,
  cabecalho: CabecalhoComposicao,
): { linhas: (string | number)[][]; total: number; larguras: number[] } {
  const linhas: (string | number)[][] = [];

  linhas.push(['COMPOSIÇÃO ANALÍTICA DE PREÇOS']);
  linhas.push([]);
  linhas.push(['Empresa', cabecalho.empresa, '', 'CNPJ', cabecalho.cnpj ?? '—']);
  linhas.push(['Processo', cabecalho.processo ?? '—', '', 'Órgão', cabecalho.orgao ?? '—']);
  linhas.push(['Regime tributário', cabecalho.regime ?? '—', '', 'Emitida em', cabecalho.emitidoEm]);
  linhas.push([]);

  // As camadas declaradas antes da tabela: quem confere precisa saber que
  // percentuais foram usados, sem ter de deduzi-los dos números.
  linhas.push(['PERCENTUAIS APLICADOS SOBRE O PREÇO DE VENDA']);
  linhas.push(['Impostos/Tributos', pct(camadas.pctImpostos)]);
  linhas.push(['Despesas Administrativas', pct(camadas.pctDespesasAdmin)]);
  linhas.push(['Despesas Operacionais (frete/logística)', pct(camadas.pctDespesasOperacionais)]);
  linhas.push(['Lucro', pct(camadas.pctMargem)]);
  linhas.push(['Soma', pct(somaDasCamadas(camadas))]);
  linhas.push([]);

  linhas.push([
    'Item', 'Descrição', 'Unid.', 'Qtd.',
    'Custo unit.', 'Impostos', 'Desp. Adm.', 'Desp. Oper.', 'Lucro',
    'Preço unit.', 'Preço total',
  ]);

  let total = 0;
  itens.forEach((it, i) => {
    const p = formarPreco(it.custoUnitario, it.quantidade, camadas);
    total += p.precoTotal;
    linhas.push([
      i + 1,
      it.descricao,
      it.unidade,
      it.quantidade,
      brl(p.composicao.custo),
      brl(p.composicao.impostos),
      brl(p.composicao.despesasAdmin),
      brl(p.composicao.despesasOperacionais),
      brl(p.composicao.lucro),
      brl(p.precoUnitario),
      brl(p.precoTotal),
    ]);
  });

  linhas.push([]);
  linhas.push(['', '', '', '', '', '', '', '', 'TOTAL GERAL', '', brl(total)]);
  linhas.push([]);
  linhas.push([
    'Método: preço de venda = custo ÷ (1 − impostos − despesas − lucro). '
    + 'Impostos e despesas incidem sobre o preço, não sobre o custo.',
  ]);

  return {
    linhas,
    total,
    larguras: [6, 46, 8, 10, 14, 14, 14, 14, 14, 15, 16],
  };
}

/** Nome do arquivo, previsível e ordenável. */
export function nomeDoArquivoComposicao(processo?: string | null, data = new Date()): string {
  const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  const proc = (processo || 'sem-processo').replace(/[^\w.-]/g, '_');
  return `composicao-precos_${proc}_${dia}.xlsx`;
}
