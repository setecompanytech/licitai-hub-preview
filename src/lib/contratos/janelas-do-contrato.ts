/**
 * As JANELAS do contrato: o saldo por período de vigência (30/09/2026).
 *
 * O saldo do contrato era um pote único: toda linha de termo aplicada somava
 * quantidade, sem olhar tipo nem período. Uma renovação (art. 107) virava
 * acréscimo, e o 772/2024 oferecia 196.924 unidades quando o período corrente
 * tem 67.508. O dono resumiu: "o sistema duplica as quantidades".
 *
 * A regra certa: o contrato é estimativo e cada período tem a SUA quantidade.
 * Cada termo abre uma janela de tempo. Uma renovação abre um PERÍODO novo e
 * repõe as quantidades; um reequilíbrio troca preços dentro do período e vale
 * para o que restava; uma alteração quantitativa acresce ou suprime. O que
 * sobrou de um período encerrado é "não executado" — nunca entra no período
 * seguinte. E o sistema não decide que caducou: ele MOSTRA o restante, que vai
 * mudando enquanto o dono alimenta os empenhos e as notas daquele período.
 *
 * Quem consome é o pedido (OF ou parte de nota). Ele cai na janela do termo
 * que carimba (`origem_aditivo_id`, obrigatório no Contas a Receber) e, sem
 * carimbo, na janela da sua data. O empenho RESERVA: aparece por janela como
 * "empenhado a faturar", sem baixar quantidade por item (o empenho não é por
 * item).
 *
 * Puro: a tela chama; a função de banco `recalcular_saldos_itens_do_contrato`
 * aplica a mesma regra para `saldo_quantitativo` (período corrente).
 */
import { dataDoTermo } from './preco-na-data';
import { rotuloCurtoDoTermo } from './itens-do-termo';

export type TermoDaJanela = {
  id: string;
  numero_aditivo: string | null;
  tipo?: string | null;
  data_efeitos?: string | null;
  data_assinatura?: string | null;
  data_aditivo?: string | null;
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  nova_data_fim?: string | null;
  quantidade_acrescimo?: number | string | null;
  quantidade_supressao?: number | string | null;
  valor_acrescimo?: number | string | null;
  valor_supressao?: number | string | null;
};

export type LinhaDaJanela = {
  aditivo_id: string;
  contrato_item_id: string;
  valor_unitario_novo: number | string | null;
  valor_unitario_anterior: number | string | null;
  quantidade_acrescimo: number | string | null;
  quantidade_supressao: number | string | null;
  aplicado_em: string | null;
};

export type ItemDaJanela = {
  id: string;
  codigo_item?: string | null;
  descricao?: string;
  quantidade_contratada: number | string | null;
  valor_unitario: number | string | null;
  valor_unitario_original?: number | string | null;
};

export type PedidoDaJanela = {
  id?: string;
  contrato_item_id: string | null;
  quantidade: number | string | null;
  valor_total: number | string | null;
  data_pedido: string | null;
  origem_aditivo_id?: string | null;
  status?: string | null;
  empenho_id?: string | null;
};

export type EmpenhoDaJanela = {
  id: string;
  numero?: string | null;
  quantidade: number | string | null;
  valor: number | string | null;
  data_emissao: string | null;
  origem_aditivo_id?: string | null;
};

export type ContratoDaJanela = {
  data_inicio?: string | null;
  data_fim?: string | null;
  data_assinatura?: string | null;
};

export type TipoDaJanela = 'original' | 'prorrogacao' | 'preco' | 'quantidade' | 'outro';

export type Janela = {
  /** 'original' ou o id do termo. */
  id: string;
  rotulo: string;
  rotuloCurto: string;
  tipo: TipoDaJanela;
  inicio: string | null;
  fim: string | null;
  /** Índice do período (0 = o da contratação). */
  periodo: number;
  abrePeriodo: boolean;
  encerrada: boolean;
  corrente: boolean;
  /** Renovação registrada sem período: tratada como acréscimo dentro do período, com aviso. */
  semPeriodo: boolean;
};

