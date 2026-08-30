import { diasEntre } from '@/lib/financeiro/transferencia-propria';

/**
 * Casar um pedido com títulos que JÁ existem no Financeiro.
 *
 * Quando a empresa adere ao sistema com contrato em andamento, os pedidos
 * antigos precisam ser cadastrados para que saldo, consumo e itens fiquem
 * certos. Mas os recebimentos desses pedidos já estão no Financeiro —
 * importados por OFX, conciliados, ou digitados.
 *
 * Cadastrar o pedido gerando conta a receber duplica a receita. Cadastrar sem
 * gerar deixa o título existente órfão: sem `contrato_pedido_id` ele não conta
 * como faturamento daquele contrato, e o pedido nunca recebe `data_quitacao`,
 * que é o que alimenta a meta de quitação.
 *
 * A saída é a mesma de `useCasarTransferencia`: em vez de criar um terceiro
 * registro, **casar dois que já existem**.
 *
 * Um pedido pode corresponder a VÁRIOS títulos — quem faturou em parcelas tem
 * três linhas no Financeiro para um pedido só. Por isso a seleção é múltipla e
 * a conferência é sobre a SOMA.
 */

export type PedidoParaCasar = {
  id: string;
  numero_pedido: string;
  valor_total: number;
  data_pedido: string | null;
  nota_fiscal: string | null;
};

export type TituloCandidato = {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string | null;
  numero_documento: string | null;
  status: string;
  /** Já está preso a outro pedido? Então não é candidato. */
  contrato_pedido_id: string | null;
  /** Já aponta para o mesmo contrato? Evidência forte. */
  contrato_id: string | null;
};

export type Pontuacao = {
  pontos: number;
  motivos: string[];
};

/** Texto sem acento, caixa baixa, para comparar descrição. */
const simples = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Só dígitos — para casar "NF 000123" com "123" e com "nº 123". */
const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D+/g, '');

/**
 * O quanto este título parece ser deste pedido.
 *
 * A pontuação é aberta de propósito: o diálogo mostra os motivos ao lado de
 * cada candidato, para quem decide ver POR QUE o sistema sugeriu — e discordar
 * quando for o caso. Sugestão sem justificativa vira carimbo automático.
 */
export function pontuarCandidato(pedido: PedidoParaCasar, titulo: TituloCandidato): Pontuacao {
  const motivos: string[] = [];
  let pontos = 0;

  // Já preso a outro pedido: não é candidato, e a pontuação diz isso com zero.
  if (titulo.contrato_pedido_id && titulo.contrato_pedido_id !== pedido.id) {
    return { pontos: 0, motivos: ['já vinculado a outro pedido'] };
  }

  // ── Valor ──────────────────────────────────────────────────────────────────
  const dif = Math.abs(titulo.valor - pedido.valor_total);
  if (dif < 0.005) {
    pontos += 50;
    motivos.push('valor idêntico');
  } else if (titulo.valor < pedido.valor_total) {
    // Menor que o pedido é o caso da PARCELA — não é desvio, é fatia. Vale
    // menos que o valor cheio, mas continua sendo candidato legítimo.
    pontos += 20;
    motivos.push('valor menor — possível parcela');
  } else {
    // Maior que o pedido não tem leitura boa: ou é outro pedido, ou junta
    // vários. Pontua pouco e o motivo aparece na tela.
    pontos += 5;
    motivos.push('valor maior que o pedido');
  }

  // ── Número do pedido ou da NF na descrição ────────────────────────────────
  // É a evidência mais forte que existe: quem lançou escreveu o número.
  const alvo = simples(`${titulo.descricao} ${titulo.numero_documento ?? ''}`);
  const numPedido = digitos(pedido.numero_pedido);
  const numNota = digitos(pedido.nota_fiscal);

  if (numPedido.length >= 3 && digitos(alvo).includes(numPedido)) {
    pontos += 30;
    motivos.push(`descrição cita o pedido ${pedido.numero_pedido}`);
  }
  if (numNota.length >= 3 && digitos(alvo).includes(numNota)) {
    pontos += 30;
    motivos.push(`descrição cita a NF ${pedido.nota_fiscal}`);
  }

  // ── Mesmo contrato ────────────────────────────────────────────────────────
  if (titulo.contrato_id) {
    pontos += 15;
    motivos.push('já aponta para este contrato');
  }

  // ── Proximidade de data ───────────────────────────────────────────────────
  // Faturamento não sai no dia do pedido. Trinta dias é a janela usual entre
  // pedido e nota; passar disso não elimina, só deixa de somar.
  if (pedido.data_pedido && titulo.data_competencia) {
    const d = diasEntre(pedido.data_pedido, titulo.data_competencia);
    if (d === 0) {
      pontos += 15;
      motivos.push('mesma data');
    } else if (d <= 30) {
      pontos += 10;
      motivos.push(`${d} dia(s) do pedido`);
    } else if (d <= 90) {
      pontos += 3;
      motivos.push(`${d} dias do pedido`);
    }
  }

  return { pontos, motivos };
}

