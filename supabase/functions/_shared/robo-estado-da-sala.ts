/**
 * O estado da sala que o robô envia, lido para pessoas (D13, 16/09/2026).
 *
 * O agente manda, a cada mudança (ou a cada 30 s), o que viu na sala: melhor
 * lance, nosso lance, posição, liderança, modo, fase e a decisão da rodada com
 * o motivo. Este módulo decide duas coisas, puras e testadas
 * (`src/components/robo-lances/test/estado-da-sala.test.ts`):
 *
 *   1. o MOTIVO em linguagem de cliente — o agente escreve para o log
 *      ("Portal comprasgov nao esta liberado... souLider()"), e a tela da
 *      disputa é lida pelo cliente;
 *   2. quais EVENTOS entram na linha do tempo — só o que muda algo para quem
 *      acompanha. O estado chega a cada 30 s; uma linha por envio seria ruído.
 */

export type DecisaoDaRodada = {
  acao?: "lance" | "aguardar" | "encerrar" | string;
  valor?: number | null;
  motivo?: string | null;
  motivo_legivel?: string | null;
};

export type EstadoDaSala = {
  item?: number | null;
  melhor_lance?: number | null;
  nosso_lance?: number | null;
  posicao?: number | null;
  sou_lider?: boolean | null;
  tem_proposta?: boolean | null;
  propostas_validas?: number | null;
  desclassificadas?: number | null;
  nossa_desclassificada?: boolean | null;
  modo?: string | null;
  intervalo_minimo?: number | null;
  fase?: string | null;
  segundos_restantes?: number | null;
  estrategia?: string | null;
  decisao?: DecisaoDaRodada | null;
  lances_enviados?: number | null;
  rodada?: number | null;
};

export type EventoDaSala = {
  tipo: string;
  mensagem: string;
  item: number | null;
  dados: Record<string, unknown>;
};

const ROTULO_DA_FASE: Record<string, string> = {
  aguardando: "aguardando abrir",
  aberta: "etapa aberta",
  encerramento_aleatorio: "encerramento aleatório",
  fechada: "lance final fechado",
  desempate_me_epp: "desempate de ME/EPP",
  suspensa: "suspensa pelo pregoeiro",
  encerrada: "encerrada",
};

/** A coluna `situacao` de `sessao_lance_itens`, pelo que a sala mostra. */
export function situacaoDoItem(fase: string | null | undefined): "aguardando" | "disputando" | "encerrado" {
  if (fase === "encerrada") return "encerrado";
  if (fase === "aberta" || fase === "encerramento_aleatorio" || fase === "fechada" || fase === "desempate_me_epp") {
    return "disputando";
  }
  return "aguardando";
}

/**
 * O porquê da decisão, em linguagem de quem acompanha a disputa.
 *
 * Usa o estado inteiro, e não só o texto do agente: "o portal não informou
 * quem lidera" quer dizer coisas diferentes com e sem proposta da empresa.
 * Motivo que não está mapeado passa como veio — melhor um texto técnico do que
 * nenhum.
 */
export function motivoParaPessoas(estado: EstadoDaSala): string | null {
  const decisao = estado.decisao || {};
  const motivo = String(decisao.motivo || "");
  if (decisao.acao === "lance") return "Enviando lance";
  if (!motivo) return null;

  if (/modo automatico desligado/i.test(motivo)) {
    return "Modo automático desligado nesta disputa: o robô acompanha e não dá lance";
  }
  if (/campo de lance deste item nao esta na tela/i.test(motivo)) {
    return "Lance decidido, mas o campo de lance deste item não está na tela do robô — acompanhando";
  }
  if (/nao esta liberado para enviar lance/i.test(motivo)) {
    return "Só acompanhando: o envio de lances ainda não foi liberado para este portal";
  }
  if (estado.nossa_desclassificada) return "A proposta da empresa está desclassificada neste item — o robô não disputa";
  if (estado.tem_proposta === false) return "A empresa não tem proposta neste item — o robô só acompanha";
  if (/o portal n[ãa]o informou quem est[áa] liderando/i.test(motivo)) {
    return "Não foi possível confirmar a posição da empresa neste item";
  }
  if (/j[áa] estamos liderando/i.test(motivo)) return "A empresa está em 1º lugar — nada a cobrir";
  if (/n[ãa]o foi poss[íi]vel ler o melhor lance/i.test(motivo)) return "Não foi possível ler o melhor lance no portal";
  if (/sem valor minimo \(piso\)/i.test(motivo)) return "Item sem piso: o robô não disputa sem valor mínimo";
  if (/tempo restante nao foi lido/i.test(motivo)) return "Iminência: aguardando a leitura do tempo restante da disputa";
  const faltam = motivo.match(/iminencia: faltam (\d+) s/i);
  if (faltam) return `Iminência: faltam ${faltam[1]} s — o robô age nos 2 minutos finais`;
  if (/nao persegue/i.test(motivo)) return "Desempatar no 1º lugar: o 1º colocado está além da margem configurada";
  if (/precisa da margem em reais/i.test(motivo)) return "Desempatar no 1º lugar: falta a margem do item";
  if (/lance final fechado precisa de valor/i.test(motivo)) return "Lance final fechado: falta o valor definido pela empresa";
  if (/Disputa suspensa/i.test(motivo)) return "Disputa suspensa pelo pregoeiro";
  if (/ainda nao abriu/i.test(motivo)) return "A disputa deste item ainda não abriu";
  return motivo;
}

const reais = (formatar: (n: number) => string, n: number | null | undefined) =>
  Number.isFinite(n as number) ? `R$ ${formatar(n as number)}` : null;