export type Periodo = {
  indice: number;
  rotulo: string;
  inicio: string | null;
  fim: string | null;
  janelas: string[];
  encerrado: boolean;
  corrente: boolean;
};

export type CelulaDaJanela = {
  /** Quantidade disponível ao abrir a janela (reposta, ou restante do período). */
  quantidade: number;
  /** Quem definiu a quantidade: a própria janela ("2º TA") ou a anterior. */
  origemQtd: string;
  preco: number;
  precoAnterior: number | null;
  deltaPct: number | null;
  /** Quem definiu o preço: a janela que o mudou por último. */
  origemPreco: string;
  precoMudouAqui: boolean;
  consumido: number;
  consumidoRS: number;
  saldo: number;
  /** O que a janela vale: período novo = quantidade × preço; reequilíbrio = Δ × quantidade; acréscimo = acrescido × preço. */
  valor: number;
};

export type SaldoDoPeriodo = { indice: number; quantidade: number; consumido: number; saldo: number; encerrado: boolean };

export type VidaDoItem = {
  contratado: number;
  consumido: number;
  consumidoRS: number;
  naoExecutado: number;
  saldoCorrente: number;
  precoVigente: number;
  precoOriginal: number;
  contratadoRS: number;
  porPeriodo: SaldoDoPeriodo[];
};

export type TotaisDaJanela = {
  valor: number;
  consumidoUn: number;
  consumidoRS: number;
  empenhadoUn: number;
  empenhadoRS: number;
  faturadoDosEmpenhosRS: number;
  aFaturarRS: number;
  empenhos: number;
};

export type VisaoDoContrato = {
  janelas: Janela[];
  periodos: Periodo[];
  porItem: Map<string, { porJanela: Map<string, CelulaDaJanela>; vida: VidaDoItem }>;
  totais: {
    porJanela: Map<string, TotaisDaJanela>;
    vida: { contratadoRS: number; executadoRS: number; naoExecutadoRS: number; saldoCorrenteRS: number; empenhadoAFaturarRS: number };
  };
  /** Pedidos sem item: contam no R$ da janela, nunca em quantidade por item. */
  pedidosSemItem: number;
};

