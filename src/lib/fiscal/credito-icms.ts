import type { RegimeCadastro } from '@/lib/tributario/regime';

/**
 * O direito a crédito de ICMS na entrada, por finalidade da compra.
 *
 * O dono do produto fixou a finalidade como parâmetro em 13/09/2026, e a razão
 * é esta: a mesma mercadoria, entrando pela mesma nota, gera ou não gera
 * crédito conforme o destino que se dá a ela. Registrar a entrada sem registrar
 * a finalidade é registrar metade do fato.
 *
 * ATENÇÃO ao que este módulo faz e ao que ele NÃO faz.
 *
 * Ele CLASSIFICA: diz se a operação, pelo desenho geral da lei, admite crédito,
 * não admite, ou admite de forma parcelada. Serve para a tela orientar quem
 * lança e para o relatório separar o que merece conferência.
 *
 * Ele NÃO APURA. Não calcula valor de crédito a escriturar, não gera
 * lançamento, não substitui o contador. Crédito de ICMS depende de regra
 * estadual, de benefício fiscal, de substituição tributária já recolhida, de
 * regime especial — coisas que não cabem numa função pura e que variam por UF.
 * Por isso o tom `a_conferir` existe e é usado sem constrangimento: dizer "não
 * sei" é mais barato que escriturar crédito indevido, que volta como glosa e
 * multa.
 *
 * Base legal citada por extenso porque, quando a regra mudar — e a do uso e
 * consumo já foi adiada cinco vezes —, quem vier precisa saber o que releu.
 */

/** Destino que se dá à mercadoria que entrou. */
export type FinalidadeDaEntrada =
  | 'revenda'
  | 'uso_consumo'
  | 'imobilizado'
  | 'materia_prima'
  | 'nao_informada';

export const ROTULO_FINALIDADE: Record<FinalidadeDaEntrada, string> = {
  revenda: 'Revenda',
  uso_consumo: 'Uso e consumo',
  imobilizado: 'Ativo imobilizado',
  materia_prima: 'Matéria-prima ou insumo',
  nao_informada: 'Não informada',
};

export const DESCRICAO_FINALIDADE: Record<FinalidadeDaEntrada, string> = {
  revenda: 'Mercadoria que vai atender pedido de cliente',
  uso_consumo: 'Abastecimento interno — material e equipamento da própria operação',
  imobilizado: 'Bem que fica no ativo da empresa',
  materia_prima: 'Entra na industrialização de outro produto',
  nao_informada: 'Ninguém declarou o destino desta entrada',
};

/**
 * `permitido` — o desenho geral da lei admite o crédito.
 * `vedado` — a lei o nega para esta combinação.
 * `parcelado` — admite, mas ao longo do tempo (CIAP).
 * `a_conferir` — o sistema não tem elementos para afirmar.
 */
export type SituacaoDoCredito = 'permitido' | 'vedado' | 'parcelado' | 'a_conferir';

export interface AvaliacaoDoCredito {
  situacao: SituacaoDoCredito;
  /** Uma frase, para a tela. */
  resumo: string;
  /** O dispositivo, para quem for conferir. */
  fundamento?: string;
  /** Em quantas parcelas mensais, quando `parcelado`. */
  parcelas?: number;
}

/**
 * Classifica o direito a crédito de ICMS da entrada.
 *
 * A primeira decisão é o REGIME, e ela vem antes da finalidade: no Simples
 * Nacional o ICMS é recolhido no documento único, e a entrada não gera crédito
 * a escriturar seja qual for o destino da mercadoria. Perguntar a finalidade
 * antes do regime faria a tela oferecer uma escolha que não muda nada.
 */
export function avaliarCreditoIcms(
  finalidade: FinalidadeDaEntrada,
  regime: RegimeCadastro | null | undefined,
): AvaliacaoDoCredito {
  if (!regime) {
    return {
      situacao: 'a_conferir',
      resumo: 'Regime tributário da empresa não informado — o crédito depende dele.',
    };
  }

  if (regime === 'simples_nacional') {
    return {
      situacao: 'vedado',
      resumo:
        'No Simples Nacional o ICMS é recolhido no documento único: a entrada não gera crédito a escriturar.',
      fundamento: 'LC 123/2006, art. 23',
    };
  }

  // Daqui para baixo, regime normal (Lucro Presumido ou Lucro Real).
  switch (finalidade) {
    case 'revenda':
    case 'materia_prima':
      return {
        situacao: 'permitido',
        resumo:
          'Mercadoria destinada a saída tributada: o imposto da entrada é crédito, pela não cumulatividade.',
        fundamento: 'CF/88, art. 155, §2º, I · LC 87/1996, art. 20',
      };

    case 'imobilizado':
      return {
        situacao: 'parcelado',
        parcelas: 48,
        resumo:
          'Bem do ativo permanente credita-se em 48 parcelas mensais, controladas no CIAP — não de uma vez.',
        fundamento: 'LC 87/1996, art. 20, §5º',
      };

    case 'uso_consumo':
      return {
        situacao: 'vedado',
        resumo:
          'Material de uso e consumo ainda não dá direito a crédito: a entrada em vigor foi adiada sucessivamente.',
        fundamento: 'LC 87/1996, art. 33, I',
      };

    case 'nao_informada':
    default:
      return {
        situacao: 'a_conferir',
        resumo: 'Sem a finalidade da compra não dá para dizer se há crédito.',
      };
  }
}