/**
 * A partir de quantos pontos vale INTERROMPER alguém com uma sugestão.
 *
 * Cinquenta é exatamente o que "valor idêntico" vale sozinho. Abaixo disso a
 * sugestão nasceria de proximidade de data — que todo título do mês satisfaz —
 * e viraria aviso constante, do tipo que se aprende a fechar sem ler.
 *
 * Aparecer na LISTA do diálogo é outra coisa: ali basta pontuar acima de zero,
 * porque quem abriu já está procurando.
 */
export const PONTOS_PARA_SUGERIR = 50;

/** Candidatos ordenados do mais provável ao menos, sem os impossíveis. */
export function ordenarCandidatos(
  pedido: PedidoParaCasar,
  titulos: TituloCandidato[],
): Array<TituloCandidato & Pontuacao> {
  return titulos
    .map((t) => ({ ...t, ...pontuarCandidato(pedido, t) }))
    .filter((t) => t.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);
}

export type ConferenciaDaSoma = {
  soma: number;
  diferenca: number;
  /** Fecha com o valor do pedido, dentro de um centavo? */
  fecha: boolean;
  frase: string;
};

/**
 * A soma dos títulos escolhidos bate com o pedido?
 *
 * É a única checagem que impede o erro caro: vincular a parcela errada, ou
 * esquecer uma das três. O diálogo mostra o resultado antes de deixar salvar —
 * mas não bloqueia, porque desconto, retenção e glosa fazem a soma divergir
 * legitimamente. Quem decide precisa VER a diferença, não ser impedido por
 * ela.
 */
export function conferirSoma(pedido: PedidoParaCasar, selecionados: TituloCandidato[]): ConferenciaDaSoma {
  const soma = selecionados.reduce((s, t) => s + Number(t.valor || 0), 0);
  const diferenca = Number((soma - pedido.valor_total).toFixed(2));
  const fecha = Math.abs(diferenca) < 0.005;

  if (selecionados.length === 0) {
    return { soma: 0, diferenca: -pedido.valor_total, fecha: false, frase: 'Nenhum lançamento selecionado' };
  }
  if (fecha) {
    return { soma, diferenca, fecha, frase: `Soma confere com o pedido${selecionados.length > 1 ? ` (${selecionados.length} parcelas)` : ''}` };
  }
  return {
    soma,
    diferenca,
    fecha,
    frase: diferenca < 0
      ? `Faltam ${Math.abs(diferenca).toFixed(2)} para fechar o pedido — desconto, retenção ou parcela que falta?`
      : `Excedem ${diferenca.toFixed(2)} o valor do pedido — algum lançamento pode não ser deste pedido`,
  };
}

/**
 * A quitação volta do título para o pedido.
 *
 * O pedido é a ponta da esteira que a meta de quitação mede. Se o título já
 * está conciliado, a data em que o dinheiro entrou tem de voltar para cá —
 * senão o vínculo conserta o relatório de contrato e deixa a meta cega.
 *
 * Com várias parcelas, quita quando TODAS estiverem conciliadas, e a data é a
 * da última: o pedido só está pago quando não falta parcela.
 */
export function quitacaoDoPedido(
  titulos: Array<{ status: string; data_competencia: string | null }>,
): { nf_quitada: boolean; data_quitacao: string | null } {
  if (titulos.length === 0) return { nf_quitada: false, data_quitacao: null };
  const todasPagas = titulos.every((t) => t.status === 'realizado' || t.status === 'conciliado');
  if (!todasPagas) return { nf_quitada: false, data_quitacao: null };
  const datas = titulos.map((t) => t.data_competencia).filter((d): d is string => !!d).sort();
  return { nf_quitada: true, data_quitacao: datas[datas.length - 1] ?? null };
}
