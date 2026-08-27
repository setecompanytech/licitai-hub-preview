/**
 * As cinco camadas do preço, formadas pelo método do divisor.
 *
 *   1. Custo do Produto          — a cotação do item
 *   2. Despesas Administrativas  — apuradas do Financeiro (indicadores)
 *   3. Despesas Operacionais     — frete, logística
 *   4. Impostos/Tributos         — pela alíquota efetiva do regime
 *   5. Lucro                     — a margem pretendida
 *
 * ── Por que divisor, e não multiplicador ────────────────────────────────────
 *
 * A Calculadora enviava à Proposta `custo × (1 + margem)`. Isso trata a margem
 * como se incidisse sobre o CUSTO, e ignora imposto e despesa por completo.
 *
 * Só que imposto e comissão incidem sobre o PREÇO DE VENDA, não sobre o custo:
 * o DAS do Simples é um percentual do faturamento, o ICMS é percentual da nota,
 * a despesa administrativa se rateia sobre a receita. Quem quer 15% de margem
 * LÍQUIDA precisa que sobrem 15% depois de tirar tudo isso do preço.
 *
 * O tamanho do erro não é sutil. Custo de R$ 100, imposto de 19%, despesa
 * administrativa de 7%, frete de 3%, margem de 15%:
 *
 *   multiplicador:  100 × 1,15                    = R$ 115,00
 *   divisor:        100 ÷ (1 − 0,44)              = R$ 178,57
 *
 * Vendendo a R$ 115,00, o imposto leva R$ 21,85, as despesas levam R$ 11,50, e
 * do que sobra o custo consome R$ 100 — prejuízo de R$ 18,35 por unidade, numa
 * proposta que a tela apresentava como 15% de lucro. Em licitação, esse erro
 * não aparece como preço alto que se perde: aparece como preço baixo que se
 * ganha, e o prejuízo só se descobre na entrega.
 *
 * ── O limite dos 100% ───────────────────────────────────────────────────────
 *
 * Se a soma dos percentuais chega a 100%, o divisor é zero e o preço tende ao
 * infinito. Passando de 100%, ele fica NEGATIVO — e um preço negativo não é um
 * número grande demais, é um sinal de que não existe preço que satisfaça
 * aquelas exigências. A função recusa, em vez de devolver um número que parece
 * resposta.
 *
 * ── Convenção ──────────────────────────────────────────────────────────────
 *
 * Todos os percentuais entram em ponto percentual (0–100), como o usuário
 * digita e como as tabelas legais publicam. Ver CLAUDE.md.
 */

export type CamadasPreco = {
  /** 0–100. Alíquota efetiva do regime sobre o faturamento. */
  pctImpostos: number;
  /** 0–100. Apurado dos indicadores gerenciais. */
  pctDespesasAdmin: number;
  /** 0–100. Frete, logística, entrega. */
  pctDespesasOperacionais: number;
  /** 0–100. Margem líquida pretendida. */
  pctMargem: number;
};

export type PrecoFormado = {
  custoUnitario: number;
  precoUnitario: number;
  quantidade: number;
  precoTotal: number;
  /** Quanto de cada camada há em UM item, em reais. Soma = precoUnitario. */
  composicao: {
    custo: number;
    impostos: number;
    despesasAdmin: number;
    despesasOperacionais: number;
    lucro: number;
  };
  /** O divisor usado: 1 − (soma dos percentuais). */
  divisor: number;
  /** Quanto o preço representa sobre o custo. Só para conferência. */
  markupEfetivo: number;
};

export class PrecoImpossivelError extends Error {
  constructor(public readonly somaPercentual: number) {
    super(
      `Impostos, despesas e margem somam ${somaPercentual.toFixed(2)}% do preço. ` +
      'Não existe preço que atenda a essas exigências — reduza a margem ou as despesas.',
    );
    this.name = 'PrecoImpossivelError';
  }
}

/** A soma das camadas que saem do preço, em ponto percentual. */
export function somaDasCamadas(c: CamadasPreco): number {
  return (c.pctImpostos || 0)
    + (c.pctDespesasAdmin || 0)
    + (c.pctDespesasOperacionais || 0)
    + (c.pctMargem || 0);
}