/**
 * A finalidade é do ITEM da entrada, e o cadastro do produto só sugere.
 *
 * `produtos.tipo_produto` já carrega o vocabulário (00 revenda, 07 uso e
 * consumo, 08 imobilizado…), mas como PADRÃO: a mesma resma de papel entra
 * para o escritório numa nota e para o cliente em outra. Herdar sem deixar
 * trocar transformaria uma conveniência em afirmação fiscal.
 */
const POR_TIPO_DE_PRODUTO: Record<string, FinalidadeDaEntrada> = {
  '00': 'revenda',
  '01': 'materia_prima',
  '02': 'materia_prima',
  '07': 'uso_consumo',
  '08': 'imobilizado',
  '10': 'materia_prima',
};

/** Sugestão de finalidade a partir do cadastro. Nunca é decisão. */
export function finalidadeSugerida(tipoProduto?: string | null): FinalidadeDaEntrada {
  if (!tipoProduto) return 'nao_informada';
  return POR_TIPO_DE_PRODUTO[tipoProduto.trim()] ?? 'nao_informada';
}

/**
 * O CFOP da entrada também denuncia a finalidade, e com frequência é o dado
 * mais confiável que existe na nota: quem emitiu já classificou a operação.
 *
 * Usa o segundo e o terceiro dígito, que são o que distingue a natureza —
 * 1.102/2.102 é compra para comercialização, 1.556/2.556 é uso e consumo,
 * 1.551/2.551 é ativo imobilizado, 1.101/2.101 é industrialização. O primeiro
 * dígito só diz se a operação foi dentro ou fora do estado.
 */
const POR_CFOP: Record<string, FinalidadeDaEntrada> = {
  '101': 'materia_prima',
  '102': 'revenda',
  '111': 'materia_prima',
  '113': 'revenda',
  '116': 'materia_prima',
  '117': 'revenda',
  '118': 'materia_prima',
  '120': 'materia_prima',
  '121': 'revenda',
  '122': 'materia_prima',
  '401': 'materia_prima',
  '403': 'revenda',
  '407': 'uso_consumo',
  '551': 'imobilizado',
  '556': 'uso_consumo',
  '910': 'nao_informada',
};

export function finalidadePeloCfop(cfop?: string | null): FinalidadeDaEntrada {
  const limpo = (cfop ?? '').replace(/\D/g, '');
  if (limpo.length !== 4) return 'nao_informada';
  // Só CFOP de ENTRADA classifica entrada. 5/6/7 é saída, e se aparecer aqui é
  // sinal de nota trocada — deixar passar como "revenda" esconderia o erro.
  if (!['1', '2', '3'].includes(limpo[0])) return 'nao_informada';
  return POR_CFOP[limpo.slice(1)] ?? 'nao_informada';
}

/**
 * A finalidade que a tela oferece já preenchida, com a procedência.
 *
 * O CFOP vem primeiro porque é declaração de quem emitiu a nota; o cadastro do
 * produto vem depois, porque é hábito da casa. Nenhum dos dois decide: os dois
 * sugerem, e a pessoa confirma. A procedência aparece na tela para que a
 * confirmação seja informada — "veio do CFOP 1.556" é argumento; um campo
 * pré-preenchido sem origem é só um palpite com cara de fato.
 */
export function sugerirFinalidade(
  cfop?: string | null,
  tipoProduto?: string | null,
): { finalidade: FinalidadeDaEntrada; procedencia: string } {
  const peloCfop = finalidadePeloCfop(cfop);
  if (peloCfop !== 'nao_informada') {
    return { finalidade: peloCfop, procedencia: `CFOP ${cfop} da nota` };
  }
  const peloCadastro = finalidadeSugerida(tipoProduto);
  if (peloCadastro !== 'nao_informada') {
    return { finalidade: peloCadastro, procedencia: 'cadastro do produto' };
  }
  return { finalidade: 'nao_informada', procedencia: 'nenhuma fonte' };
}