/**
 * O que entra na linha do tempo, comparando o estado anterior com o novo.
 *
 * Entra: o primeiro retrato da sala; assumir ou perder o 1º lugar; mudar de
 * posição; a proposta da empresa ser desclassificada; a fase mudar; e o robô
 * passar a aguardar por um motivo NOVO. Não entra: o mesmo estado repetido, o
 * relógio andando, o melhor lance oscilando sem mexer na posição da empresa —
 * esse já vira "lance de concorrente" no histórico de lances.
 */
export function eventosDoEstado(
  anterior: EstadoDaSala | null | undefined,
  novo: EstadoDaSala,
  formatar: (n: number) => string,
): EventoDaSala[] {
  const item = Number.isFinite(novo.item as number) ? (novo.item as number) : null;
  const eventos: EventoDaSala[] = [];
  const add = (tipo: string, mensagem: string, dados: Record<string, unknown> = {}) =>
    eventos.push({ tipo, mensagem, item, dados });
  const melhor = reais(formatar, novo.melhor_lance);
  const nosso = reais(formatar, novo.nosso_lance);
  const legivel = novo.decisao?.motivo_legivel ?? motivoParaPessoas(novo);

  if (!anterior) {
    const onde = novo.nossa_desclassificada
      ? "a proposta da empresa está desclassificada"
      : novo.tem_proposta === false
        ? "a empresa não tem proposta neste item"
        : Number.isFinite(novo.posicao as number)
          ? `empresa em ${novo.posicao}º lugar${nosso ? ` (${nosso})` : ""}`
          : null;
    const partes = [onde, melhor ? `melhor ${melhor}` : null, novo.modo ? `modo ${novo.modo}` : null].filter(Boolean);
    add("acompanhando", `Robô acompanhando o item ${item ?? "?"}${partes.length ? " — " + partes.join(" · ") : ""}`, {
      posicao: novo.posicao ?? null,
      melhor_lance: novo.melhor_lance ?? null,
      nosso_lance: novo.nosso_lance ?? null,
    });
    if (novo.decisao?.acao === "aguardar" && legivel) add("aguardando", legivel, { motivo: novo.decisao?.motivo ?? null });
    return eventos;
  }

  if (!anterior.nossa_desclassificada && novo.nossa_desclassificada) {
    add("desclassificada", "A proposta da empresa foi desclassificada neste item");
  }

  let mudouLideranca = false;
  if (anterior.sou_lider !== true && novo.sou_lider === true) {
    add("lideranca-assumida", `A empresa assumiu o 1º lugar${nosso ? ` com ${nosso}` : ""}`, { nosso_lance: novo.nosso_lance ?? null });
    mudouLideranca = true;
  } else if (anterior.sou_lider === true && novo.sou_lider === false) {
    add("lideranca-perdida", `A empresa perdeu o 1º lugar${melhor ? ` — melhor lance agora ${melhor}` : ""}`, {
      melhor_lance: novo.melhor_lance ?? null,
    });
    mudouLideranca = true;
  }

  if (
    !mudouLideranca &&
    Number.isFinite(anterior.posicao as number) &&
    Number.isFinite(novo.posicao as number) &&
    anterior.posicao !== novo.posicao
  ) {
    add("posicao", `A empresa passou do ${anterior.posicao}º para o ${novo.posicao}º lugar${melhor ? ` · melhor ${melhor}` : ""}`, {
      de: anterior.posicao,
      para: novo.posicao,
    });
  }

  if (novo.fase && novo.fase !== anterior.fase) {
    add("fase", `Fase da disputa: ${ROTULO_DA_FASE[novo.fase] ?? novo.fase}`, { fase: novo.fase });
  }

  const motivoAnterior = anterior.decisao?.acao === "aguardar" ? anterior.decisao?.motivo ?? null : null;
  if (novo.decisao?.acao === "aguardar" && legivel && novo.decisao?.motivo !== motivoAnterior) {
    add("aguardando", legivel, { motivo: novo.decisao?.motivo ?? null });
  }

  return eventos;
}

/**
 * VÁRIOS ITENS NA MESMA SESSÃO (Fase 7, 16/09/2026).
 *
 * O robô passou a acompanhar todos os itens do pregão e manda um estado por
 * item. `sessoes_lance_real.estado_sala` guarda o último estado recebido (o
 * formato de antes, lido pela tela) e, em `por_item`, o último de CADA item.
 * Sem isso a linha do tempo compararia o item 2 com o item 1 e registraria
 * "a empresa passou do 8º para o 3º lugar" a cada troca de item.
 */
export type EstadoGravado = EstadoDaSala & { por_item?: Record<string, EstadoDaSala> };

const chaveDoItem = (item: number | null | undefined) => String(item ?? "-");

function semPorItem(estado: EstadoGravado): EstadoDaSala {
  const { por_item: _ignorado, ...resto } = estado;
  return resto;
}

/** O estado anterior DO MESMO item; o formato antigo (sem `por_item`) vale como o do item que ele traz. */
export function anteriorDoItem(gravado: EstadoGravado | null | undefined, item: number | null | undefined): EstadoDaSala | null {
  if (!gravado) return null;
  const chave = chaveDoItem(item);
  if (gravado.por_item) return gravado.por_item[chave] ?? null;
  return chaveDoItem(gravado.item) === chave ? semPorItem(gravado) : null;
}

/** O que gravar: o estado novo por cima, com o último de cada item em `por_item`. */
export function mesclarEstadoDoItem(gravado: EstadoGravado | null | undefined, novo: EstadoDaSala): EstadoGravado {
  const base: Record<string, EstadoDaSala> = gravado
    ? gravado.por_item
      ? { ...gravado.por_item }
      : { [chaveDoItem(gravado.item)]: semPorItem(gravado) }
    : {};
  base[chaveDoItem(novo.item)] = novo;
  return { ...novo, por_item: base };
}