/** Existe preço possível com essas camadas? */
export function precoEhPossivel(c: CamadasPreco): boolean {
  return somaDasCamadas(c) < 100;
}

/**
 * Forma o preço de venda a partir do custo e das quatro camadas que saem dele.
 *
 * Lança `PrecoImpossivelError` quando a soma alcança 100% — devolver um número
 * ali seria pior do que falhar: seria devolver uma resposta errada com cara de
 * certa, e ela iria para dentro de uma proposta.
 */
export function formarPreco(
  custoUnitario: number,
  quantidade: number,
  camadas: CamadasPreco,
): PrecoFormado {
  const custo = Number(custoUnitario) || 0;
  const qtd = Number(quantidade) || 0;
  const soma = somaDasCamadas(camadas);

  if (soma >= 100) throw new PrecoImpossivelError(soma);

  const divisor = 1 - soma / 100;
  const precoUnitario = custo / divisor;

  // Cada camada é o percentual aplicado ao PREÇO, não ao custo — é essa a
  // diferença que o método do divisor existe para respeitar.
  const impostos = precoUnitario * ((camadas.pctImpostos || 0) / 100);
  const despesasAdmin = precoUnitario * ((camadas.pctDespesasAdmin || 0) / 100);
  const despesasOperacionais = precoUnitario * ((camadas.pctDespesasOperacionais || 0) / 100);
  const lucro = precoUnitario * ((camadas.pctMargem || 0) / 100);

  return {
    custoUnitario: custo,
    precoUnitario,
    quantidade: qtd,
    precoTotal: precoUnitario * qtd,
    composicao: { custo, impostos, despesasAdmin, despesasOperacionais, lucro },
    divisor,
    markupEfetivo: custo > 0 ? precoUnitario / custo : 0,
  };
}

/**
 * O lucro real de vender a um preço IMPOSTO de fora.
 *
 * Em licitação o preço muitas vezes não é escolhido: é o que cabe no teto do
 * edital, ou o que o pregão empurrou. Esta função responde a pergunta que
 * importa nesse momento — "a esse preço, eu ganho ou perco?" — e responde em
 * reais, não em percentual, porque é assim que a decisão é tomada.
 */
export function lucroNoPreco(
  precoUnitario: number,
  custoUnitario: number,
  camadas: Omit<CamadasPreco, 'pctMargem'>,
): { lucroUnitario: number; margemPct: number; viavel: boolean } {
  const preco = Number(precoUnitario) || 0;
  const custo = Number(custoUnitario) || 0;
  const saidas = preco * (
    ((camadas.pctImpostos || 0)
    + (camadas.pctDespesasAdmin || 0)
    + (camadas.pctDespesasOperacionais || 0)) / 100
  );
  const lucroUnitario = preco - custo - saidas;
  return {
    lucroUnitario,
    margemPct: preco > 0 ? (lucroUnitario / preco) * 100 : 0,
    viavel: lucroUnitario > 0,
  };
}

/**
 * O preço está abaixo do limiar que obriga a demonstrar exequibilidade?
 *
 * Lei 14.133/2021, art. 59, §4º: em obras e serviços de engenharia, proposta
 * abaixo de 75% do valor orçado é presumida inexequível. Fora desses objetos
 * não há percentual automático — o §3º faculta à Administração exigir a
 * demonstração —, e na prática os editais adotam limiares próprios.
 *
 * Por isso o limiar é PARÂMETRO, com 75% de padrão: cravar um número no código
 * transformaria a praxe de um edital em regra de produto (CLAUDE.md, princípio
 * 7). O que a função garante é o aviso, não o número.
 */
export function exigeDemonstracaoDeExequibilidade(
  precoOfertado: number,
  valorEstimadoDaAdministracao: number,
  limiarPct = 75,
): { exige: boolean; percentualDoEstimado: number } {
  const estimado = Number(valorEstimadoDaAdministracao) || 0;
  if (estimado <= 0) return { exige: false, percentualDoEstimado: 0 };
  const pct = (Number(precoOfertado) / estimado) * 100;
  return { exige: pct < limiarPct, percentualDoEstimado: pct };
}
