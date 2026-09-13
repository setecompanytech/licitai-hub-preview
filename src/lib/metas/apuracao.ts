/**
 * A base de apuração de cada número do módulo de Metas.
 *
 * Faturamento, pedidos, recebimentos e contratos **não** têm o mesmo critério
 * de apuração, e a `vw_comercial_realizado_mensal` prova: cada métrica cai num
 * mês por uma DATA DIFERENTE (SQL_MIGRATIONS.md, seção "Realizado mensal por
 * colaborador"). Um contrato assinado em 31/03 e faturado em 02/04 aparece em
 * março numa linha e em abril na outra — os dois estão certos.
 *
 * Enquanto esse critério ficava implícito, a tela convidava a somar e comparar
 * números que medem coisas diferentes: "ganhou 4 e faturou 2" parece queda de
 * desempenho e costuma ser só o calendário. Por isso cada valor exibido carrega
 * a data que o define.
 *
 * Este arquivo é DECLARAÇÃO, não cálculo: ele não apura nada, só nomeia o
 * critério que a view já aplica. As fórmulas continuam inteiras em
 * `painel.ts`, `projecao.ts` e companhia.
 */

import type { BaseMeta } from './painel';

/** As cinco métricas materializadas por `vw_comercial_realizado_mensal`. */
export type MetricaRealizado =
  | 'participados'
  | 'ganhos'
  | 'perdidos'
  | 'pedidos_faturados'
  | 'nfe_quitadas';

export type BaseApuracao = {
  /** Como o número se chama na tela. */
  rotulo: string;
  /** Coluna que decide o mês — a prova de que os critérios divergem. */
  coluna: string;
  /** Linha de metadado, curta o bastante para caber sob o valor. */
  curto: string;
  /** Frase inteira, para legenda e `title`. */
  explicacao: string;
};

export const APURACAO: Record<MetricaRealizado, BaseApuracao> = {
  participados: {
    rotulo: 'Processos participados',
    coluna: 'licitacoes.data_proposta_enviada',
    curto: 'pela data de envio da proposta',
    explicacao:
      'Um processo conta no mês em que a proposta foi enviada — não no mês da sessão nem no da homologação.',
  },
  ganhos: {
    rotulo: 'Contratos ganhos',
    coluna: 'contratos.data_assinatura',
    curto: 'pela data de assinatura do contrato',
    explicacao:
      'O contrato conta no mês em que foi assinado — mesmo que a disputa tenha sido no mês anterior.',
  },
  perdidos: {
    rotulo: 'Processos perdidos',
    coluna: 'comercial_perdas.data_perda',
    curto: 'pela data do registro da perda',
    explicacao:
      'A perda conta no mês em que foi registrada com motivo, e não no mês em que a proposta foi enviada.',
  },
  pedidos_faturados: {
    rotulo: 'Pedidos faturados',
    coluna: 'contrato_pedidos.data_pedido',
    curto: 'pela data do pedido',
    explicacao:
      'O pedido conta no mês da data do pedido — a nota pode ter saído depois, e o contrato ter sido assinado bem antes.',
  },
  nfe_quitadas: {
    rotulo: 'NF-e quitadas',
    coluna: 'contrato_pedidos.data_quitacao',
    curto: 'pela data de quitação da NF-e',
    explicacao:
      'A NF-e conta no mês em que o dinheiro entrou — normalmente depois do mês em que ela foi emitida.',
  },
};

/**
 * Qual métrica da view mede cada base de meta.
 *
 * Existe porque `base_meta` é a escolha de quem define o alvo, e o realizado
 * que a acompanha muda de coluna — e de data — junto com ela.
 */
export const METRICA_DA_BASE: Record<BaseMeta, MetricaRealizado> = {
  contratos_ganhos: 'ganhos',
  faturamento: 'pedidos_faturados',
  nf_quitada: 'nfe_quitadas',
};

/** A base de apuração do realizado que acompanha uma meta. */
export function apuracaoDaBase(base: BaseMeta): BaseApuracao {
  return APURACAO[METRICA_DA_BASE[base]];
}

/** Como a base aparece dentro de uma frase. */
const BASE_EM_TEXTO: Record<BaseMeta, string> = {
  contratos_ganhos: 'sobre contratos ganhos',
  faturamento: 'sobre faturamento',
  nf_quitada: 'sobre NF-e quitada',
};

/**
 * A base de apuração de cada linha de `montarRelatorio`, pelo rótulo.
 *
 * O relatório é montado por `lib/metas/relatorio.ts`, que devolve pares
 * rótulo/valor prontos — mexer nele para carregar metadado mudaria o PDF, a
 * planilha e o snapshot gravado. Então a associação mora aqui, na camada que
 * exibe. Rótulo desconhecido devolve `null`: sem base declarada a tela omite a
 * linha de metadado, e nunca inventa uma errada.
 */
export function apuracaoDoIndicador(rotulo: string, base: BaseMeta): string | null {
  const doRealizado = apuracaoDaBase(base);

  switch (rotulo) {
    case APURACAO.participados.rotulo:
      return APURACAO.participados.curto;
    case APURACAO.ganhos.rotulo:
      return APURACAO.ganhos.curto;
    case APURACAO.perdidos.rotulo:
      return APURACAO.perdidos.curto;
    case APURACAO.pedidos_faturados.rotulo:
      return APURACAO.pedidos_faturados.curto;
    case APURACAO.nfe_quitadas.rotulo:
      return APURACAO.nfe_quitadas.curto;

    // Os quatro números da meta seguem a base escolhida por quem definiu o
    // alvo — o realizado de uma meta sobre faturamento não é o mesmo de uma
    // sobre contratos, nem no valor nem na data.
    case 'Meta do mês':
      return `alvo ${BASE_EM_TEXTO[base]}`;
    case 'Realizado':
    case 'Percentual da meta':
    case 'Projeção de fechamento':
      return doRealizado.curto;

    // O caso mais perigoso da tela: numerador e denominador vêm de datas
    // diferentes, então a taxa de um mês curto pode subir sem ninguém ter
    // vendido mais.
    case 'Taxa de conversão do período':
      return 'ganhos (assinatura) ÷ participados (envio da proposta)';

    // ── O que ainda falta fazer (`sugestoes` de montarRelatorio) ──
    // São alvos, não apurações — mas cada um será COBRADO pela data da
    // métrica correspondente, e é isso que precisa estar escrito.
    case 'Processos a participar':
      return APURACAO.participados.curto;
    case 'Contratos a fechar':
      return APURACAO.ganhos.curto;
    case 'Valor a faturar':
    case 'Ritmo atual':
    case 'Ritmo necessário':
      return doRealizado.curto;
    case 'Dias úteis restantes':
      return 'segunda a sexta, menos os feriados da praça do colaborador';

    // ── Premissas ──
    // As duas conversões dividem números apurados por datas diferentes: é
    // onde o "peras com maçãs" nasce, e onde ele tem que estar declarado.
    case 'Conversão participado → ganho':
      return 'ganhos (assinatura) ÷ participados (envio da proposta)';
    case 'Conversão ganho → faturado':
      return 'faturado (data do pedido) ÷ ganho (assinatura)';
    case 'Ticket médio ponderado':
      return APURACAO.ganhos.curto;

    default:
      return null;
  }
}

/**
 * O aviso que impede a soma indevida. Uma frase, sempre a mesma, ao lado dos
 * números que medem pontas diferentes da mesma esteira.
 */
export const AVISO_CRITERIOS_DISTINTOS =
  'Cada número tem a própria data de apuração — eles medem pontas diferentes do mês e não se somam.';