const n = (v: number | string | null | undefined) => {
  const x = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(x as number) ? (x as number) : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/** O dia anterior, em ISO. */
export function diaAnterior(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function tipoDaJanela(t: TermoDaJanela, linhasDoTermo: LinhaDaJanela[]): TipoDaJanela {
  if (t.tipo === 'prorrogacao') return 'prorrogacao';
  const mudaPreco = linhasDoTermo.some((l) => l.valor_unitario_novo != null && n(l.valor_unitario_novo) > 0 && n(l.valor_unitario_novo) !== n(l.valor_unitario_anterior));
  const mudaQtd = linhasDoTermo.some((l) => n(l.quantidade_acrescimo) > 0 || n(l.quantidade_supressao) > 0) || n(t.quantidade_acrescimo) > 0 || n(t.quantidade_supressao) > 0;
  if (mudaPreco && !mudaQtd) return 'preco';
  if (mudaQtd && !mudaPreco) return 'quantidade';
  if (['reequilibrio', 'reajuste', 'revisao', 'repactuacao'].includes(String(t.tipo ?? ''))) return 'preco';
  if (['acrescimo', 'supressao', 'quantidade', 'valor'].includes(String(t.tipo ?? ''))) return 'quantidade';
  return 'outro';
}

/** Em que janela cai uma data: a última que começou até ela; antes da primeira, a original. */
export function janelaDaData(janelas: Janela[], data: string | null | undefined): Janela {
  const d = dia(data);
  if (!d) return janelas[0];
  let achada = janelas[0];
  for (const j of janelas) {
    if (j.inicio && j.inicio <= d) achada = j;
  }
  return achada;
}

/** A janela de um lançamento: o carimbo do termo manda; sem carimbo, a data. */
export function janelaDoLancamento(janelas: Janela[], origemAditivoId: string | null | undefined, data: string | null | undefined): Janela {
  if (origemAditivoId) {
    const j = janelas.find((x) => x.id === origemAditivoId);
    if (j) return j;
  }
  return janelaDaData(janelas, data);
}

export function janelasDoContrato(
  contrato: ContratoDaJanela,
  termos: TermoDaJanela[],
  linhas: LinhaDaJanela[],
  itens: ItemDaJanela[],
  pedidos: PedidoDaJanela[],
  empenhos: EmpenhoDaJanela[] = [],
  hoje: string = new Date().toISOString().slice(0, 10),
): VisaoDoContrato {
  const aplicadas = linhas.filter((l) => l.aplicado_em);
  const linhasPorTermo = new Map<string, LinhaDaJanela[]>();
  for (const l of aplicadas) (linhasPorTermo.get(l.aditivo_id) ?? linhasPorTermo.set(l.aditivo_id, []).get(l.aditivo_id)!).push(l);

  // ── As janelas, na ordem do tempo ─────────────────────────────────────
  const inicioDoTermo = (t: TermoDaJanela) =>
    (t.tipo === 'prorrogacao' && t.periodo_inicio ? dia(t.periodo_inicio) : null) ?? dataDoTermo(t);
  const ordenados = [...termos].sort((a, b) => String(inicioDoTermo(a) ?? '').localeCompare(String(inicioDoTermo(b) ?? '')));

  const janelas: Janela[] = [{
    id: 'original', rotulo: 'Contrato Original', rotuloCurto: 'Original', tipo: 'original',
    inicio: dia(contrato.data_inicio) ?? dia(contrato.data_assinatura), fim: null, periodo: 0, abrePeriodo: true,
    encerrada: false, corrente: false, semPeriodo: false,
  }];
  let periodoAtual = 0;
  for (const t of ordenados) {
    const tipo = tipoDaJanela(t, linhasPorTermo.get(t.id) ?? []);
    const abre = tipo === 'prorrogacao' && !!t.periodo_inicio;
    if (abre) periodoAtual += 1;
    janelas.push({
      id: t.id,
      rotulo: t.numero_aditivo?.trim() || 'Termo aditivo',
      rotuloCurto: rotuloCurtoDoTermo(t.numero_aditivo),
      tipo, inicio: inicioDoTermo(t), fim: null, periodo: periodoAtual, abrePeriodo: abre,
      encerrada: false, corrente: false, semPeriodo: tipo === 'prorrogacao' && !t.periodo_inicio,
    });
  }
  // O fim de cada janela é a véspera da próxima; a última vai até o fim do contrato.
  const fimDoContrato = dia(contrato.data_fim)
    ?? dia(ordenados.map((t) => t.periodo_fim ?? t.nova_data_fim).filter(Boolean).sort().pop() ?? null);
  for (let i = 0; i < janelas.length; i++) {
    const prox = janelas[i + 1];
    janelas[i].fim = prox?.inicio ? diaAnterior(prox.inicio) : fimDoContrato;
  }

  // ── Os períodos ───────────────────────────────────────────────────────
  const periodos: Periodo[] = [];
  for (const j of janelas) {
    if (j.abrePeriodo) {
      periodos.push({ indice: j.periodo, rotulo: j.periodo === 0 ? 'Período da contratação' : `Período do ${j.rotuloCurto}`, inicio: j.inicio, fim: j.fim, janelas: [j.id], encerrado: false, corrente: false });
    } else {
      const p = periodos[periodos.length - 1];
      p.janelas.push(j.id);
      p.fim = j.fim;
    }
  }
  // Período corrente: o que contém hoje; depois do último, o último; antes do primeiro, o primeiro.
  let corrente = periodos.findIndex((p) => (!p.inicio || p.inicio <= hoje) && (!p.fim || hoje <= p.fim));
  if (corrente < 0) corrente = periodos[0].inicio && periodos[0].inicio > hoje ? 0 : periodos.length - 1;
  for (const p of periodos) {
    p.corrente = p.indice === corrente;
    p.encerrado = !p.corrente && !!p.fim && p.fim < hoje;
  }
  for (const j of janelas) {
    const p = periodos[j.periodo];
    j.corrente = p.corrente && p.janelas[p.janelas.length - 1] === j.id;
    j.encerrada = !!j.fim && j.fim < hoje && !j.corrente;
  }

  // ── Consumo e empenhos por janela ─────────────────────────────────────
  const consumoPorJanelaItem = new Map<string, { un: number; rs: number }>();
  const consumoPorJanela = new Map<string, { un: number; rs: number }>();
  const pedidoNaJanela = new Map<string, string>();
  let pedidosSemItem = 0;
  for (const p of pedidos) {
    if (p.status === 'cancelado') continue;
    const j = janelaDoLancamento(janelas, p.origem_aditivo_id, p.data_pedido);
    if (p.id) pedidoNaJanela.set(p.id, j.id);
    const tot = consumoPorJanela.get(j.id) ?? { un: 0, rs: 0 };
    tot.un += n(p.quantidade); tot.rs += n(p.valor_total);
    consumoPorJanela.set(j.id, tot);
    if (!p.contrato_item_id) { pedidosSemItem += 1; continue; }
    const k = `${j.id}|${p.contrato_item_id}`;
    const c = consumoPorJanelaItem.get(k) ?? { un: 0, rs: 0 };
    c.un += n(p.quantidade); c.rs += n(p.valor_total);
    consumoPorJanelaItem.set(k, c);
  }
  const empenhosPorJanela = new Map<string, { un: number; rs: number; ids: Set<string>; qtd: number }>();
  for (const e of empenhos) {
    const j = janelaDoLancamento(janelas, e.origem_aditivo_id, e.data_emissao);
    const t = empenhosPorJanela.get(j.id) ?? { un: 0, rs: 0, ids: new Set<string>(), qtd: 0 };
    t.un += n(e.quantidade); t.rs += n(e.valor); t.ids.add(e.id); t.qtd += 1;
    empenhosPorJanela.set(j.id, t);
  }
  const faturadoPorEmpenho = new Map<string, number>();
  for (const p of pedidos) {
    if (p.status === 'cancelado' || !p.empenho_id) continue;
    faturadoPorEmpenho.set(p.empenho_id, (faturadoPorEmpenho.get(p.empenho_id) ?? 0) + n(p.valor_total));
  }

  // ── Item a item, janela a janela ──────────────────────────────────────
  const somaContratada = itens.reduce((s, i) => s + n(i.quantidade_contratada), 0);
  const porItem = new Map<string, { porJanela: Map<string, CelulaDaJanela>; vida: VidaDoItem }>();
  const totaisPorJanela = new Map<string, TotaisDaJanela>();
  for (const j of janelas) {
    const emp = empenhosPorJanela.get(j.id);
    const faturadoDosEmpenhos = emp ? [...emp.ids].reduce((s, id) => s + (faturadoPorEmpenho.get(id) ?? 0), 0) : 0;
    const cons = consumoPorJanela.get(j.id);
    totaisPorJanela.set(j.id, {
      valor: 0, consumidoUn: cons?.un ?? 0, consumidoRS: r2(cons?.rs ?? 0),
      empenhadoUn: emp?.un ?? 0, empenhadoRS: r2(emp?.rs ?? 0), faturadoDosEmpenhosRS: r2(faturadoDosEmpenhos),
      aFaturarRS: r2(Math.max((emp?.rs ?? 0) - faturadoDosEmpenhos, 0)), empenhos: emp?.qtd ?? 0,
    });
  }

  for (const item of itens) {
    const porJanela = new Map<string, CelulaDaJanela>();
    const linhasDoItem = aplicadas.filter((l) => l.contrato_item_id === item.id);
    const precoOriginal = item.valor_unitario_original != null && n(item.valor_unitario_original) > 0
      ? n(item.valor_unitario_original)
      : (() => {
          const primeira = ordenados.map((t) => linhasDoItem.find((l) => l.aditivo_id === t.id && l.valor_unitario_novo != null)).find(Boolean);
          return primeira && primeira.valor_unitario_anterior != null ? n(primeira.valor_unitario_anterior) : n(item.valor_unitario);
        })();

    let anterior: CelulaDaJanela | null = null;
    let contratado = 0;
    let contratadoRS = 0;
    for (const j of janelas) {
      const termo = j.id === 'original' ? null : termos.find((t) => t.id === j.id) ?? null;
      const linhasDoTermo = termo ? linhasPorTermo.get(termo.id) ?? [] : [];
      const linha = termo ? linhasDoItem.find((l) => l.aditivo_id === termo.id) ?? null : null;
      const termoSemLinhas = !!termo && linhasDoTermo.length === 0;
      const proporcao = somaContratada > 0 ? n(item.quantidade_contratada) / somaContratada : 0;

      // Quantidade
      let quantidade: number;
      let origemQtd: string;
      let acrescido = 0;
      if (j.id === 'original') {
        quantidade = n(item.quantidade_contratada);
        origemQtd = j.rotuloCurto;
      } else if (j.abrePeriodo) {
        // Renovação: repõe. Com linhas, a linha do item; sem linhas, a quantidade
        // do termo rateada pela contratada (ou a própria contratada, reposição integral).
        quantidade = linha
          ? n(linha.quantidade_acrescimo) - n(linha.quantidade_supressao)
          : termoSemLinhas && n(termo!.quantidade_acrescimo) > 0
            ? n(termo!.quantidade_acrescimo) * proporcao
            : termoSemLinhas ? n(item.quantidade_contratada) : 0;
        origemQtd = j.rotuloCurto;
      } else {
        acrescido = linha
          ? n(linha.quantidade_acrescimo) - n(linha.quantidade_supressao)
          : termoSemLinhas ? (n(termo!.quantidade_acrescimo) - n(termo!.quantidade_supressao)) * proporcao : 0;
        quantidade = (anterior?.saldo ?? 0) + acrescido;
        origemQtd = acrescido !== 0 ? `${anterior?.origemQtd ?? ''} + ${j.rotuloCurto}` : (anterior?.origemQtd ?? j.rotuloCurto);
      }

      // Preço
      const precoAnterior = anterior ? anterior.preco : null;
      let preco = anterior ? anterior.preco : precoOriginal;
      let origemPreco = anterior ? anterior.origemPreco : 'contratação';
      let mudou = false;
      if (linha && linha.valor_unitario_novo != null && n(linha.valor_unitario_novo) > 0 && Math.abs(n(linha.valor_unitario_novo) - preco) >= 0.005) {
        preco = n(linha.valor_unitario_novo);
        origemPreco = j.rotuloCurto;
        mudou = true;
      }
      const deltaPct = mudou && precoAnterior ? r2(((preco - precoAnterior) / precoAnterior) * 100) : null;

      const c = consumoPorJanelaItem.get(`${j.id}|${item.id}`);
      const consumido = c?.un ?? 0;
      const saldo = quantidade - consumido;
      const valor = j.abrePeriodo
        ? r2(quantidade * preco)
        : r2((mudou && precoAnterior != null ? (preco - precoAnterior) * quantidade : 0) + acrescido * preco);
      if (j.abrePeriodo) contratado += quantidade; else contratado += acrescido;
      contratadoRS += valor;

      const cel: CelulaDaJanela = { quantidade, origemQtd, preco, precoAnterior, deltaPct, origemPreco, precoMudouAqui: mudou, consumido, consumidoRS: r2(c?.rs ?? 0), saldo, valor };
      porJanela.set(j.id, cel);
      totaisPorJanela.get(j.id)!.valor = r2(totaisPorJanela.get(j.id)!.valor + valor);
      anterior = cel;
    }

    const porPeriodo: SaldoDoPeriodo[] = periodos.map((p) => {
      const ultima = porJanela.get(p.janelas[p.janelas.length - 1])!;
      const primeira = porJanela.get(p.janelas[0])!;
      let consumidoNoPeriodo = 0;
      let acrescidoNoPeriodo = 0;
      p.janelas.forEach((id, i) => {
        const cel = porJanela.get(id)!;
        consumidoNoPeriodo += cel.consumido;
        if (i > 0) acrescidoNoPeriodo += cel.quantidade - porJanela.get(p.janelas[i - 1])!.saldo;
      });
      return { indice: p.indice, quantidade: primeira.quantidade + acrescidoNoPeriodo, consumido: consumidoNoPeriodo, saldo: ultima.saldo, encerrado: p.encerrado };
    });
    const consumidoVida = [...porJanela.values()].reduce((s, c) => s + c.consumido, 0);
    const consumidoRSVida = [...porJanela.values()].reduce((s, c) => s + c.consumidoRS, 0);
    const naoExecutado = porPeriodo.filter((p) => p.encerrado).reduce((s, p) => s + Math.max(p.saldo, 0), 0);
    const saldoCorrente = porPeriodo.find((p) => p.indice === corrente)?.saldo ?? 0;
    const ultima = porJanela.get(janelas[janelas.length - 1].id)!;
    porItem.set(item.id, {
      porJanela,
      vida: { contratado, consumido: consumidoVida, consumidoRS: r2(consumidoRSVida), naoExecutado, saldoCorrente, precoVigente: ultima.preco, precoOriginal, contratadoRS: r2(contratadoRS), porPeriodo },
    });
  }

  const vidas = [...porItem.values()].map((x) => x.vida);
  const totaisVida = {
    contratadoRS: r2(vidas.reduce((s, v) => s + v.contratadoRS, 0)),
    executadoRS: r2([...consumoPorJanela.values()].reduce((s, c) => s + c.rs, 0)),
    naoExecutadoRS: r2([...porItem.values()].reduce((s, x) => {
      // Não executado ao preço da última janela de cada período encerrado.
      let soma = 0;
      for (const p of periodos) {
        if (!p.encerrado) continue;
        const ultima = x.porJanela.get(p.janelas[p.janelas.length - 1])!;
        soma += Math.max(ultima.saldo, 0) * ultima.preco;
      }
      return s + soma;
    }, 0)),
    saldoCorrenteRS: r2([...porItem.values()].reduce((s, x) => {
      const p = periodos[corrente];
      const ultima = x.porJanela.get(p.janelas[p.janelas.length - 1])!;
      return s + Math.max(ultima.saldo, 0) * ultima.preco;
    }, 0)),
    empenhadoAFaturarRS: r2([...totaisPorJanela.values()].reduce((s, t) => s + t.aFaturarRS, 0)),
  };

  return { janelas, periodos, porItem, totais: { porJanela: totaisPorJanela, vida: totaisVida }, pedidosSemItem };
}

/** "Preço: 1º TA · Qtd: 3º TA" — o selo da coluna Situação numa janela. */
export function rotuloDaSituacao(cel: CelulaDaJanela): string {
  const preco = cel.origemPreco === 'contratação' ? 'contratação' : cel.origemPreco;
  return `Preço: ${preco} · Qtd: ${cel.origemQtd}`;
}
